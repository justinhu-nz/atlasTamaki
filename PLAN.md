# Atlas Tāmaki: plan

A curated map of the best urbanism and transit ideas for Auckland, all in one place. It isn't a voting board or a project tracker. Each idea gets a clear, sourced explanation of what it involves and why it matters.

## Requirements (as agreed)
- **Audience:** both the public and advocates. A simple summary comes first, and the detail and sources sit one click deeper.
- **Scope:** rapid transit, buses and ferries, cycling and walking, streets and places.
- **No status tracking.** Delivery stage isn't the point. A link to the source says where an idea came from.
- **Editing:** you, through an admin UI where you draw on the map and fill in a form. No file editing.
- **Felt:** free plan, so no export. Proposals get redrawn or traced in the new admin UI (one-off migration).

## What a visitor sees
1. **Full-screen map** of Auckland. Lines, areas and points are coloured by category.
2. **Category toggles** (Rapid transit / Buses & ferries / Cycling & walking / Streets & places) and a search box.
3. **Click a feature → side panel** (a bottom sheet on mobile):
   - Layer 1: title, one-line pitch, hero image, a "what it is" paragraph, a "why it matters" paragraph.
   - Layer 2 (expand): details such as length, stations, est. cost, who's proposed it, related ideas, and a list of sources with links.
4. **List view**: the same ideas as cards, for people who'd rather read than pan.
5. **Shareable URL per idea** (`/idea/airport-light-rail`).

## Images on the map (from the current Felt map)
On the Felt map, the renders and photos themselves are the map content, pinned where each idea would happen. Keep that, and fix what breaks at scale:
- **Image pins:** each idea can have one or more images, each anchored to a point. They show as photo cards on the map, the way they do in Felt now.
- **Scales with zoom:** at city zoom, images shrink to small rounded thumbnails, and nearby ones collapse into a stack ("+3"). Zooming in grows them to full cards. This stops images covering each other and the base map, like they do around the city centre.
- **Image and line together:** hovering or clicking an image highlights the idea's line or area and opens its panel. Hovering a line lifts its images.
- **Captions and credits:** every image has a caption and a source credit (AT, Greater Auckland, etc.). This matters for renders you didn't make.
- **Two kinds of image.** Some images are separate from the map's geography: renders, photos, network diagrams. Those are *pins*, as described above. Others are drawings of the place itself, such as aerial mock-ups of an interchange redesign or a sketched corridor plan. Those are *overlays*: the image is stretched, rotated and scaled to fit the real ground, so it grows and shrinks with the map like a layer.
  - Overlays are stored with four corner coordinates. MapLibre's image source supports this natively, so a rotated or skewed image works.
  - Each overlay has an opacity slider, and visitors can turn it on/off or fade it to compare with today's streets. A before/after swipe could come later.
  - Overlays hide at city zoom (they're unreadable small) and appear once the area is zoomed in. At city zoom, a small outline or thumbnail marks the spot.
  - Admin: place the image roughly, then drag its corners, rotate and scale it to line up with streets. Show it half-transparent while lining it up. For precise matching, add optional "click 3 matching points" georeferencing.
- **Muted base map:** keep the soft, light basemap so the colourful images stand out.

## Data model (one record per idea)
| field | notes |
|---|---|
| slug, title, pitch | pitch is one sentence |
| category | one of the four |
| geometry | line / polygon / point(s), can have several parts |
| what_it_is, why_it_matters | short markdown |
| details | optional key–value pairs (length, cost, frequency…) |
| proposed_by | e.g. Greater Auckland, AT, council report |
| sources | list of {title, url} |
| images | list of {file, kind: pin \| overlay, anchor point (pin) or 4 corners (overlay), default opacity, caption, credit} |
| related | links to other ideas |
| published | draft/live toggle |

## Admin UI (/admin, only you can sign in)
- Map with drawing tools: draw or edit lines, polygons and points, and snap to roads where useful.
- Form beside the map for every field above, with a markdown editor and an image upload.
- Draft / publish toggle, so work-in-progress stays hidden.
- Optional: put the Felt map side by side or as a translucent overlay so tracing is quick.

## Recommended stack
- **Map:** MapLibre GL JS + a free vector basemap (Protomaps or MapTiler free tier). Carto Positron-style muted base so the proposals stand out.
- **Drawing:** Terra Draw (works with MapLibre).
- **App:** a single SvelteKit or Next.js app with the public site and `/admin`.
- **Data + auth + images:** Supabase free tier (Postgres + PostGIS, email login, storage). An alternative is Cloudflare Workers + D1 + R2, which also costs nothing.
- **Hosting:** Vercel / Cloudflare Pages, free.

## Build phases
1. **Skeleton:** map, four category layers, hard-coded sample ideas, side panel.
2. **Backend + admin:** database, login, draw/edit/publish flow.
3. **Content:** migrate your Felt proposals, and I can draft research for the starter set (airport light rail, Northwest busway, isthmus cycleways, city centre laneways, New Network bus frequencies, ferries) for you to review.
4. **Polish:** list view, search, share links, mobile bottom sheet, social preview images.

## Open questions
- Domain or name? ("Atlas Tāmaki" is the folder name.)
- Should visitors be able to suggest an idea (a form that lands in your drafts), or not at all?
- Show cancelled or historical proposals (e.g. the old CC2M light rail) as a separate "past ideas" layer?
