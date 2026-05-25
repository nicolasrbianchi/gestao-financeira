from PIL import Image
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'src', 'assets', 'nicco-mark.jpg')
OUT_DIR = os.path.join(ROOT, 'public', 'icons')
BG = (2, 2, 4)  # #020204

os.makedirs(OUT_DIR, exist_ok=True)


def load_logo():
    img = Image.open(SRC).convert('RGBA')
    return img


def fit_inside(img, box_w, box_h):
    w, h = img.size
    scale = min(box_w / w, box_h / h)
    nw, nh = max(1, int(w * scale)), max(1, int(h * scale))
    return img.resize((nw, nh), Image.LANCZOS)


def make_icon(size, padding_ratio=0.22):
    canvas = Image.new('RGBA', (size, size), BG + (255,))
    logo = load_logo()
    pad = int(size * padding_ratio)
    logo = fit_inside(logo, size - 2 * pad, size - 2 * pad)
    x = (size - logo.size[0]) // 2
    y = (size - logo.size[1]) // 2
    canvas.alpha_composite(logo, (x, y))
    return canvas


def write_png(img, path):
    img.save(path, format='PNG', optimize=True)
    print('wrote', os.path.relpath(path, ROOT))


def make_splash(w, h, logo_ratio=0.22):
    # iOS splash: logo centered a bit above center
    canvas = Image.new('RGBA', (w, h), BG + (255,))
    logo = load_logo()
    target = int(min(w, h) * logo_ratio)
    logo = fit_inside(logo, target, target)
    x = (w - logo.size[0]) // 2
    y = int(h * 0.28) - (logo.size[1] // 2)
    if y < 0:
        y = (h - logo.size[1]) // 2
    canvas.alpha_composite(logo, (x, y))
    return canvas


def main():
    # Standard icons
    write_png(make_icon(192, 0.22), os.path.join(OUT_DIR, 'icon-192.png'))
    write_png(make_icon(512, 0.22), os.path.join(OUT_DIR, 'icon-512.png'))
    # Maskable: extra padding
    write_png(make_icon(512, 0.30), os.path.join(OUT_DIR, 'icon-512-maskable.png'))
    # Apple touch icon
    write_png(make_icon(180, 0.22), os.path.join(OUT_DIR, 'apple-touch-icon.png'))

    # iOS splash (common sizes)
    splashes = [
        (1290, 2796),
        (1179, 2556),
        (1170, 2532),
        (1125, 2436),
        (1242, 2688),
        (828, 1792),
        (1242, 2208),
        (750, 1334),
    ]
    splash_dir = os.path.join(OUT_DIR, 'splash')
    os.makedirs(splash_dir, exist_ok=True)
    for (w, h) in splashes:
        img = make_splash(w, h, 0.22)
        write_png(img, os.path.join(splash_dir, f'splash-{w}x{h}.png'))


if __name__ == '__main__':
    main()
