#!/usr/bin/env python3
"""
Production-grade product-image preprocessing pipeline.

For every source image it:
  1. Auto-detects the product and removes the background (AI cutout via rembg),
     unless the image already has real transparency.
  2. Crops to the product, scales it (aspect ratio preserved, never stretched),
     centres it on a 1200x1200 canvas with consistent padding.
  3. Exports optimised, transparent WebP in three responsive sizes: 400 / 800 / 1200.
  4. Writes a manifest.json the website uses to build <img srcset>.

Design goals: recursive, filename-preserving, resumable (skips work already done),
crash-proof per image, cross-platform, one command to run.

    python scripts/optimize_images.py            # process ./images -> ./images/optimized
    python scripts/optimize_images.py --force    # reprocess everything
    python scripts/optimize_images.py --help     # all options

Deps:  pip install -r scripts/requirements.txt
"""

from __future__ import annotations

import argparse
import json
import hashlib
import os
import sys
import time
import traceback
import urllib.request
from pathlib import Path

try:
    from PIL import Image, ImageOps, UnidentifiedImageError
except ImportError:
    sys.exit("Pillow is not installed. Run:  pip install -r scripts/requirements.txt")

# ---------------------------------------------------------------------------
# Defaults
# ---------------------------------------------------------------------------
SUPPORTED_EXT = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tif", ".tiff"}
# Files that are NOT products (branding / storefront photos) -> skipped by default.
DEFAULT_EXCLUDE = ["logo.*", "shop-*", "*-icon.*", "favicon.*"]
DEFAULT_SIZES = [400, 800, 1200]
DEFAULT_CANVAS = 1200

# Background removal runs the U2Net model directly through onnxruntime (no rembg /
# pymatting / numba). onnxruntime ships Microsoft-signed binaries, so it works even
# under Windows Application Control / Smart App Control policies that block numba.
# Weights are the standard rembg-hosted ONNX exports; downloaded once and cached.
MODELS = {
    "u2net":  ("https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2net.onnx",
               "60024c5c889badc19c04ad937298a77b"),
    "u2netp": ("https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2netp.onnx",
               "8e83ca70e441ab06c318d82300c84806"),
}
DEFAULT_PADDING = 0.13   # 13% padding on each side -> product fills ~74% of canvas
DEFAULT_QUALITY = 88


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def human(n: int) -> str:
    for unit in ("B", "KB", "MB"):
        if n < 1024:
            return f"{n:.0f}{unit}"
        n /= 1024
    return f"{n:.1f}GB"


def has_real_transparency(img: Image.Image) -> bool:
    """True if the image already carries a non-trivial alpha channel."""
    if img.mode not in ("RGBA", "LA") and "transparency" not in img.info:
        return False
    alpha = img.convert("RGBA").getchannel("A")
    lo, hi = alpha.getextrema()
    return lo < 250  # something is actually see-through


def fit_on_canvas(product: Image.Image, canvas_size: int, padding: float,
                  allow_upscale: bool = True) -> Image.Image:
    """Crop product to its alpha bbox, scale to the padded content box, centre it."""
    bbox = product.getchannel("A").getbbox()
    if bbox:
        product = product.crop(bbox)

    content = int(round(canvas_size * (1 - 2 * padding)))
    w, h = product.size
    if w == 0 or h == 0:
        return Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))

    scale = content / max(w, h)
    if not allow_upscale:
        scale = min(scale, 1.0)
    new_w, new_h = max(1, round(w * scale)), max(1, round(h * scale))
    product = product.resize((new_w, new_h), Image.LANCZOS)

    canvas = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    canvas.paste(product, ((canvas_size - new_w) // 2, (canvas_size - new_h) // 2), product)
    return canvas


def outputs_for(stem: str, out_dir: Path, sizes: list[int]) -> dict[int, Path]:
    return {s: out_dir / f"{stem}-{s}.webp" for s in sizes}


# ---------------------------------------------------------------------------
# Background removal (self-contained U2Net via onnxruntime)
# ---------------------------------------------------------------------------
def _md5(path: Path) -> str:
    h = hashlib.md5()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def _download(url: str, dest: Path):
    tmp = dest.with_suffix(dest.suffix + ".part")
    req = urllib.request.Request(url, headers={"User-Agent": "optimize-images/1.0"})
    with urllib.request.urlopen(req) as r, open(tmp, "wb") as f:
        total = int(r.headers.get("Content-Length", 0))
        got = 0
        while True:
            chunk = r.read(1 << 20)
            if not chunk:
                break
            f.write(chunk)
            got += len(chunk)
            if total:
                pct = got * 100 // total
                sys.stdout.write(f"\r  {pct:3d}%  {got/1e6:6.1f}/{total/1e6:.1f} MB")
                sys.stdout.flush()
    tmp.replace(dest)
    print()


def ensure_model(cfg) -> Path:
    """Return a local path to the ONNX model, downloading (and caching) it if needed."""
    if cfg.model_path:
        p = Path(cfg.model_path).expanduser()
        if not p.exists():
            sys.exit(f"--model-path not found: {p}")
        return p
    if cfg.model not in MODELS:
        sys.exit(f"Unknown --model '{cfg.model}'. Choose from: {', '.join(MODELS)} "
                 f"(or pass --model-path to a local .onnx).")
    url, md5 = MODELS[cfg.model]
    home = Path(os.environ.get("U2NET_HOME") or (Path.home() / ".u2net"))
    home.mkdir(parents=True, exist_ok=True)
    dest = home / f"{cfg.model}.onnx"
    if dest.exists() and _md5(dest) == md5:
        return dest
    print(f"Downloading background-removal model '{cfg.model}' (~176 MB, one-time) ...")
    try:
        _download(url, dest)
    except Exception as e:
        sys.exit(f"Could not download the model: {e}\n"
                 f"Download it manually from {url} and pass --model-path <file>.")
    if _md5(dest) != md5:
        print("  ! warning: model checksum mismatch; using the file anyway.", file=sys.stderr)
    return dest


def load_session(model_path: Path):
    import onnxruntime as ort
    so = ort.SessionOptions()
    so.log_severity_level = 3
    return ort.InferenceSession(str(model_path), sess_options=so,
                                providers=["CPUExecutionProvider"])


# U2Net preprocessing constants (ImageNet-style normalisation, 320x320 input).
_MEAN = (0.485, 0.456, 0.406)
_STD = (0.229, 0.224, 0.225)


def u2net_cutout(img: Image.Image, session):
    """Run U2Net and return the image as RGBA with the predicted alpha matte."""
    import numpy as np
    orig = img.convert("RGBA")
    w, h = orig.size

    small = orig.convert("RGB").resize((320, 320), Image.LANCZOS)
    ary = np.asarray(small, dtype=np.float32)
    ary /= max(ary.max(), 1.0)
    ary = (ary - np.asarray(_MEAN, dtype=np.float32)) / np.asarray(_STD, dtype=np.float32)
    tensor = ary.transpose(2, 0, 1)[None].astype(np.float32)

    name = session.get_inputs()[0].name
    pred = session.run(None, {name: tensor})[0][:, 0, :, :]
    pred = np.squeeze(pred)
    mi, ma = float(pred.min()), float(pred.max())
    pred = (pred - mi) / ((ma - mi) or 1.0)

    alpha = (pred * 255).astype("uint8")
    alpha[alpha < 12] = 0  # drop faint halo so the crop bbox stays tight
    mask = Image.fromarray(alpha, mode="L").resize((w, h), Image.LANCZOS)

    r, g, b, _ = orig.split()
    return Image.merge("RGBA", (r, g, b, mask))


# ---------------------------------------------------------------------------
# Core
# ---------------------------------------------------------------------------
def process_one(src: Path, rel_dir: Path, out_root: Path, cfg, session):
    """Returns (status, saved_bytes) where status in {done, skip, error}."""
    out_dir = out_root / rel_dir
    stem = src.stem
    targets = outputs_for(stem, out_dir, cfg.sizes)

    if not cfg.force and all(p.exists() for p in targets.values()):
        return "skip", 0

    try:
        with Image.open(src) as im:
            im.load()
            im = ImageOps.exif_transpose(im)          # respect camera rotation

            if has_real_transparency(im):
                cutout = im.convert("RGBA")
            elif cfg.no_bg_removal:
                cutout = im.convert("RGBA")
            else:
                cutout = u2net_cutout(im.convert("RGBA"), session)

        master = fit_on_canvas(cutout, cfg.canvas, cfg.padding, cfg.upscale)

        out_dir.mkdir(parents=True, exist_ok=True)
        saved = 0
        for size, path in sorted(targets.items(), reverse=True):
            frame = master if size == cfg.canvas else master.resize((size, size), Image.LANCZOS)
            frame.save(path, "WEBP", quality=cfg.quality, method=6, exact=True)
            saved += path.stat().st_size
        return "done", saved

    except (UnidentifiedImageError, OSError) as e:
        print(f"\n  ! skipped corrupt/unsupported {src.name}: {e}", file=sys.stderr)
        return "error", 0
    except Exception as e:  # never let one bad image kill the run
        print(f"\n  ! failed {src.name}: {e}", file=sys.stderr)
        if cfg.debug:
            traceback.print_exc()
        return "error", 0


def collect_sources(input_dir: Path, out_root: Path, exclude: list[str]) -> list[Path]:
    files = []
    for p in sorted(input_dir.rglob("*")):
        if not p.is_file() or p.suffix.lower() not in SUPPORTED_EXT:
            continue
        if out_root in p.parents or p == out_root:      # never re-ingest our own output
            continue
        if any(p.match(pat) or p.name == pat for pat in exclude):
            continue
        files.append(p)
    return files


def main():
    ap = argparse.ArgumentParser(description="Optimise product images into responsive WebP.")
    ap.add_argument("--input", default="images", type=Path, help="source folder (default: images)")
    ap.add_argument("--output", default=None, type=Path, help="output folder (default: <input>/optimized)")
    ap.add_argument("--sizes", default=",".join(map(str, DEFAULT_SIZES)),
                    help="comma-separated square sizes (default: 400,800,1200)")
    ap.add_argument("--canvas", type=int, default=DEFAULT_CANVAS, help="master canvas px (default: 1200)")
    ap.add_argument("--padding", type=float, default=DEFAULT_PADDING, help="padding ratio per side (default: 0.13)")
    ap.add_argument("--quality", type=int, default=DEFAULT_QUALITY, help="WebP quality 1-100 (default: 88)")
    ap.add_argument("--model", default="u2net", help="U2Net model: u2net or u2netp (default: u2net)")
    ap.add_argument("--model-path", default=None, help="path to a local .onnx model (skips download)")
    ap.add_argument("--exclude", nargs="*", default=DEFAULT_EXCLUDE, help="glob patterns to skip")
    ap.add_argument("--no-upscale", dest="upscale", action="store_false", help="don't enlarge small products")
    ap.add_argument("--no-bg-removal", action="store_true", help="skip AI cutout (pad/resize only)")
    ap.add_argument("--force", action="store_true", help="reprocess even if outputs exist")
    ap.add_argument("--debug", action="store_true", help="print full tracebacks")
    cfg = ap.parse_args()

    cfg.sizes = sorted({int(s) for s in cfg.sizes.split(",") if s.strip()})
    if cfg.canvas not in cfg.sizes:
        cfg.sizes.append(cfg.canvas)
        cfg.sizes = sorted(set(cfg.sizes))

    input_dir: Path = cfg.input
    if not input_dir.is_dir():
        sys.exit(f"Input folder not found: {input_dir.resolve()}")
    out_root: Path = cfg.output or (input_dir / "optimized")

    sources = collect_sources(input_dir, out_root, cfg.exclude)
    if not sources:
        sys.exit(f"No images found under {input_dir.resolve()}")

    # Load the AI model once (expensive) unless bg removal is off.
    session = None
    if not cfg.no_bg_removal:
        try:
            import onnxruntime  # noqa: F401
            import numpy  # noqa: F401
        except ImportError:
            sys.exit("onnxruntime/numpy are not installed. Run:  pip install -r scripts/requirements.txt\n"
                     "(or pass --no-bg-removal to skip the AI cutout)")
        model_path = ensure_model(cfg)
        print(f"Loading background-removal model '{cfg.model}' via onnxruntime ...")
        session = load_session(model_path)

    total = len(sources)
    counts = {"done": 0, "skip": 0, "error": 0}
    saved_bytes = 0
    manifest_stems = set()
    start = time.time()
    print(f"Processing {total} image(s)  ->  {out_root}\n")

    for i, src in enumerate(sources, 1):
        rel_dir = src.parent.relative_to(input_dir)
        status, saved = process_one(src, rel_dir, out_root, cfg, session)
        counts[status] += 1
        saved_bytes += saved
        if status != "error":
            manifest_stems.add((rel_dir / src.stem).as_posix())

        done = i
        bar_len = 28
        filled = int(bar_len * done / total)
        bar = "█" * filled + "·" * (bar_len - filled)
        tag = {"done": "✓", "skip": "•", "error": "✗"}[status]
        sys.stdout.write(f"\r[{bar}] {done}/{total}  {tag} {src.name[:34]:<34}")
        sys.stdout.flush()

    # Manifest for the website (which base names have optimised variants).
    manifest = {
        "version": 1,
        "generated": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "canvas": cfg.canvas,
        "sizes": cfg.sizes,
        "quality": cfg.quality,
        "images": sorted(manifest_stems),
    }
    out_root.mkdir(parents=True, exist_ok=True)
    (out_root / "manifest.json").write_text(json.dumps(manifest, indent=2))

    dt = time.time() - start
    print("\n\nDone in {:.1f}s".format(dt))
    print(f"  processed : {counts['done']}")
    print(f"  skipped   : {counts['skip']} (already optimised)")
    print(f"  errors    : {counts['error']}")
    print(f"  output    : {out_root}  ({human(saved_bytes)} written this run)")
    print(f"  manifest  : {out_root / 'manifest.json'}  ({len(manifest_stems)} products)")


if __name__ == "__main__":
    main()
