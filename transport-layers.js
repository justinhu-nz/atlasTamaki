// Reference infrastructure, independent of picture categories and background labels.
function addTransportControl(map) {
  let visible = true;
  try { visible = localStorage.getItem("atlas-railways") !== "false"; } catch {}
  const layerIds = ["transport-rail-halo", "transport-rail-line", "transport-rail-sleepers"];
  const visibility = () => visible ? "visible" : "none";
  const control = {
    onAdd() {
      const box = document.createElement("div");
      box.className = "maplibregl-ctrl transport-control";
      box.innerHTML = `<details><summary>☷ Transport layers</summary>
        <label><input type="checkbox"${visible ? " checked" : ""}><span class="rail-key" aria-hidden="true"></span>Physical railway tracks</label>
        <p>Swanson–Pukekohe<br>Main tracks, loops and yards</p>
        <a href="https://kiwirail.maps.arcgis.com/home/item.html?id=13d266cb6dd141879daa76d993e2b0cc" target="_blank" rel="noopener">KiwiRail · CC BY 4.0 ↗</a>
      </details>`;
      box.querySelector("input").addEventListener("change", e => {
        visible = e.target.checked;
        try { localStorage.setItem("atlas-railways", String(visible)); } catch {}
        for (const id of layerIds) if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", visibility());
      });
      this.box = box;
      return box;
    },
    onRemove() { this.box.remove(); }
  };
  map.addControl(control, "bottom-right");
  whenStyleReady(map, () => {
    map.addSource("transport-railways", { type: "geojson", data: window.ATLAS_RAILWAYS,
      attribution: '<a href="https://kiwirail.maps.arcgis.com/home/item.html?id=13d266cb6dd141879daa76d993e2b0cc">Railway tracks © KiwiRail · CC BY 4.0</a>' });
    const before = map.getStyle().layers.find(layer => layer.id.startsWith("geo-") || layer.id === "truescale")?.id;
    const width = ["interpolate", ["linear"], ["zoom"], 8, .8, 11, 1.4, 14, 1.8, 18, 2.5];
    for (const layer of [
      { id: layerIds[0], paint: { "line-color": "#fff", "line-opacity": .8,
        "line-width": ["interpolate", ["linear"], ["zoom"], 8, 2, 11, 3, 14, 4, 18, 5] } },
      { id: layerIds[1], paint: { "line-color": "#283745", "line-width": width } },
      { id: layerIds[2], minzoom: 13, paint: { "line-color": "#f6f8fa", "line-width": 1,
        "line-dasharray": [2, 6] } }
    ]) map.addLayer({ type: "line", source: "transport-railways", ...layer,
      layout: { "line-cap": "butt", "line-join": "round", visibility: visibility() } }, before);
  });
  // A background switch preserves the layers; apply the latest toggle value
  // if it changed while the replacement style was loading.
  map.on("style.load", () => {
    for (const id of layerIds) if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", visibility());
  });
}
