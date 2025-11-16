import { NextRequest, NextResponse } from 'next/server';
import { generateKidVoiceAudio } from '@/lib/services/audio';

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json();

    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    const audioUrl = await generateKidVoiceAudio(text);

    return NextResponse.json({ audioUrl });
  } catch (error) {
    console.error('Voice generation error:', error);
    // Return empty URL on error - feature will work without voice
    return NextResponse.json({ audioUrl: '' });
  }
}
