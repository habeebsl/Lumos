import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { generateLessonStructure, generateContextualContent } from '@/lib/services/content';
import { fetchMultipleImages } from '@/lib/services/search';

interface Milestone {
  id: number;
  title: string;
  transcript: string;
  imageUrls: string[];
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
    const { topic } = await req.json();

    if (!topic) {
      return NextResponse.json({ error: 'Topic is required' }, { status: 400 });
    }

    // Generate unique lesson ID
    const lessonId = crypto.randomBytes(16).toString('hex');

    // Step 1: Generate contextual content using GPT
    const contextContent = await generateContextualContent(topic);

    // Step 2: Generate structured milestones with image descriptions
    const rawMilestones = await generateLessonStructure(topic, contextContent);

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
        title: m.title,
        transcript: m.transcript,
        imageUrls: imageUrls.length > 0 ? imageUrls : ['https://source.unsplash.com/800x600/?education'],
        audioTimestamps: [{ time: 0, action: 'show_content' }],
      };
    });

    // Store lesson
    const lesson: Lesson = {
      id: lessonId,
      topic,
      milestones,
    };
    lessons.set(lessonId, lesson);

    return NextResponse.json({ lessonId });
  } catch (error: any) {
    console.error('Lesson generation error:', error);
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
