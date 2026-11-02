const STORAGE={library:"checkpoint.library.v1",progress:"checkpoint.progress.v1",dismissed:"checkpoint.dismissed.v1"};
const COLORS=["#5968b8","#9f596b","#2c8a73","#ad7741","#71599f","#3f789e","#9b4f91","#697942"];
const PLATFORM_NAMES={NES:"Nintendo Entertainment System",SNES:"Super Nintendo",GB:"Game Boy",GBC:"Game Boy Color",GBA:"Game Boy Advance",N64:"Nintendo 64",NDS:"Nintendo DS",'3DS':"Nintendo 3DS",MASTER_SYSTEM:"Sega Master System",GENESIS:"Sega Genesis / Mega Drive",SEGA_CD:"Sega CD",SATURN:"Sega Saturn",DREAMCAST:"Sega Dreamcast",ARCADE_CPS1:"Arcade — CPS-1",ARCADE_CPS2:"Arcade — CPS-2",ARCADE_CPS3:"Arcade — CPS-3",ARCADE_FBNEO:"Arcade — FinalBurn Neo",ARCADE_MAME:"Arcade — MAME",NEOGEO:"Neo Geo",NGP:"Neo Geo Pocket",OPENBOR:"OpenBOR",MSX2:"MSX2 / MSX2+",PCENGINE:"PC Engine / TurboGrafx-16",WONDERSWAN_COLOR:"WonderSwan Color",PS1:"PlayStation",PS2:"PlayStation 2",PS3:"PlayStation 3",PSP:"PSP",WII_GC:"Wii / GameCube"};
const LIBRARY_PAGE_SIZE=120;
const DEMO={format:"checkpoint-inventory",version:1,generatedAt:new Date().toISOString(),games:[
  {id:"demo-ff3",title:"Final Fantasy III",normalizedTitle:"final fantasy iii",platform:"SNES",files:[{relativePath:"snes/Final Fantasy III (USA).sfc"}]},
  {id:"demo-ff4",title:"Final Fantasy IV",normalizedTitle:"final fantasy iv",platform:"SNES",files:[{relativePath:"snes/Final Fantasy IV (USA).sfc"}]},
  {id:"demo-metroid",title:"Metroid: Zero Mission",normalizedTitle:"metroid zero mission",platform:"GBA",files:[{relativePath:"gba/Metroid - Zero Mission (USA).gba"}]},
  {id:"demo-mario",title:"Super Mario World",normalizedTitle:"super mario world",platform:"SNES",files:[{relativePath:"snes/Super Mario World (USA).sfc"}]},
  {id:"demo-zelda",title:"The Legend of Zelda: A Link to the Past",normalizedTitle:"the legend of zelda a link to the past",platform:"SNES",files:[{relativePath:"snes/Zelda - A Link to the Past (USA).sfc"}]},
  {id:"demo-ape",title:"Ape Escape",normalizedTitle:"ape escape",platform:"PS1",files:[{relativePath:"psx/Ape Escape.chd"}]}
]};

/* ---------------- state ---------------- */
let library=read(STORAGE.library,[]),progress=read(STORAGE.progress,{}),dismissed=read(STORAGE.dismissed,[]);
let activeGameId=null,activeSeriesName=null,libraryVisibleCount=LIBRARY_PAGE_SIZE,libraryStatus='all';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
function read(key,fallback){try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}}
function write(key,value){try{localStorage.setItem(key,JSON.stringify(value))}catch{toast('Could not save — browser storage is full or blocked')}}
function norm(value=""){return value.toLowerCase().normalize("NFKD").replace(/([a-z])([0-9])/g,"$1 $2").replace(/([0-9])([a-z])/g,"$1 $2").replace(/[^a-z0-9]+/g," ").trim()}
function escapeHtml(s=''){return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
function initials(title){return title.replace(/^\d{3}\s+/,'').split(/[\s:-]+/).filter(w=>/^[\p{L}\p{N}]/u.test(w)).slice(0,3).map(x=>x[0]).join("").toUpperCase()}
function colorFor(game){let n=[...game.title].reduce((a,c)=>a+c.charCodeAt(0),0);return COLORS[n%COLORS.length]}
function displayPlatform(code){return PLATFORM_NAMES[code]||String(code).replaceAll('_',' ')}
const SHORT_NAMES={NES:"NES",SNES:"SNES",GB:"Game Boy",GBC:"GBC",GBA:"GBA",N64:"N64",NDS:"DS",'3DS':"3DS",MASTER_SYSTEM:"Master System",GENESIS:"Genesis",SEGA_CD:"Sega CD",SATURN:"Saturn",DREAMCAST:"Dreamcast",ARCADE_CPS1:"CPS-1",ARCADE_CPS2:"CPS-2",ARCADE_CPS3:"CPS-3",ARCADE_FBNEO:"FBNeo",ARCADE_MAME:"MAME",NEOGEO:"Neo Geo",NGP:"NGP",OPENBOR:"OpenBOR",MSX2:"MSX2",PCENGINE:"PC Engine",WONDERSWAN_COLOR:"WonderSwan",PS1:"PS1",PS2:"PS2",PS3:"PS3",PSP:"PSP",WII_GC:"Wii / GC"};
const shortPlatform=code=>SHORT_NAMES[code]||displayPlatform(code);
const FAMILY={nintendo:["NES","SNES","GB","GBC","GBA","N64","NDS","3DS","WII_GC"],sega:["MASTER_SYSTEM","GENESIS","SEGA_CD","SATURN","DREAMCAST"],sony:["PS1","PS2","PS3","PSP"],arcade:["ARCADE_CPS1","ARCADE_CPS2","ARCADE_CPS3","ARCADE_FBNEO","ARCADE_MAME","NEOGEO","NGP"]};
const FAMILY_COLORS={nintendo:"#ff5d6c",sega:"#4f9dff",sony:"#9d8cff",arcade:"#ffb547",other:"#51f0b1"};
function familyColor(code){const f=Object.keys(FAMILY).find(k=>FAMILY[k].includes(code));return FAMILY_COLORS[f||'other']}
const STATUS_LABEL={backlog:'Backlog',playing:'Playing','on-hold':'On hold',beaten:'Beaten'};
function stateFor(id){return{status:"backlog",percent:0,notes:"",...(progress[id]||{})}}
function saveState(id,state){progress[id]={...state,updatedAt:new Date().toISOString()};write(STORAGE.progress,progress);renderAll()}
const byId=id=>library.find(g=>g.id===id);
function toast(message){const el=$("#toast");el.textContent=message;el.classList.add("show");clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove("show"),2600)}
function fileOf(game){return game.files?.[0]?.relativePath||game.files?.[0]?.filename||''}

/* ---------------- cover art ---------------- */
const loadedArt=new Map();   // key -> {src, contain}
const artObserver='IntersectionObserver' in window?new IntersectionObserver(entries=>{for(const e of entries)if(e.isIntersecting){artObserver.unobserve(e.target);loadArt(e.target)}},{rootMargin:'900px 0px'}):null;
function artKey(el){return el.dataset.artGame?`g:${el.dataset.artGame}`:`r:${el.dataset.artSystem}|${el.dataset.artName}`}
function coverInner(title,platform,key){const known=key&&loadedArt.get(key);return`${known?`<img class="art" alt="" src="${escapeHtml(known.src)}">`:''}<div class="cover-fallback"><span class="fallback-system">${escapeHtml(shortPlatform(platform))}</span><b>${escapeHtml(initials(title))}</b><span class="fallback-title">${escapeHtml(title)}</span></div>`}
function knownAttrs(key){const known=loadedArt.get(key);return known?` has-art${known.contain?' fit-contain':''}" data-art-bound="1" style="--art:url(&quot;${escapeHtml(known.src)}&quot;);`:'" style="'}
function cover(game,cls=''){const key=`g:${game.id}`;return`<div class="cover ${cls}${knownAttrs(key)}--cover:${colorFor(game)};--family:${familyColor(game.platform)}" data-art-game="${escapeHtml(game.id)}">${coverInner(game.title,game.platform,key)}</div>`}
function hydrateArt(root=document){root.querySelectorAll('[data-art-game]:not([data-art-bound]),[data-art-name]:not([data-art-bound])').forEach(el=>{el.dataset.artBound='1';artObserver?artObserver.observe(el):loadArt(el)})}
async function loadArt(el){
  let ref=null;
  try{
    if(el.dataset.artGame){const g=byId(el.dataset.artGame);if(!g)return;ref=await CheckpointArt.resolve(g)}
    else ref=await CheckpointArt.refFor(el.dataset.artSystem,el.dataset.artName);
  }catch{ref=null}
  if(!ref){el.classList.add('no-art');return}
  showArt(el,CheckpointArt.urls(ref),artKey(el));
}
function showArt(el,urls,key){
  const img=new Image();img.alt='';img.className='art';img.decoding='async';let i=0;
  img.onerror=()=>{if(++i<urls.length)img.src=urls[i];else{img.remove();el.classList.add('no-art')}};
  img.onload=()=>{const ratio=img.naturalWidth/img.naturalHeight,box=(el.clientWidth/el.clientHeight)||.75,contain=Math.abs(ratio-box)/box>.16;
    el.style.setProperty('--art',`url("${img.src}")`);el.classList.toggle('fit-contain',contain);el.classList.add('has-art');if(key)loadedArt.set(key,{src:img.src,contain})};
  img.src=urls[0];el.prepend(img);
}

/* ---------------- routing ---------------- */
function route(name,{scroll=true}={}){if(!['dashboard','library','recommendations'].includes(name))name='dashboard';$$('.view').forEach(v=>v.classList.toggle('active',v.dataset.view===name));$$('.nav-button').forEach(b=>b.classList.toggle('active',b.dataset.route===name));if(location.hash!==`#${name}`)history.replaceState(null,'',`#${name}`);if(scroll)window.scrollTo({top:0,behavior:'smooth'});if(name==='library')renderLibrary();if(name==='recommendations'){renderRecommendations();warmSeriesArt()}}

/* ---------------- import / export ---------------- */
function validateInventory(data){if(!data||data.format!=="checkpoint-inventory"||!Number.isInteger(data.version)||!Array.isArray(data.games))throw new Error("This is not a supported Checkpoint inventory file.");if(data.version!==1)throw new Error(`Inventory version ${data.version} is not supported yet.`);return data}
function mergeInventory(data){validateInventory(data);const old=new Map(library.map(g=>[g.id,g]));let added=0;const now=new Date().toISOString();for(const raw of data.games){if(!raw.title||!raw.platform)continue;const fallback=`${raw.platform}:${norm(raw.normalizedTitle||raw.title)}`;let game={...raw,id:raw.id||fallback,normalizedTitle:raw.normalizedTitle||norm(raw.title),importedAt:now};if(old.has(game.id)){const prev=old.get(game.id);if(fileOf(prev)!==fileOf(game))CheckpointArt.forget(game.id);game={...prev,...game,importedAt:prev.importedAt||now}}else added++;old.set(game.id,game)}library=[...old.values()];libraryVisibleCount=LIBRARY_PAGE_SIZE;write(STORAGE.library,library);renderAll();toast(`${added} new game${added===1?'':'s'} added • ${library.length} total`);route('dashboard')}
async function importFile(file){try{mergeInventory(JSON.parse(await file.text()))}catch(error){toast(error.message)}}
function exportBackup(){const blob=new Blob([JSON.stringify({format:'checkpoint-backup',version:1,exportedAt:new Date().toISOString(),library,progress,dismissed,marks,art:CheckpointArt.exportOverrides()},null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='checkpoint-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);toast('Backup downloaded')}
async function restoreBackup(file){try{const data=JSON.parse(await file.text());if(data?.format!=='checkpoint-backup'||!Array.isArray(data.library))throw new Error('This is not a Checkpoint backup file.');if(!confirm(`Replace this browser's library with the backup (${data.library.length} games)?`))return;library=data.library;progress=data.progress||{};dismissed=data.dismissed||[];marks=data.marks||marks;write(MARKS_KEY,marks);CheckpointArt.importOverrides(data.art);write(STORAGE.library,library);write(STORAGE.progress,progress);write(STORAGE.dismissed,dismissed);loadedArt.clear();renderAll();toast('Backup restored');route('dashboard')}catch(error){toast(error.message)}}
function triggerImport(){$("#inventoryInput").click()}

/* ---------------- series logic ---------------- */
const MARKS_KEY='checkpoint.seriesmarks.v1';
let marks=read(MARKS_KEY,{}),seriesIndex={};
// Older versions stored dismissed suggestions as "Series:Entry"; carry them over as "skip".
if(dismissed.length){for(const k of dismissed){const i=k.indexOf(':');if(i>0)marks[`${k.slice(0,i)}::${k.slice(i+1)}`]??='skip'}dismissed=[];write(STORAGE.dismissed,dismissed);write(MARKS_KEY,marks)}
fetch('art-index/series-index.json').then(r=>r.ok?r.json():{}).then(d=>{seriesIndex=d||{};resetSeriesCache();renderAll()}).catch(()=>{});
const markKey=(series,entry)=>`${series.name}::${entry.title}`;
function setMark(seriesName,entryTitle,value){const k=`${seriesName}::${entryTitle}`;if(value)marks[k]=value;else delete marks[k];write(MARKS_KEY,marks);renderAll()}
const ARCADE_CODES=new Set(["ARCADE_CPS1","ARCADE_CPS2","ARCADE_CPS3","ARCADE_FBNEO","ARCADE_MAME","NEOGEO"]);
function keyVariants(text){const k=CheckpointArt.keyOf(text||'');if(!k)return[];const out=new Set([k,k.replace(/version/g,'')]);for(const v of[...out]){if(v.startsWith('legendofzelda'))out.add('zelda'+v.slice(13));else if(v.startsWith('zelda'))out.add('legendofzelda'+v.slice(5))}out.delete('');return[...out]}
let entryCache=new Map(),gameKeyIndex=null,statusCache=new Map();
function resetSeriesCache(){entryCache=new Map();gameKeyIndex=null;statusCache=new Map()}
function entryAllowed(entry,platform){return!(entry.skip?.includes(platform))&&!(entry.only&&!entry.only.includes(platform))}
function entryKeys(series,entry){const id=markKey(series,entry);if(!entryCache.has(id)){const generic=new Set(),byPlatform={};for(const alias of entry.aliases){const m=alias.match(/^([A-Z0-9_]+)\|(.*)$/);if(m)keyVariants(m[2]).forEach(k=>(byPlatform[m[1]]??=new Set).add(k));else keyVariants(alias).forEach(k=>generic.add(k))}for(const[p,[,name]]of Object.entries(seriesIndex[series.name]?.[entry.title]||{}))keyVariants(CheckpointArt.baseOf(name)).forEach(k=>(byPlatform[p]??=new Set).add(k));entryCache.set(id,{generic,byPlatform})}return entryCache.get(id)}
function gameKeys(g){const stem=(g.files?.[0]?.filename||fileOf(g).split('/').pop()||'').replace(/(?:\.nkit)?\.[^.]+$/i,'');const keys=new Set([...keyVariants(g.title),...keyVariants(g.normalizedTitle),...keyVariants(stem)]);const ref=CheckpointArt.cached(g.id);if(ref){keyVariants(CheckpointArt.baseOf(ref.name)).forEach(k=>keys.add(k));if(ARCADE_CODES.has(g.platform))keyVariants(ref.name.split(' - ')[0]).forEach(k=>keys.add(k))}return keys}
function buildGameKeyIndex(){gameKeyIndex=new Map();for(const g of library)for(const k of gameKeys(g)){if(!gameKeyIndex.has(k))gameKeyIndex.set(k,[]);gameKeyIndex.get(k).push(g)}}
const STATUS_RANK={playing:3,beaten:2,'on-hold':1,backlog:0};
function ownedGame(entry,series){if(!gameKeyIndex)buildGameKeyIndex();const{generic,byPlatform}=entryKeys(series,entry),found=new Set();for(const k of generic)for(const g of gameKeyIndex.get(k)||[])if(series.systems.includes(g.platform)&&entryAllowed(entry,g.platform))found.add(g);for(const[p,keys]of Object.entries(byPlatform))for(const k of keys)for(const g of gameKeyIndex.get(k)||[])if(g.platform===p&&series.systems.includes(p)&&entryAllowed(entry,p))found.add(g);return[...found].sort((a,b)=>STATUS_RANK[stateFor(b.id).status]-STATUS_RANK[stateFor(a.id).status])[0]||null}
function entryPlatforms(series,entry){return Object.keys(seriesIndex[series.name]?.[entry.title]||{})}
const libraryPlatforms=()=>new Set(library.map(g=>g.platform));
function entryArt(series,entry,prefer){const hits=seriesIndex[series.name]?.[entry.title]||{},mine=libraryPlatforms(),p=Object.keys(hits).sort((a,b)=>(b===prefer)-(a===prefer)||mine.has(b)-mine.has(a))[0];return p?{platform:p,system:hits[p][0],name:hits[p][1]}:{platform:series.systems[0]}}
function seriesStatus(series){
  if(statusCache.has(series.name))return statusCache.get(series.name);
  const entries=series.entries.map((entry,index)=>{const game=ownedGame(entry,series),mark=marks[markKey(series,entry)]||null;return{entry,index,game,mark,collected:Boolean(game)||mark==='have',skipped:!game&&mark==='skip',wanted:!game&&mark==='want'}});
  const collected=entries.filter(e=>e.collected),skipped=entries.filter(e=>e.skipped),total=entries.length-skipped.length,missing=entries.filter(e=>!e.collected&&!e.skipped);
  const status={entries,owned:entries.filter(e=>e.game).map(e=>e.game),collected:collected.length,skipped:skipped.length,total,missing,percent:total?Math.round(collected.length/total*100):100,started:collected.length>0,highest:Math.max(-1,...collected.map(e=>e.index))};
  statusCache.set(series.name,status);return status;
}
/* Every missing entry in a franchise you've started, ranked: next-in-line and gaps
   behind games you have first, series close to completion and games for systems you
   already play on get a boost. */
function seriesGaps(){
  const out=[],mine=libraryPlatforms();
  for(const series of SERIES){
    const st=seriesStatus(series);if(!st.started)continue;
    const anchor=series.entries[st.highest],firstAfter=st.missing.find(e=>e.index>st.highest);
    for(const e of st.missing){if(e.wanted)continue;
      const kind=e.index<st.highest?'earlier':e===firstAfter?'next':'later',platforms=entryPlatforms(series,e.entry),playable=platforms.filter(p=>mine.has(p));
      const score={next:40,earlier:30,later:10}[kind]+(st.collected/st.total)*40+(playable.length?15:0)-e.index*.1;
      const reason=kind==='earlier'?`Comes before ${anchor.title}, which you have`:kind==='next'?`Next after ${anchor.title}`:`Later in the series`;
      out.push({key:markKey(series,e.entry),series,entry:e.entry,title:e.entry.title,kind,reason,platforms,playable,score,left:st.missing.length});
    }
  }
  return out.sort((a,b)=>b.score-a.score);
}
function huntList(){const out=[];for(const series of SERIES)for(const e of seriesStatus(series).entries)if(e.wanted)out.push({series,entry:e.entry,platforms:entryPlatforms(series,e.entry)});return out}
const recommendations=seriesGaps;
let warming=false;
function warmSeriesArt(){if(warming||!library.length)return;warming=true;CheckpointArt.warm(library,()=>{resetSeriesCache();renderRecommendations();renderDashboard()}).finally(()=>{warming=false})}

/* ---------------- dashboard ---------------- */
const HERO_ART=[["Nintendo - Super Nintendo Entertainment System","Chrono Trigger (USA)"],["Sony - PlayStation","Final Fantasy VII (USA) (Disc 1)"],["Nintendo - Nintendo 64","Legend of Zelda, The - Ocarina of Time (USA)"],["Sega - Mega Drive - Genesis","Sonic The Hedgehog 2 (World)"],["Nintendo - Game Boy Advance","Pokemon - Emerald Version (USA, Europe)"],["Sony - PlayStation","Castlevania - Symphony of the Night (USA)"],["Nintendo - Super Nintendo Entertainment System","Super Metroid (Japan, USA) (En,Ja)"],["Nintendo - Nintendo Entertainment System","Mega Man 2 (USA)"]];
function renderHero(){const shelf=$("#heroShelf");if(shelf.childElementCount)return;shelf.innerHTML=HERO_ART.map((_,i)=>`<div class="hero-box" style="left:${4+(i%4)*23}%;top:${6+Math.floor(i/4)*46+(i%2)*6}%;--tilt:${((i%3)-1)*3}deg;animation-delay:${-i*.9}s"></div>`).join('');$$('.hero-box').forEach((el,i)=>{const [system,name]=HERO_ART[i];showArt(el,CheckpointArt.urls({system,name,type:'Named_Boxarts'}))})}
function spotlightGame(){const recent=g=>progress[g.id]?.updatedAt||'';const by=s=>library.filter(g=>stateFor(g.id).status===s).sort((a,b)=>recent(b).localeCompare(recent(a)));const playing=by('playing');if(playing.length)return{game:playing[0],kind:'playing'};const held=by('on-hold');if(held.length)return{game:held[0],kind:'on-hold'};const backlog=by('backlog');if(!backlog.length)return{game:library[0],kind:'done'};const day=Math.floor(Date.now()/864e5);return{game:backlog[day%backlog.length],kind:'pick'}}
function guideUrls(game){const q=`${game.title} ${displayPlatform(game.platform)}`;return{web:`https://www.google.com/search?q=${encodeURIComponent(q+' walkthrough guide')}`,faqs:`https://gamefaqs.gamespot.com/search?game=${encodeURIComponent(game.title)}`,video:`https://www.youtube.com/results?search_query=${encodeURIComponent(q+' walkthrough')}`}}
function renderDashboard(){
  const has=library.length>0;$("#dashboardContent").classList.toggle('hidden',!has);$('.hero').classList.toggle('hidden',has);
  if(!has){renderHero();return}
  const {game,kind}=spotlightGame(),s=stateFor(game.id),eyebrow={playing:'CONTINUE PLAYING','on-hold':'WAITING FOR YOU',pick:"TODAY'S PICK FROM YOUR BACKLOG",done:'YOUR COLLECTION'}[kind];
  $("#spotlight").innerHTML=`<div class="spotlight-backdrop" data-backdrop="${escapeHtml(game.id)}"></div><div class="spotlight-inner">${cover(game,'spotlight-cover')}<div class="spotlight-copy"><p class="eyebrow">${eyebrow}</p><h2>${escapeHtml(game.title)}</h2><p class="muted"><span class="sys-dot" style="--family:${familyColor(game.platform)}"></span>${escapeHtml(displayPlatform(game.platform))} · ${STATUS_LABEL[s.status]}</p>${s.notes?`<blockquote class="spotlight-notes">${escapeHtml(s.notes.length>220?s.notes.slice(0,220)+'…':s.notes)}</blockquote>`:kind==='pick'?'<p class="spotlight-hint">Nothing in progress — how about starting this one?</p>':''}<div class="spotlight-progress"><div class="progress-track"><i style="width:${s.percent}%"></i></div><strong>${s.percent}%</strong></div><div class="spotlight-actions"><button class="button primary" data-game="${escapeHtml(game.id)}">${kind==='pick'?'Start playing':'Update progress'}</button><a class="button ghost" href="${guideUrls(game).web}" target="_blank" rel="noopener">Find a guide ↗</a></div></div></div>`;
  const total=library.length,count=st=>library.filter(g=>stateFor(g.id).status===st).length,playing=count('playing'),beaten=count('beaten'),systems=new Set(library.map(g=>g.platform)).size;
  $("#stats").innerHTML=[[total.toLocaleString(),'Games owned','across '+systems+' systems'],[playing,'Playing now',playing?'keep going':'pick one up'],[beaten,'Games beaten',total?`${(beaten/total*100).toFixed(beaten/total<.1?1:0)}% of library`:''],[recommendations().length,'Series gaps','games to collect']].map(([n,l,e])=>`<div class="stat"><span>${l}</span><strong>${n}</strong><em>${e}</em></div>`).join('');
  const queue=library.filter(g=>g.id!==game.id&&['playing','on-hold'].includes(stateFor(g.id).status));
  $("#upNextSection").classList.toggle('hidden',!queue.length);$("#upNext").innerHTML=queue.slice(0,14).map(shelfGame).join('');
  const counts=new Map();library.forEach(g=>counts.set(g.platform,(counts.get(g.platform)||0)+1));
  $("#systemCount").textContent=`${counts.size} detected`;
  $("#platformChips").innerHTML=[...counts].sort((a,b)=>b[1]-a[1]).map(([p,n])=>`<button class="platform-chip" data-platform-link="${escapeHtml(p)}" style="--family:${familyColor(p)}"><span class="sys-dot"></span>${escapeHtml(shortPlatform(p))}<b>${n.toLocaleString()}</b></button>`).join('');
  const recs=recommendations().slice(0,3);
  $("#recommendationPreview").innerHTML=recs.length?recs.map(r=>`<div class="rec-mini">${entryCover(r.series,r.entry,'mini')}<div><p class="eyebrow">${escapeHtml(r.series.name)}</p><strong>${escapeHtml(r.title)}</strong><p class="muted small">${escapeHtml(r.reason)}</p></div></div>`).join(''):`<div class="rec-preview"><strong>Your known series are caught up.</strong><p class="muted">Add more games or import another scan to uncover new paths.</p></div>`;
  const recent=[...library].map((g,i)=>[g,i]).sort((a,b)=>(b[0].importedAt||'').localeCompare(a[0].importedAt||'')||b[1]-a[1]).slice(0,16).map(x=>x[0]);
  $("#recentGames").innerHTML=recent.map(shelfGame).join('');
  hydrateArt($("#dashboardView"));
  const bd=$('[data-backdrop]');const k=`g:${game.id}`;const applyBackdrop=()=>{const a=loadedArt.get(k);if(a)bd.style.backgroundImage=`url("${a.src}")`};applyBackdrop();if(!loadedArt.has(k))CheckpointArt.resolve(game).then(ref=>{if(ref)bd.style.backgroundImage=`url("${CheckpointArt.urls(ref)[0]}")`});
}
function shelfGame(g){const s=stateFor(g.id);return`<div class="shelf-game" data-game="${escapeHtml(g.id)}" tabindex="0" role="button" aria-label="${escapeHtml(g.title)}">${cover(g)}${s.percent?`<div class="cover-progress"><i style="width:${s.percent}%"></i></div>`:''}<b>${escapeHtml(g.title)}</b><small>${escapeHtml(shortPlatform(g.platform))}</small></div>`}

/* ---------------- library ---------------- */
const searchText=new WeakMap();
function haystack(g){if(!searchText.has(g))searchText.set(g,norm(`${g.title} ${fileOf(g).split('/').pop()}`));return searchText.get(g)}
function renderStatusTabs(base){const counts={all:base.length};base.forEach(g=>{const s=stateFor(g.id).status;counts[s]=(counts[s]||0)+1});$("#statusTabs").innerHTML=[['all','All'],['playing','Playing'],['backlog','Backlog'],['on-hold','On hold'],['beaten','Beaten']].map(([v,l])=>`<button role="tab" class="status-tab ${v}${libraryStatus===v?' active':''}" aria-selected="${libraryStatus===v}" data-status="${v}">${l}<b>${(counts[v]||0).toLocaleString()}</b></button>`).join('')}
function renderLibrary(){
  const q=norm($("#searchInput").value),platform=$("#platformFilter").value,sort=$("#sortSelect").value;
  const base=library.filter(g=>(!q||haystack(g).includes(q))&&(platform==='all'||g.platform===platform));
  renderStatusTabs(base);
  const filtered=base.filter(g=>libraryStatus==='all'||stateFor(g.id).status===libraryStatus);
  const order=new Map(library.map((g,i)=>[g.id,i]));
  const sorters={title:(a,b)=>a.title.localeCompare(b.title),recent:(a,b)=>(b.importedAt||'').localeCompare(a.importedAt||'')||order.get(b.id)-order.get(a.id),progress:(a,b)=>stateFor(b.id).percent-stateFor(a.id).percent||a.title.localeCompare(b.title),platform:(a,b)=>shortPlatform(a.platform).localeCompare(shortPlatform(b.platform))||a.title.localeCompare(b.title)};
  filtered.sort(sorters[sort]||sorters.title);
  const visible=filtered.slice(0,libraryVisibleCount);
  $("#librarySubtitle").textContent=library.length?`${library.length.toLocaleString()} games across ${new Set(library.map(g=>g.platform)).size} systems${filtered.length!==library.length?` · ${filtered.length.toLocaleString()} shown`:''}`:'Import your scanner inventory to begin.';
  $("#libraryGrid").innerHTML=visible.map(g=>{const s=stateFor(g.id);return`<article class="game-card" data-game="${escapeHtml(g.id)}" tabindex="0" role="button" aria-label="${escapeHtml(g.title)}">${cover(g)}${s.status!=='backlog'?`<span class="status-badge ${s.status}">${STATUS_LABEL[s.status]}</span>`:''}${s.percent?`<div class="cover-progress"><i style="width:${s.percent}%"></i></div>`:''}<div class="game-info"><h3 title="${escapeHtml(g.title)}">${escapeHtml(g.title)}</h3><p><span class="sys-dot" style="--family:${familyColor(g.platform)}"></span>${escapeHtml(shortPlatform(g.platform))}</p></div></article>`}).join('');
  $("#libraryGrid").classList.toggle('hidden',!library.length);
  if(library.length&&!filtered.length)$("#libraryGrid").innerHTML=`<p class="no-results">No games match these filters.</p>`;
  const more=$("#loadMoreButton");more.classList.toggle('hidden',visible.length>=filtered.length);more.textContent=`Show more games (${visible.length.toLocaleString()} of ${filtered.length.toLocaleString()})`;
  $("#libraryEmpty").classList.toggle('hidden',library.length>0);$("#statusTabs").classList.toggle('hidden',!library.length);
  hydrateArt($("#libraryGrid"));
}
function renderPlatforms(){const current=$("#platformFilter").value;const systems=[...new Set(library.map(g=>g.platform))].sort((a,b)=>displayPlatform(a).localeCompare(displayPlatform(b)));$("#platformFilter").innerHTML='<option value="all">All platforms</option>'+systems.map(p=>`<option value="${escapeHtml(p)}">${escapeHtml(displayPlatform(p))}</option>`).join('');$("#platformFilter").value=systems.includes(current)?current:'all'}

/* ---------------- series quest ---------------- */
function entryCover(series,entry,cls,prefer){const a=entryArt(series,entry,prefer),key=a.name?`r:${a.system}|${a.name}`:null;return`<div class="cover ${cls}${key?knownAttrs(key):'" style="'}--cover:${COLORS[entry.title.length%COLORS.length]};--family:${familyColor(a.platform)}"${a.name?` data-art-system="${escapeHtml(a.system)}" data-art-name="${escapeHtml(a.name)}"`:''}>${coverInner(entry.title,a.platform,key)}</div>`}
function platformChips(platforms){const mine=libraryPlatforms();return platforms.length?`<span class="plat-chips">${platforms.map(p=>`<span class="plat-chip${mine.has(p)?' mine':''}" title="${mine.has(p)?'You already have games for this system':displayPlatform(p)}">${escapeHtml(shortPlatform(p))}</span>`).join('')}</span>`:''}
const enc=encodeURIComponent;
function markButtons(series,entry,mark){const s=enc(series.name),t=enc(entry.title);if(mark==='have'||mark==='skip')return`<button class="mini-button" data-mark="" data-series="${s}" data-entry="${t}">Undo</button>`;return`<button class="mini-button${mark==='want'?' on':''}" data-mark="${mark==='want'?'':'want'}" data-series="${s}" data-entry="${t}" title="Add to your hunt list">${mark==='want'?'✓ Hunting':'＋ Hunt'}</button><button class="mini-button" data-mark="have" data-series="${s}" data-entry="${t}" title="You own or finished it outside this library">Have it</button><button class="mini-button subtle" data-mark="skip" data-series="${s}" data-entry="${t}" title="Not interested — exclude from this goal">Skip</button>`}
function priceUrl(title,platforms){return`https://www.pricecharting.com/search-products?type=prices&q=${enc(title+(platforms[0]?' '+shortPlatform(platforms[0]):''))}`}
function renderQuestStats(){const started=SERIES.filter(s=>seriesStatus(s).started),collected=started.reduce((a,s)=>a+seriesStatus(s).collected,0),total=started.reduce((a,s)=>a+seriesStatus(s).total,0),complete=started.filter(s=>!seriesStatus(s).missing.length).length;$("#questStats").innerHTML=[[`${started.length}<small>/${SERIES.length}</small>`,'Franchises started',`${complete} complete`],[`${collected}<small>/${total}</small>`,'Games collected','in started franchises'],[seriesGaps().length,'Gaps to fill','ranked below'],[huntList().length,'On your hunt list','games to track down']].map(([n,l,e])=>`<div class="stat"><span>${l}</span><strong>${n}</strong><em>${e}</em></div>`).join('')}
function renderGoalDetail(){
  const series=SERIES.find(s=>s.name===activeSeriesName),detail=$("#goalDetail");detail.classList.toggle('hidden',!series);if(!series)return;
  const st=seriesStatus(series);
  $("#goalSystem").textContent=series.systems.map(displayPlatform).join(' • ');$("#goalTitle").textContent=series.name;
  $("#goalSummary").textContent=!st.missing.length?'You have every game in this goal. Nicely done!':`${st.missing.length} game${st.missing.length===1?'':'s'} still to collect${st.skipped?` · ${st.skipped} skipped`:''}. Add the ones you want to your hunt list.`;
  $("#goalScore").innerHTML=`<strong>${st.collected}/${st.total}</strong><span>collected</span>`;$("#goalProgressBar").style.width=`${st.percent}%`;
  $("#goalChecklist").innerHTML=st.entries.map(({entry,index,game,mark,collected,skipped})=>{const state=game?stateFor(game.id):null,platforms=entryPlatforms(series,entry);const meta=game?`${escapeHtml(displayPlatform(game.platform))} · ${STATUS_LABEL[state.status]}${state.percent?` · ${state.percent}%`:''}`:mark==='have'?'Marked as owned outside this library':skipped?'Skipped — not counted toward this goal':`${platforms.length?'Released on '+platformChips(platforms):'Not detected in your library'}`;return`<article class="goal-row ${game||mark==='have'?'owned':skipped?'skipped':'missing'}${mark==='want'?' wanted':''}">${game?cover(game,'mini'):entryCover(series,entry,'mini')}<div class="goal-text"><strong>${index+1}. ${escapeHtml(entry.title)}</strong><p>${meta}</p></div><div class="goal-actions">${game?`<button class="mini-button" data-game="${escapeHtml(game.id)}">Open</button>`:markButtons(series,entry,mark)}</div><span class="goal-check" aria-hidden="true">${game?(state.status==='beaten'?'★':'✓'):collected?'✓':skipped?'–':'○'}</span></article>`}).join('');
  hydrateArt(detail);
}
/* One toolbar drives three views: gaps to fill, franchise goals and the hunt list.
   The system chips, search and sort apply to whichever view is open. */
const QUEST_KEY='checkpoint.questui.v1';
let quest={tab:'gaps',system:'all',status:'all',sort:{},...read(QUEST_KEY,{}),limit:40};
const saveQuest=()=>write(QUEST_KEY,{tab:quest.tab,system:quest.system,status:quest.status,sort:quest.sort});
const QUEST_TABS=[['gaps','Gaps to fill'],['franchises','Franchises'],['hunt','Hunt list']];
const QUEST_SORTS={gaps:[['best','Best next pick'],['franchise','Group by franchise'],['system','Group by system'],['closest','Closest to finishing'],['title','Title A–Z']],franchises:[['closest','Closest to complete'],['missing','Most missing'],['owned','Most collected'],['name','Name A–Z']],hunt:[['franchise','Group by franchise'],['system','Group by system'],['title','Title A–Z']]};
const QUEST_HINTS={gaps:'Missing games from franchises you’ve started. The next game in line ranks first, then earlier entries you skipped.',franchises:'Every franchise Checkpoint tracks. Open one to see its full checklist.',hunt:'Games you’ve decided to collect. Rescan after adding them to your card and they’ll be checked off automatically.'};
const SERIES_FILTERS=[['all','All'],['started','In progress'],['almost','Almost done'],['complete','Complete'],['new','Not started']];
const STATUS_TESTS={all:()=>true,started:st=>st.started&&st.missing.length>0,almost:st=>st.started&&st.missing.length>0&&st.missing.length<=2,complete:st=>st.started&&!st.missing.length,new:st=>!st.started};
const sortKey=()=>{const opts=QUEST_SORTS[quest.tab];return opts.some(o=>o[0]===quest.sort[quest.tab])?quest.sort[quest.tab]:opts[0][0]};
function questItems(tab){
  if(tab==='gaps')return seriesGaps().map(r=>({...r,systems:r.platforms,text:`${r.title} ${r.series.name}`}));
  if(tab==='hunt')return huntList().map(h=>({...h,title:h.entry.title,systems:h.platforms,text:`${h.entry.title} ${h.series.name}`}));
  return SERIES.map(series=>({series,st:seriesStatus(series),systems:series.systems,text:`${series.name} ${series.entries.map(e=>e.title).join(' ')}`})).filter(i=>STATUS_TESTS[quest.status]?.(i.st)??true);
}
const searchQuery=()=>norm($("#questSearch").value);
const bySearch=(items,q)=>q?items.filter(i=>norm(i.text).includes(q)):items;
const bySystem=(items,sys)=>sys==='all'?items:items.filter(i=>i.systems.includes(sys));
function homeSystem(item){if(quest.system!=='all')return quest.system;const mine=libraryPlatforms();return item.systems.find(p=>mine.has(p))||item.systems[0]||'other'}
function renderQuestBar(){
  const q=searchQuery();
  $("#questTabs").innerHTML=QUEST_TABS.map(([v,l])=>`<button role="tab" class="quest-tab${quest.tab===v?' active':''}" aria-selected="${quest.tab===v}" data-quest-tab="${v}">${l}<b>${bySystem(bySearch(questItems(v),q),quest.system).length}</b></button>`).join('');
  const base=bySearch(questItems(quest.tab),q),mine=libraryPlatforms(),counts=new Map();
  base.forEach(i=>i.systems.forEach(p=>counts.set(p,(counts.get(p)||0)+1)));
  const systems=[...new Set([...mine].filter(p=>SERIES.some(s=>s.systems.includes(p))))];
  if(quest.system!=='all'&&!systems.includes(quest.system))systems.push(quest.system);
  systems.sort((a,b)=>(counts.get(b)||0)-(counts.get(a)||0)||shortPlatform(a).localeCompare(shortPlatform(b)));
  $("#questSystems").innerHTML=`<button class="sys-chip${quest.system==='all'?' active':''}" data-quest-system="all">All systems<b>${base.length}</b></button>`+systems.map(p=>`<button class="sys-chip${quest.system===p?' active':''}${counts.get(p)?'':' empty'}" data-quest-system="${p}" style="--family:${familyColor(p)}"><span class="sys-dot"></span>${escapeHtml(shortPlatform(p))}<b>${counts.get(p)||0}</b></button>`).join('')+`<select id="questSystemMore" class="sys-more" aria-label="Other systems"><option value="">More systems…</option>${[...new Set(SERIES.flatMap(s=>s.systems))].filter(p=>!systems.includes(p)).sort((a,b)=>displayPlatform(a).localeCompare(displayPlatform(b))).map(p=>`<option value="${p}">${escapeHtml(displayPlatform(p))}</option>`).join('')}</select>`;
  $("#questSort").innerHTML=QUEST_SORTS[quest.tab].map(([v,l])=>`<option value="${v}">${l}</option>`).join('');$("#questSort").value=sortKey();
  $("#seriesFilters").classList.toggle('hidden',quest.tab!=='franchises');
  if(quest.tab==='franchises'){const fr=bySystem(bySearch(SERIES.map(series=>({series,st:seriesStatus(series),systems:series.systems,text:`${series.name} ${series.entries.map(e=>e.title).join(' ')}`})),q),quest.system);$("#seriesFilters").innerHTML=SERIES_FILTERS.map(([v,l])=>`<button class="status-tab${quest.status===v?' active':''}" data-series-filter="${v}">${l}<b>${fr.filter(r=>STATUS_TESTS[v](r.st)).length}</b></button>`).join('')}
  $("#copyHuntButton").classList.toggle('hidden',quest.tab!=='hunt'||!huntList().length);
  $("#questHint").textContent=QUEST_HINTS[quest.tab];
}
function gapRow(r){return`<article class="quest-row">${entryCover(r.series,r.entry,'mini',quest.system)}<div class="qr-main"><strong>${escapeHtml(r.title)}</strong><p><button class="qr-series" data-open-series="${enc(r.series.name)}">${escapeHtml(r.series.name)}</button><span class="kind ${r.kind}">${{earlier:'Fills a gap',next:'Next in line',later:'Later entry'}[r.kind]}</span><span class="qr-reason">${escapeHtml(r.reason)} · ${r.left} left</span></p>${platformChips(r.platforms)}</div><div class="qr-actions">${markButtons(r.series,r.entry,null)}</div></article>`}
function huntRow(h){return`<article class="quest-row hunt">${entryCover(h.series,h.entry,'mini',quest.system)}<div class="qr-main"><strong>${escapeHtml(h.entry.title)}</strong><p><button class="qr-series" data-open-series="${enc(h.series.name)}">${escapeHtml(h.series.name)}</button></p>${platformChips(h.platforms)}</div><div class="qr-actions"><a class="mini-button" href="${priceUrl(h.entry.title,quest.system!=='all'?[quest.system]:h.platforms)}" target="_blank" rel="noopener">Price check ↗</a><button class="mini-button" data-mark="have" data-series="${enc(h.series.name)}" data-entry="${enc(h.entry.title)}">Got it</button><button class="mini-button subtle" data-mark="" data-series="${enc(h.series.name)}" data-entry="${enc(h.entry.title)}">Remove</button></div></article>`}
function franchiseCard({series,st}){const next=st.missing.find(e=>e.index>st.highest)||st.missing[0],stack=st.entries.filter(e=>e.game).slice(0,4);return`<article class="series-card${st.started?' started':''}${st.started&&!st.missing.length?' complete':''}" data-open-series="${enc(series.name)}" tabindex="0" role="button"><div class="series-stack">${stack.length?stack.map(e=>cover(e.game,'stack')).join(''):series.entries.slice(0,3).map(e=>entryCover(series,e,'stack ghost',quest.system)).join('')}</div><h3>${escapeHtml(series.name)}</h3><p class="series-systems">${series.systems.map(shortPlatform).join(' · ')}</p><div class="progress-track"><i style="width:${st.percent}%"></i></div><div class="series-count"><span>${st.collected} of ${st.total} collected</span><strong>${st.missing.length?`${st.missing.length} missing`:'Complete ★'}</strong></div>${next&&st.started?`<p class="series-next">Next up: <b>${escapeHtml(next.entry.title)}</b></p>`:''}</article>`}
function grouped(items,keyFn,labelFn,rowFn){const groups=new Map();items.forEach(i=>{const k=keyFn(i);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(i)});return[...groups].map(([k,list])=>`<div class="quest-group"><h3 class="quest-group-head">${labelFn(k,list)}<b>${list.length}</b></h3>${list.map(rowFn).join('')}</div>`).join('')}
function renderQuestPanel(){
  const items=bySystem(bySearch(questItems(quest.tab),searchQuery()),quest.system),sort=sortKey(),panel=$("#questPanel");
  let html='',shown=items.length;
  if(quest.tab==='franchises'){
    const cmp={closest:(a,b)=>(b.st.started-a.st.started)||(a.st.missing.length===0)-(b.st.missing.length===0)||b.st.percent-a.st.percent||a.st.missing.length-b.st.missing.length,missing:(a,b)=>(b.st.started-a.st.started)||b.st.missing.length-a.st.missing.length,owned:(a,b)=>b.st.collected-a.st.collected,name:()=>0}[sort];
    items.sort((a,b)=>cmp(a,b)||a.series.name.localeCompare(b.series.name));
    html=items.length?`<div class="series-catalog">${items.map(franchiseCard).join('')}</div>`:'';
  }else{
    const rowFn=quest.tab==='gaps'?gapRow:huntRow,closeness=i=>{const st=seriesStatus(i.series);return st.collected/st.total};
    if(sort==='title')items.sort((a,b)=>a.title.localeCompare(b.title));
    if(sort==='closest')items.sort((a,b)=>closeness(b)-closeness(a)||b.score-a.score);
    if(sort==='franchise')items.sort((a,b)=>a.series.name.localeCompare(b.series.name)||a.entry&&b.entry&&a.series.entries.indexOf(a.entry)-b.series.entries.indexOf(b.entry));
    if(sort==='system')items.sort((a,b)=>displayPlatform(homeSystem(a)).localeCompare(displayPlatform(homeSystem(b)))||(b.score||0)-(a.score||0));
    const visible=quest.tab==='gaps'?items.slice(0,quest.limit):items;shown=visible.length;
    html=sort==='franchise'?grouped(visible,i=>i.series.name,(k,list)=>{const st=seriesStatus(list[0].series);return`<button class="qr-series" data-open-series="${enc(k)}">${escapeHtml(k)}</button><span class="muted small">${st.collected}/${st.total} collected</span>`},rowFn)
      :sort==='system'?grouped(visible,homeSystem,k=>`<span class="sys-dot" style="--family:${familyColor(k)}"></span>${escapeHtml(displayPlatform(k))}`,rowFn)
      :`<div class="quest-list">${visible.map(rowFn).join('')}</div>`;
  }
  const empty={gaps:library.length?'No gaps match. Try another system, or start a new franchise from the Franchises tab.':'Import your library to find gaps in the franchises you own.',franchises:'No franchises match these filters.',hunt:'Your hunt list is empty. Use ＋ Hunt on any missing game to add it here.'}[quest.tab];
  panel.innerHTML=html||`<div class="empty-state small-empty"><div class="empty-icon">✦</div><p>${empty}</p></div>`;
  const more=$("#questMore");more.classList.toggle('hidden',shown>=items.length);more.textContent=`Show more (${shown} of ${items.length})`;
  hydrateArt(panel);
}
function renderRecommendations(){
  const detailOpen=Boolean(SERIES.find(s=>s.name===activeSeriesName));
  renderQuestStats();renderGoalDetail();
  $("#questBrowse").classList.toggle('hidden',detailOpen);
  if(!detailOpen){renderQuestBar();renderQuestPanel()}
}
const renderSeriesCatalog=renderRecommendations;
function copyHuntList(){const text=huntList().map(h=>`☐ ${h.entry.title} — ${h.series.name}${h.platforms.length?` (${h.platforms.map(shortPlatform).join(', ')})`:''}`).join('\n');(navigator.clipboard?.writeText(text)||Promise.reject()).then(()=>toast('Hunt list copied')).catch(()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type:'text/plain'}));a.download='checkpoint-hunt-list.txt';a.click();toast('Hunt list downloaded')})}
function renderAll(){resetSeriesCache();renderPlatforms();renderDashboard();renderLibrary();renderRecommendations()}

/* ---------------- game dialog ---------------- */
function openGame(id){
  const game=byId(id);if(!game)return;activeGameId=id;const s=stateFor(id);
  $("#dialogPlatform").textContent=displayPlatform(game.platform);$("#dialogTitle").textContent=game.title;$("#dialogPath").textContent=fileOf(game)||'Imported game';
  $$('input[name="dialogStatus"]').forEach(r=>r.checked=r.value===s.status);
  $("#dialogProgress").value=s.percent;$("#progressOutput").value=`${s.percent}%`;$("#dialogNotes").value=s.notes;
  const g=guideUrls(game);$("#guideLink").href=g.web;$("#gamefaqsLink").href=g.faqs;$("#youtubeLink").href=g.video;
  $("#artPicker").classList.add('hidden');$("#artSearch").value='';
  $("#changeArtButton").classList.toggle('hidden',!CheckpointArt.supports(game.platform));
  renderDialogCover(game);$("#gameDialog").showModal();
}
function renderDialogCover(game){
  $("#dialogCover").innerHTML=cover(game,'dialog-cover');const bd=$("#dialogBackdrop");bd.style.backgroundImage='';
  hydrateArt($("#dialogCover"));
  CheckpointArt.resolve(game).then(ref=>{if(ref&&activeGameId===game.id)bd.style.backgroundImage=`url("${CheckpointArt.urls(ref)[0]}")`});
}
async function renderArtOptions(){
  const game=byId(activeGameId);if(!game)return;const box=$("#artOptions");box.innerHTML='<p class="muted small">Searching…</p>';
  const query=$("#artSearch").value.trim();const results=await CheckpointArt.search(game,query,18);
  if(game.id!==activeGameId)return;
  box.innerHTML=results.length?results.map((ref,i)=>`<button type="button" class="art-option" data-ref="${i}" title="${escapeHtml(ref.name)}"><span class="art-thumb"></span><small>${escapeHtml(ref.name)}</small></button>`).join(''):'<p class="muted small">No matching art found. Try a shorter search, like the main title only.</p>';
  box.querySelectorAll('.art-option').forEach(btn=>{const ref=results[Number(btn.dataset.ref)];showArt(btn.querySelector('.art-thumb'),CheckpointArt.urls(ref));btn.onclick=()=>{CheckpointArt.setOverride(game.id,ref);afterArtChange(game,'Cover updated')}});
}
function afterArtChange(game,message){loadedArt.delete(`g:${game.id}`);renderDialogCover(game);$("#artPicker").classList.add('hidden');renderAll();toast(message)}

/* ---------------- events ---------------- */
document.addEventListener('click',e=>{
  const routeBtn=e.target.closest('[data-route]');if(routeBtn){if(routeBtn.dataset.statusLink){libraryStatus=routeBtn.dataset.statusLink;libraryVisibleCount=LIBRARY_PAGE_SIZE}route(routeBtn.dataset.route);return}
  const plat=e.target.closest('[data-platform-link]');if(plat){$("#platformFilter").value=plat.dataset.platformLink;libraryStatus='all';libraryVisibleCount=LIBRARY_PAGE_SIZE;route('library');return}
  const tab=e.target.closest('[data-status]');if(tab){libraryStatus=tab.dataset.status;libraryVisibleCount=LIBRARY_PAGE_SIZE;renderLibrary();return}
  const series=e.target.closest('[data-open-series]');if(series){activeSeriesName=decodeURIComponent(series.dataset.openSeries);renderSeriesCatalog();renderGoalDetail();$("#goalDetail").scrollIntoView({behavior:'smooth',block:'start'});return}
  const mark=e.target.closest('[data-mark]');if(mark){const v=mark.dataset.mark,t=decodeURIComponent(mark.dataset.entry);setMark(decodeURIComponent(mark.dataset.series),t,v);toast({want:`Added ${t} to your hunt list`,have:`Marked ${t} as collected`,skip:`Skipped ${t}`}[v]||'Updated');return}
  const sf=e.target.closest('[data-series-filter]');if(sf){quest.status=sf.dataset.seriesFilter;saveQuest();renderRecommendations();return}
  const qt=e.target.closest('[data-quest-tab]');if(qt){quest.tab=qt.dataset.questTab;quest.limit=40;saveQuest();renderRecommendations();return}
  const qs=e.target.closest('[data-quest-system]');if(qs){quest.system=qs.dataset.questSystem;quest.limit=40;saveQuest();renderRecommendations();return}
  const game=e.target.closest('[data-game]');if(game&&!e.target.closest('dialog'))openGame(game.dataset.game);
});
document.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches?.('[role="button"][data-game],[role="button"][data-open-series]')){e.preventDefault();e.target.click()}});
['#importButton','#heroImportButton','#libraryImportButton','#emptyImportButton'].forEach(id=>$(id).onclick=triggerImport);
$("#inventoryInput").onchange=e=>{if(e.target.files[0])importFile(e.target.files[0]);e.target.value=''};
$("#backupInput").onchange=e=>{if(e.target.files[0])restoreBackup(e.target.files[0]);e.target.value=''};
$("#restoreButton").onclick=()=>$("#backupInput").click();
$("#demoButton").onclick=()=>mergeInventory(DEMO);$("#backupButton").onclick=exportBackup;
function resetLibraryView(){libraryVisibleCount=LIBRARY_PAGE_SIZE;renderLibrary()}
let searchTimer;$("#searchInput").oninput=()=>{clearTimeout(searchTimer);searchTimer=setTimeout(resetLibraryView,120)};
$("#platformFilter").onchange=resetLibraryView;$("#sortSelect").onchange=resetLibraryView;
$("#loadMoreButton").onclick=()=>{libraryVisibleCount+=LIBRARY_PAGE_SIZE;renderLibrary()};
let questTimer;$("#questSearch").oninput=()=>{clearTimeout(questTimer);questTimer=setTimeout(()=>{quest.limit=40;renderRecommendations()},150)};
$("#questSort").onchange=e=>{quest.sort[quest.tab]=e.target.value;saveQuest();renderQuestPanel()};
$("#questMore").onclick=()=>{quest.limit+=40;renderQuestPanel()};$("#copyHuntButton").onclick=copyHuntList;
document.addEventListener('change',e=>{if(e.target.id==='questSystemMore'&&e.target.value){quest.system=e.target.value;quest.limit=40;saveQuest();renderRecommendations()}});
$("#closeGoalButton").onclick=()=>{activeSeriesName=null;renderRecommendations();$("#questBrowse").scrollIntoView({block:"start"})};
$("#dialogProgress").oninput=e=>$("#progressOutput").value=`${e.target.value}%`;
$$('input[name="dialogStatus"]').forEach(r=>r.onchange=()=>{if(r.value==='beaten'&&r.checked){$("#dialogProgress").value=100;$("#progressOutput").value='100%'}});
$("#saveGameButton").onclick=()=>{if(!activeGameId)return;const status=$('input[name="dialogStatus"]:checked')?.value||'backlog';saveState(activeGameId,{...stateFor(activeGameId),status,percent:Number($("#dialogProgress").value),notes:$("#dialogNotes").value.trim()});toast('Game progress saved')};
$("#changeArtButton").onclick=()=>{const p=$("#artPicker");p.classList.toggle('hidden');if(!p.classList.contains('hidden'))renderArtOptions()};
let artTimer;$("#artSearch").oninput=()=>{clearTimeout(artTimer);artTimer=setTimeout(renderArtOptions,250)};
$("#artSearch").onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();renderArtOptions()}};
$("#artAutoButton").onclick=()=>{const g=byId(activeGameId);if(!g)return;CheckpointArt.clearOverride(g.id);afterArtChange(g,'Using automatic cover')};
$("#artNoneButton").onclick=()=>{const g=byId(activeGameId);if(!g)return;CheckpointArt.hideArt(g.id);afterArtChange(g,'Cover art hidden for this game')};
$("#gameDialog").addEventListener('close',()=>{activeGameId=null});
renderAll();route(location.hash.slice(1)||'dashboard',{scroll:false});
