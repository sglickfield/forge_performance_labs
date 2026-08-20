# Golden dataset

The 12 `*_Combine_Report.pdf` files are the reference letters. Eval and the desk’s confidence score both use them. An athlete without a file here (a new upload) cannot get a confidence number.

`text/` is extracted from those PDFs for the semantic-drift test (`src/eval/semanticDrift.test.ts`). Re-extract after replacing a PDF:

```bash
python3 -c "
from pathlib import Path
from pypdf import PdfReader
root = Path('golden_datasets')
(root / 'text').mkdir(exist_ok=True)
for pdf in sorted(root.glob('*.pdf')):
    text = '\n\n'.join((p.extract_text() or '') for p in PdfReader(str(pdf)).pages)
    (root / 'text' / (pdf.stem + '.txt')).write_text(text.strip() + '\n')
"
```

Then re-run `npx vitest run src/eval/semanticDrift.test.ts` and update `src/eval/baselines.json` if the voice change was intentional.
