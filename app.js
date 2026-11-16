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
function saveState(id,state){const prev=stateFor(id),now=new Date().toISOString(),next={...state,updatedAt:now};
  if(next.status==='beaten'&&prev.status!=='beaten')next.beatenAt=now;
  if(next.status==='playing'&&!prev.startedAt)next.startedAt=now;
  progress[id]=next;write(STORAGE.progress,progress);renderAll();
  if(next.status==='beaten'&&prev.status!=='beaten')celebrate(id);}
/* "Started" means you've put time in: playing, on hold, or any progress logged. */
const isStarted=g=>{const s=stateFor(g.id);return s.status==='playing'||s.status==='on-hold'||(s.status==='backlog'&&s.percent>0)};
function unfinished(){const recent=g=>progress[g.id]?.updatedAt||'';return library.filter(isStarted).sort((a,b)=>stateFor(b.id).percent-stateFor(a.id).percent||recent(b).localeCompare(recent(a)))}
function finishStats(){const beaten=library.filter(g=>stateFor(g.id).status==='beaten'),year=String(new Date().getFullYear()),started=unfinished().length;return{beaten:beaten.length,thisYear:beaten.filter(g=>(progress[g.id]?.beatenAt||'').startsWith(year)).length,inProgress:started,rate:beaten.length+started?Math.round(beaten.length/(beaten.length+started)*100):0}}
const byId=id=>library.find(g=>g.id===id);
function toast(message){const el=$("#toast"),host=[...document.querySelectorAll('dialog[open]')].pop()||document.body;if(el.parentElement!==host)host.appendChild(el);el.textContent=message;el.classList.add("show");clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove("show"),2600)}
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
function route(name,{scroll=true}={}){if(!['dashboard','library','discover','recommendations'].includes(name))name='dashboard';$$('.view').forEach(v=>v.classList.toggle('active',v.dataset.view===name));$$('.nav-button').forEach(b=>b.classList.toggle('active',b.dataset.route===name));if(location.hash!==`#${name}`)history.replaceState(null,'',`#${name}`);if(scroll)window.scrollTo({top:0,behavior:'smooth'});if(name==='library')renderLibrary();if(name==='recommendations'){renderRecommendations();warmSeriesArt()}if(name==='discover'){renderDiscover();warmSeriesArt()}}

/* ---------------- import / export ---------------- */
function validateInventory(data){if(!data||data.format!=="checkpoint-inventory"||!Number.isInteger(data.version)||!Array.isArray(data.games))throw new Error("This is not a supported Checkpoint inventory file.");if(data.version!==1)throw new Error(`Inventory version ${data.version} is not supported yet.`);return data}
function mergeInventory(data){validateInventory(data);const old=new Map(library.map(g=>[g.id,g]));let added=0;const now=new Date().toISOString();for(const raw of data.games){if(!raw.title||!raw.platform)continue;const fallback=`${raw.platform}:${norm(raw.normalizedTitle||raw.title)}`;let game={...raw,id:raw.id||fallback,normalizedTitle:raw.normalizedTitle||norm(raw.title),importedAt:now};if(old.has(game.id)){const prev=old.get(game.id);if(fileOf(prev)!==fileOf(game))CheckpointArt.forget(game.id);game={...prev,...game,importedAt:prev.importedAt||now}}else added++;old.set(game.id,game)}library=[...old.values()];libraryVisibleCount=LIBRARY_PAGE_SIZE;write(STORAGE.library,library);renderAll();toast(`${added} new game${added===1?'':'s'} added • ${library.length} total`);route('dashboard')}
async function importFile(file){try{mergeInventory(JSON.parse(await file.text()))}catch(error){toast(error.message)}}
/* Backup v2 adds guide positions (guides), checkpoints and your guide links (play), and
   suggestion preferences (prefs). v3 adds Discover marks and collection goals (collection).
   Older backups still restore; parts they don't contain are left as they are. */
const BACKUP_VERSION=3;
function exportBackup(){const pd=CheckpointPlay.exportAll();const blob=new Blob([JSON.stringify({format:'checkpoint-backup',version:BACKUP_VERSION,exportedAt:new Date().toISOString(),library,progress,dismissed,marks,art:CheckpointArt.exportOverrides(),guides:CheckpointGuide.exportStore(),play:pd.play,prefs:pd.prefs,collection:exportCollection()},null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='checkpoint-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);toast('Backup downloaded')}
const isPlainObject=v=>Boolean(v)&&typeof v==='object'&&!Array.isArray(v);
async function restoreBackup(file){try{const data=JSON.parse(await file.text());if(data?.format!=='checkpoint-backup'||!Array.isArray(data.library))throw new Error('This is not a Checkpoint backup file.');if(Number(data.version)>BACKUP_VERSION)throw new Error(`This backup is from a newer version of Checkpoint (v${data.version}). Reload the page and try again.`);
  const games=data.library.filter(g=>isPlainObject(g)&&g.id&&g.title&&g.platform);
  if(!confirm(`Replace this browser's library with the backup (${games.length} games)?`))return;
  library=games;progress=isPlainObject(data.progress)?data.progress:{};dismissed=Array.isArray(data.dismissed)?data.dismissed:[];marks=isPlainObject(data.marks)?data.marks:marks;write(MARKS_KEY,marks);CheckpointArt.importOverrides(data.art);
  CheckpointGuide.importStore(isPlainObject(data.guides)?data.guides:undefined);CheckpointPlay.importAll({play:isPlainObject(data.play)?data.play:undefined,prefs:isPlainObject(data.prefs)?data.prefs:undefined});importCollection(isPlainObject(data.collection)?data.collection:undefined);recPrefsCache=null;
  write(STORAGE.library,library);write(STORAGE.progress,progress);write(STORAGE.dismissed,dismissed);loadedArt.clear();renderAll();toast(data.version>=3?'Backup restored':data.version>=2?'Backup restored (older backup: your Discover marks and goals were kept)':'Backup restored (older backup: existing checkpoints, marks and goals kept)');route('dashboard')}catch(error){toast(error instanceof SyntaxError?'That file isn\'t valid JSON.':error.message)}}
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
const keyVariants=text=>CheckpointArt.seriesKeys(text);
let entryCache=new Map(),gameKeyIndex=null,statusCache=new Map();
function resetSeriesCache(){entryCache=new Map();gameKeyIndex=null;statusCache=new Map();membershipIndex=null;resetDiscoverCache()}
function entryAllowed(entry,platform){return!(entry.skip?.includes(platform))&&!(entry.only&&!entry.only.includes(platform))}
function entryKeys(series,entry){const id=markKey(series,entry);if(!entryCache.has(id)){const generic=new Set(),byPlatform={};for(const alias of entry.aliases){const m=alias.match(/^([A-Z0-9_]+)\|(.*)$/);if(m)keyVariants(m[2]).forEach(k=>(byPlatform[m[1]]??=new Set).add(k));else keyVariants(alias).forEach(k=>generic.add(k))}for(const[p,[,name]]of Object.entries(seriesIndex[series.name]?.[entry.title]||{}))keyVariants(CheckpointArt.baseOf(name)).forEach(k=>(byPlatform[p]??=new Set).add(k));entryCache.set(id,{generic,byPlatform})}return entryCache.get(id)}
function gameKeys(g){const stem=(g.files?.[0]?.filename||fileOf(g).split('/').pop()||'').replace(/(?:\.nkit)?\.[^.]+$/i,'');const keys=new Set([...keyVariants(g.title),...keyVariants(g.normalizedTitle),...keyVariants(stem)]);const ref=CheckpointArt.cached(g.id);if(ref){keyVariants(CheckpointArt.baseOf(ref.name)).forEach(k=>keys.add(k));if(ARCADE_CODES.has(g.platform))keyVariants(ref.name.split(' - ')[0]).forEach(k=>keys.add(k))}
  // Arcade sets are often named "Main Title _ Japanese Title" or "Title - Subtitle (set 1)".
  if(ARCADE_CODES.has(g.platform))for(const part of [g.title.split(' _ ')[0],g.title.split(' - ')[0]])if(part&&part!==g.title)keyVariants(part).forEach(k=>keys.add(k));
  return keys}
function buildGameKeyIndex(){gameKeyIndex=new Map();for(const g of library)for(const k of gameKeys(g)){if(!gameKeyIndex.has(k))gameKeyIndex.set(k,[]);gameKeyIndex.get(k).push(g)}}
const STATUS_RANK={playing:3,beaten:2,'on-hold':1,backlog:0};
function entryGames(entry,series){if(!gameKeyIndex)buildGameKeyIndex();const{generic,byPlatform}=entryKeys(series,entry),found=new Set();for(const k of generic)for(const g of gameKeyIndex.get(k)||[])if(series.systems.includes(g.platform)&&entryAllowed(entry,g.platform))found.add(g);for(const[p,keys]of Object.entries(byPlatform))for(const k of keys)for(const g of gameKeyIndex.get(k)||[])if(g.platform===p&&series.systems.includes(p)&&entryAllowed(entry,p))found.add(g);return[...found].sort((a,b)=>STATUS_RANK[stateFor(b.id).status]-STATUS_RANK[stateFor(a.id).status])}
function ownedGame(entry,series){return entryGames(entry,series)[0]||null}
/* Which series each game belongs to, and where: gameId -> [{series, index}] */
let membershipIndex=null;
function seriesOf(gameId){
  if(!membershipIndex){membershipIndex=new Map();for(const series of SERIES)series.entries.forEach((entry,index)=>{for(const g of entryGames(entry,series)){if(!membershipIndex.has(g.id))membershipIndex.set(g.id,[]);membershipIndex.get(g.id).push({series,index})}});for(const list of membershipIndex.values())list.sort((a,b)=>a.series.entries.length-b.series.entries.length)}
  return membershipIndex.get(gameId)||[];
}
const seriesLabel=m=>`#${m.index+1} ${m.series.name.replace(/ — .*$/,'')}`;
function seriesBadge(g){const m=seriesOf(g.id)[0];return m?`<span class="series-badge" title="Game ${m.index+1} of ${m.series.entries.length} in ${escapeHtml(m.series.name)}">${escapeHtml(seriesLabel(m))}</span>`:''}
function entryPlatforms(series,entry){return Object.keys(seriesIndex[series.name]?.[entry.title]||{})}
const libraryPlatforms=()=>new Set(library.map(g=>g.platform));
function entryArt(series,entry,prefer){const hits=seriesIndex[series.name]?.[entry.title]||{},mine=libraryPlatforms(),p=Object.keys(hits).sort((a,b)=>(b===prefer)-(a===prefer)||mine.has(b)-mine.has(a))[0];return p?{platform:p,system:hits[p][0],name:hits[p][1]}:{platform:series.systems[0]}}
function seriesStatus(series){
  if(statusCache.has(series.name))return statusCache.get(series.name);
  const entries=series.entries.map((entry,index)=>{const game=ownedGame(entry,series),mark=marks[markKey(series,entry)]||null;return{entry,index,game,mark,collected:Boolean(game)||mark==='have',skipped:!game&&(mark==='skip'||mark==='no'),wanted:!game&&mark==='want'}});
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
function nowPlaying(){const recent=g=>progress[g.id]?.updatedAt||'';return library.filter(g=>stateFor(g.id).status==='playing').sort((a,b)=>recent(b).localeCompare(recent(a)))}
/* Games you already own that are worth starting: the next entry after one you've
   beaten or are playing, then the first game of series you own but haven't started. */
function playNextPicks(exclude){
  const out=new Map();
  for(const series of SERIES){
    const st=seriesStatus(series),owned=st.entries.filter(e=>e.game);if(!owned.length)continue;
    const fresh=owned.filter(e=>stateFor(e.game.id).status==='backlog'&&!exclude.has(e.game.id)&&!isNotForMe(e.game.id));if(!fresh.length)continue;
    const done=owned.filter(e=>['beaten','playing'].includes(stateFor(e.game.id).status));
    if(done.length){const last=done[done.length-1],next=fresh.find(e=>e.index>last.index);if(next){const beat=stateFor(last.game.id).status==='beaten';out.set(next.game.id,{game:next.game,series,score:beat?100:80,reason:`${beat?'You beat':"You're playing"} ${last.entry.title}. ${next.entry.title===next.game.title?'This':next.entry.title} is next in ${series.name}.`});continue}}
    if(!done.length&&owned.length>=2){const first=fresh[0];if(!out.has(first.game.id))out.set(first.game.id,{game:first.game,series,score:40+owned.length*3,reason:`You own ${owned.length} ${series.name} games. Start from the beginning.`})}
  }
  return[...out.values()].sort((a,b)=>b.score-a.score);
}
function trackSuggestions(){const held=unfinished();const picks=playNextPicks(new Set()).map(p=>p.game);const seen=new Set();const out=[];for(const g of [...held,...picks]){if(!seen.has(g.id)&&!isNotForMe(g.id)){seen.add(g.id);out.push(g)}if(out.length>=6)return out}for(const g of library){if(out.length>=6)break;if(!seen.has(g.id)&&!isNotForMe(g.id)&&stateFor(g.id).status==='backlog'){seen.add(g.id);out.push(g)}}return out}

/* ---------------- checkpoints (where am I / what next) ---------------- */
function ago(iso){if(!iso||Number.isNaN(Date.parse(iso)))return'';const d=Math.floor((Date.now()-Date.parse(iso))/864e5);if(d<=0)return'today';if(d===1)return'yesterday';if(d<45)return`${d} days ago`;return`on ${new Date(iso).toLocaleDateString(undefined,{month:'short',day:'numeric',...(d>300?{year:'numeric'}:{})})}`}
const lastTouched=id=>[progress[id]?.updatedAt||'',CheckpointPlay.get(id).updatedAt||''].sort().pop();
function guideInfo(id){const gi=CheckpointGuide.info(id);if(gi?.root)return{label:'Resume guide',sub:gi.chapter||gi.root,kind:'wiki'};if(gi?.none)return{label:CheckpointPlay.get(id).links.length?'My guide links':'Guide & checkpoints',sub:'',kind:'manual'};return{label:'Open walkthrough',sub:'',kind:'new'}}
function stepLabel(s){return s.spoiler&&recPrefs().hideSpoilers?'<span class="muted">Spoiler step (hidden)</span>':escapeHtml(s.text)}
/* A compact, read-mostly "where am I?" card. Next steps can be ticked right here. */
function whereCard(game){
  const sum=CheckpointPlay.summary(game.id),id=escapeHtml(game.id);
  if(sum.isEmpty)return`<div class="where-card empty"><p><b>Where are you?</b> Jot down your location and next step so you can jump straight back in next time.</p></div>`;
  const next=sum.next.slice(0,3),when=ago(CheckpointPlay.get(game.id).updatedAt);
  return`<div class="where-card"><dl class="where-grid"><div><dt>📍 Where</dt><dd>${sum.location?escapeHtml(sum.location):'<span class="muted">Not set</span>'}</dd></div><div><dt>🎯 Objective</dt><dd>${sum.objective?escapeHtml(sum.objective):'<span class="muted">Not set</span>'}</dd></div></dl>`+
    (next.length?`<ul class="where-steps" aria-label="Next steps">${next.map(s=>`<li><label><input type="checkbox" data-where-step="${escapeHtml(s.id)}" data-where-game="${id}"><span>${stepLabel(s)}</span></label></li>`).join('')}${sum.next.length>3?`<li class="muted small">+ ${sum.next.length-3} more</li>`:''}</ul>`:'')+
    `<p class="where-sum">${sum.total?`<span class="where-meter" role="img" aria-label="${sum.done} of ${sum.total} checkpoints done"><i style="width:${sum.percent}%"></i></span>${sum.done} of ${sum.total} checkpoints done`:'No next steps yet'}${when?` · updated ${when}`:''}</p></div>`;
}
function openCheckpoint(id){
  const game=byId(id);if(!game)return;const dlg=$("#checkpointDialog");dlg.dataset.game=id;
  $("#checkpointTitle").textContent=game.title;
  const gi=CheckpointGuide.info(id);
  CheckpointPlay.renderEditor($("#checkpointEditor"),id,{chapters:CheckpointGuide.chapters(id),chapterSource:gi?.root?`${CheckpointGuide.SOURCE_NAME}: ${gi.root}`:''});
  $("#checkpointGuide").innerHTML=`📖 ${escapeHtml(guideInfo(id).label)}`;
  if(!dlg.open)dlg.showModal();
  const sum=CheckpointPlay.summary(id);(sum.location?$("#checkpointEditor [data-cp-new]"):$("#checkpointEditor [data-cp-field]"))?.focus();
}

/* ---------------- recommendations ----------------
   Local and explainable. Signals: status (playing / on hold / backlog / beaten), logged
   progress and checkpoints, series order of games you own, systems you play, "Not for me",
   and the preferences you set. No genre, length or taste data is assumed.
   Finish-first mode (default): pick back up what you started, plus one game for later.
   Explore mode: also new starts, a different game on a system you play, more collection gaps. */
let recPrefsCache=null,wildcardSeed=0,lastHidden=null;
const recPrefs=()=>recPrefsCache||(recPrefsCache=CheckpointPlay.prefs());
const isNotForMe=id=>Boolean(recPrefs().notForMe[id]);
const STATUS_ORDER={playing:0,'on-hold':1,backlog:2};
function continueReason(g){const s=stateFor(g.id),sum=CheckpointPlay.summary(g.id),when=ago(lastTouched(g.id));
  const lead=s.status==='playing'?`You're also playing this${when?` (last updated ${when})`:''}.`:s.status==='on-hold'?`On hold${s.percent?` at ${s.percent}%`:''}${when?`, last updated ${when}`:''}.`:`You logged ${s.percent}% progress, but it's still in your backlog.`;
  const where=sum.location?` You stopped at “${sum.location}”.`:sum.objective?` Next up: ${sum.objective}.`:'';
  return lead+where+(sum.total?` ${sum.done} of ${sum.total} checkpoints done.`:'')}
function hashPick(n,salt){let h=2166136261;for(const c of salt)h=Math.imul(h^c.charCodeAt(0),16777619);return(h>>>0)%n}
function systemPick(used,out){
  const prefs=recPrefs(),preferred=new Set(prefs.systems),beat=new Map(),played=new Map(),owned=new Set(library.map(g=>g.platform));
  for(const g of library){const s=stateFor(g.id).status;if(s==='beaten')beat.set(g.platform,(beat.get(g.platform)||0)+1);else if(s!=='backlog')played.set(g.platform,(played.get(g.platform)||0)+1)}
  const taken=new Set(out.map(o=>o.game?.platform).filter(Boolean)),score=p=>(beat.get(p)||0)*2+(played.get(p)||0);
  const systems=[...new Set([...preferred,...beat.keys(),...played.keys()])].filter(p=>owned.has(p)).sort((a,b)=>preferred.has(b)-preferred.has(a)||taken.has(a)-taken.has(b)||score(b)-score(a));
  for(const p of systems){
    const pool=library.filter(g=>g.platform===p&&!used.has(g.id)&&!isNotForMe(g.id)&&(s=>s.status==='backlog'&&!s.percent)(stateFor(g.id)));if(!pool.length)continue;
    const starter=pool.find(g=>seriesOf(g.id).some(m=>m.index===0)),g=starter||pool[hashPick(pool.length,`${new Date().toDateString()}|${p}|${wildcardSeed}`)];
    const b=beat.get(p)||0,pl=played.get(p)||0,sys=shortPlatform(p);
    const why=b?`You've beaten ${b} ${sys} game${b===1?'':'s'}${pl?` and have ${pl} more going`:''}.`:pl?`You've started ${pl} ${sys} game${pl===1?'':'s'}.`:`You said you'd like to play more ${sys}.`;
    const what=starter?(m=>` This is game 1 of ${m.series.entries.length} in ${m.series.name}, and you own it.`)(seriesOf(starter.id).find(m=>m.index===0)):` A random pick from your ${pool.length.toLocaleString()} unstarted ${sys} games${(m=>m?` (game ${m.index+1} of ${m.series.entries.length} in ${m.series.name})`:'')(seriesOf(g.id)[0])}. It changes daily, or shuffle for another.`;
    return{kind:'system',game:g,label:starter?`🕹 Something different on ${sys}`:`🎲 Wildcard on ${sys}`,reason:why+what,shuffle:!starter};
  }
  return null;
}
/* The system "Build a system's collection" works on: the one you chose, else a favored
   system, else the one you've played most, else the one you own most games for. */
function systemFocus(){const p=recPrefs(),mine=libraryPlatforms();if(mine.has(p.focusSystem))return p.focusSystem;const fav=p.systems.find(s=>mine.has(s));if(fav)return fav;
  const score=new Map(),owned=new Map();for(const g of library){owned.set(g.platform,(owned.get(g.platform)||0)+1);const s=stateFor(g.id).status;if(s!=='backlog')score.set(g.platform,(score.get(g.platform)||0)+(s==='beaten'?2:1))}
  return[...mine].sort((a,b)=>(score.get(b)||0)-(score.get(a)||0)||(owned.get(b)||0)-(owned.get(a)||0))[0]||null}
const sysListName=p=>{const l=discoverLists().find(x=>x.kind==='system'&&expandPlatforms(x.platforms).includes(p)&&x.platforms[0]!=='ARCADE');return l?l.title:`${shortPlatform(p)} essentials`};
/* Modes ("what should suggestions focus on?"):
   focus     - finish what you started, plus one game for when you're done (default)
   classic   - classics and system essentials you own but haven't started, plus a few to find
   franchise - the next game in series you've played, and the next entries to collect
   system    - one system's essentials: owned ones to play, missing ones to find
   explore   - a mix that includes new starts even with games unfinished
   Every mode: never beaten games, never "Not for me" / "Not interested", fewer picks from series
   you've turned down twice, at most six cards, spread across systems where possible. */
function buildRecommendations(focusId){
  const prefs=recPrefs(),mode=prefs.mode,explore=mode==='explore',preferred=new Set(prefs.systems),out=[],used=new Set(focusId?[focusId]:[]);
  const ok=g=>g&&!used.has(g.id)&&!isNotForMe(g.id)&&stateFor(g.id).status!=='beaten';
  const push=item=>{used.add(item.game?item.game.id:item.key);out.push(item)};
  const count=kind=>out.filter(o=>o.kind===kind).length,boost=p=>preferred.has(p)?15:0,hiddenSeries=dismissedSeries();
  const goalNote=key=>{const g=goalsContaining(key);return g.length?` Part of your goal “${g[0]}”.`:''};
  const sys=mode==='system'?systemFocus():null;
  // 1. Finish what you started: other games you're playing first, then on hold, then backlog with progress.
  const started=unfinished().filter(ok).sort((a,b)=>STATUS_ORDER[stateFor(a.id).status]-STATUS_ORDER[stateFor(b.id).status]);
  const hasUnfinished=Boolean(focusId)||started.length>0;
  const contPool=mode==='system'?started.filter(g=>g.platform===sys):mode==='franchise'?[...started].sort((a,b)=>(seriesOf(b.id).length>0)-(seriesOf(a.id).length>0)):started;
  contPool.slice(0,mode==='focus'&&!focusId?2:1).forEach(g=>push({kind:'continue',game:g,label:stateFor(g.id).status==='on-hold'?'↺ Pick back up':'▶ Keep going',reason:continueReason(g)}));
  // Next game you own in a series you've played (or the first game of one you own several of).
  const addSeries=(slots,platform)=>{const seen=new Set();
    for(const p of playNextPicks(used).filter(p=>ok(p.game)&&!hiddenSeries.has(p.series.name)&&(!platform||p.game.platform===platform)).sort((a,b)=>b.score+boost(b.game.platform)-a.score-boost(a.game.platform))){
      if(count('series')>=slots)break;if(seen.has(p.series.name))continue;seen.add(p.series.name);
      push({kind:'series',game:p.game,label:mode==='focus'&&hasUnfinished?'⏭ For when you finish':p.score>=80?'⏭ Next in the series':'▶ Start a series',reason:p.reason});
    }};
  // Curated picks you own and haven't started (Discover lists), spread across systems.
  const addClassics=(slots,platform)=>{const pool=ownedEssentials({platform,exclude:used}).filter(s=>ok(s.game)),taken=new Set(out.map(o=>o.game?.platform).filter(Boolean));
    for(const pass of [0,1])for(const s of pool){if(count('classic')>=slots)return;if(used.has(s.game.id)||(pass===0&&taken.has(s.game.platform)))continue;taken.add(s.game.platform);
      push({kind:'classic',game:s.game,label:s.it.list.kind==='classics'?'★ A classic you own':`★ ${shortPlatform(s.game.platform)} essential you own`,reason:`${s.it.list.title}: ${s.why} You have it but haven't started it.${goalNote(s.key)}`})}};
  // Curated picks you don't have yet, on systems you own.
  const addFinds=(slots,platform)=>{if(prefs.hideGaps)return;const seenList=new Set();
    for(const{s,playable}of missingEssentials({platform})){if(count('find')>=slots)break;if(used.has(s.key)||(seenList.has(s.it.list.id)&&slots>1&&count('find')<slots-1&&!platform))continue;seenList.add(s.it.list.id);
      push({kind:'find',key:s.key,s,label:'＋ Worth finding',reason:`${s.it.list.title}: ${s.why} Not in your library; released on ${playable.map(shortPlatform).join(', ')}, which you play.${goalNote(s.key)}`})}};
  // A missing series entry to track down (Series Quest).
  const addGaps=(slots)=>{if(prefs.hideGaps)return;const seen=new Set();
    for(const r of [...recommendations()].filter(r=>!hiddenSeries.has(r.series.name)).sort((a,b)=>b.score+(b.playable.some(p=>preferred.has(p))?10:0)-a.score-(a.playable.some(p=>preferred.has(p))?10:0))){
      if(count('gap')>=slots)break;if(seen.has(r.series.name)||used.has(r.key))continue;seen.add(r.series.name);
      push({kind:'gap',key:r.key,gap:r,label:'＋ Add to your collection',reason:`${r.reason} (${r.series.name}).${goalNote(r.key)}`});
    }};
  if(mode==='classic'){addClassics(3);addFinds(2)}
  else if(mode==='franchise'){addSeries(3);addGaps(2)}
  else if(mode==='system'&&sys){addClassics(3,sys);addSeries(count('classic')<2?2:1,sys);addFinds(2,sys)}
  else if(explore){addSeries(2);addClassics(1);const pick=systemPick(used,out);if(pick)push(pick);addGaps(1);addFinds(1)}
  else{addSeries(hasUnfinished?1:2);if(!hasUnfinished){addClassics(1);const pick=systemPick(used,out);if(pick)push(pick)}addGaps(1)}
  return{items:out.slice(0,6),hasUnfinished,explore,mode,sys};
}
function guideUrls(game){const q=`${game.title} ${displayPlatform(game.platform)}`;return{web:`https://www.google.com/search?q=${encodeURIComponent(q+' walkthrough guide')}`,faqs:`https://gamefaqs.gamespot.com/search?game=${encodeURIComponent(game.title)}`,video:`https://www.youtube.com/results?search_query=${encodeURIComponent(q+' walkthrough')}`}}
function renderDashboard(){
  const has=library.length>0;$("#dashboardContent").classList.toggle('hidden',!has);$('.hero').classList.toggle('hidden',has);
  if(!has){renderHero();return}
  const playingNow=nowPlaying(),game=playingNow[0]||null;
  $("#spotlight").classList.toggle('tracker',!game);
  if(game){const s=stateFor(game.id);
    $("#spotlight").innerHTML=`<div class="spotlight-backdrop" data-backdrop="${escapeHtml(game.id)}"></div><div class="spotlight-inner">${cover(game,'spotlight-cover')}<div class="spotlight-copy"><p class="eyebrow">NOW PLAYING</p><h2>${escapeHtml(game.title)}</h2><p class="muted"><span class="sys-dot" style="--family:${familyColor(game.platform)}"></span>${escapeHtml(displayPlatform(game.platform))}${(m=>m?` · ${escapeHtml(m.series.name)}, game ${m.index+1} of ${m.series.entries.length}`:'')(seriesOf(game.id)[0])}</p>${playingNow.length>1?`<p class="juggle">You're playing ${playingNow.length} games at once. Finishing one at a time makes it far more likely you'll see the credits.</p>`:''}${whereCard(game)}${s.notes?`<p class="spotlight-notes"><b>Notes</b> ${escapeHtml(s.notes.length>160?s.notes.slice(0,160)+'…':s.notes)}</p>`:''}<div class="spotlight-progress"><div class="progress-track" role="img" aria-label="Progress ${s.percent}%"><i style="width:${s.percent}%"></i></div><strong>${s.percent}%</strong></div><div class="spotlight-actions"><button class="button primary" data-checkpoint="${escapeHtml(game.id)}">📍 Update checkpoint</button>${(gi=>`<button class="button ghost guide-resume" data-guide="${escapeHtml(game.id)}">📖 ${escapeHtml(gi.label)}${gi.sub?`<small>${escapeHtml(gi.sub)}</small>`:''}</button>`)(guideInfo(game.id))}<button class="button ghost" data-game="${escapeHtml(game.id)}">Details</button><button class="text-button small" data-track-change>Track a different game</button></div></div></div>`;
  }else renderTracker();
  const total=library.length,count=st=>library.filter(g=>stateFor(g.id).status===st).length,playing=count('playing'),beaten=count('beaten'),systems=new Set(library.map(g=>g.platform)).size;
  const fs=finishStats();
  $("#stats").innerHTML=[[fs.beaten,'Games beaten',fs.thisYear?`${fs.thisYear} this year`:'beat one to start your shelf',''],[`${fs.rate}%`,'Finish rate',`${fs.beaten} beaten of ${fs.beaten+fs.inProgress} started`,''],[fs.inProgress,'In progress',fs.inProgress>3?'that\'s a lot. Try finishing one first':fs.inProgress?'nicely focused':'pick one to focus on',fs.inProgress>3?'warn':''],[total.toLocaleString(),'Games owned',`across ${systems} systems`,'']].map(([n,l,e,c])=>`<div class="stat ${c}"><span>${l}</span><strong>${n}</strong><em>${e}</em></div>`).join('');
  const queue=unfinished().filter(g=>g.id!==game?.id);
  $("#upNextSection").classList.toggle('hidden',!queue.length);$("#upNext").innerHTML=queue.slice(0,12).map(finishCard).join('');
  const trophies=library.filter(g=>stateFor(g.id).status==='beaten').sort((a,b)=>(progress[b.id]?.beatenAt||'').localeCompare(progress[a.id]?.beatenAt||''));
  $("#trophySection").classList.toggle('hidden',!trophies.length);$("#trophyCount").textContent=`${trophies.length} beaten`;$("#trophyShelf").innerHTML=trophies.slice(0,24).map(shelfGame).join('');
  const counts=new Map();library.forEach(g=>counts.set(g.platform,(counts.get(g.platform)||0)+1));
  $("#systemCount").textContent=`${counts.size} detected`;
  $("#platformChips").innerHTML=[...counts].sort((a,b)=>b[1]-a[1]).map(([p,n])=>`<button class="platform-chip" data-platform-link="${escapeHtml(p)}" style="--family:${familyColor(p)}"><span class="sys-dot"></span>${escapeHtml(shortPlatform(p))}<b>${n.toLocaleString()}</b></button>`).join('');
  renderForYou(game?.id||null);renderGoalsMini();
  const recent=[...library].map((g,i)=>[g,i]).sort((a,b)=>(b[0].importedAt||'').localeCompare(a[0].importedAt||'')||b[1]-a[1]).slice(0,16).map(x=>x[0]);
  $("#recentGames").innerHTML=recent.map(shelfGame).join('');
  hydrateArt($("#dashboardView"));
  if(!game)return;
  const bd=$('[data-backdrop]');const k=`g:${game.id}`;const applyBackdrop=()=>{const a=loadedArt.get(k);if(a)bd.style.backgroundImage=`url("${a.src}")`};applyBackdrop();if(!loadedArt.has(k))CheckpointArt.resolve(game).then(ref=>{if(ref)bd.style.backgroundImage=`url("${CheckpointArt.urls(ref)[0]}")`});
}
function renderTracker(query=''){
  const q=norm(query),matches=q?library.filter(g=>haystack(g).includes(q)).slice(0,6):[],picks=trackSuggestions();
  const el=$("#spotlight");
  if(!el.querySelector('#trackSearch')){
    el.innerHTML=`<div class="tracker-inner"><div class="tracker-copy"><p class="eyebrow">NOW PLAYING</p><h2>What are you playing right now?</h2><p class="muted">Pick one game to focus on and see it through to the credits. Checkpoint keeps its progress, your notes and the walkthrough one click away.</p><label class="search tracker-search"><span aria-hidden="true">⌕</span><input id="trackSearch" type="search" placeholder="Search your ${library.length.toLocaleString()} games…" autocomplete="off" aria-label="Search your library for a game to track"></label><div class="track-results" id="trackResults"></div></div><div class="tracker-picks"><p class="small muted" id="trackPicksLabel"></p><div class="track-picks" id="trackPicks"></div></div></div>`;
  }
  $("#trackResults").innerHTML=q?(matches.length?matches.map(g=>`<button class="track-result" data-track="${escapeHtml(g.id)}">${cover(g,'mini')}<span><b>${escapeHtml(g.title)}</b><small>${escapeHtml(shortPlatform(g.platform))} · ${STATUS_LABEL[stateFor(g.id).status]}</small></span><em>Track</em></button>`).join(''):'<p class="muted small">No games match.</p>'):'';
  $("#trackPicksLabel").textContent=unfinished().length?'Finish what you started':'Or start one of these';
  $("#trackPicks").innerHTML=picks.map(g=>`<button class="track-pick" data-track="${escapeHtml(g.id)}" title="Track ${escapeHtml(g.title)}">${cover(g)}<b>${escapeHtml(g.title)}</b><small>${isStarted(g)?`${stateFor(g.id).percent}% done`:shortPlatform(g.platform)}</small></button>`).join('');
  hydrateArt(el);
}
function startPlaying(id,holdOthers){const g=byId(id);if(!g)return;if(holdOthers)for(const o of nowPlaying())if(o.id!==id)progress[o.id]={...stateFor(o.id),status:'on-hold',updatedAt:new Date().toISOString()};saveState(id,{...stateFor(id),status:'playing'});toast(`${g.title} is now your focus`);route('dashboard')}
/* Starting something new while another game is in progress asks first: the point is to finish games. */
function askFocus(id,{onStart,onCancel}={}){
  const g=byId(id),others=nowPlaying().filter(o=>o.id!==id);
  if(!g)return;
  if(!others.length){(onStart||(()=>startPlaying(id,false)))(false);return}
  const cur=others[0],cs=stateFor(cur.id);
  $("#focusCurrent").innerHTML=`${cover(cur,'mini')}<div><b>${escapeHtml(cur.title)}</b><small>${cs.percent}% done${others.length>1?` · plus ${others.length-1} more in progress`:''}</small><div class="progress-track"><i style="width:${cs.percent}%"></i></div></div>`;
  $("#focusTitle").textContent=`You're still playing ${cur.title}`;
  $("#focusNew").textContent=g.title;
  $("#focusHold").textContent=`Put ${others.length>1?'them':'it'} on hold and start ${g.title}`;
  const dlg=$("#focusDialog");
  $("#focusHold").onclick=()=>{dlg.close();(onStart||(h=>startPlaying(id,h)))(true)};
  $("#focusBoth").onclick=()=>{dlg.close();(onStart||(h=>startPlaying(id,h)))(false)};
  $("#focusKeep").onclick=()=>{dlg.close();onCancel?.();toast(`Keep going, you've got ${cur.title} this far!`)};
  hydrateArt($("#focusCurrent"));dlg.showModal();
}
function trackGame(id){askFocus(id)}
function celebrate(id){
  const g=byId(id);if(!g)return;const st=finishStats(),s=stateFor(id);
  const days=s.startedAt?Math.max(1,Math.round((Date.parse(s.beatenAt)-Date.parse(s.startedAt))/864e5)):null;
  const ord=n=>n+(['th','st','nd','rd'][(n%100-20)%10]||['th','st','nd','rd'][n%100]||'th');
  $("#celebrateCover").innerHTML=cover(g,'celebrate-cover');
  $("#celebrateTitle").textContent=`You beat ${g.title}!`;
  $("#celebrateText").textContent=`That's your ${ord(st.beaten)} game finished${st.thisYear?`, ${st.thisYear} this year`:''}.${days?` It took ${days} day${days===1?'':'s'} from start to finish.`:''}`;
  const next=[...playNextPicks(new Set()).filter(p=>p.score>=80).map(p=>({game:p.game,why:p.reason})),...unfinished().map(u=>({game:u,why:`${stateFor(u.id).percent}% done. Finish what you started`}))].filter((x,i,a)=>a.findIndex(y=>y.game.id===x.game.id)===i).slice(0,3);
  $("#celebrateNext").innerHTML=next.length?`<p class="small muted">Pick your next focus</p>`+next.map(n=>`<button class="track-result" data-track="${escapeHtml(n.game.id)}">${cover(n.game,'mini')}<span><b>${escapeHtml(n.game.title)}</b><small>${escapeHtml(n.why)}</small></span><em>Focus</em></button>`).join(''):'';
  hydrateArt($("#celebrateDialog"));$("#celebrateDialog").showModal();
}
function renderForYou(focusId){
  const{items,hasUnfinished,explore,mode,sys}=buildRecommendations(focusId),prefs=recPrefs();
  const nfm=id=>`<button class="mini-button subtle" data-notforme="${escapeHtml(id)}" aria-label="Not for me: hide from suggestions">Not for me</button>`;
  const cards=items.map(r=>{
    if(r.kind==='gap')return`<article class="for-you-card gap">${entryCover(r.gap.series,r.gap.entry,'fy')}<div class="fy-body"><p class="fy-kind">${r.label}</p><h3>${escapeHtml(r.gap.title)}</h3><p class="muted small">${escapeHtml(r.reason)}</p>${platformChips(r.gap.platforms)}<div class="fy-actions"><button class="mini-button" data-mark="want" data-series="${enc(r.gap.series.name)}" data-entry="${enc(r.gap.title)}">＋ Want</button><button class="mini-button subtle" data-mark="no" data-series="${enc(r.gap.series.name)}" data-entry="${enc(r.gap.title)}" aria-label="Not interested in ${escapeHtml(r.gap.title)}">Not interested</button></div></div></article>`;
    if(r.kind==='find')return`<article class="for-you-card gap find">${discCover(r.s,'fy')}<div class="fy-body"><p class="fy-kind">${r.label}</p><h3>${escapeHtml(r.s.title)}</h3><p class="muted small">${escapeHtml(r.reason)}</p>${r.s.region?`<p class="disc-note small">${escapeHtml(r.s.region)}</p>`:''}<div class="fy-actions"><button class="mini-button" data-dmark="want" data-dkey="${escapeHtml(r.s.uid)}">＋ Want</button><button class="mini-button subtle" data-dmark="no" data-dkey="${escapeHtml(r.s.uid)}" aria-label="Not interested in ${escapeHtml(r.s.title)}">Not interested</button></div></div></article>`;
    const id=escapeHtml(r.game.id),cont=r.kind==='continue';
    return`<article class="for-you-card own ${r.kind}">${cover(r.game,'fy')}<div class="fy-body"><p class="fy-kind">${escapeHtml(r.label)}</p><h3>${escapeHtml(r.game.title)}</h3><p class="fy-sys muted small"><span class="sys-dot" style="--family:${familyColor(r.game.platform)}"></span>${escapeHtml(shortPlatform(r.game.platform))}</p><p class="muted small">${escapeHtml(r.reason)}</p><div class="fy-actions">${cont?`<button class="mini-button on" data-track="${id}">${stateFor(r.game.id).status==='playing'?'Make focus':'Resume'}</button><button class="mini-button" data-checkpoint="${id}">📍 Where was I?</button>`:`<button class="mini-button on" data-track="${id}">Start playing</button><button class="mini-button" data-game="${id}">Details</button>`}${r.shuffle?`<button class="mini-button" data-shuffle aria-label="Shuffle: suggest a different random game">🎲 Shuffle</button>`:''}${nfm(r.game.id)}</div></div></article>`;
  });
  $("#forYouHeading").textContent={classic:'Classics to play next',franchise:'Continue a franchise',system:sys?`Building your ${shortPlatform(sys)} collection`:'Build a system’s collection',explore:'Ideas for what to play'}[mode]||(hasUnfinished?'Pick up where you left off':'What to play next');
  const favs=prefs.systems.map(shortPlatform),hs=dismissedSeries().size;
  $("#forYouMode").textContent=`${{classic:'Classics and essentials you own but haven’t started, then a few worth finding',franchise:'Next games in series you’ve played, then entries to collect',system:sys?`${sysListName(sys)}: ones you own to play, then ones to find. Change the system in Tune suggestions`:'Pick a system in Tune suggestions',explore:'Explore: includes new games to start',focus:'Finish first: games you started come first'}[mode]}${favs.length?` · favoring ${favs.slice(0,3).join(', ')}${favs.length>3?` +${favs.length-3}`:''}`:''}${hs?` · ${hs} series you turned down suggested less`:''}`;
  if($("#forYouFocus").value!==mode)$("#forYouFocus").value=mode;
  const undo=lastHidden&&byId(lastHidden)&&isNotForMe(lastHidden)?`<p class="rec-undo" role="status">Hidden “${escapeHtml(byId(lastHidden).title)}” from suggestions. <button class="text-button small" data-undo-notforme="${escapeHtml(lastHidden)}">Undo</button></p>`:'';
  $("#forYouSection").classList.toggle('hidden',!cards.length&&!undo);
  $("#forYou").innerHTML=undo+(cards.join('')||'<p class="muted">Nothing to suggest right now. Change what suggestions focus on with <b>Tune suggestions</b>.</p>');
}
function finishCard(g){const s=stateFor(g.id),loc=CheckpointPlay.get(g.id).location;return`<article class="finish-card">${cover(g,'mini')}<div class="fc-body" data-game="${escapeHtml(g.id)}" role="button" tabindex="0" aria-label="${escapeHtml(g.title)}: open details"><b>${escapeHtml(g.title)}</b><small>${escapeHtml(shortPlatform(g.platform))} · ${STATUS_LABEL[s.status]}</small>${loc?`<small class="fc-where">📍 ${escapeHtml(loc)}</small>`:''}<div class="fc-progress"><div class="progress-track"><i style="width:${s.percent}%"></i></div><strong>${s.percent}%</strong></div></div><div class="fc-actions"><button class="mini-button" data-track="${escapeHtml(g.id)}">Make focus</button><button class="mini-button subtle" data-checkpoint="${escapeHtml(g.id)}" aria-label="Update checkpoint for ${escapeHtml(g.title)}">📍</button><button class="mini-button subtle" data-guide="${escapeHtml(g.id)}" aria-label="Open guide for ${escapeHtml(g.title)}">📖</button></div></article>`}
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
  const sorters={title:(a,b)=>a.title.localeCompare(b.title),recent:(a,b)=>(b.importedAt||'').localeCompare(a.importedAt||'')||order.get(b.id)-order.get(a.id),progress:(a,b)=>stateFor(b.id).percent-stateFor(a.id).percent||a.title.localeCompare(b.title),platform:(a,b)=>shortPlatform(a.platform).localeCompare(shortPlatform(b.platform))||a.title.localeCompare(b.title),series:(a,b)=>{const x=seriesOf(a.id)[0],y=seriesOf(b.id)[0];if(!x||!y)return(!x)-(!y)||a.title.localeCompare(b.title);return x.series.name.localeCompare(y.series.name)||x.index-y.index||a.title.localeCompare(b.title)}};
  filtered.sort(sorters[sort]||sorters.title);
  const visible=filtered.slice(0,libraryVisibleCount);
  $("#librarySubtitle").textContent=library.length?`${library.length.toLocaleString()} games across ${new Set(library.map(g=>g.platform)).size} systems${filtered.length!==library.length?` · ${filtered.length.toLocaleString()} shown`:''}`:'Import your scanner inventory to begin.';
  $("#libraryGrid").innerHTML=visible.map(g=>{const s=stateFor(g.id);return`<article class="game-card" data-game="${escapeHtml(g.id)}" tabindex="0" role="button" aria-label="${escapeHtml(g.title)}">${cover(g)}${s.status!=='backlog'?`<span class="status-badge ${s.status}">${STATUS_LABEL[s.status]}</span>`:''}${s.percent?`<div class="cover-progress"><i style="width:${s.percent}%"></i></div>`:''}${(r=>`<button class="card-guide${r?' resume':''}" data-guide="${escapeHtml(g.id)}" title="${r?'Resume guide':'Open walkthrough'}" aria-label="${r?'Resume guide':'Open walkthrough'} for ${escapeHtml(g.title)}">📖</button>`)(CheckpointGuide.hasGuide(g.id))}<div class="game-info"><h3 title="${escapeHtml(g.title)}">${escapeHtml(g.title)}</h3><p><span class="sys-dot" style="--family:${familyColor(g.platform)}"></span>${escapeHtml(shortPlatform(g.platform))}${seriesBadge(g)}</p></div></article>`}).join('');
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
function markButtons(series,entry,mark){const s=enc(series.name),t=enc(entry.title);if(mark==='have'||mark==='skip'||mark==='no')return`<button class="mini-button" data-mark="" data-series="${s}" data-entry="${t}">Undo${mark==='no'?' “not interested”':''}</button>`;return`<button class="mini-button${mark==='want'?' on':''}" data-mark="${mark==='want'?'':'want'}" data-series="${s}" data-entry="${t}" title="Add to your hunt list">${mark==='want'?'✓ Hunting':'＋ Hunt'}</button><button class="mini-button" data-mark="have" data-series="${s}" data-entry="${t}" title="You own or finished it outside this library">Have it</button><button class="mini-button subtle" data-mark="skip" data-series="${s}" data-entry="${t}" title="Not interested — exclude from this goal">Skip</button>`}
function priceUrl(title,platforms){return`https://www.pricecharting.com/search-products?type=prices&q=${enc(title+(platforms[0]?' '+shortPlatform(platforms[0]):''))}`}
function renderQuestStats(){const started=SERIES.filter(s=>seriesStatus(s).started),collected=started.reduce((a,s)=>a+seriesStatus(s).collected,0),total=started.reduce((a,s)=>a+seriesStatus(s).total,0),complete=started.filter(s=>!seriesStatus(s).missing.length).length;$("#questStats").innerHTML=[[`${started.length}<small>/${SERIES.length}</small>`,'Franchises started',`${complete} complete`],[`${collected}<small>/${total}</small>`,'Games collected','in started franchises'],[seriesGaps().length,'Gaps to fill','ranked below'],[huntList().length,'On your hunt list','games to track down']].map(([n,l,e])=>`<div class="stat"><span>${l}</span><strong>${n}</strong><em>${e}</em></div>`).join('')}
function renderGoalDetail(){
  const series=SERIES.find(s=>s.name===activeSeriesName),detail=$("#goalDetail");detail.classList.toggle('hidden',!series);if(!series)return;
  const st=seriesStatus(series);
  $("#goalSystem").textContent=series.systems.map(displayPlatform).join(' • ');$("#goalTitle").textContent=series.name;
  $("#goalSummary").textContent=!st.missing.length?'You have every game in this goal. Nicely done!':`${st.missing.length} game${st.missing.length===1?'':'s'} still to collect${st.skipped?` · ${st.skipped} skipped`:''}. Add the ones you want to your hunt list.`;
  $("#goalScore").innerHTML=`<strong>${st.collected}/${st.total}</strong><span>collected</span>`;$("#goalProgressBar").style.width=`${st.percent}%`;
  $("#goalChecklist").innerHTML=st.entries.map(({entry,index,game,mark,collected,skipped})=>{const state=game?stateFor(game.id):null,platforms=entryPlatforms(series,entry);const meta=game?`${escapeHtml(displayPlatform(game.platform))} · ${STATUS_LABEL[state.status]}${state.percent?` · ${state.percent}%`:''}`:mark==='have'?'Marked as owned outside this library':mark==='no'?'Not interested — not counted and never suggested':skipped?'Skipped — not counted toward this goal':`${platforms.length?'Released on '+platformChips(platforms):'Not detected in your library'}`;return`<article class="goal-row ${game||mark==='have'?'owned':skipped?'skipped':'missing'}${mark==='want'?' wanted':''}">${game?cover(game,'mini'):entryCover(series,entry,'mini')}<div class="goal-text"><strong>${index+1}. ${escapeHtml(entry.title)}</strong><p>${meta}</p></div><div class="goal-actions">${game?`<button class="mini-button" data-game="${escapeHtml(game.id)}">Open</button>`:markButtons(series,entry,mark)}</div><span class="goal-check" aria-hidden="true">${game?(state.status==='beaten'?'★':'✓'):collected?'✓':skipped?'–':'○'}</span></article>`}).join('');
  hydrateArt(detail);
}
/* One toolbar drives three views: gaps to fill, franchise goals and the hunt list.
   The system chips, search and sort apply to whichever view is open. */
const QUEST_KEY='checkpoint.questui.v1';
let quest={tab:'gaps',system:'all',status:'all',sort:{},...read(QUEST_KEY,{}),limit:40};
const saveQuest=()=>write(QUEST_KEY,{tab:quest.tab,system:quest.system,status:quest.status,sort:quest.sort});
const QUEST_TABS=[['gaps','Gaps to fill'],['franchises','Franchises'],['hunt','Hunt list']];
const QUEST_SORTS={gaps:[['best','Best next pick'],['franchise','Group by franchise'],['system','Group by system'],['closest','Closest to finishing'],['title','Title A–Z']],franchises:[['closest','Closest to complete'],['missing','Most missing'],['owned','Most collected'],['name','Name A–Z']],hunt:[['franchise','Group by franchise'],['system','Group by system'],['title','Title A–Z']]};
const QUEST_HINTS={gaps:'Missing games from franchises you’ve started. The next game in line ranks first, then earlier entries you skipped.',franchises:'Every franchise Checkpoint tracks. Open one to see its full checklist.',hunt:'Games you’ve decided to collect. Rescan after adding them to your card and they’ll be checked off automatically. Discover → Want list also shows games wanted from the classics and system lists.'};
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
function renderAll(){resetSeriesCache();renderPlatforms();renderDashboard();renderLibrary();renderRecommendations();renderDiscoverIfVisible()}

/* ---------------- game dialog ---------------- */
function openGame(id){
  const game=byId(id);if(!game)return;activeGameId=id;const s=stateFor(id);
  $("#dialogPlatform").textContent=displayPlatform(game.platform);$("#dialogTitle").textContent=game.title;$("#dialogPath").textContent=fileOf(game)||'Imported game';
  $$('input[name="dialogStatus"]').forEach(r=>r.checked=r.value===s.status);
  $("#dialogProgress").value=s.percent;$("#progressOutput").value=`${s.percent}%`;$("#dialogNotes").value=s.notes;
  const g=guideUrls(game);$("#guideLink").href=g.web;$("#gamefaqsLink").href=g.faqs;$("#youtubeLink").href=g.video;renderDialogGuide(id);
  const gi=CheckpointGuide.info(id);CheckpointPlay.renderEditor($("#dialogPlay"),id,{chapters:CheckpointGuide.chapters(id),chapterSource:gi?.root?`${CheckpointGuide.SOURCE_NAME}: ${gi.root}`:''});
  renderProgressHint(id);renderNotForMe(id);
  $("#artPicker").classList.add('hidden');$("#artSearch").value='';
  $("#changeArtButton").classList.toggle('hidden',!CheckpointArt.supports(game.platform));
  renderDialogCover(game);renderDialogSeries(game);if(!$("#gameDialog").open)$("#gameDialog").showModal();$("#gameDialog .dialog-card").scrollTop=0;
}
function renderDialogGuide(id){const gi=guideInfo(id),links=CheckpointPlay.get(id).links;
  $("#guideButtonLabel").textContent=gi.label;$("#guideResume").textContent=gi.kind==='wiki'?gi.sub:gi.kind==='manual'?'Your checkpoints & links':'Read it right here';
  $("#dialogUserLinks").innerHTML=links.length?`<span class="muted small">Your links</span>${links.map(l=>`<a class="chip-link mine" href="${escapeHtml(l.url)}" target="_blank" rel="noopener">${escapeHtml(l.label)} ↗</a>`).join('')}`:'';
  $("#dialogUserLinks").classList.toggle('hidden',!links.length)}
function renderProgressHint(id){const sum=CheckpointPlay.summary(id),el=$("#progressHint");el.classList.toggle('hidden',!sum.total);if(!sum.total)return;const near=Math.round(sum.percent/5)*5;
  el.innerHTML=`Checkpoints: ${sum.done} of ${sum.total} done (${sum.percent}%). The slider is your own estimate${Number($("#dialogProgress").value)!==near?` · <button type="button" class="text-button small" data-use-cp-progress="${near}">Set it to ${near}%</button>`:''}.`}
function renderNotForMe(id){const el=$("#dialogNotForMe"),on=isNotForMe(id);el.classList.toggle('hidden',!on);el.innerHTML=on?`Hidden from suggestions (“Not for me”). <button type="button" class="text-button small" data-undo-notforme="${escapeHtml(id)}">Show it again</button>`:''}
function renderDialogSeries(game){
  const list=seriesOf(game.id).slice(0,3),box=$("#dialogSeries");
  box.innerHTML=list.map(({series,index})=>{const st=seriesStatus(series);return`<section class="ds-block"><div class="ds-head"><div><p class="eyebrow">IN THIS SERIES</p><b>${escapeHtml(series.name)}</b><span class="muted small">Game ${index+1} of ${series.entries.length} · you have ${st.collected}</span></div><button type="button" class="text-button small" data-ds-checklist="${enc(series.name)}">Full checklist →</button></div><div class="ds-strip">${st.entries.map(e=>{const cur=e.game?.id===game.id||(e.index===index);const label=`<span class="ds-num">${e.index+1}</span><small>${escapeHtml(e.entry.title)}</small>`;return e.game?`<button type="button" class="ds-item owned${cur?' current':''}" data-ds-game="${escapeHtml(e.game.id)}" title="${escapeHtml(e.entry.title)}${cur?' (this game)':''}">${cover(e.game,'ds')}${label}${cur?'<em>This game</em>':''}</button>`:`<button type="button" class="ds-item missing${e.wanted?' wanted':''}${e.mark==='have'?' have':''}" ${e.mark==='have'||e.skipped?'':`data-mark="${e.wanted?'':'want'}" data-series="${enc(series.name)}" data-entry="${enc(e.entry.title)}"`} title="${escapeHtml(e.entry.title)}: ${e.mark==='have'?'owned elsewhere':e.skipped?'skipped':e.wanted?'on your hunt list (click to remove)':'not in your library (click to add to hunt list)'}">${entryCover(series,e.entry,'ds')}${label}<em>${e.mark==='have'?'Have it':e.skipped?'Skipped':e.wanted?'✓ Hunting':'＋ Hunt'}</em></button>`}).join('')}</div></section>`}).join('');
  box.classList.toggle('hidden',!list.length);hydrateArt(box);
  const cur=box.querySelector('.ds-item.current');if(cur)cur.scrollIntoView({block:'nearest',inline:'center'});
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
function openGuide(id){const game=byId(id);if(!game)return;CheckpointGuide.open(game,{platformName:displayPlatform(game.platform),getNotes:()=>stateFor(id).notes,setNotes:notes=>{if(notes===stateFor(id).notes)return;progress[id]={...stateFor(id),notes,updatedAt:new Date().toISOString()};write(STORAGE.progress,progress);if(activeGameId===id)$("#dialogNotes").value=notes},onClose:()=>{renderDashboard();if(activeGameId===id){renderDialogGuide(id);const gi=CheckpointGuide.info(id);CheckpointPlay.renderEditor($("#dialogPlay"),id,{chapters:CheckpointGuide.chapters(id),chapterSource:gi?.root?`${CheckpointGuide.SOURCE_NAME}: ${gi.root}`:''});renderProgressHint(id)}if($("#checkpointDialog").open&&$("#checkpointDialog").dataset.game===id)openCheckpoint(id)}})}
function afterArtChange(game,message){loadedArt.delete(`g:${game.id}`);renderDialogCover(game);$("#artPicker").classList.add('hidden');renderAll();toast(message)}

/* ---------------- events ---------------- */
document.addEventListener('click',e=>{
  const routeBtn=e.target.closest('[data-route]');if(routeBtn){if(routeBtn.dataset.statusLink){libraryStatus=routeBtn.dataset.statusLink;libraryVisibleCount=LIBRARY_PAGE_SIZE}if(routeBtn.dataset.discoverTab){ui().tab=routeBtn.dataset.discoverTab;saveUI()}route(routeBtn.dataset.route);return}
  const plat=e.target.closest('[data-platform-link]');if(plat){$("#platformFilter").value=plat.dataset.platformLink;libraryStatus='all';libraryVisibleCount=LIBRARY_PAGE_SIZE;route('library');return}
  const tab=e.target.closest('[data-status]');if(tab){libraryStatus=tab.dataset.status;libraryVisibleCount=LIBRARY_PAGE_SIZE;renderLibrary();return}
  const series=e.target.closest('[data-open-series]');if(series){activeSeriesName=decodeURIComponent(series.dataset.openSeries);renderSeriesCatalog();renderGoalDetail();$("#goalDetail").scrollIntoView({behavior:'smooth',block:'start'});return}
  const dsGame=e.target.closest('[data-ds-game]');if(dsGame){openGame(dsGame.dataset.dsGame);return}
  const dsList=e.target.closest('[data-ds-checklist]');if(dsList){$("#gameDialog").close();activeSeriesName=decodeURIComponent(dsList.dataset.dsChecklist);route('recommendations');return}
  const mark=e.target.closest('[data-mark]');if(mark){const v=mark.dataset.mark,t=decodeURIComponent(mark.dataset.entry);setMark(decodeURIComponent(mark.dataset.series),t,v);if($("#gameDialog").open&&activeGameId)renderDialogSeries(byId(activeGameId));toast({want:`Added ${t} to your hunt list`,have:`Marked ${t} as collected`,skip:`Skipped ${t}`,no:`Got it: ${t} won't be suggested`}[v]||'Updated');return}
  const sf=e.target.closest('[data-series-filter]');if(sf){quest.status=sf.dataset.seriesFilter;saveQuest();renderRecommendations();return}
  const qt=e.target.closest('[data-quest-tab]');if(qt){quest.tab=qt.dataset.questTab;quest.limit=40;saveQuest();renderRecommendations();return}
  const qs=e.target.closest('[data-quest-system]');if(qs){quest.system=qs.dataset.questSystem;quest.limit=40;saveQuest();renderRecommendations();return}
  const cp=e.target.closest('[data-checkpoint]');if(cp){openCheckpoint(cp.dataset.checkpoint);return}
  const nfm=e.target.closest('[data-notforme]');if(nfm){const id=nfm.dataset.notforme;lastHidden=id;CheckpointPlay.setNotForMe(id,true);toast(`Hidden ${byId(id)?.title||'game'} from suggestions`);$("#forYou [data-undo-notforme]")?.focus();return}
  const unf=e.target.closest('[data-undo-notforme]');if(unf){const id=unf.dataset.undoNotforme;CheckpointPlay.setNotForMe(id,false);if(lastHidden===id)lastHidden=null;if(activeGameId===id)renderNotForMe(id);toast(`${byId(id)?.title||'Game'} can be suggested again`);return}
  if(e.target.closest('[data-shuffle]')){wildcardSeed++;renderForYou(nowPlaying()[0]?.id||null);hydrateArt($("#forYou"));$("#forYou [data-shuffle]")?.focus();return}
  const useCp=e.target.closest('[data-use-cp-progress]');if(useCp){$("#dialogProgress").value=useCp.dataset.useCpProgress;$("#progressOutput").value=`${useCp.dataset.useCpProgress}%`;renderProgressHint(activeGameId);toast('Slider updated. Save changes to keep it');return}
  const track=e.target.closest('[data-track]');if(track){if($("#celebrateDialog").open)$("#celebrateDialog").close();trackGame(track.dataset.track);return}
  if(e.target.closest('[data-track-change]')){$("#spotlight").classList.add('tracker');$("#spotlight").innerHTML='';renderTracker();hydrateArt($("#spotlight"));$("#trackSearch").focus();return}
  const guideBtn=e.target.closest('[data-guide]');if(guideBtn){openGuide(guideBtn.dataset.guide);return}
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
document.addEventListener('input',e=>{if(e.target.id==='trackSearch')renderTracker(e.target.value)});
document.addEventListener('change',e=>{if(e.target.id==='questSystemMore'&&e.target.value){quest.system=e.target.value;quest.limit=40;saveQuest();renderRecommendations()}});
$("#closeGoalButton").onclick=()=>{activeSeriesName=null;renderRecommendations();$("#questBrowse").scrollIntoView({block:"start"})};
$("#dialogProgress").oninput=e=>{$("#progressOutput").value=`${e.target.value}%`;if(activeGameId)renderProgressHint(activeGameId)};
$$('input[name="dialogStatus"]').forEach(r=>r.onchange=()=>{if(r.value==='beaten'&&r.checked){$("#dialogProgress").value=100;$("#progressOutput").value='100%'}});
$("#saveGameButton").onclick=()=>{if(!activeGameId)return;const id=activeGameId,prev=stateFor(id),status=$('input[name="dialogStatus"]:checked')?.value||'backlog',fields={...prev,percent:Number($("#dialogProgress").value),notes:$("#dialogNotes").value.trim()};
  if(status==='playing'&&prev.status!=='playing'&&nowPlaying().some(o=>o.id!==id)){setTimeout(()=>askFocus(id,{onStart:hold=>{if(hold)for(const o of nowPlaying())if(o.id!==id)progress[o.id]={...stateFor(o.id),status:'on-hold'};saveState(id,{...fields,status:'playing'});toast('Game progress saved')},onCancel:()=>saveState(id,{...fields,status:prev.status})}),0);return}
  saveState(id,{...fields,status});if(status!=='beaten')toast('Game progress saved')};
$("#openGuideButton").onclick=()=>{if(activeGameId)openGuide(activeGameId)};
$("#changeArtButton").onclick=()=>{const p=$("#artPicker");p.classList.toggle('hidden');if(!p.classList.contains('hidden'))renderArtOptions()};
let artTimer;$("#artSearch").oninput=()=>{clearTimeout(artTimer);artTimer=setTimeout(renderArtOptions,250)};
$("#artSearch").onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();renderArtOptions()}};
$("#artAutoButton").onclick=()=>{const g=byId(activeGameId);if(!g)return;CheckpointArt.clearOverride(g.id);afterArtChange(g,'Using automatic cover')};
$("#artNoneButton").onclick=()=>{const g=byId(activeGameId);if(!g)return;CheckpointArt.hideArt(g.id);afterArtChange(g,'Cover art hidden for this game')};
$("#gameDialog").addEventListener('close',()=>{activeGameId=null});

/* checkpoint quick update */
$("#checkpointClose").onclick=$("#checkpointDone").onclick=()=>$("#checkpointDialog").close();
$("#checkpointGuide").onclick=()=>{const id=$("#checkpointDialog").dataset.game;$("#checkpointDialog").close();openGuide(id)};
$("#checkpointDetails").onclick=()=>{const id=$("#checkpointDialog").dataset.game;$("#checkpointDialog").close();openGame(id)};
$("#checkpointDialog").addEventListener('click',e=>{if(e.target===e.currentTarget)e.currentTarget.close()});
// Tick a next step straight from the Now Playing card.
let pendingFocus=null;
document.addEventListener('change',e=>{const box=e.target.closest?.('[data-where-step]');if(!box)return;const gid=box.dataset.whereGame,list=[...document.querySelectorAll(`[data-where-game="${CSS.escape(gid)}"]`)],i=list.indexOf(box);
  CheckpointPlay.editStep(gid,box.dataset.whereStep,{done:box.checked});pendingFocus={gid,i};toast('Step done. Nice!')});
let playRenderTimer;
document.addEventListener('checkpoint:play',e=>{const id=e.detail?.id;clearTimeout(playRenderTimer);
  playRenderTimer=setTimeout(()=>{renderDashboard();if(pendingFocus){const{gid,i}=pendingFocus;pendingFocus=null;const list=[...document.querySelectorAll(`[data-where-game="${CSS.escape(gid)}"]`)];(list[Math.min(i,list.length-1)]||$(`#spotlight [data-checkpoint]`))?.focus()}},pendingFocus?0:250);
  if(id&&id===activeGameId){renderProgressHint(id);renderDialogGuide(id)}});
document.addEventListener('checkpoint:prefs',()=>{recPrefsCache=null;renderDashboard();renderDiscoverIfVisible();if($("#recPrefsDialog").open)renderRecPrefs();if(activeGameId)renderNotForMe(activeGameId)});
window.addEventListener('checkpoint:storage-error',()=>toast('Could not save: browser storage is full or blocked'));

/* recommendation preferences */
function renderRecPrefs(){const p=recPrefs(),counts=new Map();library.forEach(g=>counts.set(g.platform,(counts.get(g.platform)||0)+1));
  $$('input[name="recMode"]').forEach(r=>r.checked=r.value===p.mode);$("#recPrefsGaps").checked=p.hideGaps;$("#recPrefsSpoilers").checked=p.hideSpoilers;
  const cur=systemFocus();$("#recFocusSystemWrap").classList.toggle('hidden',p.mode!=='system');$("#recFocusSystem").innerHTML=[...counts].sort((a,b)=>b[1]-a[1]).map(([s,n])=>`<option value="${escapeHtml(s)}"${s===cur?' selected':''}>${escapeHtml(displayPlatform(s))} (${n.toLocaleString()})</option>`).join('');
  const hs=[...dismissedSeries()];$("#recPrefsSeriesNote").textContent=hs.length?`You've turned down two or more games from ${hs.slice(0,4).join(', ')}${hs.length>4?` and ${hs.length-4} more`:''}, so Checkpoint suggests less from ${hs.length===1?'that series':'those series'}. Undo a “Not for me” or “Not interested” to change this.`:'';
  $("#recPrefsSystems").innerHTML=[...counts].sort((a,b)=>b[1]-a[1]).map(([s,n])=>`<button type="button" class="sys-chip${p.systems.includes(s)?' active':''}" data-pref-system="${escapeHtml(s)}" aria-pressed="${p.systems.includes(s)}" style="--family:${familyColor(s)}"><span class="sys-dot"></span>${escapeHtml(shortPlatform(s))}<b>${n.toLocaleString()}</b></button>`).join('')||'<p class="muted small">Import your library to pick systems.</p>';
  const hidden=Object.keys(p.notForMe).map(byId).filter(Boolean);
  $("#recPrefsHidden").innerHTML=hidden.length?`<ul class="prefs-hidden">${hidden.map(g=>`<li><span>${escapeHtml(g.title)} <small class="muted">${escapeHtml(shortPlatform(g.platform))}</small></span><button type="button" class="mini-button" data-undo-notforme="${escapeHtml(g.id)}">Show again</button></li>`).join('')}</ul>`:'<p class="muted small">Nothing hidden. Use “Not for me” on a suggestion to stop seeing it. Series Quest skips are managed in Series Quest.</p>'}
$("#recTuneButton").onclick=()=>{renderRecPrefs();$("#recPrefsDialog").showModal()};
$("#recPrefsClose").onclick=()=>$("#recPrefsDialog").close();
$("#recPrefsDialog").addEventListener('click',e=>{if(e.target===e.currentTarget){e.currentTarget.close();return}const b=e.target.closest('[data-pref-system]');if(!b)return;const p=recPrefs(),s=b.dataset.prefSystem,systems=p.systems.includes(s)?p.systems.filter(x=>x!==s):[...p.systems,s];CheckpointPlay.setPrefs({systems});$(`#recPrefsSystems [data-pref-system="${CSS.escape(s)}"]`)?.focus()});
$("#forYouFocus").onchange=e=>{CheckpointPlay.setPrefs({mode:e.target.value});toast(`Suggestions now: ${e.target.selectedOptions[0].textContent.toLowerCase()}`);$("#forYouFocus").focus()};
$("#recPrefsDialog").addEventListener('change',e=>{if(e.target.id==='recFocusSystem')CheckpointPlay.setPrefs({focusSystem:e.target.value});if(e.target.name==='recMode')CheckpointPlay.setPrefs({mode:e.target.value});if(e.target.id==='recPrefsGaps')CheckpointPlay.setPrefs({hideGaps:e.target.checked});if(e.target.id==='recPrefsSpoilers')CheckpointPlay.setPrefs({hideSpoilers:e.target.checked})});
renderAll();route(location.hash.slice(1)||'dashboard',{scroll:false});
