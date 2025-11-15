import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { message, context } = await req.json();

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // Build context from lesson
    const contextPrompt = `You are a helpful teaching assistant. The student is currently learning about "${context.topic}".

Here are the lesson milestones:
${context.milestones.map((m: any, i: number) => `${i + 1}. ${m.title}\n${m.transcript}`).join('\n\n')}

The student is currently on milestone ${context.currentMilestone + 1}: ${context.milestones[context.currentMilestone].title}

Answer the student's question clearly and helpfully. Keep it concise (2-3 sentences max).`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: contextPrompt },
        { role: 'user', content: message },
      ],
      temperature: 0.7,
      max_tokens: 200,
    });

    const reply = response.choices[0].message.content || 'Sorry, I could not generate a response.';

    return NextResponse.json({ reply });
  } catch (error: any) {
    console.error('Chat error:', error);
    return NextResponse.json(
      { error: 'Failed to process chat', details: error.message },
      { status: 500 }
    );
  }
}
