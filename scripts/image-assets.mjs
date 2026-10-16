/**
 * Vendor real public game artwork so deployments never depend on hot-linked images.
 * Names and image URLs are read from the official Marvel Rivals public catalog.
 * No remote JavaScript is evaluated. Existing verified files survive fetch failures.
 * Optional SHARP_MODULE_PATH enables WebP compression during asset maintenance.
 */
import { readFile, writeFile, mkdir, rename, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const OFFICIAL = 'https://www.marvelrivals.com/';
const MANIFEST = resolve(ROOT, 'data/asset-manifest.json');
const normalize = value => String(value || '').normalize('NFKD').replace(/&amp;/g, '&').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&#39;/g, "'").replace(/&quot;/g, '"').toLowerCase().replace(/[^a-z0-9]+/g, '');
const strip = value => String(value || '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&#(?:x([a-f0-9]+)|(\d+));/gi,(_,hex,dec)=>String.fromCodePoint(Math.min(0x10ffff,parseInt(hex||dec,hex?16:10)))).trim();
const aliases = { gorr: 'gorrthegodbutcher', jubileejubilationlee: 'jubilee' };
const canon = name => aliases[normalize(name)] || normalize(name);
const safeUrl = (raw, base = OFFICIAL) => {
  const url = new URL(raw, base);
  if (url.protocol !== 'https:' || !['www.marvelrivals.com','r.res.easebar.com','nie.res.netease.com','arianwever.com','api.arianwever.com','beebom.com','static.beebom.com','rivals.gs','cdn.source.gs'].includes(url.hostname)) throw new Error('Unexpected asset host');
  return url.href;
};
const imageSources = text => [...text.matchAll(/<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi)].map(match => safeUrl(match[1]));
async function fetchBuffer(url, maxBytes = 14_000_000) {
  const response = await fetch(safeUrl(url), { signal: AbortSignal.timeout(25_000), headers: { Accept: 'image/avif,image/webp,image/png,image/jpeg,text/html;q=0.8,*/*;q=0.5', 'User-Agent': 'LuciferFPS-AssetSync/1.0', Referer: OFFICIAL }, redirect: 'error' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  if (Number(response.headers.get('content-length')) > maxBytes) throw new Error('Asset too large');
  const chunks = []; let bytes = 0;
  for await (const chunk of response.body) { bytes += chunk.byteLength; if(bytes > maxBytes) throw new Error('Asset too large'); chunks.push(chunk); }
  return { bytes: Buffer.concat(chunks), type: response.headers.get('content-type') || '' };
}
function imageType(bytes) {
  if (bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return 'png';
  if (bytes[0]===255 && bytes[1]===216 && bytes[2]===255) return 'jpg';
  if (bytes.subarray(0,4).toString()==='RIFF' && bytes.subarray(8,12).toString()==='WEBP') return 'webp';
  if (/^GIF8[79]a/.test(bytes.subarray(0,6).toString())) return 'gif';
  throw new Error('Response is not a supported raster image');
}
export function parseHeroCatalog(html) {
  return [...html.matchAll(/<div class="heroNewsList">\s*<a([^>]+)>([\s\S]*?)<\/a>/g)].map(match => ({
    name: match[1].match(/data-name="([^"]+)/)?.[1],
    title: match[1].match(/title="([^"]+)/)?.[1],
    url: safeUrl(match[1].match(/data-url="([^"]+)/)?.[1]),
    images: imageSources(match[2]),
  })).filter(hero => hero.name && hero.images.length >= 3);
}
export function parseHeroDetail(html) {
  const gallery = html.match(/<table[^>]*class="tableImg"[^>]*>([\s\S]*?)<\/table>/)?.[1] || '';
  const records=[...html.matchAll(/<tr[^>]*>\s*<td[^>]*>\s*([1-4])\s*<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/gi)];
  const abilities = records.map((match,index) => {
    const tail=html.slice(match.index+match[0].length,records[index+1]?.index||html.length);
    const description=strip(tail.match(/^\s*<td[^>]*>([\s\S]*?)<\/td>/)?.[1]);
    const key=strip(tail.match(/<td[^>]*>\s*Key\s*<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/i)?.[1]);
    let name=strip(match[2]);
    // The official Adam page mistakenly repeats "Karmic Revival" on its F row.
    // The F binding and verbatim flight description identify Soaring Surge,
    // also independently named by the reference kit. Keep that correction explicit.
    if(name==='Karmic Revival' && key==='F' && description==='Take to the skies, entering a flying state and swiftly surge forward') name='Soaring Surge';
    return { type: Number(match[1]), name, key, image: imageSources(match[3])[0] };
  }).filter(item => item.name && item.image);
  return { gallery: imageSources(gallery), abilities };
}
export function parseMapCatalog(html) {
  const section = html.slice(html.indexOf('class="part-maps"'));
  return [...section.matchAll(/<div class="map-img">\s*<img[^>]*src="([^"]+)"[^>]*>[\s\S]*?<h3>([\s\S]*?)<a\b/gi)].map(match => ({ name: strip(match[2]), image: safeUrl(match[1]), sourcePage: OFFICIAL }));
}
export function parseMapLayouts(html, sourcePage) {
  return [...html.matchAll(/<img\b[^>]*src="(\/img\/layouts\/[^\"]+)"[^>]*>/g)].map((match,index)=>{
    const context=html.slice(Math.max(0,match.index-2500),match.index);
    const name=[...context.matchAll(/<div class="k mb-2">([^<]+)<\/div>/g)].at(-1)?.[1] || `Layout ${index+1}`;
    return {id:match[1].split('/').at(-1).replace(/\.[^.]+$/,''),name:strip(name),sourceImage:safeUrl(match[1],sourcePage),width:Number(match[0].match(/\bwidth="(\d+)"/)?.[1])||null,height:Number(match[0].match(/\bheight="(\d+)"/)?.[1])||null,sourceUrl:sourcePage,floorplan:true};
  });
}
export function parseStructuredLayouts(html) {
  // Read the same serialized layout props used by the public rendered map.
  // Only literal JSON is parsed. Script contents are never executed.
  let serialized='';
  for(const match of html.matchAll(/<script>\s*self\.__next_f\.push\(([\s\S]*?)\)\s*<\/script>/g)) {
    try { const record=JSON.parse(match[1]);if(record[0]===1 && typeof record[1]==='string')serialized+=record[1]; }catch{}
  }
  const layouts=new Map();
  function walk(value,depth=0) {
    if(!value||typeof value!=='object'||depth>64)return;
    const layout=value.layout;
    if(layout && typeof layout.image==='string' && layout.image.startsWith('/img/layouts/') && typeof layout.level==='string' && Array.isArray(layout.markers)) {
      const markers=layout.markers.slice(0,10_000).filter(marker=>marker && typeof marker.kind==='string' && Array.isArray(marker.at) && marker.at.length===2 && marker.at.every(Number.isFinite)).map(marker=>{
        const clean={at:marker.at,kind:marker.kind,side:marker.side??null,yaw:Number.isFinite(marker.yaw)?marker.yaw:0};
        if(typeof marker.label==='string' || marker.label===null)clean.label=marker.label;
        if(Array.isArray(marker.size) && marker.size.length===2 && marker.size.every(Number.isFinite))clean.size=marker.size;
        if(Array.isArray(marker.path))clean.path=marker.path.slice(0,20_000).filter(point=>Array.isArray(point)&&point.length===2&&point.every(Number.isFinite));
        return clean;
      });
      layouts.set(layout.level,{name:typeof layout.name==='string'?layout.name:null,metresPerPx:Number.isFinite(layout.metresPerPx)?layout.metresPerPx:null,markers});
    }
    for(const child of Object.values(value))walk(child,depth+1);
  }
  for(const line of serialized.split('\n')){try{walk(JSON.parse(line.slice(line.indexOf(':')+1)));}catch{}}
  return layouts;
}
const abilityKey = name => normalize(String(name).replace(/\s*\((?:Base|Enhanced)\)\s*$/i, ''));
async function pool(items, task, count = 5) {
  let index=0; await Promise.all(Array.from({length:count}, async()=>{while(index<items.length) await task(items[index++]);}));
}
export async function syncImageAssets() {
  const data=JSON.parse(await readFile(resolve(ROOT,'data/siteData.json'),'utf8'));
  let manifest; try { manifest=JSON.parse(await readFile(MANIFEST,'utf8')); } catch { manifest={schemaVersion:1,assets:{},entities:{heroes:{},maps:{}},files:{},coverage:{}}; }
  const previousMeaningful=JSON.stringify({...manifest,updatedAt:undefined});
  manifest.assets ||= {}; manifest.entities ||= {}; manifest.entities.heroes ||= {}; manifest.entities.maps ||= {}; manifest.files ||= {};
  let sharp; if(process.env.SHARP_MODULE_PATH) sharp=(await import(pathToFileURL(process.env.SHARP_MODULE_PATH).href)).default;
  const failures=[]; const memo=new Map(); let downloaded=0;
  async function vendor(url, category, sourcePage, options={}) {
    if(!url)return null;
    const key=`${url}|${options.maxWidth||''}|${options.trim?'trim':''}`;
    if(memo.has(key))return memo.get(key);
    const pending=(async()=>{
      const prior=manifest.assets[url];
      if(prior && manifest.files[prior]) { try { if((await stat(resolve(ROOT,'public',prior.slice(1)))).size) return prior; } catch {} }
      try {
        const got=await fetchBuffer(url); let ext=imageType(got.bytes), bytes=got.bytes, info={};
        if(sharp) { let processor=sharp(bytes,{animated:false,limitInputPixels:50_000_000}); const meta=await processor.metadata(); info={sourceWidth:meta.width,sourceHeight:meta.height,width:meta.width,height:meta.height}; if(!options.preserve){if(options.trim)processor=processor.trim({threshold:12});const result=await processor.resize({width:options.maxWidth||512,height:options.maxHeight||1100,fit:'inside',withoutEnlargement:true}).webp({quality:87,alphaQuality:92}).toBuffer({resolveWithObject:true});bytes=result.data;ext='webp';info={...info,width:result.info.width,height:result.info.height};} }
        const hash=createHash('sha256').update(bytes).digest('hex'); const local=`/media/${category}/${hash.slice(0,20)}.${ext}`;
        const file=resolve(ROOT,'public',local.slice(1)); await mkdir(dirname(file),{recursive:true});await writeFile(file,bytes);
        manifest.files[local]={sourceUrl:url,sourcePage,sha256:hash,bytes:bytes.length,type:`image/${ext==='jpg'?'jpeg':ext}`,...info};
        manifest.assets[url]=local; downloaded++; return local;
      } catch(error){ failures.push({url,error:error.message,sourcePage});return prior||null; }
    })();memo.set(key,pending);return pending;
  }
  const officialHTML=(await fetchBuffer(`${OFFICIAL}heroes/`)).bytes.toString();
  const officialHeroes=parseHeroCatalog(officialHTML);
  if(officialHeroes.length<40)throw new Error('Official hero catalog unexpectedly incomplete');
  const officialByName=new Map(officialHeroes.map(hero=>[canon(hero.name),hero]));
  await pool(data.heroes, async hero=>{
    const official=officialByName.get(canon(hero.baseName||hero.name));
    if(!official) {failures.push({hero:hero.name,error:'No exact official catalog match'});return;}
    const previous=manifest.entities.heroes[hero.id]||{};
    let detail={gallery:[],abilities:[]};try{detail=parseHeroDetail((await fetchBuffer(official.url)).bytes.toString());}catch(error){failures.push({hero:hero.name,error:error.message});}
    async function heroArt() {
      if(detail.gallery[4]) {
        const current=await vendor(detail.gallery[4],'heroes',official.url,{maxWidth:1000,maxHeight:1200,trim:true});
        if(current)return current;
      }
      // A blocked or changed detail page must not downgrade a verified full-art
      // file to the small selection card. Keep the existing local artwork first.
      if(previous.art?.startsWith('/media/heroes/') && manifest.files[previous.art]) {
        try { if((await stat(resolve(ROOT,'public',previous.art.slice(1)))).size)return previous.art; }catch{}
      }
      return vendor(official.images[1],'heroes',official.url,{maxWidth:1000,maxHeight:1200,trim:true});
    }
    const [portrait,art,card]=await Promise.all([
      vendor(official.images[0],'heroes',official.url,{maxWidth:256}),
      heroArt(),
      vendor(official.images[1],'heroes',official.url,{maxWidth:480}),
    ]);
    const entity={...previous,name:hero.name,officialName:official.name,sourcePage:official.url,portrait,thumbnail:portrait,art,card,abilities:{...previous.abilities}};
    for(const key of ['image','thumbnail'])if(hero[key] && portrait)manifest.assets[hero[key]]=portrait;
    if(hero.art && art)manifest.assets[hero.art]=art;
    for(const ability of hero.abilities||[]) {
      const matches=detail.abilities.filter(item=>normalize(item.name)===normalize(ability.name));
      const exact=matches.find(item=>normalize(item.key)===normalize(ability.key)) || matches[0] || detail.abilities.find(item=>abilityKey(item.name)===abilityKey(ability.name));
      if(exact){const local=await vendor(exact.image,'abilities',official.url,{maxWidth:160});if(local){entity.abilities[ability.id]=local;if(ability.teamupIcon)manifest.assets[ability.teamupIcon]=local;}}
    }
    manifest.entities.heroes[hero.id]=entity;
    console.log(`Hero ${hero.name}: portrait=${!!portrait} art=${!!art} abilities=${Object.keys(entity.abilities).length}/${hero.abilities.length}`);
  },4);
  const mapCatalog=parseMapCatalog((await fetchBuffer(OFFICIAL)).bytes.toString());
  const mapAliases={arakko:'hellfiregala arakko', 'celestial-husk':'klyntarawakens thecelestialhusk','central-park':'empireofeternalnight centralpark','heart-of-heaven':'kunlun heartofheaven','hell-s-heaven':'hydracharterisbase hellsheaven',krakoa:'hellfiregala krakoa',midtown:'empireofeternalnight midtown','symbiotic-surface':'klyntar symbioticsurface','shin-shibuya':'tokyo2099 shinshibuya','spider-islands':'tokyo2099 spiderislands','birnin-t-challa':'intergalacticempireofwakanda birnintchalla','royal-palace':'yggsgard yggdrasillpathandroyalpalace','yggdrasill-path':'yggsgard yggdrasillpathandroyalpalace'};
  await pool(data.maps,async map=>{
    const key=normalize(mapAliases[map.id]||map.name);
    let source=mapCatalog.find(item=>normalize(item.name)===key);
    if(!source && map.id==='hall-of-djalia') {
      // A named game artwork credited to NetEase; the official site's current
      // gallery omits this arena. Discover its literal URL from the credit page.
      const sourcePage='https://beebom.com/all-marvel-rivals-game-modes/';
      try { const page=(await fetchBuffer(sourcePage)).bytes.toString();const tag=[...page.matchAll(/<img[^>]+>/gi)].find(match=>/alt="Marvel Rivals Hall of Djalia map"/.test(match[0]))?.[0];const image=tag?.match(/\bsrc="([^"]+)/)?.[1];if(image)source={name:map.name,image,sourcePage}; }catch(error){failures.push({map:map.name,error:error.message});}
    }
    if(!source){failures.push({map:map.name,error:'No exact named official map artwork'});return;}
    const image=await vendor(source.image,'maps',source.sourcePage||OFFICIAL,{maxWidth:1600,maxHeight:1000});
    if(image){manifest.assets[map.image]=image;manifest.entities.maps[map.id]={...manifest.entities.maps[map.id],name:map.name,image,sourceName:source.name,sourcePage:source.sourcePage||OFFICIAL,kind:'official-scene-artwork',floorplan:false};}
  });
  // Rival.GS publishes named top-down layouts. Discover map links in its visible
  // navigation and only use exact catalog IDs; do not infer map geometry.
  try {
    const indexPage='https://rivals.gs/maps/';
    const indexHTML=(await fetchBuffer(indexPage)).bytes.toString();
    const links=new Set([...indexHTML.matchAll(/<a[^>]*href="(\/maps\/[^\"]+\/)"/g)].map(match=>match[1]));
    await pool(data.maps,async map=>{
      const path=`/maps/${map.id}/`;if(!links.has(path))return;
      const sourcePage=safeUrl(path,indexPage);
      try{
        const html=(await fetchBuffer(sourcePage)).bytes.toString();
        const layouts=parseMapLayouts(html,sourcePage),structured=parseStructuredLayouts(html);
        const localLayouts=[];
        for(const layout of layouts){
          const image=await vendor(layout.sourceImage,'layouts',sourcePage,{preserve:true});
          const details=structured.get(layout.id),previous=manifest.entities.maps[map.id]?.layouts?.find(old=>old.id===layout.id);
          const tutorial=layout.id.startsWith('novicelevel_');
          const name=details?.name || (tutorial?(/basictutorial/.test(layout.id)?'Basic tutorial':'Escort tutorial'):/^Layout \d+$/.test(layout.name)?map.name:layout.name);
          if(image)localLayouts.push({...previous,...layout,...(details||{}),name,tutorial,image});
        }
        if(localLayouts.length)manifest.entities.maps[map.id]={...manifest.entities.maps[map.id],layouts:localLayouts,layoutSourcePage:sourcePage};
      }catch(error){failures.push({map:map.name,error:`Layout: ${error.message}`});}
    },4);
  }catch(error){failures.push({source:'https://rivals.gs/maps/',error:error.message});}
  for(const teamup of data.teamUps){const hero=data.heroes.find(hero=>normalize(hero.name)===normalize(teamup.hero));const entity=hero&&manifest.entities.heroes[hero.id];if(!entity)continue;const ability=hero.abilities.find(ability=>ability.type==='Team-Up' && abilityKey(ability.name)===abilityKey(teamup.name));const local=ability&&entity.abilities[ability.id];if(local&&teamup.image)manifest.assets[teamup.image]=local;}
  // Player photographs are source-provided identity images. Never substitute a
  // different person's photo. One preflight per origin avoids hundreds of
  // blocked requests without letting one host's denial gate a separate host.
  // A later successful scheduled run automatically vendors available images.
  const photos=[...new Set([...data.players,...data.staff].map(person=>person.image).filter(Boolean))];
  const pendingPhotos=photos.filter(url=>!manifest.assets[url]);
  const pendingTeams=data.teams.filter(team=>team.logo&&!manifest.assets[team.logo]);
  const originJobs=new Map();
  for(const job of [...pendingPhotos.map(url=>({url,category:'people'})),...pendingTeams.map(team=>({url:team.logo,category:'teams',team}))]) {
    const origin=new URL(safeUrl(job.url)).origin;
    if(!originJobs.has(origin))originJobs.set(origin,[]);originJobs.get(origin).push(job);
  }
  const originStatuses={};
  for(const [origin,jobs] of originJobs) {
    const pending={pendingPhotos:jobs.filter(job=>job.category==='people').length,pendingTeamLogos:jobs.filter(job=>job.category==='teams').length};
    try {
      const probe=await fetchBuffer(jobs[0].url);imageType(probe.bytes);
      await pool(jobs,async job=>{
        const local=await vendor(job.url,job.category,'https://arianwever.com/',{maxWidth:320,maxHeight:320});
        if(local&&job.team){manifest.entities.teams ||= {};manifest.entities.teams[job.team.id]={...manifest.entities.teams[job.team.id],name:job.team.name,logo:local};}
      },3);
      originStatuses[origin]={state:'reachable',message:'Public source image preflight succeeded.',...pending};
    } catch(error) {
      originStatuses[origin]={state:'unavailable',message:`Source image preflight ${error.message}; verified local images are retained.`,...pending};
    }
  }
  manifest.sourceImageStatus={origins:originStatuses};
  manifest.coverage={heroes:data.heroes.length,heroPortraits:data.heroes.filter(h=>manifest.entities.heroes[h.id]?.portrait).length,heroArt:data.heroes.filter(h=>manifest.entities.heroes[h.id]?.art).length,abilities:data.heroes.reduce((n,h)=>n+h.abilities.length,0),abilityIcons:data.heroes.reduce((n,h)=>n+Object.keys(manifest.entities.heroes[h.id]?.abilities||{}).length,0),maps:data.maps.length,mapArt:data.maps.filter(m=>manifest.entities.maps[m.id]?.image).length,mapsWithLayouts:data.maps.filter(m=>manifest.entities.maps[m.id]?.layouts?.length).length,mapLayouts:data.maps.reduce((n,m)=>n+(manifest.entities.maps[m.id]?.layouts?.length||0),0),mapMarkers:data.maps.reduce((n,m)=>n+(manifest.entities.maps[m.id]?.layouts||[]).reduce((sum,layout)=>sum+(layout.markers?.length||0),0),0),teamUps:data.teamUps.length,teamUpIcons:data.teamUps.filter(t=>manifest.assets[t.image]).length,teams:data.teams.length,teamLogos:data.teams.filter(t=>manifest.entities.teams?.[t.id]?.logo||manifest.entities.teams?.[t.id]?.sprite||manifest.assets[t.logo]).length,sourcePersonImages:photos.length,localPersonImages:photos.filter(url=>manifest.assets[url]).length};
  manifest.source='Official Marvel Rivals catalog and public source metadata; top-down floorplans from Rival.GS; Hall of Djalia game art credited to NetEase via Beebom. Marvel/NetEase retain game artwork rights.';
  manifest.failures=failures;
  manifest.assets=Object.fromEntries(Object.entries(manifest.assets).sort(([a],[b])=>a.localeCompare(b)));
  const changed=JSON.stringify({...manifest,updatedAt:undefined})!==previousMeaningful;
  if(changed){manifest.updatedAt=new Date().toISOString();await writeFile(`${MANIFEST}.tmp`,`${JSON.stringify(manifest,null,2)}\n`);await rename(`${MANIFEST}.tmp`,MANIFEST);}
  console.log(JSON.stringify({changed,downloaded,files:Object.keys(manifest.files).length,coverage:manifest.coverage,failures:failures.length},null,2));
  return manifest;
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url))syncImageAssets().catch(error=>{console.error(error.message);process.exitCode=1;});
