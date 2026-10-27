// Shared helpers for the viewer (index.html) and the editor (editor.html).
const STYLE = "https://tiles.openfreemap.org/styles/positron";
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const metresPerPx = (lat, z) => 40075016.686 * Math.cos(lat * Math.PI / 180) / (512 * 2 ** z);
function rng(seed) { let s = [...seed].reduce((a, c) => a * 31 + c.charCodeAt(0) >>> 0, 7); return () => (s = s * 1664525 + 1013904223 >>> 0) / 2 ** 32; }

// ---------- stand-in images for entries with no file ----------
function fakePhoto(img, color, title) {
  const c = document.createElement("canvas"); c.width = 400; c.height = 280; const g = c.getContext("2d"), r = rng(title + img.center);
  const gr = g.createLinearGradient(0, 0, 0, 280); gr.addColorStop(0, "#cfe3f5"); gr.addColorStop(1, "#f4f1ea"); g.fillStyle = gr; g.fillRect(0, 0, 400, 280);
  for (let i = 0; i < 9; i++) { g.fillStyle = i % 3 ? "#9aa3ad" : color; const w = 30 + r() * 70, h = 50 + r() * 140; g.fillRect(r() * 380, 280 - h - 40, w, h); }
  g.fillStyle = "#555"; g.fillRect(0, 240, 400, 40);
  g.fillStyle = "#1d2228"; g.font = "bold 22px system-ui"; g.fillText(title, 14, 32);
  return c.toDataURL();
}
function fakeSketch(img, color, title) {
  const c = document.createElement("canvas"); c.width = 500; c.height = Math.round(500 * (img.hm || img.wm * .66) / img.wm);
  const g = c.getContext("2d"), r = rng(title + img.center);
  g.fillStyle = "#f2f2f0"; g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = "#c4c7cc"; g.lineWidth = 14;
  for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(r() * 500, 0); g.lineTo(r() * 500, c.height); g.stroke(); g.beginPath(); g.moveTo(0, r() * c.height); g.lineTo(500, r() * c.height); g.stroke(); }
  g.lineCap = "round"; g.strokeStyle = color; g.lineWidth = 16;
  g.beginPath(); g.moveTo(250, 0); g.bezierCurveTo(150, c.height * .3, 350, c.height * .6, 240, c.height); g.stroke();
  g.strokeStyle = "#1c7ed6"; g.lineWidth = 7; g.setLineDash([16, 10]);
  g.beginPath(); g.moveTo(0, c.height * .45); g.lineTo(500, c.height * .52); g.stroke();
  g.setLineDash([]); g.fillStyle = "#333"; g.font = "bold 22px system-ui"; g.fillText(title, 14, 32);
  return c.toDataURL();
}
// Sets img.src (its file, or a drawn stand-in) and img.aspect for one image.
async function loadImage(img, color, title) {
  img.src = img.file || (img.kind === "drawing" ? fakeSketch(img, color, title) : fakePhoto(img, color, title));
  const asset = window.ATLAS_IMAGES?.[img.file];
  if (asset) {
    img.aspect = asset.width / asset.height;
    return; // Dimensions are known: no request or decode of the original at startup.
  }
  img.aspect = await readAspect(img.src);
}
// Width ÷ height of an image. Uses the load event rather than decode(), which can stall in a hidden tab.
const readAspect = src => new Promise(done => {
  const el = new Image();
  const finish = aspect => { clearTimeout(timeout); el.onload = el.onerror = null; done(aspect); };
  const timeout = setTimeout(() => { finish(1.4); el.removeAttribute("src"); }, 10000);
  el.onload = () => finish(el.naturalWidth / el.naturalHeight || 1.4);
  el.onerror = () => finish(1.4);
  el.src = src;
});
const loadImages = (ideas, cats) => Promise.all(ideas.flatMap(idea => idea.images.map(img => loadImage(img, cats[idea.category].color, idea.title))));

// Select a bounded display size; full-size viewing deliberately keeps img.src (the original).
function imageURL(img, size = "thumb") {
  return img && (window.ATLAS_IMAGES?.[img.file]?.[size] || img.src || img.file) || "";
}
function imageTag(img, size = "thumb", attrs = "") {
  return `<img src="${esc(imageURL(img, size))}" decoding="async" ${attrs}>`;
}

// Sticker animation does not need to redraw WebGL tiles. During map movement, draw in
// MapLibre's render event to keep overlays aligned; settle hover/collisions with DOM-only frames.
function stickerRenderer(map, draw) {
  let pending = 0, dirty = true;
  const run = () => {
    cancelAnimationFrame(pending); pending = 0;
    if (document.hidden) return;
    dirty = false;
    if (draw()) schedule();
  };
  const schedule = () => { dirty = true; if (!pending && !document.hidden) pending = requestAnimationFrame(run); };
  map.on("move", () => { dirty = true; });
  map.on("resize", schedule);
  map.on("render", () => { if (dirty && !document.hidden) run(); });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) { cancelAnimationFrame(pending); pending = 0; }
    else schedule();
  });
  return schedule;
}

// Height in metres at true scale: stand-ins carry their own, real images follow their aspect ratio.
const heightM = img => img.hm && !img.file ? img.hm : img.wm / img.aspect;
// Four corners of an image laid at true map scale: [top-left, top-right, bottom-right, bottom-left] as [lng, lat].
function corners(img) {
  const [lng, lat] = img.center, h = heightM(img), r = (img.rot || 0) * Math.PI / 180;
  const mx = 111320 * Math.cos(lat * Math.PI / 180), my = 110574;
  return [[-1, 1], [1, 1], [1, -1], [-1, -1]].map(([sx, sy]) => {
    const x = sx * img.wm / 2, y = sy * h / 2;          // metres east, north
    const xr = x * Math.cos(r) + y * Math.sin(r), yr = -x * Math.sin(r) + y * Math.cos(r);   // clockwise
    return [lng + xr / mx, lat + yr / my];
  });
}
const boundsOf = pts => pts.reduce((b, p) => b.extend(p), new maplibregl.LngLatBounds(pts[0], pts[0]));
const geoPoints = g => !g ? [] : g.type === "Point" ? [g.coordinates] : g.type === "Polygon" ? g.coordinates[0] : g.coordinates;
// Runs fn once the map's style is ready for layers, without waiting for every tile to arrive.
const whenStyleReady = (map, fn) => map.style?._loaded ? fn() : map.once("style.load", fn);
// An idea's text is one description. Older entries split it into pitch / what it is / why it matters,
// which are joined here so both kinds read the same.
const descriptionOf = i => i.description ?? [i.pitch, i.what_it_is, i.why_it_matters].filter(t => t?.trim()).join("\n\n");
// The first sentence of the description, for hover captions, search results and list cards.
function summaryOf(i) {
  const d = descriptionOf(i).trim(), m = d.match(/^[\s\S]*?[.!?](?=\s|$)/);
  const s = (m ? m[0] : d.split("\n")[0]).trim();
  return s.length > 160 ? s.slice(0, 157).trimEnd() + "…" : s;
}

// ---------- jostle stickers, shared by the viewer and the editor (see GOLDEN-PROTOTYPE.md) ----------
// Each picture is a sticker pulled to its spot and pushed out of its neighbours' way. No carried-over
// speed (BOUNCE 0) and a firm pull, so stickers move straight into place without overshooting.
// Focus is kept modest (FOCUS, SHRINK) so a hover nudges neighbours rather than shoving them.
const JOSTLE = { PULL: .3, BOUNCE: 0, EASE: .4, FOCUS: 1.5, SHRINK: .12, GAP: 6, LABEL: 20 };
// A sticker's label opens into a caption once it has mostly grown.
const focusedEnough = s => s.sc > 1 + (JOSTLE.FOCUS - 1) * .7;
function makeSticker(idea, img, i, color) {
  const el = document.createElement("div");
  el.className = "st";
  el.style.setProperty("--c", color);
  // The tilt is fixed when the sticker is made, so it doesn't change while a new idea's title is typed.
  return { idea, img, i, el, tilt: (rng(idea.slug + i)() - .5) * 7 };
}
// One frame: ride along with the map, spring to the spot, push out of overlaps, then draw.
// o: { base (px), hovered (sticker or null), show(s), ties (svg element), style(s, box) }
// Returns true while anything is still moving, so the caller can ask for another frame.
function jostle(map, stickers, o) {
  const { PULL, BOUNCE, EASE, FOCUS, SHRINK, GAP, LABEL } = JOSTLE, hovered = o.hovered;
  // Screen space grows more slowly than geography, so zooming out frees up the map.
  // Keep a usable thumbnail at regional scale and restore full cards at street scale.
  const zoom = map.getZoom(), detail = clamp((zoom - 10.5) / 3, 0, 1);
  const base = Math.max(26, o.base * Math.min(1, 2 ** ((zoom - 13.5) * .55)));
  const labels = zoom >= 12.7, gap = 3 + (GAP - 3) * detail;
  let easing = 0, moving = 0, fresh = false;
  const ha = hovered && map.project(hovered.img.center), live = [];
  const container = map.getContainer(), width = container.clientWidth, height = container.clientHeight;
  // Include a generous margin for displaced cards, labels and focus expansion at the edges.
  const margin = Math.max(o.base * 3, 240);
  for (const s of stickers) {
    const a = o.show(s) && map.project(s.img.center);
    const show = a && (s === hovered || (a.x >= -margin && a.x <= width + margin && a.y >= -margin && a.y <= height + margin));
    const display = show ? "" : "none";
    if (s.el.style.display !== display) s.el.style.display = display;
    if (!show) { s.p = null; s.pa = null; continue; }
    const image = s.el.firstElementChild;
    if (image?.dataset.src) { image.src = image.dataset.src; delete image.dataset.src; }
    // Focus: hovered grows and straightens; neighbours shrink a little, more the closer they are.
    const target = !hovered ? 1 : s === hovered ? Math.max(FOCUS, o.base * 1.25 / base) : 1 - SHRINK * Math.exp(-Math.hypot(a.x - ha.x, a.y - ha.y) / 160);
    const tilt = s === hovered ? 0 : s.tilt * detail, sc = s.sc ?? 1, rot = s.rot ?? tilt;
    s.sc = sc + (target - sc) * EASE; s.rot = rot + (tilt - rot) * EASE;
    easing = Math.max(easing, Math.abs(target - s.sc), Math.abs(tilt - s.rot) / 20);
    const k = base * s.sc, r = s.img.aspect || 1.4;
    s.el.classList.toggle("overview", !labels);
    live.push({ s, a, label: labels || s === hovered ? LABEL : 0, w: r >= 1 ? k : k * r, h: r >= 1 ? k / r : k });
  }
  for (const b of live) {
    const s = b.s;
    if (!s.p) { s.p = { x: b.a.x, y: b.a.y }; s.v = { x: 0, y: 0 }; fresh = true; }
    else if (s.pa) { s.p.x += b.a.x - s.pa.x; s.p.y += b.a.y - s.pa.y; }   // ride along with the map
    s.pa = b.a;
    s.v.x = s.v.x * BOUNCE + (b.a.x - s.p.x) * PULL;
    s.v.y = s.v.y * BOUNCE + (b.a.y - s.p.y) * PULL;
    s.prev = { x: s.p.x, y: s.p.y };
    s.p.x += s.v.x; s.p.y += s.v.y;
  }
  // Push overlapping stickers apart. Pairs are only compared within neighbouring grid cells.
  // When stickers have just appeared (on load or after a filter change) they're settled in this one
  // frame, so they appear already spread out instead of visibly drifting apart.
  const cell = Math.max(base * 2.2, hovered ? o.base * 2 : 0);
  for (let round = fresh ? 15 : 1; round > 0; round--) {
    const grid = new Map();
    live.forEach((b, i) => { const k = Math.floor(b.s.p.x / cell) + "," + Math.floor(b.s.p.y / cell); (grid.get(k) || grid.set(k, []).get(k)).push(i); });
    for (let n = 0; n < 4; n++) for (let i = 0; i < live.length; i++) {
      const A = live[i], cx = Math.floor(A.s.p.x / cell), cy = Math.floor(A.s.p.y / cell);
      for (let gx = cx - 1; gx <= cx + 1; gx++) for (let gy = cy - 1; gy <= cy + 1; gy++) for (const j of grid.get(gx + "," + gy) || []) {
        if (j <= i) continue;
        const B = live[j], pa = A.s.p, pb = B.s.p;
        const ox = (A.w + B.w) / 2 + gap - Math.abs(pa.x - pb.x), oy = (A.h + B.h) / 2 + gap + (A.label + B.label) / 2 - Math.abs(pa.y - pb.y);
        if (ox <= 0 || oy <= 0) continue;
        // The focused sticker holds still under the pointer; its neighbours take the whole push.
        const wa = A.s === hovered ? 0 : B.s === hovered ? 2 : 1, wb = 2 - wa;
        if (ox < oy) { const d = (pa.x < pb.x ? -1 : 1) * ox / 4; pa.x += d * wa; pb.x -= d * wb; }
        else { const d = (pa.y < pb.y ? -1 : 1) * oy / 4; pa.y += d * wa; pb.y -= d * wb; }
      }
    }
  }
  if (fresh) for (const b of live) b.s.prev = { x: b.s.p.x, y: b.s.p.y };
  let svg = "";
  for (const b of live) {
    const s = b.s, el = s.el;
    moving = Math.max(moving, Math.hypot(s.p.x - s.prev.x, s.p.y - s.prev.y));
    const w = b.w.toFixed(2) + "px", h = b.h.toFixed(2) + "px";
    if (el.style.width !== w) el.style.width = w;
    if (el.style.height !== h) el.style.height = h;
    el.style.visibility = "visible";
    el.style.transform = `translate(${s.p.x - b.w / 2}px,${s.p.y - b.h / 2}px) rotate(${s.rot}deg)`;
    const lift = s === hovered ? 1 : detail;
    el.style.boxShadow = `0 ${1 + lift * 2}px ${3 + lift * 7}px rgba(0,0,0,${.12 + lift * .12})`;
    el.style.zIndex = s === hovered ? 60 : Math.round(30 - Math.log2(s.img.wm));
    o.style?.(s, b);
    // A line back to the exact spot, only when the sticker has been pushed away from it.
    if (Math.hypot(b.a.x - s.p.x, b.a.y - s.p.y) > Math.min(b.w, b.h) * .55)
      svg += `<path d="M${s.p.x},${s.p.y} L${b.a.x},${b.a.y}"/><circle cx="${b.a.x}" cy="${b.a.y}" r="3.5"/>`;
  }
  if (o.ties._paths !== svg) { o.ties.innerHTML = svg; o.ties._paths = svg; }
  return moving > .15 || easing > .002;
}
