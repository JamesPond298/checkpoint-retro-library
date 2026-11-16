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

## Built to help you finish games

The dashboard is designed to get you to the credits, not to start more games:

- **Now Playing** holds one focus game. If none is set, it asks what you're playing, with a search box and suggestions that put unfinished games first.
- Starting a new game while another is in progress asks first: keep going, put the current game on hold, or play both anyway.
- **Unfinished business** lists every game you've started but not beaten, closest to the end first.
- Stats track games beaten (and how many this year), your finish rate, and how many games are in progress. More than three in progress gets a gentle warning.
- Beating a game shows a celebration with your running total and how long it took, then suggests your next focus: the next game in that series, or something unfinished.
- **Your checkpoint** (📍) answers "where am I, what next?" for each game: a location (chapter, area, level, mission), your current objective, and a short next-step checklist you can reorder, tick off, and mark as spoilers. Now Playing shows it at a glance, and you can tick steps right there. **Update checkpoint** opens a quick editor; the same editor is in the game window and beside the guide. The progress summary is "done of total" over your own checkpoints. Checkpoint never invents objectives or percentages, and the progress slider stays your own estimate (it can offer to match your checkpoints).
- **Recommendations** are local and explain themselves. Pick a focus from the menu next to **Picked for you** (or in **Tune suggestions**):
  - *Help me finish a game* (default): games you've started first (playing, on hold, backlog with progress), plus one game for when you finish.
  - *Recommend a classic*: classics and system essentials you own but haven't started, then a couple worth finding.
  - *Continue a franchise*: the next game you own in series you've played, then the next entries to collect.
  - *Build a system's collection*: one system's essentials, owned ones to play and missing ones to find. Choose the system in Tune suggestions; otherwise Checkpoint uses a favored system or the one you play most.
  - *Explore*: a mix that includes new starts even with games unfinished.

  Every mode shows at most six cards, spreads them across systems where it can, and gives each a plain reason (with "Part of your goal…" when it is). Beaten games, games marked **Not for me** and picks marked **Not interested** are never suggested. Turn down two or more games from the same series and Checkpoint stops suggesting that series. Checkpoint doesn't know genres, length or reviews, so it doesn't claim to.
- A **trophy shelf** shows every game you've beaten.

## Guides and walkthroughs

Every game has an **Open walkthrough** button: in the game window, on the dashboard spotlight, and on library cards (hover, or always visible on touch screens). Guides come from [StrategyWiki](https://strategywiki.org), a free walkthrough wiki whose API allows other sites to load its pages, so they open inside Checkpoint instead of a new tab:

- Checkpoint finds the matching guide automatically (using the matched box-art title when available). If unsure, it asks you to pick and remembers your choice.
- Chapters are listed in the guide's own order, numbered, with a filter for long guides, previous/next buttons, and `[` / `]` keyboard shortcuts. On phones a bottom bar has previous, the current chapter (tap for the list), next, and your checkpoint.
- Your checkpoint and notes sit beside the guide (or slide over it on smaller screens) and save automatically. You can set the current chapter as your location in one tap, or add the guide's chapter names as checkpoints (optionally hidden as spoilers). Chapters you've ticked off show ✓ in the chapter list.
- Checkpoint remembers your chapter and scroll position, so **Resume guide** picks up where you left off. **📍 Mark spot** saves an exact place; read ahead, then **↩ My spot** takes you back.
- Every page is labelled with its source (StrategyWiki, a community wiki, CC BY-SA). Checkpoint never writes or summarizes guide content.
- When there's no StrategyWiki guide, or it can't be reached, the reader offers a search, other sources, **your own guide links** (saved per game), and **Use my own checkpoints** to track the game without a built-in guide.

GameFAQs, YouTube and web search are still linked as extra sources. Those sites block being shown inside other sites, so they open in a new tab.

## Discover: classics, franchises and collection goals

**Discover** (top menu) is where deeper choosing and collecting happens, so the dashboard stays focused on playing. It has five tabs:

- **Goals**: your collection goals with progress, what you have, and the next games to play or find. Checkpoint suggests a few to start with (beat the classics you own, collect your biggest system's essentials, finish the franchise you're closest to completing). You can make any franchise or list a goal with **🎯 Goal: collect them** or **🏁 Goal: beat them**. Up to three goals also appear as a small strip on the dashboard.
- **Beloved franchises**: 36 notable franchises, each with a short note on why it matters, good places to start, and every entry in order with its status. These are Series Quest franchises, so marks and ownership are shared, not duplicated. **Open in Series Quest** goes to the full checklist.
- **Classics**: 50 games often cited as influential or culturally significant.
- **Top by system**: an essentials list for each system Checkpoint supports (20 for most; fewer for small libraries such as Sega CD, 3DS or WonderSwan Color; 30 for Wii and GameCube, which share a folder). Your systems come first. Lists can carry extra picks after the essentials, shown as "Also worth a look".
- **Want list**: everything you've marked as wanted, from Discover and Series Quest, with price-check links and a copyable list.

Every pick shows whether it's in your library and its status: **In library**, **Started**, **Playing**, **On hold**, **Beaten**, **Have it**, **Wanted**, **Skipped**, **Not interested** or **Not in library**. For a game you don't have, choose **＋ Want**, **Have it** (you own or finished it outside this library), **Skip** (don't count it toward goals) or **Not interested** (don't count it, and never suggest it). For a game you do have, choose **Start playing** or **Not for me**. "In library" only means a matching file was found in your imported inventory. It doesn't confirm you own a physical copy.

**How goal progress works.** A *collect* goal counts a game as done when it's in your library or marked **Have it**. A *beat* goal counts it when its status is **Beaten**. Skipped and not-interested games don't count toward the total. Nothing is estimated: progress only changes when your library, statuses or marks change.

### Curated vs. inferred

| What | Where it comes from |
| --- | --- |
| Which games are on each list, their order, the reasons, list sizes | **Curated** in `discovery-data.js` (Checkpoint's editorial selection) |
| "Source" notes | Given only where a pick can be checked against a named public list (currently the World Video Game Hall of Fame inductees for 2015–2017) |
| Whether a pick is in your library | **Inferred** from your filenames, using the same matcher as Series Quest and box art (catalog names, regional retitles such as the US SNES "Final Fantasy III", arcade set names) |
| Playing, beaten and so on | **Your** progress |
| Want, have, skip, not interested, goals | **Your** marks |

The lists are a starting point, not a ranking. Each one says so on the page.

### Editing the lists

All curated data is in `discovery-data.js`, separate from the app code. The format is documented at the top of the file:

- `F(seriesName, why, keyEntries)` adds a beloved franchise. `seriesName` must match a franchise in `series-data.js`. To add a franchise that isn't there yet, add it to `series-data.js` first.
- `D(title, platforms, why, { aliases, key, region, source })` adds a game to a list. Use the North American title where there is one, and add other names as aliases (`"SNES|Final Fantasy III"` only counts on SNES). Use `"ARCADE"` for any arcade folder. Only add a `source` you can point to.
- Change a list's `size` to change how many picks count as its essentials and toward its goal.

Then run `node tools/build_discovery_index.js`. It checks every pick against the Libretro catalog, reporting picks it can't find (usually a typo, a missing alias or the wrong platform) and franchise entries that don't exist, and it refreshes box art for missing games.

**Picks that still need checking.** Eight picks aren't in the Libretro catalog, so they have no box art and couldn't be machine-checked: the PC Engine CD-ROM² games (*Ys Book I & II*, *Castlevania: Rondo of Blood*, *Gate of Thunder*, *Lords of Thunder*), *SD Snatcher*, *Aleste 2* and *Snatcher* on MSX2, and *Ratchet & Clank Future: Tools of Destruction* on PS3. The classics reasons are editorial; only the Hall of Fame notes are sourced.

## Stored data

Everything stays in this browser's `localStorage` and is included in **Export backup** (backup format v3). Older backups still restore, and parts they don't contain (checkpoints for v1, Discover marks and goals for v1 and v2) are left as they are.

| Key | Contents |
| --- | --- |
| `checkpoint.library.v1` | Imported games |
| `checkpoint.progress.v1` | Status, progress %, notes |
| `checkpoint.guides.v1` | Chosen guide, chapter, scroll position, marked spot, chapter names |
| `checkpoint.play.v1` | Location, objective, next steps, your guide links |
| `checkpoint.prefs.v1` | Suggestion focus, system to build, favored systems, "Not for me" list, spoiler setting |
| `checkpoint.seriesmarks.v1` | Want / have / skip / not-interested marks for Series Quest entries (shared with Discover) |
| `checkpoint.collection.v1` | Want / have / skip / not-interested marks for other Discover picks, and your collection goals |

`checkpoint.schema` records the data version (currently 3). On first load after upgrading, the new stores are created and validated. A damaged or hand-edited value is cleaned up rather than trusted, and existing keys are left as they are. (`checkpoint.questui.v1` and `checkpoint.discoverui.v1` only remember which tab you had open, and aren't backed up.)

## Series Quest

Series Quest finds the holes in franchises you already play and helps you collect the rest. The catalog (`series-data.js`) covers 110 franchise goals and over 600 games, listed in release order: Nintendo first-party families, Final Fantasy and its Tactics line, Dragon Quest, Mana, Tales, Persona, Kingdom Hearts, Sonic, Mega Man (classic, X, Zero, Battle Network, Legends), Castlevania, Metroid, Zelda (console and handheld), Metal Gear, Resident Evil, Silent Hill, Devil May Cry, Ratchet & Clank, Jak, Sly, Crash, Spyro, Gran Turismo, Ace Combat, arcade fighters (Street Fighter, King of Fighters, Samurai Shodown, Darkstalkers, Marvel vs. Capcom), Metal Slug, Sega classics, and more.

- **Owned games are recognized from messy filenames.** Ownership uses the same normalization as the cover-art matcher, including catalog names, arcade short names and regional retitles (the US SNES "Final Fantasy III" counts as Final Fantasy VI).
- **Every missing game shows the consoles it was released on**, with the systems you already have highlighted, plus its box art.
- **Gaps are ranked**: the next game after your newest one first, then earlier entries you skipped, with a boost for nearly complete franchises and systems you already play.
- **Three tabs, one filter bar**: *Gaps to fill*, *Franchises* and *Hunt list* share a filter bar that stays on screen, with system chips (your systems first, each showing how many games match), search, and a sort menu. Gaps can be ranked, grouped by franchise or system, or sorted by closeness to finishing. Your last tab, system and sort are remembered.
- **See where every game falls in its series.** Library cards show a badge like "#3 Metroid", and the library can be sorted **By series order**. The game window shows the whole series in release order with your game highlighted: click an owned game to jump to it, or ＋ Hunt a missing one.
- **Mark any missing game** as **＋ Hunt** (adds it to your hunt list), **Have it** (you own or finished it elsewhere), or **Skip** (not counted toward the goal). The hunt list has price-check links and can be copied as a checklist. Marks are saved in backups.

`art-index/series-index.json` records which systems each entry appeared on. Regenerate it after editing `series-data.js`:

```bash
node tools/build_series_index.js
```
