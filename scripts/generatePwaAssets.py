from PIL import Image
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'src', 'assets', 'nicco-mark.jpg')
OUT_DIR = os.path.join(ROOT, 'public', 'icons')
BG = (2, 2, 4)  # #020204

os.makedirs(OUT_DIR, exist_ok=True)


def load_logo():
    img = Image.open(SRC).convert('RGBA')

    # Tenta remover margens “invisíveis” do JPG (compara com a cor do canto).
    try:
        bg = img.getpixel((0, 0))
        # máscara: pixels que diferem do background
        diff = Image.new('L', img.size, 0)
        px = img.load()
        dpx = diff.load()
        # tolerância menor = trim menos agressivo (mantém mais área “do arquivo”)
        thr = 10
        w, h = img.size
        for y in range(h):
            for x in range(w):
                r, g, b, a = px[x, y]
                if a == 0:
                    continue
                if max(abs(r - bg[0]), abs(g - bg[1]), abs(b - bg[2])) > thr:
                    dpx[x, y] = 255
        bbox = diff.getbbox()
        if bbox:
            l, t, r, b = bbox
            # pequena folga pra não cortar demais
            # mais folga pra não “colar” demais no ícone
            pad = int(min(w, h) * 0.06)
            l = max(0, l - pad)
            t = max(0, t - pad)
            r = min(w, r + pad)
            b = min(h, b + pad)
            img = img.crop((l, t, r, b))
    except Exception:
        pass

    # Remove o fundo (chroma-key do pixel do canto) => deixa só o “mark” com alpha.
    try:
        bg = img.getpixel((0, 0))
        thr = 12
        px = img.load()
        w, h = img.size
        for y in range(h):
            for x in range(w):
                r, g, b, a = px[x, y]
                if a == 0:
                    continue
                if max(abs(r - bg[0]), abs(g - bg[1]), abs(b - bg[2])) <= thr:
                    px[x, y] = (r, g, b, 0)
    except Exception:
        pass

    return img


def fit_inside(img, box_w, box_h):
    w, h = img.size
    scale = min(box_w / w, box_h / h)
    nw, nh = max(1, int(w * scale)), max(1, int(h * scale))
    return img.resize((nw, nh), Image.LANCZOS)


def shift_rgba(img, dx, dy, pad=48):
    """Shift without clipping by expanding canvas with transparent padding."""
    ox = int(round(dx))
    oy = int(round(dy))
    w, h = img.size
    out = Image.new('RGBA', (w + pad * 2, h + pad * 2), (0, 0, 0, 0))
    out.alpha_composite(img, (pad + ox, pad + oy))
    # recorta pro tamanho original, centrado
    left = pad
    top = pad
    return out.crop((left, top, left + w, top + h))


def make_icon(size, padding_ratio=0.22):
    canvas = Image.new('RGBA', (size, size), BG + (255,))
    logo = load_logo()
    pad = int(size * padding_ratio)
    logo = fit_inside(logo, size - 2 * pad, size - 2 * pad)
    # Centraliza pelo bbox do conteúdo (mais estável para ícone/squircle do iOS)
    try:
        w, h = logo.size
        # bbox pelo alpha
        alpha = logo.split()[-1]
        bbox = alpha.getbbox()
        if bbox:
            l, t, r, b = bbox
            cx = (l + r) / 2
            cy = (t + b) / 2
            dx = (w / 2) - cx
            dy = (h / 2) - cy

            # Ajuste óptico leve (iOS squircle costuma “parecer” baixo)
            dx += w * 0.008
            dy -= h * 0.035
            logo = shift_rgba(logo, dx, dy)
    except Exception:
        pass

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
    # padding menor = logo maior
    # Ajuste fino: maior
    write_png(make_icon(192, 0.105), os.path.join(OUT_DIR, 'icon-192.png'))
    write_png(make_icon(512, 0.105), os.path.join(OUT_DIR, 'icon-512.png'))
    # Maskable: precisa de área segura, mas não tão pequeno
    write_png(make_icon(512, 0.185), os.path.join(OUT_DIR, 'icon-512-maskable.png'))
    # Apple touch icon
    write_png(make_icon(180, 0.105), os.path.join(OUT_DIR, 'apple-touch-icon.png'))

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
        # logo um pouco maior no splash
        img = make_splash(w, h, 0.30)
        write_png(img, os.path.join(splash_dir, f'splash-{w}x{h}.png'))


if __name__ == '__main__':
    main()
