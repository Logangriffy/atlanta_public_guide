const CONFIG = { spreadsheetId: "1vnIouZJf1iCYqDfFF6A4gDkfEk-hsSVEhLtPXcFDcB0", sheet: "Places", pageSize: 30 };
const state = { places: [], visible: CONFIG.pageSize };
const $ = (id) => document.getElementById(id);
const text = (value, fallback = "") => String(value ?? fallback).trim();
const norm = (value) => text(value).normalize("NFKC").replace(/\s+/g, " ").toLowerCase();

function csvUrl() { return `https://docs.google.com/spreadsheets/d/${CONFIG.spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(CONFIG.sheet)}&_=${Date.now()}`; }
function parseCSV(input) { const rows=[]; let row=[],field="",quoted=false; for(let i=0;i<input.length;i++){const c=input[i],n=input[i+1]; if(quoted&&c==='"'&&n==='"'){field+='"';i++;} else if(c==='"')quoted=!quoted; else if(c===','&&!quoted){row.push(field);field="";} else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&n==='\n')i++; row.push(field); if(row.some(x=>x!==""))rows.push(row); row=[]; field="";} else field+=c;} row.push(field); if(row.some(x=>x!==""))rows.push(row); return rows; }
function rowsToObjects(rows){if(!rows.length)return[];const headers=rows[0].map(text);return rows.slice(1).map(row=>{const obj={};headers.forEach((header,i)=>{if(header)obj[header]=text(row[i]);});return obj;});}
function slugify(value){return text(value).toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/&/g," and ").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");}
function placeSlug(place){return `${slugify(place.Place)}-${slugify(place.City)}`;}
function category(place){return text(place["Public Category (Auto)"],text(place.Category,"Other"));}
function notes(place){return text(place["Client Notes"],text(place["Vibe / Good For"]));}
function mapLink(address){return address?`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`:"";}
function uniqSorted(values){return [...new Set(values.filter(Boolean))].sort((a,b)=>a.localeCompare(b));}
function option(value,label=value){const el=document.createElement("option");el.value=value;el.textContent=label;return el;}
function isActive(place){const status=norm(place["Place Status"]);return !status||status==="active";}

function buildCard(place){
  const card=document.createElement("article");card.className="place-card";
  const city=text(place.City),cat=category(place),price=text(place.Price),summary=notes(place),address=text(place.Address),website=text(place["Website / Source"]),href=`/places/${encodeURIComponent(placeSlug(place))}`;
  card.innerHTML=`<div class="card-top"><h3><a class="place-title-link"></a></h3>${price?'<span class="price"></span>':''}</div><div class="meta"></div>${summary?'<p class="notes"></p>':''}<div class="card-actions"></div>`;
  const title=card.querySelector(".place-title-link");title.textContent=text(place.Place,"Unnamed place");title.href=href;if(price)card.querySelector(".price").textContent=price;
  [city,cat].forEach((value,index)=>{if(!value)return;const pill=document.createElement("span");pill.className=index?"pill category":"pill";pill.textContent=value;card.querySelector(".meta").appendChild(pill);});
  if(summary)card.querySelector(".notes").textContent=summary;
  const actions=card.querySelector(".card-actions");const details=document.createElement("a");details.href=href;details.textContent="View details";details.className="primary-link";actions.appendChild(details);
  if(address){const maps=document.createElement("a");maps.href=mapLink(address);maps.target="_blank";maps.rel="noopener noreferrer";maps.textContent="Map ↗";actions.appendChild(maps);}
  if(website){const web=document.createElement("a");web.href=website;web.target="_blank";web.rel="noopener noreferrer";web.textContent="Website ↗";actions.appendChild(web);}
  return card;
}

function filteredPlaces(){
  const query=norm($("searchInput")?.value),city=norm($("cityFilter")?.value||"All"),cat=norm($("categoryFilter")?.value||"All"),sort=text($("sortFilter")?.value,"name");
  let results=state.places.filter(isActive).filter(place=>{
    if(city!=="all"&&norm(place.City)!==city)return false;
    if(cat!=="all"&&norm(category(place))!==cat)return false;
    if(!query)return true;
    return norm([place.Place,place.City,place.Category,place["Public Category (Auto)"],place["Area / Neighborhood"],place["Tags / Best For"],place["Client Notes"],place.Address].join(" ")).includes(query);
  });
  results.sort((a,b)=>sort==="city"?(text(a.City).localeCompare(text(b.City))||text(a.Place).localeCompare(text(b.Place))):text(a.Place).localeCompare(text(b.Place)));
  return results;
}

function renderCityDirectory(){const wrap=$("searchCityDirectory");if(!wrap)return;wrap.replaceChildren();const active=state.places.filter(isActive),counts=new Map();active.forEach(p=>{const city=text(p.City);if(city)counts.set(city,(counts.get(city)||0)+1)});[...counts.entries()].sort((a,b)=>a[0].localeCompare(b[0])).forEach(([city,count])=>{const a=document.createElement("a");a.className="search-city-link";a.href=`/cities/${slugify(city)}`;a.innerHTML=`<span></span><small></small><b>↗</b>`;a.querySelector("span").textContent=city;a.querySelector("small").textContent=`${count} place${count===1?"":"s"} in the guide`;wrap.appendChild(a)})}
function syncUrl(){const url=new URL(location.href);const q=text($("searchInput")?.value),city=text($("cityFilter")?.value),categoryValue=text($("categoryFilter")?.value);if(q)url.searchParams.set("q",q);else url.searchParams.delete("q");if(city&&norm(city)!=="all")url.searchParams.set("city",city);else url.searchParams.delete("city");if(categoryValue&&norm(categoryValue)!=="all")url.searchParams.set("category",categoryValue);else url.searchParams.delete("category");history.replaceState(null,"",url);}
function render(reset=false){if(reset)state.visible=CONFIG.pageSize;const results=filteredPlaces(),grid=$("placesGrid");if(!grid)return;grid.replaceChildren();results.slice(0,state.visible).forEach(place=>grid.appendChild(buildCard(place)));if($("resultCount"))$("resultCount").textContent=`${results.length.toLocaleString()} place${results.length===1?"":"s"}`;if($("loadMore"))$("loadMore").hidden=state.visible>=results.length;if(!results.length){const empty=document.createElement("div");empty.className="empty-state";empty.textContent="No places match those filters yet. Try clearing a filter or searching a broader term.";grid.appendChild(empty);}syncUrl();}
function seedFilters(){uniqSorted(state.places.filter(isActive).map(p=>text(p.City))).forEach(v=>$("cityFilter")?.appendChild(option(v)));uniqSorted(state.places.filter(isActive).map(category)).forEach(v=>$("categoryFilter")?.appendChild(option(v)));const url=new URL(location.href);if($("searchInput"))$("searchInput").value=url.searchParams.get("q")||"";const city=url.searchParams.get("city"),cat=url.searchParams.get("category");if(city&&$("cityFilter")){const match=[...$("cityFilter").options].find(o=>norm(o.value)===norm(city));if(match)$("cityFilter").value=match.value;}if(cat&&$("categoryFilter")){const match=[...$("categoryFilter").options].find(o=>norm(o.value)===norm(cat));if(match)$("categoryFilter").value=match.value;}}
function bind(){["searchInput","cityFilter","categoryFilter","sortFilter"].forEach(id=>{const el=$(id);if(el)el.addEventListener(id==="searchInput"?"input":"change",()=>render(true));});$("clearFilters")?.addEventListener("click",()=>{$("searchInput").value="";$("cityFilter").value="All";$("categoryFilter").value="All";$("sortFilter").value="name";render(true);});$("loadMore")?.addEventListener("click",()=>{state.visible+=CONFIG.pageSize;render();});}
async function init(){bind();try{const response=await fetch(csvUrl(),{cache:"no-store"});if(!response.ok)throw new Error("Places feed request failed");const body=await response.text();if(/Sign in|Request access|<!doctype html/i.test(body.slice(0,700)))throw new Error("Places feed is not public");state.places=rowsToObjects(parseCSV(body)).filter(p=>text(p.Place));seedFilters();renderCityDirectory();render(true);if($("dataStatus"))$("dataStatus").textContent="Live data connected";}catch(error){console.error(error);if($("dataStatus"))$("dataStatus").textContent="Data feed unavailable";if($("resultCount"))$("resultCount").textContent="Could not load guide";const grid=$("placesGrid");if(grid){const empty=document.createElement("div");empty.className="empty-state";empty.textContent="The live directory could not load. Please refresh in a moment.";grid.replaceChildren(empty);}}}
document.addEventListener("DOMContentLoaded",init);
