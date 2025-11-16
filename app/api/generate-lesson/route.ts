import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { generateLessonStructure, generateContextualContent } from '@/lib/services/content';
import { fetchMultipleImages } from '@/lib/services/search';

interface Milestone {
  id: number;
  title: string;
  transcript: string;
  imageUrls: string[];
  imageCues: string[];
  emphasisWords: string[];
  audioTimestamps: { time: number; action: string }[];
}

interface Lesson {
  id: string;
  topic: string;
  milestones: Milestone[];
}

// In-memory storage for MVP (use DB in production)
const lessons = new Map<string, Lesson>();

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { topic } = body;

    // Validate input
    if (!topic || typeof topic !== 'string') {
      return NextResponse.json({ error: 'Topic is required and must be a string' }, { status: 400 });
    }

    const trimmedTopic = topic.trim();
    if (trimmedTopic.length === 0) {
      return NextResponse.json({ error: 'Topic cannot be empty' }, { status: 400 });
    }

    if (trimmedTopic.length > 200) {
      return NextResponse.json({ error: 'Topic is too long (max 200 characters)' }, { status: 400 });
    }

    // Generate unique lesson ID
    const lessonId = crypto.randomBytes(16).toString('hex');

    try {
      // Step 1: Generate contextual content using GPT
      const contextContent = await generateContextualContent(trimmedTopic);

      // Step 2: Generate structured milestones with image descriptions
      const rawMilestones = await generateLessonStructure(trimmedTopic, contextContent);

      if (!rawMilestones || rawMilestones.length === 0) {
        throw new Error('Failed to generate lesson structure');
      }

      // Step 3: Fetch all images in parallel
      const allImageDescriptions = rawMilestones.flatMap(m => m.imageDescriptions || []);
      const allImages = await fetchMultipleImages(allImageDescriptions);
      
      // Distribute images back to milestones
      let imageIndex = 0;
      const milestones: Milestone[] = rawMilestones.map((m, i) => {
        const imageCount = m.imageDescriptions?.length || 1;
        const imageUrls = allImages.slice(imageIndex, imageIndex + imageCount);
        imageIndex += imageCount;
        
        return {
          id: i + 1,
          title: m.title || `Section ${i + 1}`,
          transcript: m.transcript || '',
          imageUrls: imageUrls.length > 0 ? imageUrls : ['https://source.unsplash.com/800x600/?education'],
          imageCues: m.imageCues || [],
          emphasisWords: m.emphasisWords || [],
          audioTimestamps: [{ time: 0, action: 'show_content' }],
        };
      });

      // Store lesson
      const lesson: Lesson = {
        id: lessonId,
        topic: trimmedTopic,
        milestones,
      };
      lessons.set(lessonId, lesson);

      return NextResponse.json({ lessonId });
    } catch (generationError: any) {
      console.error('Content generation error:', generationError);
      return NextResponse.json(
        { error: 'Failed to generate lesson content. Please try again.', details: generationError.message },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Lesson generation error:', error);
    
    // Handle JSON parsing errors
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: 'Invalid request format' },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to generate lesson', details: error.message },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lessonId = searchParams.get('id');

  if (!lessonId) {
    return NextResponse.json({ error: 'Lesson ID required' }, { status: 400 });
  }

  const lesson = lessons.get(lessonId);
  if (!lesson) {
    return NextResponse.json({ error: 'Lesson not found' }, { status: 404 });
  }

  return NextResponse.json(lesson);
}
