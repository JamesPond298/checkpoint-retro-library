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

## Current series catalog

Series Quest currently includes 60 structured franchise goals, with broad coverage of Nintendo first-party families and popular collections such as Final Fantasy, Sonic, Mega Man, Castlevania, Resident Evil, LEGO, Street Fighter, Mortal Kombat, Metal Gear, God of War, GTA, Dragon Ball, Bomberman, Pac-Man, Rayman, Tomb Raider, Star Wars, and Naruto. Nintendo goals include Mario, Mario Kart, Mario Party, Mario & Luigi, Paper Mario, Zelda, Metroid, Pokémon and its major spinoffs, Kirby, Donkey Kong, Fire Emblem, Advance Wars, Animal Crossing, Wario, Star Fox, F-Zero, EarthBound, Kid Icarus, Punch-Out!!, Pilotwings, Yoshi, Smash Bros., Rhythm Heaven, and more. Every checklist distinguishes detected games from missing entries and can be filtered by system.

