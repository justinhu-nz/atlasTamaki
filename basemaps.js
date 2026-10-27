// Background maps shared by the public map and editor.
const BASEMAPS = {
  light: { label: "Light", style: "positron" },
  streets: { label: "Streets", style: "liberty" },
  bright: { label: "Colour", style: "bright" },
  dark: { label: "Dark", style: "dark" },
  satellite: { label: "Satellite", aerial: true }
};
const basemapPreference = {
  get() { try { const id = localStorage.getItem("atlas-basemap") || "light"; return id === "linz" ? "satellite" : id; } catch { return "light"; } },
  set(id) { try { localStorage.setItem("atlas-basemap", id); } catch {} }
};
async function basemapStyle(id) {
  const choice = BASEMAPS[id];
  if (!choice) throw new Error("Unknown background map");
  const response = await fetch(`https://tiles.openfreemap.org/styles/${choice.style || "positron"}`, { signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw new Error("Background map unavailable");
  const style = await response.json();
  if (id === "dark") {
    style.layers = style.layers.map(layer => layer.type === "symbol" && layer.layout?.["text-field"] ? {
      ...layer, paint: { ...layer.paint, "text-color": "#b4bfca", "text-halo-color": "#171b20", "text-halo-width": 1.2 }
    } : layer);
  }
  if (choice.aerial) {
    style.sources["atlas-aerial"] = {
      type: "raster", tileSize: 256, maxzoom: 19,
      tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
      attribution: 'Imagery © <a href="https://www.esri.com/">Esri</a>, Maxar, Earthstar Geographics, and the GIS User Community'
    };
    // Retain place and street labels above the photographs for orientation.
    style.layers = [
      { id: "atlas-aerial-background", type: "background", paint: { "background-color": "#15242b" } },
      { id: "atlas-aerial", type: "raster", source: "atlas-aerial", paint: { "raster-fade-duration": 150 } },
      ...style.layers.filter(layer => layer.type === "symbol").map(layer => ({
        ...layer, paint: { ...layer.paint, "text-color": "#fff", "text-halo-color": "#25302e", "text-halo-width": 1.4 }
      }))
    ];
  }
  return style;
}
// Carry the app's routes, filters and real-size image through a style replacement.
// Event handlers and DOM picture elements remain attached to the same map.
function withIdeaLayers(style, current) {
  const overlays = (current.layers || []).filter(layer => layer.id.startsWith("geo-") || layer.id.startsWith("transport-") || layer.id === "truescale");
  const sources = Object.fromEntries(Object.entries(current.sources || {}).filter(([id]) => id === "geo" || id.startsWith("transport-") || id === "truescale"));
  return { ...style, sources: { ...style.sources, ...sources }, layers: [...style.layers, ...overlays] };
}
const basemapLabels = style => style.layers.filter(layer => layer.type === "symbol" && !layer.id.startsWith("geo-") && layer.id !== "truescale");
const labelDefaults = style => new Map(basemapLabels(style).map(layer => [layer.id, layer.layout?.visibility || "visible"]));
function applyBasemapLabels(map, visible, defaults) {
  for (const layer of basemapLabels(map.getStyle()))
    map.setLayoutProperty(layer.id, "visibility", visible ? defaults.get(layer.id) || "visible" : "none");
}
function addBasemapControl(map) {
  const control = {
    onAdd() {
      const box = document.createElement("div");
      box.className = "maplibregl-ctrl basemap-control";
      box.innerHTML = `<details><summary>▧ <span>Map style</span></summary><fieldset><legend>Background map</legend>${Object.entries(BASEMAPS).map(([id, choice]) =>
        `<label><input type="radio" name="basemap" value="${id}"${id === "light" ? " checked" : ""}><i class="basemap-swatch ${id}"></i><span>${choice.label}</span></label>`).join("")}</fieldset><label class="basemap-labels"><input type="checkbox" checked>Show map labels</label><p class="basemap-status" role="status" hidden></p></details>`;
      const details = box.querySelector("details"), fieldset = box.querySelector("fieldset"), status = box.querySelector(".basemap-status");
      const labels = box.querySelector('input[type="checkbox"]');
      try { labels.checked = localStorage.getItem("atlas-map-labels") !== "false"; } catch {}
      let defaults = new Map();
      let active = "light", loading = false;
      const imageryError = e => {
        if (e.sourceId !== "atlas-aerial") return;
        status.hidden = false; status.textContent = "Imagery couldn’t load. Try another map style."; details.open = true;
      };
      map.on("error", imageryError);
      this.removeError = () => map.off("error", imageryError);
      const check = id => box.querySelector(`input[value="${id}"]`).checked = true;
      const change = async id => {
        if (loading || id === active || !BASEMAPS[id]) return;
        loading = true; fieldset.disabled = true; status.hidden = false; status.textContent = "Loading map…";
        let previous, loaded, timeout, previousDefaults = defaults;
        try {
          const style = await basemapStyle(id);
          defaults = labelDefaults(style);
          previous = map.getStyle();
          const ready = new Promise((resolve, reject) => {
            loaded = resolve; map.once("style.load", loaded);
            timeout = setTimeout(() => reject(new Error("Map load timed out")), 15000);
          });
          map.setStyle(withIdeaLayers(style, previous), { diff: false });
          await ready;
          applyBasemapLabels(map, labels.checked, defaults);
          active = id; check(id); basemapPreference.set(id);
          status.hidden = true; details.open = false;
        } catch (error) {
          defaults = previousDefaults;
          if (previous) map.setStyle(previous, { diff: false });
          check(active); status.textContent = "Couldn’t load this map. Please try again.";
        } finally {
          clearTimeout(timeout); if (loaded) map.off("style.load", loaded);
          loading = false; fieldset.disabled = false;
        }
      };
      box.addEventListener("change", e => {
        if (e.target === labels) {
          try { localStorage.setItem("atlas-map-labels", String(labels.checked)); } catch {}
          if (!loading && defaults.size) applyBasemapLabels(map, labels.checked, defaults);
        } else if (e.target.matches('input[type="radio"]')) change(e.target.value);
      });
      whenStyleReady(map, () => {
        defaults = labelDefaults(map.getStyle());
        applyBasemapLabels(map, labels.checked, defaults);
        change(basemapPreference.get());
      });
      this.box = box;
      return box;
    },
    onRemove() { this.removeError?.(); this.box.remove(); }
  };
  map.addControl(control, "bottom-right");
}
