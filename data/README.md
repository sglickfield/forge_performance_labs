# Athlete store

This is the only location for combine JSON (seed week and later uploads).

```
data/athletes/<athlete_id>/<tested_on>.json
```

- The desk loads **latest** `tested_on` per folder.
- Uploads are written here (never overwrite: `2026-07-16__2.json` if that date exists).
- Tests and eval **read** this tree. They must not write here.
- `golden_datasets/` is eval gold (letters), not input.
- `benchmarks.csv` is the 2019 handbook copy; runtime ranges still live in `src/domain/benchmarks.ts`.
