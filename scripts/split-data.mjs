import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = path.resolve(process.cwd());
const RAW_DIR = path.join(ROOT, "data", "raw");
const APP_PUBLIC_DIR = path.join(ROOT, "quran-app", "public");
const OUT_BASE = path.join(APP_PUBLIC_DIR, "data", "v1");
const OUT_SURAHS = path.join(OUT_BASE, "surahs");
const OUT_THEMES = path.join(OUT_BASE, "themes");
const OUT_META = path.join(OUT_BASE, "meta");

const CANDIDATE_QURAN_FILES = [
  "quran_en_ar.json",
  "quran_en.json",
  "quran.json",
  "quran_ar.json",
];

const CANDIDATE_THEMES_FILES = ["themes.json", "inverse_themes.json"];

function ensureDir(p) { fs.mkdirSync(p, { recursive: true }); }
function pad3(n) { return String(n).padStart(3, "0"); }
function sha256(s) { return crypto.createHash("sha256").update(s).digest("hex"); }

function tryLoadJson(file) {
  const p = path.join(RAW_DIR, file);
  if (!fs.existsSync(p)) return null;
  const raw = fs.readFileSync(p, "utf8");
  return JSON.parse(raw);
}

function loadQuranSource() {
  for (const f of CANDIDATE_QURAN_FILES) {
    const data = tryLoadJson(f);
    if (data) return { filename: f, data };
  }
  throw new Error(
    `No Quran JSON found in ${RAW_DIR}. Expected one of: ${CANDIDATE_QURAN_FILES.join(", ")}`
  );
}

/*
  normalize supported shapes into:
  [{ ref:"S:A", surah:S, ayah:A, arabic:"...", english:"..." }, ...]
 */
function normalizeQuran({ filename, data }) {
  const items = [];
  const metaBySurah = new Map();

  const upsert = (ref, surah, ayah, fields = {}) => {
    let row = items.find((it) => it.ref === ref);
    if (!row) {
      row = { ref, surah, ayah, arabic: null, english: null };
      items.push(row);
    }
    Object.assign(row, fields);
  };

  // a) top-level array of surahs
  if (Array.isArray(data) && data.every((s) => s && Array.isArray(s.verses))) {
    for (const s of data) {
      const S = Number(s.id);
      if (!S) continue;
      metaBySurah.set(S, {
        name: s.name ?? null,
        transliteration: s.transliteration ?? null,
        translation: s.translation ?? null,
        type: s.type ?? null,
        total_verses: s.total_verses ?? (s.verses?.length ?? null),
      });
      for (const v of s.verses) {
        const A = Number(v.id);
        if (!A) continue;
        const ref = `${S}:${A}`;
        upsert(ref, S, A, {
          arabic: v.text ?? null,
          english: v.translation ?? null,
        });
      }
    }
    return { items: items.sort((a, b) => a.surah - b.surah || a.ayah - b.ayah), metaBySurah };
  }

  // b) object keyed by "S:A"
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const keys = Object.keys(data);
    const looksRefMap = keys.every((k) => /^\d{1,3}:\d{1,3}$/.test(k));
    if (looksRefMap) {
      for (const ref of keys) {
        const [S, A] = ref.split(":").map((n) => Number(n));
        const row = data[ref];
        if (row && typeof row === "object") {
          upsert(ref, S, A, {
            arabic: row.arabic ?? row.text ?? null,
            english: row.english ?? row.translation ?? null,
          });
        } else if (typeof row === "string") {
          upsert(ref, S, A, { arabic: row });
        }
      }
      return { items: items.sort((a, b) => a.surah - b.surah || a.ayah - b.ayah), metaBySurah };
    }

    // c) object keyed by surah - array of ayahs
    const looksSurahMap =
      keys.every((k) => /^\d{1,3}$/.test(k)) && Object.values(data).every(Array.isArray);
    if (looksSurahMap) {
      for (const sKey of keys) {
        const S = Number(sKey);
        const arr = data[sKey];
        for (let i = 0; i < arr.length; i++) {
          const row = arr[i];
          const A = row?.ayah ?? row?.verse ?? row?.id ?? i + 1;
          const ref = `${S}:${A}`;
          if (typeof row === "string") {
            upsert(ref, S, A, { arabic: row });
          } else {
            upsert(ref, S, A, {
              arabic: row?.arabic ?? row?.text ?? null,
              english: row?.english ?? row?.translation ?? null,
            });
          }
        }
      }
      return { items: items.sort((a, b) => a.surah - b.surah || a.ayah - b.ayah), metaBySurah };
    }
  }

  // d) flat array
  if (Array.isArray(data)) {
    for (const row of data) {
      if (!row) continue;
      let ref = row.ref || row.reference || null;
      let S = row.surah ?? row.sura ?? null;
      let A = row.ayah ?? row.verse ?? null;
      if (ref && (S == null || A == null)) {
        const [s, a] = String(ref).split(":").map((n) => Number(n));
        S = s; A = a;
      }
      if (!ref && S != null && A != null) ref = `${S}:${A}`;
      if (!ref) continue;
      upsert(ref, Number(S), Number(A), {
        arabic: row.arabic ?? row.text ?? null,
        english: row.english ?? row.translation ?? null,
      });
    }
    return { items: items.sort((a, b) => a.surah - b.surah || a.ayah - b.ayah), metaBySurah };
  }

  throw new Error(`Unrecognized Quran JSON shape in ${filename}.`);
}

// themes loader
function loadThemes() {
  const themes = tryLoadJson("themes.json");
  const inverse = tryLoadJson("inverse_themes.json");

  const byRef = new Map();
  const distinct = new Set();

  if (themes && typeof themes === "object" && !Array.isArray(themes)) {
    for (const ref of Object.keys(themes)) {
      const arr = Array.isArray(themes[ref]) ? themes[ref] : [];
      byRef.set(ref, new Set(arr));
      for (const t of arr) distinct.add(t);
    }
  }

  if (inverse && typeof inverse === "object" && !Array.isArray(inverse)) {
    for (const t of Object.keys(inverse)) {
      const refs = Array.isArray(inverse[t]) ? inverse[t] : [];
      for (const ref of refs) {
        if (!byRef.has(ref)) byRef.set(ref, new Set());
        byRef.get(ref).add(t);
        distinct.add(t);
      }
    }
  }
  return { byRef, distinct };
}

function writeJson(filePath, obj) {
  const s = JSON.stringify(obj, null, 2);
  fs.writeFileSync(filePath, s, "utf8");
  return sha256(s);
}

function main() {
  console.log("split-data: start");
  [OUT_SURAHS, OUT_THEMES, OUT_META].forEach(ensureDir);

  const qsrc = loadQuranSource();
  const { items, metaBySurah } = normalizeQuran(qsrc);
  console.log(`Loaded ${items.length} ayahs from ${qsrc.filename}`);

  const { byRef: themesByRef } = loadThemes();

  const bySurah = new Map();
  for (const row of items) {
    if (!bySurah.has(row.surah)) bySurah.set(row.surah, []);
    bySurah.get(row.surah).push({
      ref: row.ref,
      surah: row.surah,
      ayah: row.ayah,
      arabic: row.arabic ?? null,
      english: row.english ?? null,
    });
  }

  const checksums = { surahs: {}, themes: {}, meta: {} };

  for (const [S, arr] of bySurah.entries()) {
    arr.sort((a, b) => a.ayah - b.ayah);
    const file = path.join(OUT_SURAHS, `${pad3(S)}.json`);
    const hash = writeJson(file, arr);
    checksums.surahs[`${pad3(S)}.json`] = hash;
  }
  console.log(`Wrote ${bySurah.size} surah files -> ${OUT_SURAHS}`);

  const themesBySurah = new Map();
  for (const [ref, set] of themesByRef.entries()) {
    const [sStr] = ref.split(":");
    const S = Number(sStr);
    if (!themesBySurah.has(S)) themesBySurah.set(S, []);
    themesBySurah.get(S).push({ ref, themes: Array.from(set).sort() });
  }

  for (const [S, arr] of themesBySurah.entries()) {
    arr.sort(
      (x, y) => Number(x.ref.split(":")[1]) - Number(y.ref.split(":")[1])
    );
    const file = path.join(OUT_THEMES, `${pad3(S)}.json`);
    const hash = writeJson(file, arr);
    checksums.themes[`${pad3(S)}.json`] = hash;
  }
  console.log(`Wrote ${themesBySurah.size} themes files -> ${OUT_THEMES}`);

  const index = [...bySurah.keys()]
    .sort((a, b) => a - b)
    .map((S) => {
      const m = metaBySurah.get(S) || {};
      return {
        id: S,
        name: m.name ?? null,
        transliteration: m.transliteration ?? null,
        translation: m.translation ?? null,
        type: m.type ?? null,
        ayahCount: bySurah.get(S).length,
      };
    });
  const indexHash = writeJson(path.join(OUT_META, "surah-index.json"), index);
  checksums.meta["surah-index.json"] = indexHash;

  writeJson(path.join(OUT_META, "checksums.json"), checksums);

  console.log("split-data: done");
  console.log(`Output base: ${OUT_BASE}`);
}

try {
  main();
} catch (e) {
  console.error("ERROR:", e?.message || e);
  process.exit(1);
}
