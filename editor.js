const $ = id => document.getElementById(id);
const DATA = window.ATLAS, CATS = DATA.categories, IDEAS = DATA.ideas;
const EL = new Map();                  // picture -> its element on the map
let cur = null, curImg = null, dirty = false, server = false, draw = null, keySeq = 0, listQuery = "";
// Every idea gets a private key that survives undo. Existing ideas keep their web address when retitled, so shared links don't break.
IDEAS.forEach(i => {
  i._key = ++keySeq; i._slugEdited = true;
  // Older entries split the text into pitch / what it is / why it matters: fold them into one description.
  i.description = descriptionOf(i);
  delete i.pitch; delete i.what_it_is; delete i.why_it_matters;
});
const isStandIn = img => !img.file;
const label = idea => idea.title.trim() || "Untitled idea";

const map = new maplibregl.Map({ container: "map", style: STYLE, pixelRatio: Math.min(devicePixelRatio || 1, 2), center: [174.80, -36.89], zoom: 11.6 });
map.dragRotate.disable(); map.touchZoomRotate.disableRotation();
map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-left");
addBasemapControl(map);
addTransportControl(map);

// ---------- undo and redo ----------
// Each step stores a copy of every idea, so any change (text, placement, routes, adding or removing) can be undone.
const undoStack = [], redoStack = [];
let lastCp = { key: null, t: 0 };
const snap = () => ({ ideas: structuredClone(IDEAS), curKey: cur?._key, imgIdx: cur && curImg ? cur.images.indexOf(curImg) : -1 });
// Call before changing anything. Repeated changes of the same kind (typing in one field, nudging) merge into one step.
function checkpoint(key = null) {
  const now = Date.now();
  if (key && key === lastCp.key && now - lastCp.t < 1500) { lastCp.t = now; return; }
  lastCp = { key, t: now };
  undoStack.push(snap()); if (undoStack.length > 150) undoStack.shift();
  redoStack.length = 0; renderUndo();
}
function undo() { if (undoStack.length) { redoStack.push(snap()); applySnap(undoStack.pop()); } }
function redo() { if (redoStack.length) { undoStack.push(snap()); applySnap(redoStack.pop()); } }
function applySnap(s) {
  IDEAS.splice(0, IDEAS.length, ...s.ideas);
  for (const el of EL.values()) el.remove();
  EL.clear(); STICKERS.length = 0; hovered = null;
  for (const idea of IDEAS) for (const img of idea.images) addEl(idea, img);
  cur = IDEAS.find(i => i._key === s.curKey) || null;
  curImg = cur && s.imgIdx >= 0 ? cur.images[s.imgIdx] || null : null;
  if (!curImg) lining = false;
  lastCp = { key: null, t: 0 };
  setDraw(null); markDirty(); renderSide(); render(); renderGeo(); renderUndo();
}
function renderUndo() { $("undo").disabled = !undoStack.length; $("redo").disabled = !redoStack.length; }

// ---------- pictures on the map ----------
// Pictures are stickers placed exactly as on the public map (the shared jostle in atlas.js). Clicking
// one selects it and dragging one moves its spot. "Line up at real size" switches to that one picture
// laid on the map at its true size and angle, with handles, until Done.
const STICKERS = [];
let hovered = null, unfocusTimer = null, dragging = null, lining = false, savedView = null;
const stickerSize = () => innerWidth <= 760 ? 62 : 84;
const kick = stickerRenderer(map, frame);
function render() { kick(); renderOverlays(); }
function addEl(idea, img) {
  const s = makeSticker(idea, img, idea.images.indexOf(img), CATS[idea.category]?.color || "#888");
  s.el.innerHTML = `<img data-src="${esc(imageURL(img))}" decoding="async" alt=""><span class="lbl">${esc(label(idea))}</span>`;
  // Hover focus, as on the public map: entering focuses at once, leaving waits a moment so it doesn't flicker.
  s.el.onpointerenter = e => { if (e.pointerType === "mouse" && !dragging) { clearTimeout(unfocusTimer); hovered = s; kick(); } };
  s.el.onpointerleave = e => { if (e.pointerType === "mouse" && !dragging) { clearTimeout(unfocusTimer); unfocusTimer = setTimeout(() => { if (hovered === s) hovered = null; kick(); }, 140); } };
  s.el.addEventListener("pointerdown", e => { if (e.button === 0) stickerPress(e, s); });
  $("layer").appendChild(s.el);
  STICKERS.push(s); EL.set(img, s.el);
}
function removeEl(img) {
  EL.get(img)?.remove(); EL.delete(img);
  const i = STICKERS.findIndex(s => s.img === img); if (i >= 0) STICKERS.splice(i, 1);
  if (hovered?.img === img) hovered = null;
}
// Keep stickers' labels and colours in step with their idea.
function refreshStickers(idea) {
  for (const s of STICKERS) if (s.idea === idea) { s.el.querySelector(".lbl").textContent = label(idea); s.el.style.setProperty("--c", CATS[idea.category]?.color || "#888"); }
}
function frame() {
  const busy = jostle(map, STICKERS, {
    base: stickerSize(), hovered, ties: $("ties"),
    show: () => !lining,
    style: s => {
      const sel = s.img === curImg;
      s.el.classList.toggle("sel", sel);
      s.el.style.opacity = cur && s.idea !== cur ? .55 : 1;
      s.el.style.cursor = s.idea === cur ? "grab" : "pointer";
      if (sel && s !== hovered) s.el.style.zIndex = 55;
    }
  });
  drawLineUp();
  return busy;
}
// Pressing a sticker: a click selects it (and its idea); dragging one of the current idea's stickers moves its spot.
// While dragging, the sticker rides along with its spot, so it stays under the pointer.
function stickerPress(e, s) {
  e.preventDefault(); e.stopPropagation();
  const x0 = e.clientX, y0 = e.clientY, c0 = map.project(s.img.center), canMove = s.idea === cur && !draw;
  let moved = false;
  map.dragPan.disable();
  const move = ev => {
    if (!canMove || (!moved && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 4)) return;
    if (!moved) { checkpoint(); moved = true; dragging = hovered = s; }
    const ll = map.unproject([c0.x + ev.clientX - x0, c0.y + ev.clientY - y0]);
    s.img.center = [ll.lng, ll.lat];
    markDirty(); kick();
  };
  const up = () => {
    removeEventListener("pointermove", move); removeEventListener("pointerup", up); map.dragPan.enable();
    dragging = null;
    if (moved) { if (curImg !== s.img) selectImg(s.img); return; }
    if (cur !== s.idea) select(s.idea);
    selectImg(s.img);
  };
  addEventListener("pointermove", move); addEventListener("pointerup", up);
}

// ---------- real-size line-up ----------
// One picture laid on the map at its true size and angle. Handles move, resize and turn it. A pinned
// point stays fixed while resizing and turning, and "Match 2 points" lines it up from two landmarks.
const lineEl = document.createElement("div");
lineEl.className = "im sel"; lineEl.hidden = true;
lineEl.innerHTML = `<img alt=""><span class="stick"></span><span class="h rot" title="Drag to turn freely; hold Shift to snap to right angles"></span>
  <span class="h scale nw" title="Drag to resize"></span><span class="h scale ne" title="Drag to resize"></span>
  <span class="h scale se" title="Drag to resize"></span><span class="h scale sw" title="Drag to resize"></span>
  <span class="pin" title="Pinned point: resizing and turning keep this spot fixed"></span><span class="mdot" data-n="1"></span><span class="mdot" data-n="2"></span>`;
$("layer").appendChild(lineEl);
const mapDots = document.createElement("div"); mapDots.id = "mapDots"; $("layer").appendChild(mapDots);
let pin = null;          // {u, v}: a point on the picture, as fractions from its middle (-0.5 to 0.5)
let pinMode = false;     // the next click on the picture places the pin
let match = null;        // Match 2 points: { step: 1-4, a1, m1, a2 }
let peek = false, blend = false;

// Where the picture sits on screen, and conversions between screen pixels and points on the picture.
function geom(img) {
  const c = map.project(img.center), mpp = metresPerPx(img.center[1], map.getZoom());
  return { c, w: img.wm / mpp, h: heightM(img) / mpp, r: (img.rot || 0) * Math.PI / 180 };
}
const toScreen = (g, u, v) => { const x = u * g.w, y = v * g.h; return { x: g.c.x + x * Math.cos(g.r) - y * Math.sin(g.r), y: g.c.y + x * Math.sin(g.r) + y * Math.cos(g.r) }; };
const toPicture = (g, px, py) => { const dx = px - g.c.x, dy = py - g.c.y; return { u: (dx * Math.cos(g.r) + dy * Math.sin(g.r)) / g.w, v: (-dx * Math.sin(g.r) + dy * Math.cos(g.r)) / g.h }; };
const mapPoint = e => { const box = $("map").getBoundingClientRect(); return { x: e.clientX - box.left, y: e.clientY - box.top }; };
const normRot = r => Math.round(((((r + 180) % 360 + 360) % 360) - 180) * 1000) / 1000;
// Resize by k and turn to rot while the picture point (u, v) stays where it is on the map.
function transformAbout(img, u, v, k, rot) {
  const g = geom(img), P = toScreen(g, u, v);
  const wm0 = img.wm; img.wm = Math.max(5, wm0 * k); if (img.hm) img.hm *= img.wm / wm0;
  img.rot = normRot(rot);
  const g2 = geom(img), Q = toScreen({ ...g2, c: { x: 0, y: 0 } }, u, v), ll = map.unproject([P.x - Q.x, P.y - Q.y]);
  img.center = [ll.lng, ll.lat];
}
const anchor = () => pin || { u: 0, v: 0 };

lineEl.addEventListener("pointerdown", e => {
  if (e.button !== 0 || !curImg) return;
  e.preventDefault(); e.stopPropagation();
  const p = mapPoint(e), here = toPicture(geom(curImg), p.x, p.y);
  if (match && (match.step === 1 || match.step === 3)) { matchPicture(here); return; }
  if (pinMode) { pin = here; pinMode = false; render(); return; }
  startDrag(e, curImg, e.target.classList.contains("scale") ? "scale" : e.target.classList.contains("rot") ? "rot" : "move");
});
// Double-click the picture to pin that point (or to move the pin there).
lineEl.addEventListener("dblclick", e => { if (!curImg || match) return; const p = mapPoint(e); pin = toPicture(geom(curImg), p.x, p.y); render(); });

function drawLineUp() {
  const on = lining && !!curImg;
  lineEl.hidden = !on; mapDots.hidden = !on;
  $("layer").classList.toggle("blend", on && blend);
  if (!on) return;
  const img = curImg, g = geom(img);
  if (lineEl.dataset.src !== img.src) { lineEl.dataset.src = img.src; lineEl.firstChild.src = imageURL(img, "map"); }
  lineEl.style.width = g.w + "px"; lineEl.style.height = g.h + "px";
  lineEl.style.transform = `translate(${g.c.x - g.w / 2}px,${g.c.y - g.h / 2}px) rotate(${img.rot || 0}deg)`;
  lineEl.style.opacity = $("op").value;
  lineEl.style.visibility = peek ? "hidden" : "";
  lineEl.classList.toggle("picking", pinMode || !!(match && (match.step === 1 || match.step === 3)));
  lineEl.classList.toggle("through", !!(match && (match.step === 2 || match.step === 4)));
  // Markers drawn on the picture: the pin, and the points chosen for matching.
  const place = (el, pt) => { el.hidden = !pt; if (pt) { el.style.left = (pt.u + .5) * 100 + "%"; el.style.top = (pt.v + .5) * 100 + "%"; } };
  place(lineEl.querySelector(".pin"), match ? null : pin);
  place(lineEl.querySelector('.mdot[data-n="1"]'), match?.a1);
  place(lineEl.querySelector('.mdot[data-n="2"]'), match?.a2);
  // Markers on the map: where the matched points really are.
  mapDots.innerHTML = match?.m1 ? (() => { const q = map.project(match.m1); return `<span class="mdot" data-n="1" style="left:${q.x}px;top:${q.y}px"></span>`; })() : "";
  $("readout").textContent = `${Math.round(img.wm).toLocaleString()} m wide · ${img.rot || 0}°`;
}
function lineUp(on) {
  if (on === lining || (on && !curImg)) return;
  pin = null; pinMode = false; match = null; peek = false;
  if (on) {
    setDraw(null);
    savedView = { center: map.getCenter(), zoom: map.getZoom() };
    lining = true; hovered = null;
    map.fitBounds(boundsOf(corners(curImg)), { padding: 60, duration: 500 });
  } else {
    lining = false;
    if (savedView) map.easeTo({ ...savedView, duration: 500 });
    savedView = null;
  }
  render(); renderImgs();
}
// Dragging: the body moves the picture; a corner resizes and the top handle turns it, both around the pin (or the middle).
function startDrag(e, img, mode) {
  checkpoint();
  map.dragPan.disable();
  const start = { center: img.center.slice(), wm: img.wm, hm: img.hm, rot: img.rot || 0 }, p0 = mapPoint(e), g0 = geom(img);
  const { u, v } = anchor(), A = toScreen(g0, u, v);
  const d0 = Math.max(1, Math.hypot(p0.x - A.x, p0.y - A.y)), a0 = Math.atan2(p0.y - A.y, p0.x - A.x);
  const move = ev => {
    const p = mapPoint(ev);
    Object.assign(img, { center: start.center.slice(), wm: start.wm, hm: start.hm, rot: start.rot });
    if (mode === "move") { const ll = map.unproject([g0.c.x + p.x - p0.x, g0.c.y + p.y - p0.y]); img.center = [ll.lng, ll.lat]; }
    if (mode === "scale") transformAbout(img, u, v, Math.hypot(p.x - A.x, p.y - A.y) / d0, start.rot);
    if (mode === "rot") {
      let r = start.rot + (Math.atan2(p.y - A.y, p.x - A.x) - a0) * 180 / Math.PI;
      // Free rotation by default, including tiny adjustments near north-up.
      r = normRot(r); const snapTo = Math.round(r / 90) * 90; if (ev.shiftKey && Math.abs(r - snapTo) < 1.5) r = snapTo;
      transformAbout(img, u, v, 1, r);
    }
    markDirty(); render(); renderImgMeta();
  };
  const up = () => { removeEventListener("pointermove", move); removeEventListener("pointerup", up); map.dragPan.enable(); };
  addEventListener("pointermove", move); addEventListener("pointerup", up);
}
function rotateBy(d) { if (!curImg || !lining) return; checkpoint("rotate"); const { u, v } = anchor(); transformAbout(curImg, u, v, 1, (curImg.rot || 0) + d); markDirty(); render(); renderImgMeta(); }
function scaleBy(k) { if (!curImg || !lining) return; checkpoint("scale"); const { u, v } = anchor(); transformAbout(curImg, u, v, k, curImg.rot || 0); markDirty(); render(); }

// Match 2 points: a point on the picture, then where it is on the map; twice. The first pair moves the
// picture into place, the second sets its size and angle. The first point stays pinned afterwards.
function startMatch() { pinMode = false; match = { step: 1 }; render(); }
function matchPicture(pt) {
  if (match.step === 1) match.a1 = pt; else match.a2 = pt;
  match.step++; render();
}
function matchMap(ll) {
  const img = curImg;
  if (match.step === 2) {
    checkpoint();
    match.m1 = [ll.lng, ll.lat];
    const g = geom(img), P = toScreen(g, match.a1.u, match.a1.v), T = map.project(match.m1);
    const c = map.unproject([g.c.x + T.x - P.x, g.c.y + T.y - P.y]); img.center = [c.lng, c.lat];
    match.step = 3;
  } else {
    const g = geom(img), A1 = toScreen(g, match.a1.u, match.a1.v), A2 = toScreen(g, match.a2.u, match.a2.v);
    const T1 = map.project(match.m1), T2 = map.project([ll.lng, ll.lat]);
    const have = Math.hypot(A2.x - A1.x, A2.y - A1.y), want = Math.hypot(T2.x - T1.x, T2.y - T1.y);
    if (have < 3) { status("Those two points on the picture are too close together. Try again with points further apart.", true); match = { step: 1 }; render(); return; }
    checkpoint();
    const turn = (Math.atan2(T2.y - T1.y, T2.x - T1.x) - Math.atan2(A2.y - A1.y, A2.x - A1.x)) * 180 / Math.PI;
    transformAbout(img, match.a1.u, match.a1.v, want / have, (img.rot || 0) + turn);
    // transformAbout keeps point 1 where it was, which is already on its map spot.
    pin = match.a1; match = null;
    status("Lined up from 2 points. Fine-tune with the handles if needed; the first point is pinned.");
  }
  markDirty(); render(); renderImgMeta();
}

// ---------- floating controls and hints ----------
function renderOverlays() {
  $("tools").hidden = !lining || !!draw;
  $("drawBar").hidden = !draw;
  $("toolTip").textContent = match ? [
      "Step 1 of 4: click a point on the picture you can recognise, like a station or a junction.",
      "Step 2 of 4: now click where that point really is on the map.",
      "Step 3 of 4: click a second point on the picture, as far from the first as you can.",
      "Step 4 of 4: click where that second point really is on the map."][match.step - 1]
    : pinMode ? "Click the point on the picture to pin. Resizing and turning will keep it fixed."
    : "Drag to move · corners resize · top handle turns · double-click to pin a point · arrows, [ ] and − = for fine steps";
  $("matchBtn").classList.toggle("on", !!match); $("matchBtn").textContent = match ? "Cancel matching" : "Match 2 points";
  $("pinBtn").classList.toggle("on", pinMode || !!pin); $("pinBtn").textContent = pin ? "📍 Clear pin" : "📍 Pin a point";
  $("blendBtn").classList.toggle("on", blend);
  const html = draw || lining ? "" : curImg
    ? `Drag the picture to move its spot. <button class="btn small primary" id="hintLineUp">Line up at real size</button>`
    : !cur ? "Click a picture to edit it, or drop a new picture onto the map to start an idea."
    : cur.images.length ? "Click a picture to select it, or drag it to move its spot. Drop another picture to add it."
    : `Drop a picture of “${esc(label(cur))}” onto the map where it belongs.`;
  // Only rewrite when it changes, so the button isn't replaced under the pointer.
  if ($("mapHint").dataset.html !== html) { $("mapHint").dataset.html = html; $("mapHint").innerHTML = html; }
}
$("mapHint").onclick = e => { if (e.target.id === "hintLineUp") lineUp(true); };
document.querySelectorAll("[data-rot]").forEach(b => b.onclick = () => rotateBy(+b.dataset.rot));
document.querySelectorAll("[data-scale]").forEach(b => b.onclick = () => scaleBy(+b.dataset.scale));
$("straighten").onclick = () => curImg && rotateBy(-(curImg.rot || 0));
$("matchBtn").onclick = () => { if (match) { match = null; render(); } else startMatch(); };
$("pinBtn").onclick = () => { if (pin) pin = null; else pinMode = !pinMode; render(); };
$("blendBtn").onclick = () => { blend = !blend; render(); };
// Peek: hold the button (or the Space bar) to hide the picture and see the streets.
const setPeek = on => { if (peek !== on) { peek = on; kick(); } };
$("peekBtn").onpointerdown = e => { e.preventDefault(); setPeek(true); };
addEventListener("pointerup", () => setPeek(false));
$("op").oninput = render;
$("toolZoom").onclick = () => curImg && zoomTo(corners(curImg));
$("toolDone").onclick = () => lineUp(false);
const zoomTo = pts => map.fitBounds(boundsOf(pts), { padding: 80, maxZoom: 17, duration: 600 });

// ---------- keyboard ----------
addEventListener("keydown", e => {
  const mod = e.metaKey || e.ctrlKey, typing = /INPUT|TEXTAREA|SELECT/.test(e.target.tagName);
  if (mod && e.key.toLowerCase() === "s") { e.preventDefault(); save(); return; }
  if (mod && e.key.toLowerCase() === "z") { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
  if (mod && e.key.toLowerCase() === "y") { e.preventDefault(); redo(); return; }
  if (e.key === "Escape") {
    if (draw) setDraw(null);
    else if (typing) e.target.blur();
    else if (match || pinMode) { match = null; pinMode = false; render(); }
    else if (lining) lineUp(false);
    else if (curImg) selectImg(null);
    else if (cur) select(null);
    return;
  }
  if (draw && e.key === "Enter") { setDraw(null); return; }
  if (!curImg || typing) return;
  if (e.key === " " && lining) { e.preventDefault(); setPeek(true); return; }
  const c = map.project(curImg.center), step = e.shiftKey ? 10 : 1;
  const nudge = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
  if (nudge) { checkpoint("nudge"); const ll = map.unproject([c.x + nudge[0], c.y + nudge[1]]); curImg.center = [ll.lng, ll.lat]; markDirty(); render(); renderImgMeta(); }
  else if (e.code === "BracketLeft" || e.code === "BracketRight") rotateBy((e.code === "BracketLeft" ? -1 : 1) * (e.altKey ? .01 : e.shiftKey ? 5 : .1));
  else if (e.key === "-" || e.key === "=" || e.key === "_" || e.key === "+") scaleBy(/[-_]/.test(e.key) ? (e.shiftKey ? .9 : .99) : (e.shiftKey ? 1.1 : 1.01));
  else return;
  e.preventDefault();
});
addEventListener("keyup", e => { if (e.key === " ") setPeek(false); });

// ---------- routes and areas ----------
function geoData() {
  const features = IDEAS.filter(i => i.geometry).map(i => ({ type: "Feature", geometry: i.geometry,
    properties: { color: CATS[i.category]?.color || "#888", mine: i === cur, editing: !!cur } }));
  if (cur?.geometry) curPoints().forEach((p, idx) => features.push({ type: "Feature", geometry: { type: "Point", coordinates: p }, properties: { vertex: true, idx } }));
  return { type: "FeatureCollection", features };
}
function renderGeo() {
  map.getSource("geo")?.setData(geoData());
  const g = cur?.geometry, info = $("geoInfo");
  if (info) info.textContent = !g ? "None yet" : g.type === "Point" ? "A single spot" : g.type === "Polygon" ? `An area with ${g.coordinates[0].length - 1} points` : `A route with ${g.coordinates.length} points`;
  document.querySelectorAll("[data-draw]").forEach(b => b.classList.toggle("on", draw === b.dataset.draw));
}
function setDraw(mode) {
  draw = mode && cur ? mode : null;
  if (draw) { curImg = null; lining = false; savedView = null; }
  document.body.classList.toggle("drawing", !!draw);
  draw ? map.doubleClickZoom.disable() : map.doubleClickZoom.enable();
  $("drawTip").textContent = `Click the map to add ${draw === "area" ? "corners of the area" : "points along the route"}. Drag a point to move it; right-click a point to remove it.`;
  render(); renderGeo(); if (cur) renderImgs();
}
// Points being drawn are kept as a plain list and turned into the right shape after each change.
function setPoints(pts, kind) {
  if (!pts.length) delete cur.geometry;
  else if (pts.length === 1) cur.geometry = { type: "Point", coordinates: pts[0] };
  else if (kind === "area" && pts.length >= 3) cur.geometry = { type: "Polygon", coordinates: [[...pts, pts[0]]] };
  else cur.geometry = { type: "LineString", coordinates: pts };
  markDirty(); renderGeo();
}
const geoKind = () => draw || (cur.geometry?.type === "Polygon" ? "area" : "line");
const curPoints = () => { const g = cur.geometry; return g?.type === "Polygon" ? g.coordinates[0].slice(0, -1) : geoPoints(g).map(p => p.slice()); };
const ll6 = ll => [+ll.lng.toFixed(6), +ll.lat.toFixed(6)];
let draggedVertex = false;
map.on("click", e => {
  if (draggedVertex) { draggedVertex = false; return; }
  if (match && (match.step === 2 || match.step === 4)) { matchMap(e.lngLat); return; }
  if (draw) {
    if (map.queryRenderedFeatures(e.point, { layers: ["geo-vertex"] }).length) return;
    checkpoint(); const pts = curPoints(); pts.push(ll6(e.lngLat)); setPoints(pts, draw); return;
  }
  // Clicking empty map deselects a sticker; while lining up it does nothing, so a stray click can't end it.
  if (curImg && !lining) selectImg(null);
});
function undoPoint() { if (cur?.geometry) { checkpoint(); const pts = curPoints(); pts.pop(); setPoints(pts, geoKind()); } }
$("drawUndo").onclick = undoPoint;
$("drawDone").onclick = () => setDraw(null);

// ---------- choosing an idea ----------
function select(idea, img = null, frame = false) {
  if (draw) setDraw(null);
  cur = idea; curImg = img; lining = false; savedView = null;
  history.replaceState(null, "", idea ? "#idea/" + idea.slug : location.pathname);
  $("viewLink").href = "index.html" + (idea ? "#idea/" + idea.slug : "");
  renderSide(); render(); renderGeo();
  if (idea && frame) frameIdea(idea);
  $("body").scrollTop = 0;
}
// Selecting a picture keeps it sticker-sized; the map only pans if its spot is off screen.
function selectImg(img) {
  if (curImg === img) return;
  if (lining) lineUp(false);
  curImg = img; render(); renderImgs();
  if (!img) return;
  document.querySelector(".imgcard.sel")?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  const p = map.project(img.center), box = $("map").getBoundingClientRect();
  if (p.x < 40 || p.y < 40 || p.x > box.width - 40 || p.y > box.height - 40) map.easeTo({ center: img.center, duration: 450 });
}
function frameIdea(idea) {
  const pts = [...idea.images.map(m => m.center), ...geoPoints(idea.geometry)];
  if (pts.length) map.fitBounds(boundsOf(pts), { padding: 90, maxZoom: 15, duration: 600 });
}

// ---------- what each idea still needs ----------
function checks(i) {
  return [
    ["Title", !!i.title.trim(), "f-title"],
    ["Picture", i.images.length > 0 && i.images.every(m => !isStandIn(m)), "pictures"],
    ["Credits", i.images.length > 0 && i.images.every(m => m.credit?.trim() && !/^add credit$/i.test(m.credit.trim())), "pictures"],
    ["Description", !!i.description.trim(), "f-description"]
  ];
}
const missing = i => checks(i).filter(c => !c[1]).map(c => c[0].toLowerCase());

// ---------- sidebar ----------
function renderSide() { cur ? renderIdea() : renderHome(); renderOverlays(); }

function renderHome() {
  $("body").innerHTML = `
    <div class="guide"><b>Adding an idea</b><ol>
      <li>Drop a picture onto the map, or paste one with ⌘V / Ctrl+V at the map centre.</li>
      <li>Drag, resize and rotate it until it lines up with the streets.</li>
      <li>Give it a title and a short description.</li>
      <li>Press Save. Reload the public map to see it.</li></ol></div>
    <div class="row"><input type="search" id="find" placeholder="Find an idea" value="${esc(listQuery)}" aria-label="Find an idea"><button class="btn primary" id="new">+ New idea</button></div>
    <div id="ideaList"></div>`;
  renderIdeaList();
}
function renderIdeaList() {
  const q = listQuery.toLowerCase();
  const html = Object.entries(CATS).map(([k, c]) => {
    const ideas = IDEAS.filter(i => i.category === k && (!q || (i.title + " " + i.description).toLowerCase().includes(q))).sort((a, b) => label(a).localeCompare(label(b)));
    if (!ideas.length) return "";
    return `<div class="grp"><h3><i style="background:${c.color}"></i>${esc(c.label)} · ${ideas.length}</h3>${ideas.map(i => {
      const m = missing(i);
      return `<button class="ideaRow" data-key="${i._key}"><img src="${esc(imageURL(i.images[0]))}" alt="">
        <span><b>${esc(label(i))}</b><small class="${m.length ? "miss" : "ok"}">${m.length ? "Needs " + esc(m.join(", ")) : "✓ Complete"}</small></span></button>`;
    }).join("")}</div>`;
  }).join("");
  $("ideaList").innerHTML = html || `<p class="hint">No ideas match.</p>`;
}

function renderIdea() {
  const i = cur, cat = CATS[i.category];
  $("body").innerHTML = `
    <button class="back" id="back">← All ideas</button>
    <h2 class="ideaHead"><i class="dot" id="hDot" style="background:${cat?.color}"></i><span id="hTitle">${esc(label(i))}</span></h2>
    <label>Idea name <input type="text" id="f-title" data-f="title" value="${esc(i.title)}" placeholder="e.g. Northwest rapid transit"></label>
    <div class="checks" id="checks"></div>

    <section id="pictures"><h3>Pictures <small>the first one is the main picture</small></h3>
      <div id="imgs"></div>
      <div class="dropzone">Drop a picture onto the map where it belongs,<br>paste with ⌘V / Ctrl+V, or <button class="btn small" id="addImg">choose a file…</button></div>
      <details class="group-pictures"><summary>Group existing pictures here</summary>
        <p class="hint">Choose pictures from another idea to move here. Their placements, captions and credits stay the same. The original idea and its text stay available.</p>
        <label>From idea<select id="groupFrom"><option value="">Choose an idea…</option>${IDEAS.filter(other => other !== i && other.images.length).sort((a, b) => label(a).localeCompare(label(b))).map(other => `<option value="${other._key}">${esc(label(other))} (${other.images.length})</option>`).join("")}</select></label>
        <div id="groupChoices"></div>
        <button class="btn small" id="groupMove" disabled>Move selected pictures here</button>
      </details>
    </section>

    <section><h3>Words</h3>
      <label>Kind of idea</label>
      <div class="cats">${Object.entries(CATS).map(([k, c]) => `<label><input type="radio" name="cat" data-f="category" value="${k}"${k === i.category ? " checked" : ""}><i class="dot" style="background:${c.color}"></i>${esc(c.label)}</label>`).join("")}</div>
      <p class="hint" id="catAbout">${esc(cat?.about || "")}</p>
      <label>Description <span class="note">· a sentence or two is enough; the first sentence shows when people hover over the picture</span><textarea id="f-description" data-f="description" rows="3" placeholder="e.g. A fast, frequent line from the city to the airport, through the isthmus and Māngere.">${esc(i.description)}</textarea></label>
    </section>

    <section id="sources"><h3>Sources <small>optional</small></h3>
      <div id="srcList"></div>
      <button class="btn small" id="addSource" style="margin-top:8px">+ Add source</button>
    </section>

    <section><h3>Route or area <small id="geoInfo"></small></h3>
      <div class="row" style="flex-wrap:wrap;margin-top:8px">
        <button class="btn small" data-draw="line">Draw a route</button><button class="btn small" data-draw="area">Draw an area</button>
        <button class="btn small" id="geoUndo">Undo last point</button><button class="btn small danger" id="geoClear">Remove</button>
      </div>
      <p class="hint">Optional. Shows as a coloured line or area under the pictures. One point marks a single spot.</p>
    </section>

    <section class="danger-zone"><button class="btn danger" id="del">Delete this idea</button></section>`;
  renderChecks(); renderImgs(); renderSources(); renderGeo();
  $("body").querySelectorAll("textarea").forEach(autogrow);
}
function renderChecks() {
  if (!$("checks")) return;
  $("checks").innerHTML = checks(cur).map(([name, ok, target]) =>
    `<button class="${ok ? "ok" : "miss"}" data-check="${target}" title="${ok ? "Done" : "Still needed"}">${ok ? "✓" : "○"} ${name}</button>`).join("");
}
function renderImgs() {
  if (!cur || !$("imgs")) return;
  $("imgs").innerHTML = cur.images.map((img, i) => {
    const sel = img === curImg;
    return `<div class="imgcard${sel ? " sel" : ""}" data-i="${i}">
      <button class="ihead" data-act="select">${imageTag(img, "thumb", 'alt="" loading="lazy"')}
        <span><b>${esc(img.caption?.trim() || "No caption yet")}</b><small data-meta="${i}"></small></span>${i === 0 ? `<span class="main">Main</span>` : ""}</button>
      ${sel ? `<div class="ibody">
        ${isStandIn(img) ? `<p class="warnline">This is a stand-in drawing. Use “Replace file” to add the real picture.</p>` : ""}
        <label>Caption <input type="text" data-im="caption" data-i="${i}" value="${esc(img.caption)}" placeholder="What the picture shows"></label>
        <label>Credit <span class="note">· who made it; note if you need permission</span><input type="text" data-im="credit" data-i="${i}" value="${esc(/^add credit$/i.test(img.credit || "") ? "" : img.credit)}" placeholder="e.g. Greater Auckland"></label>
        <details class="placement"><summary>Precise placement</summary>
          <div class="placement-grid">
            <label>Longitude<input aria-label="Image longitude" type="number" min="-180" max="180" step="any" data-place="lng" data-i="${i}" value="${img.center[0]}"></label>
            <label>Latitude<input aria-label="Image latitude" type="number" min="-85" max="85" step="any" data-place="lat" data-i="${i}" value="${img.center[1]}"></label>
            <label>Width (metres)<input aria-label="Image width in metres" type="number" min="5" step="any" data-place="wm" data-i="${i}" value="${img.wm}"></label>
            <label>Rotation (degrees)<input aria-label="Image rotation in degrees" type="number" step="any" data-place="rot" data-i="${i}" value="${img.rot || 0}"></label>
          </div><p class="hint">The centre, width and clockwise angle when this picture is laid on the map. Press Tab to apply a value.</p>
        </details>
        <div class="acts">
          <button class="btn small${lining ? " on" : ""}" data-act="lineup">${lining ? "Back to sticker" : "Line up at real size"}</button>
          <button class="btn small" data-act="replace">Replace file…</button>
          ${i ? `<button class="btn small" data-act="first">Make main picture</button>` : ""}
          <button class="btn small danger" data-act="remove">Remove</button>
        </div></div>` : ""}
    </div>`;
  }).join("");
  renderImgMeta();
}
function renderGroupChoices() {
  const source = IDEAS.find(i => i._key === +$("groupFrom").value);
  $("groupChoices").innerHTML = (source?.images || []).map((img, i) =>
    `<label class="group-choice"><input type="checkbox" data-group-image="${i}" checked><img src="${esc(imageURL(img))}" alt=""><span>${esc(img.caption?.trim() || `Picture ${i + 1}`)}</span></label>`).join("");
  updateGroupButton();
}
function updateGroupButton() {
  const count = document.querySelectorAll("[data-group-image]:checked").length;
  $("groupMove").disabled = !count;
  $("groupMove").textContent = count ? `Move ${count} picture${count === 1 ? "" : "s"} here` : "Move selected pictures here";
}
function groupPictures() {
  const source = IDEAS.find(i => i._key === +$("groupFrom").value), target = cur;
  if (!source || !target || source === target) return;
  const selected = new Set([...document.querySelectorAll("[data-group-image]:checked")].map(input => +input.dataset.groupImage));
  const pictures = source.images.filter((img, i) => selected.has(i));
  if (!pictures.length) return;
  checkpoint();
  if (lining) lineUp(false);
  hovered = null;
  for (const img of pictures) removeEl(img);
  source.images = source.images.filter(img => !pictures.includes(img));
  target.images.push(...pictures);
  for (const img of pictures) addEl(target, img);
  markDirty(); select(target, pictures[0]);
  status(`Added ${pictures.length} picture${pictures.length === 1 ? "" : "s"} from “${esc(label(source))}”. The original idea is kept${source.images.length ? "." : " without pictures."} <button data-undo>Undo</button>`);
}
// The file name under each picture's caption.
function renderImgMeta() {
  if (!cur) return;
  cur.images.forEach((img, i) => {
    const m = document.querySelector(`[data-meta="${i}"]`);
    if (m) m.textContent = img.file ? img.file.split("/").pop() : "Stand-in picture";
    document.querySelectorAll(`[data-place][data-i="${i}"]`).forEach(input => {
      if (input === document.activeElement) return;
      input.value = input.dataset.place === "lng" ? img.center[0] : input.dataset.place === "lat" ? img.center[1] : img[input.dataset.place] || 0;
    });
  });
}
function renderSources() {
  if (!$("srcList")) return;
  $("srcList").innerHTML = (cur.sources || []).map((s, i) => `<div class="src">
    <input type="text" data-src="title" data-i="${i}" value="${esc(s.title)}" placeholder="Title" aria-label="Source title">
    <input type="url" data-src="url" data-i="${i}" value="${esc(s.url)}" placeholder="https://…" aria-label="Source link">
    <button class="btn small ghost" data-rmsrc="${i}" title="Remove source" aria-label="Remove source">✕</button></div>`).join("")
    || `<p class="hint" style="margin-top:4px">No sources yet. Link the report, business case or article the idea comes from.</p>`;
}
function autogrow(t) { t.style.height = "auto"; t.style.height = t.scrollHeight + 2 + "px"; }

// ---------- typing in the sidebar ----------
const slugify = s => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
function uniqueSlug(base, idea) {
  let s = base || "idea", n = 1;
  while (IDEAS.some(i => i !== idea && i.slug === s)) s = `${base}-${++n}`;
  return s;
}
$("side").addEventListener("input", e => {
  const t = e.target;
  if (t.id === "find") { listQuery = t.value; renderIdeaList(); return; }
  if (!cur) return;
  if (t.tagName === "TEXTAREA") autogrow(t);
  if (t.dataset.f) {
    const k = t.dataset.f;
    checkpoint("f:" + k);
    cur[k] = t.value;
    // The web address follows the title until it's been changed by hand.
    // A new idea's web address follows its title; an existing one keeps its address so shared links still work.
    if (k === "title") {
      if (!cur._slugEdited) cur.slug = uniqueSlug(slugify(cur.title), cur);
      $("hTitle").textContent = label(cur); refreshStickers(cur);
      $("viewLink").href = "index.html#idea/" + cur.slug; history.replaceState(null, "", "#idea/" + cur.slug);
    }
    if (k === "category") { $("hDot").style.background = CATS[cur.category].color; $("catAbout").textContent = CATS[cur.category].about || ""; refreshStickers(cur); render(); renderGeo(); }
  } else if (t.dataset.im) {
    const img = cur.images[+t.dataset.i], k = t.dataset.im;
    checkpoint("im:" + k + t.dataset.i);
    img[k] = t.value;
    if (k === "caption") t.closest(".imgcard").querySelector(".ihead b").textContent = t.value.trim() || "No caption yet";
    render(); renderImgMeta();
  } else if (t.dataset.src) {
    checkpoint("src:" + t.dataset.src + t.dataset.i);
    cur.sources[+t.dataset.i][t.dataset.src] = t.value.trim();
  } else return;
  markDirty(); renderChecks();
});

// ---------- clicks in the sidebar ----------
$("side").addEventListener("change", e => {
  const t = e.target;
  if (t.id === "groupFrom") { renderGroupChoices(); return; }
  if (t.matches("[data-group-image]")) { updateGroupButton(); return; }
  if (!cur || !t.dataset.place) return;
  const img = cur.images[+t.dataset.i], k = t.dataset.place, value = t.valueAsNumber;
  if (!img) return;
  if (!Number.isFinite(value) || !t.checkValidity()) {
    t.value = k === "lng" ? img.center[0] : k === "lat" ? img.center[1] : img[k] || 0;
    return;
  }
  checkpoint("place:" + k + t.dataset.i);
  if (k === "lng" || k === "lat") img.center[k === "lng" ? 0 : 1] = value;
  else if (k === "wm") { if (img.hm) img.hm *= value / img.wm; img.wm = value; }
  else img.rot = value;
  markDirty(); render(); renderImgMeta();
});
$("side").addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b) return;
  if (b.dataset.key) { select(IDEAS.find(i => i._key === +b.dataset.key), null, true); return; }
  if (b.dataset.check) {
    const t = $(b.dataset.check);
    t?.scrollIntoView({ block: "center", behavior: "smooth" });
    if (t?.matches("input, textarea")) t.focus({ preventScroll: true });
    else if (b.dataset.check === "pictures" && cur.images.length) selectImg(cur.images.find(m => isStandIn(m) || !m.credit?.trim() || /^add credit$/i.test(m.credit)) || cur.images[0]);
    return;
  }
  if (b.dataset.draw) {
    const mode = draw === b.dataset.draw ? null : b.dataset.draw;
    // Switching an existing route to an area (or back) keeps its points.
    if (mode && cur.geometry && mode !== geoKind()) { checkpoint(); setPoints(curPoints(), mode); }
    setDraw(mode); return;
  }
  if (b.dataset.rmsrc) { checkpoint(); cur.sources.splice(+b.dataset.rmsrc, 1); markDirty(); renderSources(); renderChecks(); return; }
  if (b.dataset.act) {
    const img = cur.images[+b.closest(".imgcard").dataset.i];
    imageAction(b.dataset.act, img); return;
  }
  switch (b.id) {
    case "new": newIdea(); break;
    case "back": select(null); break;
    case "addImg": pickFile(null); break;
    case "groupMove": groupPictures(); break;
    case "addSource":
      checkpoint(); (cur.sources ||= []).push({ title: "", url: "" }); markDirty(); renderSources(); renderChecks();
      $("srcList").querySelector(".src:last-child input")?.focus(); break;
    case "geoUndo": undoPoint(); break;
    case "geoClear": if (cur.geometry) { checkpoint(); setPoints([], "line"); setDraw(null); } break;
    case "del": deleteIdea(); break;
    case "undo": undo(); break;
    case "redo": redo(); break;
    case "save": save(); break;
  }
});
function imageAction(act, img) {
  if (act === "select") { selectImg(curImg === img ? null : img); return; }
  if (act === "lineup") { if (curImg !== img) selectImg(img); lineUp(!lining); }
  if (act === "replace") pickFile(img);
  if (act === "first") { checkpoint(); cur.images.splice(cur.images.indexOf(img), 1); cur.images.unshift(img); markDirty(); renderImgs(); }
  if (act === "remove") {
    checkpoint();
    if (curImg === img && lining) lineUp(false);
    cur.images.splice(cur.images.indexOf(img), 1); removeEl(img);
    markDirty(); renderChecks();
    if (curImg === img) selectImg(null); else { renderImgs(); render(); }
    status(`Removed the picture. <button data-undo>Undo</button>`);
  }
}

// ---------- adding pictures ----------
addEventListener("paste", e => {
  const clipboard = e.clipboardData;
  if (!clipboard) return;
  let images = [...clipboard.files].filter(file => file.type.startsWith("image/"));
  if (!images.length) images = [...clipboard.items]
    .filter(item => item.kind === "file" && item.type.startsWith("image/"))
    .map(item => item.getAsFile()).filter(Boolean);
  if (!images.length) return; // Leave ordinary text and link pasting to the focused field.
  e.preventDefault();
  const batch = crypto.randomUUID().slice(0, 8);
  const files = images.map((file, i) => {
    const extension = file.name.match(/\.[a-z0-9]+$/i)?.[0]
      || ({ "image/jpeg": ".jpg", "image/webp": ".webp", "image/gif": ".gif", "image/avif": ".avif" }[file.type] || ".png");
    // Give each pasted screenshot a distinct upload name.
    return new File([file], `pasted-image-${batch}-${i + 1}${extension}`, { type: file.type });
  });
  addFiles(files).catch(error => status(`Couldn't paste picture: ${esc(error.message)}`, true));
});

let replaceTarget = null;
function pickFile(target) { replaceTarget = target; $("file").multiple = !target; $("file").click(); }
$("file").onchange = e => {
  if (replaceTarget && e.target.files[0]) replaceFile(replaceTarget, e.target.files[0]); else addFiles(e.target.files);
  e.target.value = ""; replaceTarget = null;
};
async function storeFile(f) {
  await serverReady;
  if (server) {
    const r = await fetch("images/" + encodeURIComponent(f.name), { method: "PUT", body: f });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || r.statusText);
    return (await r.json()).path;
  }
  // Static hosting cannot write image files. Keep the bytes in the exported data
  // so saving ideas.js alone is sufficient, including after the tab is closed.
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error("Couldn't read picture"));
    reader.readAsDataURL(f);
  });
}
async function addFiles(files, at) {
  const images = [...files].filter(f => f.type.startsWith("image/"));
  if (!images.length) { status("That isn't a picture file.", true); return; }
  for (const f of images) {
    let path;
    status(`Adding ${esc(f.name)}…`);
    try { path = await storeFile(f); } catch (err) { status(`Couldn't add ${esc(f.name)}: ${esc(err.message)}`, true); continue; }
    checkpoint();
    if (!cur) newIdea(f.name.replace(/\.\w+$/, "").replace(/[-_]+/g, " ").trim(), true);
    const ll = at || map.getCenter(), src = URL.createObjectURL(f);
    // Start at 40% of the map's width, so it can be lined up right away.
    const img = { file: path, src, aspect: await readAspect(src), center: [ll.lng, ll.lat],
      wm: $("map").clientWidth * .4 * metresPerPx(ll.lat, map.getZoom()), rot: 0, caption: "", credit: "" };
    cur.images.push(img); addEl(cur, img);
    if (lining) lineUp(false);
    curImg = img; markDirty();
    status(`Added ${esc(f.name)}. Use “Line up at real size” to match it to the streets, then add a caption and credit.`);
  }
  renderIdea(); render();
  document.querySelector(".imgcard.sel")?.scrollIntoView({ block: "nearest" });
}
async function replaceFile(img, f) {
  let path;
  try { path = await storeFile(f); } catch (err) { status("Couldn't replace: " + esc(err.message), true); return; }
  checkpoint();
  img.file = path; delete img.hm;
  img.src = URL.createObjectURL(f); img.aspect = await readAspect(img.src);
  const stickerImage = EL.get(img).querySelector("img");
  delete stickerImage.dataset.src; stickerImage.src = img.src;
  markDirty(); renderImgs(); renderChecks(); render();
}
// Dropping: onto the map places it where it lands; onto the sidebar places it in the middle of the map.
let dragDepth = 0;
addEventListener("dragenter", e => {
  if (![...e.dataTransfer.types].includes("Files")) return;
  dragDepth++;
  $("drop").textContent = cur ? `Drop to add to “${label(cur)}”` : "Drop to start a new idea here";
  $("drop").classList.add("on");
});
addEventListener("dragover", e => e.preventDefault());
addEventListener("dragleave", () => { if (--dragDepth <= 0) { dragDepth = 0; $("drop").classList.remove("on"); } });
addEventListener("drop", e => {
  e.preventDefault(); dragDepth = 0; $("drop").classList.remove("on");
  const box = $("map").getBoundingClientRect(), inMap = e.clientX >= box.left && e.clientX < box.right && e.clientY >= box.top && e.clientY < box.bottom;
  addFiles(e.dataTransfer.files, inMap ? map.unproject([e.clientX - box.left, e.clientY - box.top]) : null);
});

// ---------- new and deleted ideas ----------
function newIdea(title = "", quiet = false) {
  if (!quiet) checkpoint();
  const idea = { _key: ++keySeq, slug: uniqueSlug(slugify(title) || "new-idea"), title, category: cur?.category || Object.keys(CATS)[0],
    description: "", sources: [], images: [] };
  IDEAS.push(idea); markDirty(); select(idea);
  if (!quiet) $("f-title").focus();
  return idea;
}
function deleteIdea() {
  checkpoint();
  const name = label(cur);
  for (const img of cur.images) removeEl(img);
  IDEAS.splice(IDEAS.indexOf(cur), 1); markDirty(); select(null);
  status(`Deleted “${esc(name)}”. <button data-undo>Undo</button>`);
}

// ---------- saving ----------
const r6 = v => +(+v).toFixed(6);
const roundGeo = c => typeof c[0] === "number" ? c.map(r6) : c.map(roundGeo);
function cleanIdea(i) {
  const o = { slug: i.slug, title: i.title.trim(), category: i.category, description: i.description.trim() };
  // The optional extras are only written when they're used.
  const sources = (i.sources || []).filter(s => s.url || s.title).map(s => ({ title: s.title || s.url, url: s.url }));
  if (sources.length) o.sources = sources;
  if (i.geometry) o.geometry = { type: i.geometry.type, coordinates: roundGeo(i.geometry.coordinates) };
  o.images = i.images.map(img => {
    const r = {};
    if (img.file) r.file = img.file;
    if (!img.file && img.kind) r.kind = img.kind;   // only shapes how a stand-in is drawn
    r.center = img.center.map(r6);
    r.wm = Math.round(img.wm);
    if (img.hm && !img.file) r.hm = Math.round(img.hm);
    r.rot = Math.round((img.rot || 0) * 1000) / 1000;
    r.caption = (img.caption || "").trim(); r.credit = (img.credit || "").trim();
    return r;
  });
  return o;
}
function ideasJs() {
  const json = JSON.stringify({ categories: CATS, ideas: IDEAS.map(cleanIdea) }, null, 2)
    .replace(/\[\s*(-?[\d.]+),\s*(-?[\d.]+)\s*\]/g, "[$1, $2]");   // keep [lng, lat] pairs on one line
  return `// Atlas Tāmaki data, written by editor.html. Loaded as a script (not fetched) so index.html also works from disk.
//
// Each idea has a title, a category, a description and optionally sources.
// Each idea has one or more images. Every image becomes a sticker on the map.
//   file     path in images/ or a URL. If missing, a stand-in is drawn.
//   kind     stand-ins only: "drawing" draws a plan-style stand-in, anything else a photo-style one
//   center   [lng, lat] where the image belongs
//   wm       width in metres when laid on the map at true scale
//   hm       height in metres (stand-ins only; real images use their own aspect ratio)
//   rot      rotation in degrees, clockwise (true scale only)
window.ATLAS = ${json};
`;
}
async function save() {
  await serverReady;
  // Ideas with no picture can't appear on the map; say so, but still save.
  const hidden = IDEAS.filter(i => !i.images.length).map(label);
  const note = hidden.length ? ` ${hidden.length === 1 ? `“${esc(hidden[0])}” has` : hidden.length + " ideas have"} no picture yet, so won't show on the map.` : "";
  const text = ideasJs();
  if (server) {
    try {
      const r = await fetch("ideas.js", { method: "PUT", body: text, headers: { "Content-Type": "text/javascript" } });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || r.statusText);
      dirty = false; renderSave();
      status(`Saved at ${new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}.${note}`, !!note);
    } catch (err) { status("Couldn't save: " + esc(err.message) + ". Is server.py still running?", true); }
    return;
  }
  // New pictures are embedded, so the export needs only one download.
  download(new Blob([text], { type: "text/javascript" }), "ideas.js");
  dirty = false; renderSave();
  status(`Downloaded ideas.js with new pictures included. Move it into the project folder.${note}`, true);
}
function download(blob, name) { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click(); }
function status(html, warn = false) { $("saveInfo").innerHTML = html; $("saveInfo").classList.toggle("warn", warn); }
$("saveInfo").addEventListener("click", e => { if (e.target.closest("[data-undo]")) undo(); });
function markDirty() { dirty = true; renderSave(); if (!cur && $("ideaList")) renderIdeaList(); }
function renderSave() {
  $("save").classList.toggle("dirty", dirty);
  $("save").textContent = dirty ? "Save changes" : "✓ Saved";
  $("save").disabled = !dirty;
  if (dirty && !/Removed|Deleted|Added/.test($("saveInfo").textContent)) status("Unsaved changes");
}
addEventListener("beforeunload", e => { if (dirty) { e.preventDefault(); e.returnValue = ""; } });

// ---------- start ----------
const serverReady = fetch("__editor").then(r => r.ok && r.json()).then(j => { server = !!j?.ok; }).catch(() => {}).finally(() => { $("serverNote").hidden = server; });
renderSave(); status("Everything is saved");
loadImages(IDEAS, CATS).then(() => {
  for (const idea of IDEAS) for (const img of idea.images) addEl(idea, img);
  // Open the idea named in the address, e.g. editor.html#idea/airport-light-rail
  const m = location.hash.match(/^#idea\/([\w-]+)/), idea = m && IDEAS.find(i => i.slug === m[1]);
  idea ? select(idea, null, true) : select(null);
  kick();
  whenStyleReady(map, () => {
    map.addSource("geo", { type: "geojson", data: geoData() });
    map.addLayer({ id: "geo-fill", type: "fill", source: "geo", filter: ["==", ["geometry-type"], "Polygon"],
      paint: { "fill-color": ["get", "color"], "fill-opacity": ["case", ["get", "mine"], .25, .12] } });
    map.addLayer({ id: "geo-line", type: "line", source: "geo", filter: ["any", ["==", ["geometry-type"], "LineString"], ["==", ["geometry-type"], "Polygon"]],
      layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": ["get", "color"], "line-width": ["case", ["get", "mine"], 5, 3], "line-opacity": ["case", ["get", "mine"], 1, ["boolean", ["get", "editing"], false], .4, .8] } });
    map.addLayer({ id: "geo-point", type: "circle", source: "geo", filter: ["all", ["==", ["geometry-type"], "Point"], ["!", ["has", "vertex"]]],
      paint: { "circle-color": ["get", "color"], "circle-radius": 6, "circle-stroke-color": "#fff", "circle-stroke-width": 2 } });
    map.addLayer({ id: "geo-vertex", type: "circle", source: "geo", filter: ["has", "vertex"],
      paint: { "circle-color": "#fff", "circle-radius": 6, "circle-stroke-color": "#1d2228", "circle-stroke-width": 2 } });
    // Route points can be dragged to move them, or right-clicked to remove them.
    map.on("mouseenter", "geo-vertex", () => map.getCanvas().style.cursor = "move");
    map.on("mouseleave", "geo-vertex", () => map.getCanvas().style.cursor = "");
    map.on("mousedown", "geo-vertex", e => {
      if (e.originalEvent.button !== 0) return;
      e.preventDefault();
      const idx = e.features[0].properties.idx, kind = geoKind();
      checkpoint();
      const move = ev => { const pts = curPoints(); pts[idx] = ll6(ev.lngLat); setPoints(pts, kind); draggedVertex = true; };
      map.on("mousemove", move);
      map.once("mouseup", () => { map.off("mousemove", move); setTimeout(() => draggedVertex = false, 0); });
    });
    map.on("contextmenu", "geo-vertex", e => {
      e.preventDefault();
      checkpoint(); const pts = curPoints(); pts.splice(e.features[0].properties.idx, 1); setPoints(pts, geoKind());
    });
    renderGeo();
  });
});
