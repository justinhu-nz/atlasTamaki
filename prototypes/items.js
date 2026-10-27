// Shared sample images for prototypes A–C.
// Every image is entered the same way, at map scale (like Felt): a centre, a width in metres and a rotation.
// Only the light rail figure is real; the rest are drawn stand-ins placed roughly where Felt images sit.
const STYLE = "https://tiles.openfreemap.org/styles/positron";
const M = 111320;

const ITEMS = [
  { id: "alr", title: "Airport light rail: long-list options", file: "../images/alr-long-list.webp", center: [174.7710, -36.9573], wm: 7570, rot: 0 },
  { id: "panmure", kind: "drawing", title: "Panmure junction redesign", color: "#2f9e44", center: [174.8505, -36.8985], wm: 520, hm: 420, rot: 0 },
  { id: "otahuhu", kind: "drawing", title: "Ōtāhuhu corridor sketch", color: "#d6336c", center: [174.8330, -36.9440], wm: 700, hm: 2200, rot: -12 },
  { id: "penrose", kind: "photo", title: "Penrose station", color: "#e8590c", center: [174.8150, -36.9090], wm: 420, rot: 0 },
  { id: "glen-innes", kind: "photo", title: "Glen Innes station", color: "#1c7ed6", center: [174.8555, -36.8790], wm: 700, rot: 0 },
  { id: "sylvia", kind: "photo", title: "Sylvia Park station", color: "#f59f00", center: [174.8415, -36.9175], wm: 380, rot: 0 },
  { id: "greenlane", kind: "photo", title: "Greenlane interchange", color: "#7048e8", center: [174.7970, -36.8895], wm: 260, rot: 0 },
  { id: "east", kind: "drawing", title: "Eastern busway network", color: "#e8590c", center: [174.9000, -36.9120], wm: 2000, hm: 1200, rot: 6 },
  { id: "krd", kind: "photo", title: "Karangahape station", color: "#ae3ec9", center: [174.7585, -36.8580], wm: 420, rot: 0 },
  { id: "te-waihorotiu", kind: "photo", title: "Te Waihorotiu station", color: "#1098ad", center: [174.7655, -36.8500], wm: 480, rot: 0 },
  { id: "victoria-park", kind: "drawing", title: "Victoria St linear park", color: "#2f9e44", center: [174.7615, -36.8485], wm: 650, hm: 300, rot: -8 },
  { id: "tamaki-drive", kind: "drawing", title: "Tāmaki Drive cycleway", color: "#2f9e44", center: [174.8000, -36.8560], wm: 1400, hm: 500, rot: 10 },
  { id: "te-atatu", kind: "photo", title: "Te Atatū busway station", color: "#1c7ed6", center: [174.6510, -36.8440], wm: 600, rot: 0 }
];

// ---------- stand-in images ----------
function rng(seed) { let s = [...seed].reduce((a, c) => a * 31 + c.charCodeAt(0) >>> 0, 7); return () => (s = s * 1664525 + 1013904223 >>> 0) / 2 ** 32; }
function fakePhoto(it) {
  const c = document.createElement("canvas"); c.width = 400; c.height = 280; const g = c.getContext("2d"), r = rng(it.id);
  const gr = g.createLinearGradient(0, 0, 0, 280); gr.addColorStop(0, "#cfe3f5"); gr.addColorStop(1, "#f4f1ea"); g.fillStyle = gr; g.fillRect(0, 0, 400, 280);
  for (let i = 0; i < 9; i++) { g.fillStyle = i % 3 ? "#9aa3ad" : it.color; const w = 30 + r() * 70, h = 50 + r() * 140; g.fillRect(r() * 380, 280 - h - 40, w, h); }
  g.fillStyle = "#555"; g.fillRect(0, 240, 400, 40);
  g.fillStyle = "#1d2228"; g.font = "bold 22px system-ui"; g.fillText(it.title, 14, 32);
  return c.toDataURL();
}
function fakeSketch(it) {
  const c = document.createElement("canvas"); c.width = 500; c.height = Math.round(500 * it.hm / it.wm); const g = c.getContext("2d"), r = rng(it.id);
  g.fillStyle = "#f2f2f0"; g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = "#c4c7cc"; g.lineWidth = 14;
  for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(r() * 500, 0); g.lineTo(r() * 500, c.height); g.stroke(); g.beginPath(); g.moveTo(0, r() * c.height); g.lineTo(500, r() * c.height); g.stroke(); }
  g.lineCap = "round"; g.strokeStyle = it.color; g.lineWidth = 16;
  g.beginPath(); g.moveTo(250, 0); g.bezierCurveTo(150, c.height * .3, 350, c.height * .6, 240, c.height); g.stroke();
  g.strokeStyle = "#1c7ed6"; g.lineWidth = 7; g.setLineDash([16, 10]);
  g.beginPath(); g.moveTo(0, c.height * .45); g.lineTo(500, c.height * .52); g.stroke();
  g.setLineDash([]); g.fillStyle = "#333"; g.font = "bold 22px system-ui"; g.fillText(it.title, 14, 32);
  return c.toDataURL();
}

async function loadItems() {
  await Promise.all(ITEMS.map(async it => {
    it.src = it.file || (it.kind === "drawing" ? fakeSketch(it) : fakePhoto(it));
    const img = new Image(); img.src = it.src; await img.decode();
    it.aspect = img.naturalWidth / img.naturalHeight;
  }));
  return ITEMS;
}

// ---------- geometry ----------
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const metresPerPx = (lat, z) => 40075016.686 * Math.cos(lat * Math.PI / 180) / (512 * 2 ** z);
// Where an item sits on screen at true map scale: centre, width/height in px, rotation in degrees.
function screenBox(map, it) {
  const c = map.project(it.center), mpp = metresPerPx(it.center[1], map.getZoom());
  return { x: c.x, y: c.y, w: it.wm / mpp, h: it.wm / it.aspect / mpp, rot: it.rot };
}
// Positions with transform only (no left/top), which the browser can move without re-laying out the page.
function place(el, b) {
  el.style.left = el.style.top = "0";
  el.style.width = b.w + "px"; el.style.height = b.h + "px";
  el.style.transform = `translate(${b.x - b.w / 2}px,${b.y - b.h / 2}px) rotate(${b.rot}deg)`;
}
const aabb = b => ({ x0: b.x - b.w / 2, y0: b.y - b.h / 2, x1: b.x + b.w / 2, y1: b.y + b.h / 2 });
const overlap = (a, b) => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));

function newMap() {
  const map = new maplibregl.Map({ container: "map", style: STYLE, center: [174.80, -36.89], zoom: 11.6 });
  map.dragRotate.disable(); map.touchZoomRotate.disableRotation();
  return map;
}
