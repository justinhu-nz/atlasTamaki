# Atlas Tāmaki: brief

## What it is
A curated map of Auckland's best urbanism and transit ideas, all in one place. For each idea: what it is, why it matters, and sources. It's not a voting board and not a project tracker.

## Requirements
- **Map-first and image-led**, like the current Felt map: renders, photos and plan drawings placed where each idea happens.
- **Covers** rapid transit, buses & ferries, cycling & walking, and streets & places.
- **For the public and advocates:** a short summary first, with detail and sources one click deeper.
- **No status or progress tracking.**
- **Works well on phones.**
- **Simple to start:** a static HTML site, free to host.
- **Easy for me to edit later:** draw lines, place images and write text without editing code.

## How content comes in
- **Mostly images, not data.** Ideas come from council reports, business cases, AT documents and advocacy blogs. They arrive as renders, screenshots of report maps, plan drawings and photos, not as GIS files or clean line data.
- **The image is often the only source of the geography.** A route option or junction layout may exist only as a picture in a PDF.
- **So I usually enter an idea by dropping its image over the map** at the right place and scale, like the current Felt map, then adding text and sources. I trace lines only sometimes, if at all.
- **The images vary a lot:** different styles, scales, angles and legends, some with their own basemap, and some not to scale or not north-up.
- **The tool has to make that workflow fast:** drop an image in, roughly position, scale and rotate it, add a caption and credit, done.
- **And the result has to look good.** The image might be shown at map scale (lined up with the ground) or in some other attractive form. Either way, many ideas need to stay readable together and scale sensibly as you zoom, without cluttering or covering each other.

## Image types
- **Pictures:** photos, renders, diagrams. They belong roughly at a location.
- **Plan drawings:** junction redesigns, corridor sketches, report maps. They belong lined up with the real streets, sometimes rotated, and range from a few hundred metres to 10+ km.

## Limitations / problems to solve
- **Felt's way of placing images doesn't work well:**
  - Images cover the streets they're about.
  - They shrink to unreadable when zoomed out and grow huge when zoomed in.
  - They overlap each other with no order.
- **Report figures** come with their own legend, caption and basemap, so they clash with the map.
- **Lining drawings up by hand is rough:** some aren't to scale or north-up.
- **Felt free plan:** no export, so everything has to be re-entered.
- **Image rights:** advocacy renders need credit and may need permission.
- **No automatic image processing:** no colour removal (ink extraction). Images show as they are, apart from cropping.

## Tried so far
- **Rejected:** a side panel with the image beside the map.
- **Closest but still not right:** fading images until hovered, and a lens/spotlight.
- **Unresolved:** the right way to show big image overlays.

## Open questions
- Name and web address?
- Can the public suggest ideas?
- Include past or cancelled ideas?
