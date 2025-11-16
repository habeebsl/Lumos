import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

// Cache sandboxes
const sandboxCache = new Map<string, any>();

interface PuzzlePiece {
  id: string;
  label: string;
  emoji: string;
  color: string;
  description: string;
}

interface Combination {
  pieces: string[]; // Array of piece IDs that combine
  result: PuzzlePiece; // What they create when combined
  explanation: string;
}

interface DragDropSandbox {
  type: 'drag-drop';
  mode: 'build' | 'breakdown';
  title: string;
  description: string;
  startingPieces: PuzzlePiece[]; // For build mode
  targetPiece: PuzzlePiece; // For breakdown mode
  combinations: Combination[]; // Valid combinations for build mode
  breakdownLevels?: PuzzlePiece[][]; // Hierarchy for breakdown mode
  kidFriendlyExplanation: string;
  celebrationMessage: string;
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

    // Check cache
    const cacheKey = `${sectionId}-${transcript.substring(0, 50)}`;
    if (sandboxCache.has(cacheKey)) {
      return NextResponse.json(sandboxCache.get(cacheKey));
    }

    // Generate drag-drop sandbox with Gemini
    const prompt = `You are an interactive learning designer for kids. Create a hands-on drag-and-drop LEARNING ACTIVITY (NOT a quiz) to help students deeply understand this concept through experimentation.

Topic: ${title}
Content: ${transcript}

PURPOSE: Help students EXPLORE and UNDERSTAND by building or deconstructing. This is NOT a test - it's a learning tool.

Choose BUILD mode if the topic has clear COMPONENTS that combine (anatomy, chemistry, grammar, language, etc.)
Choose BREAKDOWN mode if the topic is about UNDERSTANDING STRUCTURE (systems, hierarchies, processes)

For BUILD mode:
- Create 3-6 pieces students can experiment with
- Define MULTIPLE valid combinations - think about ALL logical ways pieces can work together
- Avoid rigid single-path solutions - allow exploration and discovery
- Each combination should teach a different aspect of the concept
- IMPORTANT: If two pieces logically interact (even partially), create a combination for them
- Create progressive combinations: simple pairs → more complex assemblies
- Make results TEACH something new (include facts in result descriptions)
- Wrong combinations should give helpful hints, not penalties

Example combinations for "Neurons":
- Dendrite + Cell Body = "Receiving Unit" (signal input)
- Cell Body + Axon = "Sending Unit" (signal output)
- Dendrite + Axon = "Signal Path" (simplified connection, teaches flow)
- Active Neuron + K+ Door = "Repolarization Stage" (returning to rest state)
- All pieces = "Complete Neuron" (final assembly)

CRITICAL: Think about EVERY possible pairing and what it would teach!

For BREAKDOWN mode:
- Start with ONE complete thing
- Break it down into 2-4 levels that progressively reveal details
- Each level should TEACH something (include facts in descriptions)
- Make it feel like zooming in or peeling layers

CRITICAL RULES:
- Use BIG colorful emojis (50-60px rendered size)
- Pieces should be CONCRETE and VISUAL (not abstract concepts)
- Keep it SIMPLE - immediate understanding
- Descriptions should TEACH (include interesting facts)
- Celebration messages should reinforce learning
- Every interaction should feel educational, not game-like
- Design for progressive learning (simple → complex)

Return ONLY valid JSON (no markdown):

For BUILD mode:
{
  "type": "drag-drop",
  "mode": "build",
  "title": "Build a [Thing]!",
  "description": "Drag pieces together to create [something]!",
  "startingPieces": [
    {
      "id": "piece1",
      "label": "Part Name",
      "emoji": "🧬",
      "color": "#3b82f6",
      "description": "What this piece is"
    }
  ],
  "combinations": [
    {
      "pieces": ["piece1", "piece2"],
      "result": {
        "id": "result1",
        "label": "Combined Thing",
        "emoji": "✨",
        "color": "#10b981",
        "description": "What you created!"
      },
      "explanation": "Fun fact about this combination!"
    }
  ],
  "kidFriendlyExplanation": "Simple explanation of what they're learning",
  "celebrationMessage": "Awesome! You did it! 🎉"
}

For BREAKDOWN mode:
{
  "type": "drag-drop",
  "mode": "breakdown",
  "title": "Explore the [System]!",
  "description": "Click to break it down and see what's inside!",
  "targetPiece": {
    "id": "whole",
    "label": "Complete Thing",
    "emoji": "🧠",
    "color": "#8b5cf6",
    "description": "The whole system"
  },
  "breakdownLevels": [
    [
      {"id": "level1-1", "label": "Major Part 1", "emoji": "🎯", "color": "#3b82f6", "description": "First major component"},
      {"id": "level1-2", "label": "Major Part 2", "emoji": "⚡", "color": "#10b981", "description": "Second major component"}
    ],
    [
      {"id": "level2-1", "label": "Detail 1", "emoji": "🔬", "color": "#f59e0b", "description": "Smaller piece"},
      {"id": "level2-2", "label": "Detail 2", "emoji": "🧩", "color": "#ec4899", "description": "Another piece"}
    ]
  ],
  "kidFriendlyExplanation": "Simple explanation",
  "celebrationMessage": "You explored it all! 🎉"
}

EXAMPLE for "Neurons" (BUILD):
{
  "type": "drag-drop",
  "mode": "build",
  "title": "Build Neural Components!",
  "description": "Explore how neuron parts work together!",
  "startingPieces": [
    {"id": "dendrite", "label": "Dendrites", "emoji": "🌿", "color": "#22c55e", "description": "Receives signals"},
    {"id": "soma", "label": "Cell Body", "emoji": "⭐", "color": "#3b82f6", "description": "Brain of the cell"},
    {"id": "axon", "label": "Axon", "emoji": "⚡", "color": "#f59e0b", "description": "Sends signals"},
    {"id": "active", "label": "Active Neuron", "emoji": "⚡️", "color": "#ef4444", "description": "Neuron that just fired"},
    {"id": "k_door", "label": "Door for K+", "emoji": "🔓", "color": "#8b5cf6", "description": "Potassium channel"}
  ],
  "combinations": [
    {
      "pieces": ["dendrite", "soma"],
      "result": {"id": "receiving", "label": "Receiving Unit", "emoji": "📥", "color": "#10b981", "description": "Input side of neuron"},
      "explanation": "Dendrites connect to the cell body to receive incoming signals from other neurons!"
    },
    {
      "pieces": ["soma", "axon"],
      "result": {"id": "sending", "label": "Sending Unit", "emoji": "📤", "color": "#f97316", "description": "Output side of neuron"},
      "explanation": "The cell body connects to the axon to send signals to other neurons!"
    },
    {
      "pieces": ["active", "k_door"],
      "result": {"id": "repolarize", "label": "Repolarization", "emoji": "🔄", "color": "#06b6d4", "description": "Neuron resetting after firing"},
      "explanation": "After firing, K+ channels open to let potassium OUT, resetting the neuron's charge!"
    },
    {
      "pieces": ["dendrite", "axon"],
      "result": {"id": "path", "label": "Signal Path", "emoji": "➡️", "color": "#a855f7", "description": "Simplified neuron connection"},
      "explanation": "Signals flow from dendrites (input) through to axons (output) - this is the basic signal pathway!"
    },
    {
      "pieces": ["dendrite", "soma", "axon"],
      "result": {"id": "neuron", "label": "Complete Neuron", "emoji": "🧠", "color": "#8b5cf6", "description": "A fully working neuron!"},
      "explanation": "You built a complete neuron! It can receive AND send signals throughout your body!"
    }
  ],
  "kidFriendlyExplanation": "Neurons are made of parts that work together. You can explore how different parts interact - there's no single 'right' way, each combination teaches something about how neurons work!",
  "celebrationMessage": "Great exploration! You discovered multiple ways neurons function!"
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        temperature: 0.7,
        responseMimeType: 'application/json',
      },
    });

    const sandboxText = response.text;

    if (!sandboxText) {
      return NextResponse.json(
        { error: 'Empty response from Gemini' },
        { status: 500 }
      );
    }

    let sandboxData: DragDropSandbox;
    try {
      sandboxData = JSON.parse(sandboxText);
    } catch (parseError) {
      console.error('Failed to parse sandbox JSON:', parseError);
      console.error('Response text:', sandboxText);
      return NextResponse.json(
        { error: 'Failed to parse sandbox response' },
        { status: 500 }
      );
    }

    // Validate structure
    if (!sandboxData.title || !sandboxData.mode || sandboxData.type !== 'drag-drop') {
      console.error('Invalid sandbox structure:', sandboxData);
      return NextResponse.json(
        { error: 'Invalid sandbox structure' },
        { status: 500 }
      );
    }
    
    // Validate based on mode
    if (sandboxData.mode === 'build') {
      if (!sandboxData.startingPieces || !Array.isArray(sandboxData.startingPieces) || 
          sandboxData.startingPieces.length < 2) {
        console.error('Build mode needs at least 2 starting pieces');
        return NextResponse.json(
          { error: 'Invalid build mode structure' },
          { status: 500 }
        );
      }
      if (!sandboxData.combinations || !Array.isArray(sandboxData.combinations) || 
          sandboxData.combinations.length === 0) {
        console.error('Build mode needs combinations');
        return NextResponse.json(
          { error: 'Invalid build mode structure' },
          { status: 500 }
        );
      }
    } else if (sandboxData.mode === 'breakdown') {
      if (!sandboxData.targetPiece || !sandboxData.breakdownLevels || 
          !Array.isArray(sandboxData.breakdownLevels) || 
          sandboxData.breakdownLevels.length === 0) {
        console.error('Breakdown mode needs target and levels');
        return NextResponse.json(
          { error: 'Invalid breakdown mode structure' },
          { status: 500 }
        );
      }
    }

    const result = sandboxData;

    // Cache it
    sandboxCache.set(cacheKey, result);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Sandbox generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate sandbox', details: error.message },
      { status: 500 }
    );
  }
}
