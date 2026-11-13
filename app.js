/* Character Web 0.1.4. Offline, local-first, dependency-free prototype. */
(() => {
'use strict';
const $ = id => document.getElementById(id);
const NS = 'http://www.w3.org/2000/svg';
const STORE = 'character-web-local-v1';
const DB = 'character-web-projects';
const clone = v => JSON.parse(JSON.stringify(v));
const uid = () => typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const esc = v => String(v ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const safeId = v => String(v ?? '').replace(/[^\w-]/g,'').slice(0,130) || uid();
const clamp = (n,min,max) => Math.min(max,Math.max(min,n));
const sortByName = (a,b) => a.name.localeCompare(b.name,undefined,{sensitivity:'base'});
const roster = id => project.characters.find(c => c.id===id);
const edgeById = id => project.relationships.find(e => e.id===id);
const adj = () => {const out=new Map(project.characters.map(c=>[c.id,new Set()]));for(const r of project.relationships){if(out.has(r.source)&&out.has(r.target)&&r.source!==r.target){out.get(r.source).add(r.target);out.get(r.target).add(r.source);}}return out;};
const tone = type => {const s=String(type||'').toLowerCase();if(/romance|lover|marri|date/.test(s))return '#efa5cc';if(/family|sibling|parent/.test(s))return '#f9c47f';if(/rival|antagon|enemy|conflict/.test(s))return '#ed9396';if(/friend|trust|mentor/.test(s))return '#8fcfbc';if(/band|music|profession/.test(s))return '#b5aaf6';return '#8ca7ba';};
let project=null,focusId=null,selection=null;
let dbInstance=null,storageMode='indexeddb';
let undoStack=[],redoStack=[],inputSnapshot=null;
let saveTimer=null,lastSavePromise=null;
let modalKind=null,modalContext={};
let visibleIds=[],visibleDistances=new Map(),targetPositions=new Map(),positions=new Map(),nodeElements=new Map(),edgeElements=[];
let raf=null,layoutActivity=0,camera={panX:0,panY:0,scale:1};
let pointer=null,photoTarget=null,toastTimeouts=[];
const activeTouches=new Map();
let touchGesture=null,suppressTouchClickUntil=0;
const viewport=$('network-viewport'),scene=$('graph-scene'),nodesLayer=$('node-layer'),edgesLayer=$('edge-layer');

// DATA + STORAGE
async function openDatabase(){
  if(!('indexedDB' in window))throw new Error('IndexedDB unavailable');
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open(DB,1);
    req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains('projects'))req.result.createObjectStore('projects');};
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error||new Error('Could not open local storage'));
  });
}
async function loadStored(){
  try{
    dbInstance=await openDatabase();
    return await new Promise((resolve,reject)=>{
      const tx=dbInstance.transaction('projects','readonly');const request=tx.objectStore('projects').get('current');
      request.onsuccess=()=>resolve(request.result||null);request.onerror=()=>reject(request.error);
    });
  }catch(error){
    storageMode='localStorage';
    try{const str=localStorage.getItem(STORE);return str?JSON.parse(str):null;}catch(_){storageMode='memory';return null;}
  }
}
async function storeProject(snapshot){
  if(storageMode==='indexeddb'&&dbInstance){
    return new Promise((resolve,reject)=>{
      const tx=dbInstance.transaction('projects','readwrite');tx.objectStore('projects').put(snapshot,'current');
      tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error||new Error('Could not save'));
    });
  }
  if(storageMode==='localStorage'){localStorage.setItem(STORE,JSON.stringify(snapshot));return;}
  throw new Error('Persistent storage unavailable');
}
function saveState(label,mode='ok'){
  const el=$('save-status');el.className='save-status'+(mode==='ok'?'':` ${mode}`);
  el.querySelector('span:last-child').textContent=label;
}
function queueSave(){
  project.updatedAt=new Date().toISOString();
  if(storageMode==='memory'){saveState('Export backups to preserve work','error');return;}
  saveState('Saving…','saving');
  clearTimeout(saveTimer);saveTimer=setTimeout(async()=>{
    try{await storeProject(clone(project));saveState('Saved in this browser');}
    catch(err){storageMode='memory';saveState('Export backups to preserve work','error');toast('Local saving failed. Please export a backup.', 'error');console.error(err);}
  },400);
}
function flushSave(){if(!project||storageMode==='memory')return;clearTimeout(saveTimer);saveTimer=null;storeProject(clone(project)).catch(console.error);}
function validateImported(raw){
  if(!raw||typeof raw!=='object'||!Array.isArray(raw.characters)||!Array.isArray(raw.relationships))throw new Error('This does not look like a Character Web project.');
  if(Number(raw.schemaVersion)>1)throw new Error('This file was created with a newer version of Character Web.');
  if(raw.characters.length>25000||raw.relationships.length>150000)throw new Error('Project exceeds this prototype’s safe import limits.');
  const ids=new Set();
  const characters=raw.characters.map((c,i)=>{
    if(!c||typeof c.name!=='string'||!c.name.trim())throw new Error(`Character ${i+1} has no name.`);
    let id=typeof c.id==='string'&&c.id?c.id:uid();if(ids.has(id))throw new Error('Project contains duplicate character IDs.');ids.add(id);
    return {id,name:c.name.slice(0,180),summary:String(c.summary||'').slice(0,50000),biography:String(c.biography||'').slice(0,200000),notes:String(c.notes||'').slice(0,200000),aliases:Array.isArray(c.aliases)?c.aliases.map(String).slice(0,100):[],groups:Array.isArray(c.groups)?c.groups.map(String).slice(0,100):[],portrait:typeof c.portrait==='string'&&/^data:image\/(png|jpeg|webp|gif);base64,/.test(c.portrait)?c.portrait:null,customFields:c.customFields&&typeof c.customFields==='object'?c.customFields:{},visibility:c.visibility==='public'?'public':'author',createdAt:c.createdAt||new Date().toISOString()};
  });
  const relationshipIds=new Set();
  const relationships=raw.relationships.filter(r=>r&&ids.has(r.source)&&ids.has(r.target)&&r.source!==r.target).map(r=>{
    let id=typeof r.id==='string'&&r.id?r.id:uid();if(relationshipIds.has(id))id=uid();relationshipIds.add(id);
    return {id,source:r.source,target:r.target,type:String(r.type||'Connection').slice(0,150),description:String(r.description||'').slice(0,150000),direction:['forward','reverse'].includes(r.direction)?r.direction:'mutual',notes:String(r.notes||'').slice(0,150000),visibility:r.visibility==='public'?'public':'author'};
  });
  return {schemaVersion:1,id:String(raw.id||uid()),name:String(raw.name||'Untitled world').slice(0,180),description:String(raw.description||''),createdAt:raw.createdAt||new Date().toISOString(),updatedAt:raw.updatedAt||new Date().toISOString(),characters,relationships,settings:{depth:['1','2','all'].includes(String(raw.settings?.depth))?String(raw.settings.depth):'1',namesOnly:!!raw.settings?.namesOnly}};
}
function commit(mutator){
  endInlineEdit();const before=JSON.stringify(project);mutator();if(JSON.stringify(project)===before)return;
  undoStack.push(before);if(undoStack.length>40)undoStack.shift();redoStack=[];queueSave();refresh();
}
function endInlineEdit(){
  if(inputSnapshot&&inputSnapshot!==JSON.stringify(project)){
    undoStack.push(inputSnapshot);if(undoStack.length>40)undoStack.shift();redoStack=[];updateUndoButtons();
  }
  inputSnapshot=null;
}
function undo(){endInlineEdit();if(!undoStack.length)return;redoStack.push(JSON.stringify(project));project=JSON.parse(undoStack.pop());ensureValidSelection();queueSave();refresh();toast('Undone');}
function redo(){endInlineEdit();if(!redoStack.length)return;undoStack.push(JSON.stringify(project));project=JSON.parse(redoStack.pop());ensureValidSelection();queueSave();refresh();toast('Redone');}
function ensureValidSelection(){if(focusId&&!roster(focusId))focusId=project.characters[0]?.id||null;if(!focusId)focusId=project.characters[0]?.id||null;if(selection?.kind==='character'&&!roster(selection.id))selection=null;if(selection?.kind==='relationship'&&!edgeById(selection.id))selection=null;}
function freshProject(name){return {schemaVersion:1,id:uid(),name,description:'',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),characters:[],relationships:[],settings:{depth:'1',namesOnly:false}};}
function resetProject(data){endInlineEdit();project=validateImported(data);undoStack=[];redoStack=[];positions.clear();camera={panX:0,panY:0,scale:window.innerWidth<=760?.85:1};focusId=project.characters[0]?.id||null;selection=focusId?{kind:'character',id:focusId}:null;queueSave();refresh();}

// GRAPH + LAYOUT
function visibleNeighborhood(){
  const all=adj(),dist=new Map();if(!focusId||!roster(focusId))return {ids:[],dist};
  dist.set(focusId,0);const queue=[focusId];
  for(let q=0;q<queue.length;q++){
    const current=queue[q],d=dist.get(current);if(project.settings.depth!=='all'&&d>=Number(project.settings.depth))continue;
    for(const next of all.get(current)||[]){if(!dist.has(next)){dist.set(next,d+1);queue.push(next);}}
  }
  if(project.settings.depth==='all')for(const c of project.characters)if(!dist.has(c.id))dist.set(c.id,99);
  return {ids:project.characters.filter(c=>dist.has(c.id)).map(c=>c.id),dist};
}
function calculateTargets(){
  targetPositions=new Map();if(!focusId)return;
  targetPositions.set(focusId,{x:0,y:0});
  const byLevel=new Map();for(const id of visibleIds){if(id===focusId)continue;const lvl=visibleDistances.get(id);if(!byLevel.has(lvl))byLevel.set(lvl,[]);byLevel.get(lvl).push(id);}
  for(const [lvl,list] of [...byLevel].sort((a,b)=>a[0]-b[0])){
    list.sort((a,b)=>{const aa=positions.get(a),bb=positions.get(b);if(aa&&bb){const pa=Math.atan2(aa.y,aa.x),pb=Math.atan2(bb.y,bb.x);if(Math.abs(pa-pb)>.08)return pa-pb;}return (roster(a)?.name||'').localeCompare(roster(b)?.name||'');});
    const n=list.length;
    const ring=lvl===1?Math.max(165,Math.min(355,n*19+110)):lvl===2?Math.max(345,Math.min(690,n*24+180)):lvl===99?Math.max(570,n*25):Math.min(1000,440+lvl*155);
    const stagger=lvl===1?-Math.PI/2:-Math.PI/2+(lvl%2?0:0.18);
    list.forEach((id,i)=>{const angle=stagger+(i/n)*Math.PI*2;targetPositions.set(id,{x:Math.cos(angle)*ring,y:Math.sin(angle)*ring});});
  }
}
function recalcScene(){
  const {ids,dist}=visibleNeighborhood();visibleIds=ids;visibleDistances=dist;
  const currentFocus=positions.get(focusId);if(currentFocus){const offsetX=currentFocus.x,offsetY=currentFocus.y;for(const p of positions.values()){p.x-=offsetX;p.y-=offsetY;}}
  calculateTargets();
  for(const id of visibleIds){if(!positions.has(id)){const t=targetPositions.get(id)||{x:0,y:0};positions.set(id,{x:t.x+(Math.random()-.5)*65,y:t.y+(Math.random()-.5)*65,vx:0,vy:0});}}
  for(const id of [...positions.keys()])if(!project.characters.some(c=>c.id===id))positions.delete(id);
  renderGraphNodes();renderGraphEdges();layoutActivity=0;startLayout();
}
function makeSvg(type,attrs){const e=document.createElementNS(NS,type);for(const [key,value] of Object.entries(attrs||{}))e.setAttribute(key,String(value));return e;}
// Keep a single connection strand per *direction*, not one per relationship record.
// This preserves readable maps while allowing mutual, A→B, and B→A to coexist.
function groupsForVisibleEdges(){
  const available=new Set(visibleIds),pairs=new Map();
  for(const rel of project.relationships){
    if(!available.has(rel.source)||!available.has(rel.target))continue;
    const ids=[rel.source,rel.target].sort(),pairKey=ids.join('|');
    if(!pairs.has(pairKey))pairs.set(pairKey,{key:pairKey,source:ids[0],target:ids[1],tracks:new Map()});
    const pair=pairs.get(pairKey);
    const from=rel.direction==='reverse'?rel.target:rel.source;
    const to=rel.direction==='reverse'?rel.source:rel.target;
    const trackKey=rel.direction==='mutual'?'mutual':`${from}>${to}`;
    if(!pair.tracks.has(trackKey))pair.tracks.set(trackKey,{key:trackKey,from:rel.direction==='mutual'?null:from,to:rel.direction==='mutual'?null:to,rels:[]});
    pair.tracks.get(trackKey).rels.push(rel);
  }
  return [...pairs.values()].map(pair=>({...pair,tracks:[...pair.tracks.values()]}));
}
function renderGraphEdges(){
  edgesLayer.replaceChildren();edgeElements=[];
  for(const item of groupsForVisibleEdges()){
    item.tracks.forEach((track,index)=>{
      const selected=track.rels.some(r=>selection?.kind==='relationship'&&selection.id===r.id);
      const group=makeSvg('g',{'class':'edge-group','data-group':item.key});
      const line=makeSvg('line',{'class':'edge-line'+(selected?' selected':'')+(item.source===focusId||item.target===focusId?' near':'')});
      line.style.stroke=tone(track.rels[0].type);
      const hit=makeSvg('line',{'class':'edge-hit','stroke':'transparent'});
      const arrow=track.to?makeSvg('polygon',{'class':'edge-arrow'+(selected?' selected':'')}):null;
      if(arrow)arrow.style.fill=tone(track.rels[0].type);
      group.append(line,hit);if(arrow)group.append(arrow);
      // Visual hover text is intentionally concise: arrowheads already indicate direction.
      const title=makeSvg('title');title.textContent=track.rels.map(r=>r.type).join(' · ');group.append(title);
      const accessibleDirection=track.from?`${roster(track.from)?.name} to ${roster(track.to)?.name}`:'mutual';
      hit.setAttribute('role','button');hit.setAttribute('tabindex','0');
      hit.setAttribute('aria-label',`${track.rels.map(r=>r.type).join(', ')} relationship, ${accessibleDirection}`);
      hit.dataset.relationshipId=track.rels[0].id;
      edgesLayer.append(group);
      const openEdge=()=>{selection={kind:'relationship',id:track.rels[0].id};renderPanel();renderGraphEdges();};
      hit.addEventListener('click',ev=>{ev.stopPropagation();if(pointer?.moved||performance.now()<suppressTouchClickUntil)return;openEdge();});
      hit.addEventListener('keydown',ev=>{if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();openEdge();}});
      edgeElements.push({item,track,index,trackCount:item.tracks.length,line,hit,arrow});
    });
  }
  updatePositions();
}
function renderGraphNodes(){
  nodesLayer.replaceChildren();nodeElements.clear();
  for(const id of visibleIds){const char=roster(id);if(!char)continue;
    const btn=document.createElement('button');btn.type='button';btn.className='network-node'+(id===focusId?' is-focused':'')+(!project.settings.namesOnly&&char.portrait?' has-portrait':'');btn.dataset.nodeId=id;btn.setAttribute('aria-label',`Explore ${char.name}`);btn.title=`${char.name}${char.summary?' · '+char.summary:''}`;
    if(!project.settings.namesOnly&&char.portrait){const img=document.createElement('img');img.className='node-image';img.src=char.portrait;img.alt='';img.draggable=false;btn.append(img);}
    const label=document.createElement('span');label.className='node-name';label.textContent=char.name;btn.append(label);
    btn.addEventListener('pointerdown',startNodeDrag);btn.addEventListener('contextmenu',ev=>{ev.preventDefault();selectCharacter(id);openModal('character-actions',{id});});
    nodesLayer.append(btn);nodeElements.set(id,btn);
  }
  $('empty-network').classList.toggle('hidden',project.characters.length!==0);
  const hint=$('large-map-hint');
  hint.classList.toggle('hidden',visibleIds.length<=110);
  hint.textContent=`${visibleIds.length} characters visible. Try 1 step for smoother navigation.`;
  $('canvas-label').textContent=focusId?`EXPLORING ${roster(focusId)?.name.toUpperCase()||'THE WEB'}`:'THE LIVING WEB';
}
function updatePositions(){
  // Move nodes with composited transforms instead of changing their layout positions.
  for(const [id,el] of nodeElements){const p=positions.get(id);if(!p)continue;el.style.transform=`translate3d(${p.x}px,${p.y}px,0) translate(-50%,-50%)`;}
  for(const {item,track,index,trackCount,line,hit,arrow} of edgeElements){
    const a=positions.get(item.source),b=positions.get(item.target);if(!a||!b)continue;
    const dx=b.x-a.x,dy=b.y-a.y,distance=Math.hypot(dx,dy)||1;
    const offset=(index-(trackCount-1)/2)*9;
    const ox=-dy/distance*offset,oy=dx/distance*offset;
    for(const e of [line,hit]){
      e.setAttribute('x1',a.x+ox);e.setAttribute('y1',a.y+oy);
      e.setAttribute('x2',b.x+ox);e.setAttribute('y2',b.y+oy);
    }
    if(arrow){
      const end=track.to===item.target?b:a;
      const start=track.to===item.target?a:b;
      const ux=(end.x-start.x)/distance,uy=(end.y-start.y)/distance;
      // Set the tip just outside the character node rather than under its label.
      const inset=Math.min(64,Math.max(21,distance*.23));
      const tx=end.x-ux*inset+ox,ty=end.y-uy*inset+oy;
      const bx=tx-ux*14,by=ty-uy*14;
      arrow.setAttribute('points',`${tx},${ty} ${bx-uy*6},${by+ux*6} ${bx+uy*6},${by-ux*6}`);
    }
  }
}
function startLayout(){if(raf||activeTouches.size)return;raf=requestAnimationFrame(layoutFrame);}
function layoutFrame(){
  raf=null;if(!visibleIds.length||activeTouches.size||document.hidden)return;
  layoutActivity++;
  let moving=0;
  const ids=visibleIds;const list=ids.map(id=>positions.get(id));
  for(let i=0;i<ids.length;i++){
    const id=ids[i],p=list[i],goal=targetPositions.get(id);if(!p||!goal)continue;
    if(id===focusId){p.x=0;p.y=0;p.vx=0;p.vy=0;continue;}
    p.vx+=(goal.x-p.x)*.024;p.vy+=(goal.y-p.y)*.024;
  }
  // A limited collision/repulsion pass avoids the hairball effect without a heavy library.
  // Cap pair checks for enormous imported projects; neighborhood rendering stays responsive.
  // Mobile favors interaction responsiveness over sustained all-pairs repulsion.
  if(ids.length<=(window.innerWidth<=760?85:380)){
    for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++){
      const a=list[i],b=list[j];if(!a||!b)continue;
      const dx=b.x-a.x,dy=b.y-a.y,d2=dx*dx+dy*dy;
      const min=ids[i]===focusId||ids[j]===focusId?175:137;
      if(d2<min*min){const dist=Math.max(1,Math.sqrt(d2));const push=(min-dist)*.024;const vx=dx/dist*push,vy=dy/dist*push;
        if(ids[i]!==focusId){a.vx-=vx;a.vy-=vy;}if(ids[j]!==focusId){b.vx+=vx;b.vy+=vy;}
      }
    }
  }
  for(let i=0;i<ids.length;i++){
    const p=list[i];if(!p||ids[i]===focusId)continue;
    p.vx*=.74;p.vy*=.74;p.x+=p.vx;p.y+=p.vy;moving+=Math.abs(p.vx)+Math.abs(p.vy);
  }
  updatePositions();
  if(moving>.14&&layoutActivity<(window.innerWidth<=760?125:360))startLayout();
}
function applyCamera(){const r=viewport.getBoundingClientRect();scene.style.transform=`translate(${r.width/2+camera.panX}px,${r.height/2+camera.panY}px) scale(${camera.scale})`;}
function zoomAt(factor,cx,cy){const rect=viewport.getBoundingClientRect(),mx=cx-rect.left-rect.width/2,my=cy-rect.top-rect.height/2;
  const before=camera.scale,after=clamp(before*factor,.24,2.8);camera.panX=mx-(mx-camera.panX)*after/before;camera.panY=my-(my-camera.panY)*after/before;camera.scale=after;applyCamera();
}
function fitToIds(ids,label='Map fitted to view'){
  if(!ids.length)return;
  let left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity;
  for(const id of ids){
    const p=positions.get(id);if(!p)continue;
    const el=nodeElements.get(id),w=(el?.offsetWidth||140)/2+17,h=(el?.offsetHeight||58)/2+15;
    left=Math.min(left,p.x-w);right=Math.max(right,p.x+w);
    top=Math.min(top,p.y-h);bottom=Math.max(bottom,p.y+h);
  }
  if(!isFinite(left))return;
  const r=viewport.getBoundingClientRect(),mobile=window.innerWidth<=760;
  const availableWidth=Math.max(40,r.width-(mobile?38:80));
  const availableHeight=Math.max(40,r.height-(mobile?112:170));
  const scale=clamp(Math.min(availableWidth/Math.max(1,right-left),availableHeight/Math.max(1,bottom-top)),.24,mobile?1.15:1.4);
  camera.scale=scale;
  camera.panX=-(left+right)/2*scale;
  camera.panY=-(top+bottom)/2*scale+(mobile?15:12);
  applyCamera();toast(label);
}
function fitMap(){fitToIds(visibleIds);}
function fitNeighborhood(){
  const near=visibleIds.filter(id=>(visibleDistances.get(id)??99)<=1);
  fitToIds(near,'Immediate connections fitted');
}
function selectCharacter(id){if(!roster(id))return;endInlineEdit();focusId=id;selection={kind:'character',id};camera.panX=0;camera.panY=0;camera.scale=window.innerWidth<=760?.85:1;applyCamera();recalcScene();renderPanel();}
function clearSelection(){
  if(!selection)return;
  endInlineEdit();selection=null;renderPanel();renderGraphEdges();
}
function updateClearSelectionButton(){
  $('clear-selection').disabled=!selection;
  $('clear-selection').setAttribute('aria-label',selection?'Clear selection':'Nothing selected');
}
function refresh(){ensureValidSelection();$('project-name').textContent=project.name;$('roster-count').textContent=`${project.characters.length} people · ${project.relationships.length} relationships`;
  $('names-only').checked=project.settings.namesOnly;document.querySelectorAll('[data-depth]').forEach(b=>b.classList.toggle('active',b.dataset.depth===project.settings.depth));updateUndoButtons();recalcScene();renderPanel();renderRoster();applyCamera();}
function updateUndoButtons(){$('undo-button').disabled=!undoStack.length;$('redo-button').disabled=!redoStack.length;}

// GRAPH INTERACTIONS
function startNodeDrag(ev){
  // On phones a finger dragging a character pans the map, not the character.
  if(ev.pointerType==='touch'||ev.button!==0)return;
  ev.stopPropagation();ev.preventDefault();const id=ev.currentTarget.dataset.nodeId;
  pointer={mode:'node',id,shift:ev.shiftKey,startX:ev.clientX,startY:ev.clientY,lastX:ev.clientX,lastY:ev.clientY,moved:false};ev.currentTarget.classList.add('is-dragging');
}
viewport.addEventListener('pointerdown',ev=>{
  if(ev.pointerType==='touch'||ev.button!==0||ev.target.closest('.network-node')||ev.target.closest('.canvas-controls'))return;
  if(ev.target.closest('.edge-hit'))return;
  pointer={mode:'pan',startX:ev.clientX,startY:ev.clientY,lastX:ev.clientX,lastY:ev.clientY,moved:false};
});
window.addEventListener('pointermove',ev=>{
  if(ev.pointerType==='touch'||!pointer)return;
  const dx=ev.clientX-pointer.lastX,dy=ev.clientY-pointer.lastY;
  if(Math.abs(ev.clientX-pointer.startX)>4||Math.abs(ev.clientY-pointer.startY)>4)pointer.moved=true;
  if(pointer.moved){
    if(pointer.mode==='node'){
      const p=positions.get(pointer.id);if(p&&pointer.id!==focusId){p.x+=dx/camera.scale;p.y+=dy/camera.scale;p.vx=0;p.vy=0;updatePositions();}
      else if(pointer.id===focusId){camera.panX+=dx;camera.panY+=dy;applyCamera();}
    }else{camera.panX+=dx;camera.panY+=dy;applyCamera();}
  }
  pointer.lastX=ev.clientX;pointer.lastY=ev.clientY;
});
window.addEventListener('pointerup',ev=>{
  if(ev.pointerType==='touch'||!pointer)return;
  const p=pointer;pointer=null;
  document.querySelectorAll('.network-node.is-dragging').forEach(el=>el.classList.remove('is-dragging'));
  if(p.mode==='node'&&!p.moved){
    if((p.shift||ev.shiftKey)&&focusId&&focusId!==p.id&&$('modal-backdrop').classList.contains('hidden')){
      openModal('new-relationship',{source:focusId,target:p.id});
    }else selectCharacter(p.id);
  }
  else if(p.mode==='node'){const pos=positions.get(p.id);if(pos){targetPositions.set(p.id,{x:pos.x,y:pos.y});startLayout();}}
  else if(p.mode==='pan'&&!p.moved){clearSelection();}
});
window.addEventListener('pointercancel',ev=>{
  if(ev.pointerType==='touch')return;
  pointer=null;document.querySelectorAll('.network-node.is-dragging').forEach(el=>el.classList.remove('is-dragging'));
});

// Dedicated multi-touch navigation, using Pointer Events rather than browser page zoom.
// One finger pans anywhere on the map; a tap selects; two fingers translate + pinch the camera.
function touchGeometry(){
  const values=[...activeTouches.values()];if(values.length<2)return null;
  const [a,b]=values;return {centerX:(a.x+b.x)/2,centerY:(a.y+b.y)/2,distance:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y))};
}
viewport.addEventListener('pointerdown',ev=>{
  if(ev.pointerType!=='touch'||ev.target.closest('.canvas-controls,.empty-network'))return;
  ev.preventDefault();ev.stopPropagation();
  activeTouches.set(ev.pointerId,{x:ev.clientX,y:ev.clientY});
  try{viewport.setPointerCapture(ev.pointerId);}catch(_){}
  if(activeTouches.size===1){
    const node=ev.target.closest('.network-node');const edge=ev.target.closest('.edge-hit');
    touchGesture={mode:'single',pointerId:ev.pointerId,startX:ev.clientX,startY:ev.clientY,lastX:ev.clientX,lastY:ev.clientY,moved:false,nodeId:node?.dataset.nodeId||null,edgeId:edge?.dataset.relationshipId||null};
  }else{
    const geometry=touchGeometry();
    if(geometry){touchGesture={mode:'pinch',...geometry,moved:true};}
  }
},true);
window.addEventListener('pointermove',ev=>{
  if(ev.pointerType!=='touch'||!activeTouches.has(ev.pointerId))return;
  ev.preventDefault();
  activeTouches.set(ev.pointerId,{x:ev.clientX,y:ev.clientY});
  if(!touchGesture)return;
  if(activeTouches.size>=2){
    const g=touchGeometry();if(!g)return;
    if(touchGesture.mode!=='pinch'){touchGesture={mode:'pinch',...g,moved:true};return;}
    const old=touchGesture;
    zoomAt(g.distance/old.distance,old.centerX,old.centerY);
    camera.panX+=g.centerX-old.centerX;
    camera.panY+=g.centerY-old.centerY;
    applyCamera();
    touchGesture={mode:'pinch',...g,moved:true};
    return;
  }
  if(touchGesture.mode==='pinch')return;
  const g=touchGesture;
  if(Math.hypot(ev.clientX-g.startX,ev.clientY-g.startY)>8)g.moved=true;
  if(g.moved){camera.panX+=ev.clientX-g.lastX;camera.panY+=ev.clientY-g.lastY;applyCamera();}
  g.lastX=ev.clientX;g.lastY=ev.clientY;
},{passive:false});
function finishTouch(ev,cancelled=false){
  if(ev.pointerType!=='touch'||!activeTouches.has(ev.pointerId))return;
  const wasSingle=activeTouches.size===1,g=touchGesture;
  activeTouches.delete(ev.pointerId);
  suppressTouchClickUntil=performance.now()+450;
  if(wasSingle){
    touchGesture=null;
    if(!cancelled&&g&&!g.moved&&g.mode==='single'){
      if(g.nodeId)selectCharacter(g.nodeId);
      else if(g.edgeId&&edgeById(g.edgeId)){
        selection={kind:'relationship',id:g.edgeId};renderPanel();renderGraphEdges();expandMobileDetails();
      }else clearSelection();
    }
    // Continue settling a layout that was paused for touch input.
    if(layoutActivity<(window.innerWidth<=760?125:360))startLayout();
  }else if(activeTouches.size===1){
    const remaining=[...activeTouches.entries()][0];
    touchGesture={mode:'single',pointerId:remaining[0],startX:remaining[1].x,startY:remaining[1].y,lastX:remaining[1].x,lastY:remaining[1].y,moved:true};
  }else if(activeTouches.size>=2){touchGesture={mode:'pinch',...touchGeometry(),moved:true};}
}
window.addEventListener('pointerup',ev=>finishTouch(ev));
window.addEventListener('pointercancel',ev=>finishTouch(ev,true));
window.addEventListener('blur',()=>{activeTouches.clear();touchGesture=null;pointer=null;});
viewport.addEventListener('wheel',ev=>{ev.preventDefault();zoomAt(ev.deltaY<0?1.1:1/1.1,ev.clientX,ev.clientY);},{passive:false});
viewport.addEventListener('dblclick',ev=>{if(ev.pointerType==='touch'||ev.target.closest('.network-node')||ev.target.closest('.edge-hit'))return;openModal('new-character');});
$('zoom-in').addEventListener('click',()=>{const r=viewport.getBoundingClientRect();zoomAt(1.2,r.left+r.width/2,r.top+r.height/2);});
$('zoom-out').addEventListener('click',()=>{const r=viewport.getBoundingClientRect();zoomAt(1/1.2,r.left+r.width/2,r.top+r.height/2);});
$('fit-map').addEventListener('click',fitMap);
$('fit-neighborhood').addEventListener('click',fitNeighborhood);
window.addEventListener('resize',applyCamera);
if(window.ResizeObserver)new ResizeObserver(applyCamera).observe(viewport);
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&visibleIds.length)startLayout();});

function updateMobilePanelLabel(){
  const button=$('mobile-panel-toggle');
  const label=selection?.kind==='relationship'?edgeById(selection.id)?.type:selection?.kind==='character'?roster(selection.id)?.name:focusId?'Nothing selected':'World details';
  const open=$('detail-pane').classList.contains('expanded');
  document.querySelector('.workspace').classList.toggle('mobile-details-open',open);
  button.innerHTML=`<span class="mobile-sheet-grip" aria-hidden="true"></span><span class="mobile-sheet-text">${esc(label||'World details')} · ${open?'Hide':'View'} details</span><span class="mobile-sheet-chevron" aria-hidden="true">${open?'⌄':'⌃'}</span>`;
  button.setAttribute('aria-expanded',String(open));
  button.setAttribute('aria-label',`${open?'Collapse':'Expand'} ${label||'world'} details`);
}
function expandMobileDetails(){
  if(window.innerWidth>760)return;
  $('detail-pane').classList.add('expanded');updateMobilePanelLabel();
}
$('mobile-panel-toggle').addEventListener('click',()=>{
  $('detail-pane').classList.toggle('expanded');
  updateMobilePanelLabel();
  requestAnimationFrame(applyCamera);
});

// THE DETAIL PANE
function lineField(label,field,value,opts={}){const type=opts.multiline?'textarea':'input';const placeholder=esc(opts.placeholder||'Optional');
  return `<div class="field-group"><label class="field-label" for="field-${field}">${label}</label>${type==='textarea'?`<textarea id="field-${field}" data-field="${field}" class="field-input ${opts.large?'rich-text':''}" rows="${opts.rows||3}" placeholder="${placeholder}">${esc(value)}</textarea>`:`<input id="field-${field}" data-field="${field}" class="field-input ${opts.large?'name-input':''}" value="${esc(value)}" placeholder="${placeholder}" ${field==='name'?'maxlength="180"':''}/>`}${opts.help?`<p class="field-help">${opts.help}</p>`:''}</div>`;
}
function renderPanel(){
  updateMobilePanelLabel();updateClearSelectionButton();
  const pane=$('detail-content');
  if(!selection){
    const current=focusId?roster(focusId):null;
    pane.innerHTML=`<div class="welcome-mark">✳</div><h2 class="welcome-title">Nothing selected</h2><p class="welcome-copy">${current?`Still exploring <strong>${esc(current.name)}</strong>'s neighborhood. Pick a character or relationship to inspect it.`:'Your world starts with one name. Add a character to begin exploring.'}</p><div class="welcome-tips"><div class="tip"><span class="tip-number">1</span>Tap or click a character to explore their connections.</div><div class="tip"><span class="tip-number">2</span>Select a connecting line to inspect a relationship.</div><div class="tip"><span class="tip-number">3</span>Use the Roster to jump to anyone, even if they're off-screen.</div></div>${current?`<button class="secondary-button empty-inspect" data-panel-action="inspect-focus">Inspect ${esc(current.name)}</button>`:''}`;
    return;
  }
  if(selection.kind==='relationship'){
    const rel=edgeById(selection.id);if(!rel){selection=null;return renderPanel();}
    const a=roster(rel.source),b=roster(rel.target);
    pane.innerHTML=`<div class="detail-header-row"><span class="panel-section-title">CONNECTION DETAILS</span><span class="detail-header-actions"><button class="panel-action" data-panel-action="back">← Character</button><button class="panel-action clear-panel-action" data-panel-action="clear-selection" title="Clear selection" aria-label="Clear relationship selection">×</button></span></div>
      <div class="relationship-top"><button class="relationship-avatar" data-panel-action="focus" data-id="${esc(a.id)}">${esc(a.name)}</button><div class="relationship-icon">${rel.direction==='forward'?'→':rel.direction==='reverse'?'←':'↔'}</div><button class="relationship-avatar" data-panel-action="focus" data-id="${esc(b.id)}">${esc(b.name)}</button></div>
      ${lineField('Relationship label','type',rel.type,{placeholder:'Friends, rivals, co-workers…'})}
      <div class="field-group"><label class="field-label" for="field-direction">DIRECTION</label><select id="field-direction" data-field="direction" class="field-input"><option value="mutual" ${rel.direction==='mutual'?'selected':''}>Mutual / undirected</option><option value="forward" ${rel.direction==='forward'?'selected':''}>${esc(a.name)} → ${esc(b.name)}</option><option value="reverse" ${rel.direction==='reverse'?'selected':''}>${esc(b.name)} → ${esc(a.name)}</option></select><p class="field-help">The connection remains navigable from either character.</p></div>
      ${lineField('Their history','description',rel.description,{multiline:true,large:true,placeholder:'What connects these people?'})}
      ${lineField('Private working notes','notes',rel.notes,{multiline:true,rows:3,placeholder:'Unresolved threads, future developments…'})}
      <div class="panel-actions"><button class="danger-button" data-panel-action="delete-relationship">Remove relationship</button></div>
      <p class="panel-footnote">Multiple relationship records between two people share one line on the map.</p>`;
    return;
  }
  const c=roster(selection.id);if(!c){selection=null;return renderPanel();}
  const links=project.relationships.filter(r=>r.source===c.id||r.target===c.id);
  const target=c.portrait?`<img alt="Portrait for ${esc(c.name)}" src="${c.portrait}">`:'<span class="portrait-plus">＋</span><span>Add portrait</span>';
  pane.innerHTML=`<div class="detail-header-row"><span class="panel-section-title">CHARACTER PROFILE</span><span class="detail-header-actions"><button class="panel-action" data-panel-action="duplicate" title="Duplicate this character, without copying existing relationships">⧉ Duplicate</button><button class="panel-action clear-panel-action" data-panel-action="clear-selection" title="Clear selection" aria-label="Clear character selection">×</button></span></div>
    <div class="profile-portrait"><button id="portrait-target" class="portrait-target" title="Click or drop an image to add a portrait">${target}</button><span class="portrait-help">Click or drop a picture · optional</span>${c.portrait?'<button class="panel-action" data-panel-action="remove-portrait">Remove portrait</button>':''}</div>
    ${lineField('CHARACTER NAME','name',c.name,{large:true,placeholder:'Character name'})}
    ${lineField('Aliases / other names','aliases',c.aliases.join(', '),{placeholder:'Optional; separate with commas'})}
    ${lineField('Short description','summary',c.summary,{multiline:true,rows:2,placeholder:'Who are they, in a sentence or two?'})}
    ${lineField('Biography','biography',c.biography,{multiline:true,large:true,placeholder:'Write freely. No required format.'})}
    ${lineField('Groups / factions','groups',c.groups.join(', '),{placeholder:'Separate groups with commas'})}
    ${lineField('Working notes','notes',c.notes,{multiline:true,rows:3,placeholder:'Ideas, future plot threads, loose ends…'})}
    <hr class="section-divider"><div class="detail-section-head"><h3>Relationships <span class="small-pill">${links.length}</span></h3><button class="panel-action" data-panel-action="add-connection">＋ Connect</button></div>
    <div class="connections-list">${links.length?links.map(r=>{const other=roster(r.source===c.id?r.target:r.source);return `<button class="connection-item" data-panel-action="open-relationship" data-id="${esc(r.id)}"><span><strong>${esc(other?.name||'?')}</strong><small>${esc(r.type)}</small></span><span class="connection-arrow">↗</span></button>`;}).join(''):'<div class="empty-connections">No relationships yet. Choose “Connect” to link this character to someone else.</div>'}</div>
    <hr class="section-divider"><div class="panel-actions"><button class="danger-button" data-panel-action="delete-character">Delete character</button></div><p class="panel-footnote">Edits save automatically to this browser. Use Export backup to keep a portable copy.</p>`;
  const portraitBtn=$('portrait-target');
  portraitBtn.addEventListener('click',()=>{photoTarget=c.id;$('portrait-file').click();});
  portraitBtn.addEventListener('dragover',ev=>{ev.preventDefault();portraitBtn.classList.add('dragging');});
  portraitBtn.addEventListener('dragleave',()=>portraitBtn.classList.remove('dragging'));
  portraitBtn.addEventListener('drop',ev=>{ev.preventDefault();portraitBtn.classList.remove('dragging');if(ev.dataTransfer.files[0])loadPortrait(ev.dataTransfer.files[0],c.id);});
}
$('detail-content').addEventListener('focusin',ev=>{if(ev.target.matches('[data-field]')&&!inputSnapshot)inputSnapshot=JSON.stringify(project);});
$('detail-content').addEventListener('focusout',ev=>{if(ev.target.matches('[data-field]')){if(ev.target.dataset.field==='name'&&!ev.target.value.trim()){ev.target.value=selection.kind==='character'?roster(selection.id)?.name||'':ev.target.value;toast('A character needs a name.','warn');}endInlineEdit();}});
$('detail-content').addEventListener('input',ev=>{
  const field=ev.target.dataset.field;if(!field||!selection)return;
  const target=selection.kind==='character'?roster(selection.id):edgeById(selection.id);if(!target)return;
  if(field==='aliases'||field==='groups')target[field]=ev.target.value.split(',').map(s=>s.trim()).filter(Boolean);
  else if(field==='name'){if(ev.target.value.trim())target.name=ev.target.value.trim();}
  else target[field]=ev.target.value;
  queueSave();
  if(selection.kind==='character'&&field==='name'){const node=nodeElements.get(target.id);if(node){node.querySelector('.node-name').textContent=target.name;node.setAttribute('aria-label',`Explore ${target.name}`);}if(target.id===focusId)$('canvas-label').textContent=`EXPLORING ${target.name.toUpperCase()}`;}
  if(selection.kind==='relationship'&&field==='type')renderGraphEdges();
  if(selection.kind==='character'&&field==='name')renderRoster();
});
$('detail-content').addEventListener('change',ev=>{if(ev.target.dataset.field==='direction'&&selection?.kind==='relationship'){
  const id=selection.id,value=ev.target.value;commit(()=>{edgeById(id).direction=value;});
}});
$('detail-content').addEventListener('click',ev=>{
  const button=ev.target.closest('[data-panel-action]');if(!button)return;const action=button.dataset.panelAction;
  if(action==='clear-selection'){clearSelection();return;}
  if(action==='inspect-focus'){selectCharacter(focusId);return;}
  if(action==='back'){selectCharacter(focusId||project.characters[0]?.id);return;}
  if(action==='focus'){selectCharacter(button.dataset.id);return;}
  if(action==='open-relationship'){endInlineEdit();selection={kind:'relationship',id:button.dataset.id};renderPanel();renderGraphEdges();return;}
  if(!selection||selection.kind!=='character'&&action!=='delete-relationship')return;
  const id=selection.id;
  if(action==='duplicate')duplicateCharacter(id);
  if(action==='add-connection')openModal('new-relationship',{source:id});
  if(action==='remove-portrait')commit(()=>{roster(id).portrait=null;});
  if(action==='delete-character')openModal('delete-character',{id});
  if(action==='delete-relationship')openModal('delete-relationship',{id});
});
async function loadPortrait(file,id){
  if(!file||!file.type.startsWith('image/')){toast('Please choose an image file.','warn');return;}
  if(file.size>20*1024*1024){toast('Please use an image smaller than 20 MB.','warn');return;}
  try{
    const source=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('Image unreadable'));reader.readAsDataURL(file);});
    const image=await new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(new Error('Image format unsupported'));im.src=source;});
    const max=650,scale=Math.min(1,max/Math.max(image.naturalWidth,image.naturalHeight));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
    const ctx=canvas.getContext('2d');ctx.fillStyle='#1b2939';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);
    const data=canvas.toDataURL('image/jpeg',.84);
    if(!roster(id)){toast('Character no longer exists.','warn');return;}
    commit(()=>{roster(id).portrait=data;});toast('Portrait added');
  }catch(error){toast(`Could not add portrait: ${error.message}`,'error');}
}
$('portrait-file').addEventListener('change',ev=>{if(ev.target.files[0]&&photoTarget)loadPortrait(ev.target.files[0],photoTarget);ev.target.value='';});
function duplicateCharacter(id){const original=roster(id);if(!original)return;const newId=uid();commit(()=>{const copy=clone(original);copy.id=newId;copy.name=`${original.name} (copy)`;copy.createdAt=new Date().toISOString();project.characters.push(copy);});selectCharacter(newId);toast('Independent character copy created; relationships not copied.');}

// CHARACTER ROSTER: full-project navigation, independent of map visibility.
let rosterOpen=false;
function rosterContacts(){
  const contacts=new Map(project.characters.map(c=>[c.id,new Set()]));
  for(const r of project.relationships){
    if(contacts.has(r.source)&&contacts.has(r.target)&&r.source!==r.target){
      contacts.get(r.source).add(r.target);contacts.get(r.target).add(r.source);
    }
  }
  return contacts;
}
function renderRoster(){
  if(!rosterOpen||!project)return;
  const contacts=rosterContacts();
  const unconnected=project.characters.filter(c=>(contacts.get(c.id)?.size||0)===0).length;
  $('roster-summary').textContent=`${project.characters.length} characters · ${unconnected} without connections`;
  const query=$('roster-search').value.trim().toLocaleLowerCase();
  const unlinkedOnly=$('roster-unlinked').checked;
  const sort=$('roster-sort').value;
  const filtered=project.characters.filter(c=>
    (!unlinkedOnly||(contacts.get(c.id)?.size||0)===0)&&
    (!query||c.name.toLocaleLowerCase().includes(query)||c.aliases.some(a=>a.toLocaleLowerCase().includes(query)))
  );
  filtered.sort((a,b)=>{
    const delta=(contacts.get(a.id)?.size||0)-(contacts.get(b.id)?.size||0);
    return (sort==='most'?-delta:sort==='fewest'?delta:0)||sortByName(a,b);
  });
  const maxRows=250,shown=filtered.slice(0,maxRows);
  $('roster-list').innerHTML=shown.length?shown.map(c=>{
    const count=contacts.get(c.id)?.size||0;
    return `<button type="button" class="roster-entry${c.id===focusId?' is-current':''}" data-roster-id="${esc(c.id)}" title="Explore ${esc(c.name)}">
      <span class="roster-entry-main"><strong>${esc(c.name)}</strong>${c.aliases.length?`<small>${esc(c.aliases.slice(0,2).join(' · '))}</small>`:''}</span>
      <span class="roster-entry-count${count===0?' is-zero':''}">${count===0?'No contacts':`${count} ${count===1?'contact':'contacts'}`}</span>
      ${c.id===focusId?'<span class="roster-current" aria-label="Currently centered">◎</span>':''}
    </button>`;
  }).join(''):'<div class="roster-empty">No matching characters. Try another name or filter.</div>';
  $('roster-footnote').textContent=filtered.length>maxRows?`Showing the first ${maxRows} of ${filtered.length} matches. Search to narrow the list.`:`${filtered.length} ${filtered.length===1?'character':'characters'} listed · Counts are distinct people, not relationship records.`;
}
function openRoster(){
  if(rosterOpen)return;
  rosterOpen=true;
  $('roster-drawer').classList.remove('hidden');$('roster-scrim').classList.remove('hidden');
  $('open-roster').setAttribute('aria-expanded','true');
  $('workspace-menu').classList.add('hidden');$('workspace-menu-button').setAttribute('aria-expanded','false');
  searchResults.classList.add('hidden');
  renderRoster();$('roster-search').focus();
}
function closeRoster(restoreFocus=false){
  if(!rosterOpen)return;
  rosterOpen=false;
  $('roster-drawer').classList.add('hidden');$('roster-scrim').classList.add('hidden');
  $('open-roster').setAttribute('aria-expanded','false');
  if(restoreFocus)$('open-roster').focus();
}
$('open-roster').addEventListener('click',()=>rosterOpen?closeRoster(true):openRoster());
$('close-roster').addEventListener('click',()=>closeRoster(true));
$('roster-scrim').addEventListener('click',()=>closeRoster());
$('roster-search').addEventListener('input',renderRoster);
$('roster-sort').addEventListener('change',renderRoster);
$('roster-unlinked').addEventListener('change',renderRoster);
$('roster-list').addEventListener('click',ev=>{
  const choice=ev.target.closest('[data-roster-id]');if(!choice)return;
  const id=choice.dataset.rosterId;
  if(!roster(id))return;
  closeRoster();selectCharacter(id);
  viewport.focus({preventScroll:true});
});

// SEARCH + TOOLBAR
const search=$('character-search'),searchResults=$('search-results');
function updateToolbarPlaceholder(){search.placeholder=window.innerWidth<=760?'Find…':'Find anyone in this world…';}
updateToolbarPlaceholder();window.addEventListener('resize',updateToolbarPlaceholder);
function runSearch(){const q=search.value.trim().toLocaleLowerCase();if(!q){searchResults.classList.add('hidden');return;}
  const found=project.characters.filter(c=>c.name.toLocaleLowerCase().includes(q)||c.aliases.some(a=>a.toLocaleLowerCase().includes(q))).sort(sortByName).slice(0,30);
  searchResults.innerHTML=found.length?found.map(c=>`<button role="option" data-search-id="${esc(c.id)}"><b>${esc(c.name)}</b>${c.aliases.length?`<small>${esc(c.aliases.join(' · '))}</small>`:''}</button>`).join(''):'<div class="search-empty">No matching characters.</div>';
  searchResults.classList.remove('hidden');
}
search.addEventListener('input',runSearch);
search.addEventListener('focus',runSearch);
search.addEventListener('keydown',ev=>{if(ev.key==='Enter'){const first=searchResults.querySelector('[data-search-id]');if(first){ev.preventDefault();selectCharacter(first.dataset.searchId);search.value='';searchResults.classList.add('hidden');search.blur();}}if(ev.key==='Escape'){searchResults.classList.add('hidden');search.blur();}});
searchResults.addEventListener('click',ev=>{const btn=ev.target.closest('[data-search-id]');if(!btn)return;selectCharacter(btn.dataset.searchId);search.value='';searchResults.classList.add('hidden');});
document.addEventListener('click',ev=>{if(!ev.target.closest('.search-wrap'))searchResults.classList.add('hidden');if(!ev.target.closest('#workspace-menu')&&!ev.target.closest('#workspace-menu-button')){$('workspace-menu').classList.add('hidden');$('workspace-menu-button').setAttribute('aria-expanded','false');}});
$('clear-selection').addEventListener('click',clearSelection);
$('add-character').addEventListener('click',()=>openModal('new-character'));
$('empty-add').addEventListener('click',()=>openModal('new-character'));
document.querySelectorAll('[data-depth]').forEach(b=>b.addEventListener('click',()=>{project.settings.depth=b.dataset.depth;queueSave();refresh();if(project.settings.depth==='all')setTimeout(fitMap,500);}));
$('names-only').addEventListener('change',ev=>{project.settings.namesOnly=ev.target.checked;queueSave();recalcScene();});
$('undo-button').addEventListener('click',undo);$('redo-button').addEventListener('click',redo);
$('workspace-menu-button').addEventListener('click',()=>{const menu=$('workspace-menu');menu.classList.toggle('hidden');$('workspace-menu-button').setAttribute('aria-expanded',String(!menu.classList.contains('hidden')));});
$('workspace-menu').addEventListener('click',ev=>{
  const button=ev.target.closest('button[data-action]');if(!button)return;$('workspace-menu').classList.add('hidden');
  switch(button.dataset.action){case 'export':exportProject();break;case 'import':$('import-file').click();break;case 'new-project':openModal('new-project');break;case 'help':openModal('help');break;case 'about':openModal('about');break;}
});
$('rename-project').addEventListener('click',()=>openModal('rename'));
$('import-file').addEventListener('change',async ev=>{
  const file=ev.target.files?.[0];ev.target.value='';if(!file)return;
  try{const raw=JSON.parse(await file.text());const loaded=validateImported(raw);if(!confirm(`Replace the current world with “${loaded.name}”? Export a backup first if you want to keep your changes.`))return;resetProject(loaded);toast(`${loaded.name} imported successfully`);}catch(e){toast(`Import failed: ${e.message}`,'error');}
});
function exportProject(){endInlineEdit();const data=JSON.stringify(project,null,2);const blob=new Blob([data],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`${project.name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'character-world'}-backup.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);toast('Portable backup exported');}
window.addEventListener('keydown',ev=>{
  const isInput=['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName);const meta=ev.ctrlKey||ev.metaKey;
  if(meta&&ev.key.toLowerCase()==='z'){ev.preventDefault();if(ev.shiftKey)redo();else undo();return;}
  if(meta&&ev.key.toLowerCase()==='y'){ev.preventDefault();redo();return;}
  if(ev.key==='Escape'){
    if(!$('modal-backdrop').classList.contains('hidden')){closeModal();return;}
    if(rosterOpen){ev.preventDefault();closeRoster(true);return;}
    if(!searchResults.classList.contains('hidden')){searchResults.classList.add('hidden');search.blur();return;}
    if(!isInput){clearSelection();return;}
    return;
  }
  if(ev.key.toLowerCase()==='r'&&!isInput&&!meta&&$('modal-backdrop').classList.contains('hidden')){ev.preventDefault();rosterOpen?closeRoster(true):openRoster();return;}
  if(ev.key==='/'&&!isInput&&$('modal-backdrop').classList.contains('hidden')){ev.preventDefault();search.focus();return;}
  if(ev.key==='+'&&!isInput&&$('modal-backdrop').classList.contains('hidden')){ev.preventDefault();openModal('new-character');}
});

// MODALS + ACTIONS
function openModal(kind,context={}){
  closeRoster();endInlineEdit();modalKind=kind;modalContext=context;const set=(title,html,submit='Save',eyebrow='WORLD EDITOR')=>{$('modal-title').textContent=title;$('modal-eyebrow').textContent=eyebrow;$('modal-fields').innerHTML=html;$('modal-submit').textContent=submit;$('modal-submit').classList.remove('hidden');$('modal-cancel').textContent='Cancel';};
  switch(kind){
    case 'new-character':set('New character',`<p class="modal-desc">One name is all you need. You can fill in the rest whenever you like.</p><label class="field-label" for="modal-name">NAME</label><input id="modal-name" name="name" class="field-input name-input" maxlength="180" required placeholder="Who’s joining the world?" autocomplete="off"/>`,'Add character');break;
    case 'new-relationship':{
      const source=roster(context.source);
      const characters=project.characters.filter(c=>c.id!==context.source).sort(sortByName);
      const options=characters.map(c=>`<option value="${esc(c.id)}" ${c.id===context.target?'selected':''}>${esc(c.name)}</option>`).join('');
      const existing=project.relationships.filter(r=>(r.source===context.source&&r.target===context.target)||(r.target===context.source&&r.source===context.target));
      const common=['Friendship','Romance','Family','Rivalry','Mentorship','Professional','Bandmates','Community'];
      const suggestions=[...new Set([...common,...project.relationships.map(r=>r.type).filter(Boolean)])].slice(0,16);
      const buttons=suggestions.map(t=>`<button type="button" class="relationship-suggestion" data-relationship-suggestion="${esc(t)}">${esc(t)}</button>`).join('');
      set('Connect characters',`<p class="modal-desc">Connect <strong>${esc(source?.name||'?')}</strong> to someone else in this world.${existing.length?`<br><span class="existing-connection-note">These characters already have ${existing.length} recorded relationship${existing.length===1?'':'s'}. You can add another.</span>`:''}</p><div class="field-group"><label class="field-label" for="modal-target">CONNECT TO</label><select id="modal-target" name="target" class="field-input" required>${options}</select></div><div class="field-group"><label class="field-label" for="modal-type">RELATIONSHIP</label><input id="modal-type" name="type" class="field-input" placeholder="Connection (default), or type your own" autocomplete="off" maxlength="150"><div class="relationship-suggestions" aria-label="Quick relationship types">${buttons}</div></div><div class="field-group"><label class="field-label" for="modal-direction">DIRECTION</label><select id="modal-direction" name="direction" class="field-input"><option value="mutual">Mutual / undirected</option><option value="forward">Source → recipient</option><option value="reverse">Recipient → source</option></select></div><div class="field-group"><label class="field-label" for="modal-description">DETAILS (OPTIONAL)</label><textarea id="modal-description" name="description" rows="3" class="field-input" placeholder="What’s the story between them?"></textarea></div>`,'Create connection');break;
    }
    case 'rename':set('Rename world',`<label class="field-label" for="modal-name">WORLD NAME</label><input id="modal-name" name="name" class="field-input name-input" maxlength="180" required value="${esc(project.name)}"/>`,'Rename');break;
    case 'new-project':set('New blank world',`<p class="modal-desc">This replaces the current workspace. Export a backup first if you want to keep the current world.</p><label class="field-label" for="modal-name">WORLD NAME</label><input id="modal-name" name="name" class="field-input name-input" maxlength="180" required placeholder="Untitled world"/>`,'Create blank world');break;
    case 'delete-character':{const c=roster(context.id);const num=project.relationships.filter(r=>r.source===context.id||r.target===context.id).length;set('Delete character?',`<p class="modal-desc">Remove <strong>${esc(c?.name||'?')}</strong> and ${num} connected relationship${num===1?'':'s'}? This can be undone.</p>`,'Delete character');break;}
    case 'delete-relationship':{const r=edgeById(context.id);set('Remove relationship?',`<p class="modal-desc">Remove this <strong>${esc(r?.type||'')}</strong> connection? The characters and their other relationships will remain. This can be undone.</p>`,'Remove connection');break;}
    case 'character-actions':{
      const c=roster(context.id);set(c?.name||'Character',`<p class="modal-desc">Quick actions for this character.</p><div class="modal-options"><button type="button" class="secondary-button" id="action-duplicate">⧉ Duplicate character</button><button type="button" class="secondary-button" id="action-connect">↗ Add connection</button><button type="button" class="secondary-button" id="action-focus">◎ Focus here</button></div>`,'Close');break;
    }
    case 'help':set('How to explore',`<div class="modal-preview"><b>Click a character</b> to center their connections and edit their details.<br><b>Shift-click a different visible character</b> to connect them with the currently centered one.<br><b>Click a line</b> to inspect or edit a relationship.<br><b>Drag the background</b> to pan; <b>scroll</b> to zoom. On touch screens, <b>drag with one finger</b> to pan and <b>pinch with two fingers</b> to zoom. Use <b>◎</b> to fit immediate connections and <b>⤢</b> to fit everything visible.<br><b>Double-click blank space</b> to add someone.<br><b>Drag a portrait</b> into a character profile.<br><b>Roster</b> opens the complete alphabetical list, sortable by contact count, with an option to show only unconnected characters.<br><b>Click or tap blank map space</b>, use the <b>× Clear</b> button, or press <b>Esc</b> to deselect without changing the centered neighborhood.<br><b>Search</b> reaches everyone, even those outside the current view.<br><b>1 step / 2 steps / Everyone</b> controls the visible neighborhood.</div><p class="modal-desc"><b>Shortcuts:</b> Shift-click Connect · R Roster · Esc Clear selection / close roster · / Search · + New character · Ctrl/⌘ Z Undo · Ctrl/⌘ Shift Z Redo.</p><p class="modal-desc">Your edits save in this browser, not on a server. Export a backup regularly, particularly before resetting your browser.</p>`,'Close','YOUR GUIDE');break;
    case 'about':set('Character Web 0.1.4',`<p class="modal-desc">An offline-first interactive relationship encyclopedia. This first build is a proof of the network, editing, and local project workflows.</p><div class="modal-preview"><b>Included:</b> editable people and links, aliases, groups, optional portraits, search, recentering, zoom, local autosave, undo/redo, import/export.<br><b>Planned, not yet included:</b> full wiki linking, network analysis, timeline history, spoiler-safe publishing, ThreadWriter integration.</div><p class="modal-desc">This build has no external dependencies, account requirement, or network requests. New visitors begin with an empty world; projects stay in the browser unless exported.</p>`,'Close','ABOUT THIS PROTOTYPE');break;
  }
  $('modal-backdrop').classList.remove('hidden');
  if(['about','help','character-actions'].includes(kind)){$('modal-submit').textContent='Close';$('modal-cancel').classList.add('hidden');}else $('modal-cancel').classList.remove('hidden');
  if(kind==='new-relationship'){
    $('modal-target').addEventListener('change',updateNewRelationshipDirections);
    updateNewRelationshipDirections();
    $('modal-fields').onclick=ev=>{
      const chip=ev.target.closest('[data-relationship-suggestion]');if(!chip)return;
      $('modal-type').value=chip.dataset.relationshipSuggestion;
      $('modal-type').focus();
    };
  }
  if(kind==='character-actions'){
    $('action-duplicate').addEventListener('click',()=>{closeModal();duplicateCharacter(context.id);});
    $('action-connect').addEventListener('click',()=>openModal('new-relationship',{source:context.id}));
    $('action-focus').addEventListener('click',()=>{closeModal();selectCharacter(context.id);});
  }
  requestAnimationFrame(()=>{const input=$('modal-name')||$('modal-target')||$('modal-submit');input?.focus();if(kind==='rename')$('modal-name')?.select();});
}
function updateNewRelationshipDirections(){
  const source=roster(modalContext.source),target=roster($('modal-target')?.value),direction=$('modal-direction');
  if(!source||!target||!direction)return;
  direction.querySelector('[value=forward]').textContent=`${source.name} → ${target.name}`;
  direction.querySelector('[value=reverse]').textContent=`${target.name} → ${source.name}`;
}
function closeModal(){$('modal-backdrop').classList.add('hidden');modalKind=null;modalContext={};}
$('modal-close').addEventListener('click',closeModal);$('modal-cancel').addEventListener('click',closeModal);
// Clicking outside an editing dialog never silently discards typed work.
$('modal-backdrop').addEventListener('click',ev=>{if(ev.target===$('modal-backdrop')){
  const first=$('modal-form').querySelector('input,select,textarea');first?.focus();
}});
$('modal-form').addEventListener('submit',ev=>{
  ev.preventDefault();const kind=modalKind,ctx=modalContext;
  try{
    if(kind==='new-character'){
      const name=$('modal-name').value.trim();if(!name)throw new Error('Please provide a name.');
      const id=uid();commit(()=>project.characters.push({id,name,summary:'',biography:'',notes:'',aliases:[],groups:[],portrait:null,customFields:{},visibility:'author',createdAt:new Date().toISOString()}));closeModal();selectCharacter(id);toast('Character added');
      if(project.characters.length===69)toast('Nice.');
      if(project.characters.length===500)toast('Are you sure you want to do this to yourself?');
      if(project.characters.length===1000)toast('You OK, buddy?');
    }
    else if(kind==='new-relationship'){
      const target=$('modal-target')?.value,source=ctx.source;if(!roster(source)||!roster(target)||source===target)throw new Error('Choose two different characters.');
      const type=$('modal-type').value.trim()||'Connection',description=$('modal-description').value.trim(),direction=$('modal-direction').value;const id=uid();
      commit(()=>project.relationships.push({id,source,target,type,description,direction,notes:'',visibility:'author'}));closeModal();selection={kind:'relationship',id};renderPanel();renderGraphEdges();toast('Connection added');
    }
    else if(kind==='rename'){const name=$('modal-name').value.trim();if(!name)throw new Error('Give your world a name.');commit(()=>{project.name=name;});closeModal();}
    else if(kind==='new-project'){const name=$('modal-name').value.trim();if(!name)throw new Error('Give your world a name.');resetProject(freshProject(name));closeModal();toast('Blank world created');}
    else if(kind==='delete-character'){const id=ctx.id;commit(()=>{project.characters=project.characters.filter(c=>c.id!==id);project.relationships=project.relationships.filter(r=>r.source!==id&&r.target!==id);});closeModal();toast('Character removed');}
    else if(kind==='delete-relationship'){const id=ctx.id;commit(()=>{project.relationships=project.relationships.filter(r=>r.id!==id);});closeModal();toast('Relationship removed');}
    else closeModal();
  }catch(e){toast(e.message,'warn');}
});
function toast(message,kind='normal'){
  const el=document.createElement('div');el.className='toast'+(kind==='normal'?'':` ${kind}`);el.textContent=message;$('toast-container').append(el);
  const timer=setTimeout(()=>el.remove(),2600);toastTimeouts.push(timer);
  if($('toast-container').children.length>3)$('toast-container').firstElementChild.remove();
}

// INIT
async function initialize(){
  saveState('Opening local project','saving');
  const raw=await loadStored();
  if(raw){try{project=validateImported(raw);}catch(e){console.warn(e);project=freshProject('Untitled world');toast('Stored project was unreadable. Started a blank world; the stored data was not overwritten.','warn');}}
  else project=freshProject('Untitled world');
  focusId=project.characters[0]?.id||null;
  selection=focusId?{kind:'character',id:focusId}:null;
  camera.scale=window.innerWidth<=760?.85:1;
  refresh();saveState(storageMode==='memory'?'Export backups to preserve work':'Saved in this browser',storageMode==='memory'?'error':'ok');
  if(!raw&&storageMode!=='memory')queueSave();
  if(storageMode==='memory')toast('Browser storage unavailable. Please export backups.','warn');
  window.addEventListener('pagehide',flushSave);
}
initialize().catch(err=>{console.error(err);toast('Could not start Character Web. Try another browser.','error');saveState('Startup error','error');});
})();
