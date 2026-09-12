const CONFIG = {
  spreadsheetId: "1vnIouZJf1iCYqDfFF6A4gDkfEk-hsSVEhLtPXcFDcB0",
  placesSheet: "Places",
  linksSheet: "CommunityLinks",
  homeLimit: 10,
};

const COMMUNITY_META = {
  "avery ridge": { brand: "Centex", city: "Gainesville" },
  "hunters creek": { brand: "Pulte", city: "Flowery Branch" },
  "reunion": { brand: "Pulte", city: "Flowery Branch" },
};

const state = { places: [], links: [] };
const $ = (id) => document.getElementById(id);
const text = (value, fallback = "") => String(value ?? fallback).trim();
const norm = (value) => text(value).normalize("NFKC").replace(/\s+/g, " ").toLowerCase();

function csvUrl(sheet) {
  return `https://docs.google.com/spreadsheets/d/${CONFIG.spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheet)}&_=${Date.now()}`;
}

function parseCSV(input) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < input.length; i++) {
    const char = input[i], next = input[i + 1];
    if (quoted && char === '"' && next === '"') { field += '"'; i++; }
    else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { row.push(field); field = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i++;
      row.push(field);
      if (row.some((cell) => cell !== "")) rows.push(row);
      row = []; field = "";
    } else field += char;
  }
  row.push(field);
  if (row.some((cell) => cell !== "")) rows.push(row);
  return rows;
}

function rowsToObjects(rows) {
  if (!rows.length) return [];
  const headers = rows[0].map((header) => text(header));
  return rows.slice(1).map((row) => {
    const obj = {};
    headers.forEach((header, index) => { if (header) obj[header] = text(row[index]); });
    return obj;
  });
}

async function fetchSheet(sheet) {
  const response = await fetch(csvUrl(sheet), { cache: "no-store" });
  if (!response.ok) throw new Error(`Could not load ${sheet}`);
  const body = await response.text();
  if (/Sign in|Request access|<!doctype html/i.test(body.slice(0, 700))) throw new Error(`${sheet} feed is not publicly readable`);
  return rowsToObjects(parseCSV(body));
}

function slugify(value) {
  return text(value).toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
function placeSlug(place) { return `${slugify(place.Place)}-${slugify(place.City)}`; }
function placeCategory(place) { return text(place["Public Category (Auto)"], text(place.Category, "Other")); }
function placeNotes(place) { return text(place["Client Notes"], text(place["Vibe / Good For"])); }
function mapLink(address) { return address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}` : ""; }
function uniqSorted(values) { return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b)); }
function option(value, label = value) { const el = document.createElement("option"); el.value = value; el.textContent = label; return el; }
function isActivePlace(place) { const status = norm(place["Place Status"]); return !status || status === "active"; }

function linkedPlaceKeysForCommunity(community) {
  if (!community || norm(community) === "all") return null;
  const ids = new Set();
  const names = new Set();
  state.links.filter((link) => norm(link.Community) === norm(community)).forEach((link) => {
    if (text(link["Place ID"])) ids.add(norm(link["Place ID"]));
    const name = text(link["Place (auto)"]);
    const city = text(link["City (auto)"]);
    if (name) names.add(`${norm(name)}|${norm(city)}`);
  });
  return { ids, names };
}

function buildPlaceCard(place) {
  const card = document.createElement("article");
  card.className = "place-card";
  const name = text(place.Place, "Unnamed place");
  const city = text(place.City);
  const area = text(place["Area / Neighborhood"]);
  const category = placeCategory(place);
  const price = text(place.Price);
  const summary = placeNotes(place);
  const address = text(place.Address);
  const href = `/place.html?slug=${encodeURIComponent(placeSlug(place))}`;

  card.innerHTML = `<div class="card-top"><h3><a class="place-title-link"></a></h3>${price ? '<span class="price"></span>' : ''}</div><div class="meta"></div>${summary ? '<p class="notes"></p>' : ''}<div class="card-actions"></div>`;
  const title = card.querySelector(".place-title-link");
  title.href = href;
  title.textContent = name;
  if (price) card.querySelector(".price").textContent = price;
  [category, [city, area].filter(Boolean).join(" · ")].forEach((value, index) => {
    if (!value) return;
    const pill = document.createElement("span");
    pill.className = index === 0 ? "pill category" : "pill";
    pill.textContent = value;
    card.querySelector(".meta").appendChild(pill);
  });
  if (summary) card.querySelector(".notes").textContent = summary;
  const actions = card.querySelector(".card-actions");
  const details = document.createElement("a");
  details.href = href;
  details.className = "primary-link";
  details.textContent = "Explore this place";
  actions.appendChild(details);
  if (address) {
    const maps = document.createElement("a");
    maps.href = mapLink(address);
    maps.target = "_blank";
    maps.rel = "noopener noreferrer";
    maps.textContent = "Map ↗";
    actions.appendChild(maps);
  }
  return card;
}

function filteredPlaces() {
  const query = norm($("searchInput")?.value);
  const selectedCity = norm($("cityFilter")?.value || "All");
  const selectedCategory = norm($("categoryFilter")?.value || "All");
  const selectedCommunity = text($("placeCommunityFilter")?.value || "All");
  const linked = linkedPlaceKeysForCommunity(selectedCommunity);

  return state.places.filter(isActivePlace).filter((place) => {
    if (selectedCity !== "all" && norm(place.City) !== selectedCity) return false;
    if (selectedCategory !== "all" && norm(placeCategory(place)) !== selectedCategory) return false;
    if (linked) {
      const idMatch = text(place["Place ID"]) && linked.ids.has(norm(place["Place ID"]));
      const nameMatch = linked.names.has(`${norm(place.Place)}|${norm(place.City)}`);
      if (!idMatch && !nameMatch) return false;
    }
    if (!query) return true;
    return norm([place.Place, place.City, place.Category, place["Public Category (Auto)"], place["Area / Neighborhood"], place["Tags / Best For"], place["Client Notes"], place.Address].join(" ")).includes(query);
  });
}

function renderPlaces() {
  const grid = $("placesGrid");
  if (!grid) return;
  const results = filteredPlaces();
  grid.replaceChildren();
  results.slice(0, CONFIG.homeLimit).forEach((place) => grid.appendChild(buildPlaceCard(place)));
  if (!results.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "No places match those filters yet.";
    grid.appendChild(empty);
  }
  if ($("resultCount")) $("resultCount").textContent = `${results.length.toLocaleString()} place${results.length === 1 ? "" : "s"} to discover`;
  const viewAll = $("viewAllResults");
  if (viewAll) {
    const url = new URL("/search.html", location.origin);
    const q = text($("searchInput")?.value), city = text($("cityFilter")?.value), category = text($("categoryFilter")?.value);
    if (q) url.searchParams.set("q", q);
    if (city && norm(city) !== "all") url.searchParams.set("city", city);
    if (category && norm(category) !== "all") url.searchParams.set("category", category);
    viewAll.href = url.pathname + url.search;
    viewAll.textContent = results.length > CONFIG.homeLimit ? `View more places` : "Browse all places";
  }
}

function renderCityLinks() {
  const wrap = $("cityLinks");
  if (!wrap) return;
  wrap.replaceChildren();
  uniqSorted(state.places.filter(isActivePlace).map((place) => text(place.City))).forEach((city) => {
    const link = document.createElement("a");
    link.href = `/search.html?city=${encodeURIComponent(city)}`;
    link.textContent = city;
    wrap.appendChild(link);
  });
}

function renderFeaturedCommunities() {
  const wrap = $("featuredCommunities");
  if (!wrap) return;
  wrap.replaceChildren();
  const communities = uniqSorted(state.links.map((link) => text(link.Community))).slice(0, 6);
  communities.forEach((community) => {
    const links = state.links.filter((link) => norm(link.Community) === norm(community));
    const uniquePlaces = new Set(links.map((link) => text(link["Place ID"], `${text(link["Place (auto)"])}|${text(link["City (auto)"])}`)).filter(Boolean));
    const meta = COMMUNITY_META[norm(community)] || {};
    const brand = text(links[0]?.Brand, text(links[0]?.Builder, meta.brand || "New homes"));
    const city = text(links[0]?.["Community City"], text(links[0]?.["City"], meta.city || text(links[0]?.["City (auto)"])));
    const card = document.createElement("article");
    card.className = "featured-community-card";
    card.innerHTML = `<span class="builder-line"></span><h3></h3><p></p><a href="#explore">Get to know the neighborhood →</a>`;
    card.querySelector(".builder-line").textContent = [brand, city].filter(Boolean).join(" · ");
    card.querySelector("h3").textContent = community;
    card.querySelector("p").textContent = `${uniquePlaces.size.toLocaleString()} places to explore in the area`;
    card.querySelector("a").addEventListener("click", () => {
      const filter = $("placeCommunityFilter");
      if (filter) { filter.value = community; renderPlaces(); }
    });
    wrap.appendChild(card);
  });
  if (!communities.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "Community guides are being added.";
    wrap.appendChild(empty);
  }
}

function populateFilters() {
  const active = state.places.filter(isActivePlace);
  const cities = uniqSorted(active.map((place) => text(place.City)));
  const categories = uniqSorted(active.map(placeCategory));
  const communities = uniqSorted(state.links.map((link) => text(link.Community)));
  cities.forEach((value) => $("cityFilter")?.appendChild(option(value)));
  categories.forEach((value) => $("categoryFilter")?.appendChild(option(value)));
  communities.forEach((value) => $("placeCommunityFilter")?.appendChild(option(value)));
  if ($("placeCount")) $("placeCount").textContent = active.length.toLocaleString();
  if ($("cityCountNumber")) $("cityCountNumber").textContent = cities.length.toLocaleString();
}

function bindEvents() {
  ["searchInput", "cityFilter", "categoryFilter", "placeCommunityFilter"].forEach((id) => {
    const el = $(id);
    if (el) el.addEventListener(id === "searchInput" ? "input" : "change", renderPlaces);
  });
  $("clearFilters")?.addEventListener("click", () => {
    if ($("searchInput")) $("searchInput").value = "";
    if ($("cityFilter")) $("cityFilter").value = "All";
    if ($("categoryFilter")) $("categoryFilter").value = "All";
    if ($("placeCommunityFilter")) $("placeCommunityFilter").value = "All";
    renderPlaces();
  });
}

async function init() {
  bindEvents();
  try {
    const [places, links] = await Promise.all([fetchSheet(CONFIG.placesSheet), fetchSheet(CONFIG.linksSheet)]);
    state.places = places.filter((place) => text(place.Place));
    state.links = links.filter((link) => text(link.Community) && (text(link["Place ID"]) || text(link["Place (auto)"])));
    populateFilters();
    renderPlaces();
    renderCityLinks();
    renderFeaturedCommunities();
    if ($("dataStatus")) $("dataStatus").textContent = "Live guide connected";
  } catch (error) {
    console.error(error);
    if ($("dataStatus")) $("dataStatus").textContent = "Data feed unavailable";
    if ($("resultCount")) $("resultCount").textContent = "Could not load guide";
    const grid = $("placesGrid");
    if (grid) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = "The live directory could not load. Please refresh in a moment.";
      grid.replaceChildren(empty);
    }
  }
}

document.addEventListener("DOMContentLoaded", init);
