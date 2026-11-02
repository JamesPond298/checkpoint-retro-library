/* Checkpoint cover-art matcher.
 *
 * ROM filenames are messy ("000 Sonic the Hedgehog 1.sms", "Sonic Adventure2.chd",
 * "sfiii3.zip"). Libretro names its thumbnails after No-Intro/Redump/MAME titles
 * ("Sonic The Hedgehog (USA, Europe)", "Legend of Zelda, The - A Link to the Past (USA)").
 * Rather than guessing URLs, we load the list of thumbnails that actually exist for a
 * system (built by tools/build_art_index.py) and match against it:
 *   1. exact filename            2. normalized key (punctuation, "The", roman numerals,
 *   3. weighted token similarity    spacing, diacritics and tags removed)
 * Candidates are ranked by region (your file's region first), disc number, and
 * whether a box art image exists. Results are cached in localStorage.
 */
(function () {
  const INDEX_VERSION = 4;
  const CACHE_KEY = "checkpoint.artcache.v1";
  const OVERRIDE_KEY = "checkpoint.art.v1";
  const TYPES = [[1, "Named_Boxarts"], [2, "Named_Titles"], [4, "Named_Snaps"]];
  const ARCADE = ["FBNeo - Arcade Games", "MAME"];
  const PLATFORM_SYSTEMS = {
    NES: ["Nintendo - Nintendo Entertainment System"],
    SNES: ["Nintendo - Super Nintendo Entertainment System"],
    GB: ["Nintendo - Game Boy", "Nintendo - Game Boy Color"],
    GBC: ["Nintendo - Game Boy Color", "Nintendo - Game Boy"],
    GBA: ["Nintendo - Game Boy Advance"],
    N64: ["Nintendo - Nintendo 64"],
    NDS: ["Nintendo - Nintendo DS"],
    "3DS": ["Nintendo - Nintendo 3DS"],
    WII_GC: ["Nintendo - GameCube", "Nintendo - Wii"],
    MASTER_SYSTEM: ["Sega - Master System - Mark III"],
    GENESIS: ["Sega - Mega Drive - Genesis"],
    SEGA_CD: ["Sega - Mega-CD - Sega CD"],
    SATURN: ["Sega - Saturn"],
    DREAMCAST: ["Sega - Dreamcast"],
    ARCADE_CPS1: ARCADE, ARCADE_CPS2: ARCADE, ARCADE_CPS3: ARCADE, ARCADE_FBNEO: ARCADE,
    ARCADE_MAME: ["MAME", "FBNeo - Arcade Games"],
    NEOGEO: ["SNK - Neo Geo", ...ARCADE],
    NGP: ["SNK - Neo Geo Pocket", "SNK - Neo Geo Pocket Color"],
    MSX2: ["Microsoft - MSX2"],
    PCENGINE: ["NEC - PC Engine - TurboGrafx 16"],
    WONDERSWAN_COLOR: ["Bandai - WonderSwan Color"],
    PS1: ["Sony - PlayStation"],
    PS2: ["Sony - PlayStation 2"],
    PS3: ["Sony - PlayStation 3"],
    PSP: ["Sony - PlayStation Portable"],
  };
  const ARCADE_PLATFORMS = new Set(["ARCADE_CPS1", "ARCADE_CPS2", "ARCADE_CPS3", "ARCADE_FBNEO", "ARCADE_MAME", "NEOGEO"]);
  const ROMAN = { ii: "2", iii: "3", iv: "4", v: "5", vi: "6", vii: "7", viii: "8", ix: "9", xi: "11", xii: "12", xiii: "13", xiv: "14", xv: "15", xvi: "16" };
  const LIGHT = new Set(["of", "a", "an", "and", "to", "in", "on", "version", "edition", "game", "vol", "volume", "no"]);
  const ABBREV = { gta: "grand theft auto", ff: "final fantasy", mgs: "metal gear solid", dbz: "dragon ball z", kof: "king of fighters", smb: "super mario bros", sf: "street fighter", mk: "mortal kombat", thps: "tony hawks pro skater", loz: "legend of zelda", re: "resident evil", ssb: "super smash bros", mvc: "marvel vs capcom", tmnt: "teenage mutant ninja turtles", dkc: "donkey kong country", nfs: "need for speed" };
  const JUNK = new Set(["usa", "eur", "jpn", "pal", "ntsc", "psp", "iso", "rip", "proper", "repack", "multi", "fixed", "eboot", "cso", "decrypted", "nkit"]);
  const BAD_TAG = /\b(beta|proto|prototype|demo|sample|kiosk|pirate|unl|hack|aftermarket|program|debug|bios|test|alt|homebrew|bootleg|build|anniversary|plus|virtual console|switch online|collection)\b/i;

  const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const repo = (s) => s.replace(/ /g, "_");
  const sanitize = (s) => s.replace(/[&*/:`<>?\\|"]/g, "_");
  const readJSON = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
  const writeJSON = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage full or blocked */ } };

  let cache = readJSON(CACHE_KEY, {});
  if (cache.__v !== INDEX_VERSION) cache = { __v: INDEX_VERSION };
  let overrides = readJSON(OVERRIDE_KEY, {});
  let cacheTimer = null;
  const persistCache = () => { clearTimeout(cacheTimer); cacheTimer = setTimeout(() => writeJSON(CACHE_KEY, cache), 400); };

  /* ---------- name normalization ---------- */
  function tagsOf(name) { return [...name.matchAll(/[([]([^)\]]*)[)\]]/g)].map((m) => m[1]); }
  function baseOf(name) { return name.replace(/\s*[([][^)\]]*[)\]]/g, " ").trim(); }
  function tokens(text) {
    let s = baseOf(text)
      .replace(/^\s*\d{3}[\s._-]+/, "")                 // "000 Sonic" catalog prefixes
      .replace(/^(.*?), (The|A|An)\b/i, "$2 $1")         // "Legend of Zelda, The - ..."
      .normalize("NFKD").replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/&/g, " and ").replace(/['’`.]/g, "")
      .replace(/([a-z])(\d)/g, "$1 $2").replace(/(\d)([a-z])/g, "$1 $2")
      .replace(/[^a-z0-9]+/g, " ");
    const words = s.split(" ").filter(Boolean);
    if (words.length > 1 && ABBREV[words[0]]) words.splice(0, 1, ...ABBREV[words[0]].split(" "));
    return words.map((t) => ROMAN[t] || (/^0+\d/.test(t) ? String(Number(t)) : t)).filter((t) => t !== "the" && !JUNK.has(t));
  }
  const keyOf = (text) => tokens(text).join("");
  // Extra spellings worth trying: "A08 Tekken 6" / "07 tekken 5" (two-digit or lettered
  // catalog prefixes) and fan versions like "Zelda 2 Redux" or "MOTHER Restored".
  function cleanVariants(text) {
    const base = baseOf(text || "");
    const out = [base.replace(/^[A-Za-z]?\d{2,3}[\s._-]+(?=[A-Za-z])/, ""), base.replace(/[\s-]+(redux|restored|remastered|enhanced|hack|improvement|fixed|retranslated)\b.*$/i, "")];
    return out.filter((v) => v && v !== base);
  }
  // Keys used to recognise a game as a Series Quest entry.
  function seriesKeys(text) {
    const out = new Set();
    for (const variant of [text || "", ...cleanVariants(text)]) {
      const k = keyOf(variant);
      if (!k) continue;
      out.add(k); out.add(k.replace(/version/g, ""));
      if (k.startsWith("legendofzelda")) out.add("zelda" + k.slice(13)); else if (k.startsWith("zelda")) out.add("legendofzelda" + k.slice(5));
    }
    out.delete("");
    return [...out];
  }

  /* ---------- index loading ---------- */
  const systems = new Map();
  let arcadeNames = null;

  function loadSystem(system) {
    if (!systems.has(system)) {
      systems.set(system, fetch(`art-index/${slug(system)}.json`).then((r) => (r.ok ? r.json() : null)).then((data) => {
        if (!data) return null;
        const byExact = new Map(), byKey = new Map(), byToken = new Map(), toks = [];
        data.names.forEach((name, i) => {
          byExact.set(name.toLowerCase(), i);
          const t = tokens(name);
          toks.push(t);
          const k = t.join("");
          if (!byKey.has(k)) byKey.set(k, []);
          byKey.get(k).push(i);
          for (const w of new Set(t)) { if (!byToken.has(w)) byToken.set(w, []); byToken.get(w).push(i); }
        });
        return { system, names: data.names, flags: data.flags, links: data.links || {}, byExact, byKey, byToken, toks };
      }).catch(() => null));
    }
    return systems.get(system);
  }
  function loadArcadeNames() {
    if (!arcadeNames) arcadeNames = fetch("art-index/arcade-names.json").then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
    return arcadeNames;
  }

  /* ---------- scoring ---------- */
  function regionScore(name, wantRegion, disc) {
    const tags = tagsOf(name).join(" | ");
    let s = 0;
    if (wantRegion && new RegExp(`\\b${wantRegion}\\b`, "i").test(tags)) s += 30;
    if (/\bUSA\b|\bUS\b/i.test(tags)) s += 20;
    else if (/\bWorld\b/i.test(tags)) s += 18;
    else if (/\bEurope\b|\bEuro\b|\bUK\b/i.test(tags)) s += 12;
    else if (/\bJapan\b/i.test(tags)) s += 6;
    if (BAD_TAG.test(tags)) s -= 25;
    if (/\(Rev|\(v\d/i.test(name)) s -= 1;
    const d = tags.match(/\bDis[ck] (\d+)/i);
    if (d) s += Number(d[1]) === (disc || 1) ? 12 : -12;
    s -= tagsOf(name).length * 0.5;                 // prefer the plainest release
    return s;
  }
  function flagScore(idx, f) { const v = Number(idx.flags[f]); return v & 1 ? 50 : v & 2 ? 12 : v & 4 ? 6 : 0; }

  function weightedDice(a, b) {
    const w = (t) => (LIGHT.has(t) ? 0.3 : 1);
    const A = new Set(a), B = new Set(b);
    let inter = 0, ta = 0, tb = 0;
    for (const t of A) { ta += w(t); if (B.has(t)) inter += w(t); }
    for (const t of B) tb += w(t);
    return ta + tb ? (2 * inter) / (ta + tb) : 0;
  }
  const numbers = (t) => t.filter((x) => /^\d+$/.test(x)).sort().join(",");

  /* ---------- matching ---------- */
  function queriesFor(game, arcadeMap) {
    const file = game.files?.[0]?.filename || game.files?.[0]?.relativePath?.split("/").pop() || "";
    const stem = file.replace(/(?:\.nkit)?\.[^.]+$/i, "").replace(/\s+(?:Track|trk)\s*\d+$/i, "");
    const out = [];
    if (ARCADE_PLATFORMS.has(game.platform) && arcadeMap) {
      const desc = arcadeMap[stem.toLowerCase()];
      if (desc) out.push(desc);
    }
    out.push(stem, game.title);
    const noOne = (q) => q && /\s1$/.test(baseOf(q)) ? baseOf(q).replace(/\s1$/, "") : null;   // "Sonic the Hedgehog 1"
    return [...new Set([...out, ...out.map(noOne), ...out.flatMap(cleanVariants)].filter(Boolean))];
  }
  function wantedRegion(game) {
    if (game.region) return game.region.split(/[,\s]+/)[0];
    const file = game.files?.[0]?.filename || game.files?.[0]?.relativePath || "";
    const m = file.match(/\((USA|Europe|Japan|World|Korea|France|Germany|Spain|Italy|Brazil|Australia)/i);
    return m ? m[1] : null;
  }
  function discOf(game) {
    const file = game.files?.[0]?.filename || game.files?.[0]?.relativePath || "";
    const m = file.match(/dis[ck]\s*0*(\d+)/i);
    return m ? Number(m[1]) : 1;
  }

  function bestIn(idxList, candidates, region, disc, bonus = 0) {
    let best = null;
    for (const [idx, i, base] of candidates) {
      const score = base + bonus + flagScore(idx, i) + regionScore(idx.names[i], region, disc);
      if (!best || score > best.score) best = { idx, i, score };
    }
    return best;
  }

  function rank(idxList, queries, region, disc, { fuzzyThreshold = 0.78, limit = 1, contain = true } = {}) {
    // 1. exact filename hits
    for (const q of queries) {
      for (const idx of idxList) {
        const i = idx.byExact.get(sanitize(q).toLowerCase());
        if (i !== undefined && limit === 1 && Number(idx.flags[i]) & 1) return [{ idx, i, score: 999 }];
      }
    }
    // 2. normalized key hits
    const keyed = [];
    for (const q of queries) {
      const k = keyOf(q);
      if (!k) continue;
      idxList.forEach((idx, order) => (idx.byKey.get(k) || []).forEach((i) => keyed.push([idx, i, 100 - order * 5])));
    }
    if (keyed.length && limit === 1) return [bestIn(idxList, keyed, region, disc)];
    // 3. fuzzy token similarity, via the two rarest query tokens
    const scored = new Map(keyed.map(([idx, i, b]) => [`${idx.system}|${i}`, { idx, i, score: b + 100 + flagScore(idx, i) + regionScore(idx.names[i], region, disc) }]));
    for (const q of queries) {
      const qt = tokens(q);
      if (!qt.length) continue;
      const qn = numbers(qt);
      for (const [order, idx] of idxList.entries()) {
        const rare = [...new Set(qt)].filter((t) => !LIGHT.has(t)).sort((a, b) => (idx.byToken.get(a)?.length || 1e9) - (idx.byToken.get(b)?.length || 1e9)).slice(0, 2);
        const pool = new Set(rare.flatMap((t) => idx.byToken.get(t) || []));
        for (const i of pool) {
          const ct = idx.toks[i];
          let sim = numbers(ct) === qn ? weightedDice(qt, ct) : 0;   // never confuse sequels
          if (sim < fuzzyThreshold && contain) {
            // "LEGO Batman USA PSP-pSyPSP" contains the whole main title of "LEGO Batman - The Videogame";
            // "Metal Slug" is the main title of "Metal Slug - Super Vehicle-001".
            const main = tokens(idx.names[i].split(" - ")[0]);
            if (main.length >= 2 && numbers(main) === qn && main.every((t) => qt.includes(t)) && main.length / new Set(qt).size >= 0.6) sim = Math.max(sim, 0.8 + main.length / 100);
          }
          if (sim < fuzzyThreshold) continue;
          const score = sim * 100 - order * 5 + flagScore(idx, i) + regionScore(idx.names[i], region, disc);
          const id = `${idx.system}|${i}`;
          if (!scored.has(id) || scored.get(id).score < score) scored.set(id, { idx, i, score });
        }
      }
    }
    return [...scored.values()].sort((a, b) => b.score - a.score).slice(0, limit);
  }

  const asRef = (hit) => {
    const f = Number(hit.idx.flags[hit.i]);
    const [bit, type] = TYPES.find(([b]) => f & b) || TYPES[0];
    const name = hit.idx.names[hit.i], file = hit.idx.links[`${bit}|${name}`];
    return file ? { system: hit.idx.system, name, type, file } : { system: hit.idx.system, name, type };
  };

  async function indexesFor(platforms) {
    const list = [...new Set(platforms.flatMap((p) => PLATFORM_SYSTEMS[p] || []))];
    return (await Promise.all(list.map(loadSystem))).filter(Boolean);
  }

  const pending = new Map();
  function resolve(game) {
    if (game.id in overrides) return Promise.resolve(overrides[game.id] || null);
    if (game.id in cache) return Promise.resolve(cache[game.id]);
    if (!PLATFORM_SYSTEMS[game.platform]) return Promise.resolve(null);
    if (!pending.has(game.id)) {
      pending.set(game.id, (async () => {
        const [idxList, arcadeMap] = await Promise.all([indexesFor([game.platform]), ARCADE_PLATFORMS.has(game.platform) ? loadArcadeNames() : null]);
        if (!idxList.length) return null;                       // index missing: don't cache
        const hit = rank(idxList, queriesFor(game, arcadeMap), wantedRegion(game), discOf(game))[0];
        const ref = hit ? asRef(hit) : 0;
        cache[game.id] = ref;
        persistCache();
        return ref;
      })().finally(() => pending.delete(game.id)));
    }
    return pending.get(game.id);
  }

  const titleCache = new Map();
  function resolveTitle(title, platforms) {
    const key = `${platforms.join(",")}|${title}`;
    if (!titleCache.has(key)) {
      titleCache.set(key, indexesFor(platforms).then((idxList) => {
        const hit = idxList.length && rank(idxList, [title], null, 1, { fuzzyThreshold: 0.85 })[0];
        return hit ? asRef(hit) : null;
      }));
    }
    return titleCache.get(key);
  }

  async function search(game, query, limit = 12) {
    const idxList = await indexesFor([game.platform]);
    const arcadeMap = ARCADE_PLATFORMS.has(game.platform) ? await loadArcadeNames() : null;
    const queries = query ? [query] : queriesFor(game, arcadeMap);
    return rank(idxList, queries, wantedRegion(game), discOf(game), { fuzzyThreshold: query ? 0.4 : 0.5, limit }).map(asRef);
  }

  function urls(ref) {
    if (!ref) return [];
    const file = `${encodeURIComponent(sanitize(ref.name))}.png`, real = `${encodeURIComponent(sanitize(ref.file || ref.name))}.png`;
    return [
      `https://thumbnails.libretro.com/${encodeURIComponent(ref.system)}/${ref.type}/${file}`,
      `https://raw.githubusercontent.com/libretro-thumbnails/${repo(ref.system)}/master/${ref.type}/${real}`,
    ];
  }

  function setOverride(gameId, ref) { overrides[gameId] = ref || 0; writeJSON(OVERRIDE_KEY, overrides); }
  function hideArt(gameId) { setOverride(gameId, 0); }
  function clearOverride(gameId) { delete overrides[gameId]; writeJSON(OVERRIDE_KEY, overrides); delete cache[gameId]; persistCache(); }
  function hasOverride(gameId) { return gameId in overrides; }
  function exportOverrides() { return { ...overrides }; }
  function importOverrides(value) { if (value && typeof value === "object") { overrides = { ...overrides, ...value }; writeJSON(OVERRIDE_KEY, overrides); } }
  function forget(gameId) { delete cache[gameId]; persistCache(); }

  async function refFor(system, name) {
    const idx = await loadSystem(system);
    const i = idx?.byExact.get(name.toLowerCase());
    return i === undefined ? null : asRef({ idx, i });
  }
  function cached(gameId) { return gameId in overrides ? overrides[gameId] || 0 : cache[gameId]; }
  // Resolve many games in the background, yielding to the UI between batches.
  async function warm(games, onDone) {
    const todo = games.filter((g) => PLATFORM_SYSTEMS[g.platform] && cached(g.id) === undefined);
    for (let i = 0; i < todo.length; i += 40) {
      await Promise.all(todo.slice(i, i + 40).map(resolve));
      await new Promise((r) => setTimeout(r, 0));
    }
    if (todo.length && onDone) onDone(todo.length);
  }

  window.CheckpointArt = { refFor, cached, warm, seriesKeys, keyOf, baseOf, resolve, resolveTitle, search, urls, setOverride, hideArt, clearOverride, hasOverride, exportOverrides, importOverrides, forget, supports: (p) => Boolean(PLATFORM_SYSTEMS[p]), _test: { tokens, keyOf, rank, indexesFor, queriesFor } };
})();
