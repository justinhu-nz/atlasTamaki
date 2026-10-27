# Golden prototype: Jostle stickers with focus

**File:** `prototypes/jostle-lab.html` (it uses the shared `prototypes/items.js` and `prototypes/proto.css`)
**Run:** `cd /Users/admin/Vibes/atlasTamaki && python3 -m http.server 8765`, then open http://localhost:8765/prototypes/jostle-lab.html

This is the chosen way to show proposal images on the map. Other approaches were tried and set aside (see [Exploration history](#exploration-history)).

---

## The idea in one paragraph
Each proposal image (a render, a photo or a plan drawing) is a **sticker** near the place it's about. Stickers are pulled towards their spot and push each other out of the way, so they **never overlap and none are hidden**. When a sticker can't sit right on its spot, a thin line ties it back to a **dot** marking the exact location. **Hovering a sticker brings it into focus**: it grows, straightens and lifts, and its neighbours shrink a little and move aside. True map scale (the image lined up with the ground) is **not** the default view. It's planned as a toggle in an idea's detail view.

## Chosen settings (the defaults)
| Setting | Value | Why |
|---|---|---|
| Size | **Focus**: hovered grows, others make room | Lots of ideas stay small and readable, and one can be looked at in detail without opening anything |
| Spot marker | **Dot** | Shows the exact location without clutter |
| Link to spot | **Straight line**, drawn only when the sticker is pushed away from its spot | Tells you where it belongs; no line when it's already there |
| When crowded | **Spread everything out** | Nothing is hidden behind a count |
| Tilt | **On**, a random ±3.5° per sticker that stays the same | Hand-pinned scrapbook feel, like the Felt map |
| Titles | **On**, a label under each sticker | Readable without hovering |
| Colour edge | **On** (can be switched off): a 3px border in the idea's colour | Tells ideas apart at a glance |
| Form | Card (white border, rounded) | |
| Base size | 84px on the long side | |
| Pull to spot | 10 | Settles quickly without snapping |
| Bounciness | 20 | A slight spring, so the motion feels physical |
| Personal space | 6px | |

The other options in the lab (polaroid, circle and speech-bubble forms, hanging strings, pins, drift towards water, idle drift, piles) are still there for comparison, but they aren't part of the chosen design.

## How it behaves

### Placement (jostle)
- Each sticker has a position and a speed. Every frame it is:
  1. **Carried with the map:** when the map pans or zooms, every sticker moves by however far its spot moved, so stickers stay locked to the map.
  2. **Pulled to its spot** like a spring: `speed = speed × bounciness + (spot − position) × pull`.
  3. **Pushed out of overlaps:** each overlapping pair is pushed apart along whichever direction overlaps least. This repeats 4 times a frame. The overlap check includes room for the title (+20px) and the personal-space gap.
- Bigger ideas sit underneath smaller ones, so a small station sticker is never covered by a corridor-sized one.
- The map keeps drawing extra frames only while some sticker is still moving more than 0.15px a frame, then stops. A still map costs nothing.

### Focus (hover)
- **Grows:** the hovered sticker grows to **1.9×**.
- **Fisheye:** every other sticker shrinks by `1 − 0.3 × e^(−distance / 160px)`, measured between their spots. Close neighbours shrink to about 0.7×, and ones far away stay at 1×.
- **Smooth:** scale and tilt move 20% of the way to their target each frame (about 0.25s to settle), never jumping.
- **Straightens and lifts:** the hovered sticker's tilt goes to 0°, and its shadow deepens as it grows.
- **Holds still:** in overlaps, the hovered sticker doesn't move and its neighbours take the whole push, so it never slides out from under the pointer.
- **Timing:** moving onto a sticker focuses it straight away. Moving off waits **140ms** before unfocusing, which stops flicker when sliding between neighbours or across a gap that just opened.
- **Click:** zooms the map so the idea's real footprint fills about 60% of the screen. Later this should open the idea's detail view.

## How it's built
- **Map:** MapLibre GL 4.7.1 with the OpenFreeMap Positron basemap (light, free, no key). Map rotation is disabled.
- **Stickers are page elements, not map layers.** They sit in a layer above the map, which allows rounded corners, shadows, tilt and hover effects.
- **Same-frame updates:** stickers are positioned inside the map's own `render` event, not a separate animation loop. This removed a one-frame lag when dragging fast; measured drift is 0px.
- **Cheap positioning:** stickers move with `transform` only, never `left`/`top`, so the browser doesn't redo page layout. A sticker's style classes are only rewritten when they change.
- **Lines and dots** are drawn in one SVG layer beneath the stickers, rebuilt each frame.
- **No map queries during drawing.** MapLibre throws "Attempting to run(), but is already running" if you query it mid-draw. The water lookups (only used by the drift-to-water option) are cached on a 16px grid and filled in just after each frame.

### What each image needs (from `items.js`)
```js
{ id, title, file?, color, center: [lng, lat], wm /* width in metres at true scale */, rot /* degrees */ }
```
- The aspect ratio is read from the image itself.
- `wm` and `rot` describe the image **at true map scale**. Jostle doesn't use them for display; they're kept for:
  - ordering (bigger ideas sit underneath)
  - click-to-zoom
  - the future "lay on map at true scale" toggle
- These are the same values the editor prototype (`prototypes/c-editor.html`) produces: drop an image in, move, scale and rotate it, then export JSON.

## Known limitations
- **Mostly stand-in images.** Only the light rail long-list figure is real; the other 12 are drawn stand-ins placed roughly where the Felt images sit.
- **Only checked in a narrow pane (about 330px).** It hasn't been seen at full desktop width or on a real phone. The settings panel covers part of the map on small screens.
- **Focus needs a mouse.** On touch there's no hover, so tap-to-focus is still to design.
- **Overlap checks don't scale:** every pair of stickers is compared each frame (4 rounds). That's fine for 13 stickers, but with 100+ it needs a smarter method.
- **Rotation is ignored in overlap checks:** a tilted sticker's corners can touch its neighbours slightly.
- **Big zoom-outs:** when many ideas share a small area, "spread everything out" makes a large cloud with long lines. That hasn't been tested with a realistic number of ideas.
- **Title room assumes the label fits under the sticker.** Long titles can be wider than the sticker and touch a neighbour's title.

## Next steps to make it the real viewer
1. **Detail view:** a click opens a panel with the idea's text, sources and the full image, plus a **"Lay on map at true scale"** toggle (peel-off animation and a see-through slider, as built in `prototypes/stickers.html`).
2. **Touch:** tap to focus, tap again to open. Decide what a phone shows when it's zoomed out.
3. **Real content:** put the Felt images through the editor and give each one a title, credit and licence note.
4. **Scale up:** test with 50–100 stickers, add a spatial index for the overlap checks, and decide what happens at city-wide zoom.
5. **Move it into `index.html`**, replacing the current image pins and overlays.

## Exploration history
Everything is in `prototypes/`, roughly in order:
| File | Approach | Outcome |
|---|---|---|
| `fade.html` | Image overlay faded until hovered | Liked, but not right |
| `lens.html` | Spotlight circle reveals the overlay | Liked, but not right |
| `side.html` | Image panel beside the map with linked crosshairs | Rejected |
| `callouts.html` | Cards with leader lines, drawings drop into place | Not pursued (ink extraction dropped) |
| `a-stickers.html` | Map scale with a minimum sticker size | Liked; led to the sticker work |
| `b-tiles.html` | Same-size tiles on a honeycomb grid that grow into map scale | Not chosen |
| `c-editor.html` | Data entry: drop, move, scale, rotate, export | Keep: this is the input tool |
| `stickers.html` | Pinboard, hierarchy, die-cut and jostle styles; true scale as a detail toggle | Jostle chosen |
| **`jostle-lab.html`** | **Jostle with presets and options; focus refined** | **The golden prototype** |
