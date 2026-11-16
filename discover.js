/* Discover: beloved franchises, classics and system essentials (curated in discovery-data.js),
 * checked against your imported library, plus collection goals and the want list.
 *
 * What is curated vs. inferred:
 *   curated  - which games are on each list, their order, reasons, sources and list sizes.
 *   inferred - whether a pick is in your library (the same filename matching Series Quest uses),
 *              and its status from your own progress (playing, on hold, beaten...).
 *   yours    - want / have it / skip / not interested marks and goals.
 *
 * Marks for picks that are also Series Quest entries are stored as Series Quest marks
 * (checkpoint.seriesmarks.v1), so marking a game in either place updates both. Other picks are
 * stored in checkpoint.collection.v1 together with your goals.
 *
 * Loaded before app.js. Functions here use app.js globals (library, stateFor, SERIES, ...),
 * so they are only called after app.js has run.
 */
const COLLECTION_KEY = 'checkpoint.collection.v1', DISCOVER_UI_KEY = 'checkpoint.discoverui.v1';
const ARCADE_ALL = ['ARCADE_CPS1', 'ARCADE_CPS2', 'ARCADE_CPS3', 'ARCADE_FBNEO', 'ARCADE_MAME', 'NEOGEO'];
const DMARKS = ['want', 'have', 'skip', 'no'];
const GOAL_MEASURES = { collect: 'Collect', beat: 'Beat' };
const PLAYED_STATES = ['started', 'playing', 'on-hold', 'beaten'];
const STATE_INFO = {
  beaten: { label: '★ Beaten', tip: 'In your library and marked beaten' },
  playing: { label: '▶ Playing', tip: 'In your library, currently playing' },
  'on-hold': { label: '⏸ On hold', tip: 'In your library, on hold' },
  started: { label: 'Started', tip: 'In your library with progress logged' },
  owned: { label: 'In library', tip: 'A matching file is in your imported library. That does not confirm a physical copy.' },
  have: { label: '✓ Have it', tip: 'You marked that you own or finished it outside this library' },
  want: { label: '＋ Wanted', tip: 'On your want list' },
  skip: { label: 'Skipped', tip: 'Not counted toward goals' },
  no: { label: 'Not interested', tip: 'Not counted toward goals and never suggested' },
  missing: { label: 'Not in library', tip: 'No matching file found in your imported library' },
};

/* ---------- storage (with migration) ----------
 * checkpoint.collection.v1 = { marks: { key: want|have|skip|no }, goals: [{ id, type: list|series, ref, measure: collect|beat, createdAt }] }
 * Created on first load of schema 3. A damaged or hand-edited value is cleaned up rather than trusted. */
function normalizeCollection(raw) {
  raw = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const m = {};
  if (raw.marks && typeof raw.marks === 'object' && !Array.isArray(raw.marks)) for (const [k, v] of Object.entries(raw.marks)) if (k.length <= 200 && DMARKS.includes(v)) m[k] = v;
  const goals = [], seen = new Set();
  for (const g of Array.isArray(raw.goals) ? raw.goals : []) {
    if (!g || !['list', 'series'].includes(g.type) || typeof g.ref !== 'string' || !g.ref || g.ref.length > 200) continue;
    const measure = g.measure === 'beat' ? 'beat' : 'collect', id = `${g.type}:${g.ref}:${measure}`;
    if (seen.has(id)) continue; seen.add(id);
    goals.push({ id, type: g.type, ref: g.ref, measure, createdAt: typeof g.createdAt === 'string' && !Number.isNaN(Date.parse(g.createdAt)) ? g.createdAt : new Date().toISOString() });
    if (goals.length >= 40) break;
  }
  return { marks: m, goals };
}
let collection = (() => {
  let raw = null; try { raw = JSON.parse(localStorage.getItem(COLLECTION_KEY)); } catch { /* damaged: start clean */ }
  const n = normalizeCollection(raw);
  if (JSON.stringify(raw) !== JSON.stringify(n)) try { localStorage.setItem(COLLECTION_KEY, JSON.stringify(n)); } catch { /* storage blocked */ }
  return n;
})();
const saveCollection = () => write(COLLECTION_KEY, collection);
function exportCollection() { return normalizeCollection(collection); }
function importCollection(data) { if (data === undefined) return; collection = normalizeCollection(data); saveCollection(); resetDiscoverCache(); }

let discUI = null;
function ui() {
  if (!discUI) { let saved = {}; try { saved = JSON.parse(localStorage.getItem(DISCOVER_UI_KEY)) || {}; } catch { /* ignore */ } discUI = { tab: 'franchises', list: '', filter: 'all', ...saved, open: new Set() }; }
  return discUI;
}
const saveUI = () => { const u = ui(); write(DISCOVER_UI_KEY, { tab: u.tab, list: u.list, filter: u.filter }); };

/* ---------- curated picks matched to your library ---------- */
let discoverIndex = {}, discoverItemsCache = null, discoverGameCache = new Map(), entryKeyMap = null;
fetch('art-index/discovery-index.json').then((r) => (r.ok ? r.json() : {})).then((d) => { discoverIndex = d || {}; resetDiscoverCache(); if (typeof renderAll === 'function' && typeof library !== 'undefined') renderAll(); }).catch(() => {});
function resetDiscoverCache() { discoverGameCache = new Map(); discoverItemsCache = null; entryKeyMap = null; }
const expandPlatforms = (ps) => [...new Set(ps.flatMap((p) => (p === 'ARCADE' ? ARCADE_ALL : [p])))];
const discoverLists = () => window.DISCOVERY?.lists || [];
const discoverFranchises = () => (window.DISCOVERY?.franchises || []).filter((f) => SERIES.some((s) => s.name === f.series));
function seriesLinkFor(item, platforms) {
  if (!entryKeyMap) { entryKeyMap = new Map(); for (const series of SERIES) for (const entry of series.entries) for (const k of keyVariants(entry.title)) { if (!entryKeyMap.has(k)) entryKeyMap.set(k, []); entryKeyMap.get(k).push({ series, entry }); } }
  for (const k of keyVariants(item.title)) for (const hit of entryKeyMap.get(k) || []) if (hit.series.systems.some((p) => platforms.includes(p))) return hit;
  return null;
}
function discoverItems() {
  if (discoverItemsCache) return discoverItemsCache;
  const all = [], byUid = new Map();
  for (const list of discoverLists()) list.items.forEach((item, index) => {
    const platforms = expandPlatforms(item.platforms), link = seriesLinkFor(item, platforms);
    const it = { uid: `${list.id}|${item.title}`, list, item, index, title: item.title, platforms, link, core: index < (list.size || list.items.length) };
    it.key = link ? `s:${link.series.name}::${link.entry.title}` : `d:${item.key || CheckpointArt.keyOf(item.title)}`;
    all.push(it); byUid.set(it.uid, it);
  });
  return (discoverItemsCache = { all, byUid });
}
const listItems = (list, coreOnly = false) => discoverItems().all.filter((i) => i.list === list && (!coreOnly || i.core));
function itemGames(it) {
  if (discoverGameCache.has(it.uid)) return discoverGameCache.get(it.uid);
  if (!gameKeyIndex) buildGameKeyIndex();
  const found = new Set(), add = (g) => { if (it.platforms.includes(g.platform)) found.add(g); };
  for (const alias of [it.title, ...(it.item.aliases || [])]) {
    const m = alias.match(/^([A-Z0-9_]+)\|(.*)$/);
    for (const k of keyVariants(m ? m[2] : alias)) for (const g of gameKeyIndex.get(k) || []) if (!m || g.platform === m[1]) add(g);
  }
  // The catalog name the pick was found under (e.g. a Neo Geo set's full title) also counts on that platform.
  for (const [p, [, name]] of Object.entries(discoverIndex[it.uid] || {})) for (const k of keyVariants(CheckpointArt.baseOf(name))) for (const g of gameKeyIndex.get(k) || []) if (g.platform === p || (p === 'NEOGEO' && ARCADE_ALL.includes(g.platform))) add(g);
  if (it.link) entryGames(it.link.entry, it.link.series).forEach(add);
  const games = [...found].sort((a, b) => STATUS_RANK[stateFor(b.id).status] - STATUS_RANK[stateFor(a.id).status]);
  discoverGameCache.set(it.uid, games);
  return games;
}
function discoverMark(it) { return it.link ? marks[markKey(it.link.series, it.link.entry)] || null : collection.marks[it.key] || null; }
function gameState(game) { const s = stateFor(game.id); return s.status === 'beaten' ? 'beaten' : s.status === 'playing' ? 'playing' : s.status === 'on-hold' ? 'on-hold' : s.percent > 0 ? 'started' : 'owned'; }
/* One shape for every row: Discover picks and Series Quest entries alike. */
function itemState(it) {
  const games = itemGames(it), game = games[0] || null, mark = discoverMark(it);
  return { it, uid: it.uid, key: it.key, title: it.title, why: it.item.why, source: it.item.source, region: it.item.region, platforms: it.item.platforms, game, games, mark, nfm: game ? isNotForMe(game.id) : false, state: game ? gameState(game) : mark || 'missing' };
}
function entryState(series, e, why = '') {
  const game = e.game, mark = e.mark;
  return { series, entry: e.entry, uid: `s|${series.name}|${e.entry.title}`, key: `s:${series.name}::${e.entry.title}`, title: e.entry.title, why, platforms: entryPlatforms(series, e.entry), game, games: game ? [game] : [], mark, nfm: game ? isNotForMe(game.id) : false, state: game ? gameState(game) : mark || 'missing' };
}
const isHiddenState = (s) => !s.game && (s.state === 'skip' || s.state === 'no');

/* ---------- marks ---------- */
let pendingDiscoverFocus = null;
function setDiscoverMark(it, value) {
  if (value && !DMARKS.includes(value)) return;
  if (it.link) { setMark(it.link.series.name, it.link.entry.title, value); return; }
  if (value) collection.marks[it.key] = value; else delete collection.marks[it.key];
  saveCollection(); renderAll();
}
const MARK_TOAST = { want: (t) => `Added ${t} to your want list`, have: (t) => `Marked ${t} as owned`, skip: (t) => `Skipped ${t}. It won't count toward goals`, no: (t) => `Got it: ${t} won't be suggested`, '': () => 'Mark removed' };

/* ---------- list and goal progress ---------- */
function summarize(states) {
  const counted = states.filter((s) => !isHiddenState(s));
  return {
    states, counted: counted.length, inLib: states.filter((s) => s.game).length,
    have: counted.filter((s) => s.game || s.state === 'have').length,
    beaten: states.filter((s) => s.state === 'beaten').length,
    played: states.filter((s) => PLAYED_STATES.includes(s.state)).length,
    wanted: states.filter((s) => s.state === 'want').length,
    hidden: states.length - counted.length,
  };
}
const listProgress = (list) => summarize(listItems(list, true).map(itemState));
function goalSource(goal) {
  if (goal.type === 'list') { const list = discoverLists().find((l) => l.id === goal.ref); return list ? { title: list.title, list, states: listItems(list, true).map(itemState) } : null; }
  const series = SERIES.find((s) => s.name === goal.ref);
  return series ? { title: series.name, series, states: seriesStatus(series).entries.map((e) => entryState(series, e)) } : null;
}
const NEXT_PLAY_ORDER = { playing: 0, 'on-hold': 1, started: 2, owned: 3 };
function goalProgress(goal) {
  const src = goalSource(goal); if (!src) return null;
  const sum = summarize(src.states), counted = src.states.filter((s) => !isHiddenState(s));
  const done = goal.measure === 'beat' ? sum.beaten : sum.have;
  let next;
  if (goal.measure === 'beat') {
    const toPlay = counted.filter((s) => s.game && s.state !== 'beaten' && !s.nfm).sort((a, b) => NEXT_PLAY_ORDER[a.state] - NEXT_PLAY_ORDER[b.state]);
    next = [...toPlay, ...counted.filter((s) => !s.game && s.state !== 'have')].slice(0, 3);
  } else next = counted.filter((s) => !s.game && s.state !== 'have').sort((a, b) => (b.state === 'want') - (a.state === 'want')).slice(0, 3);
  return { ...src, ...sum, done, percent: sum.counted ? Math.round((done / sum.counted) * 100) : 100, next };
}
const goalTitle = (goal, src) => `${GOAL_MEASURES[goal.measure]}: ${src.title}`;
function addGoal(type, ref, measure) {
  const id = `${type}:${ref}:${measure}`;
  if (collection.goals.some((g) => g.id === id)) { toast('That goal is already on your list'); return; }
  collection.goals.push({ id, type, ref, measure, createdAt: new Date().toISOString() });
  saveCollection(); renderAll();
  const src = goalSource({ type, ref }); toast(`Goal added: ${GOAL_MEASURES[measure]} ${src?.title || ref}`);
}
function removeGoal(id) { collection.goals = collection.goals.filter((g) => g.id !== id); saveCollection(); renderAll(); toast('Goal removed'); }
/* Goals that include a pick, so recommendations can say "part of your goal". */
function goalsContaining(key) {
  return collection.goals.filter((g) => { const src = goalSource(g); return src && src.states.some((s) => s.key === key); }).map((g) => goalTitle(g, goalSource(g)));
}
function suggestedGoals() {
  const have = new Set(collection.goals.map((g) => g.id)), out = [], counts = new Map();
  library.forEach((g) => { const k = ARCADE_ALL.includes(g.platform) && g.platform !== 'NEOGEO' ? 'ARCADE' : g.platform; counts.set(k, (counts.get(k) || 0) + 1); });
  const add = (type, ref, measure, why) => { if (!have.has(`${type}:${ref}:${measure}`) && out.length < 3) out.push({ type, ref, measure, why }); };
  if (discoverLists().some((l) => l.id === 'classics')) add('list', 'classics', 'beat', 'Work through the classics you already have, one at a time.');
  const sys = [...counts].sort((a, b) => b[1] - a[1]).map(([p]) => discoverLists().find((l) => l.id === `sys:${p}`)).find(Boolean);
  if (sys) add('list', sys.id, 'collect', `You have more ${sys.title.replace(/ essentials$/, '')} games than any other system.`);
  const fr = discoverFranchises().map((f) => ({ f, st: seriesStatus(SERIES.find((s) => s.name === f.series)) })).filter((x) => x.st.started && x.st.missing.length).sort((a, b) => b.st.percent - a.st.percent)[0];
  if (fr) add('series', fr.f.series, 'collect', `You have ${fr.st.collected} of ${fr.st.total}. ${fr.st.missing.length} to go.`);
  return out;
}

/* ---------- recommendation helpers (used by buildRecommendations in app.js) ---------- */
/* With a system in focus, that system's own list leads; otherwise the classics list does. */
const listBonus = (it, platform) => ((platform ? it.list.kind === 'system' : it.list.kind === 'classics') ? 10 : 0);
const goalKeySet = () => new Set(collection.goals.flatMap((g) => goalSource(g)?.states.map((s) => s.key) || []));
const bestPerId = (rows, idOf) => { const seen = new Set(); return rows.sort((a, b) => b.score - a.score).filter((r) => { const id = idOf(r); if (seen.has(id)) return false; seen.add(id); return true; }); };
/* Curated picks you own but haven't started: "recommend a classic". */
function ownedEssentials({ platform = null, exclude = new Set() } = {}) {
  const preferred = new Set(recPrefs().systems), goalKeys = goalKeySet(), rows = [];
  for (const it of discoverItems().all) {
    if (!it.core || (platform && !it.platforms.includes(platform))) continue;
    const s = itemState(it); if (!s.game || s.state !== 'owned' || s.nfm || exclude.has(s.game.id)) continue;
    if (platform && s.game.platform !== platform) continue;
    rows.push({ s, score: (goalKeys.has(s.key) ? 30 : 0) + (preferred.has(s.game.platform) ? 15 : 0) + listBonus(it, platform) - it.index * 0.2 });
  }
  return bestPerId(rows, (r) => r.s.game.id).map((r) => r.s);
}
/* Curated picks that aren't in your library and you haven't marked, for systems you have. */
function missingEssentials({ platform = null } = {}) {
  const mine = libraryPlatforms(), preferred = new Set(recPrefs().systems), goalKeys = goalKeySet(), rows = [];
  for (const it of discoverItems().all) {
    if (!it.core) continue;
    const playable = it.platforms.filter((p) => mine.has(p) && (!platform || p === platform)); if (!playable.length) continue;
    const s = itemState(it); if (s.game || s.mark) continue;
    rows.push({ s, playable, score: (goalKeys.has(s.key) ? 30 : 0) + (playable.some((p) => preferred.has(p)) ? 15 : 0) + listBonus(it, platform) - it.index * 0.2 });
  }
  return bestPerId(rows, (r) => r.s.key);
}
/* Series you've turned down at least twice: suggest less from them. */
function dismissedSeries() {
  const out = new Set();
  for (const series of SERIES) {
    let n = 0;
    for (const e of seriesStatus(series).entries) if ((e.game && isNotForMe(e.game.id)) || e.mark === 'no') n++;
    if (n >= 2) out.add(series.name);
  }
  return out;
}

/* ---------- rendering ---------- */
const DISC_TABS = [['goals', 'Goals'], ['franchises', 'Beloved franchises'], ['classics', 'Classics'], ['systems', 'Top by system'], ['want', 'Want list']];
const DISC_HINTS = {
  goals: 'Collection goals track what you have and what you’ve beaten. Pick one or two; the next steps show what to play or find.',
  franchises: 'Notable franchises, why they matter and where to start. Ownership and marks are shared with Series Quest.',
  classics: 'Games often cited as influential or culturally significant. Picks with a source can be checked against it; the rest are Checkpoint’s editorial choices.',
  systems: 'A curated essentials list for each system. Your systems come first.',
  want: 'Everything you’ve marked as wanted, from Discover and Series Quest. Rescan your card after adding a game and it’s checked off automatically.',
};
const ITEM_FILTERS = [['all', 'All picks'], ['library', 'In my library'], ['missing', 'Not in my library'], ['want', 'Wanted'], ['unplayed', 'In library, not started'], ['played', 'Played or playing'], ['beaten', 'Beaten'], ['hidden', 'Skipped or not interested']];
const FILTER_TEST = { all: () => true, library: (s) => Boolean(s.game), missing: (s) => !s.game, want: (s) => s.state === 'want', unplayed: (s) => s.state === 'owned', played: (s) => PLAYED_STATES.includes(s.state), beaten: (s) => s.state === 'beaten', hidden: isHiddenState };
const FR_FILTERS = [['all', 'All franchises'], ['started', 'Started'], ['new', 'Not started'], ['complete', 'Complete']];
const FR_TEST = { all: () => true, started: (st) => st.started && st.missing.length > 0, new: (st) => !st.started, complete: (st) => st.started && !st.missing.length };
const discSearch = () => norm($('#discoverSearch')?.value || '');
const discVisible = () => $('#discoverView')?.classList.contains('active');
function renderDiscoverIfVisible() { if (discVisible()) renderDiscover(); }

function discPlatformChips(platforms) {
  const mine = libraryPlatforms(), owned = (p) => (p === 'ARCADE' ? ARCADE_ALL.some((a) => mine.has(a)) : mine.has(p));
  return platforms.length ? `<span class="plat-chips">${platforms.map((p) => `<span class="plat-chip${owned(p) ? ' mine' : ''}" title="${owned(p) ? 'You already have games for this system' : escapeHtml(p === 'ARCADE' ? 'Arcade' : displayPlatform(p))}">${escapeHtml(p === 'ARCADE' ? 'Arcade' : shortPlatform(p))}</span>`).join('')}</span>` : '';
}
function discCover(s, cls = 'mini') {
  if (s.game) return cover(s.game, cls);
  if (s.series) return entryCover(s.series, s.entry, cls);
  const hits = discoverIndex[s.uid] || {}, mine = libraryPlatforms(), p = Object.keys(hits).sort((a, b) => mine.has(b) - mine.has(a))[0];
  const a = p ? { platform: p, system: hits[p][0], name: hits[p][1] } : { platform: expandPlatforms(s.platforms)[0] }, key = a.name ? `r:${a.system}|${a.name}` : null;
  return `<div class="cover ${cls}${key ? knownAttrs(key) : '" style="'}--cover:${COLORS[s.title.length % COLORS.length]};--family:${familyColor(a.platform)}"${a.name ? ` data-art-system="${escapeHtml(a.system)}" data-art-name="${escapeHtml(a.name)}"` : ''}>${coverInner(s.title, a.platform, key)}</div>`;
}
/* The attribute that tells the click handler which pick (or Series Quest entry) a mark is for. */
const markTarget = (s) => (s.series ? `data-series="${enc(s.series.name)}" data-entry="${enc(s.entry.title)}"` : `data-dkey="${escapeHtml(s.uid)}"`);
function discActions(s, { compact = false } = {}) {
  const t = escapeHtml(s.title), tgt = markTarget(s);
  if (s.game) {
    const id = escapeHtml(s.game.id);
    return `<button class="mini-button" data-game="${id}" aria-label="Open ${t}">Open</button>${s.state === 'owned' && !s.nfm ? `<button class="mini-button on" data-track="${id}">Start playing</button>` : ''}${PLAYED_STATES.includes(s.state) && s.state !== 'beaten' ? `<button class="mini-button" data-checkpoint="${id}" aria-label="Update checkpoint for ${t}">📍</button>` : ''}${compact || s.state === 'beaten' ? '' : s.nfm ? `<button class="mini-button" data-undo-notforme="${id}">Undo “not for me”</button>` : `<button class="mini-button subtle" data-notforme="${id}" aria-label="Not for me: never suggest ${t}">Not for me</button>`}`;
  }
  if (['have', 'skip', 'no'].includes(s.state)) return `<button class="mini-button" data-dmark="" ${tgt} aria-label="Undo ${escapeHtml(STATE_INFO[s.state].label)} for ${t}">Undo</button>`;
  const want = s.state === 'want';
  return `<button class="mini-button${want ? ' on' : ''}" data-dmark="${want ? '' : 'want'}" ${tgt} aria-pressed="${want}" aria-label="${want ? `Remove ${t} from want list` : `Want ${t}`}">${want ? '✓ Wanted' : '＋ Want'}</button>${want ? `<a class="mini-button" href="${priceUrl(s.title, expandPlatforms(s.platforms).filter((p) => libraryPlatforms().has(p)))}" target="_blank" rel="noopener">Price check ↗</a>` : ''}${compact ? '' : `<button class="mini-button" data-dmark="have" ${tgt} title="You own or finished it outside this library" aria-label="Have it: ${t}">Have it</button><button class="mini-button subtle" data-dmark="skip" ${tgt} title="Don't count it toward goals" aria-label="Skip ${t}">Skip</button>`}<button class="mini-button subtle" data-dmark="no" ${tgt} title="Never suggest it" aria-label="Not interested in ${t}">Not interested</button>`;
}
function discRow(s, { n = null, star = false, compact = false } = {}) {
  const info = STATE_INFO[s.state];
  const where = s.game ? `<span class="muted small">${escapeHtml(shortPlatform(s.game.platform))}${s.games.length > 1 ? ` + ${s.games.length - 1} more` : ''}</span>` : discPlatformChips(s.platforms);
  return `<article class="quest-row disc-row st-${s.state}${compact ? ' compact' : ''}" data-drow="${escapeHtml(s.uid)}">${discCover(s)}<div class="qr-main"><strong>${n ? `<span class="disc-num">${n}.</span> ` : ''}${escapeHtml(s.title)}${star ? ' <span class="disc-star" title="A good place to start">★ Start here</span>' : ''}</strong>${s.why && !compact ? `<p class="disc-why">${escapeHtml(s.why)}</p>` : ''}<p class="disc-meta"><span class="disc-state ${s.state}" title="${escapeHtml(info.tip)}">${info.label}</span>${s.nfm ? '<span class="disc-state no" title="You said “not for me”">Not for me</span>' : ''}${where}${s.region ? `<span class="disc-note">${escapeHtml(s.region)}</span>` : ''}${s.source && !compact ? `<span class="disc-source">Source: ${escapeHtml(s.source)}</span>` : ''}</p></div><div class="qr-actions">${discActions(s, { compact })}</div></article>`;
}
function meter(done, total, label) { const pct = total ? Math.round((done / total) * 100) : 0; return `<div class="progress-track" role="img" aria-label="${escapeHtml(label)}"><i style="width:${pct}%"></i></div>`; }
function goalButtons(type, ref) {
  const has = (m) => collection.goals.some((g) => g.id === `${type}:${ref}:${m}`), r = escapeHtml(ref);
  return `<button class="mini-button${has('collect') ? ' on' : ''}" data-goal-add="${type}" data-goal-ref="${r}" data-goal-measure="collect" ${has('collect') ? 'disabled' : ''}>${has('collect') ? '✓ Collect goal' : '🎯 Goal: collect them'}</button><button class="mini-button${has('beat') ? ' on' : ''}" data-goal-add="${type}" data-goal-ref="${r}" data-goal-measure="beat" ${has('beat') ? 'disabled' : ''}>${has('beat') ? '✓ Beat goal' : '🏁 Goal: beat them'}</button>`;
}

function renderDiscoverStats() {
  const classics = discoverLists().find((l) => l.id === 'classics'), cp = classics ? listProgress(classics) : null;
  const frs = discoverFranchises().map((f) => seriesStatus(SERIES.find((s) => s.name === f.series)));
  const goals = collection.goals.map(goalProgress).filter(Boolean), done = goals.filter((g) => g.counted && g.done >= g.counted).length;
  $('#discoverStats').innerHTML = [
    [`${goals.length}`, 'Collection goals', goals.length ? `${done} complete` : 'set one below'],
    cp ? [`${cp.inLib}<small>/${cp.counted}</small>`, 'Classics in library', `${cp.beaten} beaten`] : null,
    [`${frs.filter((s) => s.started).length}<small>/${frs.length}</small>`, 'Beloved franchises started', `${frs.filter((s) => s.started && !s.missing.length).length} complete`],
    [`${wantedStates().length}`, 'On your want list', 'games to track down'],
  ].filter(Boolean).map(([n, l, e]) => `<div class="stat"><span>${l}</span><strong>${n}</strong><em>${e}</em></div>`).join('');
}
function renderDiscoverBar() {
  const u = ui();
  $('#discoverTabs').innerHTML = DISC_TABS.map(([v, l]) => `<button role="tab" class="quest-tab${u.tab === v ? ' active' : ''}" aria-selected="${u.tab === v}" data-dtab="${v}">${l}${v === 'goals' ? `<b>${collection.goals.length}</b>` : v === 'want' ? `<b>${wantedStates().length}</b>` : ''}</button>`).join('');
  const filters = u.tab === 'franchises' ? FR_FILTERS : ['classics', 'systems'].includes(u.tab) ? ITEM_FILTERS : null, sel = $('#discoverFilter');
  sel.classList.toggle('hidden', !filters); $('#discoverSearchWrap').classList.toggle('hidden', u.tab === 'goals');
  if (filters) { sel.innerHTML = filters.map(([v, l]) => `<option value="${v}">${l}</option>`).join(''); sel.value = filters.some((f) => f[0] === u.filter) ? u.filter : 'all'; }
  $('#discoverHint').textContent = DISC_HINTS[u.tab];
  const lists = $('#discoverLists'); lists.classList.toggle('hidden', u.tab !== 'systems');
  if (u.tab === 'systems') {
    const sys = systemLists(), mine = sys.filter((x) => x.mine), others = sys.filter((x) => !x.mine), cur = currentSystemList();
    lists.innerHTML = mine.map(({ list }) => { const p = listProgress(list); return `<button class="sys-chip${cur === list ? ' active' : ''}" data-dlist="${escapeHtml(list.id)}" aria-pressed="${cur === list}" style="--family:${familyColor(list.platforms[0] === 'ARCADE' ? 'ARCADE_MAME' : list.platforms[0])}"><span class="sys-dot"></span>${escapeHtml(listShortName(list))}<b>${p.have}/${p.counted}</b></button>`; }).join('') +
      (others.length ? `<select id="discoverListMore" class="sys-more" aria-label="Essentials for other systems"><option value="">Other systems…</option>${others.map(({ list }) => `<option value="${escapeHtml(list.id)}"${cur === list ? ' selected' : ''}>${escapeHtml(list.title)}</option>`).join('')}</select>` : '');
  }
}
const listShortName = (list) => list.title.replace(/ essentials$/, '');
function systemLists() {
  const mine = libraryPlatforms();
  return discoverLists().filter((l) => l.kind === 'system').map((list) => ({ list, mine: expandPlatforms(list.platforms).some((p) => mine.has(p)), n: library.filter((g) => expandPlatforms(list.platforms).includes(g.platform)).length })).sort((a, b) => b.mine - a.mine || b.n - a.n);
}
function currentSystemList() { const u = ui(), sys = systemLists(); return (sys.find((x) => x.list.id === u.list) || sys[0])?.list || null; }
const textOf = (s) => norm(`${s.title} ${s.why || ''} ${(s.platforms || []).join(' ')}`);
function listPanel(list) {
  const u = ui(), q = discSearch(), p = listProgress(list), all = listItems(list).map(itemState), test = FILTER_TEST[u.filter] || FILTER_TEST.all;
  const keep = (s) => test(s) && (!q || textOf(s).includes(q)), core = all.filter((s, i) => i < (list.size || all.length)), extra = all.slice(list.size || all.length);
  const rows = (arr, offset) => arr.map((s, i) => [s, i + offset]).filter(([s]) => keep(s)).map(([s, i]) => discRow(s, { n: i + 1 })).join('');
  const coreRows = rows(core, 0), extraRows = rows(extra, core.length);
  return `<section class="disc-list-head"><div><h2>${escapeHtml(list.title)}</h2><p class="muted">${escapeHtml(list.blurb || '')}</p><p class="disc-editorial">${escapeHtml(list.note || '')}</p></div><div class="goal-score"><strong>${p.have}/${p.counted}</strong><span>${p.beaten} beaten</span></div></section>${meter(p.have, p.counted, `${p.have} of ${p.counted} collected`)}<p class="disc-sum small muted">${p.inLib} in your library · ${p.played} played · ${p.beaten} beaten · ${p.wanted} wanted${p.hidden ? ` · ${p.hidden} skipped or not interested (not counted)` : ''}</p><div class="disc-goal-actions">${goalButtons('list', list.id)}</div>` +
    (coreRows ? `<div class="quest-list">${coreRows}</div>` : `<div class="empty-state small-empty"><p>No picks match this filter.</p></div>`) +
    (extraRows ? `<h3 class="disc-sub">Also worth a look <span class="muted small">(not counted toward the list's ${list.size} essentials)</span></h3><div class="quest-list">${extraRows}</div>` : '');
}
function franchisePanel() {
  const u = ui(), q = discSearch(), test = FR_TEST[u.filter] || FR_TEST.all;
  const items = discoverFranchises().map((f) => { const series = SERIES.find((s) => s.name === f.series); return { f, series, st: seriesStatus(series) }; })
    .filter(({ f, series, st }) => test(st) && (!q || norm(`${series.name} ${f.why} ${series.entries.map((e) => e.title).join(' ')}`).includes(q)));
  if (!items.length) return `<div class="empty-state small-empty"><p>No franchises match.</p></div>`;
  return `<div class="disc-franchises">${items.map(({ f, series, st }) => {
    const states = st.entries.map((e) => entryState(series, e)), sum = summarize(states), open = u.open.has(series.name), stack = st.entries.filter((e) => e.game).slice(0, 3);
    return `<details class="disc-franchise${st.started ? ' started' : ''}" data-fr="${escapeHtml(series.name)}"${open ? ' open' : ''}><summary><div class="series-stack">${stack.length ? stack.map((e) => cover(e.game, 'stack')).join('') : series.entries.slice(0, 3).map((e) => entryCover(series, e, 'stack ghost')).join('')}</div><div class="df-head"><h3>${escapeHtml(series.name)}</h3><p class="df-why">${escapeHtml(f.why)}</p>${meter(sum.have, sum.counted, `${sum.have} of ${sum.counted} collected`)}<p class="small muted">You have ${sum.have} of ${sum.counted} · ${sum.played} played · ${sum.beaten} beaten${sum.wanted ? ` · ${sum.wanted} wanted` : ''}</p></div></summary>
      <div class="df-body">${f.key.length ? `<p class="small">Good places to start: ${f.key.map((k) => `<b>${escapeHtml(k)}</b>`).join(', ')}.</p>` : ''}<div class="quest-list">${states.map((s, i) => discRow(s, { n: i + 1, star: f.key.includes(s.title) })).join('')}</div><div class="disc-goal-actions"><button class="mini-button" data-fr-quest="${enc(series.name)}">Open in Series Quest →</button>${goalButtons('series', series.name)}</div></div></details>`;
  }).join('')}</div>`;
}
function goalsPanel() {
  const cards = collection.goals.map((goal) => {
    const p = goalProgress(goal); if (!p) return `<article class="goal-card missing-goal"><p>This goal's list is no longer available.</p><button class="mini-button" data-goal-remove="${escapeHtml(goal.id)}">Remove</button></article>`;
    const beat = goal.measure === 'beat', complete = p.counted && p.done >= p.counted;
    const detail = beat ? `${p.beaten} beaten · ${p.states.filter((s) => ['playing', 'on-hold', 'started'].includes(s.state)).length} in progress · ${p.states.filter((s) => s.state === 'owned').length} in library, not started · ${p.counted - p.have} not in library`
      : `${p.inLib} in your library · ${p.states.filter((s) => s.state === 'have').length} owned elsewhere · ${p.wanted} wanted · ${p.counted - p.have} still to find`;
    const nextLabel = complete ? '' : beat ? (p.next[0]?.game ? 'Play next' : 'Find next') : 'Find next';
    return `<article class="goal-card${complete ? ' complete' : ''}"><div class="gc-head"><div><p class="eyebrow">${beat ? '🏁 BEAT THEM ALL' : '🎯 COLLECT THEM ALL'}</p><h3>${escapeHtml(goalTitle(goal, p))}</h3></div><div class="goal-score"><strong>${p.done}/${p.counted}</strong><span>${beat ? 'beaten' : 'collected'}</span></div></div>${meter(p.done, p.counted, `${p.done} of ${p.counted} ${beat ? 'beaten' : 'collected'}`)}<p class="small muted">${detail}${p.hidden ? ` · ${p.hidden} skipped (not counted)` : ''}</p>${complete ? '<p class="gc-done">Goal complete. Nicely done! ★</p>' : `<p class="gc-next-label small">${nextLabel}</p><div class="quest-list">${p.next.map((s) => discRow(s, { compact: true })).join('')}</div>`}<div class="gc-actions"><button class="text-button small" data-goal-open="${escapeHtml(goal.id)}">See the full list →</button><button class="text-button small" data-goal-remove="${escapeHtml(goal.id)}" aria-label="Remove goal ${escapeHtml(goalTitle(goal, p))}">Remove goal</button></div></article>`;
  }).join('');
  const sugg = suggestedGoals().map((g) => { const src = goalSource(g); return src ? `<article class="goal-card suggestion"><p class="eyebrow">SUGGESTED GOAL</p><h3>${escapeHtml(goalTitle(g, src))}</h3><p class="small muted">${escapeHtml(g.why)}</p><button class="mini-button on" data-goal-add="${g.type}" data-goal-ref="${escapeHtml(g.ref)}" data-goal-measure="${g.measure}">Add this goal</button></article>` : ''; }).join('');
  return (cards ? `<div class="goal-cards">${cards}</div>` : `<div class="empty-state small-empty"><div class="empty-icon">🎯</div><p>No goals yet. Add a suggested goal below, or use <b>Goal: collect them</b> / <b>Goal: beat them</b> on any franchise or list.</p></div>`) +
    (sugg ? `<h3 class="disc-sub">Suggested goals</h3><div class="goal-cards">${sugg}</div>` : '');
}
/* Want list: Discover picks and Series Quest entries you've marked as wanted (one row per game). */
function wantedStates() {
  const out = [], seen = new Set();
  for (const it of discoverItems().all) { if (seen.has(it.key)) continue; const s = itemState(it); if (s.state === 'want') { seen.add(it.key); out.push(s); } }
  for (const h of huntList()) { const key = `s:${h.series.name}::${h.entry.title}`; if (seen.has(key)) continue; seen.add(key); const e = seriesStatus(h.series).entries.find((x) => x.entry === h.entry); if (e) out.push(entryState(h.series, e, `Series Quest: ${h.series.name}`)); }
  return out;
}
function wantPanel() {
  const q = discSearch(), rows = wantedStates().filter((s) => !q || textOf(s).includes(q));
  return rows.length ? `<div class="disc-goal-actions"><button class="mini-button" id="copyWantButton">Copy want list</button></div><div class="quest-list">${rows.map((s) => discRow(s)).join('')}</div>` : `<div class="empty-state small-empty"><div class="empty-icon">＋</div><p>Your want list is empty. Use <b>＋ Want</b> on any game you don't have.</p></div>`;
}
function renderDiscoverPanel() {
  const u = ui(), panel = $('#discoverPanel');
  if (!window.DISCOVERY) { panel.innerHTML = '<div class="empty-state small-empty"><p>Discover lists could not be loaded.</p></div>'; return; }
  panel.innerHTML = u.tab === 'goals' ? goalsPanel() : u.tab === 'franchises' ? franchisePanel() : u.tab === 'classics' ? listPanel(discoverLists().find((l) => l.id === 'classics')) : u.tab === 'systems' ? (currentSystemList() ? listPanel(currentSystemList()) : '') : wantPanel();
  hydrateArt(panel);
}
function renderDiscover() {
  if (!$('#discoverView')) return;
  $('#discoverLibraryNote').classList.toggle('hidden', !library.length);
  renderDiscoverStats(); renderDiscoverBar(); renderDiscoverPanel();
  if (pendingDiscoverFocus) { const uid = pendingDiscoverFocus; pendingDiscoverFocus = null; ($(`#discoverPanel [data-drow="${CSS.escape(uid)}"] button`) || $('#discoverTabs .active'))?.focus(); }
}
/* A short goal strip on the dashboard. Only shown when you have goals. */
function renderGoalsMini() {
  const el = $('#goalsMini'); if (!el) return;
  const goals = collection.goals.map((g) => ({ g, p: goalProgress(g) })).filter((x) => x.p).slice(0, 3);
  el.classList.toggle('hidden', !goals.length);
  $('#goalsMiniList').innerHTML = goals.map(({ g, p }) => `<button class="goal-mini" data-goal-open="${escapeHtml(g.id)}"><span><b>${escapeHtml(goalTitle(g, p))}</b><small>${p.done} of ${p.counted} ${g.measure === 'beat' ? 'beaten' : 'collected'}${p.next[0] ? ` · next: ${escapeHtml(p.next[0].title)}` : ''}</small></span>${meter(p.done, p.counted, `${p.done} of ${p.counted}`)}</button>`).join('');
}
function copyWantList() {
  const text = wantedStates().map((s) => `☐ ${s.title}${s.series ? ` (${s.series.name})` : ''} [${expandPlatforms(s.platforms).map(shortPlatform).slice(0, 4).join(', ')}]`).join('\n');
  (navigator.clipboard?.writeText(text) || Promise.reject()).then(() => toast('Want list copied')).catch(() => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' })); a.download = 'checkpoint-want-list.txt'; a.click(); toast('Want list downloaded'); });
}

/* ---------- events ---------- */
document.addEventListener('click', (e) => {
  const dm = e.target.closest('[data-dmark]');
  if (dm) {
    const v = dm.dataset.dmark, row = dm.closest('[data-drow]');
    pendingDiscoverFocus = row?.dataset.drow || null;
    let title = '';
    if (dm.dataset.dkey) { const it = discoverItems().byUid.get(dm.dataset.dkey); if (!it) return; title = it.title; setDiscoverMark(it, v); }
    else if (dm.dataset.series) { title = decodeURIComponent(dm.dataset.entry); setMark(decodeURIComponent(dm.dataset.series), title, v); }
    toast(MARK_TOAST[v]?.(title) || 'Updated');
    // renderAll() has redrawn Discover (and focused the row). Elsewhere, e.g. a dashboard suggestion
    // that just disappeared, keep keyboard focus nearby.
    if (!discVisible()) { pendingDiscoverFocus = null; if (!document.activeElement || document.activeElement === document.body) ($('#forYou button') || $('#forYouFocus'))?.focus(); }
    return;
  }
  const tab = e.target.closest('[data-dtab]'); if (tab) { const u = ui(); u.tab = tab.dataset.dtab; u.filter = 'all'; saveUI(); renderDiscover(); $(`#discoverTabs [data-dtab="${u.tab}"]`)?.focus(); return; }
  const dl = e.target.closest('[data-dlist]'); if (dl) { const u = ui(); u.list = dl.dataset.dlist; saveUI(); renderDiscover(); $(`#discoverLists [data-dlist="${CSS.escape(u.list)}"]`)?.focus(); return; }
  const ga = e.target.closest('[data-goal-add]'); if (ga) { addGoal(ga.dataset.goalAdd, ga.dataset.goalRef, ga.dataset.goalMeasure); return; }
  const gr = e.target.closest('[data-goal-remove]'); if (gr) { removeGoal(gr.dataset.goalRemove); $('#discoverTabs .active')?.focus(); return; }
  const go = e.target.closest('[data-goal-open]');
  if (go) {
    const goal = collection.goals.find((g) => g.id === go.dataset.goalOpen); if (!goal) return;
    if (goal.type === 'series') { activeSeriesName = goal.ref; route('recommendations'); return; }
    const u = ui(); if (goal.ref === 'classics') u.tab = 'classics'; else { u.tab = 'systems'; u.list = goal.ref; } u.filter = 'all'; saveUI(); route('discover'); return;
  }
  const fq = e.target.closest('[data-fr-quest]'); if (fq) { activeSeriesName = decodeURIComponent(fq.dataset.frQuest); route('recommendations'); return; }
  if (e.target.closest('#copyWantButton')) copyWantList();
});
document.addEventListener('toggle', (e) => { const d = e.target; if (d.matches?.('details[data-fr]')) { const u = ui(); if (d.open) u.open.add(d.dataset.fr); else u.open.delete(d.dataset.fr); } }, true);
document.addEventListener('change', (e) => {
  if (e.target.id === 'discoverFilter') { ui().filter = e.target.value; saveUI(); renderDiscoverPanel(); }
  if (e.target.id === 'discoverListMore' && e.target.value) { ui().list = e.target.value; saveUI(); renderDiscover(); $('#discoverListMore')?.focus(); }
});
let discoverSearchTimer;
document.addEventListener('input', (e) => { if (e.target.id === 'discoverSearch') { clearTimeout(discoverSearchTimer); discoverSearchTimer = setTimeout(renderDiscoverPanel, 150); } });
