# Forge Monday desk

The coach's report writer for [Forge Performance Labs](docs/DECISIONS.md). Load a combine, review a draft, sign it, hand it to the athlete.

Take-home V1: local, high-touch, human-signed. Not a SaaS.

## Run

```bash
npm install
cp .env.example .env   # optional: add XAI_API_KEY for live Grok drafts
npm run dev
```

Open the URL Vite prints. Click **Load this week's combine** (latest file per athlete in `data/athletes/`). Unsigned sheets are drafted immediately. **Redraft** calls Grok. Drop a Forge JSON — it is saved under `data/athletes/<id>/<tested_on>.json` and drafted the same way.

Without `XAI_API_KEY` the desk still writes letters from the same facts (template writer). With a key, Redraft uses `grok-4.6`, then a fact-check. Confidence is cosine vs that athlete’s gold PDF when we have one.

## Validate

```bash
bash bin/validate.sh
```

## Read first

- `docs/DECISIONS.md` — what V1 does, and what is left for later
- `docs/ASSUMPTIONS.md` — handbook rules, skipped tests, mid-thigh pull
- `docs/LOOM.md` — the 5-minute walkthrough
- `docs/AGENTS.md` — how a human or agent should work in this repo

## Materials

`data/athletes/<athlete_id>/<tested_on>.json` is the only combine store (desk, tests, eval). Tests are read-only on that tree. `data/forge_coach_handbook_2019_v1.json` is the 2019 range table. After sign, the coach can copy `/a/<token>` — the athlete sees only their letter. `golden_datasets/` is eval gold and the confidence reference. `src/domain/promptExample.ts` is the Grok few-shot, not gold.
