# Decisions (V1 vs V-awesome)

This is the product/technical record for the Forge take-home. Written so a human or an agent can pick up the repo and know *why*, not just *what*.

Alex's kickoff brief, compressed: do the AI solution, keep storage local, stay high-touch, put the coach in the loop, and be ready to defend the V1 / V-awesome boundary.

## Who this is for

- **Coach:** high-touch, ~10 clients, not a factory of 1,000 reports a week. Used to handwriting "here's what I saw / keep this / focus here / this was off." The tool drafts that letter; the coach still signs it.
- **Athlete:** a high-end letter they would be comfortable receiving from a coach, not a data dump and not a chatbot transcript.

## What V1 is (and is not)

V1 is a Monday-morning desk:

1. Load this week's combine (sample batch or any export JSON dropped in while the app is running).
2. See who needs a letter, and who has messy data.
3. Generate a coach-voiced draft from **computed facts**, not from raw JSON dumped at a model.
4. Edit. Sign. Hand the athlete a letter with the coach's name at the bottom.

V1 is **not** a multi-tenant SaaS, a training OS, a historical athlete record, or a "sell it off the shelf tomorrow" product.

## Storage

**V1:** combine JSON on disk under `data/athletes/<athlete_id>/<tested_on>.json`. Drafts/signatures stay in localStorage. No database process.

Why not SQLite: a folder per athlete is enough for this week’s files and later uploads. Reviewers clone the repo and run; they do not stand up Postgres. New drops never overwrite: a second file on the same date is `2026-07-16__2.json`. The desk loads the latest date per athlete.

**V-awesome:** Postgres (Neon / RDS) for combines, reports, prompt versions, and eval traces. Object store for the original export files. The upload UX stays the same.

## Inference

**V1:** one structured completion against SpaceXAI (`grok-4.6` via `https://api.x.ai/v1/chat/completions`). Prompt version: `forge-report-v3` in `src/domain/reportSchema.ts`.

Pipeline, on purpose:

1. Deterministic analysis turns an export + the 2019 handbook into a **fact pack** (bands, flags, notes, cohort rank for mid-thigh pull).
2. The model sees only the fact pack, plus a few-shot **prompt example** (`src/domain/promptExample.ts`). That example is not the eval gold.
3. Output is constrained to a JSON schema (overview, takeaways, recommendations, caveats, coach brief).
4. A fact-checker rejects drafts that invent skipped-test numbers or drop required caveats. `cleanDraft()` strips empty-sheet caveats.
5. If `XAI_API_KEY` is missing or the call fails, the same fact pack runs through `templateWriter.ts` so the desk still works in a live session.
6. The coach must edit/sign. Nothing is sent to an athlete without that step.

**Eval gold** is `golden_datasets/*.pdf` — human-approved letters. Semantic scoring against those files (when present on a branch) is how we notice the writer drifting. Do not confuse that folder with the prompt example.

**What we are ready to defend**

- Demo inference is "facts first, structured report, human signs."
- We know a draft is *structurally* ok because of schema + fact-check + Casey must not get jump scores.
- Similarity to gold PDFs is a confidence signal, not a proof of good coaching. The coach still signs.

**V-awesome**

- Prompt/version registry; every signed letter stores `{promptVersion, model, factHash, coachEdits}`.
- Regression evals on every prompt change. "Working over time" = eval suite + edit-distance from the draft the coach actually signed.
- Per-coach style memory once we have enough signed letters.
- Queue + retries + cost controls. Not a request from the browser.

## Human in the loop

The human is in the loop **before the letter exists for the athlete**, not after it has been emailed.

- Auto-draft is allowed.
- Auto-send is not.
- Flags (skipped tests, tester notes, wild outliers, L/R splits) are shown next to the letter, not buried.
- Signing is an explicit action and stamps the coach's name.

That is the V1 guardrail. Not a content-moderation stack.

## Visual

The athlete letter is the product surface, not a dashboard of cards. Coach chrome is a desk; the readout is a letterhead. If it looks like a default 2026 AI landing page, we failed a requirement Alex said out loud.

## Repo for humans and agents

- `AGENTS.md` — how to run, where truth lives, what not to invent.
- `docs/ASSUMPTIONS.md` — exercise-science and product assumptions.
- `docs/LOOM.md` — the 5-minute story, written before the recording.
- `bin/validate.sh` — lint, typecheck, unit tests. Definition of done. Root `validate.sh` just execs this.

## Corners we cut on purpose

- No accounts, no cloud, no email send.
- No mid-thigh pull handbook range — we say so, and use within-combine rank.
- No historical compare. This week's files only.
- No mobile-first layout.
- No prompt-injection fortress. The only untrusted text is a tester note, and it is treated as data inside a fact pack.
