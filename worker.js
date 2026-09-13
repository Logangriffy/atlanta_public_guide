const json=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'public, max-age=60, stale-while-revalidate=300',...headers}});
const text=v=>String(v??'').trim();
const bool=v=>/^(1|true|yes|featured)$/i.test(text(v));

function legacyPlace(row,images=[]){
  return {
    'Place ID': row.place_id,
    'Place': row.name,
    'City': row.city,
    'Area / Neighborhood': row.area || '',
    'Category': row.source_category || row.category || '',
    'Price': row.price || '',
    'Vibe / Good For': row.vibe || '',
    'Tags / Best For': row.tags || '',
    'Address': row.address || '',
    'Website / Source': row.website_url || '',
    'Parking': row.parking || '',
    'Reservations?': row.reservations || '',
    'Patio?': row.patio || '',
    'Kid Friendly?': row.kid_friendly || '',
    'Dog Friendly?': row.dog_friendly || '',
    'Dress Level': row.dress_level || '',
    'Place Status': row.status || 'Active',
    'Hours / Schedule': row.hours || '',
    'Pricing Details': row.pricing_details || '',
    'Public Category (Auto)': row.category || row.source_category || 'Other',
    'Public Summary': row.public_summary || '',
    'URL Slug': row.slug || '',
    'Why Go': row.why_go || '',
    'Featured': row.featured ? 'TRUE' : '',
    'Last Verified': row.last_verified || '',
    'Hero Image URL': images[0]?.image_url || '',
    'Image Credit': images[0]?.credit || row.city_hero_image_credit || '',
    'Gallery Image 2 URL': images[1]?.image_url || '',
    'Gallery Image 3 URL': images[2]?.image_url || '',
    'Gallery Image 4 URL': images[3]?.image_url || '',
    'City Hero Image URL': row.city_hero_image_url || '',
    'City Hero Image Credit': row.city_hero_image_credit || ''
  };
}

async function allPlaces(env,url){
  const q=text(url.searchParams.get('q')).toLowerCase();
  const city=text(url.searchParams.get('city'));
  const category=text(url.searchParams.get('category'));
  const featured=url.searchParams.get('featured');
  const limit=Math.min(Math.max(Number(url.searchParams.get('limit')||1000),1),2000);
  const where=["LOWER(p.status)='active'"];
  const params=[];
  if(city){where.push('LOWER(c.name)=LOWER(?)');params.push(city)}
  if(category){where.push('LOWER(p.category)=LOWER(?)');params.push(category)}
  if(featured!==null){where.push('p.featured=?');params.push(bool(featured)?1:0)}
  if(q){where.push('(LOWER(p.name) LIKE ? OR LOWER(COALESCE(p.area,\'\')) LIKE ? OR LOWER(COALESCE(p.category,\'\')) LIKE ? OR LOWER(COALESCE(p.public_summary,\'\')) LIKE ?)');const needle=`%${q}%`;params.push(needle,needle,needle,needle)}
  params.push(limit);
  const sql=`SELECT p.*, c.name AS city, c.hero_image_url AS city_hero_image_url, c.hero_image_credit AS city_hero_image_credit FROM places p JOIN cities c ON c.id=p.city_id WHERE ${where.join(' AND ')} ORDER BY p.featured DESC,p.name COLLATE NOCASE ASC LIMIT ?`;
  const result=await env.DB.prepare(sql).bind(...params).all();
  const rows=result.results||[];
  if(!rows.length)return json([]);
  const ids=rows.map(r=>r.place_id);
  const placeholders=ids.map(()=>'?').join(',');
  const imageResult=await env.DB.prepare(`SELECT place_id,image_url,credit,position FROM place_images WHERE place_id IN (${placeholders}) ORDER BY place_id,position`).bind(...ids).all();
  const byId=new Map();
  for(const image of imageResult.results||[]){if(!byId.has(image.place_id))byId.set(image.place_id,[]);byId.get(image.place_id).push(image)}
  return json(rows.map(r=>legacyPlace(r,byId.get(r.place_id)||[])));
}

async function onePlace(env,slug){
  const row=await env.DB.prepare(`SELECT p.*, c.name AS city, c.hero_image_url AS city_hero_image_url, c.hero_image_credit AS city_hero_image_credit FROM places p JOIN cities c ON c.id=p.city_id WHERE LOWER(p.status)='active' AND (p.slug=? OR p.place_id=?) LIMIT 1`).bind(slug,slug).first();
  if(!row)return json({error:'Place not found'},404);
  const images=(await env.DB.prepare('SELECT place_id,image_url,credit,position FROM place_images WHERE place_id=? ORDER BY position').bind(row.place_id).all()).results||[];
  return json(legacyPlace(row,images));
}

async function cities(env){
  const result=await env.DB.prepare(`SELECT c.name,c.slug,c.summary,c.hero_image_url,c.hero_image_credit,COUNT(p.place_id) AS place_count,SUM(CASE WHEN p.featured=1 THEN 1 ELSE 0 END) AS featured_count FROM cities c LEFT JOIN places p ON p.city_id=c.id AND LOWER(p.status)='active' WHERE c.active=1 GROUP BY c.id ORDER BY c.name COLLATE NOCASE`).all();
  return json(result.results||[]);
}

async function health(env){
  try{
    const places=await env.DB.prepare("SELECT COUNT(*) AS n FROM places WHERE LOWER(status)='active'").first();
    const citiesCount=await env.DB.prepare('SELECT COUNT(*) AS n FROM cities WHERE active=1').first();
    const images=await env.DB.prepare('SELECT COUNT(*) AS n FROM place_images').first();
    return json({ok:true,source:'d1',places:Number(places?.n||0),cities:Number(citiesCount?.n||0),images:Number(images?.n||0)});
  }catch(error){return json({ok:false,source:'d1',error:error?.message||'Database unavailable'},503,{'cache-control':'no-store'})}
}

export default {
  async fetch(request,env){
    const url=new URL(request.url);
    if(url.pathname==='/api/health')return health(env);
    if(url.pathname==='/api/cities')return cities(env);
    if(url.pathname==='/api/places')return allPlaces(env,url);
    if(url.pathname.startsWith('/api/places/'))return onePlace(env,decodeURIComponent(url.pathname.slice('/api/places/'.length)));
    return env.ASSETS.fetch(request);
  }
};
