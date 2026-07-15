from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
ICONS = ROOT / "src" / "icons"
ASSETS = ROOT / "assets"
ICONS.mkdir(parents=True, exist_ok=True)
ASSETS.mkdir(parents=True, exist_ok=True)

DARK = (13, 17, 23, 255)
DARK_2 = (22, 27, 34, 255)
PURPLE = (130, 80, 223, 255)
PURPLE_BRIGHT = (163, 113, 247, 255)
GREEN = (31, 136, 61, 255)
GREEN_BRIGHT = (46, 160, 67, 255)
WHITE = (255, 255, 255, 255)
MUTED = (139, 148, 158, 255)
BORDER = (48, 54, 61, 255)

FONT_REGULAR = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"


def rounded_rect(draw, box, radius, fill, outline=None, width=1):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def draw_brand_mark(image, box, background=True, compact=False):
    draw = ImageDraw.Draw(image)
    x0, y0, x1, y1 = box
    w, h = x1 - x0, y1 - y0
    scale = min(w, h)
    if background:
        rounded_rect(draw, box, int(scale * 0.22), DARK)

    inset = scale * 0.13
    ring_box = (x0 + inset, y0 + inset, x1 - inset, y1 - inset)
    ring_width = max(3, int(scale * (0.065 if compact else 0.055)))
    # Three broken arcs give the mark its own silhouette without copying GitHub branding.
    draw.arc(ring_box, 205, 335, fill=PURPLE_BRIGHT, width=ring_width)
    draw.arc(ring_box, 145, 190, fill=PURPLE, width=ring_width)
    draw.arc(ring_box, 350, 395, fill=PURPLE, width=ring_width)

    cx = (x0 + x1) / 2
    joint_y = y0 + h * 0.52
    top_y = y0 + h * 0.27
    side_y = y0 + h * 0.36
    side_dx = w * 0.245
    line_width = max(4, int(scale * (0.085 if compact else 0.075)))

    draw.line((cx, top_y, cx, joint_y), fill=WHITE, width=line_width)
    draw.line((cx, joint_y, cx - side_dx, side_y), fill=WHITE, width=line_width)
    draw.line((cx, joint_y, cx + side_dx, side_y), fill=WHITE, width=line_width)

    node_radius = scale * (0.09 if compact else 0.082)
    hole_radius = node_radius * 0.38
    for nx, ny in ((cx, top_y), (cx - side_dx, side_y), (cx + side_dx, side_y)):
        draw.ellipse((nx-node_radius, ny-node_radius, nx+node_radius, ny+node_radius), fill=WHITE)
        draw.ellipse((nx-hole_radius, ny-hole_radius, nx+hole_radius, ny+hole_radius), fill=DARK)

    stem_top = joint_y - line_width * 0.15
    stem_bottom = y0 + h * 0.72
    draw.rectangle((cx-line_width/2, stem_top, cx+line_width/2, stem_bottom), fill=WHITE)
    arrow_half = w * (0.25 if compact else 0.285)
    arrow_top = y0 + h * 0.63
    arrow_tip = y0 + h * 0.86
    draw.polygon([
        (cx-arrow_half, arrow_top),
        (cx+arrow_half, arrow_top),
        (cx, arrow_tip),
    ], fill=WHITE)


master = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
draw_brand_mark(master, (64, 64, 960, 960), background=True)
master.save(ASSETS / "icon-master.png")
for size in (16, 32, 48, 128):
    source = Image.new("RGBA", (512, 512), (0, 0, 0, 0))
    draw_brand_mark(source, (24, 24, 488, 488), background=True, compact=size <= 32)
    source.resize((size, size), Image.Resampling.LANCZOS).save(ICONS / f"icon-{size}.png")


def make_social_preview():
    image = Image.new("RGBA", (1280, 640), DARK)
    glow = Image.new("RGBA", image.size, (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse((640, -260, 1420, 760), fill=(130, 80, 223, 72))
    glow = glow.filter(ImageFilter.GaussianBlur(70))
    image.alpha_composite(glow)
    draw = ImageDraw.Draw(image)
    draw_brand_mark(image, (70, 68, 245, 243), background=True)
    title = ImageFont.truetype(FONT_BOLD, 49)
    subtitle = ImageFont.truetype(FONT_REGULAR, 27)
    small = ImageFont.truetype(FONT_BOLD, 19)
    draw.text((72, 278), "GitHub Download Now", font=title, fill=WHITE)
    draw.text((76, 360), "The right release asset. One clear action.", font=subtitle, fill=MUTED)
    rounded_rect(draw, (76, 438, 455, 490), 12, GREEN)
    draw.text((103, 451), "Linux  ·  x64  ·  AppImage", font=small, fill=WHITE)

    card = (730, 88, 1205, 552)
    shadow = Image.new("RGBA", image.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    rounded_rect(sd, (card[0] + 10, card[1] + 14, card[2] + 10, card[3] + 14), 24, (0, 0, 0, 120))
    shadow = shadow.filter(ImageFilter.GaussianBlur(18))
    image.alpha_composite(shadow)
    draw = ImageDraw.Draw(image)
    rounded_rect(draw, card, 24, DARK_2, BORDER, 2)
    draw.arc((770, 112, 825, 167), 205, 335, fill=PURPLE_BRIGHT, width=5)
    rounded_rect(draw, (785, 132, 1150, 202), 14, GREEN)
    button_font = ImageFont.truetype(FONT_BOLD, 22)
    meta_font = ImageFont.truetype(FONT_REGULAR, 15)
    draw.text((820, 147), "Download AppImage", font=button_font, fill=WHITE)
    draw.text((820, 174), "Linux · x64 · Recommended", font=meta_font, fill=(220, 255, 227, 255))
    row_font = ImageFont.truetype(FONT_BOLD, 17)
    for idx, (label, meta, selected) in enumerate([
        ("AppImage", "Linux · x64 · 92 MB", True),
        ("DEB", "Debian / Ubuntu · 68 MB", False),
        ("EXE", "Windows · x64 · 72 MB", False),
        ("DMG", "macOS · ARM64 · 76 MB", False),
    ]):
        y = 235 + idx * 66
        fill = (32, 63, 43, 255) if selected else DARK_2
        outline = (46, 160, 67, 180) if selected else BORDER
        rounded_rect(draw, (785, y, 1155, y + 52), 11, fill, outline, 1)
        draw.text((808, y + 8), label, font=row_font, fill=WHITE)
        draw.text((925, y + 10), meta, font=meta_font, fill=MUTED)
    image.convert("RGB").save(ASSETS / "social-preview.png", quality=95)


def make_promo(size, name):
    w, h = size
    image = Image.new("RGBA", size, DARK)
    draw = ImageDraw.Draw(image)
    draw.ellipse((int(w * 0.48), int(-h * 0.60), int(w * 1.20), int(h * 1.35)), fill=PURPLE)
    draw.ellipse((int(w * 0.66), int(-h * 0.16), int(w * 1.08), int(h * 0.88)), fill=PURPLE_BRIGHT)
    logo_size = int(min(w, h) * 0.48)
    draw_brand_mark(image, (int(w * 0.07), int((h-logo_size)/2), int(w * 0.07)+logo_size, int((h+logo_size)/2)), background=True, compact=True)
    card_x0, card_y0 = int(w * 0.48), int(h * 0.20)
    card_x1, card_y1 = int(w * 0.93), int(h * 0.80)
    rounded_rect(draw, (card_x0, card_y0, card_x1, card_y1), max(8, int(h * .04)), DARK_2, (255,255,255,55), 2)
    button_h = int((card_y1-card_y0)*.24)
    rounded_rect(draw, (card_x0+int(w*.03), card_y0+int(h*.06), card_x1-int(w*.03), card_y0+int(h*.06)+button_h), max(6, int(h*.025)), GREEN_BRIGHT)
    for idx in range(3):
        y = card_y0 + int(h*.11) + button_h + idx*int(h*.12)
        rounded_rect(draw, (card_x0+int(w*.03), y, card_x1-int(w*.03), y+int(h*.075)), max(4, int(h*.018)), (34,40,48,255), (255,255,255,35), 1)
    image.convert("RGB").save(ASSETS / name, quality=95)


make_social_preview()
make_promo((440, 280), "promo-small-440x280.png")
make_promo((1400, 560), "promo-marquee-1400x560.png")
print("Brand assets generated")
