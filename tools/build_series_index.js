/* Precompute, for every Series Quest entry, which of its series' systems actually have
 * that game (according to the Libretro thumbnail catalog) and its catalog name there.
 * The site uses this to show "released on" chips, the right box art for games you are
 * missing, and to recognise games whose filenames differ from the series catalog.
 *
 * Usage: node tools/build_series_index.js   (after python tools/build_art_index.py)
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
const { rank, indexesFor } = sandbox.CheckpointArt._test;

function aliasesFor(entry, platform) {
  return entry.aliases.flatMap((a) => {
    const m = a.match(/^([A-Z0-9_]+)\|(.*)$/);
    return m ? (m[1] === platform ? [m[2]] : []) : [a];
  });
}

(async () => {
  const out = {};
  let found = 0, total = 0;
  for (const series of sandbox.SERIES) {
    const bySeries = (out[series.name] = {});
    for (const entry of series.entries) {
      const hits = {};
      for (const platform of series.systems) {
        if (entry.skip?.includes(platform) || (entry.only && !entry.only.includes(platform))) continue;
        const idx = await indexesFor([platform]);
        const hit = idx.length && rank(idx, aliasesFor(entry, platform), null, 1, { fuzzyThreshold: 0.92, contain: false })[0];
        // Skip Virtual Console re-releases: they are not the console the game came out on.
        // and unofficial releases (bootlegs, hacks, prototypes) are not real releases either.
        const tags = hit ? (hit.idx.names[hit.i].match(/\([^)]*\)|\[[^\]]*\]/g) || []).join(' ') : '';
        if (hit && !/Virtual Console|\b(unl|pirate|hack|proto|prototype|beta|demo|sample|bootleg|aftermarket|homebrew)\b|\[[phbatfo]\d*\]/i.test(tags)) hits[platform] = [hit.idx.system, hit.idx.names[hit.i]];
      }
      total++;
      if (Object.keys(hits).length) { bySeries[entry.title] = hits; found++; }
    }
  }
  fs.writeFileSync(path.join(root, "art-index", "series-index.json"), JSON.stringify(out));
  console.log(`Matched ${found} of ${total} series entries to at least one system.`);
})();
