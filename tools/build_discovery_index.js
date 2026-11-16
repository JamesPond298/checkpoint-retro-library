/* Check every Discover pick (discovery-data.js) against the Libretro thumbnail catalog,
 * and record where each one was found so the site can show its box art and "released on" chips.
 *
 * Usage: node tools/build_discovery_index.js   (after python tools/build_art_index.py)
 *
 * Picks that can't be found on any of their platforms are listed at the end. That usually means
 * a typo, a missing alias (the catalog uses the US/EU name), or the wrong platform. The site
 * still shows unmatched picks, without art.
 */
const fs = require("fs"), path = require("path"), vm = require("vm");
const root = path.resolve(__dirname, "..");
const sandbox = { localStorage: { getItem: () => null, setItem() {} }, console };
sandbox.window = sandbox;
sandbox.fetch = async (url) => {
  const file = path.join(root, url);
  return fs.existsSync(file) ? { ok: true, json: async () => JSON.parse(fs.readFileSync(file, "utf8")) } : { ok: false };
};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(root, "art.js"), "utf8"), sandbox);
vm.runInContext(fs.readFileSync(path.join(root, "series-data.js"), "utf8") + "\nwindow.SERIES = SERIES;", sandbox);
vm.runInContext(fs.readFileSync(path.join(root, "discovery-data.js"), "utf8"), sandbox);
const { rank, indexesFor } = sandbox.CheckpointArt._test;
const ARCADE = ["ARCADE_MAME", "ARCADE_FBNEO", "NEOGEO"];
const expand = (platforms) => [...new Set(platforms.flatMap((p) => (p === "ARCADE" ? ARCADE : [p])))];

function aliasesFor(item, platform) {
  return [item.title, ...(item.aliases || [])].flatMap((a) => {
    const m = a.match(/^([A-Z0-9_]+)\|(.*)$/);
    return m ? (m[1] === platform ? [m[2]] : []) : [a];
  });
}

(async () => {
  const { DISCOVERY, SERIES } = sandbox;
  const out = {}, missing = [];
  let found = 0, total = 0;
  for (const list of DISCOVERY.lists) {
    for (const item of list.items) {
      const hits = {};
      for (const platform of expand(item.platforms)) {
        const idx = await indexesFor([platform]);
        const hit = idx.length && rank(idx, aliasesFor(item, platform), null, 1, { fuzzyThreshold: 0.92, contain: false })[0];
        const tags = hit ? (hit.idx.names[hit.i].match(/\([^)]*\)|\[[^\]]*\]/g) || []).join(" ") : "";
        if (hit && !/Virtual Console|\b(unl|pirate|hack|proto|prototype|beta|demo|sample|bootleg|aftermarket|homebrew)\b|\[[phbatfo]\d*\]/i.test(tags)) hits[platform] = [hit.idx.system, hit.idx.names[hit.i]];
      }
      total++;
      if (Object.keys(hits).length) { out[`${list.id}|${item.title}`] = hits; found++; }
      else missing.push(`${list.id}: ${item.title} [${item.platforms.join(", ")}]`);
    }
  }
  // Franchise references must point at real Series Quest entries.
  const problems = [];
  for (const f of DISCOVERY.franchises) {
    const s = SERIES.find((x) => x.name === f.series);
    if (!s) { problems.push(`Unknown series: ${f.series}`); continue; }
    for (const k of f.key) if (!s.entries.some((e) => e.title === k)) problems.push(`${f.series}: no entry titled "${k}"`);
  }
  fs.writeFileSync(path.join(root, "art-index", "discovery-index.json"), JSON.stringify(out));
  console.log(`Matched ${found} of ${total} picks to the catalog on at least one platform.`);
  if (missing.length) console.log(`Not found (check spelling, aliases or platform):\n  ${missing.join("\n  ")}`);
  if (problems.length) { console.log(`Franchise problems:\n  ${problems.join("\n  ")}`); process.exitCode = 1; }
})();
