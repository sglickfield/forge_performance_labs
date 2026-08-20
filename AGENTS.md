# AGENTS

How to work in this repo with a human or another agent.

## Product

Monday-morning coach desk for Forge Performance Labs. Load combine export JSONs, draft a signed athlete letter. Read `docs/DECISIONS.md` and `docs/ASSUMPTIONS.md` before changing behavior.

## Run

```bash
cd /Users/sarahglickfield/Claude/forge_performance_labs
cp .env.example .env   # add XAI_API_KEY for live Grok drafts
npm install
npm run dev
```

The desk works without a key: `/api/generate` falls back to the deterministic writer. Live SpaceXAI drafts need `XAI_API_KEY` on the **server** (never `VITE_*`).

## Validate (definition of done)

```bash
bash bin/validate.sh
```

Lint, `tsc`, unit tests, and local semantic-drift checks (`src/eval/`). First run downloads `Xenova/all-MiniLM-L6-v2` into `.cache/huggingface` (gitignored). Do not claim a change is done if this fails.

If you intentionally change the **template** voice, update `src/eval/baselines.json` in the same commit.

Live Grok vs the same gold PDFs is a separate run (not every save):

```bash
npm run test:grok
```

Each invocation writes a **new** `output/grok-eval-<timestamp>.md` (and `.json`). Nothing is overwritten. Fail if any Grok letter scores below the shared floor (0.65) against `golden_datasets/`. No second baseline file — compare runs by diffing those timestamped files. Skips with exit 0 if `XAI_API_KEY` is missing.

## Where truth lives

| Thing | Path |
|---|---|
| Export format + analysis | `src/domain/` |
| 2019 handbook ranges | `src/domain/benchmarks.ts` (mirrors `forge-candidate-materials/benchmarks.csv`) |
| Report JSON schema + fact-check | `src/domain/reportSchema.ts`, `src/domain/factCheck.ts` |
| Deterministic writer | `src/domain/templateWriter.ts` |
| Grok call | `server/generateReport.ts` |
| Prompt / schema version | `PROMPT_VERSION` in `src/domain/reportSchema.ts` |
| UI | `src/ui/`, `src/App.tsx` |
| Sample combine | `public/samples/` |
| Semantic drift gold + floors | `golden_datasets/` (PDFs), `src/eval/baselines.json` |
| Grok eval runs | `output/grok-eval-<timestamp>.md` (gitignored) |

## Do not

- Invent exercise-science claims or a mid-thigh pull handbook range.
- Let the model see raw export JSON. It gets a fact pack.
- Auto-send a letter. Signing is the human step.
- Add Supabase / auth / a design system kit.
- Restyle the athlete letter to look like a SaaS dashboard.

## Adding a feature

1. Say which file changes and why (V1 vs V-awesome).
2. Put new rules in `docs/ASSUMPTIONS.md` if a coach would need to know.
3. Cover it with a unit test if it touches analysis or fact-check.
4. Run `bash bin/validate.sh`.
