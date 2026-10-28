# Atlas Tāmaki

For the private online editor with email login and GitHub-backed publishing,
see [ONLINE-EDITOR.md](ONLINE-EDITOR.md).

A static map and editor for Auckland transport, streets and housing ideas. The site runs directly from GitHub Pages, including project URLs such as `/atlasTamaki/`. It needs no application server, bundler or client framework.

## Run locally

```sh
python3 server.py
```

Open `http://localhost:8765/` or `http://localhost:8765/editor.html`. The local server lets the editor save files; GitHub Pages uses the editor's existing download/export flow.

Pasted and uploaded pictures save automatically through the local server. On static hosting, new pictures are embedded in the downloaded `ideas.js`, so only that file needs moving into the project; no separate image downloads are needed. Embedded pictures increase the size of `ideas.js` and use their original resolution.

## Images and publishing

Display images and their dimensions are checked in, so publishing the repository root works as before. After adding or replacing images with the editor, regenerate the optimized assets before publishing:

```sh
python3 -m pip install -r scripts/requirements-images.txt
python3 scripts/optimize-images.py
```

Commit `ideas.js`, the originals, `image-manifest.js` and `images/optimized/` together. The generator uses content hashes in image filenames to refresh changed images through browser and hosting caches. Duplicate source content shares generated assets. New images without generated metadata still work through the original-image fallback.

The viewer and editor use 320px WebP thumbnails, 960px detail images, and a maximum 2048px image for map alignment. Originals remain available in the viewer's full-size lightbox. Generated dimensions avoid downloading or decoding originals just to lay out stickers. Offscreen stickers defer their thumbnail requests until approaching the viewport.

To stage a smaller publishing directory that excludes prototypes, backup files and development scripts:

```sh
python3 scripts/build-pages.py
```

Publish the contents of `dist/` using your GitHub Pages artifact workflow, or use any other static host. The build is optional; it checks that every referenced local image has optimized assets. All site paths remain relative, and idea links use hashes, so project URLs and deep links work without rewrite rules. MapLibre and map tiles still require internet access.

## Performance checks

The optimization preserves the sticker interaction: overlays follow the map's render event while moving, and settle with DOM-only animation frames when stationary. Hover no longer requests WebGL redraws. Routes use feature state for highlighting. Layout ignores distant stickers, stops when settled, pauses when the tab is hidden or the list is open, and avoids rewriting unchanged SVG paths. The map canvas is capped at 2× pixel density, reducing canvas pixel count by 56% on a 3× display while keeping the HTML interface at native resolution.

A local Chrome comparison at 1440×900 measured:

| Measurement | Before | After |
| --- | ---: | ---: |
| Startup image bytes | 29,702,362 | 421,840 |
| Original image requests at startup | 36 | 0 |
| Decoded image pixels in the initial DOM | 104,894,394 | 2,043,200 |
| WebGL render events during a stationary hover | 39 | 0 |

These are local browser measurements, not hosted Core Web Vitals or a prediction of GitHub Pages latency. The full generated thumbnail set is 468,300 bytes; initial viewport coverage determines which thumbnails are requested.

The browser regression check requires Playwright and an installed Chromium browser. Serve a staged build under a project path, then run:

```sh
python3 scripts/build-pages.py /tmp/atlas-pages/atlasTamaki
python3 -m http.server 8897 --directory /tmp/atlas-pages
# In another terminal, with Playwright installed:
ATLAS_URL=http://localhost:8897/atlasTamaki/ node tests/browser-performance.cjs
```

Set `CHROME_PATH` to a Chrome executable if Playwright's bundled browser is unavailable. Checks cover desktop and mobile, deferred original images, lazy list rendering, search, true-scale overlays, full-size viewing, settled animation, viewport culling, basemap switching, route highlighting, failed image requests, deep links and editor export.
