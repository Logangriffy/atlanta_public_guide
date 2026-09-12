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

function csvUrl(sheet) { return `https://docs.google.com/spreadsheets/d/${CONFIG.spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheet)}&_=${Date.now()}`; }
function parseCSV(input) { const rows=[]; let row=[],field="",quoted=false; for(let i=0;i<input.length;i++){const c=input[i],n=input[i+1]; if(quoted&&c==='"'&&n==='"'){field+='"';i++;} else if(c==='"')quoted=!quoted; else if(c===','&&!quoted){row.push(field);field="";} else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&n==='\n')i++;row.push(field);if(row.some(x=>x!==""))rows.push(row);row=[];field="";} else field+=c;} row.push(field);if(row.some(x=>x!==""))rows.push(row);return rows; }
function rowsToObjects(rows){if(!rows.length)return[];const headers=rows[0].map(text);return rows.slice(1).map(row=>{const obj={};headers.forEach((header,i)=>{if(header)obj[header]=text(row[i]);});return obj;});}
async function fetchSheet(sheet){const r=await fetch(csvUrl(sheet),{cache:"no-store"});if(!r.ok)throw new Error(`Could not load ${sheet}`);const body=await r.text();if(/Sign in|Request access|<!doctype html/i.test(body.slice(0,700)))throw new Error(`${sheet} feed is not publicly readable`);return rowsToObjects(parseCSV(body));}
function slugify(v){return text(v).toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/&/g," and ").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");}
function placeSlug(p){return `${slugify(p.Place)}-${slugify(p.City)}`;}
function category(p){return text(p["Public Category (Auto)"],text(p.Category,"Other"));}
function notes(p){return text(p["Client Notes"],text(p["Vibe / Good For"]));}
function uniqSorted(values){return [...new Set(values.filter(Boolean))].sort((a,b)=>a.localeCompare(b));}
function option(value,label=value){const el=document.createElement("option");el.value=value;el.textContent=label;return el;}
function isActive(p){const status=norm(p["Place Status"]);return !status||status==="active";}

function linkedKeys(community){if(!community||norm(community)==="all")return null;const ids=new Set(),names=new Set();state.links.filter(l=>norm(l.Community)===norm(community)).forEach(l=>{if(text(l["Place ID"]))ids.add(norm(l["Place ID"]));const name=text(l["Place (auto)"]),city=text(l["City (auto)"]);if(name)names.add(`${norm(name)}|${norm(city)}`);});return{ids,names};}

function buildPlaceCard(place){
  const card=document.createElement("article");card.className="place-card artifact-place-card";
  const name=text(place.Place,"Unnamed place"),city=text(place.City),area=text(place["Area / Neighborhood"]),cat=category(place),price=text(place.Price),summary=notes(place),href=`/place.html?slug=${encodeURIComponent(placeSlug(place))}`;
  card.innerHTML=`<div class="artifact-card-kicker"><span class="artifact-category"></span>${price?'<span class="price"></span>':''}</div><h3><a class="place-title-link"></a></h3><div class="artifact-location"></div>${summary?'<p class="notes"></p>':''}<a class="artifact-explore-link">Explore this place</a>`;
  card.querySelector(".artifact-category").textContent=cat;
  if(price)card.querySelector(".price").textContent=price;
  const title=card.querySelector(".place-title-link");title.href=href;title.textContent=name;
  card.querySelector(".artifact-location").textContent=[city,area].filter(Boolean).join(" · ");
  if(summary)card.querySelector(".notes").textContent=summary;
  const explore=card.querySelector(".artifact-explore-link");explore.href=href;
  return card;
}

function filteredPlaces(){
  const q=norm($("searchInput")?.value),city=norm($("cityFilter")?.value||"All"),cat=norm($("categoryFilter")?.value||"All"),community=text($("placeCommunityFilter")?.value||"All"),linked=linkedKeys(community);
  return state.places.filter(isActive).filter(p=>{
    if(city!=="all"&&norm(p.City)!==city)return false;
    if(cat!=="all"&&norm(category(p))!==cat)return false;
    if(linked){const idMatch=text(p["Place ID"])&&linked.ids.has(norm(p["Place ID"]));const nameMatch=linked.names.has(`${norm(p.Place)}|${norm(p.City)}`);if(!idMatch&&!nameMatch)return false;}
    if(!q)return true;
    return norm([p.Place,p.City,p.Category,p["Public Category (Auto)"],p["Area / Neighborhood"],p["Tags / Best For"],p["Client Notes"],p.Address].join(" ")).includes(q);
  });
}

function renderPlaces(){
  const grid=$("placesGrid");if(!grid)return;const results=filteredPlaces();grid.replaceChildren();results.slice(0,CONFIG.homeLimit).forEach(p=>grid.appendChild(buildPlaceCard(p)));
  if(!results.length){const empty=document.createElement("div");empty.className="empty-state";empty.textContent="No places match those filters yet.";grid.appendChild(empty);}
  if($("resultCount"))$("resultCount").textContent=`${results.length.toLocaleString()} place${results.length===1?"":"s"} to discover`;
  const viewAll=$("viewAllResults");if(viewAll){const url=new URL("/search.html",location.origin);const q=text($("searchInput")?.value),city=text($("cityFilter")?.value),cat=text($("categoryFilter")?.value),community=text($("placeCommunityFilter")?.value);if(q)url.searchParams.set("q",q);if(city&&norm(city)!=="all")url.searchParams.set("city",city);if(cat&&norm(cat)!=="all")url.searchParams.set("category",cat);if(community&&norm(community)!=="all")url.searchParams.set("community",community);viewAll.href=url.pathname+url.search;viewAll.textContent="View more places";}
}

function renderCityLinks(){const wrap=$("cityLinks");if(!wrap)return;wrap.replaceChildren();uniqSorted(state.places.filter(isActive).map(p=>text(p.City))).forEach(city=>{const a=document.createElement("a");a.href=`/search.html?city=${encodeURIComponent(city)}`;a.textContent=city;wrap.appendChild(a);});}

function renderFeaturedCommunities(){
  const wrap=$("featuredCommunities");if(!wrap)return;wrap.replaceChildren();const preferred=["Avery Ridge","Hunters Creek","Reunion"];const all=uniqSorted(state.links.map(l=>text(l.Community)));const communities=[...preferred.filter(p=>all.some(a=>norm(a)===norm(p))),...all.filter(a=>!preferred.some(p=>norm(p)===norm(a)))].slice(0,3);
  communities.forEach(community=>{const links=state.links.filter(l=>norm(l.Community)===norm(community));const uniquePlaces=new Set(links.map(l=>text(l["Place ID"],`${text(l["Place (auto)"])}|${text(l["City (auto)"])}`)).filter(Boolean));const meta=COMMUNITY_META[norm(community)]||{};const brand=text(links[0]?.Brand,text(links[0]?.Builder,meta.brand||"New homes"));const city=text(links[0]?.["Community City"],text(links[0]?.City,meta.city||text(links[0]?.["City (auto)"])));const card=document.createElement("article");card.className="featured-community-card";const href=`/search.html?community=${encodeURIComponent(community)}`;card.innerHTML=`<span class="builder-line"></span><h3></h3><p></p><a>Get to know the neighborhood →</a>`;card.querySelector(".builder-line").textContent=[brand,city].filter(Boolean).join(" · ");card.querySelector("h3").textContent=community;card.querySelector("p").textContent=`${uniquePlaces.size.toLocaleString()} places to explore in the area`;card.querySelector("a").href=href;wrap.appendChild(card);});
}

function populate(){const active=state.places.filter(isActive),cities=uniqSorted(active.map(p=>text(p.City))),cats=uniqSorted(active.map(category)),communities=uniqSorted(state.links.map(l=>text(l.Community)));cities.forEach(v=>$("cityFilter")?.appendChild(option(v)));cats.forEach(v=>$("categoryFilter")?.appendChild(option(v)));communities.forEach(v=>$("placeCommunityFilter")?.appendChild(option(v)));if($("placeCount"))$("placeCount").textContent=active.length.toLocaleString();if($("cityCountNumber"))$("cityCountNumber").textContent=cities.length.toLocaleString();}
function bind(){["searchInput","cityFilter","categoryFilter","placeCommunityFilter"].forEach(id=>{const el=$(id);if(el)el.addEventListener(id==="searchInput"?"input":"change",renderPlaces);});$("clearFilters")?.addEventListener("click",()=>{if($("searchInput"))$("searchInput").value="";if($("cityFilter"))$("cityFilter").value="All";if($("categoryFilter"))$("categoryFilter").value="All";if($("placeCommunityFilter"))$("placeCommunityFilter").value="All";renderPlaces();});}
async function init(){bind();try{const[places,links]=await Promise.all([fetchSheet(CONFIG.placesSheet),fetchSheet(CONFIG.linksSheet)]);state.places=places.filter(p=>text(p.Place));state.links=links.filter(l=>text(l.Community)&&(text(l["Place ID"])||text(l["Place (auto)"])));populate();renderPlaces();renderCityLinks();renderFeaturedCommunities();if($("dataStatus"))$("dataStatus").textContent="";}catch(error){console.error(error);if($("dataStatus"))$("dataStatus").textContent="Data feed unavailable";if($("resultCount"))$("resultCount").textContent="Could not load guide";const grid=$("placesGrid");if(grid){const empty=document.createElement("div");empty.className="empty-state";empty.textContent="The live directory could not load. Please refresh in a moment.";grid.replaceChildren(empty);}}}
document.addEventListener("DOMContentLoaded",init);
