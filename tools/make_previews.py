#!/usr/bin/env python3
"""Generate the README preview images.

These are *illustrations* built from the project's own design tokens (colours,
radii, spacing) — not screenshots. Run `npm run shots` (Playwright) to capture
real screenshots from a browser.

    python3 tools/make_previews.py

Output: docs/screenshots/*.svg
"""
from __future__ import annotations

import math
import os
from html import escape

OUT = os.path.join(os.path.dirname(__file__), "..", "docs", "screenshots")

W, H = 1440, 900

# ---------------------------------------------------------------- palette
BG = "#05080b"
SURFACE_1 = "#0d121c"
SURFACE_2 = "#121927"
SURFACE_3 = "#1a2232"
WINDOW_BG = "#0b101a"
TITLEBAR = "#141c2a"
TEXT_1 = "#edf2f9"
TEXT_2 = "#a9b6c8"
TEXT_3 = "#76849a"
ACCENT = "#3ce3a4"
ACCENT_2 = "#62c9ff"
BORDER = "rgba(255,255,255,0.10)"
BORDER_SOFT = "rgba(255,255,255,0.06)"
SANS = "DejaVu Sans, Inter, sans-serif"
MONO = "DejaVu Sans Mono, monospace"

_ids = {"n": 0}


def uid(prefix="c"):
    _ids["n"] += 1
    return f"{prefix}{_ids['n']}"


def esc(value: str) -> str:
    return escape(str(value), quote=True)


def rect(x, y, w, h, fill, rx=0, stroke="none", sw=1, opacity=1.0, extra=""):
    return (
        f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" fill="{fill}" '
        f'stroke="{stroke}" stroke-width="{sw}" opacity="{opacity}" {extra}/>'
    )


def text(x, y, value, size=13, fill=TEXT_2, weight=400, anchor="start", family=SANS, opacity=1.0, extra=""):
    return (
        f'<text x="{x}" y="{y}" font-family="{family}" font-size="{size}" font-weight="{weight}" '
        f'fill="{fill}" text-anchor="{anchor}" opacity="{opacity}" {extra}>{esc(value)}</text>'
    )


def circle(cx, cy, r, fill, opacity=1.0, stroke="none", sw=1):
    return f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{fill}" opacity="{opacity}" stroke="{stroke}" stroke-width="{sw}"/>'


def path(d, fill="none", stroke="none", sw=1, opacity=1.0):
    return f'<path d="{d}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}" opacity="{opacity}" stroke-linecap="round" stroke-linejoin="round"/>'


def defs(extra=""):
    return (
        "<defs>"
        '<linearGradient id="wall" x1="0" y1="0" x2="1" y2="1">'
        f'<stop offset="0%" stop-color="#060b12"/><stop offset="55%" stop-color="#071018"/>'
        '<stop offset="100%" stop-color="#04070c"/></linearGradient>'
        '<radialGradient id="glow" cx="72%" cy="12%" r="62%">'
        f'<stop offset="0%" stop-color="{ACCENT}" stop-opacity="0.20"/>'
        '<stop offset="55%" stop-color="#3ce3a4" stop-opacity="0.05"/>'
        '<stop offset="100%" stop-color="#000000" stop-opacity="0"/></radialGradient>'
        '<radialGradient id="glow2" cx="12%" cy="88%" r="52%">'
        f'<stop offset="0%" stop-color="{ACCENT_2}" stop-opacity="0.16"/>'
        '<stop offset="100%" stop-color="#000000" stop-opacity="0"/></radialGradient>'
        f'<linearGradient id="accent" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="{ACCENT}"/>'
        f'<stop offset="100%" stop-color="{ACCENT_2}"/></linearGradient>'
        f'<linearGradient id="titlebar" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#1b2434"/>'
        '<stop offset="100%" stop-color="#121a27"/></linearGradient>'
        '<filter id="shadow" x="-25%" y="-25%" width="150%" height="160%">'
        '<feDropShadow dx="0" dy="26" stdDeviation="26" flood-color="#000" flood-opacity="0.55"/></filter>'
        '<filter id="soft" x="-30%" y="-30%" width="160%" height="160%">'
        '<feDropShadow dx="0" dy="10" stdDeviation="14" flood-color="#000" flood-opacity="0.45"/></filter>'
        f"{extra}"
        "</defs>"
    )


def wallpaper():
    return (
        rect(0, 0, W, H, "url(#wall)")
        + rect(0, 0, W, H, "url(#glow)")
        + rect(0, 0, W, H, "url(#glow2)")
        + "".join(
            path(f"M0 {y} H{W}", stroke="#ffffff", sw=1, opacity=0.014) for y in range(60, H, 60)
        )
    )


def wrap(value: str, max_chars: int, max_lines: int = 2) -> list[str]:
    """Greedy word wrap so illustrations never break words mid-way."""
    words = value.split()
    lines: list[str] = []
    current = ""
    for word in words:
        candidate = f"{current} {word}".strip()
        if len(candidate) <= max_chars:
            current = candidate
        else:
            if current:
                lines.append(current)
            current = word
            if len(lines) == max_lines:
                break
    if current and len(lines) < max_lines:
        lines.append(current)
    if len(lines) == max_lines and len(" ".join(lines)) < len(value):
        lines[-1] = lines[-1][: max_chars - 1].rstrip() + "…"
    return lines


def mini_icon(cx, cy, color, kind):
    """Tiny vector glyphs used inside the panel (no font symbols)."""
    stroke = dict(stroke=color, sw=1.5)
    if kind == "wifi":
        return (
            path(f"M{cx - 7} {cy + 2} a10 10 0 0 1 14 0", **stroke)
            + path(f"M{cx - 4} {cy + 5} a6 6 0 0 1 8 0", **stroke)
            + circle(cx, cy + 8, 1.4, color)
        )
    if kind == "volume":
        return (
            path(f"M{cx - 7} {cy - 2} h3 l4 -4 v12 l-4 -4 h-3 z", fill=color)
            + path(f"M{cx + 2} {cy - 3} a5 5 0 0 1 0 6", **stroke)
        )
    if kind == "sun":
        return circle(cx, cy, 3.2, "none", stroke=color, sw=1.5) + "".join(
            path(
                f"M{cx + math.cos(angle) * 5.4:.1f} {cy + math.sin(angle) * 5.4:.1f} "
                f"L{cx + math.cos(angle) * 7.4:.1f} {cy + math.sin(angle) * 7.4:.1f}",
                **stroke,
            )
            for angle in [i * math.pi / 4 for i in range(8)]
        )
    if kind == "battery":
        return rect(cx - 8, cy - 4, 14, 8, "none", rx=2, stroke=color, sw=1.4) + rect(
            cx - 6.4, cy - 2.4, 9, 4.8, color, rx=1
        ) + rect(cx + 7, cy - 1.6, 2, 3.2, color, rx=1)
    if kind == "bell":
        return (
            path(f"M{cx - 5} {cy + 3} v-3 a5 5 0 0 1 10 0 v3 l1.5 2 h-13 z", **stroke)
            + circle(cx, cy + 7, 1.3, color)
        )
    if kind == "code":
        return path(f"M{cx - 4} {cy - 5} l-4 5 l4 5", **stroke) + path(
            f"M{cx + 4} {cy - 5} l4 5 l-4 5", **stroke
        )
    if kind == "games":
        return rect(cx - 8, cy - 5, 16, 10, "none", rx=4, stroke=color, sw=1.4) + path(
            f"M{cx - 4} {cy} h4 M{cx - 2} {cy - 2} v4", **stroke
        ) + circle(cx + 4, cy - 1, 1.1, color) + circle(cx + 6, cy + 2, 1.1, color)
    if kind == "music":
        return path(f"M{cx + 2} {cy - 6} v9", **stroke) + circle(cx - 1, cy + 4, 2.6, color) + path(
            f"M{cx + 2} {cy - 6} l4 1.6", **stroke
        )
    if kind == "photos":
        return rect(cx - 7, cy - 5, 14, 10, "none", rx=2, stroke=color, sw=1.4) + circle(
            cx - 3, cy - 2, 1.3, color
        ) + path(f"M{cx - 7} {cy + 4} l4 -4 l3 3 l2 -2 l5 5", **stroke)
    if kind == "weather":
        return (
            circle(cx - 2, cy - 2, 3.2, "none", stroke=color, sw=1.4)
            + path(f"M{cx - 4} {cy + 4} h8 a3 3 0 0 0 0 -6 a4 4 0 0 0 -7 1", **stroke)
        )
    return circle(cx, cy, 3, color)


def window(x, y, w, h, title, accent=ACCENT, icon="N", body="", controls=True, title_extra=""):
    clip = uid("clip")
    bar = 40
    head = (
        rect(x, y, w, bar, "url(#titlebar)", rx=14)
        + rect(x, y + bar - 14, w, 14, TITLEBAR, extra="")
        + rect(x, y, w, h, "none", rx=14, stroke=BORDER)
        + rect(x + 14, y + 12, 16, 16, accent, rx=5)
        + text(x + 22, y + 24, icon, 10, "#04140d", 700, "middle")
        + text(x + 38, y + 25, title, 12, TEXT_2, 600)
        + title_extra
    )
    if controls:
        for index, color in enumerate(["#4c5970", "#4c5970", "#ff6b81"]):
            head += rect(x + w - 74 + index * 20, y + 17, 10, 10, color, rx=3, opacity=0.85)
    return f'<g filter="url(#shadow)"><clipPath id="{clip}"><rect x="{x}" y="{y}" width="{w}" height="{h}" rx="14"/></clipPath>{head}<g clip-path="url(#{clip})">{body}</g>{rect(x, y, w, h, "none", rx=14, stroke=BORDER)}</g>'


def desktop_icons():
    items = [("Files", "▣", "#6fc9ff"), ("Browser", "◍", "#62c9ff"), ("Code", "{}", "#4aa8ff"),
             ("Games", "◆", "#a586ff"), ("Trash", "⌫", "#7f8da5")]
    out = []
    for index, (label, glyph, color) in enumerate(items):
        x = 30
        y = 120 + index * 96
        out.append(rect(x, y, 52, 52, SURFACE_2, rx=14, stroke=BORDER))
        out.append(rect(x, y, 52, 52, color, rx=14, opacity=0.14))
        out.append(text(x + 26, y + 33, glyph, 18, color, 700, "middle"))
        out.append(text(x + 26, y + 72, label, 11, TEXT_2, 600, "middle"))
    return "".join(out)


def panel():
    x, y, w, h = 16, H - 72, W - 32, 56
    out = [f'<g filter="url(#soft)">', rect(x, y, w, h, "#0e1622", rx=18, opacity=0.97), rect(x, y, w, h, "none", rx=18, stroke=BORDER)]
    # start button
    out.append(rect(x + 10, y + 9, 122, h - 18, ACCENT, rx=12, opacity=0.14))
    out.append(circle(x + 32, y + h / 2, 13, "url(#accent)"))
    out.append(text(x + 32, y + h / 2 + 5, "N", 14, "#04140d", 800, "middle"))
    out.append(text(x + 52, y + h / 2 + 4, "Applications", 12, TEXT_1, 600))
    # pinned apps — vector glyphs, not font-dependent symbols
    apps = [("#4aa8ff", "code"), ("#a586ff", "games"), ("#4fd6b8", "music"),
            ("#5aa9ff", "photos"), ("#f2b64c", "weather")]
    for index, (color, kind) in enumerate(apps):
        cx = x + 176 + index * 40
        out.append(rect(cx - 14, y + 14, 28, 28, SURFACE_3, rx=9, stroke=BORDER_SOFT))
        out.append(rect(cx - 14, y + 14, 28, 28, color, rx=9, opacity=0.13))
        out.append(mini_icon(cx, y + 28, color, kind))
    out.append(rect(x + 372, y + 16, 1, h - 32, "#ffffff", opacity=0.08))
    # window buttons
    for index, (label, color) in enumerate([("Code — hello.ts", "#4aa8ff"), ("Games", "#a586ff")]):
        bx = x + 386 + index * 156
        out.append(rect(bx, y + 13, 148, h - 26, SURFACE_2, rx=10, stroke=BORDER_SOFT))
        out.append(rect(bx + 9, y + 21, 18, 18, color, rx=5, opacity=0.22))
        out.append(text(bx + 18, y + 34, "•", 10, color, 700, "middle"))
        out.append(text(bx + 33, y + 34, label, 10.5, TEXT_2, 500))
    # workspaces + tray
    wx = x + 700
    for index in range(4):
        out.append(rect(wx + index * 18, y + h / 2 - 3, 6 if index else 16, 6, ACCENT if index == 0 else "#2c3a4d", rx=3))
    tray_x = x + w - 300
    for index, kind in enumerate(["wifi", "volume", "sun", "battery", "bell"]):
        out.append(mini_icon(tray_x + index * 28, y + h / 2, TEXT_3, kind))
    out.append(text(x + w - 132, y + h / 2 - 2, "11:42", 13, TEXT_1, 700, "middle"))
    out.append(text(x + w - 132, y + h / 2 + 13, "Tue 28 Oct", 9.5, TEXT_3, 500, "middle"))
    out.append("</g>")
    return "".join(out)


def files_window(x, y, w, h):
    body = [rect(x, y + 40, w, h - 40, WINDOW_BG)]
    # sidebar
    body.append(rect(x, y + 40, 178, h - 40, SURFACE_1))
    body.append(rect(x + 178, y + 40, 1, h - 40, "#ffffff", opacity=0.06))
    side = ["Home", "Desktop", "Documents", "Downloads", "Pictures", "Music", "Games", "Projects"]
    for index, label in enumerate(side):
        iy = y + 58 + index * 30
        active = label == "Projects"
        if active:
            body.append(rect(x + 8, iy - 14, 162, 26, ACCENT, rx=8, opacity=0.13))
        body.append(rect(x + 18, iy - 9, 13, 10, "#6fc9ff" if not active else ACCENT, rx=3, opacity=0.75))
        body.append(text(x + 40, iy, label, 11.5, TEXT_1 if active else TEXT_2, 600 if active else 400))
    # toolbar
    body.append(text(x + 198, y + 68, "Home", 11, TEXT_3))
    body.append(text(x + 232, y + 68, "/", 11, TEXT_3, opacity=0.5))
    body.append(text(x + 244, y + 68, "Projects", 11, TEXT_1, 600))
    body.append(rect(x + w - 108, y + 54, 92, 22, SURFACE_2, rx=7, stroke=BORDER_SOFT))
    body.append(text(x + w - 64, y + 69, "≡  Grid", 9.5, TEXT_3, 500, "middle"))
    # file grid
    files = [
        ("hello.ts", "#4aa8ff", "{}"),
        ("theme.css", "#a586ff", "#"),
        ("notes.md", "#8b98a9", "M"),
        ("data.json", "#f2b64c", "{}"),
        ("README.md", "#8b98a9", "M"),
        ("main.py", "#4fd6b8", "py"),
    ]
    for index, (name, color, glyph) in enumerate(files):
        col, row = index % 3, index // 3
        cx = x + 200 + col * 186
        cy = y + 92 + row * 132
        body.append(rect(cx, cy, 170, 116, SURFACE_2, rx=12, stroke=BORDER_SOFT))
        body.append(rect(cx + 14, cy + 14, 34, 34, color, rx=10, opacity=0.16))
        body.append(text(cx + 31, cy + 37, glyph, 12, color, 700, "middle"))
        body.append(text(cx + 14, cy + 72, name, 12, TEXT_1, 600))
        body.append(text(cx + 14, cy + 90, "text file · 2 KB", 9.5, TEXT_3))
        body.append(text(cx + 14, cy + 105, "edited just now", 9, TEXT_3, opacity=0.8))
    body.append(rect(x + 200, y + 366, 700, 1, "#ffffff", opacity=0.05))
    body.append(text(x + 200, y + h - 20, "6 items", 10, TEXT_3))
    body.append(text(x + w - 100, y + h - 20, "2.4 MB free", 10, TEXT_3))
    return window(x, y, w, h, "Files — Projects", "#6fc9ff", "▣", "".join(body))


def code_window(x, y, w, h):
    body = [rect(x, y + 40, w, h - 40, "#080c13")]
    # activity bar
    body.append(rect(x, y + 40, 42, h - 40, "#0a0e16"))
    for index, glyph in enumerate(["▤", "⌕"]):
        ay = y + 54 + index * 36
        if index == 0:
            body.append(rect(x + 6, ay, 30, 30, ACCENT, rx=8, opacity=0.14))
        body.append(text(x + 21, ay + 21, glyph, 14, ACCENT if index == 0 else TEXT_3, 500, "middle"))
    # explorer
    body.append(rect(x + 42, y + 40, 196, h - 40, SURFACE_1))
    body.append(text(x + 54, y + 62, "EXPLORER", 8.5, TEXT_3, 700, extra='letter-spacing="1.4"'))
    body.append(text(x + 54, y + 86, "▾  Projects", 10.5, TEXT_2, 600))
    files = [("hello.ts", "#4aa8ff", True), ("theme.css", "#a586ff", False),
             ("notes.md", "#8b98a9", False), ("data.json", "#f2b64c", False)]
    for index, (name, color, active) in enumerate(files):
        fy = y + 104 + index * 24
        if active:
            body.append(rect(x + 48, fy - 13, 186, 22, ACCENT, rx=6, opacity=0.12))
        body.append(circle(x + 60, fy - 4, 3, color))
        body.append(text(x + 70, fy, name, 10.5, TEXT_1 if active else TEXT_2))
    # tabs
    body.append(rect(x + 238, y + 40, w - 238, 32, "#0a0e16"))
    for index, (name, color) in enumerate([("hello.ts", "#4aa8ff"), ("theme.css", "#a586ff")]):
        tx = x + 238 + index * 132
        if index == 0:
            body.append(rect(tx, y + 40, 132, 32, "#080c13"))
            body.append(rect(tx, y + 40, 132, 2, ACCENT))
        body.append(circle(tx + 16, y + 56, 3, color))
        body.append(text(tx + 26, y + 60, name, 10.5, TEXT_1 if index == 0 else TEXT_3))
        body.append(text(tx + 118, y + 60, "×", 10, TEXT_3))
    # code lines
    code = [
        [("// Welcome to NOVA Code", "#5f7085")],
        [("import", "#a78bfa"), (" { createStore } ", "#c9d5e5"), ("from", "#a78bfa"), (" ", "#c9d5e5"), ("'nova/core'", "#8fe3b6"), (";", "#c9d5e5")],
        [],
        [("interface", "#a78bfa"), (" Greeting {", "#c9d5e5")],
        [("  name", "#7dd3fc"), (": ", "#c9d5e5"), ("string", "#a78bfa"), (";", "#c9d5e5")],
        [("  language", "#7dd3fc"), (": ", "#c9d5e5"), ("'en'", "#8fe3b6"), (" | ", "#c9d5e5"), ("'fa'", "#8fe3b6"), (";", "#c9d5e5")],
        [("}", "#c9d5e5")],
        [],
        [("export", "#a78bfa"), (" function", "#a78bfa"), (" greet", "#6fc9ff"), ("({ name, language }: Greeting) {", "#c9d5e5")],
        [("  const", "#a78bfa"), (" table ", "#c9d5e5"), ("= ", "#c9d5e5"), ("{ en: ", "#c9d5e5"), ("'Hello'", "#8fe3b6"), (", fa: ", "#c9d5e5"), ("'Salam'", "#8fe3b6"), (" };", "#c9d5e5")],
        [("  return", "#a78bfa"), (" `${table[language]}, ${name}!`;", "#8fe3b6")],
        [("}", "#c9d5e5")],
        [],
        [("console", "#c9d5e5"), (".", "#c9d5e5"), ("log", "#6fc9ff"), ("(", "#c9d5e5"), ("greet", "#6fc9ff"), ("({ name: ", "#c9d5e5"), ("'NOVA'", "#8fe3b6"), (", language: ", "#c9d5e5"), ("'fa'", "#8fe3b6"), (" }));", "#c9d5e5")],
    ]
    gutter_x = x + 238 + 16
    text_x = x + 238 + 58
    for index, _ in enumerate(code):
        body.append(text(gutter_x, y + 96 + index * 21, str(index + 1), 11, "#4a566a", 400, "end", MONO))
    for row, parts in enumerate(code):
        if not parts:
            continue
        spans = "".join(
            f'<tspan fill="{color}">{esc(value)}</tspan>' for value, color in parts if value
        )
        body.append(
            f'<text x="{text_x}" y="{y + 96 + row * 21}" font-family="{MONO}" font-size="11.5" '
            f'xml:space="preserve">{spans}</text>'
        )
    # status bar
    body.append(rect(x, y + h - 26, w, 26, "#0f2a24"))
    body.append(text(x + 250, y + h - 9, "~/Projects/hello.ts", 9.5, TEXT_2))
    for index, value in enumerate(["Ln 9, Col 3", "14 lines", "TypeScript", "Saved"]):
        body.append(text(x + w - 380 + index * 92, y + h - 9, value, 9.5, TEXT_2))
    return window(x, y, w, h, "Code — hello.ts", "#4aa8ff", "{}", "".join(body))


def desktop_content():
    """The desktop scene without its <svg> wrapper (reused by other figures)."""
    return (
        wallpaper()
        + desktop_icons()
        + files_window(132, 96, 768, 486)
        + code_window(560, 348, 760, 452)
        + panel()
    )


def scene_desktop():
    svg = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" role="img" aria-label="NOVA Linux desktop with the Files and Code windows open">']
    svg.append(defs())
    svg.append(desktop_content())
    svg.append("</svg>")
    return "".join(svg)


def search_window(x, y, w, h):
    body = [rect(x, y + 40, w, h - 40, "#0b101a")]
    # tab strip
    body.append(rect(x, y + 40, w, 34, "#0a0e16"))
    body.append(rect(x + 10, y + 46, 190, 28, SURFACE_2, rx=8, stroke=BORDER_SOFT))
    body.append(circle(x + 26, y + 60, 5, ACCENT))
    body.append(text(x + 40, y + 64, "Nova Search", 10.5, TEXT_1, 600))
    body.append(text(x + 186, y + 64, "×", 10, TEXT_3))
    body.append(text(x + 222, y + 65, "+", 12, TEXT_3))
    # toolbar
    body.append(rect(x, y + 74, w, 44, SURFACE_1))
    for index, glyph in enumerate(["‹", "›", "⟳"]):
        body.append(text(x + 22 + index * 26, y + 101, glyph, 13, TEXT_3, 500, "middle"))
    body.append(rect(x + 100, y + 82, w - 220, 28, "#080d16", rx=9, stroke=BORDER_SOFT))
    body.append(text(x + 112, y + 100, "⌕", 11, TEXT_3))
    body.append(text(x + 130, y + 101, "linux kernel", 11.5, TEXT_1))
    body.append(text(x + w - 108, y + 101, "⋮", 13, TEXT_3))
    # page
    body.append(rect(x, y + 118, w, h - 118, "#0a0f18"))
    body.append(text(x + 60, y + 168, "Nova Search", 20, TEXT_1, 700))
    body.append(text(x + 60, y + 192, "5 sources · real results, ranked and grouped by provider", 11, TEXT_3))
    # search field
    body.append(rect(x + 60, y + 210, w - 470, 40, SURFACE_2, rx=12, stroke=BORDER))
    body.append(text(x + 76, y + 235, "⌕", 13, ACCENT))
    body.append(text(x + 96, y + 236, "linux kernel architecture", 12.5, TEXT_2))
    body.append(rect(x + w - 396, y + 210, 96, 40, "url(#accent)", rx=12))
    body.append(text(x + w - 348, y + 235, "Search", 11.5, "#04140d", 700, "middle"))
    # source chips
    chips = [("Wikipedia", 6, ACCENT), ("Stack Overflow", 8, ACCENT), ("Hacker News", 1, ACCENT),
             ("DuckDuckGo", 2, ACCENT_2), ("Dictionary", 0, TEXT_3)]
    cx = x + 60
    for label, count, color in chips:
        width = 46 + len(label) * 6.6 + 18
        body.append(rect(cx, y + 268, width, 28, SURFACE_2, rx=9, stroke=BORDER_SOFT))
        body.append(circle(cx + 15, y + 282, 3.5, color))
        body.append(text(cx + 26, y + 286, label, 10, TEXT_2, 600))
        badge = cx + width - 22
        body.append(rect(badge - 9, y + 275, 18, 15, "#ffffff", rx=7, opacity=0.06))
        body.append(text(badge, y + 286, str(count), 9.5, TEXT_3, 700, "middle"))
        cx += width + 8
    # instant answer
    body.append(rect(x + 60, y + 314, w - 380, 92, SURFACE_1, rx=14, stroke=BORDER_SOFT))
    body.append(rect(x + 60, y + 314, 3, 92, ACCENT_2, rx=1.5))
    body.append(text(x + 82, y + 340, "INSTANT ANSWER", 8.5, ACCENT_2, 700, extra='letter-spacing="1.3"'))
    body.append(text(x + 82, y + 364, "The Linux kernel is the core of the Linux operating system:", 11.5, TEXT_1, 600))
    body.append(text(x + 82, y + 384, "it manages processes, memory and device drivers while user-space", 10.5, TEXT_2))
    body.append(text(x + 82, y + 399, "programs talk to it through system calls.", 10.5, TEXT_2))
    # results
    groups = [
        ("WIKIPEDIA", 6, [
            ("Linux kernel", "en.wikipedia.org › wiki › Linux_kernel",
             "The Linux kernel is a free and open-source, monolithic, modular, multitasking Unix-like kernel that is deployed on a wide variety of systems."),
            ("History of Linux", "en.wikipedia.org › wiki › History_of_Linux",
             "Linux began in 1991 with Linus Torvalds' first kernel release for the Intel 386 architecture."),
            ("Monolithic kernel", "en.wikipedia.org › wiki › Monolithic_kernel",
             "Monolithic kernels run all operating-system services in a single address space, which keeps communication fast."),
        ]),
        ("STACK OVERFLOW", 8, [
            ("How does the Linux kernel schedule processes?", "stackoverflow.com › questions › 4210",
             "The completely fair scheduler keeps a red-black tree of runnable tasks and picks the one with the smallest virtual runtime."),
            ("Reading the kernel source as a beginner", "stackoverflow.com › questions › 88112",
             "Start with Documentation/ and a single subsystem such as drivers/char, then trace one system call end to end."),
        ]),
        ("HACKER NEWS", 1, [
            ("Linux 6.13 released with new scheduler work", "news.ycombinator.com › item",
             "Discussion thread: what the new kernel means for low-latency desktop users and server fleets."),
        ]),
    ]
    gy = y + 430
    for title, count, rows in groups:
        body.append(text(x + 60, gy, title, 9, TEXT_3, 700, extra='letter-spacing="1.4"'))
        body.append(text(x + 60 + len(title) * 7.6 + 10, gy, f"{count} results", 9, TEXT_3, 400))
        gy += 10
        for name, url, snippet in rows:
            body.append(text(x + 60, gy + 20, name, 12, ACCENT_2, 600))
            body.append(text(x + 60, gy + 36, url, 9.5, TEXT_3))
            for offset, line in enumerate(wrap(snippet, 92, 2)):
                body.append(text(x + 60, gy + 52 + offset * 15, line, 10.5, TEXT_2))
            gy += 86
    # right rail
    body.append(rect(x + w - 300, y + 210, 240, 300, SURFACE_1, rx=14, stroke=BORDER_SOFT))
    body.append(text(x + w - 282, y + 238, "PROVIDER STATUS", 8.5, TEXT_3, 700, extra='letter-spacing="1.3"'))
    providers = [("Wikipedia", ACCENT, "ok · 240 ms"), ("Stack Overflow", ACCENT, "ok · 412 ms"),
                 ("Hacker News", ACCENT, "ok · 188 ms"), ("DuckDuckGo", ACCENT_2, "empty"),
                 ("Dictionary", "#ff7a90", "error · 429")]
    for index, (name, color, status) in enumerate(providers):
        py = y + 262 + index * 34
        body.append(rect(x + w - 282, py, 204, 28, SURFACE_2, rx=8))
        body.append(circle(x + w - 268, py + 14, 3.5, color))
        body.append(text(x + w - 256, py + 18, name, 10, TEXT_1, 600))
        body.append(text(x + w - 96, py + 18, status, 9, TEXT_3))
    body.append(text(x + w - 282, y + 452, "One failing provider never hides", 9.5, TEXT_3))
    body.append(text(x + w - 282, y + 467, "the others — the chips are honest.", 9.5, TEXT_3))
    return window(x, y, w, h, "Browser — Nova Search", "#62c9ff", "◍", "".join(body))


def scene_search():
    svg = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" role="img" aria-label="Nova Search showing grouped results from five providers">']
    svg.append(defs())
    svg.append(rect(0, 0, W, H, "#04070c"))
    svg.append(rect(0, 0, W, H, "url(#glow)", opacity=0.5))
    svg.append(search_window(60, 50, 1320, 800))
    svg.append("</svg>")
    return "".join(svg)


def game_card(x, y, w, h, name, tagline, steps, accent, glyph, best, tags=()):
    out = [rect(x, y, w, h, SURFACE_1, rx=14, stroke=BORDER_SOFT)]
    out.append(rect(x + 14, y, w - 28, 2.5, accent, rx=1.5, opacity=0.8))
    out.append(rect(x + 18, y + 20, 44, 44, accent, rx=13, opacity=0.16))
    out.append(text(x + 40, y + 48, glyph, 17, accent, 700, "middle"))
    out.append(text(x + 74, y + 40, name, 14, TEXT_1, 700))
    out.append(text(x + 74, y + 58, tagline, 10, TEXT_3))
    for index, step in enumerate(steps):
        sy = y + 88 + index * 18
        out.append(circle(x + 22, sy - 4, 2.2, TEXT_3))
        out.append(text(x + 32, sy, step[:74], 10, TEXT_2))
    tx = x + 18
    for tag in tags:
        tw = 13 + len(tag) * 5.4
        out.append(rect(tx, y + 142, tw, 22, SURFACE_2, rx=7, stroke=BORDER_SOFT))
        out.append(text(tx + tw / 2, y + 157, tag, 8.5, TEXT_3, 600, "middle"))
        tx += tw + 7
    out.append(rect(x + 18, y + h - 46, w - 36, 1, "#ffffff", opacity=0.06))
    out.append(text(x + 18, y + h - 24, f"★  Best: {best}", 10, TEXT_3, 600))
    out.append(rect(x + w - 96, y + h - 40, 78, 26, ACCENT, rx=8))
    out.append(text(x + w - 57, y + h - 23, "▶  Play", 10, "#04140d", 700, "middle"))
    return "".join(out)


def scene_games():
    body = [rect(80, 90, 1280, 760, "#0a0f18")]
    body.append(text(112, 146, "Games", 22, TEXT_1, 700))
    body.append(text(112, 172, "Four complete games that run entirely in this window — real rules, real scores, no downloads.", 11, TEXT_2))
    body.append(rect(1120, 122, 208, 30, SURFACE_2, rx=15, stroke=BORDER_SOFT))
    body.append(text(1224, 142, "★  24 rounds played", 10.5, TEXT_2, 600, "middle"))
    cards = [
        ("Minesweeper", "Clear the field without touching a mine.",
         ["Left-click to reveal — the first click is always safe.", "Right-click or long-press to place a flag.", "Click a number to chord the remaining neighbours."],
         "#f2b64c", "✹", "0:41", ("3 difficulties", "flags + timer", "keyboard & touch")),
        ("2048", "Slide tiles, merge numbers, reach 2048.",
         ["Arrow keys or WASD slide the whole board.", "Equal tiles merge and double; new tiles spawn.", "One step of undo is always available."],
         "#7c86f5", "⧉", "13,420", ("undo", "keyboard & swipe", "best score")),
        ("Snake", "Eat apples, grow longer, avoid your tail.",
         ["Steer with the arrow keys or WASD.", "Every apple makes you longer and faster.", "Space pauses, R restarts, swipe on touch."],
         "#3ddc97", "≈", "260", ("3 speeds", "pause + restart", "swipe on touch")),
        ("Tic-Tac-Toe", "Play a friend or the minimax computer.",
         ["You are X; the computer is O.", "Easy, medium and hard opponents.", "On hard, a draw is the best result."],
         "#ff7a90", "◈", "12 wins", ("minimax AI", "3 levels", "2 player")),
    ]
    for index, (name, tagline, steps, accent, glyph, best, tags) in enumerate(cards):
        col, row = index % 2, index // 2
        body.append(game_card(112 + col * 588, 205 + row * 292, 560, 258, name, tagline, steps, accent, glyph, best, tags))
    body.append(text(112, 830, "High scores are stored in this browser only. The desktop “Games” folder opens each game too.", 9.5, TEXT_3))
    svg = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" role="img" aria-label="The NOVA Games hub with four playable games">']
    svg.append(defs())
    svg.append(rect(0, 0, W, H, "#04070c"))
    svg.append(rect(0, 0, W, H, "url(#glow2)", opacity=0.6))
    svg.append(window(80, 50, 1280, 800, "Games", "#a586ff", "◆", "".join(body)))
    svg.append("</svg>")
    return "".join(svg)


def scene_code():
    svg = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" role="img" aria-label="NOVA Code editing a TypeScript file">']
    svg.append(defs())
    svg.append(rect(0, 0, W, H, "#04070c"))
    svg.append(rect(0, 0, W, H, "url(#glow)", opacity=0.4))
    svg.append(code_window(80, 60, 1280, 780))
    svg.append("</svg>")
    return "".join(svg)


def main():
    os.makedirs(OUT, exist_ok=True)
    scenes = {
        "01-desktop.svg": scene_desktop(),
        "02-search.svg": scene_search(),
        "03-games.svg": scene_games(),
        "04-responsive.svg": scene_responsive(),
    }
    for name, content in scenes.items():
        path = os.path.join(OUT, name)
        with open(path, "w", encoding="utf-8") as handle:
            handle.write(content)
        print(f"wrote {path} ({len(content) // 1024} kB)")

    # Optional PNG pass: needs `pip install resvg-py`. Skipped silently otherwise.
    try:
        import resvg_py  # type: ignore
    except ImportError:
        print("resvg_py not installed - SVG only (pip install resvg-py for PNGs)")
        return
    for name in scenes:
        png = os.path.join(OUT, name.replace(".svg", ".png"))
        with open(png, "wb") as handle:
            handle.write(bytes(resvg_py.svg_to_bytes(
                svg_path=os.path.join(OUT, name), width=1440)))
        print(f"wrote {png}")




def phone_frame(x, y, w, h):
    """A narrow 390 px-wide view of the shell: full-screen window + panel."""
    r = 26
    out = [rect(x, y, w, h, "#0b1119", rx=r, stroke=BORDER), rect(x + 2, y + 2, w - 4, h - 4, "#04070c", rx=r - 2)]
    out.append(text(x + 18, y + 26, "11:42", 10, TEXT_2, 600))
    out.append(circle(x + w - 26, y + 21, 3.4, TEXT_3))
    out.append(rect(x + w - 18, y + 17, 9, 6, "none", rx=2, stroke=TEXT_3, sw=1.2))
    out.append(rect(x + 10, y + 38, w - 20, 30, TITLEBAR, rx=10))
    out.append(rect(x + 20, y + 48, 12, 12, "#f2b64c", rx=4))
    out.append(text(x + 38, y + 58, "Minesweeper", 9.5, TEXT_2, 600))
    out.append(text(x + w - 26, y + 58, "x", 9, TEXT_3))
    board_x, board_y, cell = x + 14, y + 80, 19
    out.append(rect(board_x - 5, board_y - 5, cell * 9 + 10, cell * 9 + 10, SURFACE_1, rx=8))
    revealed = {(1, 0), (1, 1), (0, 1), (2, 1), (1, 2), (0, 2), (2, 2), (3, 2), (1, 3), (2, 3)}
    flagged = {(3, 0), (5, 4)}
    numbers = {(1, 0): "1", (1, 1): "2", (0, 1): "1", (2, 1): "2", (1, 2): "3",
               (0, 2): "2", (2, 2): "3", (3, 2): "1", (1, 3): "2", (2, 3): "3"}
    for row in range(9):
        for col in range(9):
            cx = board_x + col * cell
            cy = board_y + row * cell
            key = (col, row)
            if key in revealed:
                out.append(rect(cx, cy, cell - 1.5, cell - 1.5, "#080d14", rx=3))
                if key in numbers:
                    out.append(text(cx + (cell - 1.5) / 2, cy + 13, numbers[key], 9, "#6fc9ff", 700, "middle"))
            elif key in flagged:
                out.append(rect(cx, cy, cell - 1.5, cell - 1.5, "#2a2213", rx=3, stroke="#f2b64c", sw=0.8))
                out.append(rect(cx + 5, cy + 4, 1.6, 9, "#ffb457"))
                out.append(rect(cx + 5, cy + 4, 8, 5, "none", rx=1, stroke="#ffb457", sw=1.1))
            else:
                out.append(rect(cx, cy, cell - 1.5, cell - 1.5, SURFACE_3, rx=3, stroke=BORDER_SOFT, sw=0.6))
    for index, label in enumerate(["Easy", "Medium", "Hard"]):
        cw = 46
        cxp = x + 14 + index * (cw + 5)
        cy = y + 270
        if index == 1:
            out.append(rect(cxp, cy, cw, 20, ACCENT, rx=6, opacity=0.16))
        else:
            out.append(rect(cxp, cy, cw, 20, SURFACE_2, rx=6, stroke=BORDER_SOFT))
        out.append(text(cxp + cw / 2, cy + 14, label, 8, TEXT_2, 600, "middle"))
    out.append(text(x + 14, y + 308, "Tap to reveal, long-press to flag", 8, TEXT_3))
    panel_y = y + h - 44
    out.append(rect(x + 6, panel_y, w - 12, 34, "#0e1622", rx=12, stroke=BORDER))
    out.append(circle(x + 24, panel_y + 17, 9, "url(#accent)"))
    out.append(text(x + 24, panel_y + 21, "N", 9, "#04140d", 800, "middle"))
    for index, opacity in enumerate([0.16, 0.12, 0.12]):
        out.append(rect(x + 42 + index * 22, panel_y + 12, 16, 10, "#ffffff", rx=5, opacity=opacity))
    out.append(rect(x + w - 70, panel_y + 12, 24, 10, "#ffffff", rx=5, opacity=0.12))
    out.append(rect(x + w - 38, panel_y + 12, 26, 10, ACCENT, rx=5, opacity=0.7))
    return "".join(out)


def tablet_frame(x, y, w, h):
    """An 834 px-wide view: the command palette over the desktop."""
    r = 20
    out = [rect(x, y, w, h, "#0b1119", rx=r, stroke=BORDER)]
    out.append(rect(x + 2, y + 2, w - 4, h - 4, "#050a11", rx=r - 2))
    out.append(rect(x + 2, y + 2, w - 4, h - 4, "url(#glow)", rx=r - 2))
    out.append(text(x + 20, y + 30, "NOVA Linux", 11, TEXT_3, 600))
    px, py, pw = x + 16, y + 48, w - 32
    out.append(rect(px, py, pw, 236, SURFACE_1, rx=14, stroke=BORDER))
    out.append(rect(px, py, pw, 38, SURFACE_2, rx=14))
    out.append(rect(px + 14, py + 17, 10, 10, "none", rx=5, stroke=ACCENT, sw=1.4))
    out.append(text(px + 34, py + 25, "term", 11, TEXT_1))
    out.append(rect(px + pw - 40, py + 12, 28, 16, "#ffffff", rx=5, opacity=0.08))
    out.append(text(px + pw - 26, py + 24, "Esc", 7, TEXT_3, 600, "middle"))
    rows = [("Terminal", "System", True), ("Files", "System", False), ("Code", "Development", False),
            ("Switch to light theme", "Actions", False), ("Go to workspace 3", "Workspaces", False)]
    for index, (label, group, active) in enumerate(rows):
        ry = py + 46 + index * 34
        if active:
            out.append(rect(px + 6, ry, pw - 12, 30, ACCENT, rx=8, opacity=0.13))
        out.append(rect(px + 14, ry + 8, 13, 13, ACCENT if active else TEXT_3, rx=4, opacity=0.55))
        out.append(text(px + 36, ry + 20, label, 10, TEXT_1 if active else TEXT_2, 600 if active else 400))
        out.append(text(px + pw - 16, ry + 20, group, 8.5, TEXT_3, 400, "end"))
    for index in range(8):
        col, row = index % 4, index // 4
        cxp = x + 26 + col * 88
        cyp = y + h - 172 + row * 62
        out.append(rect(cxp, cyp, 64, 52, SURFACE_2, rx=10, stroke=BORDER_SOFT))
        out.append(rect(cxp + 18, cyp + 10, 28, 28, ACCENT, rx=9, opacity=0.14))
    out.append(rect(x + 10, y + h - 42, w - 20, 32, "#0e1622", rx=11, stroke=BORDER))
    out.append(circle(x + 28, y + h - 26, 8, "url(#accent)"))
    out.append(text(x + 28, y + h - 22, "N", 8, "#04140d", 800, "middle"))
    out.append(rect(x + w - 100, y + h - 32, 62, 9, "#ffffff", rx=4.5, opacity=0.14))
    return "".join(out)


def scene_responsive():
    w, h = 1440, 1112
    out = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}" role="img" aria-label="NOVA Linux at desktop, tablet and phone widths">']
    out.append(defs())
    out.append(rect(0, 0, w, h, "#04070c"))
    out.append(rect(0, 0, w, h, "url(#glow)", opacity=0.5))
    out.append(text(60, 74, "One codebase, every screen", 22, TEXT_1, 700))
    out.append(text(60, 100, "The same shell at 1440, 834 and 390 CSS pixels - windows become sheets, panels collapse, boards scale.", 11.5, TEXT_3))

    out.append(rect(60, 126, 830, 500, "#0b1119", rx=16, stroke=BORDER))
    out.append(f'<svg x="64" y="130" width="822" height="492" viewBox="0 0 {W} {H}" preserveAspectRatio="xMidYMid slice">')
    out.append(defs())
    out.append(desktop_content())
    out.append("</svg>")
    out.append(rect(60, 126, 830, 500, "none", rx=16, stroke=BORDER))
    out.append(text(60, 656, "1440 px - desktop", 11, TEXT_1, 700))
    out.append(text(60, 674, "two windows, dock, four workspaces", 9.5, TEXT_3))

    out.append(tablet_frame(930, 126, 390, 500))
    out.append(text(930, 656, "834 px - tablet", 11, TEXT_1, 700))
    out.append(text(930, 674, "command palette, single column", 9.5, TEXT_3))

    out.append(phone_frame(60, 700, 300, 380))
    out.append(text(410, 760, "390 px - phone", 11, TEXT_1, 700))
    out.append(text(410, 782, "Windows take the whole viewport, the panel shrinks to", 9.5, TEXT_3))
    out.append(text(410, 798, "an icon rail, minesweeper cells drop to 15 px and every", 9.5, TEXT_3))
    out.append(text(410, 814, "tap target stays at least 32 px.", 9.5, TEXT_3))

    out.append(text(760, 760, "Contract", 11, TEXT_1, 700))
    for index, (token, note) in enumerate([
        ("860 px", "Files sidebar collapses to icons"),
        ("760 px", "Code explorer becomes an overlay"),
        ("640 px", "game boards rescale, cards stack"),
        ("420 px", "palette and sheets go edge to edge"),
    ]):
        ry = 786 + index * 22
        out.append(rect(760, ry - 9, 46, 17, ACCENT, rx=5, opacity=0.14))
        out.append(text(783, ry + 3, token, 8.5, ACCENT, 700, "middle"))
        out.append(text(816, ry + 3, note, 9.5, TEXT_2))
    out.append("</svg>")
    return "".join(out)


if __name__ == "__main__":
    main()
