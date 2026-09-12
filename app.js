const CONFIG = {
  spreadsheetId: "1vnIouZJf1iCYqDfFF6A4gDkfEk-hsSVEhLtPXcFDcB0",
  placesSheet: "Places",
  linksSheet: "CommunityLinks",
  homeLimit: 10,
};

const state = { places: [], links: [] };
const $ = (id) => document.getElementById(id);
const text = (value, fallback = "") => String(value ?? fallback).trim();

function csvUrl(sheet) {
  return `https://docs.google.com/spreadsheets/d/${CONFIG.spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheet)}&_=${Date.now()}`;
}

function parseCSV(source) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    const next = source[i + 1];
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
  const headers = rows[0].map((h) => text(h));
  return rows.slice(1).map((row) => {
    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = text(row[index]);
    });
    return obj;
  });
}

async function fetchSheet(sheet) {
  const response = await fetch(csvUrl(sheet), { cache: "no-store" });
  if (!response.ok) throw new Error(`Could not load ${sheet}`);
  const body = await response.text();
  if (/Sign in|Request access|<!doctype html/i.test(body.slice(0, 500))) {
    throw new Error("Public data feed is not readable");
  }
  return rowsToObjects(parseCSV(body));
}

function slugify(value) {
  return text(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function placeSlug(place) {
  return `${slugify(place.Place)}-${slugify(place.City)}`;
}

function publicCategory(place) {
  return text(place["Public Category (Auto)"], text(place.Category, "Other"));
}

function publicNotes(place) {
  return text(place["Client Notes"], text(place["Vibe / Good For"]));
}

function mapLink(address) {
  return address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}` : "";
}

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function addOption(select, value, label = value) {
  if (!select) return;
  const option = document.createElement("option");
  option.value = value;
  option.textContent = label;
  select.appendChild(option);
}

function buildPlaceCard(place) {
  const card = document.createElement("article");
  card.className = "place-card";

  const name = text(place.Place, "Unnamed place");
  const city = text(place.City);
  const category = publicCategory(place);
  const price = text(place.Price);
  const summary = publicNotes(place);
  const address = text(place.Address);
  const detailHref = `/place.html?slug=${encodeURIComponent(placeSlug(place))}`;

  const top = document.createElement("div");
  top.className = "card-top";

  const heading = document.createElement("h3");
  const titleLink = document.createElement("a");
  titleLink.className = "place-title-link";
  titleLink.href = detailHref;
  titleLink.textContent = name;
  heading.appendChild(titleLink);
  top.appendChild(heading);

  if (price) {
    const priceEl = document.createElement("span");
    priceEl.className = "price";
    priceEl.textContent = price;
    top.appendChild(priceEl);
  }
  card.appendChild(top);

  const meta = document.createElement("div");
  meta.className = "meta";
  [city, category].forEach((value, index) => {
    if (!value) return;
    const pill = document.createElement("span");
    pill.className = index ? "pill category" : "pill";
    pill.textContent = value;
    meta.appendChild(pill);
  });
  card.appendChild(meta);

  if (summary) {
    const notes = document.createElement("p");
    notes.className = "notes";
    notes.textContent = summary;
    card.appendChild(notes);
  }

  const actions = document.createElement("div");
  actions.className = "card-actions";

  const details = document.createElement("a");
  details.href = detailHref;
  details.className = "primary-link";
  details.textContent = "View details";
  actions.appendChild(details);

  if (address) {
    const map = document.createElement("a");
    map.href = mapLink(address);
    map.target = "_blank";
    map.rel = "noopener noreferrer";
    map.textContent = "Map ↗";
    actions.appendChild(map);
  }

  card.appendChild(actions);
  return card;
}

function filteredPlaces() {
  const searchInput = $("searchInput");
  const cityFilter = $("cityFilter");
  const categoryFilter = $("categoryFilter");
  if (!searchInput || !cityFilter || !categoryFilter) return [];

  const query = searchInput.value.trim().toLowerCase();
  const city = cityFilter.value;
  const category = categoryFilter.value;

  return state.places.filter((place) => {
    const status = text(place["Place Status"]);
    if (status && status !== "Active") return false;
    if (city !== "All" && text(place.City) !== city) return false;
    if (category !== "All" && publicCategory(place) !== category) return false;
    if (!query) return true;

    const haystack = [
      place.Place,
      place.City,
      place.Category,
      place["Public Category (Auto)"],
      place["Area / Neighborhood"],
      place["Tags / Best For"],
      place["Client Notes"],
      place.Address,
    ].join(" ").toLowerCase();

    return haystack.includes(query);
  });
}

function updateViewAllLink(results) {
  const link = $("viewAllResults");
  if (!link) return;

  const url = new URL("/search.html", location.origin);
  const query = $("searchInput")?.value.trim() || "";
  const city = $("cityFilter")?.value || "All";
  const category = $("categoryFilter")?.value || "All";

  if (query) url.searchParams.set("q", query);
  if (city !== "All") url.searchParams.set("city", city);
  if (category !== "All") url.searchParams.set("category", category);

  link.href = url.pathname + url.search;
  link.textContent = results.length > CONFIG.homeLimit
    ? `View all ${results.length.toLocaleString()} results →`
    : "Open full directory →";
}

function renderPlaces() {
  const grid = $("placesGrid");
  const count = $("resultCount");
  if (!grid || !count) return;

  const results = filteredPlaces();
  grid.replaceChildren();

  for (const place of results.slice(0, CONFIG.homeLimit)) {
    try {
      grid.appendChild(buildPlaceCard(place));
    } catch (error) {
      console.error("Could not render place", place?.Place, error);
    }
  }

  count.textContent = `${results.length.toLocaleString()} place${results.length === 1 ? "" : "s"}${results.length > CONFIG.homeLimit ? ` · showing first ${CONFIG.homeLimit}` : ""}`;

  if (!grid.children.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = results.length ? "Matching places were found, but could not be displayed." : "No places match those filters yet.";
    grid.appendChild(empty);
  }

  updateViewAllLink(results);
}

function communityStatus(link) {
  const minutes = text(link["Drive minutes"]);
  if (minutes) return `${minutes} min · Route verified`;
  return /verified/i.test(text(link["Link status"])) ? "Route verified" : "Surrounding area";
}

function renderCommunities() {
  const communityFilter = $("communityFilter");
  const categoryFilter = $("communityCategoryFilter");
  const grid = $("communityResults");
  if (!communityFilter || !categoryFilter || !grid) return;

  const community = communityFilter.value;
  const category = categoryFilter.value;
  grid.replaceChildren();

  if (!community) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "Choose a community to see nearby places.";
    grid.appendChild(empty);
    return;
  }

  const placesById = new Map(state.places.map((place) => [text(place["Place ID"]), place]));
  const links = state.links
    .filter((link) => text(link.Community) === community)
    .filter((link) => category === "All" || text(link["Use category"]) === category)
    .slice(0, 12);

  for (const link of links) {
    const place = placesById.get(text(link["Place ID"]));
    if (!place) continue;

    const card = document.createElement("article");
    card.className = "community-card";
    const detailHref = `/place.html?slug=${encodeURIComponent(placeSlug(place))}`;

    const title = document.createElement("h3");
    const titleLink = document.createElement("a");
    titleLink.className = "place-title-link";
    titleLink.href = detailHref;
    titleLink.textContent = text(place.Place);
    title.appendChild(titleLink);
    card.appendChild(title);

    const meta = document.createElement("div");
    meta.className = "meta";
    [text(place.City), text(link["Use category"])].forEach((value, index) => {
      if (!value) return;
      const pill = document.createElement("span");
      pill.className = index ? "pill category" : "pill";
      pill.textContent = value;
      meta.appendChild(pill);
    });
    card.appendChild(meta);

    const status = document.createElement("span");
    status.className = "status";
    status.textContent = communityStatus(link);
    card.appendChild(status);

    const note = publicNotes(place);
    if (note) {
      const p = document.createElement("p");
      p.className = "community-notes";
      p.textContent = note;
      card.appendChild(p);
    }

    const details = document.createElement("a");
    details.href = detailHref;
    details.className = "community-detail-link";
    details.textContent = "View details →";
    card.appendChild(details);

    grid.appendChild(card);
  }

  if (!grid.children.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "No matching linked places yet.";
    grid.appendChild(empty);
  }
}

function populateFilters() {
  const cityFilter = $("cityFilter");
  const categoryFilter = $("categoryFilter");
  const communityFilter = $("communityFilter");
  const communityCategoryFilter = $("communityCategoryFilter");

  uniqueSorted(state.places.map((place) => text(place.City))).forEach((value) => addOption(cityFilter, value));
  uniqueSorted(state.places.map(publicCategory)).forEach((value) => addOption(categoryFilter, value));
  uniqueSorted(state.links.map((link) => text(link.Community))).forEach((value) => addOption(communityFilter, value));
  uniqueSorted(state.links.map((link) => text(link["Use category"]))).forEach((value) => addOption(communityCategoryFilter, value));

  if ($("placeCount")) $("placeCount").textContent = state.places.length.toLocaleString();
  if ($("cityCount")) $("cityCount").textContent = `${uniqueSorted(state.places.map((place) => text(place.City))).length} cities`;
  if ($("categoryCount")) $("categoryCount").textContent = `${uniqueSorted(state.places.map(publicCategory)).length} categories`;
}

function bindEvents() {
  ["searchInput", "cityFilter", "categoryFilter"].forEach((id) => {
    const element = $(id);
    if (!element) return;
    element.addEventListener(id === "searchInput" ? "input" : "change", renderPlaces);
  });

  $("clearFilters")?.addEventListener("click", () => {
    if ($("searchInput")) $("searchInput").value = "";
    if ($("cityFilter")) $("cityFilter").value = "All";
    if ($("categoryFilter")) $("categoryFilter").value = "All";
    renderPlaces();
  });

  ["communityFilter", "communityCategoryFilter"].forEach((id) => {
    $(id)?.addEventListener("change", renderCommunities);
  });
}

async function init() {
  bindEvents();

  try {
    const [places, links] = await Promise.all([
      fetchSheet(CONFIG.placesSheet),
      fetchSheet(CONFIG.linksSheet),
    ]);

    state.places = places.filter((place) => text(place.Place));
    state.links = links.filter((link) => text(link["Place ID"]));

    populateFilters();
    renderPlaces();
    renderCommunities();

    if ($("dataStatus")) $("dataStatus").textContent = "Live data connected";
  } catch (error) {
    console.error("Guide initialization failed", error);
    if ($("dataStatus")) $("dataStatus").textContent = "Data feed unavailable";
    if ($("resultCount")) $("resultCount").textContent = "Guide unavailable";
    const grid = $("placesGrid");
    if (grid) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = "The directory could not load. Please refresh in a moment.";
      grid.replaceChildren(empty);
    }
  }
}

document.addEventListener("DOMContentLoaded", init);