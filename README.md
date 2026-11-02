# Checkpoint Web

A buildless, private-first website for importing `checkpoint-library.json`, browsing a retro game library, tracking play status and notes, and recommending missing entries from supported game series.

The current site handles the full 4,000+ game SD-card inventory with paged rendering, readable labels for 29 platform categories, and broader cover-art lookup.

Download the complete Windows scanner source: [`CheckpointScanner-v0.3.0-source.zip`](CheckpointScanner-v0.3.0-source.zip). Version 0.3 is tailored to the full SD-card layout: 29 detected platform categories, readable arcade metadata, Sega CD track grouping, and expanded disc and archive handling.

Live site: <https://jamespond298.github.io/checkpoint-retro-library/>

## Data and privacy

- The inventory file is read locally by the browser; it is not uploaded by this static application.
- Library data, progress, notes, and dismissed suggestions are stored in browser `localStorage`.
- Importing a newer scan merges by stable game ID and preserves existing progress.
- **Export backup** downloads library and progress together as `checkpoint-backup.json`.
- Box art comes from the free [Libretro thumbnails](https://github.com/libretro-thumbnails/libretro-thumbnails) project. Images load directly from Libretro (with a GitHub mirror as fallback); nothing about your library is sent anywhere except the image requests themselves.

## How cover art matching works

ROM filenames rarely match catalog names exactly (`000 Sonic the Hedgehog 1.sms`, `Sonic Adventure2.chd`, `sfiii3.zip`). Instead of guessing URLs, the site ships an index of every thumbnail Libretro actually has (`art-index/`, one file per system, loaded only for systems in your library) and matches against it in `art.js`:

1. **Exact filename** match.
2. **Normalized title** match, ignoring punctuation, region/version tags, `The` (including `Legend of Zelda, The`), Roman vs. Arabic numerals, glued numbers (`Adventure2`), `&`/`and`, accents, catalog prefixes, and common abbreviations (`GTA`, `FF`, `KOF`…).
3. **Fuzzy token match** that never mixes up sequels (numbers must agree).

Arcade ROM short names are translated to full titles with the FBNeo and MAME 2003-Plus databases (`art-index/arcade-names.json`). When several images exist, Checkpoint prefers your file's region, then USA → World → Europe → Japan, the matching disc number, and real box art over title screens. Results are cached in the browser.

If a cover is wrong, open the game and choose **Wrong cover? Choose another** to search the art yourself, go back to automatic, or hide the art. Your choices are included in **Export backup**.

To refresh the art index with Libretro's latest additions, run `python tools/build_art_index.py` (needs git and Python 3.10+) and commit `art-index/`.

## Run locally

Serve the repository root with any static web server. For example:

```powershell
python -m http.server 4173
```

Then open `http://localhost:4173`.

## Guides and walkthroughs

Every game has an **Open walkthrough** button: in the game window, on the dashboard spotlight, and on library cards (hover, or always visible on touch screens). Guides come from [StrategyWiki](https://strategywiki.org), a free walkthrough wiki whose API allows other sites to load its pages, so they open inside Checkpoint instead of a new tab:

- Checkpoint finds the matching guide automatically (using the matched box-art title when available). If unsure, it asks you to pick and remembers your choice.
- Chapters are listed in the guide's own order, with previous/next buttons and adjustable text size.
- Your notes for the game sit beside the guide and save automatically.
- Checkpoint remembers your chapter and scroll position, so **Open walkthrough** picks up where you left off.

GameFAQs, YouTube and web search are still linked as extra sources. Those sites block being shown inside other sites, so they open in a new tab.

## Series Quest

Series Quest finds the holes in franchises you already play and helps you collect the rest. The catalog (`series-data.js`) covers 110 franchise goals and over 600 games, listed in release order: Nintendo first-party families, Final Fantasy and its Tactics line, Dragon Quest, Mana, Tales, Persona, Kingdom Hearts, Sonic, Mega Man (classic, X, Zero, Battle Network, Legends), Castlevania, Metroid, Zelda (console and handheld), Metal Gear, Resident Evil, Silent Hill, Devil May Cry, Ratchet & Clank, Jak, Sly, Crash, Spyro, Gran Turismo, Ace Combat, arcade fighters (Street Fighter, King of Fighters, Samurai Shodown, Darkstalkers, Marvel vs. Capcom), Metal Slug, Sega classics, and more.

- **Owned games are recognized from messy filenames.** Ownership uses the same normalization as the cover-art matcher, including catalog names, arcade short names and regional retitles (the US SNES "Final Fantasy III" counts as Final Fantasy VI).
- **Every missing game shows the consoles it was released on**, with the systems you already have highlighted, plus its box art.
- **Gaps are ranked**: the next game after your newest one first, then earlier entries you skipped, with a boost for nearly complete franchises and systems you already play.
- **Three tabs, one filter bar**: *Gaps to fill*, *Franchises* and *Hunt list* share a filter bar that stays on screen, with system chips (your systems first, each showing how many games match), search, and a sort menu. Gaps can be ranked, grouped by franchise or system, or sorted by closeness to finishing. Your last tab, system and sort are remembered.
- **Mark any missing game** as **＋ Hunt** (adds it to your hunt list), **Have it** (you own or finished it elsewhere), or **Skip** (not counted toward the goal). The hunt list has price-check links and can be copied as a checklist. Marks are saved in backups.

`art-index/series-index.json` records which systems each entry appeared on. Regenerate it after editing `series-data.js`:

```bash
node tools/build_series_index.js
```
