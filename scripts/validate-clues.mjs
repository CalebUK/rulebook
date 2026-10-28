// Checks data/clues.json against data/sports.json: tell-word leaks, level coverage, length, sources.
import { readFileSync, existsSync } from "node:fs";

const root = new URL("..", import.meta.url);
const { sports } = JSON.parse(readFileSync(new URL("data/sports.json", root), "utf8"));
const { clues } = JSON.parse(readFileSync(new URL("data/clues.json", root), "utf8"));
const byId = new Map(sports.map((s) => [s.id, s]));

const MAX_WORDS = 35;
const problems = [];
const warn = (c, msg) => problems.push(`${c.sport} L${c.level}: ${msg}\n    "${c.text}"`);

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const has = (text, word) => new RegExp(`(^|[^\\p{L}])${escape(word)}([^\\p{L}]|$)`, "iu").test(text);

for (const c of clues) {
  const sport = byId.get(c.sport);
  if (!sport) { warn(c, "unknown sport id"); continue; }
  if (!(c.level >= 1 && c.level <= 5)) warn(c, "level must be 1-5");
  if (!c.ref) warn(c, "missing rule reference");
  if (!existsSync(new URL(`rulebooks/${c.source}`, root))) warn(c, `source not found: ${c.source}`);

  const words = c.text.trim().split(/\s+/).length;
  if (words > MAX_WORDS) warn(c, `${words} words (max ${MAX_WORDS})`);

  for (const w of sport.tellWords.never) if (has(c.text, w)) warn(c, `uses forbidden word "${w}"`);
  if (c.level < 4) for (const w of sport.tellWords.level4) if (has(c.text, w)) warn(c, `uses "${w}" before level 4`);
}

for (const id of new Set(clues.map((c) => c.sport))) {
  const levels = new Set(clues.filter((c) => c.sport === id).map((c) => c.level));
  const missing = [1, 2, 3, 4, 5].filter((l) => !levels.has(l));
  if (missing.length) problems.push(`${id}: no clue at level ${missing.join(", ")}`);
}

const covered = new Set(clues.map((c) => c.sport)).size;
console.log(`${clues.length} clues across ${covered} of ${sports.length} sports`);
if (problems.length) {
  console.log(`\n${problems.length} problem(s):\n` + problems.map((p) => "- " + p).join("\n"));
  process.exit(1);
}
console.log("All checks passed");
