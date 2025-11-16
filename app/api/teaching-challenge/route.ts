import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, topic, lessonContent, conversation, explanation } = body;

    // Validate required fields
    if (!action || typeof action !== 'string') {
      return NextResponse.json({ error: 'Action is required' }, { status: 400 });
    }

    if (!topic || typeof topic !== 'string') {
      return NextResponse.json({ error: 'Topic is required' }, { status: 400 });
    }

    if (!lessonContent || typeof lessonContent !== 'string') {
      return NextResponse.json({ error: 'Lesson content is required' }, { status: 400 });
    }

    if (action === 'start') {
      // Generate the kid's first question
      const prompt = `You are a curious, intelligent 5-year-old child who wants to learn about "${topic}".

The lesson content is:
${lessonContent}

Your job is to ask the very first "What is..." question about this topic. Be genuinely curious and speak like a real 5-year-old would - simple words, natural speech patterns, enthusiasm.

Examples of good first questions:
- "What is a neuron? Like, what does it do?"
- "What's an action potential? Is it like electricity?"
- "What are those sodium things? Are they like salt?"

Generate ONE initial question. Just the question, nothing else. Be curious and eager to learn!`;

      try {
        const result = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
          config: {
            temperature: 0.8,
          },
        });

        const question = result.text?.trim().replace(/"/g, '') || 'What is this topic about?';

        return NextResponse.json({
          question,
          understanding: 0,
        });
      } catch (aiError: any) {
        console.error('AI generation error:', aiError);
        return NextResponse.json(
          { error: 'Failed to generate question', details: aiError.message },
          { status: 500 }
        );
      }
    }

    if (action === 'respond') {
      // Validate additional fields for respond action
      if (!conversation || !Array.isArray(conversation)) {
        return NextResponse.json({ error: 'Conversation history is required' }, { status: 400 });
      }

      if (!explanation || typeof explanation !== 'string') {
        return NextResponse.json({ error: 'Explanation is required' }, { status: 400 });
      }

      // Analyze the teacher's explanation and generate follow-up
      const conversationText = conversation
        .map((m: any) => `${m.role === 'kid' ? 'Kid' : 'Teacher'}: ${m.content}`)
        .join('\n');

      const prompt = `You are a curious, intelligent 5-year-old child learning about "${topic}".

Lesson content (for your reference):
${lessonContent}

Conversation so far:
${conversationText}

The teacher just explained: "${explanation}"

Your job:
1. Evaluate how well the teacher explained things (0-10 scale)
2. Find any ambiguity, gaps, or confusing parts in their explanation
3. Ask a follow-up question that:
   - Exploits ambiguity ("But you said X, so why does Y happen?")
   - Asks "why" about things they didn't explain
   - Questions assumptions ("What if that didn't happen?")
   - Asks about what happens next
   - Challenges with curiosity, not rudeness

Speak like a real 5-year-old:
- Use simple words
- Be genuinely curious
- Show emotion ("Ohhh!", "Wait, but...", "That's cool!")
- Sometimes get confused by big words
- Ask concrete questions

If the explanation was EXCELLENT (9-10/10) and you truly understand, express joy and understanding.
If it was okay but has gaps (5-8/10), ask a probing follow-up.
If it was confusing (0-4/10), express confusion and ask for simpler explanation.

Response format:
UNDERSTANDING: [0-10]
REACTION: [confused/surprised/skeptical/understanding]
RESPONSE: [your question or statement as the kid]

Be authentic and natural!`;

      try {
        const result = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
          config: {
            temperature: 0.8,
          },
        });

        const responseText = result.text?.trim() || '';

        // Parse the response
        const understandingMatch = responseText.match(/UNDERSTANDING:\s*(\d+)/i);
        const reactionMatch = responseText.match(/REACTION:\s*(\w+)/i);
        const responseMatch = responseText.match(/RESPONSE:\s*([\s\S]+)/);

        const understandingScore = understandingMatch ? Math.min(10, Math.max(0, parseInt(understandingMatch[1]))) : 5;
        const reaction = reactionMatch ? reactionMatch[1].toLowerCase() : 'confused';
        const kidResponse = responseMatch 
          ? responseMatch[1].trim().replace(/"/g, '') 
          : "Hmm, I'm still a bit confused. Can you explain it differently?";

        return NextResponse.json({
          response: kidResponse,
          understanding: understandingScore,
          reaction,
        });
      } catch (aiError: any) {
        console.error('AI response error:', aiError);
        return NextResponse.json(
          { error: 'Failed to generate response', details: aiError.message },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ error: 'Invalid action. Must be "start" or "respond"' }, { status: 400 });
  } catch (error: any) {
    console.error('Teaching challenge error:', error);
    
    // Handle JSON parsing errors
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: 'Invalid request format' },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to process teaching challenge', details: error.message },
      { status: 500 }
    );
  }
}
