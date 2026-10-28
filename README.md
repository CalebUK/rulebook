# Rulebook

Guess the sport from its most obscure rules. You get five guesses, and every miss reveals an easier rule.

**Play it:** https://calebuk.github.io/rulebook/ (GitHub Pages serves the `main` branch, and every push to `main` updates the site within about a minute.)

## Play locally
```bash
npm start
```
Then open http://localhost:5173. The game is a static site, so any static file server works. It needs to be served over HTTP, though, because opening `index.html` directly blocks loading the data files.

- `?date=YYYY-MM-DD` plays another day's puzzle in test mode. Test mode keeps its own stats, so your real ones aren't affected.
- Progress and stats are kept in `localStorage`.

## Modes
- **Daily:** one puzzle a day, the same for everyone, with stats, streaks and a shareable result.
- **Practice:** unlimited random puzzles, opened from the switch at the top or with `#practice` on the address. It avoids your last 20 practice answers and today's daily answer. Tick "Include deep cuts" to add the 30 niche sports. Practice never touches the daily stats.

## Clue feedback and play stats
- **Flag this rule:** a link under each rule on the answer screen opens a pre-filled GitHub issue with the clue's id (e.g. `soccer-2a`), so clue problems land in the repo's Issues tab. Players need a GitHub account to send one.
- **Play stats (optional):** solve rates per clue show which clues sit at the wrong level. To turn them on:
  1. Make a free account at [goatcounter.com](https://www.goatcounter.com) with a site code such as `rulebook`.
  2. Put that code in `GOATCOUNTER_CODE` in `src/config.js` and push.

  The game then records `clue/<id>/seen` for every rule a player sees, `clue/<id>/solved` for the rule they solved on, and the final score. A clue's solve rate is solved ÷ seen. GoatCounter uses no cookies, and localhost visits aren't counted.

## Playtest link
The prototype is published as a private claude.ai artifact: https://claude.ai/artifact/Av5ixTAY38eL7i2JsQvjJ4.
To update it, run `node scripts/build-artifact.mjs`, which writes `dist/rulebook.html`. Then republish that file with `src/` and `data/` alongside it.
On the published page, the `?date=` test mode isn't available, and each player's stats stay in their own browser.

## Project layout
| Path | What it is |
|---|---|
| `index.html`, `src/` | The game: `logic.js` (pure rules, picks and matching), `main.js` (UI), `styles.css` |
| `assets/` | Icon and the link-preview image. Redraw the PNGs with `powershell -File scripts/make-images.ps1` (Windows) |
| `data/sports.json` | 82 sports: names, aliases, families (drive "close" feedback), daily or deep-cut pool, giveaway words |
| `data/clues.json` | 820 clues, two per difficulty level per sport, each with its rulebook source and rule reference |
| `rulebooks/`, `rulebooks_text/` | The source rulebooks and their text extracts (not served by the dev server) |
| `scripts/` | `serve.mjs` (dev server), `validate-clues.mjs` (giveaway-word and coverage checks), `candidates.sh` (pulls rule-like lines from a rulebook), `merge-clues.mjs` |
| `tests/` | Unit tests for the game logic |

## Checks
```bash
npm test
```
```bash
npm run validate
```

See [DESIGN.md](DESIGN.md) for the game design.
