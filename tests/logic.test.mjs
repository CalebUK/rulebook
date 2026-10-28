import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  normalize, dayNumber, pickDaily, buildSearchIndex, searchSports, exactMatches,
  judgeGuess, shareText, updateStats, emptyStats, maskRef,
} from "../src/logic.js";

const load = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), "utf8"));
const { sports } = load("../data/sports.json");
const { clues } = load("../data/clues.json");
const index = buildSearchIndex(sports);
const byId = new Map(sports.map((s) => [s.id, s]));
const dailyPool = sports.filter((s) => s.pool === "daily");

test("normalize strips accents and punctuation", () => {
  assert.equal(normalize("  Pétanque! "), "petanque");
  assert.equal(normalize("Ping-Pong"), "ping pong");
});

test("day numbers count from launch", () => {
  assert.equal(dayNumber("2026-10-28"), 0);
  assert.equal(dayNumber("2026-11-01"), 4);
  assert.equal(dayNumber("2027-03-30"), 153); // spans a DST change
});

test("daily puzzle is deterministic and uses one clue per level", () => {
  const a = pickDaily(sports, clues, 10);
  const b = pickDaily(sports, clues, 10);
  assert.deepEqual(a, b);
  assert.deepEqual(a.clues.map((c) => c.level), [1, 2, 3, 4, 5]);
  assert.ok(a.clues.every((c) => c.sport === a.sportId));
});

test("every daily sport appears exactly once per cycle", () => {
  const n = dailyPool.length;
  for (const cycle of [0, 1, 7]) {
    const ids = Array.from({ length: n }, (_, i) => pickDaily(sports, clues, cycle * n + i).sportId);
    assert.equal(new Set(ids).size, n);
    assert.ok(ids.every((id) => byId.get(id).pool === "daily"));
  }
});

test("ambiguous words match several sports", () => {
  const football = exactMatches(index, "football").map((s) => s.id);
  assert.ok(football.includes("soccer") && football.includes("american_football"));
  assert.deepEqual(exactMatches(index, "ping pong").map((s) => s.id), ["table_tennis"]);
});

test("search ranks prefixes first and tolerates typos", () => {
  assert.equal(searchSports(index, "curl")[0].id, "curling");
  assert.equal(searchSports(index, "badmitton")[0].id, "badminton");
  assert.ok(searchSports(index, "hockey").length >= 4);
  assert.deepEqual(searchSports(index, "zzzz"), []);
});

test("rule references hide words that name the sport", () => {
  assert.equal(maskRef("FIBA Art. 24", byId.get("basketball"), 1), "[—] Art. 24");
  assert.equal(maskRef("Playing Rules of Hurling 1.5", byId.get("hurling"), 2), "Playing Rules of [—] 1.5");
  assert.equal(maskRef("Rule R1 (hog line)", byId.get("curling"), 3), "Rule R1 ([—])");
  assert.equal(maskRef("Rule R1 (hog line)", byId.get("curling"), 4), "Rule R1 (hog line)");
  assert.equal(maskRef("Law 2.1", byId.get("soccer"), 1), "Law 2.1");
  for (const c of clues) {
    const masked = maskRef(c.ref, byId.get(c.sport), c.level).toLowerCase();
    const words = masked.split(/[^\p{L}]+/u);
    for (const w of byId.get(c.sport).tellWords.never) {
      const parts = w.toLowerCase().split(/[^\p{L}]+/u);
      const leaked = words.some((_, i) => parts.every((p, j) => words[i + j] === p));
      assert.ok(!leaked, `${c.sport}: ${masked}`);
    }
  }
});

test("close means same family", () => {
  assert.equal(judgeGuess(byId.get("field_hockey"), byId.get("ice_hockey")), "close");
  assert.equal(judgeGuess(byId.get("chess"), byId.get("ice_hockey")), "wrong");
  assert.equal(judgeGuess(byId.get("ice_hockey"), byId.get("ice_hockey")), "correct");
});

test("share text shows squares and score", () => {
  assert.equal(shareText(3, ["wrong", "close", "correct"], true), "Rulebook #3 3/5\n🟥🟨🟩⬜⬜");
  assert.equal(shareText(3, ["wrong", "wrong", "wrong", "wrong", "wrong"], false), "Rulebook #3 X/5\n🟥🟥🟥🟥🟥");
  assert.equal(shareText(1, ["correct"], true, "https://x.test/"), "Rulebook #1 1/5\n🟩⬜⬜⬜⬜\nhttps://x.test/");
});

test("streaks continue only on consecutive wins", () => {
  let s = updateStats(emptyStats(), 5, true, 2);
  s = updateStats(s, 6, true, 4);
  assert.equal(s.streak, 2);
  s = updateStats(s, 8, true, 1);
  assert.equal(s.streak, 1);
  s = updateStats(s, 9, false, 5);
  assert.deepEqual([s.played, s.won, s.streak, s.maxStreak], [4, 3, 0, 2]);
  assert.deepEqual(s.distribution, [1, 1, 0, 1, 0]);
});
