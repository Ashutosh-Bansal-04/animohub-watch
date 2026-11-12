#!/usr/bin/env python3
"""Turn PDF reply assets (GTM plan, 3-email sequence, commercials...) into a
tracked page on GitHub Pages, so every reply link reports opens, reading
depth, PDF downloads and bookings to Make "Video 6 - Page tracker".

Two ways to use it:

1. From a pipeline / by hand (preferred, personalised heading):
   python3 tools/doc_page.py --pdf plan.pdf --first-name Vikash --company "Buldrr AI" \
       --label "GTM plan" [--summary "..."] [--slug abc123]
   Copies the PDF into d/<slug>/, renders its pages and writes index.html.
   Prints the page URL: link THAT in the reply email, never the .pdf itself.

2. Automatic (GitHub Action on every push): python3 tools/doc_page.py --auto
   Any d/<slug>/ folder that holds a PDF but no index.html gets a page built
   from the file names. So even a PDF dropped in by hand ends up tracked.

The page shows each PDF page as an image (works on every phone, unlike an
embedded PDF), a "Download PDF" button, and the cal.com booking calendar.
"""
import argparse, html, json, os, pathlib, re, secrets, shutil, subprocess, sys, glob

ROOT = pathlib.Path(__file__).resolve().parent.parent
BASE = "https://ashutosh-bansal-04.github.io/animohub-watch"
CAL = "https://cal.com/animo-hub-xcswxx/quick-strategy-call"
WIDTH = 1240  # rendered page width in px

PAGE = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>{title} · Animohub</title>
<meta property="og:title" content="{title}">
<meta property="og:description" content="Made for {company} by Animohub Studio.">
<meta property="og:image" content="{base}/d/{slug}/{og}">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="../../assets/mark.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap" rel="stylesheet">
<style>
  :root {{ --bg:#0f1424; --card:#151c33; --line:#26304f; --text:#eef1f8; --muted:#a9b2c9; --accent:#f5b544; --blue:#6c8cff; }}
  * {{ box-sizing:border-box; margin:0; padding:0; }}
  body {{ background:radial-gradient(circle at 85% 0%, rgba(108,140,255,.22), transparent 45%) no-repeat, var(--bg); color:var(--text);
         font-family:Inter, "Helvetica Neue", Arial, sans-serif; min-height:100vh; -webkit-font-smoothing:antialiased; }}
  .wrap {{ max-width:960px; margin:0 auto; padding:28px 20px 56px; }}
  header {{ display:flex; align-items:center; justify-content:space-between; gap:16px; margin-bottom:36px; }}
  .logo img {{ height:40px; width:auto; display:block; }}
  .wordmark {{ font-weight:800; font-size:20px; }} .wordmark span {{ color:var(--accent); }}
  .pill {{ font-size:12px; font-weight:700; letter-spacing:.12em; text-transform:uppercase; color:var(--bg);
          background:var(--accent); padding:7px 14px; border-radius:999px; white-space:nowrap; }}
  h1 {{ font-size:clamp(28px, 4.4vw, 44px); line-height:1.12; font-weight:800; letter-spacing:-.02em; }}
  .sub {{ color:var(--muted); font-size:clamp(16px, 2vw, 19px); line-height:1.55; margin-top:12px; max-width:760px; }}
  .doc {{ margin-top:30px; }}
  .doc h2 {{ font-size:18px; font-weight:700; color:var(--muted); margin:28px 0 12px; }}
  .bar {{ display:flex; flex-wrap:wrap; gap:12px; align-items:center; justify-content:space-between; color:var(--muted); font-size:14px; margin-bottom:14px; }}
  .btn {{ display:inline-block; background:var(--accent); color:var(--bg); font-weight:700; font-size:14px; text-decoration:none;
         padding:10px 16px; border-radius:10px; }}
  img.pg {{ display:block; width:100%; height:auto; background:#fff; border-radius:10px; margin-bottom:16px;
           box-shadow:0 18px 44px rgba(0,0,0,.4); }}
  .book {{ margin-top:32px; background:var(--card); border:1px solid var(--line); border-radius:18px;
          padding:24px 26px 18px; box-shadow:inset 0 3px 0 var(--blue); }}
  .book h2 {{ font-size:22px; font-weight:800; }}
  .book > p {{ color:var(--muted); margin-top:6px; line-height:1.5; font-size:15px; max-width:620px; }}
  .cal {{ margin-top:18px; width:100%; min-height:620px; overflow:auto; border-radius:12px; }}
  .fallback {{ font-size:13px !important; margin-top:10px !important; }} .fallback a {{ color:var(--accent); }}
  footer {{ margin-top:40px; color:var(--muted); font-size:13px; text-align:center; }}
  @media (max-width:560px) {{ .logo img {{ height:30px; }} .pill {{ font-size:10px; padding:6px 10px; }} .book {{ padding:18px 12px 14px; }} img.pg {{ border-radius:6px; margin-bottom:10px; }} }}
</style>
</head>
<body>
<div class="wrap">
  <header>
    <div class="logo">{logo}</div>
    <div class="pill">Made for {company}</div>
  </header>
  <h1>{title}</h1>
  <p class="sub">{summary}</p>
{docs}
  <section class="book">
    <h2>Want us to run this for you? Pick a time.</h2>
    <p>30 minutes on Google Meet. We walk through how we'd get {company} to 20 qualified meetings in 50 days.</p>
    <div id="cal-inline" class="cal"></div>
    <p class="fallback">Calendar not loading? <a href="{cal}" target="_blank" rel="noopener">Open it in a new tab</a>.</p>
  </section>
  <script>
  (function (C, A, L) {{ let p = function (a, ar) {{ a.q.push(ar); }}; let d = C.document; C.Cal = C.Cal || function () {{ let cal = C.Cal; let ar = arguments; if (!cal.loaded) {{ cal.ns = {{}}; cal.q = cal.q || []; d.head.appendChild(d.createElement("script")).src = A; cal.loaded = true; }} if (ar[0] === L) {{ const api = function () {{ p(api, arguments); }}; const namespace = ar[1]; api.q = api.q || []; if (typeof namespace === "string") {{ cal.ns[namespace] = cal.ns[namespace] || api; p(cal.ns[namespace], ar); p(cal, ["initNamespace", namespace]); }} else p(cal, ar); return; }} p(cal, ar); }}; }})(window, "https://app.cal.com/embed/embed.js", "init");
  Cal("init", "strategy", {{ origin: "https://cal.com" }});
  Cal.ns.strategy("inline", {{ elementOrSelector: "#cal-inline", calLink: "{cal_link}", config: {{ layout: "month_view", theme: "dark", name: {first_js}, notes: {notes_js} }} }});
  Cal.ns.strategy("ui", {{ theme: "dark", hideEventTypeDetails: false, layout: "month_view", cssVarsPerTheme: {{ dark: {{ "cal-brand": "#f5b544" }} }} }});
  </script>
  <footer>Animohub Studio · outbound systems that book meetings</footer>
  <p class="track-note" style="margin-top:8px;font-size:11px;opacity:.6;text-align:center">This page records views so we know the document reached you.</p>
</div>
<script src="../../assets/track.js" defer></script>
</body>
</html>
"""

LABELS = [("sequence", "3-email sequence"), ("gtm", "GTM plan"), ("plan", "GTM plan"),
          ("commercial", "commercials"), ("proposal", "proposal"), ("pricing", "pricing")]


def guess(pdf_name):
    """Company and label from a name like RoundOne_Email_Sequence_Animohub.pdf."""
    stem = re.sub(r"(?i)[_\- ]*animohub", "", pathlib.Path(pdf_name).stem)
    low = stem.lower()
    label = next((l for k, l in LABELS if k in low), "document")
    company = re.split(r"(?i)[_\- ]+(email|gtm|plan|sequence|commercials?|proposal|pricing)", stem)[0]
    return company.replace("_", " ").strip() or "you", label


def render(pdf, outdir, prefix):
    subprocess.run(["pdftoppm", "-jpeg", "-jpegopt", "quality=82", "-scale-to-x", str(WIDTH), "-scale-to-y", "-1",
                    str(pdf), str(outdir / prefix)], check=True)
    return sorted(outdir.glob(prefix + "-*.jpg"), key=lambda p: int(p.stem.rsplit("-", 1)[1]))


def build(folder, pdfs, first, company, label, summary):
    folder = pathlib.Path(folder)
    for old in folder.glob("pg*-*.jpg"):
        old.unlink()
    blocks, n, og = [], 0, None
    total = 0
    rendered = []
    for i, pdf in enumerate(pdfs):
        imgs = render(pdf, folder, f"pg{i}")
        rendered.append((pdf, imgs)); total += len(imgs)
    for pdf, imgs in rendered:
        name = pdf.name
        _, lab = guess(name)
        heading = f"<h2>{html.escape(lab[:1].upper() + lab[1:])}</h2>" if len(pdfs) > 1 else ""
        pages = []
        for img in imgs:
            n += 1
            og = og or img.name
            pages.append(f'    <img class="pg" data-n="{n}" src="{img.name}" alt="Page {n}" loading="{"eager" if n <= 2 else "lazy"}">')
        blocks.append(f"""  <section class="doc">
    {heading}
    <div class="bar"><span>{len(imgs)} page{"s" if len(imgs) != 1 else ""}</span>
      <a class="btn" href="{html.escape(name)}" target="_blank" rel="noopener" data-pdf="{html.escape(name)}">Download PDF</a></div>
{chr(10).join(pages)}
  </section>""")
    logo = '<img src="../../assets/logo.png" alt="Animohub Studio">' if (ROOT / "assets/logo.png").exists() \
        else '<div class="wordmark">Animo<span>hub</span></div>'
    title = f"{first}, here's your {label}" if first else f"Your {label}, {company}"
    summary = summary or f"Put together for {company} by Animohub Studio. Scroll through it here or download the PDF."
    e = lambda s: html.escape(s, quote=True)
    out = PAGE.format(title=e(title), company=e(company), summary=e(summary), docs="\n".join(blocks), logo=logo,
                      base=BASE, slug=folder.name, og=og or "", cal=CAL, cal_link=CAL.split("cal.com/")[1],
                      first_js=json.dumps(first or "").replace("<", "\\u003c"),
                      notes_js=json.dumps(f"Read the {label} for {company}").replace("<", "\\u003c"))
    (folder / "index.html").write_text(out, encoding="utf-8")
    return f"{BASE}/d/{folder.name}/"


def auto():
    done = []
    for folder in sorted((ROOT / "d").glob("*/")):
        if (folder / "index.html").exists():
            continue
        pdfs = sorted(folder.glob("*.pdf"))
        if not pdfs:
            continue
        company, label = guess(pdfs[0].name)
        if len(pdfs) > 1:
            label = "documents"
        done.append(build(folder, pdfs, "", company, label, ""))
    print("\n".join(done) if done else "no new document folders")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--auto", action="store_true")
    ap.add_argument("--pdf", action="append", help="PDF to publish (repeat for several)")
    ap.add_argument("--first-name", default=""); ap.add_argument("--company")
    ap.add_argument("--label", help='e.g. "GTM plan", "3-email sequence"')
    ap.add_argument("--summary", default=""); ap.add_argument("--slug")
    a = ap.parse_args()
    if a.auto:
        return auto()
    if not a.pdf:
        sys.exit("--pdf is required (or use --auto)")
    slug = a.slug or secrets.token_urlsafe(8).replace("_", "").replace("-", "")[:10].lower()
    folder = ROOT / "d" / slug
    folder.mkdir(parents=True, exist_ok=True)
    pdfs = []
    for p in a.pdf:
        dst = folder / pathlib.Path(p).name
        if pathlib.Path(p).resolve() != dst.resolve():
            shutil.copyfile(p, dst)
        pdfs.append(dst)
    g_company, g_label = guess(pdfs[0].name)
    print(build(folder, pdfs, a.first_name, a.company or g_company, a.label or g_label, a.summary))


if __name__ == "__main__":
    main()
