#!/usr/bin/env python3
"""Rasterize every wearable SVG into monochrome gotchiASCII glyphs.

One glyph per SVG pixel. Space is transparent. Shades run dark to light:
█ ▓ ▒ ░. Sleeve-up and hands-up groups are hidden, matching the composer.
"""

import json
import re
import struct
import subprocess
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "data" / "aavegotchi_db_wearables.json"
SIZES = ("full", "resize", "min")

VIEWS = ["front", "left", "right", "back"]
SLOTS = [
    "Body",
    "Face",
    "Eyes",
    "Head",
    "Left Hand",
    "Right Hand",
    "Pet",
    "Background",
]

# Pad so negative path coords (side views, transforms) stay on the canvas.
ORIGIN = 128
CANVAS = 384

STYLE = """<style>
.gotchi-sleeves-up{display:none}
.gotchi-handsUp{display:none}
.gotchi-handsDownClosed{display:none}
.gotchi-handsDownOpen{display:block}
</style>"""

SVG_OPEN = re.compile(r"<svg\b([^>]*)>", re.I)
ATTR = re.compile(r'([a-zA-Z:-]+)="([^"]*)"')


def num_attr(attrs, key):
    raw = attrs.get(key)
    if raw is None or raw == "":
        return 0
    try:
        return int(float(raw))
    except ValueError:
        return 0


def split_svg(fragment):
    fragment = (fragment or "").strip()
    if not fragment:
        return {}, ""
    m = SVG_OPEN.search(fragment)
    if not m:
        return {}, fragment
    attrs = dict(ATTR.findall(m.group(1)))
    start = m.end()
    end = fragment.rfind("</svg>")
    inner = fragment[start:end] if end > start else fragment[start:]
    return attrs, inner


def shade(r, g, b, a):
    if a < 32:
        return " "
    lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) * (a / 255)
    if lum < 105:
        return "█"
    if lum < 175:
        return "▓"
    if lum < 220:
        return "▒"
    return "░"


def read_png(blob):
    assert blob[:8] == b"\x89PNG\r\n\x1a\n"
    i = 8
    width = height = color = depth = None
    idat = b""
    while i < len(blob):
        length = struct.unpack(">I", blob[i : i + 4])[0]
        kind = blob[i + 4 : i + 8]
        chunk = blob[i + 8 : i + 8 + length]
        i += 12 + length
        if kind == b"IHDR":
            width, height, depth, color = struct.unpack(">IIBB", chunk[:10])
        elif kind == b"IDAT":
            idat += chunk
        elif kind == b"IEND":
            break
    if color not in (2, 6) or depth != 8:
        raise RuntimeError(f"unsupported png color={color} depth={depth}")
    channels = 4 if color == 6 else 3
    raw = zlib.decompress(idat)
    rows = []
    pos = 0
    stride = width * channels
    prev = bytearray(stride)

    def paeth(a, b, c):
        p = a + b - c
        pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
        if pa <= pb and pa <= pc:
            return a
        if pb <= pc:
            return b
        return c

    for _ in range(height):
        filt = raw[pos]
        pos += 1
        row = bytearray(raw[pos : pos + stride])
        pos += stride
        if filt == 1:
            for x in range(len(row)):
                left = row[x - channels] if x >= channels else 0
                row[x] = (row[x] + left) & 255
        elif filt == 2:
            for x in range(len(row)):
                row[x] = (row[x] + prev[x]) & 255
        elif filt == 3:
            for x in range(len(row)):
                left = row[x - channels] if x >= channels else 0
                row[x] = (row[x] + ((left + prev[x]) // 2)) & 255
        elif filt == 4:
            for x in range(len(row)):
                a = row[x - channels] if x >= channels else 0
                b = prev[x]
                c = prev[x - channels] if x >= channels else 0
                row[x] = (row[x] + paeth(a, b, c)) & 255
        elif filt != 0:
            raise RuntimeError(f"png filter {filt}")
        rows.append(row)
        prev = row
    return width, height, channels, rows


def pixel(rows, channels, x, y):
    row = rows[y]
    o = x * channels
    if channels == 4:
        return row[o], row[o + 1], row[o + 2], row[o + 3]
    return row[o], row[o + 1], row[o + 2], 255


def render(inner):
    doc = (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{CANVAS}" height="{CANVAS}" '
        f'viewBox="-{ORIGIN} -{ORIGIN} {CANVAS} {CANVAS}">{STYLE}{inner}</svg>'
    )
    png = subprocess.check_output(
        ["rsvg-convert", "-b", "none", "-f", "png"],
        input=doc.encode(),
    )
    return read_png(png)


# Darker shades win when both halves of a cell are filled with different ink.
SHADE_RANK = {" ": 0, "░": 1, "▒": 2, "▓": 3, "█": 4}


def pack_cell(top, bottom):
    """Two SVG pixels stacked in one character. Empty half stays blank."""
    top = top if top and top != " " else " "
    bottom = bottom if bottom and bottom != " " else " "
    if top == " " and bottom == " ":
        return " "
    if top == " ":
        return "▄"
    if bottom == " ":
        return "▀"
    if top == bottom:
        return top
    return top if SHADE_RANK.get(top, 0) >= SHADE_RANK.get(bottom, 0) else bottom


def pack_rows(rows):
    """Resize: one character row per two SVG rows. ▀ top, ▄ bottom."""
    if not rows:
        return []
    width = max(len(row) for row in rows)
    padded = [row.ljust(width) for row in rows]
    if len(padded) % 2:
        padded.append(" " * width)
    packed = []
    for i in range(0, len(padded), 2):
        packed.append(
            "".join(pack_cell(padded[i][x], padded[i + 1][x]) for x in range(width))
        )
    return packed


def pack_min_cell(tl, tr, bl, br):
    """Min: one character per 2×2 SVG pixels. A half is drawn only when both of its pixels are ink."""
    cells = [tl, tr, bl, br]

    def ink(ch):
        return bool(ch and ch != " ")

    def darker(group):
        best = " "
        for ch in group:
            if SHADE_RANK.get(ch, 0) > SHADE_RANK.get(best, 0):
                best = ch
        return best

    top = ink(tl) and ink(tr)
    bottom = ink(bl) and ink(br)
    left = ink(tl) and ink(bl)
    right = ink(tr) and ink(br)
    if top and bottom:
        shades = {ch for ch in cells if ink(ch)}
        return cells[0] if len(shades) == 1 else darker(cells)
    if top:
        return "▀"
    if bottom:
        return "▄"
    if left:
        return "▌"
    if right:
        return "▐"
    return " "


def pack_min_rows(rows):
    """Min: half as wide and half as tall. Lone pixels become blank spots."""
    if not rows:
        return []
    width = max(len(row) for row in rows)
    padded = [row.ljust(width) for row in rows]
    if len(padded) % 2:
        padded.append(" " * width)
    if width % 2:
        padded = [row + " " for row in padded]
        width += 1
    packed = []
    for y in range(0, len(padded), 2):
        packed.append(
            "".join(
                pack_min_cell(
                    padded[y][x],
                    padded[y][x + 1],
                    padded[y + 1][x],
                    padded[y + 1][x + 1],
                )
                for x in range(0, width, 2)
            )
        )
    return packed


def rasterize(fragment):
    attrs, inner = split_svg(fragment)
    place_x = num_attr(attrs, "x")
    place_y = num_attr(attrs, "y")
    if not inner.strip():
        return {"x": place_x, "y": place_y, "rows": []}
    width, height, channels, rows = render(inner)
    minx = miny = 10**9
    maxx = maxy = -1
    for y in range(height):
        for x in range(width):
            if pixel(rows, channels, x, y)[3] >= 32:
                if x < minx:
                    minx = x
                if y < miny:
                    miny = y
                if x > maxx:
                    maxx = x
                if y > maxy:
                    maxy = y
    if maxx < 0:
        return {"x": place_x, "y": place_y, "rows": []}
    if minx == 0 or miny == 0 or maxx == width - 1 or maxy == height - 1:
        raise RuntimeError("wearable ink touched the render canvas")
    lines = []
    for y in range(miny, maxy + 1):
        lines.append(
            "".join(
                shade(*pixel(rows, channels, x, y)) for x in range(minx, maxx + 1)
            )
        )
    return {
        "x": place_x + (minx - ORIGIN),
        "y": place_y + (miny - ORIGIN),
        "rows": lines,
    }


def slot_indexes(flags):
    return [i for i, on in enumerate(flags or []) if on]


def convert_views(fragments):
    out = []
    for name, fragment in zip(VIEWS, fragments or []):
        view = rasterize(fragment)
        view["name"] = name
        out.append(view)
    return out


def convert_wearable(wearable):
    slots = slot_indexes(wearable.get("slotPositions"))
    entry = {
        "id": wearable["id"],
        "name": wearable.get("name") or "",
        "rarity": wearable.get("rarity") or "",
        "minLevel": wearable.get("minLevel") or 1,
        "slots": slots,
        "slotNames": [SLOTS[i] for i in slots if i < len(SLOTS)],
        "views": convert_views(wearable.get("svgs")),
    }
    sleeves = wearable.get("sleeves")
    entry["sleeves"] = convert_views(sleeves) if sleeves else None
    return entry


def scale_view(view, size):
    rows = view.get("rows") or []
    x = int(view.get("x") or 0)
    y = int(view.get("y") or 0)
    if size == "resize":
        rows = pack_rows(rows)
        y //= 2
    elif size == "min":
        rows = pack_min_rows(rows)
        x //= 2
        y //= 2
    return {"name": view.get("name"), "x": x, "y": y, "rows": rows}


def scale_library(full_lib, size):
    meta = {
        "source": full_lib["meta"].get("source", "data/aavegotchi_db_wearables.json"),
        "size": size,
        "views": VIEWS,
        "slots": SLOTS,
        "shades": ["█", "▓", "▒", "░"],
        "blank": " ",
        "count": len(full_lib["wearables"]),
    }
    if size == "full":
        meta["pixel"] = "1 glyph = 1 SVG pixel"
    elif size == "resize":
        meta["halves"] = ["▀", "▄"]
        meta["pixel"] = "1 character row = 2 SVG pixels. ▀ top, ▄ bottom."
    else:
        meta["halves"] = ["▀", "▄", "▌", "▐"]
        meta["pixel"] = "1 character = 2×2 SVG pixels. Half blocks need both pixels; a lone pixel is blank."
    wearables = []
    for item in full_lib["wearables"]:
        entry = {
            "id": item["id"],
            "name": item.get("name") or "",
            "rarity": item.get("rarity") or "",
            "minLevel": item.get("minLevel") or 1,
            "slots": item.get("slots") or [],
            "slotNames": item.get("slotNames") or [],
            "views": [scale_view(view, size) for view in item.get("views") or []],
            "sleeves": None,
        }
        if item.get("sleeves"):
            entry["sleeves"] = [scale_view(view, size) for view in item["sleeves"]]
        wearables.append(entry)
    return {"meta": meta, "wearables": wearables}


def write_sizes(full_lib):
    for size in SIZES:
        text = json.dumps(scale_library(full_lib, size), ensure_ascii=False, indent=2) + "\n"
        name = f"aavegotchi_db_wearables_ascii_{size}.json"
        for folder in (ROOT / "data", ROOT / "public" / "data"):
            folder.mkdir(parents=True, exist_ok=True)
            path = folder / name
            path.write_text(text)
            print(f"wrote {path} ({path.stat().st_size} bytes)")
    # The ASCII tab reads the unsuffixed file, which stays the resize set.
    resize_name = "aavegotchi_db_wearables_ascii.json"
    resize_text = (ROOT / "public" / "data" / "aavegotchi_db_wearables_ascii_resize.json").read_text()
    for folder in (ROOT / "data", ROOT / "public" / "data"):
        path = folder / resize_name
        path.write_text(resize_text)
        print(f"wrote {path} ({path.stat().st_size} bytes)")


def main():
    data = json.loads(SRC.read_text())
    wearables = []
    failed = []
    items = data["wearables"]
    for index, wearable in enumerate(items, 1):
        try:
            wearables.append(convert_wearable(wearable))
        except Exception as exc:
            failed.append({"id": wearable.get("id"), "error": str(exc)})
            print(f"fail {wearable.get('id')}: {exc}")
        if index % 25 == 0 or index == len(items):
            print(f"{index}/{len(items)}")
    lib = {
        "meta": {
            "source": "data/aavegotchi_db_wearables.json",
            "views": VIEWS,
            "slots": SLOTS,
            "count": len(wearables),
        },
        "wearables": wearables,
    }
    if failed:
        lib["meta"]["failed"] = failed
    write_sizes(lib)


if __name__ == "__main__":
    main()
