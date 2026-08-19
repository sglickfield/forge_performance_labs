# Assumptions

Exercise science is out of scope. These are the working rules so a coach (or a reviewer) can disagree with them in one place.

## Handbook

- `benchmarks.csv` is the only reference data that exists. Typical range = recreational-to-competitive adults, 2019 coach handbook.
- Age bands: 18–29, 30–39, 40+. Athletes under 18 would use 18–29 and get a youth flag. Nobody in this batch is under 18.
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

## The letter

- Written to the athlete, signed by the coach.
- Specific, calm, high-end. No "crush your goals," no invented programming.
- Two or three keeps, two or three focuses. Not nine mini-essays.
- An internal **coach brief** sits beside the letter. It is not printed for the athlete.

## Session

New export files arrive after every combine. The running app must accept any file in this format. Re-uploading the same `athlete_id` replaces the export and clears an unsigned draft.
