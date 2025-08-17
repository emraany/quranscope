import os
import json
import time
from pathlib import Path
from dotenv import load_dotenv
from openai import OpenAI
from tqdm import tqdm

# Load API key from environment
load_dotenv()
API_KEY = os.getenv("OPENAI_API_KEY")
if not API_KEY:
    raise RuntimeError("Missing OPENAI_API_KEY in environment")
client = OpenAI(api_key=API_KEY)

# File paths
BASE = Path(__file__).parent / "quran-app" / "src" / "data"
QURAN_FILE = BASE / "quran_en.json"
THEMES_FILE = BASE / "themes.json"

# Load Quran data
with open(QURAN_FILE, "r", encoding="utf-8") as f:
    quran = json.load(f)

themes_dict = {}

# Extract themes using OpenAI
def extract_themes(surah_id: int, verse_id: int, translation: str) -> list[str]:
    system_msg = (
        "You are an Islamic studies assistant. Given an English translation of a Quran verse, "
        "return 2–4 high-level themes (e.g., Mercy, Justice, Prophethood) that capture its concepts. "
        "If the verse is too short or unclear, return an empty list. "
        "Output only a JSON array of strings (e.g., [\"Mercy\", \"Guidance\"])."
    )

    user_msg = f"Surah: {surah_id}, Ayah: {verse_id}\nEnglish: {translation}"

    resp = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": system_msg},
            {"role": "user", "content": user_msg},
        ],
        max_tokens=60,
        temperature=0.3,
    )

    content = resp.choices[0].message.content.strip()

    try:
        themes = json.loads(content)
        if isinstance(themes, list) and all(isinstance(t, str) for t in themes):
            return themes
    except json.JSONDecodeError:
        pass

    # Fallback: parse simple comma-separated list
    return [t.strip() for t in content.strip("[] ").split(",") if t.strip()]

# Process Surahs and save progress
for surah in tqdm(quran, desc="Processing Surahs"):
    sid = surah["id"]
    updated = False

    for verse in tqdm(surah["verses"], desc=f"Surah {sid}", leave=False):
        vid = verse["id"]
        key = f"{sid}:{vid}"
        translation = verse["translation"]

        try:
            themes = extract_themes(sid, vid, translation)
        except Exception as e:
            print(f"Error extracting themes for {key}: {e}")
            themes = []

        themes_dict[key] = themes
        updated = True
        time.sleep(0.2)  # simple rate limit

    if updated:
        with open(THEMES_FILE, "w", encoding="utf-8") as f:
            json.dump(themes_dict, f, ensure_ascii=False, indent=2)
        print(f"Saved progress after Surah {sid} — total ayahs: {len(themes_dict)}")

print("Done. Total themes extracted:", len(themes_dict))
