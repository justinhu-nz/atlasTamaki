// Atlas Tāmaki data. Loaded as a script (not fetched) so index.html also works when opened straight from disk.
// SAMPLE content: places are approximate and text is placeholder. Replace with researched content.
//
// Each idea has one or more images. Every image becomes a sticker on the map.
//   file     path in images/ or a URL. If missing, a stand-in is drawn.
//   kind     "photo" (render, photo, diagram) or "drawing" (plan drawing, report map)
//   center   [lng, lat] where the image belongs
//   wm       width in metres when laid on the map at true scale
//   hm       height in metres (optional; otherwise taken from the image's aspect ratio)
//   rot      rotation in degrees, clockwise (true scale only)
// These are the values prototypes/c-editor.html exports.
window.ATLAS = {
  categories: {
    rapid:   { label: "Rapid transit",          color: "#d6336c", about: "Trains, light rail, busways and other fast, frequent lines with their own right of way." },
    bus:     { label: "Buses & ferries",        color: "#1c7ed6", about: "Bus routes, frequencies, bus lanes and interchanges, and ferry services." },
    active:  { label: "Cycling & walking",      color: "#2f9e44", about: "Cycleways, paths and routes mainly for getting around on foot or by bike." },
    streets: { label: "Streets & public spaces", color: "#e8590c", about: "How a street or public space is laid out: road space, crossings, footpaths, plazas, parks and shared spaces." },
    housing: { label: "Housing & town centres", color: "#7048e8", about: "What gets built and where: new homes, shops, offices, mixed-use developments, and plans for town centres and around stations." }
  },
  ideas: [
    {
      slug: "airport-light-rail",
      title: "Light rail to the airport",
      category: "rapid",
      pitch: "A fast, frequent line from the city centre through the isthmus to the airport.",
      what_it_is: "A rapid transit line from Britomart down the Dominion Road corridor, through Onehunga and Māngere, to Auckland Airport. The business case looked at a long list of alignments before settling on a preferred route.",
      why_it_matters: "The isthmus and Māngere have big catchments with no rapid transit, and the airport is a major job centre that's mostly reachable only by car.",
      details: { "Length": "~24 km (approx.)", "Mode": "Light rail / light metro" },
      proposed_by: "Auckland Light Rail business case",
      sources: [{ title: "Greater Auckland", url: "https://www.greaterauckland.org.nz/" }],
      geometry: { type: "LineString", coordinates: [
        [174.7676,-36.8441],[174.7640,-36.8520],[174.7570,-36.8700],[174.7460,-36.8900],
        [174.7370,-36.9130],[174.7850,-36.9240],[174.8000,-36.9680],[174.7850,-37.0080]] },
      images: [
        { file: "images/alr-long-list.webp", kind: "drawing", center: [174.7710,-36.9573], wm: 7570, rot: 0,
          caption: "Fig 6.3: long-list alignment options", credit: "Light rail business case report" }
      ]
    },
    {
      slug: "northwest-rapid-transit",
      title: "Northwest rapid transit",
      category: "rapid",
      pitch: "Turn the SH16 bus corridor into a full rapid transit line to Westgate.",
      what_it_is: "Dedicated rapid transit along the Northwestern Motorway between the city and Westgate, with proper stations.",
      why_it_matters: "The northwest is growing quickly, and its buses currently share congested motorway lanes.",
      details: { "Length": "~20 km (approx.)" },
      proposed_by: "Various (sample)",
      sources: [{ title: "Auckland Transport", url: "https://at.govt.nz/" }],
      geometry: { type: "LineString", coordinates: [
        [174.7570,-36.8570],[174.7160,-36.8660],[174.6870,-36.8560],[174.6510,-36.8440],[174.6070,-36.8150]] },
      images: [{ kind: "photo", center: [174.6510,-36.8440], wm: 600, rot: 0, caption: "Te Atatū busway station (stand-in)", credit: "Add credit" }]
    },
    {
      slug: "city-rail-link-stations",
      title: "City Rail Link stations",
      category: "rapid",
      pitch: "New underground stations that put the city fringe on the rail network.",
      what_it_is: "Two new stations, Karangahape and Te Waihorotiu, on the tunnel linking Britomart to the western line.",
      why_it_matters: "They bring frequent trains within a short walk of uptown and Karangahape Road.",
      details: {},
      proposed_by: "Various (sample)",
      sources: [],
      images: [
        { kind: "photo", center: [174.7585,-36.8580], wm: 420, rot: 0, caption: "Karangahape station (stand-in)", credit: "Add credit" },
        { kind: "photo", center: [174.7655,-36.8500], wm: 480, rot: 0, caption: "Te Waihorotiu station (stand-in)", credit: "Add credit" }
      ]
    },
    {
      slug: "southern-stations",
      title: "Better southern line stations",
      category: "rapid",
      pitch: "Rebuild Penrose and Sylvia Park stations around the people using them.",
      what_it_is: "Station upgrades with better access, shelter and connections to buses and nearby streets.",
      why_it_matters: "Both stations sit next to big employment and retail areas but are awkward to reach on foot.",
      details: {},
      proposed_by: "Various (sample)",
      sources: [],
      images: [
        { kind: "photo", center: [174.8150,-36.9090], wm: 420, rot: 0, caption: "Penrose station (stand-in)", credit: "Add credit" },
        { kind: "photo", center: [174.8415,-36.9175], wm: 380, rot: 0, caption: "Sylvia Park station (stand-in)", credit: "Add credit" }
      ]
    },
    {
      slug: "eastern-busway",
      title: "Eastern busway network",
      category: "bus",
      pitch: "A dedicated busway linking Panmure, Pakuranga and Botany.",
      what_it_is: "Separated bus lanes and stations through the eastern suburbs, connecting to the rail line at Panmure.",
      why_it_matters: "The east has some of the city's longest car commutes and no rapid transit.",
      details: {},
      proposed_by: "Various (sample)",
      sources: [],
      geometry: { type: "LineString", coordinates: [
        [174.8505,-36.8985],[174.8720,-36.9050],[174.8900,-36.9100],[174.9100,-36.9180]] },
      images: [{ kind: "drawing", center: [174.9000,-36.9120], wm: 2000, hm: 1200, rot: 6, caption: "Busway network sketch (stand-in)", credit: "Add credit" }]
    },
    {
      slug: "greenlane-interchange",
      title: "Greenlane bus–rail interchange",
      category: "bus",
      pitch: "Make the bus–train transfer at Greenlane quick and pleasant.",
      what_it_is: "Bus stops moved next to the station entrance, with a covered connection.",
      why_it_matters: "Crosstown buses meet the rail line here, but the transfer is long and exposed.",
      details: {},
      proposed_by: "Various (sample)",
      sources: [],
      images: [{ kind: "photo", center: [174.7970,-36.8895], wm: 260, rot: 0, caption: "Greenlane interchange (stand-in)", credit: "Add credit" }]
    },
    {
      slug: "crosstown-frequent-bus",
      title: "Crosstown frequent bus",
      category: "bus",
      pitch: "A turn-up-and-go bus across the isthmus that doesn't go through town.",
      what_it_is: "A frequent crosstown route from Point Chevalier through St Lukes and Newmarket to Ellerslie.",
      why_it_matters: "Most bus routes radiate to the city centre, so crosstown trips are slow and need transfers.",
      details: { "Frequency": "Every 10 min (target)" },
      proposed_by: "Various (sample)",
      sources: [],
      geometry: { type: "LineString", coordinates: [
        [174.7100,-36.8720],[174.7330,-36.8830],[174.7600,-36.8800],[174.7770,-36.8700],[174.8100,-36.8980]] },
      images: [{ kind: "photo", center: [174.7330,-36.8830], wm: 400, rot: 0, caption: "Crosstown bus (stand-in)", credit: "Add credit" }]
    },
    {
      slug: "tamaki-drive-cycleway",
      title: "Tāmaki Drive cycleway",
      category: "active",
      pitch: "A continuous, protected waterfront route from the city to St Heliers.",
      what_it_is: "Separated cycle paths along Tāmaki Drive, so people on bikes no longer share the narrow footpath.",
      why_it_matters: "It's one of the city's most popular rides, and the current shared path is crowded and conflict-prone.",
      details: {},
      proposed_by: "Various (sample)",
      sources: [],
      geometry: { type: "LineString", coordinates: [
        [174.7810,-36.8470],[174.7950,-36.8520],[174.8100,-36.8560],[174.8300,-36.8510],[174.8550,-36.8530]] },
      images: [{ kind: "drawing", center: [174.8000,-36.8560], wm: 1400, hm: 500, rot: 10, caption: "Cycleway layout (stand-in)", credit: "Add credit" }]
    },
    {
      slug: "great-north-road-cycleway",
      title: "Great North Road cycleway",
      category: "active",
      pitch: "A protected cycleway linking Grey Lynn to Point Chevalier.",
      what_it_is: "Separated bike lanes along Great North Road, connecting to the city centre network.",
      why_it_matters: "A flat, direct route that would open cycling to many more people than painted lanes.",
      details: {},
      proposed_by: "Various (sample)",
      sources: [],
      geometry: { type: "LineString", coordinates: [
        [174.7500,-36.8610],[174.7380,-36.8650],[174.7250,-36.8690],[174.7100,-36.8720]] },
      images: [{ kind: "photo", center: [174.7380,-36.8650], wm: 350, rot: 0, caption: "Protected lane (stand-in)", credit: "Add credit" }]
    },
    {
      slug: "victoria-street-linear-park",
      title: "Victoria Street linear park",
      category: "streets",
      pitch: "Turn Victoria Street into a green spine linking Albert Park and Victoria Park.",
      what_it_is: "Wider footpaths, trees and seating along Victoria Street, with traffic reduced to access only.",
      why_it_matters: "The city centre is short on green space, and this street links two of its biggest parks.",
      details: {},
      proposed_by: "Various (sample)",
      sources: [],
      images: [{ kind: "drawing", center: [174.7615,-36.8485], wm: 650, hm: 300, rot: -8, caption: "Linear park plan (stand-in)", credit: "Add credit" }]
    },
    {
      slug: "panmure-junction",
      title: "Panmure junction redesign",
      category: "streets",
      pitch: "Rework the Panmure junction around walking, cycling and the station.",
      what_it_is: "A redesign of the junction with protected crossings and bus priority.",
      why_it_matters: "The current layout is hostile to anyone not in a car, right next to a busy interchange.",
      details: {},
      proposed_by: "Various (sample)",
      sources: [],
      images: [{ kind: "drawing", center: [174.8505,-36.8985], wm: 520, hm: 420, rot: 0, caption: "Junction plan (stand-in)", credit: "Add credit" }]
    },
    {
      slug: "otahuhu-corridor",
      title: "Ōtāhuhu corridor",
      category: "streets",
      pitch: "A main street for Ōtāhuhu, with space for buses, bikes and people.",
      what_it_is: "A corridor redesign along Great South Road through Ōtāhuhu.",
      why_it_matters: "The town centre is split by a traffic route that could be a place to spend time.",
      details: {},
      proposed_by: "Various (sample)",
      sources: [],
      images: [{ kind: "drawing", center: [174.8330,-36.9440], wm: 700, hm: 2200, rot: -12, caption: "Corridor sketch (stand-in)", credit: "Add credit" }]
    },
    {
      slug: "glen-innes-town-centre",
      title: "Glen Innes town centre",
      category: "streets",
      pitch: "Join the station and town centre with a calm, walkable main street.",
      what_it_is: "Street changes linking Glen Innes station to Apirana Avenue's shops.",
      why_it_matters: "Thousands of new homes are being built nearby, and the walk to the station is poor.",
      details: {},
      proposed_by: "Various (sample)",
      sources: [],
      images: [{ kind: "photo", center: [174.8555,-36.8790], wm: 700, rot: 0, caption: "Glen Innes (stand-in)", credit: "Add credit" }]
    },
    {
      slug: "city-centre-laneways",
      title: "Car-free city centre laneways",
      category: "streets",
      pitch: "Extend the shared-space laneways into a connected car-free network.",
      what_it_is: "Pedestrian-priority streets around High Street and Chancery, joined into a continuous network.",
      why_it_matters: "The city centre has more people on foot than in cars, and its streets could reflect that.",
      details: {},
      proposed_by: "Various (sample)",
      sources: [],
      geometry: { type: "Polygon", coordinates: [[
        [174.7640,-36.8470],[174.7685,-36.8470],[174.7690,-36.8515],[174.7645,-36.8520],[174.7640,-36.8470]]] },
      images: [{ kind: "photo", center: [174.7665,-36.8490], wm: 300, rot: 0, caption: "High Street (stand-in)", credit: "Add credit" }]
    }
  ]
};
