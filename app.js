const STORAGE={library:"checkpoint.library.v1",progress:"checkpoint.progress.v1",dismissed:"checkpoint.dismissed.v1"};
const COLORS=["#5968b8","#9f596b","#2c8a73","#ad7741","#71599f","#3f789e","#9b4f91","#697942"];
const SERIES=[
  {name:"Final Fantasy",entries:[
    ["Final Fantasy I",["final fantasy","final fantasy i","final fantasy 1"]],
    ["Final Fantasy II",["final fantasy ii","final fantasy 2"]],
    ["Final Fantasy III",["final fantasy iii","final fantasy 3"]],
    ["Final Fantasy IV",["final fantasy iv","final fantasy 4"]],
    ["Final Fantasy V",["final fantasy v","final fantasy 5"]],
    ["Final Fantasy VI",["final fantasy vi","final fantasy 6","final fantasy iii snes"]],
    ["Final Fantasy VII",["final fantasy vii","final fantasy 7"]],
    ["Final Fantasy VIII",["final fantasy viii","final fantasy 8"]],
    ["Final Fantasy IX",["final fantasy ix","final fantasy 9"]],
    ["Final Fantasy X",["final fantasy x","final fantasy 10"]]
  ]},
  {name:"Metroid",entries:[
    ["Metroid",["metroid"]],["Metroid II: Return of Samus",["metroid ii return of samus","metroid 2 return of samus"]],
    ["Super Metroid",["super metroid","metroid 3"]],["Metroid Fusion",["metroid fusion","metroid 4"]],
    ["Metroid: Zero Mission",["metroid zero mission"]]
  ]},
  {name:"The Legend of Zelda",entries:[
    ["The Legend of Zelda",["the legend of zelda","legend of zelda"]],["Zelda II: The Adventure of Link",["zelda ii the adventure of link","zelda 2 the adventure of link"]],
    ["The Legend of Zelda: A Link to the Past",["the legend of zelda a link to the past","zelda a link to the past"]],
    ["The Legend of Zelda: Link's Awakening",["the legend of zelda link s awakening","zelda link s awakening"]],
    ["The Legend of Zelda: Ocarina of Time",["the legend of zelda ocarina of time","zelda ocarina of time"]],
    ["The Legend of Zelda: Majora's Mask",["the legend of zelda majora s mask","zelda majora s mask"]]
  ]},
  {name:"Classic Mario",entries:[
    ["Super Mario Bros.",["super mario bros"]],["Super Mario Bros. 2",["super mario bros 2"]],
    ["Super Mario Bros. 3",["super mario bros 3"]],["Super Mario World",["super mario world"]],
    ["Super Mario 64",["super mario 64"]]
  ]}
];
const DEMO={format:"checkpoint-inventory",version:1,generatedAt:new Date().toISOString(),games:[
  {id:"demo-ff3",title:"Final Fantasy III",normalizedTitle:"final fantasy iii",platform:"SNES",files:[{relativePath:"snes/Final Fantasy III (USA).sfc"}]},
  {id:"demo-ff4",title:"Final Fantasy IV",normalizedTitle:"final fantasy iv",platform:"SNES",files:[{relativePath:"snes/Final Fantasy IV (USA).sfc"}]},
  {id:"demo-metroid",title:"Metroid: Zero Mission",normalizedTitle:"metroid zero mission",platform:"GBA",files:[{relativePath:"gba/Metroid - Zero Mission (USA).gba"}]},
  {id:"demo-mario",title:"Super Mario World",normalizedTitle:"super mario world",platform:"SNES",files:[{relativePath:"snes/Super Mario World (USA).sfc"}]},
  {id:"demo-zelda",title:"The Legend of Zelda: A Link to the Past",normalizedTitle:"the legend of zelda a link to the past",platform:"SNES",files:[{relativePath:"snes/Zelda - A Link to the Past (USA).sfc"}]},
  {id:"demo-ape",title:"Ape Escape",normalizedTitle:"ape escape",platform:"PS1",files:[{relativePath:"psx/Ape Escape.chd"}]}
]};
let library=read(STORAGE.library,[]),progress=read(STORAGE.progress,{}),dismissed=read(STORAGE.dismissed,[]),activeGameId=null;
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
function read(key,fallback){try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}}
function write(key,value){localStorage.setItem(key,JSON.stringify(value))}
function norm(value=""){return value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g," ").trim()}
function initials(title){return title.split(/\s+/).filter(Boolean).slice(0,3).map(x=>x[0]).join("").toUpperCase()}
function colorFor(game){let n=[...game.title].reduce((a,c)=>a+c.charCodeAt(0),0);return COLORS[n%COLORS.length]}
const ART_SYSTEMS={NES:"Nintendo - Nintendo Entertainment System",SNES:"Nintendo - Super Nintendo Entertainment System",GB:"Nintendo - Game Boy",GBC:"Nintendo - Game Boy Color",GBA:"Nintendo - Game Boy Advance",N64:"Nintendo - Nintendo 64",NDS:"Nintendo - Nintendo DS",'3DS':"Nintendo - Nintendo 3DS",PS1:"Sony - PlayStation",PSP:"Sony - PlayStation Portable"};
function artSafe(value){return value.replace(/[&*/:`<>?\\|]/g,"_")}
function coverCandidates(game){const system=ART_SYSTEMS[game.platform];if(!system)return[];const file=game.files?.[0]?.filename||game.files?.[0]?.relativePath?.split('/').pop()||'';const stem=file.replace(/\.[^.]+$/,'').replace(/\s+(?:Track|trk)\s*\d+$/i,'');const names=[stem,game.title].filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i);return names.map(name=>`https://thumbnails.libretro.com/${encodeURIComponent(system)}/Named_Boxarts/${encodeURIComponent(artSafe(name))}.png`)}
function coverArt(game){const candidates=coverCandidates(game);return candidates.length?`<img class="cover-art" alt="" src="${candidates[0]}" data-candidates="${encodeURIComponent(JSON.stringify(candidates))}" data-index="0">`:''}
function bindArt(){$$('img[data-candidates]').forEach(img=>img.onerror=()=>{const list=JSON.parse(decodeURIComponent(img.dataset.candidates));const next=Number(img.dataset.index)+1;if(next<list.length){img.dataset.index=next;img.src=list[next]}else img.hidden=true})}
function stateFor(id){return progress[id]||{status:"backlog",percent:0,notes:""}}
function saveState(id,state){progress[id]=state;write(STORAGE.progress,progress);renderAll()}
function toast(message){const el=$("#toast");el.textContent=message;el.classList.add("show");clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove("show"),2600)}
function route(name){$$('.view').forEach(v=>v.classList.toggle('active',v.dataset.view===name));$$('[data-route]').forEach(b=>b.classList.toggle('active',b.classList.contains('nav-button')&&b.dataset.route===name));window.scrollTo({top:0,behavior:'smooth'});if(name==='library')renderLibrary();if(name==='recommendations')renderRecommendations()}
function validateInventory(data){if(!data||data.format!=="checkpoint-inventory"||!Number.isInteger(data.version)||!Array.isArray(data.games))throw new Error("This is not a supported Checkpoint inventory file.");if(data.version!==1)throw new Error(`Inventory version ${data.version} is not supported yet.`);return data}
function mergeInventory(data){validateInventory(data);const old=new Map(library.map(g=>[g.id,g]));let added=0;for(const raw of data.games){if(!raw.title||!raw.platform)continue;const fallback=`${raw.platform}:${norm(raw.normalizedTitle||raw.title)}`;let game={...raw,id:raw.id||fallback,normalizedTitle:raw.normalizedTitle||norm(raw.title),importedAt:new Date().toISOString()};if(old.has(game.id))game={...old.get(game.id),...game,importedAt:old.get(game.id).importedAt||game.importedAt};else added++;old.set(game.id,game)}library=[...old.values()];write(STORAGE.library,library);renderAll();toast(`${added} new game${added===1?'':'s'} added • ${library.length} total`);route('dashboard')}
async function importFile(file){try{mergeInventory(JSON.parse(await file.text()))}catch(error){toast(error.message)}}
function triggerImport(){$("#inventoryInput").click()}
function stats(){const values=Object.values(progress);return{total:library.length,playing:library.filter(g=>stateFor(g.id).status==='playing').length,beaten:library.filter(g=>stateFor(g.id).status==='beaten').length,systems:new Set(library.map(g=>g.platform)).size}}
function recommendations(){const owned=new Set(library.map(g=>norm(g.normalizedTitle||g.title))),out=[];for(const series of SERIES){const indexes=[];series.entries.forEach((entry,i)=>{if(entry[1].some(alias=>owned.has(norm(alias))))indexes.push(i)});if(!indexes.length)continue;const highest=Math.max(...indexes);for(let i=0;i<highest;i++){const [title,aliases]=series.entries[i];const key=`${series.name}:${title}`;if(!aliases.some(a=>owned.has(norm(a)))&&!dismissed.includes(key))out.push({key,title,series:series.name,reason:`Fills the gap before ${series.entries[highest][0]}`,kind:'earlier'})}const next=series.entries[highest+1];if(next){const [title]=next,key=`${series.name}:${title}`;if(!dismissed.includes(key))out.push({key,title,series:series.name,reason:`Continues after ${series.entries[highest][0]}`,kind:'next'})}}return out}
function renderDashboard(){const has=library.length>0;$("#dashboardContent").classList.toggle('hidden',!has);$('.hero').classList.toggle('hidden',has);if(!has)return;const s=stats();$("#stats").innerHTML=[[s.total,'Games owned','Inventory'],[s.playing,'Playing now','Keep going'],[s.beaten,'Games beaten','Finished'],[s.systems,'Consoles','Detected']].map(([n,l,e])=>`<div class="stat"><span>${l}</span><strong>${n}</strong><em>${e}</em></div>`).join('');const playing=library.find(g=>stateFor(g.id).status==='playing')||library[0],ps=stateFor(playing.id);$("#continuePlaying").innerHTML=`<div class="continue-card" data-game="${playing.id}"><div class="mini-cover" style="--cover:${colorFor(playing)}">${initials(playing.title)}${coverArt(playing)}</div><div><h4>${escapeHtml(playing.title)}</h4><span class="muted">${playing.platform} • ${ps.status==='backlog'?'Ready to start':ps.status}</span><div class="progress-track"><i style="width:${ps.percent}%"></i></div></div><strong>${ps.percent}%</strong></div>`;const rec=recommendations()[0];$("#recommendationPreview").innerHTML=rec?`<div class="rec-preview"><p class="eyebrow">${rec.series}</p><strong>${escapeHtml(rec.title)}</strong><p>${escapeHtml(rec.reason)}. You can dismiss any suggestion that does not fit your goals.</p></div>`:`<div class="rec-preview"><strong>Your known series are caught up.</strong><p>Add more games or import another scan to uncover new paths.</p></div>`;$("#recentGames").innerHTML=library.slice(-6).reverse().map(miniGame).join('');bindArt();bindGameClicks()}
function miniGame(g){return`<div class="mini-game" data-game="${g.id}"><div class="cover" style="--cover:${colorFor(g)}">${initials(g.title)}${coverArt(g)}</div><b>${escapeHtml(g.title)}</b><small>${g.platform}</small></div>`}
function renderLibrary(){const q=norm($("#searchInput").value),platform=$("#platformFilter").value,status=$("#statusFilter").value;const filtered=library.filter(g=>(!q||norm(g.title).includes(q))&&(platform==='all'||g.platform===platform)&&(status==='all'||stateFor(g.id).status===status));$("#librarySubtitle").textContent=library.length?`${library.length} games across ${new Set(library.map(g=>g.platform)).size} consoles`:'Import your scanner inventory to begin.';$("#libraryGrid").innerHTML=filtered.map(g=>{const s=stateFor(g.id);return`<article class="game-card" data-game="${g.id}"><div class="cover" style="--cover:${colorFor(g)}"><span class="platform-tag">${g.platform}</span><span class="status-dot ${s.status}"></span>${initials(g.title)}${coverArt(g)}</div><div class="game-info"><h3>${escapeHtml(g.title)}</h3><p>${s.status.replace('-',' ')}</p><div class="progress-track"><i style="width:${s.percent}%"></i></div></div></article>`}).join('');$("#libraryEmpty").classList.toggle('hidden',library.length>0);bindArt();bindGameClicks()}
function renderPlatforms(){const current=$("#platformFilter").value;$("#platformFilter").innerHTML='<option value="all">All platforms</option>'+[...new Set(library.map(g=>g.platform))].sort().map(p=>`<option value="${p}">${p}</option>`).join('');$("#platformFilter").value=[...$("#platformFilter").options].some(o=>o.value===current)?current:'all'}
function renderRecommendations(){const recs=recommendations();$("#recommendationList").innerHTML=recs.map(r=>`<article class="recommendation-card"><div class="rec-icon">${r.kind==='earlier'?'↶':'→'}</div><div><p class="eyebrow">${r.series}</p><h3>${escapeHtml(r.title)}</h3><p>${escapeHtml(r.reason)}</p><div class="reason">Why: you own a later entry in this series</div></div><button class="dismiss" data-dismiss="${escapeHtml(r.key)}">Dismiss</button></article>`).join('');$("#recommendationEmpty").classList.toggle('hidden',recs.length>0);$$('[data-dismiss]').forEach(b=>b.onclick=()=>{dismissed.push(b.dataset.dismiss);write(STORAGE.dismissed,dismissed);renderAll();toast('Suggestion dismissed')})}
function renderAll(){renderPlatforms();renderDashboard();renderLibrary();renderRecommendations()}
function bindGameClicks(){$$('[data-game]').forEach(el=>el.onclick=()=>openGame(el.dataset.game))}
function openGame(id){const game=library.find(g=>g.id===id);if(!game)return;activeGameId=id;const s=stateFor(id);$("#dialogPlatform").textContent=game.platform;$("#dialogTitle").textContent=game.title;$("#dialogPath").textContent=game.files?.[0]?.relativePath||'Imported game';$("#dialogStatus").value=s.status;$("#dialogProgress").value=s.percent;$("#progressOutput").value=`${s.percent}%`;$("#dialogNotes").value=s.notes;$("#guideLink").href=`https://www.google.com/search?q=${encodeURIComponent(game.title+' walkthrough guide')}`;$("#gameDialog").showModal()}
function exportBackup(){const blob=new Blob([JSON.stringify({format:'checkpoint-backup',version:1,exportedAt:new Date().toISOString(),library,progress,dismissed},null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='checkpoint-backup.json';a.click();URL.revokeObjectURL(a.href);toast('Backup downloaded')}
function escapeHtml(s=''){return s.replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
$$('[data-route]').forEach(b=>b.addEventListener('click',()=>route(b.dataset.route)));
['#importButton','#heroImportButton','#libraryImportButton','#emptyImportButton'].forEach(id=>$(id).onclick=triggerImport);
$("#inventoryInput").onchange=e=>{if(e.target.files[0])importFile(e.target.files[0]);e.target.value=''};
$("#demoButton").onclick=()=>mergeInventory(DEMO);$("#backupButton").onclick=exportBackup;
$("#searchInput").oninput=renderLibrary;$("#platformFilter").onchange=renderLibrary;$("#statusFilter").onchange=renderLibrary;
$("#dialogProgress").oninput=e=>$("#progressOutput").value=`${e.target.value}%`;
$("#saveGameButton").onclick=()=>{if(!activeGameId)return;saveState(activeGameId,{status:$("#dialogStatus").value,percent:Number($("#dialogProgress").value),notes:$("#dialogNotes").value.trim()});toast('Game progress saved')};
renderAll();
