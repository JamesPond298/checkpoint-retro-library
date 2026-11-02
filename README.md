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
- Cover art is requested directly from the key-free Libretro thumbnail service using the original filename first, then the cleaned title. If no exact match exists, Checkpoint keeps its generated letter cover instead of showing a broken image.

## Run locally

Serve the `dist` directory with any static web server. For example:

```powershell
python -m http.server 4173 --directory dist
```

Then open `http://localhost:4173`.

## Current series catalog

Series Quest currently includes 60 structured franchise goals, with broad coverage of Nintendo first-party families and popular collections such as Final Fantasy, Sonic, Mega Man, Castlevania, Resident Evil, LEGO, Street Fighter, Mortal Kombat, Metal Gear, God of War, GTA, Dragon Ball, Bomberman, Pac-Man, Rayman, Tomb Raider, Star Wars, and Naruto. Nintendo goals include Mario, Mario Kart, Mario Party, Mario & Luigi, Paper Mario, Zelda, Metroid, Pokémon and its major spinoffs, Kirby, Donkey Kong, Fire Emblem, Advance Wars, Animal Crossing, Wario, Star Fox, F-Zero, EarthBound, Kid Icarus, Punch-Out!!, Pilotwings, Yoshi, Smash Bros., Rhythm Heaven, and more. Every checklist distinguishes detected games from missing entries and can be filtered by system.

