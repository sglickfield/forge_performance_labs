# Assumptions

Exercise science is out of scope. These are the working rules so a coach (or a reviewer) can disagree with them in one place.

## Handbook

- `data/forge_coach_handbook_2019_v1.json` is the only reference data that exists. Typical range = recreational-to-competitive adults, 2019 coach handbook.
- Age windows come from that file (`age_min` / `age_max`; `age_max` null = open-ended). Athletes under the youngest window use that window. Nobody in this batch is under 18.
- Sex in the export is `M` / `F`. That is how the handbook is keyed. We do not invent other groupings.

## Directionality

- **40m sprint:** lower is better.
- **Everything else with a range:** higher is better.
- **Mid-thigh pull:** no handbook row. We do not invent a Newton range. We report the raw value and, when a combine is loaded, rank among completed pulls that week.
- Grip and balance handbook rows apply to either side. Left and right are scored separately against the same range, then compared to each other.

## Bands

For a test with a range `[lo, hi]`:

- In range → `typical`
- Sprint faster than `lo`, or other tests above `hi` → `above` (better than typical)
- Sprint slower than `hi`, or other tests below `lo` → `below` (weaker than typical)
- Skipped / null raw → `skipped`. The letter must not invent a number.
- Mid-thigh pull → `unbenchmarked`

"Far outside typical" is a **verify** flag, not a medical claim. Threshold: more than 10% beyond the nearer bound. Sam Rivera's 3.92s 40m trips this on purpose — possible mistime, and the admin note says two athletes were tested in parallel.

## Asymmetry

If both sides completed:

- Grip: relative difference ≥ 10% is flagged.
- Balance: relative difference ≥ 15% is flagged (noisier test).

We do not diagnose injury. We surface the split and any tester note (Taylor's right wrist, Casey's ankle).

## Tester notes and conditions

Notes are first-class facts. They become caveats the coach should keep or delete, not flavor text for the model to riff on.

## The report

- Written to the athlete, signed by the coach.
- Shape matches what a coach actually hands over: overview, results table, clustered takeaways, coaching recommendations.
- Recommendations name training *qualities* (sprint work, plyometrics, hip hinge, mobility, retest window). They do not invent sets, reps, diagnoses, or skipped scores.
- Handbook ranges are recreational-to-competitive, not elite. The overview says so once.
- After a draft exists, the coach may rate it: **Ready** (would send), **Edited** (rewrote parts), **Rewrite** (would not send). That rating is of the *draft*, not the athlete. It is optional, stays on the desk, and is cleared if they unlock or generate a new draft.
- A signed letter can be shared as a no-login link (`/a/<token>`). The athlete sees only that letter — not the roster, flags, or rating. The token is the access control. Unlocking unpublishes the link.

## Session

New export files arrive after every combine. The running app must accept any file in this format. Each athlete folder can hold multiple dates; the desk toggles between them. Re-uploading the same `athlete_id` and date asks before replacing.
