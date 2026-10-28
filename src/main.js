import {
  MAX_GUESSES, SITE_URL, localDateString, dayNumber, pickDaily, pickPractice, buildSearchIndex,
  searchSports, exactMatches, judgeGuess, shareText, updateStats, emptyStats, maskRef, feedbackUrl,
} from "./logic.js";
import { REPO_URL, GOATCOUNTER_CODE } from "./config.js";

const $ = (id) => document.getElementById(id);
const els = {
  label: $("puzzle-label"), pips: $("pips"), loading: $("loading"), clues: $("clues"),
  guesses: $("guesses"), form: $("guess-form"), input: $("guess-input"),
  suggestions: $("suggestions"), message: $("form-message"), result: $("result"),
  help: $("help-dialog"), stats: $("stats-dialog"), statGrid: $("stat-grid"), dist: $("dist"),
  modeDaily: $("mode-daily"), modePractice: $("mode-practice"), practiceBar: $("practice-bar"),
  deepCuts: $("deep-cuts"), skip: $("skip-btn"),
};

// ?date=YYYY-MM-DD plays another day's puzzle without touching your real stats.
const dateOverride = new URLSearchParams(location.search).get("date");
const today = /^\d{4}-\d{2}-\d{2}$/.test(dateOverride ?? "") ? dateOverride : localDateString();
const day = dayNumber(today);
const puzzleNumber = day + 1;
const storageScope = dateOverride ? "rulebook:test" : "rulebook";
const RECENT_PRACTICE = 20;

const storage = {
  get(key, fallback) {
    try { return JSON.parse(localStorage.getItem(`${storageScope}:${key}`)) ?? fallback; }
    catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(`${storageScope}:${key}`, JSON.stringify(value)); } catch { /* private mode */ }
  },
};

let sports, sportsById, families, index, allClues, cluesById;
let dailyPuzzle;
let mode = "daily";
// The puzzle being played right now (daily or practice) and its progress.
let puzzle, answer;
let game = { guesses: [], status: "playing" };
let suggestionList = [];
let activeSuggestion = -1;

const isDaily = () => mode === "daily";
const results = () => game.guesses.map((id) => judgeGuess(sportsById.get(id), answer));
const revealedCount = () => Math.min(game.status === "playing" ? game.guesses.length + 1 : game.guesses.length, MAX_GUESSES);

function escapeHtml(text) {
  return text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function clueHtml(text) {
  return escapeHtml(text).replace(/\[([^\]]+)\]/g, '<span class="redact">$1</span>');
}

// During play the reference is shown with any word that would name the sport masked out.
function playRef(clue) {
  return clue.sourceNote ? "" : maskRef(clue.ref, answer, clue.level);
}

function refText(clue) {
  return clue.sourceNote ?? `${clue.ref} · ${clue.source}`;
}

// Optional GoatCounter events, used to see which clues players solve on. No-op unless configured.
function track(path, title) {
  window.goatcounter?.count?.({ path, title: title ?? path, event: true });
}

function trackFinish() {
  const won = game.status === "won";
  const shown = puzzle.clues.slice(0, game.guesses.length);
  shown.forEach((clue) => track(`clue/${clue.id}/seen`));
  if (won) track(`clue/${shown.at(-1).id}/solved`);
  track(isDaily() ? `daily/${puzzleNumber}/${won ? game.guesses.length : "X"}` : `practice/${answer.id}/${won ? game.guesses.length : "X"}`);
}

function loadAnalytics() {
  if (!GOATCOUNTER_CODE || ["localhost", "127.0.0.1"].includes(location.hostname)) return;
  const s = document.createElement("script");
  s.async = true;
  s.src = "https://gc.zgo.at/count.js";
  s.dataset.goatcounter = `https://${GOATCOUNTER_CODE}.goatcounter.com/count`;
  document.head.append(s);
}

function renderPips() {
  const res = results();
  els.pips.innerHTML = Array.from({ length: MAX_GUESSES }, (_, i) => {
    const cls = res[i] ?? (i === res.length && game.status === "playing" ? "current" : "");
    return `<span class="pip ${cls}"></span>`;
  }).join("");
}

// Once the game is over the result card lists every rule, so the clue stack is cleared.
function renderClues(animateLatest = false) {
  const shown = game.status === "playing" ? revealedCount() : 0;
  const items = [];
  for (let i = shown - 1; i >= 0; i--) {
    const latest = i === shown - 1 && game.status === "playing";
    const cls = latest ? `latest${animateLatest ? " enter" : ""}` : "older";
    items.push(`<li class="clue ${cls}">
      <span class="clue-label">Rule ${i + 1} of ${MAX_GUESSES}</span>
      <p class="clue-text">${clueHtml(puzzle.clues[i].text)}</p>
      ${playRef(puzzle.clues[i]) ? `<span class="clue-ref">${clueHtml(playRef(puzzle.clues[i]))}</span>` : ""}</li>`);
  }
  els.clues.innerHTML = items.join("");
}

function renderGuesses() {
  const res = results();
  const label = { wrong: "✕", close: "close", correct: "✓" };
  els.guesses.innerHTML = game.guesses.map((id, i) =>
    `<li class="tag ${res[i]}"${res[i] === "close" ? ` title="Same family as the answer: ${escapeHtml(families[answer.family])}"` : ""}>${escapeHtml(sportsById.get(id).name)} <span aria-hidden="true">${label[res[i]]}</span>
     <span class="visually-hidden">(${res[i]})</span></li>`).join("");
}

function ruleItem(clue) {
  const context = isDaily() ? `Daily puzzle #${puzzleNumber}` : "Practice";
  return `<p>${clueHtml(clue.text)}</p>
    <div class="rule-meta"><span class="rule-ref">${escapeHtml(refText(clue))}</span>
    <a class="flag" href="${escapeHtml(feedbackUrl(REPO_URL, clue, answer.name, context))}" target="_blank" rel="noopener">Flag this rule</a></div>`;
}

function renderResult() {
  if (game.status === "playing") { els.result.hidden = true; return; }
  const won = game.status === "won";
  const seen = game.guesses.length;
  const rules = puzzle.clues.map((clue, i) => i < seen
    ? `<li>${ruleItem(clue)}</li>`
    : `<li><button class="reveal-btn" data-reveal="${i}">Show rule ${i + 1} (you didn't need it)</button></li>`).join("");
  const actions = isDaily()
    ? `<button class="primary" id="share-btn">Share result</button>
       <button class="secondary" id="result-stats-btn">Statistics</button>`
    : `<button class="primary" id="next-practice-btn">Next practice puzzle</button>
       <button class="secondary" id="back-daily-btn">Today's puzzle</button>`;

  els.result.innerHTML = `
    <div class="result-head">
      <p class="result-status ${won ? "won" : "lost"}">${won ? `Solved in ${seen} of ${MAX_GUESSES}` : "Out of guesses"}</p>
      <h2 class="result-sport">${escapeHtml(answer.name)}</h2>
      <p class="result-blurb">${escapeHtml(answer.blurb)}</p>
    </div>
    <h3>The rules</h3>
    <ol class="rule-list">${rules}</ol>
    <div class="result-actions">${actions}</div>
    <p class="next-up" id="next-up"></p>`;
  els.result.hidden = false;
  els.form.hidden = true;

  els.result.querySelectorAll("[data-reveal]").forEach((btn) => btn.addEventListener("click", () => {
    btn.parentElement.innerHTML = ruleItem(puzzle.clues[Number(btn.dataset.reveal)]);
  }));
  if (isDaily()) {
    $("share-btn").addEventListener("click", share);
    $("result-stats-btn").addEventListener("click", openStats);
    tickCountdown();
  } else {
    $("next-practice-btn").addEventListener("click", () => { newPracticePuzzle(); els.input.focus(); });
    $("back-daily-btn").addEventListener("click", () => setMode("daily"));
    const p = storage.get("practiceStats", { played: 0, won: 0 });
    $("next-up").textContent = `Practice: ${p.won} solved out of ${p.played} played. Practice doesn't count toward your daily stats.`;
  }
}

function renderHeader() {
  els.modeDaily.setAttribute("aria-pressed", String(isDaily()));
  els.modePractice.setAttribute("aria-pressed", String(!isDaily()));
  els.practiceBar.hidden = isDaily();
  els.label.textContent = isDaily()
    ? `Puzzle #${puzzleNumber} · ${new Date(`${today}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`
    : `Practice · ${els.deepCuts.checked ? "all 82 sports" : "52 everyday sports"}`;
}

function render(animate = false) {
  renderHeader();
  renderPips();
  renderClues(animate);
  renderGuesses();
  renderResult();
  els.form.hidden = game.status !== "playing";
}

function showMessage(text, tone = "error") {
  els.message.dataset.tone = tone;
  els.message.textContent = text;
}

function toast(text) {
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = text;
  document.body.append(el);
  setTimeout(() => el.remove(), 1800);
}

// Suggestions open upward when the input sits low on screen (above the on-screen keyboard),
// and downward when there's more room below.
function renderSuggestions() {
  const open = suggestionList.length > 0;
  els.suggestions.hidden = !open;
  if (open) {
    const rect = els.input.getBoundingClientRect();
    const below = innerHeight - rect.bottom;
    els.suggestions.classList.toggle("down", below >= 240 || below > rect.top);
  }
  els.input.setAttribute("aria-expanded", String(open));
  els.suggestions.innerHTML = suggestionList.map((s, i) => {
    const used = game.guesses.includes(s.id);
    return `<li role="option" id="opt-${s.id}" data-id="${s.id}" aria-selected="${i === activeSuggestion}"
      class="${used ? "used" : ""}">${escapeHtml(s.name)}${used ? '<span class="alias">already guessed</span>' : ""}</li>`;
  }).join("");
  els.input.setAttribute("aria-activedescendant", activeSuggestion >= 0 ? `opt-${suggestionList[activeSuggestion].id}` : "");
  els.suggestions.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
}

function closeSuggestions() {
  suggestionList = [];
  activeSuggestion = -1;
  renderSuggestions();
}

function saveGame() {
  if (isDaily()) storage.set(`game:${day}`, game);
  else storage.set("practice", { sportId: answer.id, clueIds: puzzle.clues.map((c) => c.id), ...game });
}

function submitGuess(sport) {
  if (game.status !== "playing") return;
  if (game.guesses.includes(sport.id)) {
    showMessage(`You've already guessed ${sport.name}.`);
    return;
  }
  game.guesses.push(sport.id);
  const verdict = judgeGuess(sport, answer);
  if (verdict === "correct") game.status = "won";
  else if (game.guesses.length >= MAX_GUESSES) game.status = "lost";
  else if (verdict === "close") showMessage(`Close! The answer is also one of the ${families[answer.family].toLowerCase()}.`, "close");
  else showMessage("");

  saveGame();
  els.input.value = "";
  closeSuggestions();

  if (game.status !== "playing") {
    showMessage("");
    const won = game.status === "won";
    if (isDaily()) {
      storage.set("stats", updateStats(storage.get("stats", emptyStats()), day, won, game.guesses.length));
    } else {
      const p = storage.get("practiceStats", { played: 0, won: 0 });
      storage.set("practiceStats", { played: p.played + 1, won: p.won + (won ? 1 : 0) });
    }
    trackFinish();
    render();
    els.result.scrollIntoView({ behavior: "smooth", block: "start" });
  } else {
    render(true);
    els.input.focus();
  }
}

function handleSubmit(event) {
  event.preventDefault();
  if (activeSuggestion >= 0) {
    submitGuess(suggestionList[activeSuggestion]);
    return;
  }
  const text = els.input.value;
  if (!text.trim()) { showMessage("Type a sport first."); return; }
  const matches = exactMatches(index, text);
  if (matches.length === 1) { submitGuess(matches[0]); return; }
  if (matches.length > 1) {
    suggestionList = matches;
    activeSuggestion = -1;
    renderSuggestions();
    showMessage(`"${text.trim()}" could mean several sports. Pick one.`);
    return;
  }
  suggestionList = searchSports(index, text);
  activeSuggestion = suggestionList.length ? 0 : -1;
  renderSuggestions();
  showMessage(suggestionList.length ? "Pick a sport from the list." : "That's not a sport we know. Try another name.");
}

function handleKeydown(event) {
  if (els.suggestions.hidden) return;
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    const step = event.key === "ArrowDown" ? 1 : -1;
    activeSuggestion = (activeSuggestion + step + suggestionList.length) % suggestionList.length;
    renderSuggestions();
  } else if (event.key === "Escape") {
    closeSuggestions();
  }
}

function openStats() {
  const stats = storage.get("stats", emptyStats());
  const winPct = stats.played ? Math.round((stats.won / stats.played) * 100) : 0;
  els.statGrid.innerHTML = [["Played", stats.played], ["Win %", winPct], ["Streak", stats.streak], ["Best", stats.maxStreak]]
    .map(([label, value]) => `<div><strong>${value}</strong><span>${label}</span></div>`).join("");
  const max = Math.max(1, ...stats.distribution);
  const daily = storage.get(`game:${day}`, null);
  const todayRow = daily?.status === "won" ? daily.guesses.length - 1 : -1;
  els.dist.innerHTML = stats.distribution.map((count, i) => `<div class="dist-row"><span>${i + 1}</span>
    <span class="dist-bar ${i === todayRow ? "today" : ""}" style="width:${Math.max(8, (count / max) * 100)}%">${count}</span></div>`).join("");
  els.stats.showModal();
}

// Some hosts (e.g. embedded viewers) refuse clipboard writes, so fall back to a selected text box.
async function share() {
  const text = shareText(puzzleNumber, results(), game.status === "won", SITE_URL);
  try {
    await navigator.clipboard.writeText(text);
    toast("Copied to clipboard");
  } catch {
    let box = els.result.querySelector(".share-fallback");
    if (!box) {
      box = document.createElement("textarea");
      box.className = "share-fallback";
      box.id = "share-fallback";
      box.readOnly = true;
      box.rows = 3;
      box.setAttribute("aria-label", "Your result, ready to copy");
      $("share-btn").parentElement.after(box);
    }
    box.value = text;
    box.select();
    toast("Copy the selected text to share");
  }
}

function tickCountdown() {
  const el = $("next-up");
  if (!el || !isDaily()) return;
  if (dateOverride) { el.textContent = `Test mode: puzzle for ${today}`; return; }
  const now = new Date();
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const secs = Math.max(0, Math.floor((midnight - now) / 1000));
  const pad = (n) => String(n).padStart(2, "0");
  el.textContent = secs === 0
    ? "A new puzzle is ready. Refresh to play."
    : `Next puzzle in ${pad(Math.floor(secs / 3600))}:${pad(Math.floor((secs % 3600) / 60))}:${pad(secs % 60)}`;
}

function loadDaily() {
  puzzle = dailyPuzzle;
  answer = sportsById.get(puzzle.sportId);
  const saved = storage.get(`game:${day}`, null);
  game = saved?.guesses?.every((id) => sportsById.has(id)) ? saved : { guesses: [], status: "playing" };
}

function newPracticePuzzle() {
  const recent = storage.get("practiceRecent", []);
  const avoid = [...recent, dailyPuzzle.sportId];
  puzzle = pickPractice(sports, allClues, { includeDeep: els.deepCuts.checked, avoid });
  answer = sportsById.get(puzzle.sportId);
  game = { guesses: [], status: "playing" };
  storage.set("practiceRecent", [puzzle.sportId, ...recent].slice(0, RECENT_PRACTICE));
  saveGame();
  showMessage("");
  render(true);
}

// Resume an unfinished practice puzzle if there is one, otherwise deal a new one.
function loadPractice() {
  const saved = storage.get("practice", null);
  const clues = saved?.clueIds?.map((id) => cluesById.get(id));
  if (saved && saved.status === "playing" && clues?.every(Boolean) && sportsById.has(saved.sportId)) {
    puzzle = { sportId: saved.sportId, clues };
    answer = sportsById.get(saved.sportId);
    game = { guesses: saved.guesses, status: saved.status };
    render();
  } else {
    newPracticePuzzle();
  }
}

function setMode(next) {
  mode = next;
  history.replaceState(null, "", next === "practice" ? "#practice" : location.pathname + location.search);
  closeSuggestions();
  showMessage("");
  if (isDaily()) { loadDaily(); render(); } else loadPractice();
  window.scrollTo({ top: 0 });
}

async function init() {
  const [sportsData, clueData] = await Promise.all([
    fetch("data/sports.json").then((r) => r.json()),
    fetch("data/clues.json").then((r) => r.json()),
  ]);
  sports = sportsData.sports;
  families = sportsData.families;
  sportsById = new Map(sports.map((s) => [s.id, s]));
  allClues = clueData.clues;
  cluesById = new Map(allClues.map((c) => [c.id, c]));
  index = buildSearchIndex(sports);
  dailyPuzzle = pickDaily(sports, allClues, day);
  els.deepCuts.checked = storage.get("practiceDeep", false);

  els.loading.remove();
  setMode(location.hash === "#practice" ? "practice" : "daily");
  loadAnalytics();

  if (!storage.get("seenHelp", false)) {
    storage.set("seenHelp", true);
    els.help.showModal();
  }
}

els.form.addEventListener("submit", handleSubmit);
els.input.addEventListener("input", () => {
  showMessage("");
  suggestionList = searchSports(index, els.input.value);
  activeSuggestion = -1;
  renderSuggestions();
});
els.input.addEventListener("keydown", handleKeydown);
els.input.addEventListener("blur", () => setTimeout(closeSuggestions, 150));
els.suggestions.addEventListener("mousedown", (e) => {
  const li = e.target.closest("li[data-id]");
  if (!li) return;
  e.preventDefault();
  submitGuess(sportsById.get(li.dataset.id));
});
els.modeDaily.addEventListener("click", () => setMode("daily"));
els.modePractice.addEventListener("click", () => setMode("practice"));
els.deepCuts.addEventListener("change", () => {
  storage.set("practiceDeep", els.deepCuts.checked);
  newPracticePuzzle();
});
els.skip.addEventListener("click", () => {
  if (game.status === "playing" && game.guesses.length) {
    const p = storage.get("practiceStats", { played: 0, won: 0 });
    storage.set("practiceStats", { played: p.played + 1, won: p.won });
  }
  newPracticePuzzle();
});
$("help-btn").addEventListener("click", () => els.help.showModal());
$("stats-btn").addEventListener("click", openStats);
document.querySelectorAll("dialog").forEach((d) => {
  d.querySelector("[data-close]").addEventListener("click", () => d.close());
  d.addEventListener("click", (e) => { if (e.target === d) d.close(); });
});
setInterval(tickCountdown, 1000);

init().catch((err) => {
  els.loading.textContent = "Couldn't load the rulebook. Serve this folder over HTTP (node scripts/serve.mjs) and reload.";
  console.error(err);
});
