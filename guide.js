/* Checkpoint guide reader.
 *
 * Most guide sites (GameFAQs, YouTube, Google) refuse to be shown inside another
 * site, so they can only open in a new tab. StrategyWiki is a free walkthrough wiki
 * whose MediaWiki API allows cross-site reads, so its guides can be fetched and shown
 * right here: chapters in a sidebar (or a bottom bar on phones), previous/next
 * navigation, your checkpoint and notes alongside, and the last chapter + scroll
 * position remembered per game. You can also mark a spot and jump back to it.
 *
 * Content shown here is always StrategyWiki's own text, labelled as such. Checkpoint
 * never writes or summarizes walkthrough content.
 */
(function () {
  const API = "https://strategywiki.org/w/api.php";
  const SITE = "https://strategywiki.org";
  const STORE = "checkpoint.guides.v1";
  const SIZE_KEY = "checkpoint.guidesize.v1";
  const SOURCE_NAME = "StrategyWiki";
  const readJSON = (k, f) => { try { return JSON.parse(localStorage.getItem(k)) ?? f; } catch { return f; } };
  const writeJSON = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } };
  const $ = (s) => document.querySelector(s);
  const esc = (s = "") => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const wikiUrl = (t) => `${SITE}/wiki/${encodeURIComponent(t.replace(/ /g, "_")).replace(/%2F/g, "/")}`;

  /* ---------- stored state (per game) ----------
   * { root, page, scroll, chapter, chapters[], spot:{page,scroll,chapter,at}, none, updatedAt }
   * Older entries only had root/page/scroll; they're still valid. */
  const str = (v, n = 300) => (typeof v === "string" ? v.slice(0, n) : "");
  const num = (v) => (Number.isFinite(v) && v >= 0 ? Math.round(v) : 0);
  function normalizeEntry(e) {
    if (!e || typeof e !== "object") return null;
    const out = {};
    if (str(e.root)) { out.root = str(e.root); out.page = str(e.page) || out.root; out.scroll = num(e.scroll); }
    if (str(e.chapter)) out.chapter = str(e.chapter, 200);
    if (Array.isArray(e.chapters)) out.chapters = e.chapters.filter((c) => typeof c === "string" && c).map((c) => c.slice(0, 200)).slice(0, 200);
    if (e.spot && str(e.spot.page)) out.spot = { page: str(e.spot.page), scroll: num(e.spot.scroll), chapter: str(e.spot.chapter, 200), at: str(e.spot.at, 40) };
    if (e.none && !out.root) out.none = true;
    if (str(e.updatedAt, 40)) out.updatedAt = str(e.updatedAt, 40);
    return Object.keys(out).length ? out : null;
  }
  function normalizeStore(obj) {
    const out = {};
    if (obj && typeof obj === "object" && !Array.isArray(obj)) for (const [id, e] of Object.entries(obj)) { const n = normalizeEntry(e); if (n) out[id] = n; }
    return out;
  }
  let store = normalizeStore(readJSON(STORE, {}));

  /* ---------- API ---------- */
  const pageCache = new Map();
  async function api(params) {
    if (navigator.onLine === false) throw Object.assign(new Error("You appear to be offline."), { offline: true });
    const url = new URL(API);
    Object.entries({ format: "json", formatversion: 2, origin: "*", ...params }).forEach(([k, v]) => url.searchParams.set(k, v));
    const ctrl = new AbortController(), timer = setTimeout(() => ctrl.abort(), 15000);
    let res;
    try { res = await fetch(url, { signal: ctrl.signal }); }
    catch (e) { throw new Error(e.name === "AbortError" ? `${SOURCE_NAME} took too long to answer.` : `Couldn't reach ${SOURCE_NAME}.`); }
    finally { clearTimeout(timer); }
    if (!res.ok) throw new Error(`${SOURCE_NAME} answered ${res.status}.`);
    const data = await res.json();
    if (data.error) throw new Error(data.error.info || `${SOURCE_NAME} error`);
    return data;
  }
  function parsePage(title) {
    if (!pageCache.has(title)) {
      pageCache.set(title, api({ action: "parse", page: title, prop: "text|displaytitle", redirects: 1, disableeditsection: 1, disabletoc: 1 })
        .then((d) => ({ title: d.parse.title, html: d.parse.text }))
        .catch((e) => { pageCache.delete(title); throw e; }));
    }
    return pageCache.get(title);
  }
  async function subpages(root) {
    const d = await api({ action: "query", list: "allpages", apprefix: `${root}/`, apnamespace: 0, aplimit: "max" });
    return (d.query?.allpages || []).map((p) => p.title);
  }
  async function findGuides(queries) {
    const roots = new Map();
    let reached = false, lastError = null;
    for (const q of queries) {
      try {
        const [, titles] = await api({ action: "opensearch", search: q, limit: 10, namespace: 0, redirects: "resolve" });
        reached = true;
        titles.forEach((t) => roots.set(t.split("/")[0], true));
      } catch (e) { lastError = e; }
      try {
        const d = await api({ action: "query", list: "search", srsearch: q, srnamespace: 0, srlimit: 10 });
        reached = true;
        (d.query?.search || []).forEach((r) => roots.set(r.title.split("/")[0], true));
      } catch (e) { lastError = e; }
      if (roots.size >= 8) break;
    }
    if (!reached && lastError) throw lastError;
    const keys = queries.map(keyOf);
    return [...roots.keys()]
      .map((title) => ({ title, score: keys.includes(keyOf(title)) ? 1 : Math.max(...queries.map((q) => similarity(q, title))) }))
      .sort((a, b) => b.score - a.score);
  }

  /* ---------- matching helpers ---------- */
  const keyOf = (s) => (window.CheckpointArt?.keyOf ? CheckpointArt.keyOf(s) : String(s).toLowerCase().replace(/[^a-z0-9]/g, ""));
  function words(s) { return String(s).toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim().split(" ").filter((w) => w && w !== "the"); }
  function similarity(a, b) { const A = new Set(words(a)), B = new Set(words(b)); let i = 0; A.forEach((w) => B.has(w) && i++); return A.size + B.size ? (2 * i) / (A.size + B.size) : 0; }
  function prettyCatalogName(name) {
    // "Legend of Zelda, The - A Link to the Past (USA)" -> "The Legend of Zelda: A Link to the Past"
    let s = name.replace(/\s*[([][^)\]]*[)\]]/g, "").trim();
    s = s.replace(/^(.*?), (The|A|An)\b/, "$2 $1");
    return s.replace(/ - /, ": ").replace(/_/g, "&");
  }
  function queriesFor(game) {
    const out = [];
    const ref = window.CheckpointArt?.cached?.(game.id);
    if (ref && ref.name) out.push(prettyCatalogName(ref.name), prettyCatalogName(ref.name).split(":")[0]);
    const clean = game.title.replace(/\s*[([][^)\]]*[)\]]/g, "").replace(/^\d{3,4}\s*-?\s*/, "").trim();
    out.push(clean);
    // Long catalog titles ("Pokemon - Yellow Version - Special Pikachu Edition") rarely match a wiki
    // page name, so also try the first two parts without filler words ("Pokemon Yellow"), then the main title.
    const filler = /\b(version|edition|special|collector'?s|limited|deluxe|game)\b/gi;
    for (const base of out.slice()) {
      const parts = base.split(/\s+-\s+|:\s*/).map((p) => p.trim()).filter(Boolean);
      if (parts.length > 1) out.push(parts.slice(0, 2).join(" ").replace(filler, "").replace(/\s+/g, " ").trim(), parts[0]);
      const trimmed = base.replace(filler, "").replace(/\s+/g, " ").trim();
      if (trimmed !== base) out.push(trimmed);
    }
    return [...new Set(out.filter((q) => q && q.length > 1))];
  }

  /* ---------- sanitizing wiki HTML ---------- */
  const ALLOWED = new Set("p h1 h2 h3 h4 h5 h6 ul ol li dl dt dd table thead tbody tfoot tr th td caption a img b strong i em u s br hr span div small sup sub code pre blockquote figure figcaption center abbr".split(" "));
  const DROP = new Set("script style iframe object embed form input button textarea select noscript link meta svg math video audio".split(" "));
  const ATTRS = new Set(["href", "src", "alt", "title", "colspan", "rowspan", "id", "width", "height"]);
  const absolute = (u) => (u.startsWith("//") ? `https:${u}` : u.startsWith("/") ? SITE + u : u);
  function sanitize(html) {
    const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
    const links = [];
    const clean = (node) => {
      for (const child of [...node.childNodes]) {
        if (child.nodeType === 3) continue;
        if (child.nodeType !== 1) { child.remove(); continue; }
        const tag = child.tagName.toLowerCase();
        if (DROP.has(tag) || child.classList.contains("mw-editsection") || child.classList.contains("noprint") || child.classList.contains("mw-empty-elt")) { child.remove(); continue; }
        clean(child);
        if (!ALLOWED.has(tag)) { child.replaceWith(...child.childNodes); continue; }
        for (const attr of [...child.attributes]) if (!ATTRS.has(attr.name)) child.removeAttribute(attr.name);
        if (tag === "img") {
          const src = child.getAttribute("src");
          if (!src || src.startsWith("data:")) { child.remove(); continue; }
          child.setAttribute("src", absolute(src));
          child.setAttribute("loading", "lazy");
        }
        if (tag === "a") {
          const href = child.getAttribute("href") || "";
          const wiki = href.match(/^\/wiki\/([^#?]+)(#.*)?$/) || href.match(/^\/w\/index\.php\?title=([^&#]+)/);
          if (href.startsWith("#")) child.setAttribute("data-anchor", decodeURIComponent(href.slice(1)));
          else if (wiki && !/^(File|Image|Special|Category|Template|Talk|User|StrategyWiki|Help|Media):/i.test(decodeURIComponent(wiki[1]))) {
            const title = decodeURIComponent(wiki[1]).replace(/_/g, " ");
            child.setAttribute("data-wiki", title);
            if (wiki[2]) child.setAttribute("data-anchor", decodeURIComponent(wiki[2].slice(1)));
            child.setAttribute("href", `${SITE}/wiki/${wiki[1]}`);
            links.push(title);
          } else if (/^(https?:)?\/\//.test(href) || href.startsWith("/")) {
            child.setAttribute("href", absolute(href));
            child.setAttribute("target", "_blank");
            child.setAttribute("rel", "noopener");
          } else child.removeAttribute("href");
        }
      }
    };
    const root = doc.body.firstElementChild;
    clean(root);
    return { html: root.innerHTML, links };
  }

  /* ---------- reader state ---------- */
  let game = null, hooks = {}, guide = null, current = null, saveTimer = null, loadToken = 0, statusTimer = null;
  const dialog = () => $("#guideReader");
  const content = () => $("#readerContent");
  const remember = (patch) => {
    if (!game) return;
    const n = normalizeEntry({ ...(store[game.id] || {}), ...patch, updatedAt: new Date().toISOString() });
    if (n) store[game.id] = n; else delete store[game.id];
    writeJSON(STORE, store);
  };
  const saved = () => (game && store[game.id]) || {};
  function setSize(n) { const size = Math.min(22, Math.max(13, n)); dialog().style.setProperty("--reader-size", `${size}px`); writeJSON(SIZE_KEY, size); }
  function say(text) { const el = $("#readerStatus"); el.textContent = text; el.classList.add("show"); clearTimeout(statusTimer); statusTimer = setTimeout(() => el.classList.remove("show"), 2600); }

  function setSourceTag(kind) {
    const tag = $("#readerSourceTag");
    tag.innerHTML = kind === "wiki"
      ? `Source: <b>${SOURCE_NAME}</b> · community-written wiki, CC BY-SA`
      : kind === "manual" ? "No built-in guide · your own checkpoints and links" : "";
    $("#readerSource").classList.toggle("hidden", kind !== "wiki");
    $("#readerMarkSpot").classList.toggle("hidden", kind !== "wiki");
    if (kind !== "wiki") $("#readerJumpSpot").classList.add("hidden");
  }

  async function open(g, h = {}) {
    game = g; hooks = h; guide = null; current = null;
    $("#readerGame").textContent = g.title;
    $("#readerTitle").textContent = "Finding a guide…";
    $("#readerTocList").innerHTML = "";
    $("#readerTocFilter").value = "";
    $("#readerTocTools").classList.add("hidden");
    $("#readerSource").href = SITE;
    setSourceTag("");
    $("#readerNotesText").value = h.getNotes?.() || "";
    $("#readerFallback").innerHTML = fallbackLinks(g);
    renderPlayPanel();
    renderLinks();
    updateDock();
    setSize(readJSON(SIZE_KEY, 16));
    dialog().classList.remove("toc-open");
    if (!dialog().open) dialog().showModal();
    content().focus({ preventScroll: true });
    syncToggles();
    const s = store[g.id];
    if (s?.root) return loadGuide(s.root, s.page || s.root, s.scroll || 0);
    if (s?.none) return showManual();
    return pickGuide(undefined, true);
  }

  function sourceLinks(g) {
    const q = encodeURIComponent(`${g.title} ${hooks.platformName || ""}`.trim());
    return `<a class="chip-link" href="https://gamefaqs.gamespot.com/search?game=${encodeURIComponent(g.title)}" target="_blank" rel="noopener">GameFAQs ↗</a>
      <a class="chip-link" href="https://www.youtube.com/results?search_query=${q}%20walkthrough" target="_blank" rel="noopener">YouTube ↗</a>
      <a class="chip-link" href="https://www.google.com/search?q=${q}%20walkthrough%20guide" target="_blank" rel="noopener">Web search ↗</a>
      <a class="chip-link" href="${SITE}/index.php?search=${encodeURIComponent(g.title)}&fulltext=1" target="_blank" rel="noopener">Search ${SOURCE_NAME} ↗</a>`;
  }
  function fallbackLinks(g) { return `<span>Other sources open in a new tab:</span>${sourceLinks(g)}`; }

  /* ---------- your own links ---------- */
  const userLinks = () => (window.CheckpointPlay ? CheckpointPlay.get(game.id).links : []);
  function linksList(removable) {
    const links = userLinks();
    return links.length ? `<ul class="user-links">${links.map((l) => `<li><a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)} ↗</a><span class="muted small">${esc(new URL(l.url).hostname.replace(/^www\./, ""))}</span>${removable ? `<button type="button" class="cp-icon" data-remove-link="${esc(l.url)}" aria-label="Remove link ${esc(l.label)}">×</button>` : ""}</li>`).join("")}</ul>` : "";
  }
  function renderLinks() {
    const box = $("#readerLinks");
    if (!window.CheckpointPlay) { box.innerHTML = ""; return; }
    box.innerHTML = `<p class="reader-side-label">Your guide links</p>${linksList(true) || `<p class="muted small">None saved yet.</p>`}
      <details class="link-add"><summary>Add a link</summary>${linkForm("side")}</details>`;
  }
  function linkForm(where) {
    return `<div class="link-form" data-link-form="${where}">
      <label><span>Name</span><input type="text" data-link-label maxlength="80" placeholder="e.g. GameFAQs walkthrough by…"></label>
      <label><span>Web address</span><input type="url" data-link-url placeholder="https://" inputmode="url"></label>
      <button type="button" class="button ghost small" data-link-add>Save link</button>
      <p class="muted small" data-link-msg role="status"></p></div>`;
  }
  function addLinkFrom(form) {
    const label = form.querySelector("[data-link-label]").value, url = form.querySelector("[data-link-url]").value;
    const res = CheckpointPlay.addLink(game.id, label, url);
    const msg = form.querySelector("[data-link-msg]");
    if (res.error) { msg.textContent = res.error; form.querySelector("[data-link-url]").focus(); return; }
    renderLinks();
    if ($("#readerManual")) showManual();
    if ($("#readerAltLinks")) $("#readerAltLinks").innerHTML = linksList(true);
    say("Link saved for this game");
  }

  /* ---------- your checkpoint panel ---------- */
  const chapterName = (t) => (!guide || t === guide.root ? "Overview" : t.startsWith(`${guide.root}/`) ? t.slice(guide.root.length + 1).replace(/\//g, " › ") : t);
  // Chapter names offered as locations / checkpoints: the guide's own pages, minus reference pages.
  const NOT_A_CHAPTER = /^(table of contents|contents|index|credits|gallery|trivia|controls|version differences)$/i;
  function chapterList() { return guide ? guide.pages.filter((t) => t !== guide.root).map(chapterName).filter((n) => !NOT_A_CHAPTER.test(n)) : saved().chapters || []; }
  function renderPlayPanel() {
    if (!window.CheckpointPlay || !game) return;
    const el = $("#readerPlay");
    const keepFocus = el.contains(document.activeElement);
    CheckpointPlay.renderEditor(el, game.id, { chapters: chapterList(), compact: true, chapterSource: guide ? `${SOURCE_NAME}: ${guide.root}` : "" });
    renderChapterAction();
    if (keepFocus) el.querySelector("[data-cp-new]")?.focus();
  }
  function renderChapterAction() {
    const box = $("#readerChapterAction");
    if (!window.CheckpointPlay || !guide || !current) { box.innerHTML = ""; return; }
    const name = chapterName(current), loc = CheckpointPlay.get(game.id).location;
    box.innerHTML = loc === name ? `<p class="muted small">📍 Your location matches this chapter.</p>`
      : `<button type="button" class="text-button small" data-set-location>📍 Set “${esc(name)}” as where I am</button>`;
  }

  /* ---------- manual mode (no built-in guide) ---------- */
  function showManual() {
    ++loadToken; guide = null; current = null;
    $("#readerTitle").textContent = "Your own checkpoints";
    $("#readerTocList").innerHTML = "";
    $("#readerTocTools").classList.add("hidden");
    setSourceTag("manual");
    updateDock();
    content().innerHTML = `<div class="reader-picker" id="readerManual">
      <p class="reader-crumb">No built-in guide</p>
      <h3>Track ${esc(game.title)} your way</h3>
      <p class="muted">Checkpoint can't see inside your game or save file, so your location, objective and next steps come from you. Keep them in <b>Your checkpoint</b>${isNarrow() ? " (📍 below)" : " beside this page"}.</p>
      <h4>Your guide links</h4>
      ${linksList(true) || `<p class="muted small">No links saved yet. Paste a walkthrough you trust and it'll be one tap away.</p>`}
      ${linkForm("manual")}
      <h4>Look elsewhere</h4>
      <p class="muted small">These open in a new tab. Most guide sites block being shown inside other sites.</p>
      <div class="reader-alt-links">${sourceLinks(game)}</div>
      <p><button type="button" class="button ghost small" data-reader-change>Search ${SOURCE_NAME} again</button></p>
    </div>`;
    if (isNarrow() && !dialog().classList.contains("notes-toggled")) { /* leave the panel closed; the dock button opens it */ }
  }

  // auto: only on first open, jump straight into an exact title match. "Change guide" always shows the list.
  async function pickGuide(query, auto = false) {
    const token = ++loadToken;
    guide = null; current = null;
    $("#readerTitle").textContent = "Choose a guide";
    $("#readerTocList").innerHTML = "";
    $("#readerTocTools").classList.add("hidden");
    setSourceTag("");
    updateDock();
    content().innerHTML = `<div class="reader-picker"><p class="muted" role="status">Searching ${SOURCE_NAME}…</p></div>`;
    let results = [];
    let failed = null;
    try { results = await findGuides(query ? [query] : queriesFor(game)); } catch (e) { failed = e; }
    if (token !== loadToken) return;
    if (auto && !query && results[0]?.score >= 0.95) return loadGuide(results[0].title, results[0].title, 0);
    const list = results.slice(0, 12).map((r) => `<button class="reader-result" data-pick="${esc(r.title)}"><b>${esc(r.title)}</b><span>${r.score >= 0.95 ? "Best match" : ""}</span></button>`).join("");
    const heading = results.length ? "Which guide is this game?" : failed ? (failed.offline ? "You're offline" : `Couldn't reach ${SOURCE_NAME}`) : `No ${SOURCE_NAME} guide found yet`;
    const help = failed ? `${esc(failed.message)} Your checkpoint and notes still work offline. Try again later, or use one of the options below.`
      : results.length ? "Pick the right one and Checkpoint will remember it for this game."
      : `${SOURCE_NAME} is a volunteer wiki and doesn't cover every game. Try a shorter title (just the main name, without the subtitle), or use the options below.`;
    content().innerHTML = `<div class="reader-picker">
      <h3>${heading}</h3>
      <p class="muted">${help}</p>
      <form class="reader-search" id="readerSearchForm" role="search"><label class="search"><span aria-hidden="true">⌕</span><input id="readerSearch" type="search" value="${esc(query || queriesFor(game)[0] || game.title)}" aria-label="Search ${SOURCE_NAME}"></label><button class="button primary small">${failed ? "Try again" : "Search"}</button></form>
      <div class="reader-results">${list}</div>
      <section class="reader-alt" aria-label="Other options">
        <h4>Look elsewhere</h4>
        <p class="muted small">These open in a new tab.</p>
        <div class="reader-alt-links">${sourceLinks(game)}</div>
        <h4>Save your own guide link</h4>
        <div id="readerAltLinks">${linksList(true)}</div>
        ${linkForm("picker")}
        <h4>Track it yourself</h4>
        <p class="muted small">Skip the built-in guide for this game. You'll still have your location, objective, next steps, notes and links.</p>
        <button type="button" class="button ghost small" data-reader-manual>Use my own checkpoints</button>
      </section>
    </div>`;
    $("#readerSearchForm").onsubmit = (e) => { e.preventDefault(); pickGuide($("#readerSearch").value.trim()); };
  }

  async function loadGuide(root, page, scroll) {
    const token = ++loadToken;
    guide = { root, pages: [root] };
    remember({ root, none: false });
    $("#readerTitle").textContent = root;
    $("#readerSource").href = wikiUrl(root);
    setSourceTag("wiki");
    content().innerHTML = `<p class="muted reader-loading" role="status">Loading guide…</p>`;
    try {
      const [rootPage, subs] = await Promise.all([parsePage(root), subpages(root).catch(() => [])]);
      if (token !== loadToken) return;
      // Chapter order follows the guide's own table of contents, then any other subpages.
      const ordered = sanitize(rootPage.html).links.filter((t) => t.startsWith(`${root}/`) && subs.includes(t));
      guide.pages = [root, ...new Set([...ordered, ...subs.filter((t) => !/\/(Credits|Gallery|Trivia|Version differences)$/i.test(t))])];
      remember({ chapters: chapterList() });
      renderToc();
      renderPlayPanel();
      await showPage(page, scroll);
    } catch (e) {
      if (token !== loadToken) return;
      content().innerHTML = `<div class="reader-picker"><h3>This guide couldn't be loaded</h3><p class="muted">${esc(e.message)} Your checkpoint and notes are still here${isNarrow() ? " (📍 below)" : " on the right"}.</p>
        <p><button class="button ghost small" id="readerRetry">Try again</button> <button class="button ghost small" data-reader-change>Choose another guide</button> <button class="button ghost small" data-reader-manual>Use my own checkpoints</button></p>
        <div class="reader-alt-links">${sourceLinks(game)}</div></div>`;
      $("#readerRetry").onclick = () => loadGuide(root, page, scroll);
    }
  }

  function doneChapters() {
    if (!window.CheckpointPlay || !game) return new Set();
    return new Set(CheckpointPlay.get(game.id).steps.filter((s) => s.done).map((s) => s.text));
  }
  function renderToc() {
    if (!guide) return;
    const done = doneChapters(), spot = saved().spot;
    $("#readerTocCount").textContent = guide.pages.length;
    $("#readerTocTools").classList.remove("hidden");
    $("#readerTocFilterWrap").classList.toggle("hidden", guide.pages.length < 10);
    $("#readerTocList").innerHTML = guide.pages.map((t, i) => {
      const name = chapterName(t), active = t === current;
      return `<li><button class="toc-item${active ? " active" : ""}" data-wiki="${esc(t)}" ${active ? 'aria-current="page"' : ""} data-name="${esc(name.toLowerCase())}">
        <span class="toc-num">${i + 1}</span><span class="toc-name">${esc(name)}</span>${spot?.page === t ? `<span class="toc-mark" title="Your marked spot" aria-label="your marked spot">📍</span>` : ""}${done.has(name) ? `<span class="toc-mark done" title="Checked off in your checkpoint" aria-label="checked off">✓</span>` : ""}
      </button></li>`;
    }).join("") + `<li><button class="toc-item toc-change" data-reader-change>Wrong guide? Choose another…</button></li>`;
    applyTocFilter();
    $("#readerTocList .toc-item.active")?.scrollIntoView({ block: "nearest" });
  }
  function applyTocFilter() {
    const q = $("#readerTocFilter").value.trim().toLowerCase();
    $$("#readerTocList .toc-item[data-name]").forEach((b) => { b.parentElement.hidden = Boolean(q) && !b.dataset.name.includes(q); });
  }
  const $$ = (s) => [...document.querySelectorAll(s)];

  function neighbor(dir) {
    if (!guide || !current) return null;
    const idx = guide.pages.indexOf(current);
    if (idx < 0) return null;
    return guide.pages[idx + dir] || null;
  }
  function updateDock() {
    const has = Boolean(guide && current), idx = has ? guide.pages.indexOf(current) : -1;
    $("#dockCount").textContent = has ? (idx >= 0 ? `Chapter ${idx + 1} of ${guide.pages.length}` : SOURCE_NAME) : guide ? "Loading…" : "Chapters";
    $("#dockName").textContent = has ? chapterName(current) : "";
    $("#dockPrev").disabled = !neighbor(-1);
    $("#dockNext").disabled = !neighbor(1);
    $("#dockChapters").disabled = !guide;
    updateSpotButton();
  }
  function updateSpotButton() {
    const spot = saved().spot, btn = $("#readerJumpSpot");
    const away = Boolean(guide && spot && (spot.page !== current || Math.abs((content().scrollTop || 0) - spot.scroll) > 500));
    btn.classList.toggle("hidden", !away);
    if (spot) btn.title = `Back to your marked spot: ${spot.chapter || spot.page}`;
  }

  async function showPage(title, scroll = 0, anchor = null) {
    const token = ++loadToken;
    if (!guide) guide = { root: title.split("/")[0], pages: [title] };
    content().innerHTML = `<p class="muted reader-loading" role="status">Loading ${esc(chapterName(title))}…</p>`;
    try {
      const page = await parsePage(title);
      if (token !== loadToken) return;
      current = page.title;
      const { html } = sanitize(page.html);
      const idx = guide.pages.indexOf(current);
      const prev = neighbor(-1), next = neighbor(1);
      const nav = `<nav class="reader-pager" aria-label="Previous and next chapter">${prev ? `<button class="button ghost" data-wiki="${esc(prev)}">← ${esc(chapterName(prev))}</button>` : "<span></span>"}${next ? `<button class="button primary" data-wiki="${esc(next)}">${esc(chapterName(next))} →</button>` : ""}</nav>`;
      content().innerHTML = `<p class="reader-crumb">${idx >= 0 ? `Chapter ${idx + 1} of ${guide.pages.length}` : SOURCE_NAME}</p><h1 class="reader-h1" tabindex="-1">${esc(current.includes("/") ? chapterName(current) : current)}</h1><div class="wiki">${html}</div>${nav}<p class="reader-credit">Guide text from <a href="${wikiUrl(current)}" target="_blank" rel="noopener">${SOURCE_NAME}</a>, written by its volunteer editors and available under CC BY-SA. It may contain spoilers and may not match your exact version of the game.</p>`;
      $("#readerSource").href = wikiUrl(current);
      renderToc();
      setToc(false);
      const target = anchor && content().querySelector(`[id="${CSS.escape(anchor)}"]`);
      if (target) target.scrollIntoView(); else content().scrollTop = scroll;
      remember({ page: current, scroll: content().scrollTop, chapter: chapterName(current) });
      updateDock();
      renderChapterAction();
    } catch (e) {
      if (token !== loadToken) return;
      content().innerHTML = `<div class="reader-picker"><h3>Couldn't load this chapter</h3><p class="muted">${esc(e.message)}</p><p><button class="button ghost small" data-wiki="${esc(title)}">Try again</button></p><div class="reader-alt-links">${sourceLinks(game)}</div></div>`;
      updateDock();
    }
  }
  function go(dir) {
    const t = neighbor(dir);
    if (!t) return;
    showPage(t, 0).then(() => content().querySelector(".reader-h1")?.focus({ preventScroll: true }));
  }

  function markSpot() {
    if (!guide || !current) return;
    const chapter = chapterName(current);
    remember({ spot: { page: current, scroll: Math.round(content().scrollTop), chapter, at: new Date().toISOString() } });
    renderToc(); updateSpotButton();
    say(`Spot marked in “${chapter}”`);
  }
  function jumpToSpot() {
    const spot = saved().spot;
    if (!spot) return;
    if (spot.page === current) { content().scrollTop = spot.scroll; updateSpotButton(); say("Back at your spot"); return; }
    showPage(spot.page, spot.scroll).then(() => say("Back at your spot"));
  }

  /* ---------- panels (chapters / your checkpoint) ---------- */
  const isNarrow = () => window.matchMedia("(max-width:760px)").matches;
  const isMid = () => window.matchMedia("(max-width:1100px)").matches;
  function notesVisible() { return getComputedStyle($("#readerNotes")).display !== "none"; }
  function setToc(open) { dialog().classList.toggle("toc-open", open); syncToggles(); if (open) ($("#readerTocList .toc-item.active") || $("#readerTocList .toc-item"))?.focus(); }
  function setNotes(show) {
    // Wide screens show the panel by default ("notes-toggled" hides it); narrower ones overlay it on demand.
    dialog().classList.toggle("notes-toggled", isMid() ? show : !show);
    syncToggles();
    if (show && isMid()) $("#readerNotes [data-cp-field]")?.focus();
  }
  function syncToggles() {
    const n = notesVisible(), t = dialog().classList.contains("toc-open");
    $("#readerNotesToggle").setAttribute("aria-expanded", n);
    $("#dockNotes").setAttribute("aria-expanded", n);
    $("#readerTocToggle").setAttribute("aria-expanded", t);
    $("#dockChapters").setAttribute("aria-expanded", t);
  }

  /* ---------- events ---------- */
  function init() {
    const d = dialog();
    if (!d) return;
    d.addEventListener("click", (e) => {
      const pick = e.target.closest("[data-pick]");
      if (pick) { store[game.id] = {}; loadGuide(pick.dataset.pick, pick.dataset.pick, 0); return; }
      if (e.target.closest("[data-reader-change]")) { pickGuide(); return; }
      if (e.target.closest("[data-reader-manual]")) { store[game.id] = {}; remember({ none: true }); showManual(); if (isMid()) setNotes(true); return; }
      if (e.target.closest("[data-link-add]")) { addLinkFrom(e.target.closest("[data-link-form]")); return; }
      const rm = e.target.closest("[data-remove-link]");
      if (rm) { CheckpointPlay.removeLink(game.id, rm.dataset.removeLink); renderLinks(); if ($("#readerManual")) showManual(); else if ($("#readerAltLinks")) $("#readerAltLinks").innerHTML = linksList(true); say("Link removed"); return; }
      if (e.target.closest("[data-set-location]")) { CheckpointPlay.update(game.id, { location: chapterName(current) }); renderPlayPanel(); say("Location updated"); return; }
      const anchor = e.target.closest("a[data-anchor]:not([data-wiki])");
      if (anchor) { e.preventDefault(); content().querySelector(`[id="${CSS.escape(anchor.dataset.anchor)}"]`)?.scrollIntoView({ behavior: "smooth" }); return; }
      const wiki = e.target.closest("[data-wiki]");
      if (wiki) {
        e.preventDefault();
        const title = wiki.dataset.wiki;
        if (guide && title !== guide.root && !title.startsWith(`${guide.root}/`) && !guide.pages.includes(title)) guide.pages.push(title);
        const fromToc = Boolean(wiki.closest("#readerToc"));
        showPage(title, 0, wiki.dataset.anchor || null).then(() => { if (fromToc || wiki.closest(".reader-pager")) content().querySelector(".reader-h1")?.focus({ preventScroll: true }); });
        return;
      }
      if (e.target === d) d.close();          // click on the backdrop
    });
    d.addEventListener("keydown", (e) => {
      if (e.target.closest("input,textarea,select,[contenteditable]") || e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key === "[" || (e.key === "ArrowLeft" && e.target.closest("#readerContent"))) { e.preventDefault(); go(-1); }
      else if (e.key === "]" || (e.key === "ArrowRight" && e.target.closest("#readerContent"))) { e.preventDefault(); go(1); }
    });
    // Escape closes an open overlay panel first, then the reader.
    d.addEventListener("cancel", (e) => {
      if (d.classList.contains("toc-open")) { e.preventDefault(); setToc(false); $("#dockChapters").offsetParent ? $("#dockChapters").focus() : $("#readerTocToggle").focus(); return; }
      if (isMid() && d.classList.contains("notes-toggled")) { e.preventDefault(); setNotes(false); content().focus(); }
    });
    content().addEventListener("scroll", () => {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => { if (current) { remember({ page: current, scroll: Math.round(content().scrollTop) }); updateSpotButton(); } }, 300);
    }, { passive: true });
    $("#readerClose").onclick = () => d.close();
    $("#readerChange").onclick = () => pickGuide();
    $("#readerTocToggle").onclick = () => setToc(!d.classList.contains("toc-open"));
    $("#dockChapters").onclick = () => setToc(!d.classList.contains("toc-open"));
    $("#dockPrev").onclick = () => go(-1);
    $("#dockNext").onclick = () => go(1);
    $("#readerNotesToggle").onclick = () => setNotes(!notesVisible());
    $("#dockNotes").onclick = () => setNotes(!notesVisible());
    $("#readerNotesClose").onclick = () => { setNotes(false); content().focus(); };
    $("#readerMarkSpot").onclick = markSpot;
    $("#readerJumpSpot").onclick = jumpToSpot;
    $("#readerSmaller").onclick = () => setSize(readJSON(SIZE_KEY, 16) - 1);
    $("#readerBigger").onclick = () => setSize(readJSON(SIZE_KEY, 16) + 1);
    $("#readerTocFilter").addEventListener("input", applyTocFilter);
    $("#readerTocFilter").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); $("#readerTocList li:not([hidden]) .toc-item")?.click(); } });
    window.matchMedia("(max-width:1100px)").addEventListener?.("change", () => { d.classList.remove("notes-toggled"); syncToggles(); });
    let notesTimer;
    $("#readerNotesText").addEventListener("input", (e) => { clearTimeout(notesTimer); notesTimer = setTimeout(() => hooks.setNotes?.(e.target.value), 500); });
    // Ticking off a chapter in your checkpoint updates the ✓ marks in the chapter list.
    document.addEventListener("checkpoint:play", (e) => { if (d.open && game && e.detail?.id === game.id) { renderToc(); renderChapterAction(); renderLinks(); } });
    d.addEventListener("close", () => { if (current) remember({ page: current, scroll: Math.round(content().scrollTop) }); hooks.setNotes?.($("#readerNotesText").value); hooks.onClose?.(); loadToken++; d.classList.remove("toc-open"); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();

  function info(id) { const s = store[id]; return s ? { ...s } : null; }
  window.CheckpointGuide = {
    open,
    hasGuide: (id) => Boolean(store[id]?.root),
    info,
    chapters: (id) => store[id]?.chapters || [],
    exportStore: () => normalizeStore(store),
    importStore: (data) => { if (data === undefined) return; store = normalizeStore(data); writeJSON(STORE, store); },
    SOURCE_NAME,
    _test: { sanitize, prettyCatalogName, normalizeStore },
  };
})();
