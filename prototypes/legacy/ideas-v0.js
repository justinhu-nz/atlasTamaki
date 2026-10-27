// Atlas Tāmaki data. Loaded as a script (not fetched) so index.html works when opened straight from disk.
// SAMPLE entries: geometry is approximate and text is placeholder — replace with your researched content.
// Image "file": a path in images/ or a URL. If missing, a placeholder is drawn.
window.ATLAS = {
  categories: {
    rapid:   { label: "Rapid transit",     color: "#d6336c" },
    bus:     { label: "Buses & ferries",   color: "#1c7ed6" },
    active:  { label: "Cycling & walking", color: "#2f9e44" },
    streets: { label: "Streets & places",  color: "#e8590c" }
  },
  ideas: [
    {
      slug: "airport-light-rail",
      title: "Light rail to the airport",
      category: "rapid",
      pitch: "A fast, frequent line from the city centre through the isthmus to the airport.",
      what_it_is: "A rapid transit line running from Britomart down the Dominion Road corridor, through Onehunga and Māngere, to Auckland Airport.",
      why_it_matters: "The isthmus and Māngere have big catchments with no rapid transit, and the airport is a major job centre reachable mostly by car.",
      details: { "Length": "~24 km (approx.)", "Mode": "Light rail / light metro" },
      proposed_by: "Various (sample)",
      sources: [{ title: "Greater Auckland", url: "https://www.greaterauckland.org.nz/" }],
      geometry: { type: "LineString", coordinates: [
        [174.7676,-36.8441],[174.7640,-36.8520],[174.7570,-36.8700],[174.7460,-36.8900],
        [174.7370,-36.9130],[174.7850,-36.9240],[174.8000,-36.9680],[174.7850,-37.0080]] },
      images: [
        { kind: "pin", at: [174.7600,-36.8640], caption: "Street-running stop (placeholder)", credit: "Add credit" },
        { kind: "pin", at: [174.7850,-37.0020], caption: "Airport station (placeholder)", credit: "Add credit" },
        // Whole report figure, roughly aligned using its scale bar and the Onehunga label. Includes legend + caption.
        { kind: "overlay", file: "images/alr-long-list.webp", minzoom: 12, opacity: 0.85,
          corners: [[174.7284,-36.9061],[174.8135,-36.9061],[174.8135,-37.0085],[174.7284,-37.0085]],
          caption: "Fig 6.3: long list light rail alignment options", credit: "Light rail business case report" }
      ]
    },
    {
      slug: "northwest-rapid-transit",
      title: "Northwest rapid transit",
      category: "rapid",
      pitch: "Turn the SH16 bus corridor into a full rapid transit line to Westgate.",
      what_it_is: "Dedicated rapid transit along the Northwestern Motorway between the city and Westgate, with proper stations.",
      why_it_matters: "The northwest is growing quickly and buses currently share congested motorway lanes.",
      details: { "Length": "~20 km (approx.)" },
      proposed_by: "Various (sample)",
      sources: [{ title: "Auckland Transport", url: "https://at.govt.nz/" }],
      geometry: { type: "LineString", coordinates: [
        [174.7570,-36.8570],[174.7160,-36.8660],[174.6870,-36.8560],[174.6510,-36.8440],[174.6070,-36.8150]] },
      images: [{ kind: "pin", at: [174.6510,-36.8440], caption: "Te Atatū station (placeholder)", credit: "Add credit" }]
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
      images: [{ kind: "pin", at: [174.7380,-36.8650], caption: "Protected lane (placeholder)", credit: "Add credit" }]
    },
    {
      slug: "city-centre-laneways",
      title: "Car-free city centre laneways",
      category: "streets",
      pitch: "Extend the shared-space laneways into a connected car-free network.",
      what_it_is: "Pedestrian-priority streets around High Street and Chancery, joined into a continuous network.",
      why_it_matters: "The city centre has more people on foot than in cars; its streets could reflect that.",
      details: {},
      proposed_by: "Various (sample)",
      sources: [],
      geometry: { type: "Polygon", coordinates: [[
        [174.7640,-36.8470],[174.7685,-36.8470],[174.7690,-36.8515],[174.7645,-36.8520],[174.7640,-36.8470]]] },
      images: [{ kind: "pin", at: [174.7665,-36.8490], caption: "High Street (placeholder)", credit: "Add credit" }]
    },
    {
      slug: "crosstown-frequent-bus",
      title: "Crosstown frequent bus",
      category: "bus",
      pitch: "A turn-up-and-go bus linking the western and eastern isthmus without going through town.",
      what_it_is: "A frequent crosstown route from Point Chevalier through St Lukes and Newmarket to Ellerslie.",
      why_it_matters: "Most bus routes radiate to the city centre; crosstown trips are slow and need transfers.",
      details: { "Frequency": "Every 10 min (target)" },
      proposed_by: "Various (sample)",
      sources: [],
      geometry: { type: "LineString", coordinates: [
        [174.7100,-36.8720],[174.7330,-36.8830],[174.7600,-36.8800],[174.7770,-36.8700],[174.8100,-36.8980]] },
      images: []
    },
    {
      slug: "penrose-interchange",
      title: "Penrose interchange redesign",
      category: "streets",
      pitch: "Rework the Penrose junction around walking, cycling and the station.",
      what_it_is: "A redesign of the intersection near Penrose station with protected crossings and bus priority.",
      why_it_matters: "The current layout is hostile to anyone not in a car, right next to a rail station.",
      details: {},
      proposed_by: "Various (sample)",
      sources: [],
      geometry: { type: "Point", coordinates: [174.8160,-36.9090] },
      images: [
        // Overlay: corners are [top-left, top-right, bottom-right, bottom-left] as [lng, lat]
        { kind: "overlay", corners: [[174.8120,-36.9065],[174.8200,-36.9060],[174.8205,-36.9115],[174.8125,-36.9120]],
          opacity: 0.8, caption: "Redesign sketch (placeholder overlay)", credit: "Add credit" }
      ]
    }
  ]
};
