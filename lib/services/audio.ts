import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

const elevenlabs = new ElevenLabsClient({
  environment: "https://api.elevenlabs.io",
  apiKey: process.env.ELEVENLABS_API_KEY || '',
});

interface WordAlignment {
  text: string;
  start: number;
  end: number;
}

interface AudioWithAlignment {
  audioUrl: string;
  words: WordAlignment[];
}

export async function generateAudioFromText(text: string): Promise<AudioWithAlignment> {
  try {
    // Step 1: Generate audio
    const audioStream = await elevenlabs.textToSpeech.convert('tk4jYnPOK7dmAM8W2ftY', {
      text: text,
      modelId: 'eleven_v3',
    });

    // Read the stream and convert to buffer
    const reader = audioStream.getReader();
    const chunks: Uint8Array[] = [];
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    
    // Calculate total length and create final buffer
    const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const audioBuffer = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      audioBuffer.set(chunk, offset);
      offset += chunk.length;
    }
    
    // Step 2: Get forced alignment using the SDK
    const alignment = await elevenlabs.forcedAlignment.create({
      // @ts-ignore - SDK types might not be updated
      file: Buffer.from(audioBuffer),
      text: text,
    });

    const words: WordAlignment[] = alignment.words || [];
    
    // Convert to base64 data URL
    const base64Audio = Buffer.from(audioBuffer).toString('base64');
    
    return {
      audioUrl: `data:audio/mpeg;base64,${base64Audio}`,
      words,
    };
  } catch (error) {
    console.error('Audio generation failed:', error);
    return {
      audioUrl: '',
      words: [],
    };
  }
}

export async function generateKidVoiceAudio(text: string): Promise<string> {
  try {
    // Use a kid/young voice - you can change this voice ID
    const kidVoiceId = process.env.ELEVENLABS_KID_VOICE_ID || 'vbwrxyP4Ty8QWyMlVrsH';

    const audioStream = await elevenlabs.textToSpeech.convert(kidVoiceId, {
      text: text,
      modelId: 'eleven_v3',
    });

    // Read the stream and convert to buffer
    const reader = audioStream.getReader();
    const chunks: Uint8Array[] = [];
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    
    // Calculate total length and create final buffer
    const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const audioBuffer = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      audioBuffer.set(chunk, offset);
      offset += chunk.length;
    }

    // Convert to base64 data URL
    const base64Audio = Buffer.from(audioBuffer).toString('base64');
    
    return `data:audio/mpeg;base64,${base64Audio}`;
  } catch (error) {
    console.error('Kid voice generation failed:', error);
    return '';
  }
}
