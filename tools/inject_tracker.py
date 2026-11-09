"""Add the view tracker to every video page that doesn't have it yet.

Runs in the GitHub Action on every push, so any page published by the
video pipeline gets tracking automatically. Safe to run repeatedly.
"""
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
TAG = '<script src="../../assets/track.js" defer></script>'
NOTE = ('<p class="track-note" style="margin-top:8px;font-size:11px;opacity:.6;text-align:center">'
        'This page records views so we know the video reached you.</p>')

changed = []
for page in sorted(ROOT.glob("v/*/index.html")):
    html = page.read_text(encoding="utf-8")
    if "assets/track.js" in html:
        continue
    addition = NOTE + "\n" + TAG + "\n"
    if "</footer>" in html:
        html = html.replace("</footer>", "</footer>\n" + addition, 1)
    elif "</body>" in html:
        html = html.replace("</body>", addition + "</body>", 1)
    else:
        print(f"skip (no </body>): {page}", file=sys.stderr)
        continue
    page.write_text(html, encoding="utf-8")
    changed.append(str(page.relative_to(ROOT)))

print("\n".join(changed) if changed else "nothing to inject")
