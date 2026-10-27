const { categories: CATS, ideas: IDEAS } = window.ATLAS;
const $ = id => document.getElementById(id);
const narrow = () => innerWidth <= 640;
const touchFirst = matchMedia("(hover: none)").matches;
const store = { get: k => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };

// ---------- state ----------
const state = { cats: new Set(Object.keys(CATS)), q: "", open: null, imgIdx: 0, trueScale: null };
const STICKERS = [];   // one per image: { idea, img, el, p, v, sc, rot, ... }
const bySlug = Object.fromEntries(IDEAS.map(i => [i.slug, i]));
let hovered = null, unfocusTimer = null;
const allCats = () => state.cats.size === Object.keys(CATS).length;

// ---------- filters ----------
const searchText = new Map(IDEAS.map(idea => [idea, textOf(idea)]));
function textOf(idea) { return [idea.title, descriptionOf(idea), CATS[idea.category].label, ...idea.images.map(i => i.caption)].join(" ").toLowerCase(); }
const matchesQuery = (idea, q = state.q) => !q || q.split(/\s+/).every(w => searchText.get(idea).includes(w));
const visible = idea => state.cats.has(idea.category) && matchesQuery(idea);
function renderChips() {
  const count = k => IDEAS.filter(i => i.category === k && matchesQuery(i)).length;
  $("chips").innerHTML = Object.entries(CATS).map(([k, c]) =>
    `<button class="chip${state.cats.has(k) ? "" : " off"}" data-cat="${k}" aria-pressed="${state.cats.has(k)}"
      title="${esc(c.about ? c.about + " " : "")}(${allCats() ? "Click to show only these" : state.cats.has(k) ? "Click to hide these" : "Click to also show these"})">
      <i style="background:${c.color}"></i>${esc(c.label)} <span class="n">${count(k)}</span></button>`).join("")
    + (allCats() ? "" : `<button class="chip reset" data-cat="*">Show all</button>`);
}
$("chips").onclick = e => {
  const b = e.target.closest("[data-cat]"); if (!b) return;
  const k = b.dataset.cat;
  // From "everything", a click shows just that category; after that clicks add or remove.
  if (k === "*") state.cats = new Set(Object.keys(CATS));
  else if (allCats()) state.cats = new Set([k]);
  else if (state.cats.has(k)) { state.cats.delete(k); if (!state.cats.size) state.cats = new Set(Object.keys(CATS)); }
  else state.cats.add(k);
  applyFilters();
};
function applyFilters() {
  renderChips(); listDirty = true; if ($("list").classList.contains("open")) renderList();
  if (map.getLayer("geo-line")) {
    const f = ["in", ["get", "slug"], ["literal", IDEAS.filter(visible).map(i => i.slug)]];
    ["geo-fill", "geo-hit", "geo-line", "geo-point"].forEach(id => map.setFilter(id, ["all", baseFilter[id === "geo-hit" ? "geo-line" : id], f]));
  }
  const n = IDEAS.filter(visible).length;
  if (!n) toast(state.q ? `No ideas match “${state.q}”` : "No ideas to show", "Show all", resetFilters);
  else hideToast();
  kick();
}
function resetFilters() { state.cats = new Set(Object.keys(CATS)); state.q = ""; $("search").value = ""; applyFilters(); }

// ---------- search with a results list ----------
let resultIdx = 0, results = [];
function renderResults() {
  const q = $("search").value.trim().toLowerCase();
  results = q ? IDEAS.filter(i => matchesQuery(i, q)) : [];
  resultIdx = clamp(resultIdx, 0, Math.max(0, results.length - 1));
  const box = $("results");
  box.classList.toggle("open", !!q && document.activeElement === $("search"));
  $("search").setAttribute("aria-expanded", box.classList.contains("open"));
  box.innerHTML = results.length ? results.map((i, n) => `
    <button role="option" data-slug="${i.slug}" class="${n === resultIdx ? "on" : ""}" aria-selected="${n === resultIdx}">
      <img src="${esc(imageURL(i.images[0]))}" alt="" decoding="async" loading="lazy"><b>${esc(i.title)}</b>
      <small><span style="color:${CATS[i.category].color}">●</span> ${esc(CATS[i.category].label)} · ${esc(summaryOf(i))}</small></button>`).join("")
    : `<div class="none">No ideas match. Try a place name or a word like “cycle”.</div>`;
}
$("search").oninput = e => { state.q = e.target.value.trim().toLowerCase(); resultIdx = 0; renderResults(); applyFilters(); };
$("search").onfocus = renderResults;
$("search").onblur = () => setTimeout(() => { $("results").classList.remove("open"); $("search").setAttribute("aria-expanded", "false"); }, 150);
$("search").onkeydown = e => {
  if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); resultIdx += e.key === "ArrowDown" ? 1 : -1; renderResults(); }
  else if (e.key === "Enter" && results[resultIdx]) { go(results[resultIdx].slug); $("search").blur(); }
  else if (e.key === "Escape") { if ($("search").value) { $("search").value = ""; $("search").oninput({ target: $("search") }); } else $("search").blur(); }
};
$("results").onmousedown = e => e.preventDefault();   // keep focus in the box until the click lands
$("results").onclick = e => { const b = e.target.closest("[data-slug]"); if (b) { go(b.dataset.slug); $("search").blur(); } };

// ---------- list view ----------
let listDirty = true;
function renderList() {
  if (!listDirty) return;
  listDirty = false;
  const groups = Object.entries(CATS).map(([k, c]) => [k, c, IDEAS.filter(i => i.category === k && visible(i))]).filter(g => g[2].length);
  $("list").innerHTML = groups.length ? groups.map(([k, c, ideas]) => `
    <section><h2><i style="background:${c.color}"></i>${esc(c.label)} <small>${ideas.length}</small></h2>
    <div class="cards">${ideas.map(i => `
      <button class="card" data-slug="${i.slug}" style="--c:${c.color}">
        <img src="${esc(imageURL(i.images[0]))}" alt="" loading="lazy" decoding="async">
        <div><h3>${esc(i.title)}</h3><p>${esc(summaryOf(i))}</p></div>
      </button>`).join("")}</div></section>`).join("")
    : `<div class="empty">No ideas match. <button class="chip" style="display:inline-flex" data-reset>Show all</button></div>`;
}
$("list").onclick = e => {
  if (e.target.closest("[data-reset]")) return resetFilters();
  const c = e.target.closest("[data-slug]"); if (c) { toggleList(false); go(c.dataset.slug); }
};
function toggleList(on) { $("list").classList.toggle("open", on); $("listBtn").textContent = on ? "🗺 Map" : "☰ List"; if (on) { hideIntro(); renderList(); } else kick(); }
$("listBtn").onclick = () => toggleList(!$("list").classList.contains("open"));

// ---------- welcome card and notices ----------
if (touchFirst) document.querySelectorAll(".hover-word").forEach(s => s.textContent = "Tap");
function showIntro() { $("intro").classList.add("open"); }
function hideIntro() { $("intro").classList.remove("open"); store.set("atlas-intro-seen", "1"); }
$("introGo").onclick = hideIntro;
$("aboutBtn").onclick = () => $("intro").classList.contains("open") ? hideIntro() : showIntro();
let toastTimer;
function toast(msg, action, fn, ms) {
  clearTimeout(toastTimer);
  $("toast").querySelector("span").textContent = msg;
  const b = $("toast").querySelector("button"); b.textContent = action || ""; b.onclick = () => { hideToast(); fn?.(); };
  $("toast").classList.add("open");
  if (ms) toastTimer = setTimeout(hideToast, ms);
}
const hideToast = () => $("toast").classList.remove("open");

// ---------- map ----------
const map = new maplibregl.Map({ container: "map", style: STYLE, pixelRatio: Math.min(devicePixelRatio || 1, 2), center: [174.80, -36.89], zoom: narrow() ? 10.8 : 11.6, attributionControl: { compact: true } });
map.dragRotate.disable(); map.touchZoomRotate.disableRotation();
// Keep image gestures inside MapLibre's interaction surface, so its native
// drag, wheel and touch handlers work even when a gesture starts on a picture.
map.getCanvasContainer().appendChild($("layer"));
map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-left");
addBasemapControl(map);
addTransportControl(map);
// A button that brings every visible idea back into view.
map.addControl({
  onAdd() {
    const d = document.createElement("div"); d.className = "maplibregl-ctrl maplibregl-ctrl-group";
    d.innerHTML = `<button class="home-btn" title="Show all ideas" aria-label="Show all ideas">⌂</button>`;
    d.onclick = showAll; return d;
  }, onRemove() {}
}, "bottom-left");
const kick = stickerRenderer(map, frame);
const baseFilter = {
  "geo-fill": ["==", ["geometry-type"], "Polygon"],
  "geo-line": ["any", ["==", ["geometry-type"], "LineString"], ["==", ["geometry-type"], "Polygon"]],
  "geo-point": ["==", ["geometry-type"], "Point"]
};
function showAll() {
  const ideas = IDEAS.filter(visible);
  const pts = ideas.flatMap(i => [...i.images.map(m => m.center), ...geoPoints(i.geometry)]);
  if (pts.length) map.fitBounds(boundsOf(pts), { padding: panelPadding(80), maxZoom: 14, duration: 450 });
}

function addGeometry() {
  const features = IDEAS.filter(i => i.geometry).map(i => ({ type: "Feature", geometry: i.geometry, properties: { slug: i.slug, color: CATS[i.category].color } }));
  map.addSource("geo", { type: "geojson", promoteId: "slug", data: { type: "FeatureCollection", features } });
  map.addLayer({ id: "geo-fill", type: "fill", source: "geo", filter: baseFilter["geo-fill"], paint: { "fill-color": ["get", "color"], "fill-opacity": .15 } });
  // A wide invisible line makes routes easy to hover and tap.
  map.addLayer({ id: "geo-hit", type: "line", source: "geo", filter: baseFilter["geo-line"], paint: { "line-color": "#000", "line-opacity": 0, "line-width": 16 } });
  map.addLayer({ id: "geo-line", type: "line", source: "geo", filter: baseFilter["geo-line"], layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": ["get", "color"], "line-width": ["case", ["boolean", ["feature-state", "highlight"], false], 7, 4],
      "line-opacity": ["case", ["boolean", ["feature-state", "highlight"], false], .95, ["boolean", ["feature-state", "dim"], false], .3, .55] } });
  map.addLayer({ id: "geo-point", type: "circle", source: "geo", filter: baseFilter["geo-point"], paint: { "circle-color": ["get", "color"], "circle-radius": 6, "circle-stroke-color": "#fff", "circle-stroke-width": 2 } });
  for (const id of ["geo-hit", "geo-fill", "geo-point"]) {
    // Hovering a route lifts its pictures, as hovering a picture highlights its route.
    map.on("mousemove", id, e => {
      map.getCanvas().style.cursor = "pointer";
      const idea = bySlug[e.features[0].properties.slug];
      if (!visible(idea)) return;
      const s = STICKERS.find(s => s.idea === idea && s.p);
      if (s && hovered !== s) { clearTimeout(unfocusTimer); hovered = s; kick(); }
    });
    map.on("mouseleave", id, () => { map.getCanvas().style.cursor = ""; unfocusSoon(); });
    map.on("click", id, e => { e.originalEvent.handled = true; go(e.features[0].properties.slug); });
  }
}
// Highlight the open or hovered idea's line; dim the rest when one is open.
let lastHl = null;
map.on("style.load", () => { lastHl = null; kick(); });
function highlightLines() {
  const slug = hovered?.idea.slug || state.open?.slug || "";
  if (slug === lastHl || !map.getLayer("geo-line")) return;
  lastHl = slug;
  for (const idea of IDEAS) if (idea.geometry)
    map.setFeatureState({ source: "geo", id: idea.slug }, { highlight: idea.slug === slug, dim: !!slug && idea.slug !== slug });
}
// A click on empty map unfocuses a picture first, then closes the open idea.
map.on("click", e => {
  if (e.originalEvent.handled) return;
  if (hovered) { hovered = null; kick(); }
  else if (state.open) closeIdea();
});
map.on("movestart", e => { if (e.originalEvent) hideIntro(); });

// ---------- stickers ----------
const baseSize = () => narrow() ? 62 : 84;
function unfocusSoon() { clearTimeout(unfocusTimer); unfocusTimer = setTimeout(() => { hovered = null; kick(); }, 140); }
function buildStickers() {
  for (const idea of IDEAS) idea.images.forEach((img, i) => {
    const s = makeSticker(idea, img, i, CATS[idea.category].color);
    const title = idea.images.length > 1 && img.caption ? img.caption.replace(/\s*\(stand-in\)/, "") : idea.title;
    s.el.setAttribute("role", "button"); s.el.tabIndex = 0;
    s.el.setAttribute("aria-label", `${idea.title}: ${summaryOf(idea)}`);
    s.el.innerHTML = `<img data-src="${esc(imageURL(img))}" decoding="async" alt="" draggable="false"><span class="lbl">${esc(title)}<small>${esc(summaryOf(idea))}<em>${touchFirst ? "Tap again" : "Click"} to read more</em></small></span>`;
    s.el.onpointerdown = e => {
      if (!e.isPrimary || e.button !== 0) return;
      s.pointerDragged = false;
      const gesture = new AbortController(), x = e.clientX, y = e.clientY;
      let lastX = x, lastY = y;
      // Mouse presses on focusable overlays can be consumed before MapLibre
      // receives them. Capture this pointer and pan through the public API.
      // Touch stays with MapLibre so two-finger zoom remains available.
      const pan = e.pointerType === "mouse" && map.dragPan.isEnabled();
      if (pan) {
        e.preventDefault();
        map.stop();
        s.el.setPointerCapture(e.pointerId);
      }
      const track = ev => {
        if (ev.pointerId !== e.pointerId) return;
        if (Math.hypot(ev.clientX - x, ev.clientY - y) > 4) s.pointerDragged = true;
        if (pan && s.pointerDragged) {
          map.panBy([lastX - ev.clientX, lastY - ev.clientY], { duration: 0 }, { originalEvent: ev });
          lastX = ev.clientX; lastY = ev.clientY;
        }
      };
      const finish = ev => {
        if (ev.pointerId !== e.pointerId) return;
        if (ev.type === "pointerup") track(ev);
        gesture.abort();
        if (s.el.hasPointerCapture(e.pointerId)) s.el.releasePointerCapture(e.pointerId);
      };
      window.addEventListener("pointermove", track, { signal: gesture.signal });
      window.addEventListener("pointerup", finish, { signal: gesture.signal });
      window.addEventListener("pointercancel", finish, { signal: gesture.signal });
    };
    // Mouse: entering focuses straight away; leaving waits a moment so sliding between neighbours doesn't flicker.
    s.el.onpointerenter = e => { if (e.pointerType !== "mouse") return; hovered = s; clearTimeout(unfocusTimer); kick(); };
    s.el.onpointerleave = e => { if (e.pointerType === "mouse") unfocusSoon(); };
    s.el.onfocus = () => { hovered = s; clearTimeout(unfocusTimer); kick(); };
    s.el.onblur = () => unfocusSoon();
    // Touch: first tap focuses, second tap opens.
    s.el.onpointerup = e => { s.lastPointer = e.pointerType; };
    s.el.onclick = e => {
      e.stopPropagation();
      if (s.pointerDragged && e.detail !== 0) return;
      hideIntro();
      if (s.lastPointer && s.lastPointer !== "mouse" && hovered !== s) { hovered = s; kick(); return; }
      go(idea.slug, i);
    };
    s.el.onkeydown = e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(idea.slug, i); } };
    $("layer").appendChild(s.el);
    STICKERS.push(s);
  });
}
function frame() {
  if ($("list").classList.contains("open")) return false;
  highlightLines();
  const busy = jostle(map, STICKERS, {
    base: baseSize(), hovered, ties: $("ties"),
    show: s => visible(s.idea) && state.trueScale !== s,
    style: (s) => {
      const sel = state.open === s.idea;
      if (sel && s !== hovered) s.el.style.zIndex = 50;
      s.el.classList.toggle("sel", sel);
      s.el.classList.toggle("focus", s === hovered && focusedEnough(s));
    }
  });
  return busy;
}

// ---------- detail panel ----------
function go(slug, imgIdx = 0) { location.hash = "idea/" + slug + (imgIdx ? "/" + imgIdx : ""); }
function route() {
  const m = location.hash.match(/^#idea\/([\w-]+)(?:\/(\d+))?/);
  const idea = m && bySlug[m[1]];
  if (idea) openIdea(idea, +(m[2] || 0)); else closeIdea(false);
}
window.addEventListener("hashchange", route);

function panelPadding(base = 40) {
  if (narrow()) return { top: 110, bottom: state.open ? innerHeight * .5 : base, left: 30, right: 30 };
  return { top: 80, bottom: base, left: base, right: state.open ? $("panel").offsetWidth + base : base };
}
function openIdea(idea, imgIdx) {
  const changed = state.open !== idea;
  state.open = idea; state.imgIdx = clamp(imgIdx, 0, idea.images.length - 1);
  if (state.trueScale && state.trueScale.idea !== idea) setTrueScale(null);
  hovered = null;
  hideIntro(); toggleList(false);
  document.title = idea.title + " · Atlas Tāmaki";
  renderPanel();
  if (changed) { $("panel").classList.remove("full"); $("panel").scrollTop = 0; }
  $("panel").classList.add("open"); document.body.classList.add("panel-open");
  if (changed) {
    // Frame the idea: its line or area if it has one, otherwise its images' spots. If it's already
    // in view the map stays put, and it never zooms in more than one step, so opening an idea is calm.
    const pts = [...idea.images.map(i => i.center), ...geoPoints(idea.geometry)];
    if (!inView(pts)) map.fitBounds(boundsOf(pts), { padding: panelPadding(), maxZoom: Math.min(15, map.getZoom() + 1), duration: 450 });
  }
  kick();
}
function inView(pts) {
  const pad = panelPadding(), w = map.getContainer().clientWidth, h = map.getContainer().clientHeight;
  return pts.every(p => { const q = map.project(p); return q.x > pad.left && q.x < w - pad.right && q.y > pad.top && q.y < h - pad.bottom; });
}
function closeIdea(updateHash = true) {
  if (!state.open) return;
  setTrueScale(null);
  state.open = null;
  document.title = "Atlas Tāmaki";
  $("panel").classList.remove("open", "full"); document.body.classList.remove("panel-open");
  if (updateHash) history.pushState(null, "", location.pathname + location.search);
  kick();
}

function renderPanel() {
  const idea = state.open, cat = CATS[idea.category], img = idea.images[state.imgIdx];
  const on = state.trueScale?.img === img;
  // Previous and next follow the order of the list view, within the current filters.
  const order = Object.keys(CATS).flatMap(k => IDEAS.filter(i => i.category === k && visible(i)));
  const at = order.indexOf(idea), prev = at > 0 ? order[at - 1] : null, next = at >= 0 && at < order.length - 1 ? order[at + 1] : null;
  $("panelInner").innerHTML = `
    <div class="ptop"><button id="shareBtn" title="Share this idea">Share</button><button class="x" aria-label="Close" title="Close (Esc)">×</button></div>
    <div class="inner">
    <span class="cat"><i style="background:${cat.color}"></i>${esc(cat.label)}</span>
    <h1>${esc(idea.title)}</h1>
    ${img ? `<figure class="hero">${imageTag(img, "display", `alt="${esc(img.caption)}" width="${Math.round(img.aspect * 320)}" height="320" style="height:auto"`)}<button class="zoom" aria-label="View full size">⤢ Full size</button>
      <figcaption>${esc(img.caption)}${img.credit ? ` · Credit: ${esc(img.credit)}` : ""}</figcaption></figure>` : ""}
    ${idea.images.length > 1 ? `<div class="thumbs">${idea.images.map((im, i) =>
      `<button class="${i === state.imgIdx ? "on" : ""}" data-img="${i}" aria-label="${esc(im.caption)}">${imageTag(im, "thumb", 'alt="" loading="lazy"')}</button>`).join("")}</div>` : ""}
    ${img ? `<div class="truescale${on ? " on" : ""}">
      <label class="switch"><input type="checkbox" id="tsToggle"${on ? " checked" : ""}> Line it up with the streets</label>
      <p>Lays this picture on the map at its real size and angle.</p>
      <label class="op">See-through <input id="tsOpacity" type="range" min="0.1" max="1" step="0.05" value="${state.trueScale?.opacity ?? .85}"></label>
    </div>` : ""}
    <div class="desc">${descriptionOf(idea).split(/\n\s*\n/).filter(t => t.trim()).map(t => `<p>${esc(t.trim())}</p>`).join("")}</div>
    ${idea.sources?.length ? `<h2>Sources</h2><ul class="sources">${idea.sources.map(s => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a></li>`).join("")}</ul>` : ""}
    <nav class="pager">
      ${prev ? `<button data-go="${prev.slug}"><small>← Previous</small><span>${esc(prev.title)}</span></button>` : ""}
      ${next ? `<button class="next" data-go="${next.slug}"><small>Next →</small><span>${esc(next.title)}</span></button>` : ""}
    </nav>
    </div>`;
}
$("panelInner").onclick = e => {
  if (e.target.closest(".x")) return closeIdea();
  if (e.target.closest("#shareBtn")) return share();
  const t = e.target.closest("[data-img]");
  if (t) { go(state.open.slug, +t.dataset.img); return; }
  const g = e.target.closest("[data-go]");
  if (g) { go(g.dataset.go); return; }
  if (e.target.matches(".hero img, .hero .zoom")) {
    const img = state.open.images[state.imgIdx];
    $("lightbox").querySelector("img").src = img.src;
    $("lightbox").querySelector("p").textContent = [img.caption, img.credit && "Credit: " + img.credit].filter(Boolean).join(" · ");
    $("lightbox").classList.add("open");
  }
};
$("panelInner").onchange = e => {
  if (e.target.id === "tsToggle") { const img = state.open.images[state.imgIdx]; setTrueScale(e.target.checked ? img : null); renderPanel(); }
};
$("panelInner").oninput = e => {
  if (e.target.id === "tsOpacity" && state.trueScale) { state.trueScale.opacity = +e.target.value; map.setPaintProperty("truescale", "raster-opacity", +e.target.value); }
};
// Phone sheet: tapping the handle, or scrolling the text, opens it fully.
document.querySelector(".handle").onclick = () => $("panel").classList.toggle("full");
$("panel").addEventListener("scroll", () => { if (narrow() && $("panel").scrollTop > 10) $("panel").classList.add("full"); }, { passive: true });

async function share() {
  const idea = state.open, url = location.href;
  if (navigator.share && touchFirst) { try { await navigator.share({ title: idea.title, text: summaryOf(idea), url }); } catch {} return; }
  try { await navigator.clipboard.writeText(url); toast("Link copied", null, null, 2000); }
  catch { toast(url, null, null, 5000); }
}
$("lightbox").onclick = () => $("lightbox").classList.remove("open");
document.addEventListener("keydown", e => {
  if (e.key !== "Escape" || e.target === $("search")) return;
  if ($("lightbox").classList.contains("open")) $("lightbox").classList.remove("open");
  else if ($("intro").classList.contains("open")) hideIntro();
  else if (state.open) closeIdea();
  else if ($("list").classList.contains("open")) toggleList(false);
});

// True scale: the drawing lined up with the ground, replacing its sticker until switched back.
function setTrueScale(img) {
  if (map.getLayer("truescale")) map.removeLayer("truescale");
  if (map.getSource("truescale")) map.removeSource("truescale");
  if (!img) { state.trueScale = null; kick(); return; }
  const c = corners(img), opacity = state.trueScale?.opacity ?? .85;
  map.addSource("truescale", { type: "image", url: imageURL(img, "map"), coordinates: c });
  map.addLayer({ id: "truescale", type: "raster", source: "truescale", paint: { "raster-opacity": opacity, "raster-fade-duration": 0 } }, "geo-fill");
  state.trueScale = STICKERS.find(s => s.img === img);
  state.trueScale.opacity = opacity;
  map.fitBounds(boundsOf(c), { padding: panelPadding(), duration: 450 });
  kick();
}

// ---------- start ----------
renderChips();
loadImages(IDEAS, CATS).then(() => {
  buildStickers();
  whenStyleReady(map, () => {
    addGeometry(); applyFilters(); route();
    $("loading").remove();
    if (!store.get("atlas-intro-seen") && !state.open) showIntro();
  });
});
addEventListener("resize", kick);
