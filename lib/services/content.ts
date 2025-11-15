import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface MilestoneWithImages {
  title: string;
  transcript: string;
  imageDescriptions: string[];
  imageTimings: number[]; // When each image should appear (in seconds from start)
  emphasisWords: string[]; // Words that should be emphasized with color
}

export async function generateLessonStructure(topic: string, contextContent?: string): Promise<MilestoneWithImages[]> {
  const prompt = contextContent
    ? `You are a charismatic, engaging teacher who makes complex topics fascinating. Your goal is to teach "${topic}" in a way that captivates and sticks.

Based on this content:
${contextContent}

Create 6-8 learning milestones that tell a story. Each milestone should:

1. Have a punchy, intriguing title (5-8 words max)
2. Include a 200-300 word teaching segment that:
   - Starts with a hook (question, surprising fact, or relatable scenario)
   - Explains concepts using analogies and real-world examples
   - Speaks conversationally (use "you", "we", avoid jargon dumps)
   - Builds on previous milestones naturally
   - Ends with a transition to the next point
3. Specify 1-2 highly specific image descriptions that would visualize the concept (be detailed for image search)

Write like you're talking to a curious friend, not reading a textbook. Make it engaging, clear, and memorable.

Return ONLY valid JSON:
{
  "milestones": [
    {
      "title": "Why ${topic} Changed Everything",
      "transcript": "Imagine you're standing at...",
      "imageDescriptions": ["detailed description for visualization", "specific scene or diagram"]
    }
  ]
}`
    : `You are a charismatic, engaging teacher who makes complex topics fascinating. Create an immersive lesson about "${topic}".

Create 6-8 learning milestones that tell a story. Each milestone should:

1. Have a punchy, intriguing title (5-8 words max)
2. Include a 200-300 word teaching segment that:
   - Starts with a hook (question, surprising fact, or relatable scenario)
   - Explains concepts using analogies and real-world examples
   - Speaks conversationally (use "you", "we", avoid jargon dumps)
   - Builds naturally from simple to complex
   - Ends with a transition to the next point
3. Specify 1-2 highly specific image descriptions for visualization

Write like you're talking to a curious friend at a coffee shop, not delivering a lecture. Make every sentence earn its place.

Return ONLY valid JSON:
{
  "milestones": [
    {
      "title": "The Surprising Truth About ${topic}",
      "transcript": "Here's something wild...",
      "imageDescriptions": ["specific detailed scene for image search", "relevant visualization"]
    }
  ]
}`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.8,
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
