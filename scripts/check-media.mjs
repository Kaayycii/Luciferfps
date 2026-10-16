import { readFile, stat } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const publicRoot=resolve(root,'public');
const manifest=JSON.parse(await readFile(resolve(root,'data/asset-manifest.json'),'utf8'));
const data=JSON.parse(await readFile(resolve(root,'data/siteData.json'),'utf8'));
const paths=new Set();
function collect(value){if(typeof value==='string'&&value.startsWith('/media/'))paths.add(value);else if(Array.isArray(value))value.forEach(collect);else if(value&&typeof value==='object')Object.values(value).forEach(collect);}
collect(manifest);
const errors=[];
for(const path of paths){
  const absolute=resolve(publicRoot,'.'+path);
  if(!absolute.startsWith(publicRoot+sep)){errors.push(`Unsafe local path: ${path}`);continue;}
  try {
    const info=await stat(absolute);
    if(!info.isFile()||info.size<24)throw new Error('empty or truncated image');
    const bytes=await readFile(absolute);
    const png=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
    const webp=bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP';
    const jpeg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
    const gif=/^GIF8[79]a/.test(bytes.subarray(0,6).toString());
    if(!png&&!webp&&!jpeg&&!gif)throw new Error('not a supported image binary');
  } catch(error){errors.push(`${path}: ${error.message}`);}
}
for(const hero of data.heroes){
  const record=manifest.entities?.heroes?.[hero.id];
  if(!paths.has(record?.portrait)||!paths.has(record?.art))errors.push(`Missing local portrait/art for ${hero.name}`);
  for(const ability of hero.abilities||[])if(!paths.has(record?.abilities?.[ability.id]))errors.push(`Missing local ability icon: ${hero.name} / ${ability.name}`);
}
for(const teamup of data.teamUps||[])if(!paths.has(manifest.assets?.[teamup.image]))errors.push(`Missing local team-up icon: ${teamup.name}`);
for(const map of data.maps){
  const record=manifest.entities?.maps?.[map.id];
  if(!record?.image||!paths.has(record.image))errors.push(`Missing local map artwork for ${map.name}`);
  // A genuinely new publisher map may precede its verified tactical layout.
  // It must still have local scene artwork and an explicit sourced absence,
  // never a fabricated floor plan or a silent blank.
  if(!record?.layouts?.length && !(record?.layoutAvailability==='unavailable' && record?.layoutNote && /^https:\/\/rivals\.gs\/maps\//.test(record?.layoutSourcePage||'')))errors.push(`Missing real overhead layouts or sourced unavailable status for ${map.name}`);
  for(const layout of record?.layouts||[])if(!paths.has(layout.image)||!layout.floorplan||!layout.name||!Number.isFinite(layout.width)||!Number.isFinite(layout.height)||layout.width<=0||layout.height<=0)errors.push(`Invalid overhead layout: ${map.name} / ${layout.id}`);
}
for(const [id,team] of Object.entries(manifest.entities?.teams||{})){
  const sprite=team.sprite;if(!sprite)continue;
  if(!paths.has(sprite.src)||![sprite.x,sprite.y,sprite.width,sprite.height,sprite.sheetWidth,sprite.sheetHeight].every(Number.isFinite)||sprite.width<=0||sprite.height<=0||sprite.x<0||sprite.y<0||sprite.x+sprite.width>sprite.sheetWidth||sprite.y+sprite.height>sprite.sheetHeight)errors.push(`Invalid team image viewport: ${id}`);
}
if(errors.length){console.error(errors.join('\n'));process.exitCode=1;}
else console.log(`Verified ${paths.size} bundled image files; ${data.heroes.length} hero portraits/art and ${data.maps.length} map artworks are local. ${Object.keys(manifest.entities?.teams||{}).length} verified team marks.`);
