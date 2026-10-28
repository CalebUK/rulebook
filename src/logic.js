// Pure game logic: daily puzzle selection, guess matching and scoring. No DOM access here.

export const LAUNCH_DATE = "2026-10-28";
export const MAX_GUESSES = 5;
export const SITE_URL = "https://calebuk.github.io/rulebook/";

export function normalize(text) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Local calendar date as YYYY-MM-DD, so the puzzle changes at the player's midnight.
export function localDateString(date = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function dayNumber(dateString) {
  const toUtc = (s) => {
    const [y, m, d] = s.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((toUtc(dateString) - toUtc(LAUNCH_DATE)) / 86_400_000);
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(text) {
  let h = 2166136261;
  for (const ch of text) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

function shuffled(items, rand) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Every daily-pool sport appears once per cycle, in an order that's fixed for that cycle,
// and the clue for each level is picked deterministically from that level's options.
export function pickDaily(sports, clues, day) {
  const pool = sports.filter((s) => s.pool === "daily").map((s) => s.id).sort();
  const cycle = Math.floor(day / pool.length);
  const index = ((day % pool.length) + pool.length) % pool.length;
  const sportId = shuffled(pool, mulberry32(0x5eed + cycle * 7919))[index];

  const rand = mulberry32(hashString(sportId) ^ (day * 2654435761));
  const picked = [];
  for (let level = 1; level <= MAX_GUESSES; level++) {
    const options = clues.filter((c) => c.sport === sportId && c.level === level);
    picked.push(options[Math.floor(rand() * options.length)]);
  }
  return { sportId, clues: picked };
}

// A random practice puzzle. Sports in `avoid` (recent answers, today's daily) are skipped while
// any others remain, so practice doesn't repeat itself or spoil the daily puzzle.
export function pickPractice(sports, clues, { includeDeep = false, avoid = [], rand = Math.random } = {}) {
  const pool = sports.filter((s) => includeDeep || s.pool === "daily").map((s) => s.id);
  const fresh = pool.filter((id) => !avoid.includes(id));
  const choices = fresh.length ? fresh : pool;
  const sportId = choices[Math.floor(rand() * choices.length)];
  const picked = [];
  for (let level = 1; level <= MAX_GUESSES; level++) {
    const options = clues.filter((c) => c.sport === sportId && c.level === level);
    picked.push(options[Math.floor(rand() * options.length)]);
  }
  return { sportId, clues: picked };
}

// Prefilled "new issue" link so players can report a clue that's too easy, too hard or wrong.
export function feedbackUrl(repoUrl, clue, sportName, context) {
  const title = `Clue feedback: ${clue.id}`;
  const body = [
    `**Clue:** ${clue.id} (${sportName}, level ${clue.level})`,
    `> ${clue.text}`,
    `**Rule:** ${clue.ref} · ${clue.source}`,
    `**Context:** ${context}`,
    "",
    "**What's wrong?** (too easy / too hard / gives the sport away / inaccurate / confusing)",
    "",
  ].join("\n");
  return `${repoUrl}/issues/new?${new URLSearchParams({ title, body, labels: "clue-feedback" })}`;
}

export function buildSearchIndex(sports) {
  return sports.map((s) => ({
    sport: s,
    terms: [s.name, ...s.aliases].map(normalize),
  }));
}

function editDistance(a, b) {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[b.length];
}

function matchScore(term, query) {
  if (term === query) return 0;
  if (term.startsWith(query)) return 1;
  if (term.split(" ").some((word) => word.startsWith(query))) return 2;
  if (term.includes(query)) return 3;
  if (query.length >= 4) {
    const head = term.slice(0, query.length);
    if (editDistance(head, query) <= (query.length >= 7 ? 2 : 1)) return 4;
  }
  return Infinity;
}

// Ranked suggestions: exact > prefix > word prefix > substring > typo-tolerant.
export function searchSports(index, query, limit = 8) {
  const q = normalize(query);
  if (!q) return [];
  return index
    .map(({ sport, terms }) => ({ sport, score: Math.min(...terms.map((t) => matchScore(t, q))) }))
    .filter((r) => r.score !== Infinity)
    .sort((a, b) => a.score - b.score || a.sport.name.localeCompare(b.sport.name))
    .slice(0, limit)
    .map((r) => r.sport);
}

// Sports whose name or alias matches the text exactly. More than one means the word is ambiguous.
export function exactMatches(index, text) {
  const q = normalize(text);
  return index.filter(({ terms }) => terms.includes(q)).map(({ sport }) => sport);
}

// Rule references like "FIBA Art. 24" or "Playing Rules of Hurling 1.5" can name the sport, so during play
// any giveaway word is swapped for a [—] placeholder (rendered as a redaction pill). Jargon that the clue
// itself may only use from level 4 is masked on earlier clues too.
export function maskRef(ref, sport, level) {
  const words = [...sport.tellWords.never, sport.name, ...sport.aliases, ...(level < 4 ? sport.tellWords.level4 : [])]
    .filter((w) => w.length > 2)
    .sort((a, b) => b.length - a.length);
  let out = ref;
  for (const word of words) {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    out = out.replace(new RegExp(`(^|[^\\p{L}])${escaped}(?=[^\\p{L}]|$)`, "giu"), "$1[—]");
  }
  return out;
}

export function judgeGuess(guess, answer) {
  if (guess.id === answer.id) return "correct";
  return guess.family === answer.family ? "close" : "wrong";
}

export function shareText(puzzleNumber, results, won, url = "") {
  const squares = { wrong: "🟥", close: "🟨", correct: "🟩" };
  const row = results.map((r) => squares[r]).join("") + "⬜".repeat(MAX_GUESSES - results.length);
  return `Rulebook #${puzzleNumber} ${won ? results.length : "X"}/${MAX_GUESSES}\n${row}${url ? `\n${url}` : ""}`;
}

// Streak continues only when yesterday's puzzle was also won.
export function updateStats(stats, day, won, guessCount) {
  const next = structuredClone(stats);
  next.played += 1;
  if (won) {
    next.won += 1;
    next.distribution[guessCount - 1] += 1;
    next.streak = next.lastWonDay === day - 1 ? next.streak + 1 : 1;
    next.maxStreak = Math.max(next.maxStreak, next.streak);
    next.lastWonDay = day;
  } else {
    next.streak = 0;
  }
  return next;
}

export function emptyStats() {
  return { played: 0, won: 0, streak: 0, maxStreak: 0, lastWonDay: null, distribution: [0, 0, 0, 0, 0] };
}
