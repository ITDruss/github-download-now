from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
ICONS = ROOT / "src" / "icons"
ASSETS = ROOT / "assets"
ICONS.mkdir(parents=True, exist_ok=True)
ASSETS.mkdir(parents=True, exist_ok=True)

DARK = (13, 17, 23, 255)
DARK_2 = (22, 27, 34, 255)
GREEN = (31, 136, 61, 255)
GREEN_BRIGHT = (46, 160, 67, 255)
WHITE = (255, 255, 255, 255)
MUTED = (139, 148, 158, 255)
BORDER = (48, 54, 61, 255)

FONT_REGULAR = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"


def rounded_rect(draw, box, radius, fill, outline=None, width=1):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def draw_download_mark(image, box, background=True):
    draw = ImageDraw.Draw(image)
    x0, y0, x1, y1 = box
    w, h = x1 - x0, y1 - y0
    if background:
        rounded_rect(draw, box, max(4, int(w * 0.2)), DARK_2)
    cx = (x0 + x1) / 2
    top = y0 + h * 0.22
    shaft_bottom = y0 + h * 0.58
    line_w = max(2, int(w * 0.09))
    draw.line((cx, top, cx, shaft_bottom), fill=GREEN_BRIGHT, width=line_w)
    draw.polygon([
        (cx - w * 0.20, y0 + h * 0.50),
        (cx, y0 + h * 0.70),
        (cx + w * 0.20, y0 + h * 0.50),
    ], fill=GREEN_BRIGHT)
    draw.line((x0 + w * 0.25, y0 + h * 0.78, x0 + w * 0.75, y0 + h * 0.78), fill=WHITE, width=line_w)


# Extension icons: 96px artwork centered on a transparent 128px canvas.
master = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
draw_download_mark(master, (128, 128, 896, 896), background=True)
for size in (16, 32, 48, 128):
    icon = master.resize((size, size), Image.Resampling.LANCZOS)
    icon.save(ICONS / f"icon-{size}.png")
master.save(ASSETS / "icon-master.png")


def make_social_preview():
    image = Image.new("RGBA", (1280, 640), DARK)
    draw = ImageDraw.Draw(image)
    # subtle panels
    for i in range(8):
        alpha = 20 + i * 4
        draw.ellipse((760 + i * 20, -180 + i * 10, 1450 + i * 40, 600 + i * 20), fill=(31, 136, 61, alpha))
    draw_download_mark(image, (72, 88, 232, 248), background=True)
    title = ImageFont.truetype(FONT_BOLD, 50)
    subtitle = ImageFont.truetype(FONT_REGULAR, 28)
    small = ImageFont.truetype(FONT_BOLD, 20)
    draw.text((72, 285), "GitHub Download Now", font=title, fill=WHITE)
    draw.text((76, 370), "The right release asset. One bright button.", font=subtitle, fill=MUTED)
    rounded_rect(draw, (76, 450, 455, 500), 12, GREEN)
    draw.text((103, 462), "Linux  ·  x64  ·  AppImage", font=small, fill=WHITE)

    # UI card
    card = (735, 95, 1205, 545)
    shadow = Image.new("RGBA", image.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    rounded_rect(sd, (card[0] + 10, card[1] + 14, card[2] + 10, card[3] + 14), 24, (0, 0, 0, 115))
    shadow = shadow.filter(ImageFilter.GaussianBlur(18))
    image.alpha_composite(shadow)
    draw = ImageDraw.Draw(image)
    rounded_rect(draw, card, 24, DARK_2, BORDER, 2)
    rounded_rect(draw, (790, 132, 1150, 202), 14, GREEN)
    draw_download_mark(image, (810, 145, 855, 190), background=False)
    button_font = ImageFont.truetype(FONT_BOLD, 22)
    meta_font = ImageFont.truetype(FONT_REGULAR, 15)
    draw.text((872, 147), "Download AppImage", font=button_font, fill=WHITE)
    draw.text((872, 174), "Linux · x64 · Recommended", font=meta_font, fill=(220, 255, 227, 255))
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
    # saturated green field and abstract browser card, no text
    draw.ellipse((int(w * 0.44), int(-h * 0.45), int(w * 1.24), int(h * 1.3)), fill=(31, 136, 61, 255))
    draw.ellipse((int(w * 0.60), int(-h * 0.15), int(w * 1.08), int(h * 0.9)), fill=(46, 160, 67, 255))
    logo_size = int(min(w, h) * 0.42)
    draw_download_mark(image, (int(w * 0.09), int((h - logo_size) / 2), int(w * 0.09) + logo_size, int((h + logo_size) / 2)), background=True)
    card_x0 = int(w * 0.46)
    card_y0 = int(h * 0.20)
    card_x1 = int(w * 0.93)
    card_y1 = int(h * 0.80)
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
