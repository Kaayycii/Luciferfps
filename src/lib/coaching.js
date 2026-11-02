// Original coaching frameworks and bounded, browser-local handoffs.
export const HABITS = ['Positioning / cover','Engage timing','Defensive cooldown','Reset / regroup','Target focus','Practice goal abandoned'];
export const PHASES = ['Setup','Trigger','Execution','Fallback'];
export function safeLink(value) { try {const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password?u.href:null;}catch{return null;} }
export function clone(value){return JSON.parse(JSON.stringify(value));}
export function validateCoaching(value){
 if(value===undefined)return true;
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 try {const text=JSON.stringify(value);if(text.length>500000)return false;}catch{return false;}
 let count=0;function check(v,depth=0){if(++count>20000||depth>12)return false;if(v===undefined||v===null||typeof v==='boolean'||typeof v==='number')return typeof v!=='number'||Number.isFinite(v);if(typeof v==='string')return v.length<=30000;if(Array.isArray(v))return v.length<=2000&&v.every(x=>check(x,depth+1));return !!v&&typeof v==='object'&&Object.entries(v).every(([k,x])=>!['__proto__','prototype','constructor'].includes(k)&&check(x,depth+1));}
 if(!check(value))return false;
 const textFields=['brief','title','reportId','mapId','opponent','focus','context','sourceUrl','winCondition','engage','resources','mapFit','fallback','responsibilities','rulesSource','rulesDate','customRules','force','deny','exploit','sample','prediction','outcome','findingId'];
 if(textFields.some(k=>value[k]!==undefined&&typeof value[k]!=='string'))return false;
 if(value.assignments!==undefined&&(!value.assignments||typeof value.assignments!=='object'||Array.isArray(value.assignments)||!Object.values(value.assignments).every(a=>a&&typeof a==='object'&&['player','comfort','pool'].every(k=>a[k]===undefined||typeof a[k]==='string'))))return false;
 if(value.reasons!==undefined&&(!value.reasons||typeof value.reasons!=='object'||!Object.values(value.reasons).every(x=>typeof x==='string')))return false;
 if(value.phases!==undefined&&(!Array.isArray(value.phases)||value.phases.length>12||!value.phases.every(p=>p&&['id','name','kind','trigger','call','explanation','assignments','recordedAt'].every(k=>typeof p[k]==='string')&&p.snapshot&&Array.isArray(p.snapshot.objects)&&!p.snapshot.coaching)))return false;
 if(value.drafts!==undefined&&(!Array.isArray(value.drafts)||value.drafts.length>10||!value.drafts.every(d=>d&&typeof d.title==='string'&&d.blue&&d.red&&validateCoaching(d.coaching))))return false;
 if(value.draftContext!==undefined&&!validateCoaching(value.draftContext))return false;
 if(value.evidence!=null&&(!value.evidence||typeof value.evidence!=='object'||['claim','evidence','confidence','timestamp','sourceUrl'].some(k=>value.evidence[k]!==undefined&&typeof value.evidence[k]!=='string')))return false;
 return true;
}
export function validLocalCoach(key,value){
 if(key==='lf.focus.v1')return typeof value==='string';
 if(key==='lf.lessons.v1')return Array.isArray(value)&&value.every(x=>typeof x==='string');
 if(key==='lf.journal.v1')return Array.isArray(value)&&value.length<=1000&&value.every(r=>r&&typeof r==='object'&&['win','loss','draw'].includes(r.result)&&typeof r.date==='string'&&Object.entries(r).every(([k,v])=>k==='tags'?Array.isArray(v)&&v.every(t=>typeof t==='string'):typeof v==='string'||typeof v==='number'));
 return !!value&&typeof value==='object'&&!Array.isArray(value)&&Object.values(value).every(v=>typeof v==='string'||(v&&typeof v==='object'&&!Array.isArray(v)&&Object.values(v).every(x=>typeof x==='string')));
}
export function mergeJournal(current,incoming){
 if(!Array.isArray(incoming)||incoming.length>1000)throw Error('Use a journal containing at most 1,000 matches.');
 const rows=[...current],ids=new Set(rows.map(r=>r.id));
 for(const raw of incoming){if(!raw||!['win','loss','draw'].includes(raw.result)||!Number.isFinite(Date.parse(raw.date)))throw Error('The import contains an invalid match.');
 const row={};for(const k of ['id','date','hero','result','rank','replay','note','focus','map','timestamp','control','next','adherence'])row[k]=String(raw[k]||'').slice(0,['note','focus','control','next'].includes(k)?4000:200);
 row.tags=Array.isArray(raw.tags)?raw.tags.filter(t=>HABITS.includes(t)):[];
 const same=rows.find(r=>r.id===row.id);if(same&&Object.keys(row).every(k=>k==='tags'?JSON.stringify(same.tags||[])===JSON.stringify(row.tags):String(same[k]||'')===row[k]))continue;
 if(!row.id||ids.has(row.id))row.id=globalThis.crypto.randomUUID();ids.add(row.id);rows.push(row);
 }if(rows.length>1000)throw Error('Combined journal exceeds 1,000 matches. Export both files before reorganising.');return rows;
}
export function journalPatterns(rows){return HABITS.map(tag=>({tag,count:rows.filter(r=>r.tags?.includes(tag)).length})).filter(x=>x.count).sort((a,b)=>b.count-a.count);}
export function capturePhase(plan,name,notes={}){const {coaching,...snapshot}=clone(plan);return {id:globalThis.crypto.randomUUID(),name,kind:'Planned',trigger:'',call:'',explanation:'',assignments:'',...notes,snapshot,recordedAt:new Date().toISOString()};}
export function loadPhase(plan,phase){if(!phase?.snapshot||phase.snapshot.coaching)throw Error('Invalid phase snapshot');return {...clone(phase.snapshot),coaching:clone(plan.coaching||{})};}
export function stageHandoff(kind,payload,storage=globalThis.sessionStorage){if(!['draft','plan','practice','scout'].includes(kind)||!validateCoaching(payload))throw Error('This handoff is too large or invalid. Export a backup instead.');const id=globalThis.crypto.randomUUID();storage.setItem('lf.handoff:'+id,JSON.stringify({kind,payload,createdAt:new Date().toISOString()}));return id;}
export function readHandoff(id,kind,storage=globalThis.sessionStorage){try{const item=JSON.parse(storage.getItem('lf.handoff:'+id));return item?.kind===kind&&validateCoaching(item.payload)?item.payload:null;}catch{return null;}}
export function downloadJson(value,name){const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
