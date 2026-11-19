#!/usr/bin/env python3
"""
Deterministic generator for 21 Games brand & OpenGraph assets.

Generates:
  - public/og-image.svg        (1200x630 vector showcase of all 9 games)
  - public/og-image.png        (1200x630 2x-supersampled PNG showcase of all 9 games)
  - public/og/<slug>.png       (9 bespoke 1200x630 2x-supersampled per-game OG cards)
  - public/apple-touch-icon.png (180x180 full-bleed #F9D423 icon, no inner border)
  - public/icon-192.png        (192x192 full-bleed #F9D423 PWA icon)
  - public/icon-512.png        (512x512 full-bleed #F9D423 PWA icon)
  - public/favicon.ico         (multi-size 16x16 + 32x32 ICO)
"""

from __future__ import annotations

import math
from pathlib import Path
from typing import Iterable, Sequence, Tuple

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
PUBLIC_DIR = ROOT / "public"
OG_DIR = PUBLIC_DIR / "og"

FONT_DIR = Path("/usr/share/fonts/truetype/dejavu")
FONT_SERIF_BOLD = str(FONT_DIR / "DejaVuSerif-Bold.ttf")
FONT_SANS_BOLD = str(FONT_DIR / "DejaVuSans-Bold.ttf")
FONT_SANS = str(FONT_DIR / "DejaVuSans.ttf")
FONT_MONO_BOLD = str(FONT_DIR / "DejaVuSansMono-Bold.ttf")

LANCZOS = getattr(Image, "Resampling", Image).LANCZOS

# Editorial palette
BG_CANVAS = "#FCFCFD"
GRID_LINE = "#EFEFF3"
WHITE = "#FFFFFF"
SURFACE_SOFT = "#F5F5F8"
SURFACE_MUTED = "#EAEAEF"
INK = "#171717"
INK_BODY = "#3F3F46"
INK_MUTED = "#6B6B76"
GOLD = "#F9D423"
GOLD_SOFT = "#FEF7CD"
EMERALD = "#2ECC71"
EMERALD_SOFT = "#DCFCE7"
PURPLE = "#9D50BB"
PURPLE_SOFT = "#F3E8FF"
RED = "#EF4444"
RED_SOFT = "#FEE2E2"
AMBER = "#F59E0B"
BLUE = "#2563EB"
BLUE_SOFT = "#DBEAFE"


GAMES = [
    {
        "number": 21,
        "slug": "21-things",
        "name": "21 Things",
        "category": "DAILY GRATITUDE",
        "short_tag": "GRATITUDE",
        "mini_hook": "Narrow 21 picks → 6 → 3 → #1",
        "hook": "Curate 21 things you appreciate today and narrow them 21 → 6 → 3 → 1 to discover what resonates most.",
        "chip_a": "21 → 6 → 3 → 1",
        "chip_b": "DAILY RITUAL",
        "accent": GOLD,
        "accent_text": INK,
    },
    {
        "number": 17,
        "slug": "17-syllables",
        "name": "17 Syllables",
        "category": "DAILY HAIKU",
        "short_tag": "5-7-5 HAIKU",
        "mini_hook": "Rebuild the 5 · 7 · 5 poem",
        "hook": "Reconstruct today's 5-7-5 haiku from shuffled poetic fragments in an editorial word puzzle.",
        "chip_a": "5 · 7 · 5 METER",
        "chip_b": "POETIC LOGIC",
        "accent": EMERALD,
        "accent_text": INK,
    },
    {
        "number": 9,
        "slug": "9-rhymes",
        "name": "9 Rhymes",
        "category": "RHYME CHAT",
        "short_tag": "RHYME CHAT",
        "mini_hook": "Solve 9 perfect-rhyme clues",
        "hook": "Text with Nine to crack 9 progressive perfect-rhyme clues in a crisp iMessage-style chat.",
        "chip_a": "9 RHYME CLUES",
        "chip_b": "CHAT WITH NINE",
        "accent": PURPLE,
        "accent_text": WHITE,
    },
    {
        "number": 8,
        "slug": "eightfold-echo",
        "name": "Eightfold Echo",
        "category": "VISUAL LOGIC",
        "short_tag": "VISUAL LOGIC",
        "mini_hook": "Echo rules from center tile",
        "hook": "Follow single-attribute visual logic rules radiating from the emerald center across all 9 shape tiles.",
        "chip_a": "EMERALD ANCHOR",
        "chip_b": "9 SHAPE TILES",
        "accent": EMERALD,
        "accent_text": INK,
    },
    {
        "number": 6,
        "slug": "6-pics",
        "name": "6 Pics",
        "category": "JIGSAW REVEAL",
        "short_tag": "JIGSAW REVEAL",
        "mini_hook": "6 themed pics · up to 36 pts",
        "hook": "Use today's upfront theme to identify 6 jigsaw-covered images — peel fewer pieces to score up to 36 points.",
        "chip_a": "UPFRONT THEME",
        "chip_b": "MAX 36 POINTS",
        "accent": GOLD,
        "accent_text": INK,
    },
    {
        "number": 5,
        "slug": "connect-5",
        "name": "Connect 5",
        "category": "WORD CHAIN",
        "short_tag": "WORD CHAIN",
        "mini_hook": "5 linked compound words",
        "hook": "Solve the 5-row compound word chain where every word links seamlessly to the word above it.",
        "chip_a": "5-ROW CHAIN",
        "chip_b": "COMPOUND LINKS",
        "accent": EMERALD,
        "accent_text": INK,
    },
    {
        "number": 4,
        "slug": "four-score",
        "name": "Four Score",
        "category": "NUMBER LOGIC",
        "short_tag": "TARGET 80",
        "mini_hook": "Combine tiles to hit 80",
        "hook": "Combine every number tile and operator badge on the board to hit the exact target of 80.",
        "chip_a": "EXACT TARGET 80",
        "chip_b": "ALL TILES USED",
        "accent": GOLD,
        "accent_text": INK,
    },
    {
        "number": 2,
        "slug": "move-2",
        "name": "Move Two",
        "category": "3D SPATIAL PUZZLE",
        "short_tag": "3D ISLANDS",
        "mini_hook": "Roll 2×1×1 into Emerald Goal",
        "hook": "Roll the 3D 2×1×1 block across floating islands, trigger switches & bridges, dodge Red Obstacles, and drop upright into the Emerald Goal.",
        "chip_a": "8×8 · 9×9 · 10×10",
        "chip_b": "EMERALD GOAL",
        "accent": PURPLE,
        "accent_text": WHITE,
    },
    {
        "number": 1,
        "slug": "1-win",
        "name": "1 Win",
        "category": "DAILY REFLECTION",
        "short_tag": "DAILY WIN",
        "mini_hook": "1–4 words · global match",
        "hook": "Share 1 win from your day in 1–4 words and see how many players around the world share it.",
        "chip_a": "1–4 WORDS",
        "chip_b": "WORLDWIDE ECHO",
        "accent": GOLD,
        "accent_text": INK,
    },
]


def load_font(path: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(path, size)


def text_size(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.FreeTypeFont) -> Tuple[int, int]:
    bbox = draw.textbbox((0, 0), text, font=font)
    return bbox[2] - bbox[0], bbox[3] - bbox[1]


def draw_centered_text(
    draw: ImageDraw.ImageDraw,
    box: Tuple[float, float, float, float],
    text: str,
    font: ImageFont.FreeTypeFont,
    fill: str = INK,
    dy: float = 0.0,
) -> None:
    x0, y0, x1, y1 = box
    bbox = draw.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    tx = x0 + (x1 - x0 - tw) / 2.0 - bbox[0]
    ty = y0 + (y1 - y0 - th) / 2.0 - bbox[1] + dy
    draw.text((tx, ty), text, font=font, fill=fill)


def wrap_lines(
    draw: ImageDraw.ImageDraw,
    text: str,
    font: ImageFont.FreeTypeFont,
    max_width: int,
) -> list[str]:
    words = text.split()
    lines: list[str] = []
    current = ""
    for word in words:
        candidate = f"{current} {word}".strip()
        w, _ = text_size(draw, candidate, font)
        if w <= max_width or not current:
            current = candidate
        else:
            lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


def draw_shadow_card(
    draw: ImageDraw.ImageDraw,
    box: Tuple[int, int, int, int],
    radius: int,
    fill: str = WHITE,
    outline: str = INK,
    width: int = 4,
    shadow_offset: int = 8,
) -> None:
    x0, y0, x1, y1 = box
    if shadow_offset > 0:
        draw.rounded_rectangle(
            (x0 + shadow_offset, y0 + shadow_offset, x1 + shadow_offset, y1 + shadow_offset),
            radius=radius,
            fill=INK,
        )
    draw.rounded_rectangle(
        box,
        radius=radius,
        fill=fill,
        outline=outline,
        width=width,
    )


def draw_editorial_canvas(S: int = 2) -> Tuple[Image.Image, ImageDraw.ImageDraw]:
    W, H = 1200 * S, 630 * S
    img = Image.new("RGB", (W, H), BG_CANVAS)
    draw = ImageDraw.Draw(img)

    step = 36 * S
    for gx in range(0, W, step):
        draw.line([(gx, 0), (gx, H)], fill=GRID_LINE, width=max(1, S // 2))
    for gy in range(0, H, step):
        draw.line([(0, gy), (W, gy)], fill=GRID_LINE, width=max(1, S // 2))

    # Outer architectural frame
    draw.rounded_rectangle(
        (22 * S, 22 * S, (1200 - 22) * S, (630 - 22) * S),
        radius=18 * S,
        outline=INK,
        width=3 * S,
    )
    return img, draw


def draw_brand_badge(
    draw: ImageDraw.ImageDraw,
    x: int,
    y: int,
    size: int,
    S: int,
) -> None:
    shadow = max(3 * S, size // 12)
    radius = max(8 * S, size // 5)
    draw_shadow_card(
        draw,
        (x, y, x + size, y + size),
        radius=radius,
        fill=GOLD,
        outline=INK,
        width=max(2 * S, size // 18),
        shadow_offset=shadow,
    )
    font_num = load_font(FONT_SERIF_BOLD, int(size * 0.48))
    draw_centered_text(draw, (x, y, x + size, y + int(size * 0.88)), "21", font_num, INK)
    # Subtle bottom ink bar
    bar_w = int(size * 0.44)
    bar_h = max(2 * S, int(size * 0.07))
    bx0 = x + (size - bar_w) // 2
    by0 = y + int(size * 0.80)
    draw.rounded_rectangle((bx0, by0, bx0 + bar_w, by0 + bar_h), radius=bar_h // 2, fill=INK)


# ---------------------------------------------------------------------------
# Mini game illustrations (used inside the 3x3 showcase grid on og-image.png)
# ---------------------------------------------------------------------------
def draw_mini_game_graphic(
    draw: ImageDraw.ImageDraw,
    slug: str,
    box: Tuple[int, int, int, int],
    S: int,
) -> None:
    x0, y0, x1, y1 = box
    w = x1 - x0
    h = y1 - y0
    draw.rounded_rectangle(box, radius=8 * S, fill=SURFACE_SOFT, outline="#DEDEE6", width=int(1.5 * S))

    pad = 10 * S
    ix0, iy0, ix1, iy1 = x0 + pad, y0 + pad, x1 - pad, y1 - pad
    iw, ih = ix1 - ix0, iy1 - iy0

    if slug == "21-things":
        # Funnel pyramid: top #1 gold bar, 2 emerald bars, 3 purple bars, 5 base dots
        bw1 = int(iw * 0.46)
        bx1 = ix0 + (iw - bw1) // 2
        draw.rounded_rectangle((bx1, iy0 + 2 * S, bx1 + bw1, iy0 + 20 * S), radius=4 * S, fill=GOLD, outline=INK, width=2 * S)
        for i in range(2):
            bw2 = int(iw * 0.36)
            gap = int(iw * 0.08)
            start = ix0 + (iw - (2 * bw2 + gap)) // 2 + i * (bw2 + gap)
            draw.rounded_rectangle((start, iy0 + 27 * S, start + bw2, iy0 + 43 * S), radius=4 * S, fill=EMERALD, outline=INK, width=2 * S)
        for i in range(3):
            bw3 = int(iw * 0.27)
            gap = int(iw * 0.05)
            start = ix0 + (iw - (3 * bw3 + 2 * gap)) // 2 + i * (bw3 + gap)
            draw.rounded_rectangle((start, iy0 + 50 * S, start + bw3, iy0 + 64 * S), radius=3 * S, fill=PURPLE, outline=INK, width=int(1.8 * S))
        for i in range(5):
            r = 3 * S
            cx = ix0 + int(iw * (0.18 + 0.16 * i))
            cy = iy0 + 75 * S
            draw.ellipse((cx - r, cy - r, cx + r, cy + r), fill=INK)

    elif slug == "17-syllables":
        # 5 - 7 - 5 haiku horizontal syllable bars
        rows = [
            (0.64, GOLD, "5"),
            (0.94, EMERALD, "7"),
            (0.64, PURPLE, "5"),
        ]
        f_small = load_font(FONT_SANS_BOLD, 10 * S)
        for idx, (ratio, col, num_txt) in enumerate(rows):
            ry = iy0 + 6 * S + idx * 25 * S
            rw = int(iw * ratio)
            rx = ix0 + (iw - rw) // 2
            draw.rounded_rectangle((rx, ry, rx + rw, ry + 18 * S), radius=5 * S, fill=col, outline=INK, width=2 * S)
            txt_col = WHITE if col == PURPLE else INK
            draw_centered_text(draw, (rx, ry, rx + rw, ry + 18 * S), num_txt, f_small, txt_col)

    elif slug == "9-rhymes":
        # Stepped linear gold/green/purple rhyme chat bars (NEVER 3x3 tic-tac-toe!)
        bars = [
            (0.00, 0.72, GOLD),
            (0.14, 0.86, EMERALD),
            (0.28, 1.00, PURPLE),
        ]
        for idx, (left_f, right_f, col) in enumerate(bars):
            ry = iy0 + 6 * S + idx * 25 * S
            rx0 = ix0 + int(iw * left_f)
            rx1 = ix0 + int(iw * right_f)
            draw.rounded_rectangle((rx0, ry, rx1, ry + 18 * S), radius=9 * S, fill=col, outline=INK, width=2 * S)
            # Subtle inner chat lines
            line_col = WHITE if col == PURPLE else INK
            draw.line([(rx0 + 10 * S, ry + 9 * S), (rx1 - 10 * S, ry + 9 * S)], fill=line_col, width=2 * S)

    elif slug == "eightfold-echo":
        # 3x3 logic tiles with emerald center anchor
        cell = 22 * S
        gap = 4 * S
        total = 3 * cell + 2 * gap
        gx0 = ix0 + (iw - total) // 2
        gy0 = iy0 + (ih - total) // 2
        for r in range(3):
            for c in range(3):
                cx0 = gx0 + c * (cell + gap)
                cy0 = gy0 + r * (cell + gap)
                is_center = r == 1 and c == 1
                fill = EMERALD if is_center else (GOLD_SOFT if (r + c) % 2 == 0 else WHITE)
                draw.rounded_rectangle((cx0, cy0, cx0 + cell, cy0 + cell), radius=4 * S, fill=fill, outline=INK, width=2 * S)
                dot_r = 4 * S if is_center else 3 * S
                dot_col = INK if is_center else (PURPLE if (r + c) % 2 == 1 else GOLD)
                mcx, mcy = cx0 + cell // 2, cy0 + cell // 2
                draw.ellipse((mcx - dot_r, mcy - dot_r, mcx + dot_r, mcy + dot_r), fill=dot_col, outline=INK, width=max(1, S))

    elif slug == "6-pics":
        # 3x2 jigsaw reveal tiles
        cw = (iw - 10 * S) // 3
        ch = (ih - 8 * S) // 2
        colors = [GOLD, INK, EMERALD, INK, PURPLE, GOLD]
        f_q = load_font(FONT_SANS_BOLD, 11 * S)
        for idx, col in enumerate(colors):
            r, c = divmod(idx, 3)
            cx0 = ix0 + c * (cw + 5 * S)
            cy0 = iy0 + 2 * S + r * (ch + 6 * S)
            draw.rounded_rectangle((cx0, cy0, cx0 + cw, cy0 + ch), radius=4 * S, fill=col, outline=INK, width=2 * S)
            if col == INK:
                draw_centered_text(draw, (cx0, cy0, cx0 + cw, cy0 + ch), "?", f_q, GOLD)

    elif slug == "connect-5":
        # 5 stacked compound word-chain bars
        cols = [GOLD, EMERALD, WHITE, PURPLE, GOLD]
        for idx, col in enumerate(cols):
            ry = iy0 + idx * 16 * S
            rx0 = ix0 + idx * 7 * S
            rx1 = rx0 + int(iw * 0.66)
            draw.rounded_rectangle((rx0, ry, rx1, ry + 12 * S), radius=3 * S, fill=col, outline=INK, width=int(1.8 * S))

    elif slug == "four-score":
        # Number tiles + operator -> gold 80 target
        f_num = load_font(FONT_SANS_BOLD, 12 * S)
        f_big = load_font(FONT_SERIF_BOLD, 16 * S)
        draw.rounded_rectangle((ix0 + 2 * S, iy0 + 6 * S, ix0 + 36 * S, iy0 + 34 * S), radius=5 * S, fill=WHITE, outline=INK, width=2 * S)
        draw_centered_text(draw, (ix0 + 2 * S, iy0 + 6 * S, ix0 + 36 * S, iy0 + 34 * S), "20", f_num, INK)
        draw.ellipse((ix0 + 41 * S, iy0 + 11 * S, ix0 + 59 * S, iy0 + 29 * S), fill=PURPLE, outline=INK, width=2 * S)
        draw_centered_text(draw, (ix0 + 41 * S, iy0 + 11 * S, ix0 + 59 * S, iy0 + 29 * S), "×", f_num, WHITE)
        draw.rounded_rectangle((ix0 + 64 * S, iy0 + 6 * S, ix0 + 96 * S, iy0 + 34 * S), radius=5 * S, fill=WHITE, outline=INK, width=2 * S)
        draw_centered_text(draw, (ix0 + 64 * S, iy0 + 6 * S, ix0 + 96 * S, iy0 + 34 * S), "4", f_num, INK)
        # Target 80 banner
        draw.rounded_rectangle((ix0 + 10 * S, iy0 + 44 * S, ix1 - 10 * S, iy0 + 76 * S), radius=6 * S, fill=GOLD, outline=INK, width=2 * S)
        draw_centered_text(draw, (ix0 + 10 * S, iy0 + 44 * S, ix1 - 10 * S, iy0 + 76 * S), "= 80", f_big, INK)

    elif slug == "move-2":
        # Floating island tiles + upright 2x1x1 gold cuboid + emerald goal + red obstacle
        tw, th = 22 * S, 18 * S
        gx = ix0 + 6 * S
        gy = iy0 + 38 * S
        tiles = [(0, 0, WHITE), (1, 0, WHITE), (2, 0, RED), (0, 1, WHITE), (1, 1, WHITE), (2, 1, EMERALD), (3, 1, EMERALD)]
        for c, r, col in tiles:
            tx = gx + c * (tw + 2 * S)
            ty = gy + r * (th + 2 * S)
            if tx + tw <= ix1 + 4 * S:
                draw.rounded_rectangle((tx, ty, tx + tw, ty + th), radius=3 * S, fill=col, outline=INK, width=int(1.8 * S))
        # Upright 2x1x1 gold block standing on (0,0)
        bx0 = gx + 2 * S
        by0 = gy - 26 * S
        draw.rounded_rectangle((bx0, by0, bx0 + tw - 2 * S, gy + 12 * S), radius=4 * S, fill=GOLD, outline=INK, width=2 * S)
        draw.line([(bx0 + 2 * S, by0 + 18 * S), (bx0 + tw - 4 * S, by0 + 18 * S)], fill=INK, width=2 * S)

    elif slug == "1-win":
        # Celebratory #1 reflection badge + global community ring
        cx, cy = (ix0 + ix1) // 2, (iy0 + iy1) // 2
        r_outer = 34 * S
        draw.ellipse((cx - r_outer, cy - r_outer, cx + r_outer, cy + r_outer), fill=EMERALD_SOFT, outline=EMERALD, width=2 * S)
        bw, bh = 54 * S, 42 * S
        draw_shadow_card(
            draw,
            (cx - bw // 2, cy - bh // 2, cx + bw // 2, cy + bh // 2),
            radius=8 * S,
            fill=GOLD,
            outline=INK,
            width=2 * S,
            shadow_offset=3 * S,
        )
        f_one = load_font(FONT_SERIF_BOLD, 17 * S)
        draw_centered_text(draw, (cx - bw // 2, cy - bh // 2, cx + bw // 2, cy + bh // 2), "#1", f_one, INK)


# ---------------------------------------------------------------------------
# Root OpenGraph PNG (1200x630) + SVG (1200x630)
# ---------------------------------------------------------------------------
def generate_root_og_png() -> None:
    S = 2
    img, draw = draw_editorial_canvas(S)

    # Top Masthead
    draw_brand_badge(draw, 52 * S, 44 * S, 58 * S, S)

    f_brand = load_font(FONT_SERIF_BOLD, 30 * S)
    f_byline = load_font(FONT_SANS_BOLD, 13 * S)
    f_sub = load_font(FONT_SANS_BOLD, 17 * S)
    f_pill = load_font(FONT_SANS_BOLD, 12 * S)

    draw.text((126 * S, 45 * S), "21 GAMES", font=f_brand, fill=INK)
    w_brand, _ = text_size(draw, "21 GAMES", f_brand)
    draw.text((126 * S + w_brand + 14 * S, 56 * S), "·  BY SOL THEORY", font=f_byline, fill=INK_MUTED)
    draw.text((126 * S, 84 * S), "Smart Games. Daily Rituals.  ·  21 → 1", font=f_sub, fill=INK_BODY)

    # Top-right domain pill
    pill_box = (898 * S, 52 * S, 1148 * S, 94 * S)
    draw_shadow_card(draw, pill_box, radius=21 * S, fill=WHITE, outline=INK, width=int(2.5 * S), shadow_offset=3 * S)
    dot_r = 5 * S
    draw.ellipse((916 * S - dot_r, 73 * S - dot_r, 916 * S + dot_r, 73 * S + dot_r), fill=EMERALD)
    draw.text((930 * S, 65 * S), "9 DAILY GAMES · 21games.ai", font=f_pill, fill=INK)

    # Divider line
    draw.line([(52 * S, 122 * S), (1148 * S, 122 * S)], fill=INK, width=2 * S)

    # 3x3 Showcase Grid
    card_w = 352 * S
    card_h = 138 * S
    gap_x = 20 * S
    gap_y = 15 * S
    start_x = 52 * S
    start_y = 138 * S

    f_num = load_font(FONT_SANS_BOLD, 11 * S)
    f_tag = load_font(FONT_SANS_BOLD, 10 * S)
    f_title = load_font(FONT_SERIF_BOLD, 21 * S)
    f_hook = load_font(FONT_SANS, 12 * S)

    for idx, game in enumerate(GAMES):
        row, col = divmod(idx, 3)
        cx0 = start_x + col * (card_w + gap_x)
        cy0 = start_y + row * (card_h + gap_y)
        cx1 = cx0 + card_w
        cy1 = cy0 + card_h

        draw_shadow_card(
            draw,
            (cx0, cy0, cx1, cy1),
            radius=12 * S,
            fill=WHITE,
            outline=INK,
            width=int(2.5 * S),
            shadow_offset=5 * S,
        )

        # Countdown badge #N
        badge_txt = f"#{game['number']}"
        bw, _ = text_size(draw, badge_txt, f_num)
        b_w = max(36 * S, bw + 14 * S)
        b_box = (cx0 + 16 * S, cy0 + 16 * S, cx0 + 16 * S + b_w, cy0 + 40 * S)
        draw.rounded_rectangle(b_box, radius=6 * S, fill=game["accent"], outline=INK, width=2 * S)
        draw_centered_text(draw, b_box, badge_txt, f_num, game["accent_text"])

        # Micro category label
        draw.text((b_box[2] + 8 * S, cy0 + 22 * S), game["short_tag"], font=f_tag, fill=INK_MUTED)

        # Game Name
        draw.text((cx0 + 16 * S, cy0 + 54 * S), game["name"], font=f_title, fill=INK)

        # Concise tagline
        draw.text((cx0 + 16 * S, cy0 + 92 * S), game["mini_hook"], font=f_hook, fill=INK_BODY)

        # Mini geometric game graphic on right side of card
        mini_box = (cx1 - 126 * S, cy0 + 18 * S, cx1 - 14 * S, cy1 - 18 * S)
        draw_mini_game_graphic(draw, game["slug"], mini_box, S)

    out = img.resize((1200, 630), LANCZOS)
    out.save(PUBLIC_DIR / "og-image.png", format="PNG", optimize=True)


def generate_root_og_svg() -> None:
    cards_svg: list[str] = []
    card_w, card_h = 352, 138
    gap_x, gap_y = 20, 15
    start_x, start_y = 52, 138

    mini_icons_svg = {
        "21-things": """
          <rect x="28" y="10" width="44" height="14" rx="4" fill="#F9D423" stroke="#171717" stroke-width="2"/>
          <rect x="14" y="30" width="32" height="13" rx="3" fill="#2ECC71" stroke="#171717" stroke-width="2"/>
          <rect x="54" y="30" width="32" height="13" rx="3" fill="#2ECC71" stroke="#171717" stroke-width="2"/>
          <rect x="8" y="49" width="24" height="12" rx="3" fill="#9D50BB" stroke="#171717" stroke-width="1.8"/>
          <rect x="38" y="49" width="24" height="12" rx="3" fill="#9D50BB" stroke="#171717" stroke-width="1.8"/>
          <rect x="68" y="49" width="24" height="12" rx="3" fill="#9D50BB" stroke="#171717" stroke-width="1.8"/>
          <circle cx="22" cy="73" r="3" fill="#171717"/><circle cx="36" cy="73" r="3" fill="#171717"/><circle cx="50" cy="73" r="3" fill="#171717"/><circle cx="64" cy="73" r="3" fill="#171717"/><circle cx="78" cy="73" r="3" fill="#171717"/>
        """,
        "17-syllables": """
          <rect x="20" y="14" width="60" height="16" rx="5" fill="#F9D423" stroke="#171717" stroke-width="2"/>
          <rect x="8" y="38" width="84" height="16" rx="5" fill="#2ECC71" stroke="#171717" stroke-width="2"/>
          <rect x="20" y="62" width="60" height="16" rx="5" fill="#9D50BB" stroke="#171717" stroke-width="2"/>
        """,
        "9-rhymes": """
          <rect x="8" y="14" width="64" height="16" rx="8" fill="#F9D423" stroke="#171717" stroke-width="2"/>
          <rect x="18" y="38" width="64" height="16" rx="8" fill="#2ECC71" stroke="#171717" stroke-width="2"/>
          <rect x="28" y="62" width="64" height="16" rx="8" fill="#9D50BB" stroke="#171717" stroke-width="2"/>
        """,
        "eightfold-echo": """
          <rect x="16" y="12" width="20" height="20" rx="4" fill="#FEF7CD" stroke="#171717" stroke-width="1.8"/>
          <rect x="40" y="12" width="20" height="20" rx="4" fill="#FFFFFF" stroke="#171717" stroke-width="1.8"/>
          <rect x="64" y="12" width="20" height="20" rx="4" fill="#FEF7CD" stroke="#171717" stroke-width="1.8"/>
          <rect x="16" y="36" width="20" height="20" rx="4" fill="#FFFFFF" stroke="#171717" stroke-width="1.8"/>
          <rect x="40" y="36" width="20" height="20" rx="4" fill="#2ECC71" stroke="#171717" stroke-width="2.2"/>
          <rect x="64" y="36" width="20" height="20" rx="4" fill="#FFFFFF" stroke="#171717" stroke-width="1.8"/>
          <rect x="16" y="60" width="20" height="20" rx="4" fill="#FEF7CD" stroke="#171717" stroke-width="1.8"/>
          <rect x="40" y="60" width="20" height="20" rx="4" fill="#FFFFFF" stroke="#171717" stroke-width="1.8"/>
          <rect x="64" y="60" width="20" height="20" rx="4" fill="#FEF7CD" stroke="#171717" stroke-width="1.8"/>
        """,
        "6-pics": """
          <rect x="10" y="14" width="24" height="28" rx="4" fill="#F9D423" stroke="#171717" stroke-width="2"/>
          <rect x="38" y="14" width="24" height="28" rx="4" fill="#171717" stroke="#171717" stroke-width="2"/>
          <rect x="66" y="14" width="24" height="28" rx="4" fill="#2ECC71" stroke="#171717" stroke-width="2"/>
          <rect x="10" y="48" width="24" height="28" rx="4" fill="#171717" stroke="#171717" stroke-width="2"/>
          <rect x="38" y="48" width="24" height="28" rx="4" fill="#9D50BB" stroke="#171717" stroke-width="2"/>
          <rect x="66" y="48" width="24" height="28" rx="4" fill="#F9D423" stroke="#171717" stroke-width="2"/>
        """,
        "connect-5": """
          <rect x="8" y="10" width="58" height="11" rx="3" fill="#F9D423" stroke="#171717" stroke-width="1.8"/>
          <rect x="15" y="25" width="58" height="11" rx="3" fill="#2ECC71" stroke="#171717" stroke-width="1.8"/>
          <rect x="22" y="40" width="58" height="11" rx="3" fill="#FFFFFF" stroke="#171717" stroke-width="1.8"/>
          <rect x="29" y="55" width="58" height="11" rx="3" fill="#9D50BB" stroke="#171717" stroke-width="1.8"/>
          <rect x="36" y="70" width="58" height="11" rx="3" fill="#F9D423" stroke="#171717" stroke-width="1.8"/>
        """,
        "four-score": """
          <rect x="10" y="14" width="28" height="24" rx="4" fill="#FFFFFF" stroke="#171717" stroke-width="2"/>
          <circle cx="50" cy="26" r="8" fill="#9D50BB" stroke="#171717" stroke-width="2"/>
          <rect x="62" y="14" width="28" height="24" rx="4" fill="#FFFFFF" stroke="#171717" stroke-width="2"/>
          <rect x="16" y="46" width="68" height="28" rx="6" fill="#F9D423" stroke="#171717" stroke-width="2"/>
          <text x="50" y="65" font-family="Georgia, serif" font-size="14" font-weight="900" fill="#171717" text-anchor="middle">= 80</text>
        """,
        "move-2": """
          <rect x="12" y="42" width="20" height="16" rx="3" fill="#FFFFFF" stroke="#171717" stroke-width="1.8"/>
          <rect x="34" y="42" width="20" height="16" rx="3" fill="#FFFFFF" stroke="#171717" stroke-width="1.8"/>
          <rect x="56" y="42" width="20" height="16" rx="3" fill="#EF4444" stroke="#171717" stroke-width="1.8"/>
          <rect x="34" y="60" width="20" height="16" rx="3" fill="#FFFFFF" stroke="#171717" stroke-width="1.8"/>
          <rect x="56" y="60" width="20" height="16" rx="3" fill="#2ECC71" stroke="#171717" stroke-width="2"/>
          <rect x="78" y="60" width="16" height="16" rx="3" fill="#2ECC71" stroke="#171717" stroke-width="2"/>
          <rect x="13" y="16" width="18" height="36" rx="4" fill="#F9D423" stroke="#171717" stroke-width="2"/>
        """,
        "1-win": """
          <circle cx="50" cy="46" r="30" fill="#DCFCE7" stroke="#2ECC71" stroke-width="2"/>
          <rect x="26" y="29" width="51" height="37" rx="7" fill="#171717"/>
          <rect x="23" y="26" width="51" height="37" rx="7" fill="#F9D423" stroke="#171717" stroke-width="2"/>
          <text x="48.5" y="50" font-family="Georgia, serif" font-size="16" font-weight="900" fill="#171717" text-anchor="middle">#1</text>
        """,
    }

    for idx, game in enumerate(GAMES):
        row, col = divmod(idx, 3)
        cx = start_x + col * (card_w + gap_x)
        cy = start_y + row * (card_h + gap_y)
        mini = mini_icons_svg[game["slug"]]
        cards_svg.append(
            f"""  <g transform="translate({cx}, {cy})">
    <rect x="5" y="5" width="{card_w}" height="{card_h}" rx="12" fill="#171717" />
    <rect x="0" y="0" width="{card_w}" height="{card_h}" rx="12" fill="#FFFFFF" stroke="#171717" stroke-width="2.5" />
    <rect x="16" y="16" width="42" height="24" rx="6" fill="{game['accent']}" stroke="#171717" stroke-width="2" />
    <text x="37" y="32" font-family="Inter, DejaVu Sans, sans-serif" font-size="11" font-weight="800" fill="{game['accent_text']}" text-anchor="middle">#{game['number']}</text>
    <text x="66" y="32" font-family="Inter, DejaVu Sans, sans-serif" font-size="10" font-weight="800" fill="#6B6B76" letter-spacing="0.6">{game['short_tag']}</text>
    <text x="16" y="74" font-family="Roboto Slab, DejaVu Serif, Georgia, serif" font-size="21" font-weight="900" fill="#171717">{game['name']}</text>
    <text x="16" y="106" font-family="Inter, DejaVu Sans, sans-serif" font-size="12" font-weight="500" fill="#3F3F46">{game['mini_hook']}</text>
    <g transform="translate(232, 22)">
      <rect x="0" y="0" width="104" height="94" rx="8" fill="#F5F5F8" stroke="#DEDEE6" stroke-width="1.5" />
      {mini}
    </g>
  </g>"""
        )

    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630" fill="none">
  <rect width="1200" height="630" fill="#FCFCFD" />
  <defs>
    <pattern id="grid" width="36" height="36" patternUnits="userSpaceOnUse">
      <path d="M 36 0 L 0 0 0 36" fill="none" stroke="#EFEFF3" stroke-width="1" />
    </pattern>
  </defs>
  <rect width="1200" height="630" fill="url(#grid)" />
  <rect x="22" y="22" width="1156" height="586" rx="18" fill="none" stroke="#171717" stroke-width="3" />

  <!-- Masthead -->
  <g transform="translate(52, 44)">
    <rect x="4" y="4" width="58" height="58" rx="12" fill="#171717" />
    <rect x="0" y="0" width="58" height="58" rx="12" fill="#F9D423" stroke="#171717" stroke-width="3" />
    <text x="29" y="38" font-family="Roboto Slab, DejaVu Serif, Georgia, serif" font-size="27" font-weight="900" fill="#171717" text-anchor="middle">21</text>
    <rect x="16" y="46" width="26" height="4" rx="2" fill="#171717" />

    <text x="74" y="30" font-family="Roboto Slab, DejaVu Serif, Georgia, serif" font-size="30" font-weight="900" fill="#171717">21 GAMES</text>
    <text x="246" y="28" font-family="Inter, DejaVu Sans, sans-serif" font-size="13" font-weight="800" fill="#6B6B76" letter-spacing="1.2">· BY SOL THEORY</text>
    <text x="74" y="56" font-family="Inter, DejaVu Sans, sans-serif" font-size="17" font-weight="700" fill="#3F3F46">Smart Games. Daily Rituals. · 21 → 1</text>

    <rect x="849" y="11" width="248" height="42" rx="21" fill="#171717" />
    <rect x="846" y="8" width="248" height="42" rx="21" fill="#FFFFFF" stroke="#171717" stroke-width="2.5" />
    <circle cx="866" cy="29" r="5" fill="#2ECC71" />
    <text x="880" y="34" font-family="Inter, DejaVu Sans, sans-serif" font-size="12" font-weight="800" fill="#171717">9 DAILY GAMES · 21games.ai</text>
  </g>

  <line x1="52" y1="122" x2="1148" y2="122" stroke="#171717" stroke-width="2" />

{chr(10).join(cards_svg)}
</svg>
"""
    (PUBLIC_DIR / "og-image.svg").write_text(svg, encoding="utf-8")


# ---------------------------------------------------------------------------
# Bespoke right-hand board illustrations for the 9 per-game OG cards
# ---------------------------------------------------------------------------
def draw_bespoke_board(
    draw: ImageDraw.ImageDraw,
    slug: str,
    box: Tuple[int, int, int, int],
    S: int,
) -> None:
    x0, y0, x1, y1 = box
    w = x1 - x0
    h = y1 - y0
    pad = 28 * S
    ix0, iy0, ix1, iy1 = x0 + pad, y0 + pad, x1 - pad, y1 - pad
    iw, ih = ix1 - ix0, iy1 - iy0

    f_hdr = load_font(FONT_SANS_BOLD, 12 * S)
    f_lbl = load_font(FONT_SANS_BOLD, 14 * S)
    f_lbl_sm = load_font(FONT_SANS_BOLD, 11 * S)
    f_serif_lg = load_font(FONT_SERIF_BOLD, 28 * S)
    f_serif_md = load_font(FONT_SERIF_BOLD, 20 * S)
    f_serif_xl = load_font(FONT_SERIF_BOLD, 42 * S)

    if slug == "21-things":
        # Crown #1 pick card -> 3 finalists -> 6 semi-finalists -> 21 curated grid
        draw.text((ix0, iy0), "CURATION FUNNEL  ·  21 → 6 → 3 → 1", font=f_hdr, fill=INK_MUTED)

        # #1 Top Pick
        top_box = (ix0 + 86 * S, iy0 + 34 * S, ix1 - 86 * S, iy0 + 106 * S)
        draw_shadow_card(draw, top_box, radius=12 * S, fill=GOLD, outline=INK, width=3 * S, shadow_offset=5 * S)
        draw_centered_text(draw, (top_box[0], top_box[1], top_box[2], top_box[1] + 34 * S), "★ #1 RESONANCE", f_lbl_sm, INK)
        draw_centered_text(draw, (top_box[0], top_box[1] + 28 * S, top_box[2], top_box[3]), "MORNING SUNLIGHT", f_lbl, INK)

        # Tier of 3 finalists
        t3_y0, t3_y1 = iy0 + 132 * S, iy0 + 190 * S
        gap = 12 * S
        cw = (iw - 2 * gap) // 3
        labels_3 = ["COFFEE", "FRIENDS", "OCEAN"]
        for i, lbl in enumerate(labels_3):
            bx0 = ix0 + i * (cw + gap)
            draw_shadow_card(draw, (bx0, t3_y0, bx0 + cw, t3_y1), radius=9 * S, fill=EMERALD, outline=INK, width=int(2.5 * S), shadow_offset=3 * S)
            draw_centered_text(draw, (bx0, t3_y0, bx0 + cw, t3_y1), lbl, f_lbl_sm, INK)

        # Tier of 6 semi-finalists (2 rows x 3 or 1 row x 6)
        t6_y0, t6_y1 = iy0 + 214 * S, iy0 + 258 * S
        gap6 = 8 * S
        cw6 = (iw - 5 * gap6) // 6
        for i in range(6):
            bx0 = ix0 + i * (cw6 + gap6)
            draw.rounded_rectangle((bx0, t6_y0, bx0 + cw6, t6_y1), radius=7 * S, fill=PURPLE, outline=INK, width=2 * S)
            draw_centered_text(draw, (bx0, t6_y0, bx0 + cw6, t6_y1), f"#{i+1}", f_lbl_sm, WHITE)

        # 21 Curated Grid (3 rows x 7 pills)
        g_y0 = iy0 + 284 * S
        gap21_x = 8 * S
        gap21_y = 10 * S
        cw21 = (iw - 6 * gap21_x) // 7
        ch21 = 36 * S
        highlighted = {0, 3, 5, 8, 11, 14, 18}
        for idx in range(21):
            r, c = divmod(idx, 7)
            px0 = ix0 + c * (cw21 + gap21_x)
            py0 = g_y0 + r * (ch21 + gap21_y)
            fill = GOLD_SOFT if idx in highlighted else SURFACE_SOFT
            draw.rounded_rectangle((px0, py0, px0 + cw21, py0 + ch21), radius=6 * S, fill=fill, outline=INK, width=2 * S)
            draw_centered_text(draw, (px0, py0, px0 + cw21, py0 + ch21), str(idx + 1), f_lbl_sm, INK)

    elif slug == "17-syllables":
        draw.text((ix0, iy0), "DAILY HAIKU BOARD  ·  5 · 7 · 5", font=f_hdr, fill=INK_MUTED)
        lines_spec = [
            ("5", GOLD, INK, [("CRISP", 92), ("AUTUMN", 132), ("MORNING", 148)]),
            ("7", EMERALD, INK, [("GOLDEN MAPLE", 146), ("LEAVES DRIFT", 128), ("DOWN", 94)]),
            ("5", PURPLE, WHITE, [("STILL", 94), ("WATER", 124), ("SHIMMERS", 150)]),
        ]
        for idx, (meter, badge_col, badge_txt, words) in enumerate(lines_spec):
            ry = iy0 + 42 * S + idx * 96 * S
            # Slot container
            draw.rounded_rectangle((ix0, ry, ix1, ry + 74 * S), radius=12 * S, fill=SURFACE_SOFT, outline=INK, width=2 * S)
            # Syllable count badge
            b_box = (ix0 + 12 * S, ry + 14 * S, ix0 + 54 * S, ry + 60 * S)
            draw.rounded_rectangle(b_box, radius=8 * S, fill=badge_col, outline=INK, width=2 * S)
            draw_centered_text(draw, b_box, meter, f_serif_md, badge_txt)

            wx = ix0 + 68 * S
            for word, ww in words:
                actual_w = min(ww * S, ix1 - wx - 12 * S)
                if actual_w < 50 * S:
                    break
                w_box = (wx, ry + 14 * S, wx + actual_w, ry + 60 * S)
                draw_shadow_card(draw, w_box, radius=8 * S, fill=WHITE, outline=INK, width=2 * S, shadow_offset=3 * S)
                draw_centered_text(draw, w_box, word, f_lbl_sm, INK)
                wx += actual_w + 8 * S

        # Word tray footer
        tray_y = iy0 + 344 * S
        draw.rounded_rectangle((ix0, tray_y, ix1, iy1), radius=12 * S, fill=GOLD_SOFT, outline=INK, width=2 * S)
        draw_centered_text(draw, (ix0, tray_y, ix1, iy1), "17 SYLLABLES  ·  POETIC FRAGMENTS LOCKED", f_lbl_sm, INK)

    elif slug == "9-rhymes":
        # iMessage-style chat + stepped linear 1..9 rhyme progress bars (NO 3x3 tic-tac-toe!)
        draw.text((ix0, iy0), "CHAT WITH NINE  ·  9 PERFECT RHYMES", font=f_hdr, fill=INK_MUTED)

        # Top 9-segment linear progress bar
        seg_gap = 6 * S
        seg_w = (iw - 8 * seg_gap) // 9
        for i in range(9):
            sx0 = ix0 + i * (seg_w + seg_gap)
            sy0 = iy0 + 28 * S
            col = GOLD if i < 3 else (EMERALD if i < 6 else PURPLE)
            draw.rounded_rectangle((sx0, sy0, sx0 + seg_w, sy0 + 14 * S), radius=7 * S, fill=col, outline=INK, width=int(1.8 * S))

        # Chat bubbles + stepped linear rhyme bars
        exchanges = [
            ("Clue #1 · Bright beam in the night", "LIGHT", GOLD, INK),
            ("Clue #5 · Gentle ocean motion", "WAVE", EMERALD, INK),
            ("Clue #9 · Royal golden headpiece", "CROWN", PURPLE, WHITE),
        ]
        cy = iy0 + 62 * S
        for clue, ans, col, txt_col in exchanges:
            # Incoming clue bubble (left)
            b_in = (ix0, cy, ix0 + int(iw * 0.76), cy + 44 * S)
            draw.rounded_rectangle(b_in, radius=14 * S, fill=SURFACE_SOFT, outline=INK, width=2 * S)
            draw.text((b_in[0] + 16 * S, b_in[1] + 13 * S), clue, font=f_lbl_sm, fill=INK)
            cy += 52 * S

            # Outgoing rhyme reply bubble (stepped right)
            b_out = (ix1 - int(iw * 0.44), cy, ix1, cy + 44 * S)
            draw_shadow_card(draw, b_out, radius=14 * S, fill=col, outline=INK, width=2 * S, shadow_offset=3 * S)
            draw_centered_text(draw, b_out, f"✓  {ans}", f_lbl, txt_col)
            cy += 58 * S

    elif slug == "eightfold-echo":
        draw.text((ix0, iy0), "EMERALD ANCHOR  ·  SINGLE-ATTRIBUTE ECHO", font=f_hdr, fill=INK_MUTED)
        grid_size = min(iw, ih - 36 * S)
        gap = 12 * S
        cell = (grid_size - 2 * gap) // 3
        gx0 = ix0 + (iw - (3 * cell + 2 * gap)) // 2
        gy0 = iy0 + 34 * S

        shapes = [
            ("circle", PURPLE, 1),
            ("circle", GOLD, 1),
            ("square", GOLD, 1),
            ("circle", PURPLE, 2),
            ("circle", GOLD, 2),  # Center Emerald Anchor!
            ("square", GOLD, 2),
            ("triangle", PURPLE, 2),
            ("circle", GOLD, 3),
            ("square", GOLD, 3),
        ]

        for idx, (shape, col, count) in enumerate(shapes):
            r, c = divmod(idx, 3)
            cx0 = gx0 + c * (cell + gap)
            cy0 = gy0 + r * (cell + gap)
            is_center = idx == 4
            tile_bg = EMERALD if is_center else WHITE
            draw_shadow_card(
                draw,
                (cx0, cy0, cx0 + cell, cy0 + cell),
                radius=12 * S,
                fill=tile_bg,
                outline=INK,
                width=int(2.5 * S),
                shadow_offset=4 * S if is_center else 2 * S,
            )
            # Draw geometric shapes inside tile
            sr = 13 * S
            cy_mid = cy0 + cell // 2
            offsets = [0] if count == 1 else ([-18 * S, 18 * S] if count == 2 else [-26 * S, 0, 26 * S])
            for dx in offsets:
                cx_mid = cx0 + cell // 2 + dx
                if shape == "circle":
                    draw.ellipse((cx_mid - sr, cy_mid - sr, cx_mid + sr, cy_mid + sr), fill=col, outline=INK, width=2 * S)
                elif shape == "square":
                    draw.rounded_rectangle((cx_mid - sr, cy_mid - sr, cx_mid + sr, cy_mid + sr), radius=3 * S, fill=col, outline=INK, width=2 * S)
                else:
                    pts = [(cx_mid, cy_mid - sr), (cx_mid - sr, cy_mid + sr), (cx_mid + sr, cy_mid + sr)]
                    draw.polygon(pts, fill=col, outline=INK)
                    draw.line(pts + [pts[0]], fill=INK, width=2 * S)

    elif slug == "6-pics":
        # Upfront theme header + 3x2 jigsaw-covered image frames + 36 PTS score pill
        theme_box = (ix0, iy0, ix1, iy0 + 52 * S)
        draw_shadow_card(draw, theme_box, radius=10 * S, fill=GOLD, outline=INK, width=int(2.5 * S), shadow_offset=4 * S)
        draw_centered_text(draw, theme_box, "TODAY'S THEME:  GOLDEN HOUR  ·  36 PTS MAX", f_lbl, INK)

        gy0 = iy0 + 72 * S
        gap_x, gap_y = 14 * S, 14 * S
        cw = (iw - 2 * gap_x) // 3
        ch = (ih - 72 * S - gap_y) // 2

        cards_6 = [
            ("SUNSET", "6 PTS", GOLD_SOFT, 1),
            ("LANTERN", "5 PTS", EMERALD_SOFT, 2),
            ("?", "PEEL TILE", INK, 6),
            ("AMBER", "6 PTS", PURPLE_SOFT, 1),
            ("?", "PEEL TILE", INK, 5),
            ("HONEY", "6 PTS", GOLD_SOFT, 0),
        ]
        for idx, (word, pts, bg, covered_cnt) in enumerate(cards_6):
            r, c = divmod(idx, 3)
            cx0 = ix0 + c * (cw + gap_x)
            cy0 = gy0 + r * (ch + gap_y)
            draw_shadow_card(draw, (cx0, cy0, cx0 + cw, cy0 + ch), radius=10 * S, fill=bg, outline=INK, width=2 * S, shadow_offset=3 * S)

            if bg == INK:
                # Jigsaw 2x3 grid overlay on unguessed cards
                pw = (cw - 18 * S) // 3
                ph = (ch - 48 * S) // 2
                for pr in range(2):
                    for pc in range(3):
                        px0 = cx0 + 6 * S + pc * (pw + 3 * S)
                        py0 = cy0 + 8 * S + pr * (ph + 3 * S)
                        p_fill = "#2A2A32" if (pr * 3 + pc) < covered_cnt else GOLD
                        draw.rounded_rectangle((px0, py0, px0 + pw, py0 + ph), radius=4 * S, fill=p_fill, outline="#52525B", width=S)
                draw_centered_text(draw, (cx0, cy0 + ch - 34 * S, cx0 + cw, cy0 + ch - 6 * S), pts, f_lbl_sm, GOLD)
            else:
                # Solved image frame with geometric sun/emblem + word + score pill
                mcx, mcy = cx0 + cw // 2, cy0 + ch // 2 - 14 * S
                draw.ellipse((mcx - 22 * S, mcy - 22 * S, mcx + 22 * S, mcy + 22 * S), fill=GOLD if idx % 2 == 0 else EMERALD, outline=INK, width=2 * S)
                draw_centered_text(draw, (cx0, cy0 + ch - 54 * S, cx0 + cw, cy0 + ch - 28 * S), word, f_lbl, INK)
                draw_centered_text(draw, (cx0, cy0 + ch - 28 * S, cx0 + cw, cy0 + ch - 6 * S), f"★ {pts}", f_lbl_sm, INK_MUTED)

    elif slug == "connect-5":
        draw.text((ix0, iy0), "5-ROW COMPOUND WORD CHAIN", font=f_hdr, fill=INK_MUTED)
        words = [
            ("SUN", GOLD, INK, True),
            ("FLOWER", EMERALD, INK, True),
            ("POT", EMERALD, INK, True),
            ("LUCK", GOLD_SOFT, INK, True),
            ("C _ _ _ _", WHITE, INK, False),
        ]
        row_h = 62 * S
        gap_y = 16 * S
        ry0 = iy0 + 36 * S
        for idx, (word, col, txt_col, solved) in enumerate(words):
            y = ry0 + idx * (row_h + gap_y)
            indent = idx * 18 * S
            bx0 = ix0 + indent
            bx1 = ix1 - (4 - idx) * 18 * S
            draw_shadow_card(draw, (bx0, y, bx1, y + row_h), radius=10 * S, fill=col, outline=INK, width=int(2.5 * S), shadow_offset=4 * S)
            draw_centered_text(draw, (bx0 + 44 * S, y, bx1 - 16 * S, y + row_h), word, f_serif_md, txt_col)
            # Row number pill
            n_box = (bx0 + 12 * S, y + 14 * S, bx0 + 44 * S, y + row_h - 14 * S)
            draw.rounded_rectangle(n_box, radius=6 * S, fill=INK if solved else SURFACE_MUTED, outline=INK, width=2 * S)
            draw_centered_text(draw, n_box, str(idx + 1), f_lbl_sm, WHITE if solved else INK)
            # Chain link connector to next row
            if idx < 4:
                lx = (bx0 + bx1) // 2
                draw.line([(lx, y + row_h), (lx, y + row_h + gap_y)], fill=INK, width=4 * S)

    elif slug == "four-score":
        # Scoreboard Target 80 + 4 Number Tiles + Operator Badges
        target_box = (ix0, iy0, ix1, iy0 + 112 * S)
        draw_shadow_card(draw, target_box, radius=14 * S, fill=GOLD, outline=INK, width=3 * S, shadow_offset=5 * S)
        draw_centered_text(draw, (ix0, iy0 + 10 * S, ix1, iy0 + 38 * S), "EXACT DAILY TARGET", f_hdr, INK)
        draw_centered_text(draw, (ix0, iy0 + 34 * S, ix1, iy0 + 104 * S), "80", f_serif_xl, INK)

        # 4 Number Tiles
        ty0 = iy0 + 142 * S
        th = 104 * S
        gap = 14 * S
        tw = (iw - 3 * gap) // 4
        nums = [("12", WHITE), ("7", GOLD_SOFT), ("8", WHITE), ("4", EMERALD_SOFT)]
        for i, (n, col) in enumerate(nums):
            tx0 = ix0 + i * (tw + gap)
            draw_shadow_card(draw, (tx0, ty0, tx0 + tw, ty0 + th), radius=12 * S, fill=col, outline=INK, width=int(2.5 * S), shadow_offset=4 * S)
            draw_centered_text(draw, (tx0, ty0, tx0 + tw, ty0 + th), n, f_serif_lg, INK)

        # Operator badges row
        oy0 = iy0 + 276 * S
        ops = [("×", EMERALD, INK), ("−", GOLD, INK), ("+", PURPLE, WHITE)]
        op_w = 64 * S
        op_gap = 20 * S
        op_start = ix0 + (iw - (3 * op_w + 2 * op_gap)) // 2
        for i, (sym, col, tcol) in enumerate(ops):
            ox0 = op_start + i * (op_w + op_gap)
            draw_shadow_card(draw, (ox0, oy0, ox0 + op_w, oy0 + 56 * S), radius=12 * S, fill=col, outline=INK, width=2 * S, shadow_offset=3 * S)
            draw_centered_text(draw, (ox0, oy0, ox0 + op_w, oy0 + 56 * S), sym, f_serif_md, tcol)

        # Solution equation bar
        eq_box = (ix0, iy0 + 360 * S, ix1, iy1)
        draw.rounded_rectangle(eq_box, radius=12 * S, fill=EMERALD_SOFT, outline=INK, width=2 * S)
        draw_centered_text(draw, eq_box, "( 12 × 7 ) − 8 + 4  =  80 ✓", f_lbl, INK)

    elif slug == "move-2":
        draw.text((ix0, iy0), "3D FLOATING ISLANDS  ·  STAND IN EMERALD GOAL", font=f_hdr, fill=INK_MUTED)

        # Isometric floating island board!
        cx_origin = (ix0 + ix1) // 2 + 10 * S
        cy_origin = iy0 + 130 * S
        tw_half = 38 * S
        th_half = 20 * S
        depth = 12 * S

        def iso(col_i: float, row_i: float, z: float = 0.0) -> Tuple[float, float]:
            px = cx_origin + (col_i - row_i) * tw_half
            py = cy_origin + (col_i + row_i) * th_half - z
            return px, py

        # Board layout (6x5 floating island with bridge, switch, red obstacle, and emerald goal hole)
        island = {
            (0, 0): "normal", (1, 0): "normal", (2, 0): "switch",
            (0, 1): "normal", (1, 1): "normal", (2, 1): "bridge", (3, 1): "bridge", (4, 1): "normal",
            (1, 2): "obstacle", (4, 2): "normal", (5, 2): "normal",
            (3, 3): "normal", (4, 3): "goal", (5, 3): "normal",
            (4, 4): "normal",
        }

        for r in range(6):
            for c in range(6):
                if (c, r) not in island:
                    continue
                kind = island[(c, r)]
                p_top = [iso(c, r), iso(c + 1, r), iso(c + 1, r + 1), iso(c, r + 1)]
                p_left = [p_top[3], p_top[2], (p_top[2][0], p_top[2][1] + depth), (p_top[3][0], p_top[3][1] + depth)]
                p_right = [p_top[2], p_top[1], (p_top[1][0], p_top[1][1] + depth), (p_top[2][0], p_top[2][1] + depth)]

                draw.polygon(p_left, fill="#B4B4BE", outline=INK)
                draw.polygon(p_right, fill="#8E8E9A", outline=INK)

                top_fill = {
                    "normal": "#F4F4F6",
                    "switch": AMBER,
                    "bridge": PURPLE_SOFT,
                    "obstacle": RED,
                    "goal": EMERALD,
                }[kind]
                draw.polygon(p_top, fill=top_fill, outline=INK)
                draw.line(p_top + [p_top[0]], fill=INK, width=2 * S)

                if kind == "goal":
                    # Inner dark emerald goal hole
                    g_in = [
                        iso(c + 0.22, r + 0.22),
                        iso(c + 0.78, r + 0.22),
                        iso(c + 0.78, r + 0.78),
                        iso(c + 0.22, r + 0.78),
                    ]
                    draw.polygon(g_in, fill=INK, outline=EMERALD)

        # Upright 2x1x1 gold cuboid standing on tile (1, 1)
        bc, br = 1.08, 1.08
        bs = 0.84
        bh = 76 * S
        base = [iso(bc, br), iso(bc + bs, br), iso(bc + bs, br + bs), iso(bc, br + bs)]
        top = [iso(bc, br, bh), iso(bc + bs, br, bh), iso(bc + bs, br + bs, bh), iso(bc, br + bs, bh)]
        mid = [iso(bc, br, bh / 2), iso(bc + bs, br, bh / 2), iso(bc + bs, br + bs, bh / 2), iso(bc, br + bs, bh / 2)]

        # Left & right visible vertical faces of the 2x1x1 block
        draw.polygon([top[3], top[2], base[2], base[3]], fill="#EAB308", outline=INK)
        draw.polygon([top[2], top[1], base[1], base[2]], fill="#CA8A04", outline=INK)
        draw.polygon(top, fill=GOLD, outline=INK)
        for poly in ([top[3], top[2], base[2], base[3]], [top[2], top[1], base[1], base[2]], top):
            draw.line(poly + [poly[0]], fill=INK, width=int(2.2 * S))
        # Mid-height seam showing 2x1x1 two-cube structure
        draw.line([mid[3], mid[2], mid[1]], fill=INK, width=2 * S)

        # Legend pills at bottom
        leg_box = (ix0, iy1 - 46 * S, ix1, iy1)
        draw.rounded_rectangle(leg_box, radius=10 * S, fill=SURFACE_SOFT, outline=INK, width=2 * S)
        draw_centered_text(draw, leg_box, "GOLD 2×1×1 BLOCK  ·  DODGE RED  ·  DROP IN EMERALD", f_lbl_sm, INK)

    elif slug == "1-win":
        draw.text((ix0, iy0), "DAILY GRATITUDE PULSE  ·  1–4 WORDS", font=f_hdr, fill=INK_MUTED)

        # Today's 1 Win submission card
        win_box = (ix0, iy0 + 40 * S, ix1, iy0 + 188 * S)
        draw_shadow_card(draw, win_box, radius=16 * S, fill=GOLD, outline=INK, width=3 * S, shadow_offset=6 * S)
        draw_centered_text(draw, (ix0, iy0 + 54 * S, ix1, iy0 + 88 * S), "TODAY'S #1 WIN  ·  2 / 4 WORDS", f_lbl_sm, INK)
        draw_centered_text(draw, (ix0, iy0 + 88 * S, ix1, iy0 + 168 * S), "“MORNING WALK”", f_serif_lg, INK)

        # Worldwide match reveal card
        match_box = (ix0, iy0 + 216 * S, ix1, iy1)
        draw_shadow_card(draw, match_box, radius=16 * S, fill=EMERALD_SOFT, outline=INK, width=int(2.5 * S), shadow_offset=4 * S)
        draw_centered_text(draw, (ix0, iy0 + 234 * S, ix1, iy0 + 272 * S), "WORLDWIDE RESONANCE", f_hdr, INK)
        draw_centered_text(draw, (ix0, iy0 + 272 * S, ix1, iy0 + 344 * S), "142 PLAYERS", f_serif_lg, INK)
        draw_centered_text(draw, (ix0, iy0 + 348 * S, ix1, iy1 - 18 * S), "shared this exact daily win around the world today", f_lbl_sm, INK_BODY)


def generate_per_game_og_cards() -> None:
    OG_DIR.mkdir(parents=True, exist_ok=True)
    S = 2

    f_brand = load_font(FONT_SERIF_BOLD, 24 * S)
    f_byline = load_font(FONT_SANS_BOLD, 11 * S)
    f_cat = load_font(FONT_SANS_BOLD, 12 * S)
    f_hook = load_font(FONT_SANS, 20 * S)
    f_chip = load_font(FONT_SANS_BOLD, 11 * S)
    f_cta = load_font(FONT_SANS_BOLD, 14 * S)

    for game in GAMES:
        img, draw = draw_editorial_canvas(S)

        # Left column masthead
        draw_brand_badge(draw, 62 * S, 60 * S, 50 * S, S)
        draw.text((126 * S, 62 * S), "21 GAMES", font=f_brand, fill=INK)
        draw.text((126 * S, 94 * S), "BY SOL THEORY  ·  21 → 1 COUNTDOWN", font=f_byline, fill=INK_MUTED)

        # Countdown + Category pill
        cat_txt = f"GAME #{game['number']}  ·  {game['category']}"
        cw, _ = text_size(draw, cat_txt, f_cat)
        cat_box = (62 * S, 154 * S, 62 * S + cw + 28 * S, 190 * S)
        draw_shadow_card(
            draw,
            cat_box,
            radius=8 * S,
            fill=game["accent"],
            outline=INK,
            width=2 * S,
            shadow_offset=3 * S,
        )
        draw_centered_text(draw, cat_box, cat_txt, f_cat, game["accent_text"])

        # Hero Game Title (auto-fit size so long names like Eightfold Echo stay crisp in left column)
        title_size = 50 if len(game["name"]) >= 12 else 56
        f_title = load_font(FONT_SERIF_BOLD, title_size * S)
        draw.text((62 * S, 214 * S), game["name"], font=f_title, fill=INK)

        # Wrapped Editorial Hook
        lines = wrap_lines(draw, game["hook"], f_hook, max_width=500 * S)
        hy = 300 * S
        for line in lines[:4]:
            draw.text((62 * S, hy), line, font=f_hook, fill=INK_BODY)
            hy += 30 * S

        # Spec Chips
        chip_y = 434 * S
        cx = 62 * S
        for chip in (game["chip_a"], game["chip_b"]):
            tw, _ = text_size(draw, chip, f_chip)
            c_box = (cx, chip_y, cx + tw + 24 * S, chip_y + 32 * S)
            draw.rounded_rectangle(c_box, radius=8 * S, fill=SURFACE_SOFT, outline=INK, width=2 * S)
            draw_centered_text(draw, c_box, chip, f_chip, INK)
            cx = c_box[2] + 10 * S

        # Bottom CTA pill
        cta_txt = f"PLAY {game['name'].upper()}  ·  21games.ai →"
        ctw, _ = text_size(draw, cta_txt, f_cta)
        cta_box = (62 * S, 496 * S, 62 * S + max(300 * S, ctw + 36 * S), 548 * S)
        draw_shadow_card(draw, cta_box, radius=12 * S, fill=GOLD, outline=INK, width=int(2.5 * S), shadow_offset=4 * S)
        draw_centered_text(draw, cta_box, cta_txt, f_cta, INK)

        # Right column bespoke board showcase card
        right_box = (606 * S, 60 * S, 1140 * S, 566 * S)
        draw_shadow_card(
            draw,
            right_box,
            radius=18 * S,
            fill=WHITE,
            outline=INK,
            width=3 * S,
            shadow_offset=7 * S,
        )
        draw_bespoke_board(draw, game["slug"], right_box, S)

        out = img.resize((1200, 630), LANCZOS)
        out.save(OG_DIR / f"{game['slug']}.png", format="PNG", optimize=True)


# ---------------------------------------------------------------------------
# Full-bleed #F9D423 PWA & Apple Touch Icons + Multi-size favicon.ico
# ---------------------------------------------------------------------------
def generate_pwa_and_touch_icons() -> None:
    # Master 2048x2048 full-bleed #F9D423 canvas (NO inner rounded-rect border!)
    M = 2048
    master = Image.new("RGB", (M, M), GOLD)
    draw = ImageDraw.Draw(master)

    # Crisp centered "21" editorial slab-serif typography
    f_num = load_font(FONT_SERIF_BOLD, int(M * 0.54))
    draw_centered_text(draw, (0, 0, M, int(M * 0.88)), "21", f_num, INK)

    # Subtle bottom #171717 accent bar well inside iOS squircle & maskable safe zone
    bar_w = int(M * 0.42)
    bar_h = int(M * 0.055)
    bx0 = (M - bar_w) // 2
    by0 = int(M * 0.775)
    draw.rounded_rectangle((bx0, by0, bx0 + bar_w, by0 + bar_h), radius=bar_h // 2, fill=INK)

    for filename, dim in [
        ("apple-touch-icon.png", 180),
        ("icon-192.png", 192),
        ("icon-512.png", 512),
    ]:
        resized = master.resize((dim, dim), LANCZOS)
        resized.save(PUBLIC_DIR / filename, format="PNG", optimize=True)

    # Multi-size favicon.ico (32x32 + 16x16) with transparent rounded corners & crisp #171717 border
    F = 256
    fav = Image.new("RGBA", (F, F), (0, 0, 0, 0))
    fdraw = ImageDraw.Draw(fav)
    fdraw.rounded_rectangle(
        (8, 8, F - 8, F - 8),
        radius=48,
        fill=GOLD,
        outline=INK,
        width=16,
    )
    f_fav = load_font(FONT_SERIF_BOLD, 138)
    draw_centered_text(fdraw, (0, 0, F, int(F * 0.94)), "21", f_fav, INK)
    fav.save(PUBLIC_DIR / "favicon.ico", format="ICO", sizes=[(16, 16), (32, 32)])


def main() -> None:
    # Ensure orphaned public/logo.png stays removed
    orphan_logo = PUBLIC_DIR / "logo.png"
    if orphan_logo.exists():
        orphan_logo.unlink()

    generate_root_og_svg()
    generate_root_og_png()
    generate_per_game_og_cards()
    generate_pwa_and_touch_icons()
    print("Generated all 21 Games brand, PWA, and OpenGraph assets.")


if __name__ == "__main__":
    main()
