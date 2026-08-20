# Forge Monday desk

The coach's report writer for [Forge Performance Labs](docs/DECISIONS.md). Load a combine's export files, draft a letter you would sign, hand it to the athlete.

This is a take-home V1: local, high-touch, AI-drafted, human-signed. Not a SaaS.

## Run

```bash
npm install
cp .env.example .env   # optional: add XAI_API_KEY for live Grok drafts
npm run dev
```

Open the URL Vite prints. Click **Load this week's combine** (reads `data/athletes/`, latest file per athlete), or drop a Forge JSON — uploads are written to `data/athletes/<id>/<tested_on>.json`.

Without `XAI_API_KEY` the desk still writes letters from the same fact pack (deterministic writer). With a key, drafts go through `grok-4.6` at `api.x.ai`, then a fact-check.

## Validate

```bash
bash bin/validate.sh
```

## Read first

- `docs/DECISIONS.md` — V1 vs V-awesome, why JSON, how we know the AI is working
- `docs/ASSUMPTIONS.md` — handbook rules, skipped tests, mid-thigh pull
- `docs/LOOM.md` — the 5-minute walkthrough
- `AGENTS.md` — how a human or agent should work in this repo

## Materials

`data/athletes/<athlete_id>/<tested_on>.json` is the only combine store (desk, tests, eval). Tests are read-only on that tree. `data/forge_coach_handbook_2019_v1.json` is the 2019 range table. `golden_datasets/` holds reference PDFs for eval. `src/domain/promptExample.ts` is the Grok few-shot, not eval gold.
