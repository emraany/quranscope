# Quranscope

Quranscope is a web application for exploring the Quran with search, themes, and AI-powered explanations.

[**https://quranscope.vercel.app**](https://quranscope.vercel.app/)
---

## Tech Stack

### Frontend
- Next.js
- TypeScript
- Tailwind CSS
- shadcn/ui
- Hosted on Vercel

### Backend
- FastAPI (Python)
- AI explanations via OpenAI/Hugging Face models
- Python scripts for data parsing
- Hosted on Railway / Render

---

## Features
-  **Search:** Find ayahs by keywords(whole word or partial matches) or themes with the necessary filtering options
-  **Verse Details:** Arabic, translation, tafsir toggle, AI explanation button with response style options
-  **Themes:** Each ayah tagged with 2–4 themes giving the ability to browse similar verses
-  **Streaming AI:** Explanations trickle in and load fast for a smooth user experience  

---

## Development Setup

### Prerequisites
- Node.js 18+
- Python 3.10+
- MongoDB Atlas (optional if persisting data)

### Frontend
```bash
cd quran-app
npm install
npm run dev
```

### Backend
```bash
cd quran-api
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Set FRONTEND_URL and OPENAI_API_KEY in environment variables
