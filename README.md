# Lumos 🔆

An AI-powered interactive learning platform that turns any concept into an immersive audio-visual lesson.

## Features

✨ **Instant Lesson Generation** - Enter any topic and get structured learning milestones
🎙️ **AI Voice Teacher** - ElevenLabs-powered audio narration
🖼️ **Visual Content** - Wikipedia-scraped images and content
💬 **Context-Aware Chatbot** - Ask questions anytime during your lesson
📚 **Milestone Navigation** - Progress through structured learning paths

## Tech Stack

- **Frontend**: Next.js 16 + React 19 + TypeScript + Tailwind CSS
- **AI**: OpenAI GPT-4 (content generation) + ElevenLabs (audio)
- **Content**: Wikipedia scraping with Cheerio + Axios

## Setup Instructions

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Add your API keys to `.env.local`**:
   ```
   OPENAI_API_KEY=your_openai_key_here
   ELEVENLABS_API_KEY=your_elevenlabs_key_here
   ```

3. **Run the development server**:
   ```bash
   npm run dev
   ```

4. **Open** [http://localhost:3000](http://localhost:3000)

## How It Works

1. User enters a topic on the landing page
2. Backend scrapes Wikipedia for content + images
3. GPT structures content into 6-8 learning milestones
4. ElevenLabs generates audio narration
5. User learns through interactive player with milestones, audio, and chat

## MVP Scope (36-hour build)

✅ Landing page with topic input
✅ Wikipedia scraping + GPT content generation
✅ ElevenLabs audio generation
✅ Lesson player with milestone navigation
✅ Audio playback controls
✅ Context-aware chatbot
✅ Responsive UI with smooth transitions

## Future Enhancements

- Real-time animation syncing with audio timestamps
- User accounts and progress tracking
- Interactive diagrams and visualizations
- Multi-language support
- Offline mode
- Lesson sharing and exports

---

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
