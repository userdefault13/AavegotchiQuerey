#!/usr/bin/env python3
"""Rasterize every wearable SVG into colour gotchiASCII.

Colour twin of buildWearableAscii.py. Same placement, same sizes:
  full    1 glyph = 1 SVG pixel, always █
  resize  1 glyph = 1×2 SVG pixels, ▀ with fg on top and bg below
  min     1 glyph = 2×2 SVG pixels, same half blocks (▌ ▐ for side halves)

Writes a JSON library per size plus one ANSI truecolor .txt per view.
Each view stores fg/bg rows as key strings: one key per glyph, "." means
none, and a key's colour is wearable.palette[meta.keys.index(key)].
"""

import json
import re
from pathlib import Path

from buildWearableAscii import (
    ORIGIN,
    SIZES,
    SLOTS,
    VIEWS,
    num_attr,
    pixel,
    render,
    slot_indexes,
    split_svg,
)

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "data" / "aavegotchi_db_wearables.json"
TXT_DIR = ROOT / "data" / "wearables_ascii_color"

NONE = "."
KEYS = "".join(
    ch for ch in map(chr, range(33, 127)) if ch not in (NONE, "\\", '"')
)


def hex_color(r, g, b, a):
    if a < 32:
        return None
    if a >= 250:
        return f"#{r:02x}{g:02x}{b:02x}"
    return f"#{r:02x}{g:02x}{b:02x}{a:02x}"


def lum(color):
    r, g, b = (int(color[i : i + 2], 16) for i in (1, 3, 5))
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def rasterize(fragment):
    """Full-size colour grid: rows of hex strings or None, cropped to ink."""
    attrs, inner = split_svg(fragment)
    place_x = num_attr(attrs, "x")
    place_y = num_attr(attrs, "y")
    empty = {"x": place_x, "y": place_y, "grid": []}
    if not inner.strip():
        return empty
    width, height, channels, rows = render(inner)
    grid = [
        [hex_color(*pixel(rows, channels, x, y)) for x in range(width)]
        for y in range(height)
    ]
    ink = [(x, y) for y in range(height) for x in range(width) if grid[y][x]]
    if not ink:
        return empty
    minx = min(x for x, _ in ink)
    maxx = max(x for x, _ in ink)
    miny = min(y for _, y in ink)
    maxy = max(y for _, y in ink)
    if minx == 0 or miny == 0 or maxx == width - 1 or maxy == height - 1:
        raise RuntimeError("wearable ink touched the render canvas")
    return {
        "x": place_x + (minx - ORIGIN),
        "y": place_y + (miny - ORIGIN),
        "grid": [row[minx : maxx + 1] for row in grid[miny : maxy + 1]],
    }


def pad_grid(grid, even_width=False):
    width = max((len(row) for row in grid), default=0)
    if even_width and width % 2:
        width += 1
    out = [row + [None] * (width - len(row)) for row in grid]
    if len(out) % 2:
        out.append([None] * width)
    return out, width


def half_cell(top, bottom):
    """One glyph from a top and bottom colour. Returns (glyph, fg, bg)."""
    if not top and not bottom:
        return " ", None, None
    if not top:
        return "▄", bottom, None
    if not bottom:
        return "▀", top, None
    if top == bottom:
        return "█", top, None
    return "▀", top, bottom


def rgba(color):
    a = int(color[7:9], 16) if len(color) > 7 else 255
    return [int(color[i : i + 2], 16) for i in (1, 3, 5)] + [a]


def distance(a, b):
    return sum((p - q) ** 2 for p, q in zip(rgba(a), rgba(b)))


def darker(a, b):
    return a if lum(a) <= lum(b) else b


def full_cells(grid):
    return [[("█", c, None) if c else (" ", None, None) for c in row] for row in grid]


def resize_cells(grid):
    if not grid:
        return []
    padded, width = pad_grid(grid)
    return [
        [half_cell(padded[y][x], padded[y + 1][x]) for x in range(width)]
        for y in range(0, len(padded), 2)
    ]


def min_cell(tl, tr, bl, br):
    """A half is drawn only when both of its pixels are ink, like the mono min set."""
    top = darker(tl, tr) if tl and tr else None
    bottom = darker(bl, br) if bl and br else None
    if top or bottom:
        return half_cell(top, bottom)
    if tl and bl:
        return "▌", darker(tl, bl), None
    if tr and br:
        return "▐", darker(tr, br), None
    return " ", None, None


def min_cells(grid):
    if not grid:
        return []
    padded, width = pad_grid(grid, even_width=True)
    return [
        [
            min_cell(padded[y][x], padded[y][x + 1], padded[y + 1][x], padded[y + 1][x + 1])
            for x in range(0, width, 2)
        ]
        for y in range(0, len(padded), 2)
    ]


CELLS = {"full": full_cells, "resize": resize_cells, "min": min_cells}


def scale_view(view, size):
    x, y = view["x"], view["y"]
    if size == "resize":
        y //= 2
    elif size == "min":
        x //= 2
        y //= 2
    return {"name": view["name"], "x": x, "y": y, "cells": CELLS[size](view["grid"])}


def encode_view(view, palette):
    def key(color):
        if not color:
            return NONE
        if color not in palette:
            if len(palette) < len(KEYS):
                palette.append(color)
            else:
                # Gradient-heavy art: reuse the closest colour already keyed.
                color = min(palette, key=lambda c: distance(c, color))
        return KEYS[palette.index(color)]

    cells = view["cells"]
    out = {
        "name": view["name"],
        "x": view["x"],
        "y": view["y"],
        "rows": ["".join(g for g, _, _ in row) for row in cells],
        "fg": ["".join(key(fg) for _, fg, _ in row) for row in cells],
    }
    if any(bg for row in cells for _, _, bg in row):
        out["bg"] = ["".join(key(bg) for _, _, bg in row) for row in cells]
    return out


def ansi_text(cells):
    lines = []
    for row in cells:
        while row and row[-1][0] == " ":
            row = row[:-1]
        parts = []
        for glyph, fg, bg in row:
            if glyph == " ":
                parts.append("\x1b[0m ")
                continue
            code = "38;2;" + ";".join(str(int(fg[i : i + 2], 16)) for i in (1, 3, 5))
            if bg:
                code += ";48;2;" + ";".join(str(int(bg[i : i + 2], 16)) for i in (1, 3, 5))
            else:
                code = "0;" + code
            parts.append(f"\x1b[{code}m{glyph}")
        lines.append("".join(parts) + "\x1b[0m")
    return "\n".join(lines) + "\n"


def slug(name):
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-") or "wearable"


def rasterize_wearable(wearable):
    def views(fragments):
        out = []
        for name, fragment in zip(VIEWS, fragments or []):
            view = rasterize(fragment)
            view["name"] = name
            out.append(view)
        return out

    slots = slot_indexes(wearable.get("slotPositions"))
    return {
        "id": wearable["id"],
        "name": wearable.get("name") or "",
        "rarity": wearable.get("rarity") or "",
        "minLevel": wearable.get("minLevel") or 1,
        "slots": slots,
        "slotNames": [SLOTS[i] for i in slots if i < len(SLOTS)],
        "views": views(wearable.get("svgs")),
        "sleeves": views(wearable["sleeves"]) if wearable.get("sleeves") else None,
    }


def build_size(raw, size):
    folder = TXT_DIR / size
    folder.mkdir(parents=True, exist_ok=True)
    wearables = []
    for item in raw:
        palette = []
        base = f"{item['id']:03d}-{slug(item['name'])}"
        entry = {k: item[k] for k in ("id", "name", "rarity", "minLevel", "slots", "slotNames")}
        for field, tag in (("views", ""), ("sleeves", "-sleeves")):
            if not item[field]:
                entry[field] = None
                continue
            encoded = []
            for view in item[field]:
                scaled = scale_view(view, size)
                encoded.append(encode_view(scaled, palette))
                if scaled["cells"]:
                    path = folder / f"{base}{tag}-{view['name']}.txt"
                    path.write_text(ansi_text(scaled["cells"]))
            entry[field] = encoded
        entry["palette"] = palette
        wearables.append(entry)
    pixel_note = {
        "full": "1 glyph = 1 SVG pixel. Glyph is always █ in fg.",
        "resize": "1 glyph = 1×2 SVG pixels. ▀ fg on top, bg below; ▄ fg below; █ both fg.",
        "min": "1 glyph = 2×2 SVG pixels. Halves need both pixels (darker wins); ▌ ▐ for side halves.",
    }[size]
    meta = {
        "source": "data/aavegotchi_db_wearables.json",
        "size": size,
        "color": True,
        "views": VIEWS,
        "slots": SLOTS,
        "glyphs": ["█", "▀", "▄", "▌", "▐"],
        "blank": " ",
        "keys": KEYS,
        "none": NONE,
        "pixel": pixel_note,
        "decode": "colour of key k in a view's fg/bg row = wearable.palette[meta.keys.indexOf(k)]; '.' = none",
        "count": len(wearables),
    }
    return {"meta": meta, "wearables": wearables}


def main():
    items = json.loads(SRC.read_text())["wearables"]
    raw = []
    failed = []
    for index, wearable in enumerate(items, 1):
        try:
            raw.append(rasterize_wearable(wearable))
        except Exception as exc:
            failed.append({"id": wearable.get("id"), "error": str(exc)})
            print(f"fail {wearable.get('id')}: {exc}")
        if index % 25 == 0 or index == len(items):
            print(f"{index}/{len(items)}")
    for size in SIZES:
        lib = build_size(raw, size)
        if failed:
            lib["meta"]["failed"] = failed
        text = json.dumps(lib, ensure_ascii=False, indent=1) + "\n"
        name = f"aavegotchi_db_wearables_ascii_color_{size}.json"
        for folder in (ROOT / "data", ROOT / "public" / "data"):
            path = folder / name
            path.write_text(text)
            print(f"wrote {path} ({path.stat().st_size} bytes)")
        print(f"wrote {TXT_DIR / size} ({len(list((TXT_DIR / size).glob('*.txt')))} txt)")


if __name__ == "__main__":
    main()
