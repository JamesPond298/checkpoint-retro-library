/* Checkpoint play tracker.
 *
 * Per-game "where am I / what next" data that you write yourself:
 *   location   – chapter, area, level, mission… (free text; guide chapter names are offered as suggestions)
 *   objective  – what you were about to do when you stopped
 *   steps      – a short, editable next-step checklist. Steps you add are marked "me";
 *                steps copied from a guide's chapter list are marked "guide" so their source stays visible.
 *   links      – your own guide links (opened in a new tab)
 *
 * Nothing here is generated or inferred: progress summaries are just "done of total" over the
 * checkpoints you created. Everything is stored in this browser only (localStorage) and is
 * included in Export backup.
 */
(function () {
  const KEY = "checkpoint.play.v1";
  const PREFS_KEY = "checkpoint.prefs.v1";
  const SCHEMA_KEY = "checkpoint.schema";
  const SCHEMA_VERSION = 2;
  const LIMITS = { text: 240, location: 120, objective: 240, steps: 80, links: 12, label: 80 };

  const readJSON = (k, f) => { try { return JSON.parse(localStorage.getItem(k)) ?? f; } catch { return f; } };
  let storageOk = true;
  const writeJSON = (k, v) => {
    try { localStorage.setItem(k, JSON.stringify(v)); storageOk = true; return true; }
    catch { if (storageOk) window.dispatchEvent(new CustomEvent("checkpoint:storage-error")); storageOk = false; return false; }
  };
  const esc = (s = "") => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const str = (v, n) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, n) : "");
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const isoOrNull = (v) => (typeof v === "string" && !Number.isNaN(Date.parse(v)) ? v : null);

  function safeUrl(u) {
    try { const x = new URL(String(u).trim()); return /^https?:$/.test(x.protocol) ? x.href : ""; } catch { return ""; }
  }

  /* ---------- normalizing (used on load, on restore, and for every write) ---------- */
  function normalizeStep(s) {
    if (!s || typeof s !== "object") return null;
    const text = str(s.text, LIMITS.text);
    if (!text) return null;
    return {
      id: str(s.id, 40) || uid(),
      text,
      done: Boolean(s.done),
      spoiler: Boolean(s.spoiler),
      source: s.source === "guide" ? "guide" : "me",
      ...(isoOrNull(s.doneAt) && s.done ? { doneAt: s.doneAt } : {}),
    };
  }
  function normalizeLink(l) {
    if (!l || typeof l !== "object") return null;
    const url = safeUrl(l.url);
    if (!url) return null;
    return { label: str(l.label, LIMITS.label) || new URL(url).hostname.replace(/^www\./, ""), url };
  }
  function normalizeEntry(e) {
    if (!e || typeof e !== "object") return null;
    const seen = new Set();
    const steps = (Array.isArray(e.steps) ? e.steps : []).map(normalizeStep).filter((s) => s && !seen.has(s.id) && seen.add(s.id)).slice(0, LIMITS.steps);
    const links = (Array.isArray(e.links) ? e.links : []).map(normalizeLink).filter(Boolean).slice(0, LIMITS.links);
    const out = { location: str(e.location, LIMITS.location), objective: str(e.objective, LIMITS.objective), steps, links };
    if (isoOrNull(e.updatedAt)) out.updatedAt = e.updatedAt;
    if (!out.location && !out.objective && !steps.length && !links.length) return null;
    return out;
  }
  function normalizeStore(obj) {
    const out = {};
    if (obj && typeof obj === "object" && !Array.isArray(obj)) {
      for (const [id, e] of Object.entries(obj)) { const n = normalizeEntry(e); if (n) out[id] = n; }
    }
    return out;
  }
  function normalizePrefs(p) {
    p = p && typeof p === "object" ? p : {};
    const notForMe = {};
    if (p.notForMe && typeof p.notForMe === "object") for (const [id, at] of Object.entries(p.notForMe)) notForMe[id] = isoOrNull(at) || new Date().toISOString();
    return {
      mode: p.mode === "explore" ? "explore" : "focus",
      systems: Array.isArray(p.systems) ? [...new Set(p.systems.filter((s) => typeof s === "string" && s.length < 40))].slice(0, 40) : [],
      hideGaps: Boolean(p.hideGaps),
      hideSpoilers: p.hideSpoilers !== false,
      notForMe,
    };
  }

  /* ---------- migration ----------
   * v1 (no schema key): progress + notes in checkpoint.progress.v1, guide position in checkpoint.guides.v1.
   * v2: adds checkpoint.play.v1 (checkpoints, links) and checkpoint.prefs.v1 (recommendation prefs).
   * Existing keys are left as they are; new stores are validated on every load so a damaged
   * or hand-edited value can't break the app. */
  let play = {}, prefs = {};
  function migrate() {
    const from = Number(readJSON(SCHEMA_KEY, 1)) || 1;
    play = normalizeStore(readJSON(KEY, {}));
    prefs = normalizePrefs(readJSON(PREFS_KEY, {}));
    if (from < SCHEMA_VERSION) {
      writeJSON(KEY, play);
      writeJSON(PREFS_KEY, prefs);
      writeJSON(SCHEMA_KEY, SCHEMA_VERSION);
    }
  }
  migrate();

  /* ---------- store API ---------- */
  const empty = () => ({ location: "", objective: "", steps: [], links: [] });
  function get(id) { const e = play[id]; return e ? { ...e, steps: e.steps.map((s) => ({ ...s })), links: e.links.map((l) => ({ ...l })) } : empty(); }
  function has(id) { return Boolean(play[id]); }
  function commit(id, entry, { silent = false } = {}) {
    const n = normalizeEntry({ ...entry, updatedAt: new Date().toISOString() });
    if (n) play[id] = n; else delete play[id];
    writeJSON(KEY, play);
    if (!silent) document.dispatchEvent(new CustomEvent("checkpoint:play", { detail: { id } }));
    return get(id);
  }
  function update(id, patch, opts) { return commit(id, { ...get(id), ...patch }, opts); }
  function addStep(id, text, { source = "me", spoiler = false } = {}) {
    const e = get(id);
    if (e.steps.length >= LIMITS.steps) return { error: `You can keep up to ${LIMITS.steps} checkpoints per game.` };
    const step = normalizeStep({ id: uid(), text, source, spoiler });
    if (!step) return { error: "Write a short step first." };
    e.steps.push(step);
    return commit(id, e);
  }
  function addSteps(id, texts, opts = {}) {
    const e = get(id), have = new Set(e.steps.map((s) => s.text.toLowerCase()));
    let added = 0;
    for (const t of texts) {
      if (e.steps.length >= LIMITS.steps) break;
      const step = normalizeStep({ id: uid(), text: t, source: opts.source || "me", spoiler: opts.spoiler });
      if (step && !have.has(step.text.toLowerCase())) { e.steps.push(step); have.add(step.text.toLowerCase()); added++; }
    }
    commit(id, e);
    return added;
  }
  function editStep(id, stepId, patch) {
    const e = get(id), s = e.steps.find((x) => x.id === stepId);
    if (!s) return get(id);
    Object.assign(s, patch);
    if ("done" in patch) { if (patch.done) s.doneAt = new Date().toISOString(); else delete s.doneAt; }
    return commit(id, e);
  }
  function removeStep(id, stepId) { const e = get(id); e.steps = e.steps.filter((s) => s.id !== stepId); return commit(id, e); }
  function moveStep(id, stepId, dir) {
    const e = get(id), i = e.steps.findIndex((s) => s.id === stepId), j = i + dir;
    if (i < 0 || j < 0 || j >= e.steps.length) return get(id);
    [e.steps[i], e.steps[j]] = [e.steps[j], e.steps[i]];
    return commit(id, e);
  }
  function clearDone(id) { const e = get(id); e.steps = e.steps.filter((s) => !s.done); return commit(id, e); }
  function addLink(id, label, url) {
    const link = normalizeLink({ label, url });
    if (!link) return { error: "Enter a full web address starting with https://" };
    const e = get(id);
    if (e.links.length >= LIMITS.links) return { error: `You can save up to ${LIMITS.links} links per game.` };
    if (e.links.some((l) => l.url === link.url)) return { error: "That link is already saved." };
    e.links.push(link);
    return commit(id, e);
  }
  function removeLink(id, url) { const e = get(id); e.links = e.links.filter((l) => l.url !== url); return commit(id, e); }

  /* A summary built only from what you entered. percent is null when there are no checkpoints. */
  function summary(id) {
    const e = get(id), total = e.steps.length, done = e.steps.filter((s) => s.done).length;
    return { ...e, total, done, next: e.steps.filter((s) => !s.done), percent: total ? Math.round((done / total) * 100) : null, isEmpty: !e.location && !e.objective && !total };
  }

  /* ---------- preferences ---------- */
  function getPrefs() { return { ...prefs, systems: [...prefs.systems], notForMe: { ...prefs.notForMe } }; }
  function setPrefs(patch) {
    prefs = normalizePrefs({ ...prefs, ...patch });
    writeJSON(PREFS_KEY, prefs);
    document.dispatchEvent(new CustomEvent("checkpoint:prefs"));
    return getPrefs();
  }
  function setNotForMe(id, on) {
    const n = { ...prefs.notForMe };
    if (on) n[id] = new Date().toISOString(); else delete n[id];
    return setPrefs({ notForMe: n });
  }

  /* ---------- backup ---------- */
  function exportAll() { return { play: normalizeStore(play), prefs: getPrefs() }; }
  /* Only replaces what the backup actually contains, so restoring an older (v1) backup
     doesn't wipe checkpoints it never knew about. */
  function importAll(data = {}) {
    if (data.play !== undefined) { play = normalizeStore(data.play); writeJSON(KEY, play); }
    if (data.prefs !== undefined) { prefs = normalizePrefs(data.prefs); writeJSON(PREFS_KEY, prefs); }
    writeJSON(SCHEMA_KEY, SCHEMA_VERSION);
  }

  /* ---------- editor UI ----------
   * One editor, used in the game window, the quick-update dialog and the guide reader.
   * It saves as you type; every control is a real input or button with a label. */
  const revealed = new Set();
  const showDone = new Set();
  let editorSeq = 0;

  function stepHtml(gameId, s, i, count, hideSpoilers) {
    const hidden = s.spoiler && hideSpoilers && !revealed.has(s.id);
    const text = hidden
      ? `<button type="button" class="cp-reveal" data-cp-reveal="${esc(s.id)}" aria-label="Spoiler hidden. Reveal this step">Spoiler · tap to reveal</button>`
      : `<span class="cp-text">${esc(s.text)}</span>`;
    return `<li class="cp-step${s.done ? " done" : ""}${s.spoiler ? " spoiler" : ""}" data-step="${esc(s.id)}">
      <input type="checkbox" id="cp-${esc(gameId)}-${esc(s.id)}-${editorSeq}" data-cp-toggle="${esc(s.id)}" ${s.done ? "checked" : ""}${hidden ? ` aria-label="Spoiler step (hidden)"` : ""}>
      <label for="cp-${esc(gameId)}-${esc(s.id)}-${editorSeq}" class="cp-label">${hidden ? "" : text}</label>${hidden ? text : ""}
      ${s.source === "guide" ? `<span class="cp-src" title="Copied from the guide's chapter list">guide</span>` : ""}
      <span class="cp-tools">
        <button type="button" class="cp-icon" data-cp-move="-1" data-step-id="${esc(s.id)}" ${i === 0 ? "disabled" : ""} aria-label="Move up">↑</button>
        <button type="button" class="cp-icon" data-cp-move="1" data-step-id="${esc(s.id)}" ${i === count - 1 ? "disabled" : ""} aria-label="Move down">↓</button>
        <button type="button" class="cp-icon${s.spoiler ? " on" : ""}" data-cp-spoiler="${esc(s.id)}" aria-pressed="${s.spoiler}" aria-label="${s.spoiler ? "Unmark spoiler" : "Mark as spoiler"}" title="${s.spoiler ? "Marked as spoiler" : "Mark as spoiler"}">⚠</button>
        <button type="button" class="cp-icon" data-cp-remove="${esc(s.id)}" aria-label="Remove step">×</button>
      </span>
    </li>`;
  }

  function stepsHtml(gameId) {
    const sum = summary(gameId), hideSpoilers = prefs.hideSpoilers;
    const open = sum.steps.map((s, i) => [s, i]).filter(([s]) => !s.done);
    const done = sum.steps.map((s, i) => [s, i]).filter(([s]) => s.done);
    const expanded = showDone.has(gameId);
    const list = [...open, ...(expanded ? done : [])].map(([s, i]) => stepHtml(gameId, s, i, sum.steps.length, hideSpoilers)).join("");
    return `<div class="cp-steps-head">
        <b id="cp-steps-${esc(gameId)}-${editorSeq}">Next steps</b>
        <span class="cp-count" aria-live="polite">${sum.total ? `${sum.done} of ${sum.total} done` : "None yet"}</span>
      </div>
      ${sum.total ? `<div class="progress-track cp-bar" role="img" aria-label="${sum.done} of ${sum.total} checkpoints done"><i style="width:${sum.percent}%"></i></div>` : ""}
      <ul class="cp-steps" aria-labelledby="cp-steps-${esc(gameId)}-${editorSeq}">${list || (sum.total ? `<li class="cp-empty">Every step is done. Add the next one below.</li>` : `<li class="cp-empty">Add the next thing you plan to do, like “Get the Boulder Badge” or “Find the key in the basement”.</li>`)}</ul>
      ${done.length ? `<div class="cp-done-bar"><button type="button" class="text-button small" data-cp-showdone aria-expanded="${expanded}">${expanded ? "Hide" : "Show"} ${done.length} done</button>${expanded ? `<button type="button" class="text-button small muted-link" data-cp-cleardone>Clear done steps</button>` : ""}</div>` : ""}`;
  }

  /* chapters: optional array of guide chapter names (only from a guide you picked) */
  function renderEditor(el, gameId, { chapters = [], compact = false, chapterSource = "" } = {}) {
    if (!el) return;
    editorSeq++;
    const e = get(gameId), listId = `cp-chapters-${editorSeq}`;
    el.classList.add("cp-editor");
    el.dataset.cpGame = gameId;
    el.dataset.cpChapters = JSON.stringify(chapters.slice(0, 200));
    el.classList.toggle("compact", compact);
    el.innerHTML = `
      <div class="cp-fields">
        <label class="cp-field"><span>📍 Where am I?</span>
          <input type="text" data-cp-field="location" value="${esc(e.location)}" maxlength="${LIMITS.location}" placeholder="Chapter, area, level or mission" ${chapters.length ? `list="${listId}"` : ""} autocomplete="off">
        </label>
        ${chapters.length ? `<datalist id="${listId}">${chapters.map((c) => `<option value="${esc(c)}"></option>`).join("")}</datalist>` : ""}
        <label class="cp-field"><span>🎯 Current objective</span>
          <input type="text" data-cp-field="objective" value="${esc(e.objective)}" maxlength="${LIMITS.objective}" placeholder="What you were about to do" autocomplete="off">
        </label>
        ${chapters.length ? `<p class="cp-hint">Location suggestions are chapter names from ${esc(chapterSource || "your guide")}.</p>` : ""}
      </div>
      <div class="cp-steps-wrap" data-cp-steps>${stepsHtml(gameId)}</div>
      <div class="cp-add">
        <input type="text" data-cp-new maxlength="${LIMITS.text}" placeholder="Add a next step…" aria-label="Add a next step" autocomplete="off">
        <label class="cp-spoil-new" title="Hide this step until you reveal it"><input type="checkbox" data-cp-new-spoiler> Spoiler</label>
        <button type="button" class="button ghost small" data-cp-add>Add</button>
      </div>
      ${chapters.length > 1 ? `<details class="cp-import"><summary>Use the guide's chapters as checkpoints</summary>
        <p class="muted small">Adds ${chapters.length} chapter names from ${esc(chapterSource || "the guide")} as steps you can tick off. These are the guide's headings, not a verified list of everything in the game.</p>
        <label class="cp-spoil-new"><input type="checkbox" data-cp-import-spoiler checked> Hide chapter names as spoilers</label>
        <button type="button" class="button ghost small" data-cp-import>Add chapters</button></details>` : ""}
      <p class="cp-saved muted small" aria-live="polite">Saves automatically in this browser.</p>`;
  }

  function refreshSteps(el, focusSel) {
    const box = el.querySelector("[data-cp-steps]");
    if (!box) return;
    box.innerHTML = stepsHtml(el.dataset.cpGame);
    if (focusSel) (box.querySelector(focusSel) || el.querySelector("[data-cp-new]"))?.focus();
  }
  /* Re-render every other open editor for the same game (e.g. reader + game window). */
  function syncOthers(source) {
    document.querySelectorAll(".cp-editor").forEach((el) => {
      if (el === source || el.dataset.cpGame !== source.dataset.cpGame) return;
      const e = get(el.dataset.cpGame);
      el.querySelectorAll("[data-cp-field]").forEach((inp) => { if (document.activeElement !== inp) inp.value = e[inp.dataset.cpField] || ""; });
      refreshSteps(el);
    });
  }
  function flash(el, text) { const p = el.querySelector(".cp-saved"); if (p) { p.textContent = text; clearTimeout(p._t); p._t = setTimeout(() => { p.textContent = "Saves automatically in this browser."; }, 2200); } }

  function addFromInput(el) {
    const inp = el.querySelector("[data-cp-new]"), spoiler = el.querySelector("[data-cp-new-spoiler]");
    const res = addStep(el.dataset.cpGame, inp.value, { spoiler: spoiler?.checked });
    if (res.error) { flash(el, res.error); inp.focus(); return; }
    inp.value = ""; if (spoiler) spoiler.checked = false;
    refreshSteps(el); syncOthers(el); flash(el, "Step added"); inp.focus();
  }

  const fieldTimers = new WeakMap();
  document.addEventListener("input", (ev) => {
    const inp = ev.target.closest?.("[data-cp-field]");
    if (!inp) return;
    const el = inp.closest(".cp-editor");
    clearTimeout(fieldTimers.get(inp));
    fieldTimers.set(inp, setTimeout(() => { update(el.dataset.cpGame, { [inp.dataset.cpField]: inp.value }); syncOthers(el); flash(el, "Saved"); }, 450));
  });
  document.addEventListener("change", (ev) => {
    const t = ev.target;
    const inp = t.closest?.("[data-cp-field]");
    if (inp) { clearTimeout(fieldTimers.get(inp)); const el = inp.closest(".cp-editor"); update(el.dataset.cpGame, { [inp.dataset.cpField]: inp.value }); syncOthers(el); return; }
    const tog = t.closest?.("[data-cp-toggle]");
    if (tog) {
      const el = tog.closest(".cp-editor"), id = tog.dataset.cpToggle;
      editStep(el.dataset.cpGame, id, { done: tog.checked });
      refreshSteps(el); syncOthers(el);
      flash(el, tog.checked ? "Nice — step done" : "Step reopened");
      (el.querySelector(`[data-cp-toggle="${CSS.escape(id)}"]`) || el.querySelector("[data-cp-new]"))?.focus();
    }
  });
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter" && ev.target.matches?.("[data-cp-new]")) { ev.preventDefault(); addFromInput(ev.target.closest(".cp-editor")); }
    else if (ev.key === "Enter" && ev.target.matches?.("[data-cp-field]")) { ev.preventDefault(); ev.target.dispatchEvent(new Event("change", { bubbles: true })); }
  });
  document.addEventListener("click", (ev) => {
    const el = ev.target.closest?.(".cp-editor");
    if (!el) return;
    const id = el.dataset.cpGame;
    const btn = (sel) => ev.target.closest(sel);
    let b;
    if (btn("[data-cp-add]")) { addFromInput(el); return; }
    if ((b = btn("[data-cp-reveal]"))) { revealed.add(b.dataset.cpReveal); refreshSteps(el, `[data-cp-toggle="${CSS.escape(b.dataset.cpReveal)}"]`); return; }
    if ((b = btn("[data-cp-remove]"))) { removeStep(id, b.dataset.cpRemove); refreshSteps(el); syncOthers(el); flash(el, "Step removed"); el.querySelector("[data-cp-new]")?.focus(); return; }
    if ((b = btn("[data-cp-move]"))) { const sid = b.dataset.stepId, dir = Number(b.dataset.cpMove); moveStep(id, sid, dir); refreshSteps(el, `[data-step="${CSS.escape(sid)}"] [data-cp-move="${dir}"]:not([disabled])`); syncOthers(el); return; }
    if ((b = btn("[data-cp-spoiler]"))) { const sid = b.dataset.cpSpoiler, s = get(id).steps.find((x) => x.id === sid); if (s) { editStep(id, sid, { spoiler: !s.spoiler }); if (!s.spoiler) revealed.delete(sid); else revealed.add(sid); } refreshSteps(el, `[data-cp-spoiler="${CSS.escape(sid)}"]`); syncOthers(el); return; }
    if (btn("[data-cp-showdone]")) { showDone.has(id) ? showDone.delete(id) : showDone.add(id); refreshSteps(el, "[data-cp-showdone]"); return; }
    if (btn("[data-cp-cleardone]")) { const n = get(id).steps.filter((s) => s.done).length; if (confirm(`Remove ${n} completed step${n === 1 ? "" : "s"}?`)) { clearDone(id); refreshSteps(el); syncOthers(el); flash(el, "Done steps cleared"); } return; }
    if (btn("[data-cp-import]")) {
      let chapters = [];
      try { chapters = JSON.parse(el.dataset.cpChapters || "[]"); } catch { /* ignore */ }
      const n = addSteps(id, chapters, { source: "guide", spoiler: el.querySelector("[data-cp-import-spoiler]")?.checked });
      refreshSteps(el); syncOthers(el);
      flash(el, n ? `Added ${n} chapter${n === 1 ? "" : "s"}` : "Those chapters are already in your list");
      el.querySelector(".cp-import")?.removeAttribute("open");
    }
  });

  window.CheckpointPlay = {
    get, has, update, addStep, addSteps, editStep, removeStep, moveStep, addLink, removeLink, summary,
    prefs: getPrefs, setPrefs, setNotForMe, exportAll, importAll, renderEditor, safeUrl, SCHEMA_VERSION,
    _test: { normalizeEntry, normalizeStore, normalizePrefs },
  };
})();
