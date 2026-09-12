const CONFIG = {
  spreadsheetId: "1vnIouZJf1iCYqDfFF6A4gDkfEk-hsSVEhLtPXcFDcB0",
  placesSheet: "Places",
  linksSheet: "CommunityLinks",
  pageSize: 24,
};

const state = {
  places: [],
  links: [],
  visibleCount: CONFIG.pageSize,
};

const $ = (id) => document.getElementById(id);

function csvUrl(sheet) {
  const stamp = Date.now();
  return `https://docs.google.com/spreadsheets/d/${CONFIG.spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheet)}&_=${stamp}`;
}

function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];
    if (quoted && char === '"' && next === '"') {
      field += '"';
      i++;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i++;
      row.push(field);
      if (row.some((cell) => cell !== "")) rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  row.push(field);
  if (row.some((cell) => cell !== "")) rows.push(row);
  return rows;
}

function rowsToObjects(rows) {
  if (!rows.length) return [];
  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1).map((row) => {
    const obj = {};
    headers.forEach((h, i) => (obj[h] = (row[i] || "").trim()));
    return obj;
  });
}

async function fetchSheet(sheet) {
  const response = await fetch(csvUrl(sheet), { cache: "no-store" });
  if (!response.ok) throw new Error(`Could not load ${sheet}`);
  const text = await response.text();
  if (/Sign in|Request access|<!doctype html/i.test(text.slice(0, 500))) {
    throw new Error("The website data feed is not publicly readable yet.");
  }
  return rowsToObjects(parseCSV(text));
}

function uniqSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function option(value, label = value) {
  const el = document.createElement("option");
  el.value = value;
  el.textContent = label;
  return el;
}

function text(value, fallback = "") {
  return (value || fallback).trim();
}

function mapLink(address) {
  if (!address) return "";
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

function directionsLink(address, community) {
  if (!address) return "";
  if (!community) return mapLink(address);
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(community)}&destination=${encodeURIComponent(address)}&travelmode=driving`;
}

function placePublicCategory(place) {
  return text(place["Public Category (Auto)"], text(place["Category"], "Other"));
}

function safeNotes(place) {
  return text(place["Client Notes"], text(place["Vibe / Good For"], ""));
}

function buildPlaceCard(place) {
  const card = document.createElement("article");
  card.className = "place-card";

  const name = text(place.Place, "Unnamed place");
  const city = text(place.City);
  const category = placePublicCategory(place);
  const area = text(place["Area / Neighborhood"]);
  const price = text(place.Price);
  const notes = safeNotes(place);
  const hours = text(place["Hours / Schedule"]);
  const pricing = text(place["Pricing Details"]);
  const address = text(place.Address);
  const website = text(place["Website / Source"]);

  card.innerHTML = `
    <div class="card-top">
      <h3></h3>
      ${price ? `<span class="price"></span>` : ""}
    </div>
    <div class="meta"></div>
    ${notes ? `<p class="notes"></p>` : ""}
    ${area ? `<div class="detail-line area"><strong>Area:</strong> <span></span></div>` : ""}
    ${hours ? `<div class="detail-line hours"><strong>Hours:</strong> <span></span></div>` : ""}
    ${pricing ? `<div class="detail-line pricing"><strong>Pricing:</strong> <span></span></div>` : ""}
    ${address ? `<div class="detail-line address"><strong>Address:</strong> <span></span></div>` : ""}
    <div class="card-actions"></div>`;

  card.querySelector("h3").textContent = name;
  if (price) card.querySelector(".price").textContent = price;

  const meta = card.querySelector(".meta");
  if (city) {
    const pill = document.createElement("span");
    pill.className = "pill";
    pill.textContent = city;
    meta.appendChild(pill);
  }
  if (category) {
    const pill = document.createElement("span");
    pill.className = "pill category";
    pill.textContent = category;
    meta.appendChild(pill);
  }

  const assignments = [
    [".notes", notes], [".area span", area], [".hours span", hours],
    [".pricing span", pricing], [".address span", address],
  ];
  assignments.forEach(([selector, value]) => {
    const node = card.querySelector(selector);
    if (node) node.textContent = value;
  });

  const actions = card.querySelector(".card-actions");
  if (website) {
    const a = document.createElement("a");
    a.href = website;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.textContent = "Website ↗";
    actions.appendChild(a);
  }
  if (address) {
    const a = document.createElement("a");
    a.href = mapLink(address);
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.className = "primary-link";
    a.textContent = "Map ↗";
    actions.appendChild(a);
  }
  return card;
}

function filteredPlaces() {
  const q = $("searchInput").value.trim().toLowerCase();
  const city = $("cityFilter").value;
  const category = $("categoryFilter").value;

  return state.places.filter((place) => {
    if (text(place["Place Status"]) && text(place["Place Status"]) !== "Active") return false;
    if (city !== "All" && text(place.City) !== city) return false;
    if (category !== "All" && placePublicCategory(place) !== category) return false;
    if (!q) return true;
    const haystack = [
      place.Place, place.City, place["Area / Neighborhood"], placePublicCategory(place),
      place.Category, place["Vibe / Good For"], place["Tags / Best For"],
      place["Client Notes"], place.Address,
    ].join(" ").toLowerCase();
    return haystack.includes(q);
  });
}

function renderPlaces({ reset = false } = {}) {
  if (reset) state.visibleCount = CONFIG.pageSize;
  const results = filteredPlaces();
  const visible = results.slice(0, state.visibleCount);
  const grid = $("placesGrid");
  grid.replaceChildren();

  $("resultCount").textContent = `${results.length.toLocaleString()} place${results.length === 1 ? "" : "s"}`;

  if (!visible.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "No places match those filters yet. Try another city, category or search term.";
    grid.appendChild(empty);
  } else {
    visible.forEach((place) => grid.appendChild(buildPlaceCard(place)));
  }

  $("loadMore").hidden = state.visibleCount >= results.length;
}

function communityStatus(link) {
  const mins = text(link["Drive minutes"]);
  if (mins) return `${mins} min · Route verified`;
  const status = text(link["Link status"]);
  if (/verified/i.test(status)) return "Route verified";
  return "Surrounding area";
}

function renderCommunityResults() {
  const community = $("communityFilter").value;
  const category = $("communityCategoryFilter").value;
  const grid = $("communityResults");
  grid.replaceChildren();
  if (!community) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "Choose a community to see nearby places.";
    grid.appendChild(empty);
    return;
  }

  const placesById = new Map(state.places.map((p) => [text(p["Place ID"]), p]));
  const links = state.links
    .filter((link) => text(link.Community) === community)
    .filter((link) => category === "All" || text(link["Use category"]) === category)
    .slice(0, 60);

  if (!links.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "No matching linked places yet for this community and category.";
    grid.appendChild(empty);
    return;
  }

  links.forEach((link) => {
    const place = placesById.get(text(link["Place ID"]));
    const name = text(link["Place (auto)"], place ? text(place.Place) : "Place");
    const city = text(link["City (auto)"], place ? text(place.City) : "");
    const notes = text(link["Client note (auto)"], place ? safeNotes(place) : "");
    const address = place ? text(place.Address) : "";
    const status = communityStatus(link);

    const card = document.createElement("article");
    card.className = "community-card";
    card.innerHTML = `<h3></h3><div class="meta"></div><span class="status"></span>${notes ? `<p class="community-notes"></p>` : ""}`;
    card.querySelector("h3").textContent = name;
    card.querySelector(".status").textContent = status;
    if (notes) card.querySelector(".community-notes").textContent = notes;

    const meta = card.querySelector(".meta");
    if (city) {
      const pill = document.createElement("span");
      pill.className = "pill";
      pill.textContent = city;
      meta.appendChild(pill);
    }
    const useCategory = text(link["Use category"]);
    if (useCategory) {
      const pill = document.createElement("span");
      pill.className = "pill category";
      pill.textContent = useCategory;
      meta.appendChild(pill);
    }

    if (address) {
      const a = document.createElement("a");
      a.href = directionsLink(address, community);
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = "Directions ↗";
      card.appendChild(a);
    }
    grid.appendChild(card);
  });
}

function populateFilters() {
  const cities = uniqSorted(state.places.map((p) => text(p.City)));
  const categories = uniqSorted(state.places.map(placePublicCategory));
  const communities = uniqSorted(state.links.map((l) => text(l.Community)));
  const communityCategories = uniqSorted(state.links.map((l) => text(l["Use category"])));

  cities.forEach((city) => $("cityFilter").appendChild(option(city)));
  categories.forEach((cat) => $("categoryFilter").appendChild(option(cat)));
  communities.forEach((community) => $("communityFilter").appendChild(option(community)));
  communityCategories.forEach((cat) => $("communityCategoryFilter").appendChild(option(cat)));

  $("placeCount").textContent = state.places.length.toLocaleString();
  $("cityCount").textContent = `${cities.length} cities`;
  $("categoryCount").textContent = `${categories.length} categories`;
}

function bindEvents() {
  ["searchInput", "cityFilter", "categoryFilter"].forEach((id) => {
    $(id).addEventListener(id === "searchInput" ? "input" : "change", () => renderPlaces({ reset: true }));
  });
  $("clearFilters").addEventListener("click", () => {
    $("searchInput").value = "";
    $("cityFilter").value = "All";
    $("categoryFilter").value = "All";
    renderPlaces({ reset: true });
  });
  $("loadMore").addEventListener("click", () => {
    state.visibleCount += CONFIG.pageSize;
    renderPlaces();
  });
  ["communityFilter", "communityCategoryFilter"].forEach((id) => $(id).addEventListener("change", renderCommunityResults));
}

async function init() {
  bindEvents();
  try {
    const [places, links] = await Promise.all([fetchSheet(CONFIG.placesSheet), fetchSheet(CONFIG.linksSheet)]);
    state.places = places.filter((p) => text(p.Place));
    state.links = links.filter((l) => text(l["Place ID"]));
    populateFilters();
    renderPlaces();
    renderCommunityResults();
    $("dataStatus").textContent = "Live data connected";
  } catch (error) {
    console.error(error);
    $("dataStatus").textContent = "Data feed setup needed";
    $("resultCount").textContent = "Guide not connected yet";
    const grid = $("placesGrid");
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.innerHTML = `<strong>Website shell is ready.</strong><br>The public Google Sheets data feed needs its one-time sharing/connection step before live places can load.`;
    grid.replaceChildren(empty);
    renderCommunityResults();
  }
}

document.addEventListener("DOMContentLoaded", init);
