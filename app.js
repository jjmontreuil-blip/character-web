/* Character Web 0.1.1. Offline, local-first, dependency-free prototype. */
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
    return {id,source:r.source,target:r.target,type:String(r.type||'Connection').slice(0,150),description:String(r.description||'').slice(0,150000),direction:r.direction==='forward'?'forward':'mutual',notes:String(r.notes||'').slice(0,150000),visibility:r.visibility==='public'?'public':'author'};
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
function ensureValidSelection(){if(focusId&&!roster(focusId))focusId=project.characters[0]?.id||null;if(!focusId)focusId=project.characters[0]?.id||null;if(selection?.kind==='character'&&!roster(selection.id))selection=null;if(selection?.kind==='relationship'&&!edgeById(selection.id))selection=null;if(!selection&&focusId)selection={kind:'character',id:focusId};}
function freshProject(name){return {schemaVersion:1,id:uid(),name,description:'',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),characters:[],relationships:[],settings:{depth:'1',namesOnly:false}};}
function resetProject(data){endInlineEdit();project=validateImported(data);undoStack=[];redoStack=[];positions.clear();camera={panX:0,panY:0,scale:window.innerWidth<=760?.69:1};focusId=project.characters[0]?.id||null;selection=focusId?{kind:'character',id:focusId}:null;queueSave();refresh();}

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
function groupsForVisibleEdges(){
  const available=new Set(visibleIds);const groups=new Map();
  for(const rel of project.relationships){if(!available.has(rel.source)||!available.has(rel.target))continue;const key=[rel.source,rel.target].sort().join('|');if(!groups.has(key))groups.set(key,[]);groups.get(key).push(rel);}
  return [...groups.entries()].map(([key,rels])=>({key,source:rels[0].source,target:rels[0].target,rels}));
}
function renderGraphEdges(){
  edgesLayer.replaceChildren();edgeElements=[];
  for(const item of groupsForVisibleEdges()){
    const selected=item.rels.some(r=>selection?.kind==='relationship'&&selection.id===r.id);
    const group=makeSvg('g',{'class':'edge-group','data-group':item.key});
    const line=makeSvg('line',{'class':'edge-line'+(selected?' selected':'')+(item.source===focusId||item.target===focusId?' near':'')});line.style.stroke=tone(item.rels[0].type);
    const hit=makeSvg('line',{'class':'edge-hit','stroke':'transparent'});
    group.append(line,hit);const title=makeSvg('title');title.textContent=item.rels.map(r=>r.type).join(' · ');group.append(title);edgesLayer.append(group);
    hit.addEventListener('click',ev=>{ev.stopPropagation();if(pointer?.moved)return;selection={kind:'relationship',id:item.rels[0].id};renderPanel();renderGraphEdges();});
    edgeElements.push({item,line,hit});
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
  $('canvas-label').textContent=focusId?`EXPLORING ${roster(focusId)?.name.toUpperCase()||'THE WEB'}`:'THE LIVING WEB';
}
function updatePositions(){
  for(const [id,el] of nodeElements){const p=positions.get(id);if(!p)continue;el.style.left=`${p.x}px`;el.style.top=`${p.y}px`;}
  for(const {item,line,hit} of edgeElements){const a=positions.get(item.source),b=positions.get(item.target);if(!a||!b)continue;
    for(const e of [line,hit]){e.setAttribute('x1',a.x);e.setAttribute('y1',a.y);e.setAttribute('x2',b.x);e.setAttribute('y2',b.y);}
  }
}
function startLayout(){if(raf)return;raf=requestAnimationFrame(layoutFrame);}
function layoutFrame(){
  raf=null;if(!visibleIds.length)return;
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
  if(ids.length<=380){
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
  if(moving>.14&&layoutActivity<360)startLayout();
}
function applyCamera(){const r=viewport.getBoundingClientRect();scene.style.transform=`translate(${r.width/2+camera.panX}px,${r.height/2+camera.panY}px) scale(${camera.scale})`;}
function zoomAt(factor,cx,cy){const rect=viewport.getBoundingClientRect(),mx=cx-rect.left-rect.width/2,my=cy-rect.top-rect.height/2;
  const before=camera.scale,after=clamp(before*factor,.24,2.8);camera.panX=mx-(mx-camera.panX)*after/before;camera.panY=my-(my-camera.panY)*after/before;camera.scale=after;applyCamera();
}
function fitMap(){if(!visibleIds.length)return;let left=0,right=0,top=0,bottom=0;for(const id of visibleIds){const p=positions.get(id);if(!p)continue;left=Math.min(left,p.x-100);right=Math.max(right,p.x+100);top=Math.min(top,p.y-85);bottom=Math.max(bottom,p.y+85);}
  const r=viewport.getBoundingClientRect();const w=right-left,h=bottom-top,scale=clamp(Math.min((r.width-65)/w,(r.height-175)/h),.25,1.3);camera.scale=scale;camera.panX=-(left+right)/2*scale;camera.panY=-(top+bottom)/2*scale;applyCamera();toast('Map fitted to view');}
function selectCharacter(id){if(!roster(id))return;endInlineEdit();focusId=id;selection={kind:'character',id};camera.panX=0;camera.panY=0;camera.scale=window.innerWidth<=760?.69:1;applyCamera();recalcScene();renderPanel();}
function refresh(){ensureValidSelection();$('project-name').textContent=project.name;$('roster-count').textContent=`${project.characters.length} people · ${project.relationships.length} relationships`;
  $('names-only').checked=project.settings.namesOnly;document.querySelectorAll('[data-depth]').forEach(b=>b.classList.toggle('active',b.dataset.depth===project.settings.depth));updateUndoButtons();recalcScene();renderPanel();applyCamera();}
function updateUndoButtons(){$('undo-button').disabled=!undoStack.length;$('redo-button').disabled=!redoStack.length;}

// GRAPH INTERACTIONS
function startNodeDrag(ev){if(ev.button!==0)return;ev.stopPropagation();ev.preventDefault();const id=ev.currentTarget.dataset.nodeId;
  pointer={mode:'node',id,startX:ev.clientX,startY:ev.clientY,lastX:ev.clientX,lastY:ev.clientY,moved:false};ev.currentTarget.classList.add('is-dragging');
}
viewport.addEventListener('pointerdown',ev=>{
  if(ev.button!==0||ev.target.closest('.network-node')||ev.target.closest('.canvas-controls'))return;
  if(ev.target.closest('.edge-hit'))return;
  pointer={mode:'pan',startX:ev.clientX,startY:ev.clientY,lastX:ev.clientX,lastY:ev.clientY,moved:false};
});
window.addEventListener('pointermove',ev=>{
  if(!pointer)return;const dx=ev.clientX-pointer.lastX,dy=ev.clientY-pointer.lastY;
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
  if(!pointer)return;const p=pointer;pointer=null;
  document.querySelectorAll('.network-node.is-dragging').forEach(el=>el.classList.remove('is-dragging'));
  if(p.mode==='node'&&!p.moved)selectCharacter(p.id);
  else if(p.mode==='node'){const pos=positions.get(p.id);if(pos){targetPositions.set(p.id,{x:pos.x,y:pos.y});startLayout();}}
});
window.addEventListener('pointercancel',()=>{pointer=null;document.querySelectorAll('.network-node.is-dragging').forEach(el=>el.classList.remove('is-dragging'));});
viewport.addEventListener('wheel',ev=>{ev.preventDefault();zoomAt(ev.deltaY<0?1.1:1/1.1,ev.clientX,ev.clientY);},{passive:false});
viewport.addEventListener('dblclick',ev=>{if(ev.target.closest('.network-node')||ev.target.closest('.edge-hit'))return;openModal('new-character');});
$('zoom-in').addEventListener('click',()=>{const r=viewport.getBoundingClientRect();zoomAt(1.2,r.left+r.width/2,r.top+r.height/2);});
$('zoom-out').addEventListener('click',()=>{const r=viewport.getBoundingClientRect();zoomAt(1/1.2,r.left+r.width/2,r.top+r.height/2);});
$('fit-map').addEventListener('click',fitMap);
window.addEventListener('resize',applyCamera);
$('mobile-panel-toggle').addEventListener('click',()=>{const pane=$('detail-pane');const expanded=pane.classList.toggle('expanded');$('mobile-panel-toggle').setAttribute('aria-expanded',String(expanded));$('mobile-panel-toggle').innerHTML=expanded?'⌄ <span>Collapse details</span>':'⌃ <span>Expand details</span>';requestAnimationFrame(applyCamera);});

// THE DETAIL PANE
function lineField(label,field,value,opts={}){const type=opts.multiline?'textarea':'input';const placeholder=esc(opts.placeholder||'Optional');
  return `<div class="field-group"><label class="field-label" for="field-${field}">${label}</label>${type==='textarea'?`<textarea id="field-${field}" data-field="${field}" class="field-input ${opts.large?'rich-text':''}" rows="${opts.rows||3}" placeholder="${placeholder}">${esc(value)}</textarea>`:`<input id="field-${field}" data-field="${field}" class="field-input ${opts.large?'name-input':''}" value="${esc(value)}" placeholder="${placeholder}" ${field==='name'?'maxlength="180"':''}/>`}${opts.help?`<p class="field-help">${opts.help}</p>`:''}</div>`;
}
function renderPanel(){
  const pane=$('detail-content');
  if(!selection){pane.innerHTML=`<div class="welcome-mark">✳</div><h2 class="welcome-title">A world of connections</h2><p class="welcome-copy">Create your first character and explore the relationships that grow around them.</p><div class="welcome-tips"><div class="tip"><span class="tip-number">1</span>Click a character to center their neighborhood.</div><div class="tip"><span class="tip-number">2</span>Click a connecting line to edit a relationship.</div><div class="tip"><span class="tip-number">3</span>Changes save locally. Export a backup from the menu.</div></div>`;return;}
  if(selection.kind==='relationship'){
    const rel=edgeById(selection.id);if(!rel){selection=null;return renderPanel();}
    const a=roster(rel.source),b=roster(rel.target);
    pane.innerHTML=`<div class="detail-header-row"><span class="panel-section-title">CONNECTION DETAILS</span><button class="panel-action" data-panel-action="back">← Character</button></div>
      <div class="relationship-top"><button class="relationship-avatar" data-panel-action="focus" data-id="${esc(a.id)}">${esc(a.name)}</button><div class="relationship-icon">↔</div><button class="relationship-avatar" data-panel-action="focus" data-id="${esc(b.id)}">${esc(b.name)}</button></div>
      ${lineField('Relationship label','type',rel.type,{placeholder:'Friends, rivals, co-workers…'})}
      <div class="field-group"><label class="field-label" for="field-direction">DIRECTION</label><select id="field-direction" data-field="direction" class="field-input"><option value="mutual" ${rel.direction==='mutual'?'selected':''}>Mutual / undirected</option><option value="forward" ${rel.direction==='forward'?'selected':''}>${esc(a.name)} → ${esc(b.name)}</option></select><p class="field-help">The connection remains navigable from either character.</p></div>
      ${lineField('Their history','description',rel.description,{multiline:true,large:true,placeholder:'What connects these people?'})}
      ${lineField('Private working notes','notes',rel.notes,{multiline:true,rows:3,placeholder:'Unresolved threads, future developments…'})}
      <div class="panel-actions"><button class="danger-button" data-panel-action="delete-relationship">Remove relationship</button></div>
      <p class="panel-footnote">Multiple relationship records between two people share one line on the map.</p>`;
    return;
  }
  const c=roster(selection.id);if(!c){selection=null;return renderPanel();}
  const links=project.relationships.filter(r=>r.source===c.id||r.target===c.id);
  const target=c.portrait?`<img alt="Portrait for ${esc(c.name)}" src="${c.portrait}">`:'<span class="portrait-plus">＋</span><span>Add portrait</span>';
  pane.innerHTML=`<div class="detail-header-row"><span class="panel-section-title">CHARACTER PROFILE</span><button class="panel-action" data-panel-action="duplicate" title="Duplicate this character, without copying existing relationships">⧉ Duplicate</button></div>
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
});
$('detail-content').addEventListener('change',ev=>{if(ev.target.dataset.field==='direction'&&selection?.kind==='relationship'){edgeById(selection.id).direction=ev.target.value;queueSave();}});
$('detail-content').addEventListener('click',ev=>{
  const button=ev.target.closest('[data-panel-action]');if(!button)return;const action=button.dataset.panelAction;
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

// SEARCH + TOOLBAR
const search=$('character-search'),searchResults=$('search-results');
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
  if(ev.key==='Escape'){if(!$('modal-backdrop').classList.contains('hidden')){closeModal();return;}searchResults.classList.add('hidden');return;}
  if(ev.key==='/'&&!isInput&&$('modal-backdrop').classList.contains('hidden')){ev.preventDefault();search.focus();return;}
  if(ev.key==='+'&&!isInput&&$('modal-backdrop').classList.contains('hidden')){ev.preventDefault();openModal('new-character');}
});

// MODALS + ACTIONS
function openModal(kind,context={}){
  endInlineEdit();modalKind=kind;modalContext=context;const set=(title,html,submit='Save',eyebrow='WORLD EDITOR')=>{$('modal-title').textContent=title;$('modal-eyebrow').textContent=eyebrow;$('modal-fields').innerHTML=html;$('modal-submit').textContent=submit;$('modal-submit').classList.remove('hidden');$('modal-cancel').textContent='Cancel';};
  switch(kind){
    case 'new-character':set('New character',`<p class="modal-desc">One name is all you need. You can fill in the rest whenever you like.</p><label class="field-label" for="modal-name">NAME</label><input id="modal-name" name="name" class="field-input name-input" maxlength="180" required placeholder="Who’s joining the world?" autocomplete="off"/>`,'Add character');break;
    case 'new-relationship':{
      const source=roster(context.source);const options=project.characters.filter(c=>c.id!==context.source).sort(sortByName).map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('');
      set('Connect characters',`<p class="modal-desc">Connect <strong>${esc(source?.name||'?')}</strong> to someone else in this world.</p><div class="field-group"><label class="field-label" for="modal-target">CONNECT TO</label><select id="modal-target" name="target" class="field-input" required>${options}</select></div><div class="field-group"><label class="field-label" for="modal-type">RELATIONSHIP</label><input id="modal-type" name="type" class="field-input" list="rel-suggestions" placeholder="Friends, enemies, siblings…" value="Connection"><datalist id="rel-suggestions"><option value="Friendship"><option value="Romance"><option value="Family"><option value="Rivalry"><option value="Mentorship"><option value="Professional"><option value="Bandmates"><option value="Community"></datalist></div><div class="field-group"><label class="field-label" for="modal-description">DETAILS (OPTIONAL)</label><textarea id="modal-description" name="description" rows="3" class="field-input" placeholder="What’s the story between them?"></textarea></div>`,'Create connection');break;
    }
    case 'rename':set('Rename world',`<label class="field-label" for="modal-name">WORLD NAME</label><input id="modal-name" name="name" class="field-input name-input" maxlength="180" required value="${esc(project.name)}"/>`,'Rename');break;
    case 'new-project':set('New blank world',`<p class="modal-desc">This replaces the current workspace. Export a backup first if you want to keep the current world.</p><label class="field-label" for="modal-name">WORLD NAME</label><input id="modal-name" name="name" class="field-input name-input" maxlength="180" required placeholder="Untitled world"/>`,'Create blank world');break;
    case 'delete-character':{const c=roster(context.id);const num=project.relationships.filter(r=>r.source===context.id||r.target===context.id).length;set('Delete character?',`<p class="modal-desc">Remove <strong>${esc(c?.name||'?')}</strong> and ${num} connected relationship${num===1?'':'s'}? This can be undone.</p>`,'Delete character');break;}
    case 'delete-relationship':{const r=edgeById(context.id);set('Remove relationship?',`<p class="modal-desc">Remove this <strong>${esc(r?.type||'')}</strong> connection? The characters and their other relationships will remain. This can be undone.</p>`,'Remove connection');break;}
    case 'character-actions':{
      const c=roster(context.id);set(c?.name||'Character',`<p class="modal-desc">Quick actions for this character.</p><div class="modal-options"><button type="button" class="secondary-button" id="action-duplicate">⧉ Duplicate character</button><button type="button" class="secondary-button" id="action-connect">↗ Add connection</button><button type="button" class="secondary-button" id="action-focus">◎ Focus here</button></div>`,'Close');break;
    }
    case 'help':set('How to explore',`<div class="modal-preview"><b>Click a character</b> to center their connections and edit their details.<br><b>Click a line</b> to inspect or edit a relationship.<br><b>Drag the background</b> to pan; <b>scroll</b> to zoom.<br><b>Double-click blank space</b> to add someone.<br><b>Drag a portrait</b> into a character profile.<br><b>Search</b> reaches everyone, even those outside the current view.<br><b>1 step / 2 steps / Everyone</b> controls the visible neighborhood.</div><p class="modal-desc"><b>Shortcuts:</b> / Search · + New character · Ctrl/⌘ Z Undo · Ctrl/⌘ Shift Z Redo.</p><p class="modal-desc">Your edits save in this browser, not on a server. Export a backup regularly, particularly before resetting your browser.</p>`,'Close','YOUR GUIDE');break;
    case 'about':set('Character Web 0.1.1',`<p class="modal-desc">An offline-first interactive relationship encyclopedia. This first build is a proof of the network, editing, and local project workflows.</p><div class="modal-preview"><b>Included:</b> editable people and links, aliases, groups, optional portraits, search, recentering, zoom, local autosave, undo/redo, import/export.<br><b>Planned, not yet included:</b> full wiki linking, network analysis, timeline history, spoiler-safe publishing, ThreadWriter integration.</div><p class="modal-desc">This build has no external dependencies, account requirement, or network requests. New visitors begin with an empty world; projects stay in the browser unless exported.</p>`,'Close','ABOUT THIS PROTOTYPE');break;
  }
  $('modal-backdrop').classList.remove('hidden');
  if(['about','help','character-actions'].includes(kind)){$('modal-submit').textContent='Close';$('modal-cancel').classList.add('hidden');}else $('modal-cancel').classList.remove('hidden');
  if(kind==='character-actions'){
    $('action-duplicate').addEventListener('click',()=>{closeModal();duplicateCharacter(context.id);});
    $('action-connect').addEventListener('click',()=>openModal('new-relationship',{source:context.id}));
    $('action-focus').addEventListener('click',()=>{closeModal();selectCharacter(context.id);});
  }
  requestAnimationFrame(()=>{const input=$('modal-name')||$('modal-target')||$('modal-submit');input?.focus();if(kind==='rename')$('modal-name')?.select();});
}
function closeModal(){$('modal-backdrop').classList.add('hidden');modalKind=null;modalContext={};}
$('modal-close').addEventListener('click',closeModal);$('modal-cancel').addEventListener('click',closeModal);
$('modal-backdrop').addEventListener('click',ev=>{if(ev.target===$('modal-backdrop'))closeModal();});
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
      const type=$('modal-type').value.trim()||'Connection',description=$('modal-description').value.trim();const id=uid();
      commit(()=>project.relationships.push({id,source,target,type,description,direction:'mutual',notes:'',visibility:'author'}));closeModal();selection={kind:'relationship',id};renderPanel();renderGraphEdges();toast('Connection added');
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
  camera.scale=window.innerWidth<=760?.69:1;
  refresh();saveState(storageMode==='memory'?'Export backups to preserve work':'Saved in this browser',storageMode==='memory'?'error':'ok');
  if(!raw&&storageMode!=='memory')queueSave();
  if(storageMode==='memory')toast('Browser storage unavailable. Please export backups.','warn');
  window.addEventListener('pagehide',flushSave);
}
initialize().catch(err=>{console.error(err);toast('Could not start Character Web. Try another browser.','error');saveState('Startup error','error');});
})();
