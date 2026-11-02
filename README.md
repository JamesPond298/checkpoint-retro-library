# Checkpoint Web

A buildless, private-first website for importing `checkpoint-library.json`, browsing a retro game library, tracking play status and notes, and recommending missing entries from supported game series.

The complete Windows Checkpoint Scanner source and build instructions are included in [`scanner/`](scanner/README.md).

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

The first catalog covers the main ordered entries for Final Fantasy I–X, classic Metroid, early The Legend of Zelda, and classic Super Mario. Catalog matching is deliberately separate from the scanner inventory so regional numbering and remakes can be handled with canonical identities later.
