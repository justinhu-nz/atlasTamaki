#!/usr/bin/env python3
"""Stage only files used by the public viewer and editor for static hosting."""
import argparse
import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FILES = ("index.html", "editor.html", "atlas.css", "atlas.js", "viewer.js", "editor.js", "ideas.js",
         "image-manifest.js", "basemaps.js", "transport-layers.js", "data/railways.js", "favicon.ico")


def build(output):
    output = output.resolve()
    if output == ROOT or ROOT.is_relative_to(output) or output.is_relative_to(ROOT / "images"):
        raise ValueError("Choose a dedicated output directory, such as dist or /tmp/atlas-pages")
    data = json.loads((ROOT / "ideas.js").read_text().split("window.ATLAS =", 1)[1].strip().removesuffix(";"))
    manifest = json.loads((ROOT / "image-manifest.js").read_text().split("window.ATLAS_IMAGES =", 1)[1].strip().removesuffix(";"))
    files = set(FILES)
    for idea in data["ideas"]:
        for image in idea["images"]:
            file = image.get("file", "")
            if file.startswith("images/"):
                files.add(file)
                if file not in manifest:
                    raise ValueError(f"Missing optimized image: {file}. Run scripts/optimize-images.py first.")
                files.update(manifest[file][size] for size in ("thumb", "display", "map"))
    for file in sorted(files):
        source = (ROOT / file).resolve()
        if not source.is_relative_to(ROOT):
            raise ValueError(f"Asset outside site: {file}")
        target = output / file
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, target)
    (output / ".nojekyll").touch()
    print(f"Staged {len(files)} files ({sum((output / f).stat().st_size for f in files):,} bytes) in {output}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", type=Path, nargs="?", default=ROOT / "dist")
    build(parser.parse_args().output)
