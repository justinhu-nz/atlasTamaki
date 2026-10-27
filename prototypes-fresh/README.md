# Atlas Tāmaki HTML prototypes

Open `index.html`, or serve this directory with `python3 -m http.server 8765` and visit http://localhost:8765.

- `postcards.html`: fixed-size image cards with location tethers and a nearby-ideas stack.
- `plans.html`: selectable image covers and one unfolded plan at a time.
- `compare.html`: a divider revealing a drawing against the basemap.
- `editor.html`: replace an image, drag or position it using sliders, rotate, resize, edit caption and credit, save, and export JSON.

No installation or build is required. HTML, CSS, JavaScript and image assets are included. The optional build.py script records how these pages were assembled, but running the prototypes does not depend on it.

Use the same local server origin for all pages so browser storage is shared reliably. Editing persists in localStorage. If storage is unavailable or full, the editor reports it; export JSON before leaving to preserve the current ideas. Uploaded images must be below 2.5 MB. Use Save idea before exporting edits.

These prototypes use a finite basemap crop from the supplied Felt screenshot, not a live tile map. Map panning and zoom are interaction demonstrations. All locations, captions, and alignment are illustrative. Card slots and stacks are deterministic demonstrations rather than a general collision-placement algorithm. Plan alignment is approximate; comparison deliberately displays the drawing north-up on screen. The source images are low-resolution crops from the supplied screenshots and do not establish reuse permission.

The editor updates existing sample ideas; new idea creation, line drawing, production content management, georeferencing, and publication are not implemented. Nothing is published or sent to a server.
