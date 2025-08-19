from fastapi import FastAPI, Response, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, Dict, List, TypedDict
from openai import OpenAI
import os
from dotenv import load_dotenv

from datetime import datetime, timedelta, timezone
import threading
import time
import asyncio
import time as pytime

load_dotenv()
API_KEY = os.getenv("OPENAI_API_KEY")
if not API_KEY:
    raise RuntimeError("Missing OPENAI_API_KEY in environment")
client = OpenAI(api_key=API_KEY)

# FastAPI app
app = FastAPI(title="QuranScope API")

FRONTEND_URL = os.getenv("FRONTEND_URL", "")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL] if FRONTEND_URL else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/healthz")
def healthz():
    return {"ok": True}

class ExplainOptions(BaseModel):
    style: Optional[str] = None   # balanced | tldr | bullets | study | youth | reflection | linguistic | context
    length: Optional[str] = None  # short | medium

class ExplainRequest(BaseModel):
    surah: int
    ayah: int
    text: str
    translation: str
    options: Optional[ExplainOptions] = None
    regenerate: bool = False

CACHE_TTL = timedelta(hours=12)

class CacheEntry(TypedDict, total=False):
    text: str
    ts: datetime
    chunks: List[int]
    delays: List[float]

_EXPLAIN_CACHE: Dict[str, CacheEntry] = {}
_CACHE_LOCK = threading.Lock()

def _normalize(s: Optional[str]) -> str:
    return (s or "").strip().lower()

def make_cache_key(req: ExplainRequest) -> str:
    style = _normalize((req.options or ExplainOptions()).style or "balanced")
    length = _normalize((req.options or ExplainOptions()).length or "short")
    return f"{req.surah}:{req.ayah}:{style}:{length}"

def _is_fresh(ts: datetime, now: datetime) -> bool:
    return (now - ts) < CACHE_TTL

def get_cached_entry(key: str) -> Optional[CacheEntry]:
    now = datetime.now(timezone.utc)
    with _CACHE_LOCK:
        entry = _EXPLAIN_CACHE.get(key)
        if not entry:
            return None
        if _is_fresh(entry["ts"], now):
            return entry
        _EXPLAIN_CACHE.pop(key, None)
        return None

def set_cached_entry(key: str, text: str, chunks: Optional[List[int]] = None, delays: Optional[List[float]] = None) -> None:
    with _CACHE_LOCK:
        _EXPLAIN_CACHE[key] = {
            "text": text,
            "ts": datetime.now(timezone.utc),
            **({"chunks": chunks} if chunks is not None else {}),
            **({"delays": delays} if delays is not None else {}),
        }

def _cache_janitor():
    while True:
        time.sleep(600)
        cutoff = datetime.now(timezone.utc) - CACHE_TTL
        with _CACHE_LOCK:
            stale = [k for k, v in _EXPLAIN_CACHE.items() if v["ts"] < cutoff]
            for k in stale:
                _EXPLAIN_CACHE.pop(k, None)

@app.on_event("startup")
def _start_cache_janitor():
    threading.Thread(target=_cache_janitor, daemon=True).start()

def build_prompt(req: ExplainRequest):
    o = req.options or ExplainOptions()
    style = (o.style or "balanced").lower()
    length = (o.length or "short").lower()

    system_guidelines = (
        "You are QuranScope's explainer. Use clear, respectful language suitable for a general audience. "
        "Be faithful to the Arabic and the provided English translation. Avoid legal rulings, sectarian commentary, and polemics. "
        "Keep the tone approachable while preserving the dignity of the verse."
    )

    if style == "tldr":
        target = "Write one tight paragraph of 40–60 words."
    elif style == "bullets":
        target = "Write 3–5 concise bullet points; no paragraph or headings."
    elif style == "study":
        target = "Write 90–130 words; include 1 sentence of neutral context if known; 1 brief key-term gloss if useful."
    elif style == "youth":
        target = "Write 50–70 words at a 6 year old comprehension level; friendly but dignified."
    elif style == "reflection":
        target = "Write 60–80 words reflecting on the verse and end with one practical takeaway."
    elif style == "linguistic":
        target = "Write 60–90 words and include 2–3 key Arabic terms with very brief glosses."
    elif style == "context":
        target = "Write 60–90 words emphasizing historical and/or religious context. Make your explanation about the times, but make the historical context specific to the ayah, not the whole quran/era of prophethood.'"
    else:
        target = "Write one short paragraph of 50–70 words, balanced and neutral."

    if style not in ("tldr", "bullets") and length == "short":
        target = (
            target
            .replace("90–130", "60–90")
            .replace("60–90", "50–70")
            .replace("60–80", "50–70")
        )

    user_prompt = f"""
Explain the following Qur'an verse.

Surah: {req.surah}  Ayah: {req.ayah}
Arabic: {req.text}
English translation: {req.translation}

{target}
Avoid headings or numbered sections unless bullet points were requested.
Be faithful to the given translation; do not introduce legal rulings or sectarian debate.
"""
    return system_guidelines, user_prompt

@app.post("/explain")
async def explain_ayah(req: ExplainRequest, response: Response):
    key = make_cache_key(req)

    if not req.regenerate:
        entry = get_cached_entry(key)
        if entry:
            response.headers["X-Cache"] = "HIT"
            return {"explanation": entry["text"], "cached": True}

    system_guidelines, prompt = build_prompt(req)

    try:
        completion = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": system_guidelines},
                {"role": "user", "content": prompt},
            ],
            max_tokens=400,
            temperature=0.4,
        )
        explanation = (completion.choices[0].message.content or "").strip()
        set_cached_entry(key, explanation)
        response.headers["X-Cache"] = "MISS" if not req.regenerate else "BYPASS-NEW"
        return {"explanation": explanation, "cached": False}
    except Exception as e:
        print("🔥 OpenAI ERROR:", e)
        response.headers["X-Cache"] = "BYPASS"
        return {"explanation": "Failed to generate explanation.", "cached": False}

@app.post("/explain-stream")
async def explain_ayah_stream(req: ExplainRequest, request: Request):
    key = make_cache_key(req)
    headers = {"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}

    bypass = bool(req.regenerate) \
        or request.headers.get("x-bypass-cache", "").lower() in {"1", "true", "yes"} \
        or request.query_params.get("bypass", "").lower() in {"1", "true", "yes"}

    headers["X-Bypass"] = "1" if bypass else "0"
    headers["X-Cache-Key"] = key

    if not bypass:
        entry = get_cached_entry(key)
        if entry and "chunks" in entry and "delays" in entry:
            headers["X-Cache"] = "HIT"
            text = entry["text"]
            chunks = entry["chunks"] or []
            delays = entry["delays"] or []

            async def cached_gen():
                yield "\u200b"
                await asyncio.sleep(0)

                pos = 0
                for i, size in enumerate(chunks):
                    end = pos + size
                    yield text[pos:end]
                    pos = end
                    if i < len(delays) and delays[i] > 0:
                        await asyncio.sleep(delays[i])
                if pos < len(text):
                    yield text[pos:]

            return StreamingResponse(cached_gen(), media_type="text/plain; charset=utf-8", headers=headers)
        elif entry:
            headers["X-Cache"] = "HIT"
            text = entry["text"]

            async def fallback_gen():
                yield "\u200b"
                await asyncio.sleep(0)

                chunk_size = 48
                for i in range(0, len(text), chunk_size):
                    yield text[i:i+chunk_size]
                    await asyncio.sleep(0.015)

            return StreamingResponse(fallback_gen(), media_type="text/plain; charset=utf-8", headers=headers)

    # MISS or BYPASS
    system_guidelines, prompt = build_prompt(req)

    async def live_gen():
        yield "\u200b"
        await asyncio.sleep(0)

        loop = asyncio.get_event_loop()
        q: asyncio.Queue[Optional[str]] = asyncio.Queue()

        buffer_parts: List[str] = []
        chunk_sizes: List[int] = []
        delays: List[float] = []

        def producer():
            import time as _t
            last = _t.perf_counter()
            try:
                stream = client.chat.completions.create(
                    model="gpt-4o",
                    messages=[
                        {"role": "system", "content": system_guidelines},
                        {"role": "user", "content": prompt},
                    ],
                    max_tokens=400,
                    temperature=0.4,
                    stream=True,
                )
                for chunk in stream:
                    now = _t.perf_counter()
                    delays.append(max(0.0, now - last))
                    last = now

                    delta = chunk.choices[0].delta
                    piece = getattr(delta, "content", None)
                    if piece:
                        buffer_parts.append(piece)
                        chunk_sizes.append(len(piece))
                        asyncio.run_coroutine_threadsafe(q.put(piece), loop)
            except Exception as e:
                print("OpenAI STREAM ERROR:", e)
                asyncio.run_coroutine_threadsafe(q.put("\n\n[stream-error]"), loop)
            finally:
                text = "".join(buffer_parts).strip()
                if text:
                    set_cached_entry(key, text, chunk_sizes, delays)
                asyncio.run_coroutine_threadsafe(q.put(None), loop)

        threading.Thread(target=producer, daemon=True).start()

        while True:
            piece = await q.get()
            if piece is None:
                break
            yield piece
            await asyncio.sleep(0)

    headers["X-Cache"] = "MISS" if not bypass else "BYPASS-NEW"
    return StreamingResponse(live_gen(), media_type="text/plain; charset=utf-8", headers=headers)
