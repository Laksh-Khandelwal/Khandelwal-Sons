# Product image preprocessing pipeline

Turns messy product photos into consistent, web-optimised images — like Amazon / Nike
product cards, where every product looks equally sized and perfectly centred.

For every image it: auto-detects the product, removes the background (AI cutout),
centres it on a **1200×1200** canvas with **~13% padding**, preserves aspect ratio
(never stretches), and exports **transparent, optimised WebP** in three responsive
sizes — **400 / 800 / 1200**. It also writes `images/optimized/manifest.json`, which
the website reads to build responsive `<img srcset>`.

## Run it (single command)

```bash
# 1. one-time: install the Python dependencies
pip install -r scripts/requirements.txt

# 2. process everything under ./images  ->  ./images/optimized
npm run optimize-images
#   (same as:  python scripts/optimize_images.py)
```

First run downloads the ~176 MB AI model (`u2net`) once, then caches it.

## Options

```bash
python scripts/optimize_images.py --help

--input DIR        source folder            (default: images)
--output DIR       output folder            (default: <input>/optimized)
--sizes 400,800    responsive square sizes  (default: 400,800,1200)
--canvas 1200      master canvas px         (default: 1200)
--padding 0.13     padding per side (0–0.5) (default: 0.13 = 13%)
--quality 88       WebP quality 1–100       (default: 88)
--model u2net      rembg model              (u2net, isnet-general-use, …)
--exclude ...      glob patterns to skip    (default: logo.*, shop-*, favicon.*)
--no-upscale       don't enlarge small products
--no-bg-removal    pad/resize only, skip the AI cutout
--force            reprocess even if outputs already exist
--debug            print full tracebacks
```

## Behaviour notes

- **Recursive** through subfolders; **filenames preserved** (`Kaju_Katli.jpg` →
  `Kaju_Katli-400.webp`, `-800`, `-1200`).
- **Resumable** — skips any image whose outputs already exist. Use `--force` to redo.
- **Already-transparent** PNGs skip the AI step and are just padded/resized.
- **Crash-proof** — a corrupt or unsupported file is logged and skipped; the run
  continues.
- **Non-products** (logo, storefront photos) are excluded by default via `--exclude`.

## How the website uses the output

`app.js` loads `images/optimized/manifest.json` at startup. Any product whose image is
listed gets a responsive `<img>` with `srcset`/`sizes`, `loading="lazy"`,
`decoding="async"`, and `width`/`height`. Products not in the manifest fall back to
their original file. `style.css` gives every card a fixed square box
(`aspect-ratio: 1/1`, `object-fit: contain`, `object-position: center`) so the whole
product stays visible with no layout shift (CLS).

## Regenerating after adding products

Drop new images in `images/`, run `npm run optimize-images` (only the new ones are
processed), redeploy. The manifest updates automatically.
