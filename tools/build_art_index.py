"""Build the cover-art index used by the Checkpoint website.

Libretro publishes its thumbnails in one GitHub repository per system. This
script fetches only the *file lists* of those repositories (no images) and
writes a compact JSON index per system into ``art-index/``. The website uses
those lists to fuzzy-match messy ROM filenames to art that really exists.

It also builds ``art-index/arcade-names.json`` which maps arcade ROM short
names (``sfiii3``) to their full titles using the FBNeo and MAME 2003-Plus
databases.

Usage (needs git, Python 3.10+, network access to github.com):

    python tools/build_art_index.py
"""
from __future__ import annotations

import json
import re
import subprocess
import sys
import tempfile
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "art-index"

SYSTEMS = [
    "Nintendo - Nintendo Entertainment System",
    "Nintendo - Super Nintendo Entertainment System",
    "Nintendo - Game Boy",
    "Nintendo - Game Boy Color",
    "Nintendo - Game Boy Advance",
    "Nintendo - Nintendo 64",
    "Nintendo - Nintendo DS",
    "Nintendo - Nintendo 3DS",
    "Nintendo - GameCube",
    "Nintendo - Wii",
    "Sega - Master System - Mark III",
    "Sega - Mega Drive - Genesis",
    "Sega - Mega-CD - Sega CD",
    "Sega - Saturn",
    "Sega - Dreamcast",
    "MAME",
    "FBNeo - Arcade Games",
    "SNK - Neo Geo",
    "SNK - Neo Geo Pocket",
    "SNK - Neo Geo Pocket Color",
    "Microsoft - MSX2",
    "NEC - PC Engine - TurboGrafx 16",
    "Bandai - WonderSwan Color",
    "Sony - PlayStation",
    "Sony - PlayStation 2",
    "Sony - PlayStation 3",
    "Sony - PlayStation Portable",
]
TYPES = {"Named_Boxarts": 1, "Named_Titles": 2, "Named_Snaps": 4}


def repo_for(system: str) -> str:
    return system.replace(" ", "_")


def slug(system: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", system.lower()).strip("-")


def git(*args: str, cwd: Path) -> str:
    return subprocess.run(["git", *args], cwd=cwd, check=True, capture_output=True, text=True).stdout


def fetch_tree(owner: str, repo: str, work: Path) -> Path:
    path = work / repo
    path.mkdir()
    git("init", "-q", cwd=path)
    git("config", "gc.auto", "0", cwd=path)
    git("remote", "add", "origin", f"https://github.com/{owner}/{repo}", cwd=path)
    git("fetch", "-q", "--depth", "1", "--filter=blob:none", "origin", "HEAD", cwd=path)
    return path


def build_system(system: str, work: Path) -> int:
    path = fetch_tree("libretro-thumbnails", repo_for(system), work)
    flags: dict[str, int] = {}
    symlinks: dict[str, str] = {}  # "<type bit>|<name>" -> blob id of the symlink
    for line in git("ls-tree", "-r", "FETCH_HEAD", cwd=path).splitlines():
        meta, _, file = line.partition("\t")
        mode, _kind, oid = meta.split()
        folder, _, name = file.partition("/")
        if folder in TYPES and name.lower().endswith(".png") and "/" not in name:
            stem = name[:-4]
            flags[stem] = flags.get(stem, 0) | TYPES[folder]
            if mode == "120000":
                symlinks[f"{TYPES[folder]}|{stem}"] = oid
    # Libretro stores many variants (e.g. "(Disc 2)") as git symlinks. The Libretro
    # server follows them, raw.githubusercontent.com does not, so record each target.
    links: dict[str, str] = {}
    oids = sorted(set(symlinks.values()))
    for start in range(0, len(oids), 2000):
        git("-c", "fetch.writeCommitGraph=false", "fetch", "-q", "--no-tags", "--no-write-fetch-head", "origin", *oids[start:start + 2000], cwd=path)
    if oids:
        out = subprocess.run(["git", "cat-file", "--batch"], cwd=path, input=("\n".join(oids) + "\n").encode(), capture_output=True, check=True).stdout
        targets, pos = {}, 0
        for oid in oids:
            header_end = out.index(b"\n", pos)
            size = int(out[pos:header_end].split()[2])
            targets[oid] = out[header_end + 1: header_end + 1 + size].decode("utf-8", "replace")
            pos = header_end + 1 + size + 1
        for key, oid in symlinks.items():
            target = targets[oid].rsplit("/", 1)[-1]
            if target.lower().endswith(".png"):
                links[key] = target[:-4]
    names = sorted(flags, key=str.lower)
    data = {"system": system, "names": names, "flags": "".join(str(flags[n]) for n in names), "links": links}
    (OUT / f"{slug(system)}.json").write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    return len(names)


def arcade_names(work: Path) -> dict[str, str]:
    names: dict[str, str] = {}

    def read_dat(xml_text: str) -> None:
        root = ET.fromstring(xml_text)
        for game in root.iter("game"):
            short, desc = game.get("name"), game.findtext("description")
            if short and desc and short not in names:
                names[short] = desc.strip()

    fb = fetch_tree("libretro", "FBNeo", work)
    for dat in ("FinalBurn Neo (ClrMame Pro XML, Arcade only).dat", "FinalBurn Neo (ClrMame Pro XML, Neogeo only).dat"):
        read_dat(git("show", f"FETCH_HEAD:dats/{dat}", cwd=fb))
    mame = fetch_tree("libretro", "mame2003-plus-libretro", work)
    xml_text = git("show", "FETCH_HEAD:metadata/mame2003-plus.xml", cwd=mame)
    # The MAME 2003-Plus XML declares a DTD that ElementTree cannot resolve.
    read_dat(re.sub(r"<!DOCTYPE.*?\]>", "", xml_text, flags=re.S))
    return dict(sorted(names.items()))


def main() -> int:
    OUT.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        work = Path(tmp)
        manifest = {}
        for system in SYSTEMS:
            count = build_system(system, work)
            manifest[system] = f"{slug(system)}.json"
            print(f"{system}: {count} titles")
        arcade = arcade_names(work)
        (OUT / "arcade-names.json").write_text(json.dumps(arcade, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        print(f"Arcade short names: {len(arcade)}")
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main())
