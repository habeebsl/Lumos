import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface MilestoneWithImages {
  title: string;
  transcript: string;
  imageDescriptions: string[];
  imageTimings: number[]; // When each image should appear (in seconds from start)
  emphasisWords: string[]; // Words that should be emphasized with color
  imageCues: string[]; // Text snippets that trigger each image (for accurate timing)
}

export async function generateLessonStructure(topic: string, contextContent?: string): Promise<MilestoneWithImages[]> {
  const prompt = contextContent
    ? `You are an engaging, personable teacher having a real conversation with a student about "${topic}". Your job is to teach clearly and make it stick.

Based on this content:
${contextContent}

Create 6-8 learning milestones. Each milestone should:

CRITICAL RULES:
- Start with the CLEAREST, most direct definition/explanation possible
- Only use analogies if they genuinely help (not every section needs one)
- Avoid overused phrases like "Imagine you're..." or "Picture this..." - get to the point
- Talk TO the student: use phrases like "I know this might seem confusing at first, but...", "Now here's where it gets interesting...", "You've probably noticed that...", "Isn't that wild?", "Think about all the times you've...", "If you didn't catch that, let me make it more blunt...", "Here's the simplest way to say it...", "Let me break that down even further..."
- After complex explanations, add a super simple version: "In other words...", "Basically...", "The simple version?", "Think of it like explaining to a five-year-old..."
- Make it feel like a real conversation, not a scripted lecture
- Include enough actual information - be thorough, not just surface-level
- NO markdown formatting (no **, __, etc.)
- Avoid em-dashes and long dashes - use commas or periods instead
- Build concepts progressively - don't assume prior knowledge

Structure each milestone:
1. Punchy title (5-8 words)
2. 250-350 word transcript that:
   - Opens with the core concept stated CLEARLY and directly
   - Adds context and details
   - Uses analogies ONLY when they genuinely clarify (not decoration)
   - After technical parts, add simplified versions: "Let me say that more simply..."
   - Speaks naturally with personality
   - Connects to real experiences
3. 2-4 specific image descriptions for visualization (can be more if needed)
4. For each image, specify a SHORT text snippet from the transcript that indicates when to show it
5. List 3-5 key terms to emphasize with color

Return ONLY valid JSON (no markdown code blocks):
{
  "milestones": [
    {
      "title": "What Exactly Is a ${topic}?",
      "transcript": "A neuron is a specialized cell that transmits electrical and chemical signals throughout your body. That's it - that's the foundation. Now let me break down what makes them so fascinating...",
      "imageDescriptions": [
        "detailed microscopic view of a neuron showing cell body, dendrites, and axon",
        "diagram of neural synapse with neurotransmitters crossing the gap",
        "comparison showing different types of neurons side by side"
      ],
      "imageCues": [
        "specialized cell",
        "break down what makes them",
        "different types"
      ],
      "emphasisWords": ["neuron", "signals", "cell"]
    }
  ]
}`
    : `You are an engaging, personable teacher having a real conversation with a student about "${topic}". Your job is to teach clearly and make it stick.

Create 6-8 learning milestones. Each milestone should:

CRITICAL RULES:
- Start with the CLEAREST, most direct definition/explanation possible
- Only use analogies if they genuinely help (not every section needs one)
- Avoid overused phrases like "Imagine you're..." or "Picture this..." - get to the point
- Talk TO the student: use phrases like "I know this might seem confusing at first, but...", "Now here's where it gets interesting...", "You've probably noticed that...", "Isn't that wild?", "Think about all the times you've...", "If you didn't catch that, let me make it more blunt...", "Here's the simplest way to say it...", "Let me break that down even further..."
- After complex explanations, add a super simple version: "In other words...", "Basically...", "The simple version?", "Think of it like explaining to a five-year-old..."
- Make it feel like a real conversation, not a scripted lecture
- Include enough actual information - be thorough, not just surface-level
- NO markdown formatting (no **, __, etc.)
- Avoid em-dashes and long dashes - use commas or periods instead
- Build concepts progressively - don't assume prior knowledge

Structure each milestone:
1. Punchy title (5-8 words)
2. 250-350 word transcript that:
   - Opens with the core concept stated CLEARLY and directly
   - Adds context and details
   - Uses analogies ONLY when they genuinely clarify (not decoration)
   - After technical parts, add simplified versions: "Let me say that more simply..."
   - Speaks naturally with personality
   - Connects to real experiences
3. 2-4 specific image descriptions for visualization (can be more if needed)
4. For each image, specify a SHORT text snippet from the transcript that indicates when to show it
5. List 3-5 key terms to emphasize with color

Return ONLY valid JSON (no markdown code blocks):
{
  "milestones": [
    {
      "title": "What Exactly Is a ${topic}?",
      "transcript": "Let's get straight to it. A neuron is a specialized cell that sends signals through your body. Simple as that. But here's why that matters...",
      "imageDescriptions": [
        "detailed scientific visualization of a neuron structure",
        "diagram showing signal transmission between neurons",
        "real-world brain scan showing neural networks"
      ],
      "imageCues": [
        "specialized cell",
        "sends signals",
        "why that matters"
      ],
      "emphasisWords": ["neuron", "signals", "cell"]
    }
  ]
}`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
  });

  let content = response.choices[0].message.content || '{"milestones":[]}';
  
  // Remove markdown code fences if present
  content = content.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim();
  
  const parsed = JSON.parse(content);
  return parsed.milestones || [];
}

export async function generateContextualContent(topic: string): Promise<string> {
  const prompt = `Write a comprehensive, engaging 600-word overview of "${topic}" that will be used to create an interactive lesson.

Focus on:
- Key concepts explained with analogies
- Why this topic matters (real-world relevance)
- Historical context or origin story
- Common misconceptions
- Interesting facts that hook attention

Write in an engaging, conversational tone. Avoid dry academic language.`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.8,
    max_tokens: 1000,
  });

  return response.choices[0].message.content || '';
}
