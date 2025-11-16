# Lumos

Lumos is a teaching-focused interactive learning web app built with Next.js, React, TypeScript and Tailwind CSS. It helps learners explore a concept through short lessons, quizzes, an interactive sandbox, and a "Teaching Challenge" where the user explains a topic to a curious AI child. The project integrates AI services for content, quizzes, and audio.

## What the app does

- **Generate lessons** for any topic with structured milestones/sections, transcripts, and relevant images (fetched via SerpAPI)
- **Audio playback** of lesson sections (generated via ElevenLabs)
- **Multiple-choice quizzes** generated from section transcripts
- **Interactive Drag & Drop Sandbox** with draggable pieces, combination logic, and explanations
- **Teaching Challenge**: explain a topic to a simulated 5-year-old AI kid who evaluates understanding and asks follow-up questions (includes text-to-speech)
- **In-app chat overlay** for asking questions about the lesson
- **Dark theme** with purple accents and Font Awesome icons
- **Error handling**: input validation, timeouts, retry logic, graceful fallbacks, and user-visible error messages

## What the app does NOT do

- No persistent database (lessons/quizzes cached in-memory; restart clears cache)
- No production-grade rate-limiting, authentication, or multi-tenant isolation
- No included API credits (you must provide your own API keys)
## Setup

1. **Install dependencies**:
```bash
npm install
```

2. **Create `.env.local`** with your API keys (do NOT commit this file):
```
GEMINI_API_KEY=your_gemini_key_here
OPENAI_API_KEY=your_openai_key_here
ELEVENLABS_API_KEY=your_elevenlabs_key_here
SERPAPI_KEY=your_serpapi_key_here
```

3. **Run dev server**:
```bash
npm run dev
```

4. **Open** [http://localhost:3000](http://localhost:3000)

## Tech Stack

- **Frontend**: Next.js 16, React 19, TypeScript, Tailwind CSS 4
- **Drag & Drop**: @dnd-kit/core
- **Icons**: Font Awesome
- **AI**: Google Gemini (via @google/genai)
- **Audio**: ElevenLabs
- **Image Search**: SerpAPI (fetches relevant images for lesson sections)
- **Additional**: axios, cheerio, openai

## Project layout

```
app/
  page.tsx                    # Home page (topic input)
  lesson/[id]/page.tsx        # Lesson viewer (audio, quiz, sandbox, teaching challenge)
  api/
    generate-lesson/          # Generate/fetch lessons with image search
    generate-quiz/            # Generate quiz questions
    generate-sandbox/         # Generate sandbox data
    teaching-challenge/       # Teaching challenge AI logic
    generate-kid-voice/       # Audio for kid's voice
    generate-audio/           # General audio generation
    chat/                     # Chat endpoint
components/
  TeachingChallenge.tsx       # Teaching challenge UI
  DragDropSandbox.tsx         # Sandbox drag/drop UI
lib/services/                 # Helper services (content generation, image search, audio)
```

## Developer notes

### Testing the Teaching Challenge

The home page includes a hidden test button. To enable it, open `app/page.tsx` and change:
```tsx
const [showTestButton, setShowTestButton] = useState(true);
```

### Key features

- **Teaching Challenge**: Uses server-side AI prompts with timeouts (60s) and retry logic. Shows inline error messages if AI fails.
- **Sandbox**: Dark-themed interactive drag/drop. Receives initial data from `POST /api/generate-sandbox`.
- **Quiz**: Generated via `POST /api/generate-quiz` with server-side validation.
- **Audio**: Generated with `POST /api/generate-audio` or `POST /api/generate-kid-voice`. Auto-plays when available.

### API routes

- `POST /api/generate-lesson` — Generate lesson with SerpAPI image search (returns lessonId)
- `GET /api/generate-lesson?id=...` — Fetch lesson by id
- `POST /api/generate-quiz` — Generate quiz questions
- `POST /api/generate-sandbox` — Generate sandbox data
- `POST /api/teaching-challenge` — Teaching challenge AI (actions: `start`, `respond`)
- `POST /api/generate-kid-voice` — Kid voice audio
- `POST /api/generate-audio` — General audio
- `POST /api/chat` — Chat endpoint

## Important notes

- **In-memory storage**: Restarting the server clears generated content
- **API keys required**: You must provide valid keys for AI and audio services
- **No authentication**: Don't deploy publicly without adding auth and rate-limiting
- **Error handling**: Includes validation, timeouts, retries, fallbacks — but AI responses can still be unexpected

## Key files

- `components/TeachingChallenge.tsx` — Teaching challenge logic/UI
- `components/DragDropSandbox.tsx` — Sandbox UI/drag-drop
- `app/lesson/[id]/page.tsx` — Lesson UI, audio, quiz, integrations
- `app/api/*` — Server endpoints
- `lib/services/*` — Helper services
