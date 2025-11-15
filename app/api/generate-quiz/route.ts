import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

// Cache quizzes to avoid regeneration
const quizCache = new Map<string, any>();

interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

interface QuizResponse {
  questions: QuizQuestion[];
}

export async function POST(req: NextRequest) {
  try {
    const { sectionId, title, transcript } = await req.json();

    if (!transcript || !title) {
      return NextResponse.json(
        { error: 'Title and transcript are required' },
        { status: 400 }
      );
    }

    // Check cache first
    const cacheKey = `${sectionId}-${transcript.substring(0, 50)}`;
    if (quizCache.has(cacheKey)) {
      return NextResponse.json(quizCache.get(cacheKey));
    }

    // Generate quiz with Gemini
    const prompt = `You are a quiz generator for an educational platform. Based on the following lesson content, generate 4 multiple-choice questions to test comprehension.

Lesson Title: ${title}
Lesson Content: ${transcript}

CRITICAL RULES:
1. Questions must DIRECTLY test the KEY FACTS and CONCEPTS explained in the lesson
2. DO NOT ask about teaching methods, analogies, or "how the teacher explained" something
3. Ask about WHAT WAS TAUGHT, not HOW it was taught
4. Each question should have 4 plausible options (make wrong answers reasonable but clearly incorrect)
5. Only ONE option is correct
6. Questions should test understanding, not just word-for-word recall
7. Avoid vague or ambiguous phrasing

GOOD QUESTION EXAMPLES:
- "What is the primary function of a neuron?"
- "According to the lesson, how do neurons communicate with each other?"
- "Which part of the neuron receives signals from other cells?"

BAD QUESTION EXAMPLES (DO NOT USE):
- "What analogy was used to describe neurons?" ❌
- "How did the teacher explain synapses?" ❌
- "What example was given for neural transmission?" ❌

EXPLANATION GUIDELINES:
- Write naturally and conversationally
- Directly state why the answer is correct
- Reference the concept, not "the lesson" or "the teacher"
- Keep it brief and clear

GOOD EXPLANATIONS:
- "Neurons transmit electrical signals through their axons to communicate with other cells."
- "Dendrites are the branching structures that receive incoming signals from neighboring neurons."

BAD EXPLANATIONS (AVOID):
- "The lesson states that neurons transmit signals..." ❌
- "According to what was taught, dendrites..." ❌
- "The teacher explained that..." ❌

Return ONLY valid JSON in this exact format (no markdown, no code blocks):
{
  "questions": [
    {
      "question": "Clear, direct question about lesson content?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctIndex": 0,
      "explanation": "Natural, direct explanation without meta-references"
    }
  ]
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        temperature: 0.7,
        responseMimeType: 'application/json',
        thinkingConfig: {
          thinkingBudget: 0, // Disable thinking for speed
        },
      },
    });

    const quizText = response.text;
    console.log('Raw Gemini response:', quizText);

    if (!quizText) {
      return NextResponse.json(
        { error: 'Empty response from Gemini' },
        { status: 500 }
      );
    }

    let quizData: QuizResponse;
    try {
      quizData = JSON.parse(quizText);
    } catch (parseError) {
      console.error('Failed to parse quiz JSON:', parseError);
      console.error('Response text:', quizText);
      return NextResponse.json(
        { error: 'Failed to parse quiz response' },
        { status: 500 }
      );
    }

    // Validate quiz structure
    if (!quizData.questions || !Array.isArray(quizData.questions)) {
      console.error('Invalid quiz structure:', quizData);
      return NextResponse.json(
        { error: 'Invalid quiz structure' },
        { status: 500 }
      );
    }

    // Validate each question
    for (const q of quizData.questions) {
      if (!q.question || !Array.isArray(q.options) || q.options.length !== 4 || 
          typeof q.correctIndex !== 'number' || !q.explanation) {
        console.error('Invalid question structure:', q);
        return NextResponse.json(
          { error: 'Invalid question structure' },
          { status: 500 }
        );
      }
    }

    const result = { questions: quizData.questions };

    // Cache the quiz
    quizCache.set(cacheKey, result);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Quiz generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate quiz', details: error.message },
      { status: 500 }
    );
  }
}
