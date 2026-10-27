# Physical railway tracks

`railways.geojson` is a local snapshot of [KiwiRail Track Centreline](https://kiwirail.maps.arcgis.com/home/item.html?id=13d266cb6dd141879daa76d993e2b0cc), retrieved on 26 October 2026. Copyright KiwiRail; licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

The source depicts individual main tracks, yard tracks, loops, links and crossovers. It excludes private sidings. Its geometry is for mapping, not engineering design. This snapshot does not assert that every depicted asset is in passenger service.

The Auckland extract is cut at the Swanson station longitude (174.57630) and Pukekohe station latitude (-37.20331), with the station anchors checked against [AT GTFS](https://gtfs.at.govt.nz/gtfs.zip). The cut passes through each station precinct rather than following a council boundary. Other bounds are 175.1 east and -36.80 north. Records explicitly classified DISPOSE or MOTHBALL, and the Mission Bush branch outside the metro corridor, are excluded.

Geometry is clipped by segment interpolation, simplified to 0.6 metres and rounded to six decimal places. There are 331 retained source features and 3,752 coordinates. `railways.js` wraps the same data for script loading so the app can also open from disk.

Refresh both files with `python3 scripts/update-railways.py`. No API key is required. Review the cutoffs and source metadata when refreshing; asset data and station layouts can change.
