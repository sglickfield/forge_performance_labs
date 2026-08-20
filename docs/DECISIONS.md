# Decisions

Alex’s brief: build the AI letter writer, keep files local, keep the coach in the loop, and be able to say what V1 is vs what comes later.

## Who it’s for

- **Coach:** a handful of athletes, not a factory. They still write “here’s what I saw.” The desk drafts that letter. They sign it.
- **Athlete:** a letter they’d actually want to receive. Not a spreadsheet dump. Not a chatbot log.

## What V1 does

1. **Load this week’s combine** from `data/athletes/` (latest date per athlete), or drop in a new JSON while the app is running.
2. **Draft every unsigned sheet right away** with the template writer. Same facts the model would see. Monday morning is review, not waiting on Generate.
3. **Redraft with Grok** when the coach wants a model pass (`grok-4.6`, prompt `forge-report-v4`).
4. **Score tests** against the 2019 handbook. Flags messy sheets (skips, splits, verify outliers).
5. **Edit** the letter next to the document. **Sign and lock.** Print / PDF.
6. **Share** a no-login link after sign (`/a/<token>`). The athlete sees only their letter.
7. **Toggle older combines** for the same athlete. We do not graph them.
8. **Confidence:** cosine vs that athlete’s gold PDF, when we have one. Template and Grok drafts both get it. If there’s no gold file (e.g. a new upload), we say so.

V1 is a local desk. It is not a SaaS, not a training OS, and not something you sell off the shelf tomorrow.

## How a letter is written

On purpose:

1. Analysis turns the export + handbook into a **fact pack** (bands, flags, notes, mid-thigh rank). The model never sees raw JSON.
2. Grok gets that fact pack plus one few-shot example (`src/domain/promptExample.ts`). That example is not the eval gold.
3. Output is a JSON schema (headline, overview, takeaways, recommendations, caveats).
4. A fact-check rejects invented skip scores. Empty-sheet caveats get stripped.
5. No API key, or Grok fails → same fact pack through `templateWriter.ts`.
6. Nothing goes to an athlete until the coach signs.

**Gold PDFs** (`golden_datasets/`) are the reference letters. We use them for eval and for the confidence number. Do not mix them up with the prompt example.

We can defend:

- Facts first, then a structured letter, then a human signs.
- Casey cannot get jump scores she didn’t test.
- Confidence is “close to the gold letter,” not “this is good coaching.”

## Storage

**V1:** combine files on disk, `data/athletes/<athlete_id>/<tested_on>.json`. Drafts and signatures live in the browser (`localStorage`). Share links are `data/share/<token>.json` (gitignored). No database.

A folder per athlete is enough for this week and later uploads. Same date twice asks before replace; keep-both becomes `2026-07-16__2.json`.

## Human in the loop

The coach is in the loop **before** the athlete sees a letter.

- Auto-draft: yes (default on load and on a new drop).
- Auto-send: no.
- Flags sit next to the letter.
- Sign is a real click and stamps the coach’s name.
- Ready / Edited / Rewrite rates the *draft*, not the athlete. Optional. Does not change the model in V1.
- Share is opt-in after sign. Unlocking takes the link down.

## Visual

The letter is the product. The rest is a coach desk. If it looks like a generic AI dashboard, we missed the brief.

## What V1 does not do (V-awesome)

Not in this build:

- **“My own voice.”** We do not learn from a coach’s edits or signed letters. Every Grok draft uses the same prompt. Later: keep the edits they actually shipped and steer new drafts toward that voice.
- **A/B testing.** One prompt version (`forge-report-v4`). No experiments, no traffic split, no winner. Later: two prompts, store which one wrote the draft, let Ready/Edited/Rewrite pick.
- **A real database.** No Postgres, no object store, no prompt registry. Later: combine files, reports, prompt versions, and eval traces in one place.
- **Eval on every prompt change.** V1 has a local semantic-drift test and an optional `npm run test:grok`. Later: that suite is CI, plus how much the coach had to rewrite.
- **Queue, retries, cost control.** Redraft is a request from the browser.
- **Accounts, hosted product, email.** Local Vite app. Grok is the only outside call.
- **Progress charts.** Date toggle only.
- **A mid-thigh pull handbook range.** We say it isn’t in the 2019 book and show within-week rank.
- **Mobile-first layout.**
- **A prompt-injection fortress.** Tester notes are data in the fact pack, not instructions.

## Other docs

- `docs/AGENTS.md` — how to run, where files live
- `docs/ASSUMPTIONS.md` — handbook and scoring rules
- `docs/LOOM.md` — 5-minute walkthrough
- `bin/validate.sh` — lint, types, tests
