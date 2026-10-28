# Guess the Sport — game design (draft)

## Core loop
1. You see **clue 1**, an obscure rule from one sport's rulebook.
2. You guess a sport. A wrong guess uses up one of your **5 guesses** and shows the next, easier clue.
3. You win by naming the sport within 5 guesses. If you miss all 5, the game shows the answer.
4. The result screen lists every rule shown, with its rulebook and rule number, plus a spoiler-free share line.

Guesses that don't match a known sport, or that you already tried, are rejected without costing a turn.

## Screens
| Screen | Contents |
|---|---|
| Home | Title, **Daily** (same puzzle for everyone, resets at midnight local time), **Endless** (random, no repeats until the pool is exhausted), How to play, Stats |
| Game | Puzzle number, 5 guess pips, clue stack (newest on top, older clues dimmed but readable), wrong-guess chips, guess box with autocomplete |
| Result | Answer, one-line description of the sport, all 5 rules with sources (unseen ones hidden until you tap), share text, next-daily countdown, "Play endless" |
| Stats | Played, win %, current/max streak, guess distribution (1–5, X) |
| How to play | 3-step explainer with an example clue |

Mobile first: one column, the input pinned near the thumb, and clues readable without scrolling for the first 3.

## Matching guesses to sports
**Pick from a list, don't parse free text.** The input is a combobox over the canonical sport list. Players can type, but they submit a sport from the list, not a raw string.

- **Canonical list:** one entry per answerable sport (`id`, display name, aliases).
- **Normalization for autocomplete:** lowercase, strip accents (`pétanque` → `petanque`) and punctuation, collapse spaces.
- **Ranking:** exact alias > prefix of name or alias > substring > fuzzy (typo distance ≤ 2) suggestions.
- **Ambiguous words show every option** rather than guessing for the player:
  - "football" → Soccer, American football, Australian rules, Gaelic football, Canadian football
  - "hockey" → Ice hockey, Field hockey, Rink hockey, Underwater hockey
  - "handball" → Handball (team), Gaelic handball
- **Answer granularity:** one answer per sport as a fan would name it. NFL and NCAA books both feed "American football", and FIBA and NBA both feed "Basketball". Variants players think of as distinct stay separate (beach volleyball, futsal, beach soccer). Field and sixes lacrosse merge into "Lacrosse".
- **Shared rulebooks:** the GAA book covers both hurling and Gaelic football, so each clue is tagged to one of them.

### "Close" feedback on a wrong guess
Each sport gets a **family** tag (for example stick-and-ball, net/racket, football codes, sliding, combat, cue/target, water). A wrong guess from the answer's family is marked **close** (amber). Others are plain wrong (red). It's one bit of help, so the clues still do the work.

## How the five clues get easier
Every clue is a short **paraphrase** of a real rule, written fresh rather than quoted, which keeps us clear of copyright. Each one cites its rulebook file and rule number.

Each sport has a **tell-word list** with the earliest level each word may appear:
- **Never:** the sport's own name and its governing body.
- **Level 4+:** signature jargon such as "puck", "wicket", "scrum", "end" (curling) or "shuttlecock".
- **Before that:** neutral substitutes like `[object]`, `[stick]` and `[playing area]`.

| Level | What it reveals | Example (soccer) |
|---|---|---|
| 1 Deep cut | A surprising technical, admin or equipment rule; no environment, team size or jargon | The ball's circumference must be 68–70 cm, and it's re-inflated to a set pressure before play |
| 2 Shape | Something structural: team size, duration, scoring units | A match can't start or continue if a team has fewer than 7 players |
| 3 Setting | The environment or the main equipment category | A goal can't be scored directly from a [restart taken with the hands] |
| 4 Mechanic | A distinctive mechanic, described generically; jargon unlocks here | Only one player per team may handle the ball, and only inside a marked area near their goal |
| 5 Giveaway | The signature rule, all jargon allowed except the name | A player is offside if nearer the opponents' goal line than both the ball and the second-last opponent when a teammate plays it |

**Writing rules for clues:**
- Clue 1 should feel like "wait, that's a rule?" It may fit several sports.
- By clue 5, the set of clues together must point to exactly one sport in the list.
- 1–2 sentences, ≤ 35 words, plain English, no numbers that give the sport away before level 3 (for example 18 holes or 11 players).
- Each sport should have 8–10 clues (at least 1 per level, extras at levels 1–3) so Endless can vary them.

**Calibration:** start from an editor rating per clue. Once there are players, record the solve rate at each clue. A level-1 clue that half the players solve gets moved up, and a level-4 clue nobody solves gets moved down.

## Answer pool
82 sports is great for autocomplete but brutal as answers. Split them:
- **Daily pool:** about 40 widely known sports.
- **Deep cuts:** bandy, mallakhamb, tchoukball, kin-ball and the like. These appear in Endless with a "deep cut" toggle, plus an occasional themed daily.

Every sport stays in the guess list regardless, which also helps: browsing the list is part of the fun.

## Data shape
```json
{
  "sports": [{ "id": "bandy", "name": "Bandy", "aliases": ["russian hockey"], "family": "stick-ball", "pool": "deep",
               "blurb": "Hockey's older cousin...", "tellWords": { "never": ["bandy"], "level4": ["bandy ball"] } }],
  "clues":  [{ "sport": "bandy", "level": 1, "text": "...", "source": "bandy.pdf", "ref": "Rule 4.2", "difficulty": 1.2 }]
}
```

## Tech
A static site with no backend. The daily puzzle is chosen from the date (a fixed, seeded order), so every player gets the same one. Stats and streaks live in localStorage, and clues ship as one JSON file.

## Decisions (2026-10-28)
1. **Answer granularity:** NFL and NCAA merge into "American football", and FIBA and NBA into "Basketball". Beach and indoor variants stay separate answers.
2. **Close feedback:** kept, based on the `family` tag.
3. **Build order:** Daily first, then Endless.
4. **Name:** "Rulebook".
