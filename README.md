# Forge Monday desk

The coach's report writer for [Forge Performance Labs](docs/DECISIONS.md). Load a combine's export files, draft a letter you would sign, hand it to the athlete.

This is a take-home V1: local, high-touch, AI-drafted, human-signed. Not a SaaS.

## Run

```bash
npm install
cp .env.example .env   # optional: add XAI_API_KEY for live Grok drafts
npm run dev
```

Open the URL Vite prints. Click **Load this week's combine**, or drop any athlete JSON in the Forge export format.

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

`forge-candidate-materials/` is the original packet. A copy lives in `public/samples/` so the running app can load the week and accept new files later.
