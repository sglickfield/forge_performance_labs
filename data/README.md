# Data

## Combine JSON

```
data/athletes/<athlete_id>/<tested_on>.json
```

The only location for combine exports (seed week and later uploads).

- The desk loads the latest `tested_on` first, then the coach can toggle older combines on that athlete.
- Uploads are written here. If that date already exists, the desk asks whether to replace or keep both (`2026-07-16__2.json`).
- Tests and eval **read** this tree. They must not write here.
- `golden_datasets/` is eval gold (letters), not input.
- Signed, shareable letters are `data/share/<token>.json` (gitignored). Not combine input. The athlete page is `/a/<token>`.

## Handbook

`forge_coach_handbook_2019_v1.json` is the 2019 Appendix C source of truth. Long-form rows:

```
metric, sex, age_min, age_max, lo, hi
```

`metrics[]` names each handbook test (`better`, `unit`) and which combine subtests it applies to (grip/balance are either-side). Scoring is `lookup(metric, sex, age)` — no `age_18_29` columns, no copy of the numbers in TypeScript. Mid-thigh pull has no row on purpose.
