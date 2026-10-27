// Shared bits for the overlay UX prototypes.
const STYLE = "https://tiles.openfreemap.org/styles/positron";
const OVERLAY = {
  url: "../images/alr-long-list.webp",
  // [top-left, top-right, bottom-right, bottom-left] as [lng, lat]
  corners: [[174.7284,-36.9061],[174.8135,-36.9061],[174.8135,-37.0085],[174.7284,-37.0085]],
  caption: "Fig 6.3: long list light rail alignment options"
};
const VIEW = { center: [174.775, -36.955], zoom: 12.3 };

// Figure is north-up, so pixel <-> lng/lat is linear.
const W = OVERLAY.corners[0][0], E = OVERLAY.corners[1][0];
const N = OVERLAY.corners[0][1], S = OVERLAY.corners[2][1];
const toLngLat = (fx, fy) => [W + fx * (E - W), N + fy * (S - N)];        // fx,fy in 0..1
const toFrac = ([lng, lat]) => [(lng - W) / (E - W), (lat - N) / (S - N)];
const inside = ([fx, fy]) => fx >= 0 && fx <= 1 && fy >= 0 && fy <= 1;

function addOverlay(map, opacity) {
  map.addSource("ov", { type: "image", url: OVERLAY.url, coordinates: OVERLAY.corners });
  map.addLayer({ id: "ov", type: "raster", source: "ov",
    paint: { "raster-opacity": opacity, "raster-fade-duration": 0, "raster-opacity-transition": { duration: 250 } } });
}
function addOutline(map) {
  map.addSource("ov-outline", { type: "geojson", data: { type: "Feature",
    geometry: { type: "Polygon", coordinates: [[...OVERLAY.corners, OVERLAY.corners[0]]] } } });
  map.addLayer({ id: "ov-outline", type: "line", source: "ov-outline",
    paint: { "line-color": "#d6336c", "line-width": 2, "line-dasharray": [2, 2] } });
}
