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
OUTS = [
    ROOT / "data" / "aavegotchi_db_wearables_ascii.json",
    ROOT / "public" / "data" / "aavegotchi_db_wearables_ascii.json",
]

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
            "shades": ["█", "▓", "▒", "░"],
            "blank": " ",
            "pixel": "1 glyph = 1 SVG pixel",
            "count": len(wearables),
        },
        "wearables": wearables,
    }
    if failed:
        lib["meta"]["failed"] = failed
    text = json.dumps(lib, ensure_ascii=False, indent=2) + "\n"
    for path in OUTS:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text)
        print(f"wrote {path} ({path.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
