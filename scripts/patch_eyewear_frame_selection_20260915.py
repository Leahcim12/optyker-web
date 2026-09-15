from pathlib import Path

BAD = "data-ey-frame=\\\"'+i+'>"
GOOD = "data-ey-frame=\\\"'+i+'\\\">"
FILES = [
    Path('_site/index.html'),
    Path('_site/gestionale-v2/index.html'),
    Path('_site/gestionale-v3/index.html'),
]

for path in FILES:
    if not path.exists():
        raise SystemExit(f'Frame selection: missing {path}')
    text = path.read_text(encoding='utf-8')
    bad_count = text.count(BAD)
    good_count = text.count(GOOD)
    if bad_count == 1:
        text = text.replace(BAD, GOOD, 1)
        path.write_text(text, encoding='utf-8')
    elif bad_count == 0 and good_count == 1:
        pass
    else:
        raise SystemExit(
            f'Frame selection: unexpected renderer state in {path}: '
            f'bad={bad_count}, good={good_count}'
        )

    check = path.read_text(encoding='utf-8')
    if BAD in check or check.count(GOOD) != 1:
        raise SystemExit(f'Frame selection: patch verification failed in {path}')
    if "selectFrame(Number(this.getAttribute('data-ey-frame')))" not in check:
        raise SystemExit(f'Frame selection: click handler missing in {path}')
    for field in ('eyFrameBrand', 'eyFrameModel', 'eyFrameColor', 'eyFramePrice', 'eyFrameBarcode', 'eyFrameSku'):
        if field not in check:
            raise SystemExit(f'Frame selection: target field {field} missing in {path}')

print('Eyewear frame search results are selectable and populate the quote/job fields')
