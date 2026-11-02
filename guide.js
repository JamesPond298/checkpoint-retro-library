/* Checkpoint guide reader.
 *
 * Most guide sites (GameFAQs, YouTube, Google) refuse to be shown inside another
 * site, so they can only open in a new tab. StrategyWiki is a free walkthrough wiki
 * whose MediaWiki API allows cross-site reads, so its guides can be fetched and shown
 * right here: chapters in a sidebar, previous/next navigation, your notes alongside,
 * and the last chapter + scroll position remembered per game.
 */
(function () {
  const API = "https://strategywiki.org/w/api.php";
  const SITE = "https://strategywiki.org";
  const STORE = "checkpoint.guides.v1";
  const SIZE_KEY = "checkpoint.guidesize.v1";
  const readJSON = (k, f) => { try { return JSON.parse(localStorage.getItem(k)) ?? f; } catch { return f; } };
  const writeJSON = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } };
  let store = readJSON(STORE, {});
  const $ = (s) => document.querySelector(s);
  const esc = (s = "") => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  /* ---------- API ---------- */
  const pageCache = new Map();
  async function api(params) {
    const url = new URL(API);
    Object.entries({ format: "json", formatversion: 2, origin: "*", ...params }).forEach(([k, v]) => url.searchParams.set(k, v));
    const res = await fetch(url);
    if (!res.ok) throw new Error(`StrategyWiki answered ${res.status}`);
    const data = await res.json();
    if (data.error) throw new Error(data.error.info || "StrategyWiki error");
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
    for (const q of queries) {
      try {
        const [, titles] = await api({ action: "opensearch", search: q, limit: 10, namespace: 0, redirects: "resolve" });
        titles.forEach((t) => roots.set(t.split("/")[0], true));
      } catch { /* try the next source */ }
      try {
        const d = await api({ action: "query", list: "search", srsearch: q, srnamespace: 0, srlimit: 10 });
        (d.query?.search || []).forEach((r) => roots.set(r.title.split("/")[0], true));
      } catch { /* ignore */ }
      if (roots.size >= 8) break;
    }
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
    out.push(game.title.replace(/\s*[([][^)\]]*[)\]]/g, "").replace(/^\d{3,4}\s*-?\s*/, "").trim());
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
  let game = null, hooks = {}, guide = null, current = null, saveTimer = null, loadToken = 0;
  const dialog = () => $("#guideReader");
  const content = () => $("#readerContent");
  const remember = (patch) => { if (!game) return; store[game.id] = { ...(store[game.id] || {}), ...patch }; writeJSON(STORE, store); };
  function setSize(n) { const size = Math.min(22, Math.max(13, n)); dialog().style.setProperty("--reader-size", `${size}px`); writeJSON(SIZE_KEY, size); }

  async function open(g, h = {}) {
    game = g; hooks = h; guide = null; current = null;
    $("#readerGame").textContent = g.title;
    $("#readerTitle").textContent = "Finding a guide…";
    $("#readerToc").innerHTML = "";
    $("#readerSource").href = SITE;
    $("#readerNotesText").value = h.getNotes?.() || "";
    $("#readerFallback").innerHTML = fallbackLinks(g);
    setSize(readJSON(SIZE_KEY, 16));
    dialog().classList.remove("toc-open");
    if (!dialog().open) dialog().showModal();
    content().focus({ preventScroll: true });
    const saved = store[g.id];
    if (saved?.root) return loadGuide(saved.root, saved.page || saved.root, saved.scroll || 0);
    return pickGuide();
  }

  function fallbackLinks(g) {
    const q = encodeURIComponent(`${g.title} ${hooks.platformName || ""}`.trim());
    return `<span>Other sources open in a new tab:</span>
      <a class="chip-link" href="https://gamefaqs.gamespot.com/search?game=${encodeURIComponent(g.title)}" target="_blank" rel="noopener">GameFAQs ↗</a>
      <a class="chip-link" href="https://www.youtube.com/results?search_query=${q}%20walkthrough" target="_blank" rel="noopener">YouTube ↗</a>
      <a class="chip-link" href="https://www.google.com/search?q=${q}%20walkthrough%20guide" target="_blank" rel="noopener">Web search ↗</a>`;
  }

  async function pickGuide(query) {
    const token = ++loadToken;
    $("#readerTitle").textContent = "Choose a guide";
    $("#readerToc").innerHTML = "";
    content().innerHTML = `<div class="reader-picker"><p class="muted">Searching StrategyWiki…</p></div>`;
    let results = [];
    let failed = null;
    try { results = await findGuides(query ? [query] : queriesFor(game)); } catch (e) { failed = e; }
    if (token !== loadToken) return;
    if (!query && results[0]?.score >= 0.95) return loadGuide(results[0].title, results[0].title, 0);
    const list = results.slice(0, 12).map((r) => `<button class="reader-result" data-pick="${esc(r.title)}"><b>${esc(r.title)}</b><span>${r.score >= 0.95 ? "Best match" : ""}</span></button>`).join("");
    content().innerHTML = `<div class="reader-picker">
      <h3>${results.length ? "Which guide is this game?" : failed ? "Couldn't reach StrategyWiki" : "No StrategyWiki guide found yet"}</h3>
      <p class="muted">${failed ? "Check your connection and try again, or use one of the other sources below." : results.length ? "Pick the right one and Checkpoint will remember it for this game." : "Try a shorter or different title, like the main name without the subtitle."}</p>
      <form class="reader-search" id="readerSearchForm"><label class="search"><span aria-hidden="true">⌕</span><input id="readerSearch" type="search" value="${esc(query || queriesFor(game)[0] || game.title)}" aria-label="Search StrategyWiki"></label><button class="button primary small">Search</button></form>
      <div class="reader-results">${list}</div>
    </div>`;
    $("#readerSearchForm").onsubmit = (e) => { e.preventDefault(); pickGuide($("#readerSearch").value.trim()); };
  }

  async function loadGuide(root, page, scroll) {
    const token = ++loadToken;
    guide = { root, pages: [root] };
    remember({ root });
    $("#readerTitle").textContent = root;
    $("#readerSource").href = `${SITE}/wiki/${encodeURIComponent(root.replace(/ /g, "_"))}`;
    content().innerHTML = `<p class="muted reader-loading">Loading guide…</p>`;
    try {
      const [rootPage, subs] = await Promise.all([parsePage(root), subpages(root).catch(() => [])]);
      if (token !== loadToken) return;
      // Chapter order follows the guide's own table of contents, then any other subpages.
      const ordered = sanitize(rootPage.html).links.filter((t) => t.startsWith(`${root}/`) && subs.includes(t));
      guide.pages = [root, ...new Set([...ordered, ...subs.filter((t) => !/\/(Credits|Gallery|Trivia|Version differences)$/i.test(t))])];
      renderToc();
      await showPage(page, scroll);
    } catch (e) {
      if (token !== loadToken) return;
      content().innerHTML = `<div class="reader-picker"><h3>This guide couldn't be loaded</h3><p class="muted">${esc(e.message)}</p><button class="button ghost small" id="readerRetry">Try again</button> <button class="button ghost small" data-reader-change>Choose another guide</button></div>`;
      $("#readerRetry").onclick = () => loadGuide(root, page, scroll);
    }
  }

  const chapterName = (t) => (t === guide.root ? "Overview" : t.slice(guide.root.length + 1).replace(/\//g, " › "));
  function renderToc() {
    $("#readerToc").innerHTML = `<p class="reader-toc-head">Chapters <b>${guide.pages.length}</b></p>` +
      guide.pages.map((t) => `<button class="toc-item${t === current ? " active" : ""}" data-wiki="${esc(t)}">${esc(chapterName(t))}</button>`).join("") +
      `<button class="toc-item toc-change" data-reader-change>Wrong guide? Choose another…</button>`;
  }

  async function showPage(title, scroll = 0, anchor = null) {
    const token = ++loadToken;
    if (!guide) guide = { root: title.split("/")[0], pages: [title] };
    content().innerHTML = `<p class="muted reader-loading">Loading ${esc(title)}…</p>`;
    try {
      const page = await parsePage(title);
      if (token !== loadToken) return;
      current = page.title;
      const { html } = sanitize(page.html);
      const idx = guide.pages.indexOf(current);
      const prev = idx > 0 ? guide.pages[idx - 1] : null, next = idx >= 0 && idx < guide.pages.length - 1 ? guide.pages[idx + 1] : null;
      const nav = `<nav class="reader-pager">${prev ? `<button class="button ghost" data-wiki="${esc(prev)}">← ${esc(chapterName(prev))}</button>` : "<span></span>"}${next ? `<button class="button primary" data-wiki="${esc(next)}">${esc(chapterName(next))} →</button>` : ""}</nav>`;
      content().innerHTML = `<p class="reader-crumb">${idx >= 0 ? `Chapter ${idx + 1} of ${guide.pages.length}` : "StrategyWiki"}</p><h1 class="reader-h1">${esc(current.includes("/") ? chapterName(current) : current)}</h1><div class="wiki">${html}</div>${nav}<p class="reader-credit">Guide text from <a href="${SITE}/wiki/${encodeURIComponent(current.replace(/ /g, "_"))}" target="_blank" rel="noopener">StrategyWiki</a>, available under CC BY-SA.</p>`;
      $("#readerSource").href = `${SITE}/wiki/${encodeURIComponent(current.replace(/ /g, "_"))}`;
      renderToc();
      dialog().classList.remove("toc-open");
      const target = anchor && content().querySelector(`[id="${CSS.escape(anchor)}"]`);
      if (target) target.scrollIntoView(); else content().scrollTop = scroll;
      remember({ page: current, scroll: content().scrollTop });
    } catch (e) {
      if (token !== loadToken) return;
      content().innerHTML = `<div class="reader-picker"><h3>Couldn't load this chapter</h3><p class="muted">${esc(e.message)}</p></div>`;
    }
  }

  /* ---------- events ---------- */
  function init() {
    const d = dialog();
    if (!d) return;
    d.addEventListener("click", (e) => {
      const pick = e.target.closest("[data-pick]");
      if (pick) { store[game.id] = {}; loadGuide(pick.dataset.pick, pick.dataset.pick, 0); return; }
      if (e.target.closest("[data-reader-change]")) { pickGuide(); return; }
      const anchor = e.target.closest("a[data-anchor]:not([data-wiki])");
      if (anchor) { e.preventDefault(); content().querySelector(`[id="${CSS.escape(anchor.dataset.anchor)}"]`)?.scrollIntoView({ behavior: "smooth" }); return; }
      const wiki = e.target.closest("[data-wiki]");
      if (wiki) {
        e.preventDefault();
        const title = wiki.dataset.wiki;
        if (guide && title !== guide.root && !title.startsWith(`${guide.root}/`) && !guide.pages.includes(title)) guide.pages.push(title);
        showPage(title, 0, wiki.dataset.anchor || null);
        return;
      }
      if (e.target === d) d.close();          // click on the backdrop
    });
    content().addEventListener("scroll", () => { clearTimeout(saveTimer); saveTimer = setTimeout(() => current && remember({ page: current, scroll: Math.round(content().scrollTop) }), 300); }, { passive: true });
    $("#readerClose").onclick = () => d.close();
    $("#readerChange").onclick = () => pickGuide();
    $("#readerTocToggle").onclick = () => d.classList.toggle("toc-open");
    $("#readerNotesToggle").onclick = () => d.classList.toggle("notes-toggled");
    $("#readerSmaller").onclick = () => setSize(readJSON(SIZE_KEY, 16) - 1);
    $("#readerBigger").onclick = () => setSize(readJSON(SIZE_KEY, 16) + 1);
    let notesTimer;
    $("#readerNotesText").addEventListener("input", (e) => { clearTimeout(notesTimer); notesTimer = setTimeout(() => hooks.setNotes?.(e.target.value), 500); });
    d.addEventListener("close", () => { hooks.setNotes?.($("#readerNotesText").value); hooks.onClose?.(); loadToken++; });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();

  window.CheckpointGuide = { open, hasGuide: (id) => Boolean(store[id]?.root), _test: { sanitize, prettyCatalogName } };
})();
