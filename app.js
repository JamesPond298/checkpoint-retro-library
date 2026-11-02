const STORAGE={library:"checkpoint.library.v1",progress:"checkpoint.progress.v1",dismissed:"checkpoint.dismissed.v1"};
const COLORS=["#5968b8","#9f596b","#2c8a73","#ad7741","#71599f","#3f789e","#9b4f91","#697942"];
const PLATFORM_NAMES={NES:"Nintendo Entertainment System",SNES:"Super Nintendo",GB:"Game Boy",GBC:"Game Boy Color",GBA:"Game Boy Advance",N64:"Nintendo 64",NDS:"Nintendo DS",'3DS':"Nintendo 3DS",MASTER_SYSTEM:"Sega Master System",GENESIS:"Sega Genesis / Mega Drive",SEGA_CD:"Sega CD",SATURN:"Sega Saturn",DREAMCAST:"Sega Dreamcast",ARCADE_CPS1:"Arcade — CPS-1",ARCADE_CPS2:"Arcade — CPS-2",ARCADE_CPS3:"Arcade — CPS-3",ARCADE_FBNEO:"Arcade — FinalBurn Neo",ARCADE_MAME:"Arcade — MAME",NEOGEO:"Neo Geo",NGP:"Neo Geo Pocket",OPENBOR:"OpenBOR",MSX2:"MSX2 / MSX2+",PCENGINE:"PC Engine / TurboGrafx-16",WONDERSWAN_COLOR:"WonderSwan Color",PS1:"PlayStation",PS2:"PlayStation 2",PS3:"PlayStation 3",PSP:"PSP",WII_GC:"Wii / GameCube"};
const LIBRARY_PAGE_SIZE=120;
const E=(title,aliases=[])=>({title,aliases:[title,...aliases]});
const SERIES=[
  {name:"Final Fantasy — Main Series",systems:["NES","SNES","PS1","PS2","PSP","NDS","GBA"],entries:[E("Final Fantasy I",["Final Fantasy","Final Fantasy 1"]),E("Final Fantasy II",["Final Fantasy 2"]),E("Final Fantasy III",["Final Fantasy 3"]),E("Final Fantasy IV",["Final Fantasy 4","Final Fantasy II SNES"]),E("Final Fantasy V",["Final Fantasy 5"]),E("Final Fantasy VI",["Final Fantasy 6","Final Fantasy III SNES"]),E("Final Fantasy VII",["Final Fantasy 7"]),E("Final Fantasy VIII",["Final Fantasy 8"]),E("Final Fantasy IX",["Final Fantasy 9"]),E("Final Fantasy X",["Final Fantasy 10"]),E("Final Fantasy XII",["Final Fantasy 12"])]},
  {name:"Sonic — Classic",systems:["MASTER_SYSTEM","GENESIS","SEGA_CD"],entries:[E("Sonic the Hedgehog",["Sonic 1"]),E("Sonic the Hedgehog 2",["Sonic 2"]),E("Sonic CD"),E("Sonic the Hedgehog 3",["Sonic 3"]),E("Sonic & Knuckles",["Sonic and Knuckles"])]},
  {name:"Sonic — Adventure Era",systems:["DREAMCAST","WII_GC","PS2","PS3","PSP"],entries:[E("Sonic Adventure"),E("Sonic Adventure 2"),E("Sonic Heroes"),E("Shadow the Hedgehog"),E("Sonic the Hedgehog",["Sonic 06"]),E("Sonic Unleashed"),E("Sonic Colors"),E("Sonic Generations")]},
  {name:"Metroid",systems:["NES","GB","SNES","GBA","WII_GC"],entries:[E("Metroid"),E("Metroid II: Return of Samus",["Metroid 2 Return of Samus"]),E("Super Metroid",["Metroid 3"]),E("Metroid Fusion",["Metroid 4"]),E("Metroid: Zero Mission"),E("Metroid Prime"),E("Metroid Prime 2: Echoes"),E("Metroid Prime 3: Corruption")]},
  {name:"The Legend of Zelda",systems:["NES","GB","GBC","SNES","N64","GBA","NDS","3DS","WII_GC"],entries:[E("The Legend of Zelda",["Legend of Zelda"]),E("Zelda II: The Adventure of Link",["Zelda 2 The Adventure of Link"]),E("The Legend of Zelda: A Link to the Past",["Zelda A Link to the Past"]),E("The Legend of Zelda: Link's Awakening",["Zelda Link's Awakening"]),E("The Legend of Zelda: Ocarina of Time",["Zelda Ocarina of Time"]),E("The Legend of Zelda: Majora's Mask",["Zelda Majora's Mask"]),E("The Legend of Zelda: The Wind Waker",["Zelda The Wind Waker"]),E("The Legend of Zelda: Twilight Princess",["Zelda Twilight Princess"]),E("The Legend of Zelda: Skyward Sword",["Zelda Skyward Sword"])]},
  {name:"Super Mario — Classic",systems:["NES","SNES","GB","N64"],entries:[E("Super Mario Bros."),E("Super Mario Bros. 2"),E("Super Mario Bros. 3"),E("Super Mario Land"),E("Super Mario World"),E("Super Mario Land 2: 6 Golden Coins"),E("Super Mario 64")]},
  {name:"Mega Man — NES",systems:["NES"],entries:[1,2,3,4,5,6].map(n=>E(`Mega Man ${n}`))},
  {name:"Mega Man X — SNES",systems:["SNES"],entries:[E("Mega Man X"),E("Mega Man X2"),E("Mega Man X3")]},
  {name:"Mega Man Battle Network",systems:["GBA"],entries:[1,2,3,4,5,6].map(n=>E(`Mega Man Battle Network ${n}`))},
  {name:"Castlevania — Classic",systems:["NES","GB","SNES","GBA","NDS","PS1"],entries:[E("Castlevania"),E("Castlevania II: Simon's Quest"),E("Castlevania III: Dracula's Curse"),E("Super Castlevania IV"),E("Castlevania: Symphony of the Night"),E("Castlevania: Circle of the Moon"),E("Castlevania: Harmony of Dissonance"),E("Castlevania: Aria of Sorrow")]},
  {name:"Donkey Kong Country",systems:["SNES","GBA","WII_GC"],entries:[E("Donkey Kong Country"),E("Donkey Kong Country 2: Diddy's Kong Quest"),E("Donkey Kong Country 3: Dixie Kong's Double Trouble!"),E("Donkey Kong Country Returns")]},
  {name:"Dragon Quest — Classic",systems:["NES","SNES","GBC","NDS"],entries:[E("Dragon Quest I",["Dragon Warrior"]),E("Dragon Quest II",["Dragon Warrior II"]),E("Dragon Quest III",["Dragon Warrior III"]),E("Dragon Quest IV",["Dragon Warrior IV"]),E("Dragon Quest V"),E("Dragon Quest VI")]},
  {name:"Resident Evil — Classic",systems:["PS1","DREAMCAST","WII_GC","PS2"],entries:[E("Resident Evil"),E("Resident Evil 2"),E("Resident Evil 3: Nemesis"),E("Resident Evil Code: Veronica",["Resident Evil Code Veronica"]),E("Resident Evil 0",["Resident Evil Zero"]),E("Resident Evil 4")]},
  {name:"Crash Bandicoot — PS1",systems:["PS1"],entries:[E("Crash Bandicoot"),E("Crash Bandicoot 2: Cortex Strikes Back"),E("Crash Bandicoot: Warped",["Crash Bandicoot 3 Warped"])]},
  {name:"Spyro — PS1",systems:["PS1"],entries:[E("Spyro the Dragon"),E("Spyro 2: Ripto's Rage!",["Spyro 2 Gateway to Glimmer"]),E("Spyro: Year of the Dragon",["Spyro 3 Year of the Dragon"])]},
  {name:"Tekken",systems:["PS1","PS2","PSP"],entries:[E("Tekken"),E("Tekken 2"),E("Tekken 3"),E("Tekken Tag Tournament"),E("Tekken 4"),E("Tekken 5"),E("Tekken 6")]},
  {name:"Tony Hawk's Pro Skater — PS1",systems:["PS1"],entries:[1,2,3,4].map(n=>E(`Tony Hawk's Pro Skater ${n}`))},
  {name:"Wario Land",systems:["GB","GBC","GBA"],entries:[E("Wario Land: Super Mario Land 3"),E("Wario Land II"),E("Wario Land 3"),E("Wario Land 4")]},
  {name:"Kirby",systems:["GB","NES","SNES","N64","GBA","NDS","WII_GC","3DS"],entries:[E("Kirby's Dream Land"),E("Kirby's Adventure"),E("Kirby's Dream Land 2"),E("Kirby Super Star"),E("Kirby's Dream Land 3"),E("Kirby 64: The Crystal Shards"),E("Kirby Air Ride"),E("Kirby's Epic Yarn"),E("Kirby's Return to Dream Land")]},
  {name:"Ninja Gaiden — NES",systems:["NES"],entries:[E("Ninja Gaiden"),E("Ninja Gaiden II: The Dark Sword of Chaos"),E("Ninja Gaiden III: The Ancient Ship of Doom")]},
  {name:"Double Dragon — NES",systems:["NES"],entries:[E("Double Dragon"),E("Double Dragon II: The Revenge"),E("Double Dragon III: The Sacred Stones")]},
  {name:"Golden Sun",systems:["GBA","NDS"],entries:[E("Golden Sun"),E("Golden Sun: The Lost Age"),E("Golden Sun: Dark Dawn")]},
  {name:"Advance Wars",systems:["GBA","NDS"],entries:[E("Advance Wars"),E("Advance Wars 2: Black Hole Rising"),E("Advance Wars: Dual Strike"),E("Advance Wars: Days of Ruin")]},
  {name:"EarthBound / Mother",systems:["NES","SNES","GBA"],entries:[E("Mother",["EarthBound Beginnings"]),E("EarthBound",["Mother 2"]),E("Mother 3")]},
  {name:"F-Zero",systems:["SNES","N64","GBA","WII_GC"],entries:[E("F-Zero"),E("F-Zero X"),E("F-Zero: Maximum Velocity"),E("F-Zero GX"),E("F-Zero: GP Legend"),E("F-Zero Climax")]},
  {name:"Star Fox",systems:["SNES","N64","NDS","WII_GC"],entries:[E("Star Fox"),E("Star Fox 2"),E("Star Fox 64"),E("Star Fox Adventures"),E("Star Fox: Assault"),E("Star Fox Command")]},
  {name:"Fire Emblem",systems:["NES","SNES","GBA","NDS","WII_GC","3DS"],entries:[E("Fire Emblem: Shadow Dragon and the Blade of Light"),E("Fire Emblem Gaiden"),E("Fire Emblem: Mystery of the Emblem"),E("Fire Emblem: Genealogy of the Holy War"),E("Fire Emblem: Thracia 776"),E("Fire Emblem: The Binding Blade"),E("Fire Emblem",["Fire Emblem The Blazing Blade"]),E("Fire Emblem: The Sacred Stones"),E("Fire Emblem: Path of Radiance"),E("Fire Emblem: Radiant Dawn"),E("Fire Emblem: Shadow Dragon"),E("Fire Emblem: New Mystery of the Emblem"),E("Fire Emblem Awakening"),E("Fire Emblem Fates") ]},
  {name:"Pokémon — Main Series",systems:["GB","GBC","GBA","NDS","3DS"],entries:[E("Pokémon Red",["Pokemon Red Version"]),E("Pokémon Blue",["Pokemon Blue Version"]),E("Pokémon Yellow",["Pokemon Yellow Version"]),E("Pokémon Gold",["Pokemon Gold Version"]),E("Pokémon Silver",["Pokemon Silver Version"]),E("Pokémon Crystal",["Pokemon Crystal Version"]),E("Pokémon Ruby",["Pokemon Ruby Version"]),E("Pokémon Sapphire",["Pokemon Sapphire Version"]),E("Pokémon Emerald",["Pokemon Emerald Version"]),E("Pokémon FireRed",["Pokemon FireRed Version"]),E("Pokémon LeafGreen",["Pokemon LeafGreen Version"]),E("Pokémon Diamond",["Pokemon Diamond Version"]),E("Pokémon Pearl",["Pokemon Pearl Version"]),E("Pokémon Platinum",["Pokemon Platinum Version"]),E("Pokémon X",["Pokemon X"]),E("Pokémon Y",["Pokemon Y"]),E("Pokémon Omega Ruby",["Pokemon Omega Ruby"]),E("Pokémon Alpha Sapphire",["Pokemon Alpha Sapphire"]),E("Pokémon Sun",["Pokemon Sun"]),E("Pokémon Moon",["Pokemon Moon"]),E("Pokémon Ultra Sun",["Pokemon Ultra Sun"]),E("Pokémon Ultra Moon",["Pokemon Ultra Moon"])]},
  {name:"Mario Kart",systems:["SNES","N64","GBA","NDS","WII_GC","3DS"],entries:[E("Super Mario Kart"),E("Mario Kart 64"),E("Mario Kart: Super Circuit"),E("Mario Kart: Double Dash!!",["Mario Kart Double Dash"]),E("Mario Kart DS"),E("Mario Kart Wii"),E("Mario Kart 7")]},
  {name:"Mario Party",systems:["N64","NDS","WII_GC","3DS"],entries:[E("Mario Party"),E("Mario Party 2"),E("Mario Party 3"),E("Mario Party 4"),E("Mario Party 5"),E("Mario Party 6"),E("Mario Party 7"),E("Mario Party 8"),E("Mario Party DS"),E("Mario Party: Island Tour")]},
  {name:"Paper Mario",systems:["N64","WII_GC","3DS"],entries:[E("Paper Mario"),E("Paper Mario: The Thousand-Year Door"),E("Super Paper Mario"),E("Paper Mario: Sticker Star")]},
  {name:"Yoshi",systems:["SNES","GB","GBA","N64","NDS"],entries:[E("Super Mario World 2: Yoshi's Island",["Yoshi's Island"]),E("Yoshi's Story"),E("Yoshi Topsy-Turvy",["Yoshi's Universal Gravitation"]),E("Yoshi's Island DS")]},
  {name:"Mario & Luigi",systems:["GBA","NDS"],entries:[E("Mario & Luigi: Superstar Saga"),E("Mario & Luigi: Partners in Time"),E("Mario & Luigi: Bowser's Inside Story")]},
  {name:"Super Smash Bros.",systems:["N64","WII_GC","3DS"],entries:[E("Super Smash Bros."),E("Super Smash Bros. Melee",["Super Smash Bros. Melee"]),E("Super Smash Bros. Brawl"),E("Super Smash Bros. for Nintendo 3DS")]},
  {name:"Animal Crossing",systems:["N64","WII_GC","NDS","3DS"],entries:[E("Doubutsu no Mori",["Animal Forest"]),E("Animal Crossing"),E("Animal Crossing: Wild World"),E("Animal Crossing: City Folk",["Animal Crossing Let's Go to the City"]),E("Animal Crossing: New Leaf")]},
  {name:"Kid Icarus",systems:["NES","GB","3DS"],entries:[E("Kid Icarus"),E("Kid Icarus: Of Myths and Monsters"),E("Kid Icarus: Uprising")]},
  {name:"Punch-Out!!",systems:["NES","SNES"],entries:[E("Punch-Out!!",["Mike Tyson's Punch-Out!!"]),E("Super Punch-Out!!")]},
  {name:"Pilotwings",systems:["SNES","N64","3DS"],entries:[E("Pilotwings"),E("Pilotwings 64"),E("Pilotwings Resort")]},
  {name:"WarioWare",systems:["GBA","NDS"],entries:[E("WarioWare, Inc.: Mega Microgame$!"),E("WarioWare: Twisted!"),E("WarioWare: Touched!"),E("WarioWare: D.I.Y.")]},
  {name:"Mario Golf",systems:["N64","GBC","GBA","WII_GC","3DS"],entries:[E("Mario Golf"),E("Mario Golf: Toadstool Tour"),E("Mario Golf: Advance Tour"),E("Mario Golf: World Tour")]},
  {name:"Mario Tennis",systems:["N64","GBC","GBA","WII_GC","3DS"],entries:[E("Mario Tennis"),E("Mario Power Tennis"),E("Mario Tennis: Power Tour"),E("Mario Tennis Open")]},
  {name:"Pokémon Mystery Dungeon",systems:["GBA","NDS"],entries:[E("Pokémon Mystery Dungeon: Red Rescue Team",["Pokemon Mystery Dungeon Red Rescue Team"]),E("Pokémon Mystery Dungeon: Blue Rescue Team",["Pokemon Mystery Dungeon Blue Rescue Team"]),E("Pokémon Mystery Dungeon: Explorers of Time",["Pokemon Mystery Dungeon Explorers of Time"]),E("Pokémon Mystery Dungeon: Explorers of Darkness",["Pokemon Mystery Dungeon Explorers of Darkness"]),E("Pokémon Mystery Dungeon: Explorers of Sky",["Pokemon Mystery Dungeon Explorers of Sky"])]},
  {name:"Pokémon Ranger",systems:["NDS"],entries:[E("Pokémon Ranger",["Pokemon Ranger"]),E("Pokémon Ranger: Shadows of Almia",["Pokemon Ranger Shadows of Almia"]),E("Pokémon Ranger: Guardian Signs",["Pokemon Ranger Guardian Signs"])]},
  {name:"Rhythm Heaven",systems:["GBA","NDS"],entries:[E("Rhythm Tengoku"),E("Rhythm Heaven",["Rhythm Paradise"])]},
  {name:"Custom Robo",systems:["N64","GBA","NDS"],entries:[E("Custom Robo"),E("Custom Robo V2"),E("Custom Robo GX"),E("Custom Robo Arena")]},
  {name:"Wave Race",systems:["GB","N64","WII_GC"],entries:[E("Wave Race"),E("Wave Race 64"),E("Wave Race: Blue Storm")]},
  {name:"Contra",systems:["NES","SNES","GENESIS","GBA","NDS","OPENBOR"],entries:[E("Contra"),E("Super C"),E("Contra III: The Alien Wars"),E("Contra: Hard Corps",["Contra Hard Corps"]),E("Contra Advance: The Alien Wars EX"),E("Contra 4")]},
  {name:"LEGO Games",systems:["GBC","GBA","NDS","3DS","PS1","PS2","PS3","PSP","WII_GC"],entries:[E("LEGO Racers"),E("LEGO Racers 2"),E("LEGO Alpha Team"),E("LEGO Island 2: The Brickster's Revenge",["Lego Island 2","Lego Island 2 The Brickster's Revenge"]),E("LEGO Bionicle",["Lego Bionicle","Bionicle"]),E("LEGO Soccer Mania"),E("LEGO Star Wars: The Video Game",["LEGO Star Wars The Video Game"]),E("LEGO Star Wars II: The Original Trilogy",["LEGO Star Wars 2","LEGO Star Wars II The Original Trilogy"]),E("LEGO Star Wars: The Complete Saga",["LEGO Star Wars The Complete Saga"]),E("LEGO Batman: The Videogame",["LEGO Batman","LEGO Batman USA PSP pSyPSP"]),E("LEGO Batman 2: DC Super Heroes",["LEGO Batman 2 DC Super Heroes"]),E("LEGO Indiana Jones: The Original Adventures",["LEGO Indiana Jones The Original Adventures","Lego Indiana Jones USA PSP EXTRAS"]),E("LEGO Indiana Jones 2: The Adventure Continues",["LEGO Indiana Jones 2 The Adventure Continues"]),E("LEGO Harry Potter: Years 1-4",["LEGO Harry Potter Years 1 4"]),E("LEGO Harry Potter: Years 5-7",["LEGO Harry Potter Years 5 7"]),E("LEGO Marvel Super Heroes: Universe in Peril",["LEGO Marvel Super Heroes Universe in Peril"]),E("LEGO Star Wars III: The Clone Wars",["LEGO Star Wars III The Clone Wars"])]},
  {name:"Street Fighter",systems:["GB","GBA","GBC","MASTER_SYSTEM","GENESIS","SNES","PS1","PS2","PSP","ARCADE_CPS1","ARCADE_CPS2","ARCADE_CPS3","ARCADE_FBNEO","ARCADE_MAME"],entries:[E("Street Fighter"),E("Street Fighter II",["Street Fighter 2"]),E("Street Fighter II Turbo",["Street Fighter 2 Turbo"]),E("Super Street Fighter II"),E("Street Fighter Alpha"),E("Street Fighter Alpha 2"),E("Street Fighter Alpha 3"),E("Street Fighter III: 3rd Strike",["Street Fighter III 3rd Strike"])]},
  {name:"Mortal Kombat",systems:["GB","GBA","GBC","GENESIS","SNES","N64","PS1","PS2","PSP"],entries:[E("Mortal Kombat",["Mortal Kombat 1"]),E("Mortal Kombat II",["Mortal Kombat 2"]),E("Mortal Kombat 3"),E("Ultimate Mortal Kombat 3"),E("Mortal Kombat 4"),E("Mortal Kombat: Deadly Alliance"),E("Mortal Kombat: Deception"),E("Mortal Kombat: Armageddon"),E("Mortal Kombat: Unchained")]},
  {name:"Metal Gear",systems:["MSX2","GBC","PS1","PS2","PS3","PSP"],entries:[E("Metal Gear"),E("Metal Gear 2: Solid Snake"),E("Metal Gear Solid"),E("Metal Gear Solid 2: Sons of Liberty"),E("Metal Gear Solid 3: Snake Eater"),E("Metal Gear Solid: Portable Ops"),E("Metal Gear Solid: Peace Walker")]},
  {name:"God of War",systems:["PS2","PS3","PSP"],entries:[E("God of War"),E("God of War II"),E("God of War: Chains of Olympus"),E("God of War III"),E("God of War: Ghost of Sparta")]},
  {name:"Grand Theft Auto",systems:["GBC","GBA","PS1","PS2","PSP"],entries:[E("Grand Theft Auto"),E("Grand Theft Auto 2"),E("Grand Theft Auto III"),E("Grand Theft Auto: Vice City"),E("Grand Theft Auto: San Andreas"),E("Grand Theft Auto: Liberty City Stories"),E("Grand Theft Auto: Vice City Stories"),E("Grand Theft Auto: Chinatown Wars")]},
  {name:"Dragon Ball",systems:["NES","SNES","GENESIS","GBA","NDS","PS1","PS2","PSP","WONDERSWAN_COLOR"],entries:[E("Dragon Ball Z: The Legacy of Goku"),E("Dragon Ball Z: The Legacy of Goku II"),E("Dragon Ball Z: Buu's Fury"),E("Dragon Ball Z: Supersonic Warriors"),E("Dragon Ball Z: Supersonic Warriors 2"),E("Dragon Ball Z: Budokai"),E("Dragon Ball Z: Budokai 2"),E("Dragon Ball Z: Budokai 3"),E("Dragon Ball Z: Budokai Tenkaichi"),E("Dragon Ball Z: Shin Budokai")]},
  {name:"Bomberman",systems:["NES","GB","GBC","GBA","SNES","GENESIS","N64","NDS","PCENGINE","SATURN","WII_GC"],entries:[E("Bomberman"),E("Bomberman II"),E("Super Bomberman"),E("Super Bomberman 2"),E("Super Bomberman 3"),E("Mega Bomberman"),E("Bomberman '93"),E("Bomberman 64"),E("Saturn Bomberman"),E("Bomberman Generation")]},
  {name:"Pac-Man",systems:["GB","GBC","GBA","NES","SNES","GENESIS","N64","PS1","PS2","PSP"],entries:[E("Pac-Man"),E("Ms. Pac-Man"),E("Pac-Mania"),E("Pac-Attack"),E("Pac-Man World"),E("Pac-Man World 2"),E("Pac-Man World 3"),E("Pac-Man Championship Edition")]},
  {name:"Rayman",systems:["GB","GBC","GBA","N64","PS1","PS2","PSP","NDS","3DS","WII_GC","DREAMCAST"],entries:[E("Rayman"),E("Rayman 2: The Great Escape"),E("Rayman 3: Hoodlum Havoc"),E("Rayman Advance"),E("Rayman: Hoodlums' Revenge"),E("Rayman Raving Rabbids"),E("Rayman Origins")]},
  {name:"Tomb Raider",systems:["GBC","PS1","PS2","PSP","WII_GC"],entries:[E("Tomb Raider"),E("Tomb Raider II"),E("Tomb Raider III"),E("Tomb Raider: The Last Revelation",["Tomb Raider 4"]),E("Tomb Raider: Chronicles",["Tomb Raider 5"]),E("Tomb Raider: Legend"),E("Tomb Raider: Anniversary"),E("Tomb Raider: Underworld")]},
  {name:"Star Wars",systems:["NES","SNES","GBA","NDS","N64","PS1","PS2","PSP","WII_GC"],entries:[E("Star Wars"),E("The Empire Strikes Back",["Star Wars The Empire Strikes Back"]),E("Super Star Wars"),E("Star Wars: Shadows of the Empire"),E("Star Wars Episode I: Racer"),E("Star Wars: Battlefront"),E("Star Wars: Battlefront II"),E("Star Wars: The Force Unleashed")]},
  {name:"Naruto",systems:["GBA","NDS","PS2","PSP","WII_GC","WONDERSWAN_COLOR"],entries:[E("Naruto: Ninja Council"),E("Naruto: Ninja Council 2"),E("Naruto: Ninja Council 3"),E("Naruto: Ultimate Ninja"),E("Naruto: Ultimate Ninja 2"),E("Naruto Shippuden: Ultimate Ninja Heroes 3")]}
];
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
function artKey(el){return el.dataset.artGame?`g:${el.dataset.artGame}`:`t:${el.dataset.artPlatforms}|${el.dataset.artTitle}`}
function coverInner(title,platform,key){const known=key&&loadedArt.get(key);return`${known?`<img class="art" alt="" src="${escapeHtml(known.src)}">`:''}<div class="cover-fallback"><span class="fallback-system">${escapeHtml(shortPlatform(platform))}</span><b>${escapeHtml(initials(title))}</b><span class="fallback-title">${escapeHtml(title)}</span></div>`}
function knownAttrs(key){const known=loadedArt.get(key);return known?` has-art${known.contain?' fit-contain':''}" data-art-bound="1" style="--art:url(&quot;${escapeHtml(known.src)}&quot;);`:'" style="'}
function cover(game,cls=''){const key=`g:${game.id}`;return`<div class="cover ${cls}${knownAttrs(key)}--cover:${colorFor(game)};--family:${familyColor(game.platform)}" data-art-game="${escapeHtml(game.id)}">${coverInner(game.title,game.platform,key)}</div>`}
function titleCover(title,platforms,cls=''){const p=platforms.join(','),key=`t:${p}|${title}`;return`<div class="cover ${cls}${knownAttrs(key)}--cover:${COLORS[title.length%COLORS.length]};--family:${familyColor(platforms[0])}" data-art-title="${escapeHtml(title)}" data-art-platforms="${escapeHtml(p)}">${coverInner(title,platforms[0],key)}</div>`}
function hydrateArt(root=document){root.querySelectorAll('[data-art-game]:not([data-art-bound]),[data-art-title]:not([data-art-bound])').forEach(el=>{el.dataset.artBound='1';artObserver?artObserver.observe(el):loadArt(el)})}
async function loadArt(el){
  let ref=null;
  try{
    if(el.dataset.artGame){const g=byId(el.dataset.artGame);if(!g)return;ref=await CheckpointArt.resolve(g)}
    else ref=await CheckpointArt.resolveTitle(el.dataset.artTitle,el.dataset.artPlatforms.split(','));
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
function route(name,{scroll=true}={}){if(!['dashboard','library','recommendations'].includes(name))name='dashboard';$$('.view').forEach(v=>v.classList.toggle('active',v.dataset.view===name));$$('.nav-button').forEach(b=>b.classList.toggle('active',b.dataset.route===name));if(location.hash!==`#${name}`)history.replaceState(null,'',`#${name}`);if(scroll)window.scrollTo({top:0,behavior:'smooth'});if(name==='library')renderLibrary();if(name==='recommendations')renderRecommendations()}

/* ---------------- import / export ---------------- */
function validateInventory(data){if(!data||data.format!=="checkpoint-inventory"||!Number.isInteger(data.version)||!Array.isArray(data.games))throw new Error("This is not a supported Checkpoint inventory file.");if(data.version!==1)throw new Error(`Inventory version ${data.version} is not supported yet.`);return data}
function mergeInventory(data){validateInventory(data);const old=new Map(library.map(g=>[g.id,g]));let added=0;const now=new Date().toISOString();for(const raw of data.games){if(!raw.title||!raw.platform)continue;const fallback=`${raw.platform}:${norm(raw.normalizedTitle||raw.title)}`;let game={...raw,id:raw.id||fallback,normalizedTitle:raw.normalizedTitle||norm(raw.title),importedAt:now};if(old.has(game.id)){const prev=old.get(game.id);if(fileOf(prev)!==fileOf(game))CheckpointArt.forget(game.id);game={...prev,...game,importedAt:prev.importedAt||now}}else added++;old.set(game.id,game)}library=[...old.values()];libraryVisibleCount=LIBRARY_PAGE_SIZE;write(STORAGE.library,library);renderAll();toast(`${added} new game${added===1?'':'s'} added • ${library.length} total`);route('dashboard')}
async function importFile(file){try{mergeInventory(JSON.parse(await file.text()))}catch(error){toast(error.message)}}
function exportBackup(){const blob=new Blob([JSON.stringify({format:'checkpoint-backup',version:1,exportedAt:new Date().toISOString(),library,progress,dismissed,art:CheckpointArt.exportOverrides()},null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='checkpoint-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);toast('Backup downloaded')}
async function restoreBackup(file){try{const data=JSON.parse(await file.text());if(data?.format!=='checkpoint-backup'||!Array.isArray(data.library))throw new Error('This is not a Checkpoint backup file.');if(!confirm(`Replace this browser's library with the backup (${data.library.length} games)?`))return;library=data.library;progress=data.progress||{};dismissed=data.dismissed||[];CheckpointArt.importOverrides(data.art);write(STORAGE.library,library);write(STORAGE.progress,progress);write(STORAGE.dismissed,dismissed);loadedArt.clear();renderAll();toast('Backup restored');route('dashboard')}catch(error){toast(error.message)}}
function triggerImport(){$("#inventoryInput").click()}

/* ---------------- series logic ---------------- */
let ownedIndex=null;
function buildOwnedIndex(){ownedIndex=new Map();for(const g of library){const k=norm(g.normalizedTitle||g.title);if(!ownedIndex.has(k))ownedIndex.set(k,[]);ownedIndex.get(k).push(g)}}
function ownedGame(entry,series){if(!ownedIndex)buildOwnedIndex();for(const alias of entry.aliases){const hit=(ownedIndex.get(norm(alias))||[]).find(g=>series.systems.includes(g.platform));if(hit)return hit}return null}
function seriesStatus(series){const owned=series.entries.map(entry=>ownedGame(entry,series)).filter(Boolean);return{owned,total:series.entries.length,percent:Math.round(owned.length/series.entries.length*100)}}
function seriesArtPlatforms(series){const mine=[...new Set(seriesStatus(series).owned.map(g=>g.platform))];return mine.length?mine:series.systems.slice(0,1)}
function recommendations(){const out=[];for(const series of SERIES){const indexes=[];series.entries.forEach((entry,i)=>{if(ownedGame(entry,series))indexes.push(i)});if(!indexes.length)continue;const highest=Math.max(...indexes);for(let i=0;i<highest;i++){const entry=series.entries[i],key=`${series.name}:${entry.title}`;if(!ownedGame(entry,series)&&!dismissed.includes(key))out.push({key,title:entry.title,series,reason:`Fills the gap before ${series.entries[highest].title}`,kind:'earlier'})}const next=series.entries[highest+1];if(next){const key=`${series.name}:${next.title}`;if(!dismissed.includes(key))out.push({key,title:next.title,series,reason:`Continues after ${series.entries[highest].title}`,kind:'next'})}}return out}

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
  $("#stats").innerHTML=[[total.toLocaleString(),'Games owned','across '+systems+' systems'],[playing,'Playing now',playing?'keep going':'pick one up'],[beaten,'Games beaten',total?`${(beaten/total*100).toFixed(beaten/total<.1?1:0)}% of library`:''],[recommendations().length,'Series gaps','in Series Quest']].map(([n,l,e])=>`<div class="stat"><span>${l}</span><strong>${n}</strong><em>${e}</em></div>`).join('');
  const queue=library.filter(g=>g.id!==game.id&&['playing','on-hold'].includes(stateFor(g.id).status));
  $("#upNextSection").classList.toggle('hidden',!queue.length);$("#upNext").innerHTML=queue.slice(0,14).map(shelfGame).join('');
  const counts=new Map();library.forEach(g=>counts.set(g.platform,(counts.get(g.platform)||0)+1));
  $("#systemCount").textContent=`${counts.size} detected`;
  $("#platformChips").innerHTML=[...counts].sort((a,b)=>b[1]-a[1]).map(([p,n])=>`<button class="platform-chip" data-platform-link="${escapeHtml(p)}" style="--family:${familyColor(p)}"><span class="sys-dot"></span>${escapeHtml(shortPlatform(p))}<b>${n.toLocaleString()}</b></button>`).join('');
  const recs=recommendations().slice(0,3);
  $("#recommendationPreview").innerHTML=recs.length?recs.map(r=>`<div class="rec-mini">${titleCover(r.title,seriesArtPlatforms(r.series),'mini')}<div><p class="eyebrow">${escapeHtml(r.series.name)}</p><strong>${escapeHtml(r.title)}</strong><p class="muted small">${escapeHtml(r.reason)}</p></div></div>`).join(''):`<div class="rec-preview"><strong>Your known series are caught up.</strong><p class="muted">Add more games or import another scan to uncover new paths.</p></div>`;
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
function renderSeriesFilters(){const current=$("#seriesPlatform").value;const systems=[...new Set(SERIES.flatMap(s=>s.systems))].sort((a,b)=>displayPlatform(a).localeCompare(displayPlatform(b)));$("#seriesPlatform").innerHTML='<option value="all">All systems</option>'+systems.map(s=>`<option value="${s}">${escapeHtml(displayPlatform(s))}</option>`).join('');$("#seriesPlatform").value=systems.includes(current)?current:'all'}
function renderSeriesCatalog(){
  const q=norm($("#seriesSearch").value),platform=$("#seriesPlatform").value,startedOnly=$("#seriesOwnedOnly").checked;
  const catalog=SERIES.map(series=>({series,status:seriesStatus(series)})).filter(({series,status})=>(!q||norm(series.name).includes(q))&&(platform==='all'||series.systems.includes(platform))&&(!startedOnly||status.owned.length)).sort((a,b)=>(b.status.owned.length>0)-(a.status.owned.length>0)||b.status.percent-a.status.percent);
  $("#seriesCatalog").classList.toggle('hidden',Boolean(activeSeriesName));$(".series-toolbar").classList.toggle('hidden',Boolean(activeSeriesName));
  $("#seriesCatalog").innerHTML=catalog.length?catalog.map(({series,status})=>{const missing=status.total-status.owned.length,stack=status.owned.slice(0,4);return`<article class="series-card${status.owned.length?' started':''}"><div class="series-stack">${stack.length?stack.map(g=>cover(g,'stack')).join(''):`<div class="rec-icon">${escapeHtml(initials(series.name))}</div>`}</div><h3>${escapeHtml(series.name)}</h3><p class="series-systems">${series.systems.map(shortPlatform).join(' · ')}</p><div class="progress-track"><i style="width:${status.percent}%"></i></div><div class="series-count"><span>${status.owned.length} of ${status.total} owned</span><strong>${missing?`${missing} missing`:'Complete!'}</strong></div><button class="button ghost full" data-open-series="${encodeURIComponent(series.name)}">View checklist</button></article>`}).join(''):'<p class="no-results">No franchise goals match.</p>';
  hydrateArt($("#seriesCatalog"));
}
function renderGoalDetail(){
  const series=SERIES.find(s=>s.name===activeSeriesName),detail=$("#goalDetail");detail.classList.toggle('hidden',!series);if(!series)return;
  const status=seriesStatus(series),artPlatforms=seriesArtPlatforms(series);
  $("#goalSystem").textContent=series.systems.map(displayPlatform).join(' • ');$("#goalTitle").textContent=series.name;
  $("#goalSummary").textContent=status.owned.length===status.total?'You have every cataloged game in this goal.':`${status.total-status.owned.length} games are still missing from this collection goal.`;
  $("#goalScore").innerHTML=`<strong>${status.owned.length}/${status.total}</strong><span>owned</span>`;$("#goalProgressBar").style.width=`${status.percent}%`;
  $("#goalChecklist").innerHTML=series.entries.map((entry,index)=>{const game=ownedGame(entry,series),state=game?stateFor(game.id):null;return`<article class="goal-row ${game?'owned':'missing'}">${game?cover(game,'mini'):titleCover(entry.title,artPlatforms,'mini')}<div><strong>${index+1}. ${escapeHtml(entry.title)}</strong><p>${game?`${escapeHtml(displayPlatform(game.platform))} · ${STATUS_LABEL[state.status]}${state.percent?` · ${state.percent}%`:''}`:'Not detected in your library'}</p></div>${game?`<button class="text-button" data-game="${escapeHtml(game.id)}">Open</button>`:'<span class="missing-label">Missing</span>'}<span class="goal-check" aria-hidden="true">${game?(state.status==='beaten'?'★':'✓'):'○'}</span></article>`}).join('');
  hydrateArt(detail);
}
function renderRecommendations(){
  renderSeriesFilters();renderSeriesCatalog();renderGoalDetail();
  const recs=recommendations();
  $("#recommendationList").innerHTML=recs.slice(0,12).map(r=>`<article class="recommendation-card">${titleCover(r.title,seriesArtPlatforms(r.series),'rec')}<div><p class="eyebrow">${escapeHtml(r.series.name)}</p><h3>${escapeHtml(r.title)}</h3><p>${escapeHtml(r.reason)}</p><div class="reason">${r.kind==='earlier'?'↶ Earlier entry':'→ Next in series'} · you own another game in this series</div></div><button class="dismiss" data-dismiss="${escapeHtml(r.key)}">Dismiss</button></article>`).join('');
  $("#recommendationEmpty").classList.toggle('hidden',recs.length>0);
  hydrateArt($("#recommendationList"));
}
function renderAll(){ownedIndex=null;renderPlatforms();renderDashboard();renderLibrary();renderRecommendations()}

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
  const dismiss=e.target.closest('[data-dismiss]');if(dismiss){dismissed.push(dismiss.dataset.dismiss);write(STORAGE.dismissed,dismissed);renderAll();toast('Suggestion dismissed');return}
  const game=e.target.closest('[data-game]');if(game&&!e.target.closest('dialog'))openGame(game.dataset.game);
});
document.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches?.('[data-game][role="button"]')){e.preventDefault();openGame(e.target.dataset.game)}});
['#importButton','#heroImportButton','#libraryImportButton','#emptyImportButton'].forEach(id=>$(id).onclick=triggerImport);
$("#inventoryInput").onchange=e=>{if(e.target.files[0])importFile(e.target.files[0]);e.target.value=''};
$("#backupInput").onchange=e=>{if(e.target.files[0])restoreBackup(e.target.files[0]);e.target.value=''};
$("#restoreButton").onclick=()=>$("#backupInput").click();
$("#demoButton").onclick=()=>mergeInventory(DEMO);$("#backupButton").onclick=exportBackup;
function resetLibraryView(){libraryVisibleCount=LIBRARY_PAGE_SIZE;renderLibrary()}
let searchTimer;$("#searchInput").oninput=()=>{clearTimeout(searchTimer);searchTimer=setTimeout(resetLibraryView,120)};
$("#platformFilter").onchange=resetLibraryView;$("#sortSelect").onchange=resetLibraryView;
$("#loadMoreButton").onclick=()=>{libraryVisibleCount+=LIBRARY_PAGE_SIZE;renderLibrary()};
$("#seriesSearch").oninput=renderSeriesCatalog;$("#seriesPlatform").onchange=renderSeriesCatalog;$("#seriesOwnedOnly").onchange=renderSeriesCatalog;
$("#closeGoalButton").onclick=()=>{activeSeriesName=null;renderSeriesCatalog();renderGoalDetail()};
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
