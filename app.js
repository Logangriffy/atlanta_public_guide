const CONFIG = {
  spreadsheetId: "1vnIouZJf1iCYqDfFF6A4gDkfEk-hsSVEhLtPXcFDcB0",
  placesSheet: "Places",
  linksSheet: "CommunityLinks",
  homeLimit: 10,
  communityLimit: 18,
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
  if (/Sign in|Request access|<!doctype html/i.test(body.slice(0, 700))) {
    throw new Error(`${sheet} feed is not publicly readable`);
  }
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

function buildPlaceCard(place) {
  const card = document.createElement("article");
  card.className = "place-card";
  const name = text(place.Place, "Unnamed place");
  const city = text(place.City);
  const category = placeCategory(place);
  const price = text(place.Price);
  const summary = placeNotes(place);
  const address = text(place.Address);
  const href = `/place.html?slug=${encodeURIComponent(placeSlug(place))}`;

  card.innerHTML = `<div class="card-top"><h3><a class="place-title-link"></a></h3>${price ? '<span class="price"></span>' : ''}</div><div class="meta"></div>${summary ? '<p class="notes"></p>' : ''}<div class="card-actions"></div>`;
  const title = card.querySelector(".place-title-link");
  title.href = href; title.textContent = name;
  if (price) card.querySelector(".price").textContent = price;
  [city, category].forEach((value, index) => {
    if (!value) return;
    const pill = document.createElement("span");
    pill.className = index ? "pill category" : "pill";
    pill.textContent = value;
    card.querySelector(".meta").appendChild(pill);
  });
  if (summary) card.querySelector(".notes").textContent = summary;
  const actions = card.querySelector(".card-actions");
  const details = document.createElement("a"); details.href = href; details.className = "primary-link"; details.textContent = "View details"; actions.appendChild(details);
  if (address) { const maps = document.createElement("a"); maps.href = mapLink(address); maps.target = "_blank"; maps.rel = "noopener noreferrer"; maps.textContent = "Map ↗"; actions.appendChild(maps); }
  return card;
}

function filteredPlaces() {
  const query = norm($("searchInput")?.value);
  const selectedCity = norm($("cityFilter")?.value || "All");
  const selectedCategory = norm($("categoryFilter")?.value || "All");
  return state.places.filter(isActivePlace).filter((place) => {
    if (selectedCity !== "all" && norm(place.City) !== selectedCity) return false;
    if (selectedCategory !== "all" && norm(placeCategory(place)) !== selectedCategory) return false;
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
  const count = $("resultCount");
  if (count) count.textContent = `${results.length.toLocaleString()} place${results.length === 1 ? "" : "s"}${results.length > CONFIG.homeLimit ? ` · showing first ${CONFIG.homeLimit}` : ""}`;
  if (!results.length) {
    const empty = document.createElement("div"); empty.className = "empty-state"; empty.textContent = "No places match those filters yet."; grid.appendChild(empty);
  }
  const viewAll = $("viewAllResults");
  if (viewAll) {
    const url = new URL("/search.html", location.origin);
    const q = text($("searchInput")?.value), city = text($("cityFilter")?.value), category = text($("categoryFilter")?.value);
    if (q) url.searchParams.set("q", q);
    if (city && norm(city) !== "all") url.searchParams.set("city", city);
    if (category && norm(category) !== "all") url.searchParams.set("category", category);
    viewAll.href = url.pathname + url.search;
    viewAll.textContent = results.length > CONFIG.homeLimit ? `View all ${results.length.toLocaleString()} results →` : "Open full directory →";
  }
}

function communityStatus(link) {
  const minutes = text(link["Drive minutes"]);
  if (minutes) return `${minutes} min · Route verified`;
  if (/verified/i.test(text(link["Link status"]))) return "Route verified";
  return "Surrounding area";
}

function renderCommunities() {
  const grid = $("communityResults");
  if (!grid) return;
  grid.replaceChildren();
  const community = text($("communityFilter")?.value);
  const category = text($("communityCategoryFilter")?.value || "All");
  if (!community) { const empty = document.createElement("div"); empty.className = "empty-state"; empty.textContent = "Choose a community to see nearby places."; grid.appendChild(empty); return; }

  const communityKey = norm(community), categoryKey = norm(category);
  const byId = new Map(state.places.map((place) => [norm(place["Place ID"]), place]));
  const byNameCity = new Map(state.places.map((place) => [`${norm(place.Place)}|${norm(place.City)}`, place]));

  let links = state.links.filter((link) => norm(link.Community) === communityKey && norm(link["Place status (auto)"] || "Active") !== "inactive");
  if (categoryKey !== "all") {
    links = links.filter((link) => {
      if (norm(link["Use category"]) === categoryKey) return true;
      const place = byId.get(norm(link["Place ID"])) || byNameCity.get(`${norm(link["Place (auto)"])}|${norm(link["City (auto)"])}`);
      return place && norm(placeCategory(place)) === categoryKey;
    });
  }
  links = links.slice(0, CONFIG.communityLimit);

  for (const link of links) {
    const place = byId.get(norm(link["Place ID"])) || byNameCity.get(`${norm(link["Place (auto)"])}|${norm(link["City (auto)"])}`);
    const name = place ? text(place.Place) : text(link["Place (auto)"], "Place");
    const city = place ? text(place.City) : text(link["City (auto)"]);
    const displayCategory = text(link["Use category"], place ? placeCategory(place) : "");
    const summary = text(link["Client note (auto)"], place ? placeNotes(place) : "");
    const card = document.createElement("article");
    card.className = "community-card";
    const href = place ? `/place.html?slug=${encodeURIComponent(placeSlug(place))}` : "";
    card.innerHTML = `<h3>${href ? '<a class="place-title-link"></a>' : '<span class="place-title-text"></span>'}</h3><div class="meta"></div><span class="status"></span>${summary ? '<p class="community-notes"></p>' : ''}${href ? '<a class="community-detail-link"></a>' : ''}`;
    const titleNode = card.querySelector(".place-title-link") || card.querySelector(".place-title-text");
    titleNode.textContent = name;
    if (href) titleNode.href = href;
    card.querySelector(".status").textContent = communityStatus(link);
    if (summary) card.querySelector(".community-notes").textContent = summary;
    [city, displayCategory].forEach((value, index) => { if (!value) return; const pill = document.createElement("span"); pill.className = index ? "pill category" : "pill"; pill.textContent = value; card.querySelector(".meta").appendChild(pill); });
    const detail = card.querySelector(".community-detail-link"); if (detail) { detail.href = href; detail.textContent = "View details →"; }
    grid.appendChild(card);
  }

  if (!links.length) {
    const empty = document.createElement("div"); empty.className = "empty-state"; empty.textContent = "No matching linked places yet for this community and category."; grid.appendChild(empty);
  }
}

function populateFilters() {
  uniqSorted(state.places.filter(isActivePlace).map((place) => text(place.City))).forEach((value) => $("cityFilter")?.appendChild(option(value)));
  uniqSorted(state.places.filter(isActivePlace).map(placeCategory)).forEach((value) => $("categoryFilter")?.appendChild(option(value)));
  uniqSorted(state.links.map((link) => text(link.Community))).forEach((value) => $("communityFilter")?.appendChild(option(value)));
  uniqSorted(state.links.map((link) => text(link["Use category"]))).forEach((value) => $("communityCategoryFilter")?.appendChild(option(value)));
  if ($("placeCount")) $("placeCount").textContent = state.places.filter(isActivePlace).length.toLocaleString();
  if ($("cityCount")) $("cityCount").textContent = `${uniqSorted(state.places.filter(isActivePlace).map((p) => text(p.City))).length} cities`;
  if ($("categoryCount")) $("categoryCount").textContent = `${uniqSorted(state.places.filter(isActivePlace).map(placeCategory).length ? state.places.filter(isActivePlace).map(placeCategory) : []).length} categories`;
}

function bindEvents() {
  ["searchInput", "cityFilter", "categoryFilter"].forEach((id) => { const el = $(id); if (el) el.addEventListener(id === "searchInput" ? "input" : "change", renderPlaces); });
  $("clearFilters")?.addEventListener("click", () => { $("searchInput").value = ""; $("cityFilter").value = "All"; $("categoryFilter").value = "All"; renderPlaces(); });
  ["communityFilter", "communityCategoryFilter"].forEach((id) => $(id)?.addEventListener("change", renderCommunities));
}

async function init() {
  bindEvents();
  try {
    const [places, links] = await Promise.all([fetchSheet(CONFIG.placesSheet), fetchSheet(CONFIG.linksSheet)]);
    state.places = places.filter((place) => text(place.Place));
    state.links = links.filter((link) => text(link.Community) && (text(link["Place ID"]) || text(link["Place (auto)"])));
    populateFilters();
    renderPlaces();
    renderCommunities();
    if ($("dataStatus")) $("dataStatus").textContent = "Live data connected";
  } catch (error) {
    console.error(error);
    if ($("dataStatus")) $("dataStatus").textContent = "Data feed unavailable";
    if ($("resultCount")) $("resultCount").textContent = "Could not load guide";
    const grid = $("placesGrid");
    if (grid) { const empty = document.createElement("div"); empty.className = "empty-state"; empty.textContent = "The live directory could not load. Please refresh in a moment."; grid.replaceChildren(empty); }
  }
}

document.addEventListener("DOMContentLoaded", init);
