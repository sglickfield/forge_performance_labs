# AGENTS

How to work in this repo with a human or another agent.

## Product

Monday-morning coach desk for Forge Performance Labs. Load combine JSON; unsigned sheets auto-draft from the template writer. Redraft is Grok. Read `docs/DECISIONS.md` and `docs/ASSUMPTIONS.md` before changing behavior.

## Run

```bash
cd /Users/sarahglickfield/Claude/forge_performance_labs
cp .env.example .env   # add XAI_API_KEY for live Grok drafts
npm install
npm run dev
```

The desk works without a key: load-week drafts and `/api/generate` use the template writer. Live Grok needs `XAI_API_KEY` on the **server** (never `VITE_*`). Prompt version: `forge-report-v4`.

## Validate (definition of done)

```bash
bash bin/validate.sh
```

Lint, `tsc`, unit tests, and local semantic-drift checks (`src/eval/`). First run downloads `Xenova/all-MiniLM-L6-v2` into `.cache/huggingface` (gitignored). Do not claim a change is done if this fails.

If you intentionally change the **template** voice, update `src/eval/baselines.json` in the same commit.

Live Grok vs the same gold PDFs:

```bash
npm run test:grok
```

Each run writes a **new** `output/grok-eval-<timestamp>.md` (and `.json`). Fail if any Grok letter scores below the floor (0.65) against `golden_datasets/`. Skips with exit 0 if `XAI_API_KEY` is missing.

**Two different “gold”s — do not mix them up:**

- `src/domain/promptExample.ts` — Aisha-shaped few-shot **inside the Grok prompt**.
- `golden_datasets/*.pdf` — reference letters for **eval / confidence**.

## Where truth lives

| Thing | Path |
|---|---|
| Combine JSON (app, tests, eval — read-only in tests) | `data/athletes/<athlete_id>/<tested_on>.json` |
| 2019 handbook ranges | `data/forge_coach_handbook_2019_v1.json` (loaded by `src/domain/handbook.ts`) |
| Export parse + analysis | `src/domain/parseAthlete.ts`, `src/domain/analyze.ts` |
| Handbook load | `src/domain/handbook.ts` |
| Band labels (test chips) | `src/domain/bandLabels.ts` |
| Report schema + fact-check | `src/domain/reportSchema.ts`, `src/domain/factCheck.ts` |
| Deterministic writer | `src/domain/templateWriter.ts` |
| Grok few-shot (not eval) | `src/domain/promptExample.ts` |
| Shared format helpers | `src/domain/format.ts` |
| Public letter shape | `src/domain/publicLetter.ts` |
| Disk store + HTTP | `server/athleteStore.ts`, `vite.config.ts` `/api/athletes` |
| Signed letter share (no login) | `data/share/<token>.json` · `/a/<token>` · `src/ui/AthleteView.tsx` |
| Grok + confidence | `server/generateReport.ts`, `server/scoreAgainstGold.ts`, `/api/confidence` |
| Load-week / upload drafts | `src/persist/store.ts` `seedTemplateDrafts` (then `/api/confidence`) |
| UI | `src/ui/Desk.tsx` (shell), `src/ui/AthletePane.tsx` (editor), `src/ui/AthleteView.tsx` (share page) |
| Eval gold letters | `golden_datasets/` |
| Grok eval runs | `output/grok-eval-<timestamp>.md` (gitignored) |

## Do not

- Invent exercise-science claims or a mid-thigh pull handbook range.
- Let the model see raw export JSON. It gets a fact pack.
- Auto-send a letter. Signing is the human step. Sharing a link is the coach’s choice.
- Write into `data/share/` from tests. Use a temp dir via `setShareRoot`.
- Write into `data/athletes/` from tests.
- Add Supabase / auth / a design system kit.
- Restyle the athlete letter to look like a SaaS dashboard.

## Adding a feature

1. Say which file changes and why (V1 vs V-awesome).
2. Put new rules in `docs/ASSUMPTIONS.md` if a coach would need to know.
3. Cover it with a unit test if it touches analysis or fact-check.
4. Run `bash bin/validate.sh`.
