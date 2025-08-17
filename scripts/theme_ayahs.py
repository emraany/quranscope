import json
from pathlib import Path

THEMES_FILE = Path("quran-app/src/data/themes.json")
OUTPUT_FILE = Path("quran-app/src/data/themes_by_topic.json")

with open(THEMES_FILE, "r", encoding="utf-8") as f:
    themes_dict = json.load(f)

inverse_dict = {}
for ayah_key, themes in themes_dict.items():
    for theme in themes:
        inverse_dict.setdefault(theme, []).append(ayah_key)

with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
    json.dump(inverse_dict, f, ensure_ascii=False, indent=2)

print(f"Created inverse file with {len(inverse_dict)} themes -> {OUTPUT_FILE}")
