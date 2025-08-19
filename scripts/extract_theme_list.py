import json
import os

# Input path (adjust if needed)
input_path = "inverse_themes.json"
output_path = "themesList.json"

# Load inverse themes
with open(input_path, "r", encoding="utf-8") as f:
    inverse_themes = json.load(f)

# Extract and sort all theme names
theme_list = sorted(inverse_themes.keys())

# Save to themesList.json
with open(output_path, "w", encoding="utf-8") as f:
    json.dump(theme_list, f, ensure_ascii=False, indent=2)

print(f"Saved {len(theme_list)} themes to {output_path}")
