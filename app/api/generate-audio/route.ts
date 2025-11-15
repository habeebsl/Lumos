import { NextRequest, NextResponse } from 'next/server';
import { generateAudioFromText } from '@/lib/services/audio';

// Cache generated audio with alignment to avoid regenerating
const audioCache = new Map<string, { audioUrl: string; words: any[] }>();

export async function POST(req: NextRequest) {
  try {
    const { milestoneId, transcript } = await req.json();

    if (!transcript) {
      return NextResponse.json({ error: 'Transcript is required' }, { status: 400 });
    }

    // Check cache first
    const cacheKey = `${milestoneId}-${transcript.substring(0, 50)}`;
    if (audioCache.has(cacheKey)) {
      return NextResponse.json(audioCache.get(cacheKey));
    }

    // Generate audio with forced alignment
    const result = await generateAudioFromText(transcript);
    
    // Cache it
    if (result.audioUrl) {
      audioCache.set(cacheKey, result);
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Audio generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate audio', details: error.message },
      { status: 500 }
    );
  }
}
