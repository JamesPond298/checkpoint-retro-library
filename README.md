# Checkpoint Web

A buildless, private-first website for importing `checkpoint-library.json`, browsing a retro game library, tracking play status and notes, and recommending missing entries from supported game series.

Download the complete Windows scanner source: [`CheckpointScanner-v0.2.0-source.zip`](CheckpointScanner-v0.2.0-source.zip). Version 0.2 adds Sega Genesis / Mega Drive detection for Sonic collection goals.

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

Series Quest currently includes 46 structured franchise goals, with broad coverage of Nintendo first-party families plus Final Fantasy, Sonic, Mega Man, Castlevania, Resident Evil, Crash, Spyro, Dragon Quest, Tekken, Tony Hawk, and other retro staples. Nintendo goals include Mario, Mario Kart, Mario Party, Mario & Luigi, Paper Mario, Zelda, Metroid, Pokémon and its major spinoffs, Kirby, Donkey Kong, Fire Emblem, Advance Wars, Animal Crossing, Wario, Star Fox, F-Zero, EarthBound, Kid Icarus, Punch-Out!!, Pilotwings, Yoshi, Smash Bros., Rhythm Heaven, and more. Every checklist distinguishes detected games from missing entries and can be filtered by system.
