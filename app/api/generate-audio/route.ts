import { NextRequest, NextResponse } from 'next/server';
import { generateAudioFromText } from '@/lib/services/audio';

// Cache generated audio with alignment to avoid regenerating
const audioCache = new Map<string, { audioUrl: string; words: any[] }>();

export async function POST(req: NextRequest) {
  try {
    const { milestoneId, transcript, imageCues } = await req.json();

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
    
    // Calculate image timings based on cues
    const imageTimings: number[] = [];
    if (imageCues && imageCues.length > 0 && result.words.length > 0) {
      console.log('Processing image cues:', imageCues);
      console.log('Total words in alignment:', result.words.length);
      
      for (let cueIndex = 0; cueIndex < imageCues.length; cueIndex++) {
        const cue = imageCues[cueIndex];
        // Find when this text cue appears in the word alignments
        const cueWords = cue.toLowerCase().split(/\s+/).filter((w: string) => w.length > 0);
        let foundTime = -1;
        
        console.log(`Looking for cue "${cue}" (words: [${cueWords.join(', ')}])`);
        
        for (let i = 0; i <= result.words.length - cueWords.length; i++) {
          let match = true;
          for (let j = 0; j < cueWords.length; j++) {
            const wordText = result.words[i + j]?.text.toLowerCase().replace(/[.,!?;:\s]/g, '');
            const cueWord = cueWords[j].replace(/[.,!?;:\s]/g, '');
            if (wordText !== cueWord) {
              match = false;
              break;
            }
          }
          if (match) {
            foundTime = result.words[i].start;
            console.log(`Found cue at word index ${i}, time: ${foundTime}s`);
            break;
          }
        }
        
        if (foundTime < 0) {
          console.warn(`Could not find cue "${cue}" in transcript. Using fallback timing.`);
          // Use proportional fallback: spread images evenly across duration
          const duration = result.words[result.words.length - 1]?.end || 10;
          foundTime = (duration / imageCues.length) * cueIndex;
        }
        
        imageTimings.push(foundTime);
      }
      
      console.log('Final image timings:', imageTimings);
    }
    
    const response = {
      audioUrl: result.audioUrl,
      words: result.words,
      imageTimings,
    };
    
    // Cache it
    if (result.audioUrl) {
      audioCache.set(cacheKey, response);
    }

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('Audio generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate audio', details: error.message },
      { status: 500 }
    );
  }
}
