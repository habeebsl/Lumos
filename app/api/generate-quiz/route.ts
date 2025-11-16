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
    const body = await req.json();
    const { sectionId, title, transcript } = body;

    // Validate inputs
    if (!transcript || typeof transcript !== 'string') {
      return NextResponse.json(
        { error: 'Transcript is required and must be a string' },
        { status: 400 }
      );
    }

    if (!title || typeof title !== 'string') {
      return NextResponse.json(
        { error: 'Title is required and must be a string' },
        { status: 400 }
      );
    }

    if (transcript.trim().length < 50) {
      return NextResponse.json(
        { error: 'Transcript is too short to generate a quiz' },
        { status: 400 }
      );
    }

    // Check cache first
    const cacheKey = `${sectionId}-${transcript.substring(0, 50)}`;
    if (quizCache.has(cacheKey)) {
      return NextResponse.json(quizCache.get(cacheKey));
    }

    try {
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
        throw new Error('Empty response from AI');
      }

      let quizData: QuizResponse;
      try {
        quizData = JSON.parse(quizText);
      } catch (parseError) {
        console.error('Failed to parse quiz JSON:', parseError);
        console.error('Response text:', quizText);
        throw new Error('Failed to parse quiz response from AI');
      }

      // Validate quiz structure
      if (!quizData.questions || !Array.isArray(quizData.questions)) {
        console.error('Invalid quiz structure:', quizData);
        throw new Error('Invalid quiz structure received from AI');
      }

      if (quizData.questions.length === 0) {
        throw new Error('No questions generated');
      }

      // Validate each question
      for (let i = 0; i < quizData.questions.length; i++) {
        const q = quizData.questions[i];
        if (!q.question || !Array.isArray(q.options) || q.options.length !== 4 || 
            typeof q.correctIndex !== 'number' || !q.explanation) {
          console.error(`Invalid question structure at index ${i}:`, q);
          throw new Error(`Invalid question structure at index ${i}`);
        }
        
        // Validate correctIndex is within bounds
        if (q.correctIndex < 0 || q.correctIndex >= 4) {
          throw new Error(`Invalid correctIndex ${q.correctIndex} for question ${i}`);
        }
      }

      const result = { questions: quizData.questions };

      // Cache the quiz
      quizCache.set(cacheKey, result);

      return NextResponse.json(result);
    } catch (aiError: any) {
      console.error('AI generation error:', aiError);
      return NextResponse.json(
        { error: 'Failed to generate quiz questions', details: aiError.message },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Quiz generation error:', error);
    
    // Handle JSON parsing errors
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: 'Invalid request format' },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to generate quiz', details: error.message },
      { status: 500 }
    );
  }
}
