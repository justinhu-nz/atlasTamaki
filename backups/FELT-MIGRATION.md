# Felt migration

Source: https://felt.com/map/Better-Public-Transport-in-Auckland-zVsTZyUzQICmR9BS5SiwixD

Migrated through Microsoft Edge computer use and the Atlas editor on 25 October 2026.

- Original sample data: `ideas.before-felt-migration.js`.
- All 28 original placed images are represented once in `ideas.js`, with local image files.
- Titles, categories, captions and short descriptions were added from visual inspection. These are editorial descriptions, not original Felt captions; the source elements had no attached descriptions.
- Original creators were not identified by the source map. Credits explicitly say so and every idea links to Felt.
- Numeric placement fields were added to `editor.html` with the user’s approval, then used through its UI for all images.
- Image widths and rotations match the recovered Felt values exactly. Stored centres differ by at most 0.064 m because the editor saves six decimal places.
- `felt-image-manifest.json` preserves recovered image IDs, URLs, centres, widths and rotations; `felt-elements.json` preserves the original placed image polygons.
- `felt-downloads/` contains the pages and image files saved through Edge. The active images were uploaded separately through the editor into `images/`.
- The public viewer loads all 28 images and category counts correctly. Source links and the true-scale overlay control were observed in the detail panel.

## Remaining difference

Felt’s separate OpenStreetMap railway tracks/stations reference layer was not imported. Atlas keeps its existing OpenFreeMap basemap and sticker presentation.
