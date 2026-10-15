"""Final Buckaroo logos: no background, subject fills the 32x32 square (outline on the edge pixels)."""
import math, os, sys
sys.path.insert(0, os.path.dirname(__file__))
from pixel_engine import S, R, OUT, N, png, svg

DOLLAR = [
    '..##..',
    '######',
    '##....',
    '#####.',
    '.#####',
    '....##',
    '######',
    '..##..',
]
SPARK = ['.#.', '###', '.#.']


def rrect(s, x0, y0, x1, y1, rad, r, corners='tl tr bl br'):
    """Rounded rectangle in pixel units (inclusive), corner radius `rad`."""
    def inside(x, y):
        if not (x0 <= x <= x1 + 1 and y0 <= y <= y1 + 1):
            return False
        for name, cx, cy in (('tl', x0 + rad, y0 + rad), ('tr', x1 + 1 - rad, y0 + rad), ('bl', x0 + rad, y1 + 1 - rad), ('br', x1 + 1 - rad, y1 + 1 - rad)):
            if name not in corners:
                continue
            if (name[1] == 'l' and x < cx or name[1] == 'r' and x > cx) and (name[0] == 't' and y < cy or name[0] == 'b' and y > cy):
                return math.hypot(x - cx, y - cy) <= rad
        return True
    s.each(inside, r)


def eye(s, x, y):
    s.stamp(['###', '###', '###'], x, y, OUT)
    s.px(x, y, '#ffffff')


def ring_px(s, cx, cy, ro, ri, fn):
    for y in range(N):
        for x in range(N):
            d = math.hypot(x + .5 - cx, y + .5 - cy)
            if ri < d <= ro:
                c = fn(x, y)
                if c: s.px(x, y, c)


def nose_ring(s, cx, cy, ro, ri):
    s.ring(cx, cy, ro, ri, 'gold')


def ring_shine(s, cx, cy, ro, ri):
    mid = (ro + ri) / 2
    ring_px(s, cx, cy, mid + .4, mid - .6, lambda x, y: R['gold'][0] if (x + .5 - cx) < -1 and (y + .5 - cy) < 1 else None)


def cow_face(s, top, eye_y, muzzle_top, spots=True):
    b = R['black'][2]
    if spots:
        s.stamp(['..#####', '.######', '#######', '#####..', '.###...'], 19, top + 2, b)
        s.stamp(['##', '###', '##'], 5, eye_y + 4, b)
        s.stamp(['####', '##'], 20, top + 2, R['black'][0])
    eye(s, 9, eye_y); eye(s, 20, eye_y)
    # nostrils
    s.stamp(['.##.', '####', '####', '.##.'], 8, muzzle_top + 3, R['pink'][4])
    s.stamp(['.##.', '####', '####', '.##.'], 20, muzzle_top + 3, R['pink'][4])
    s.stamp(['######'], 13, muzzle_top + 1, R['pink'][1])


def cashcow1():
    s = S()
    # horns: chunky blocks curling up into the top corners
    s.poly([(10, 7), (4, 7), (1, 4), (1, 1), (5, 1), (6, 4), (10, 4)], 'tan')
    s.poly([(22, 7), (28, 7), (31, 4), (31, 1), (27, 1), (26, 4), (22, 4)], 'tan')
    rrect(s, 1, 9, 6, 15, 3, 'white'); rrect(s, 25, 9, 30, 15, 3, 'white')  # ears
    rrect(s, 5, 4, 26, 30, 7, 'white')
    rrect(s, 3, 18, 28, 30, 6, 'pink')
    nose_ring(s, 16, 26.5, 5.5, 3.2)
    s.render()
    s.d = {}
    s.stamp(['####', '.##.'], 2, 11, R['pink'][3]); s.stamp(['####', '.##.'], 26, 11, R['pink'][3])
    s.stamp(['.##', '#..'], 2, 2, R['tan'][0]); s.stamp(['##.', '..#'], 27, 2, R['tan'][0])
    cow_face(s, 4, 12, 18)
    ring_shine(s, 16, 26.5, 5.5, 3.2)
    return s.render()


def cashcow3():
    s = S()
    rrect(s, 1, 1, 30, 30, 9, 'gold')
    rrect(s, 5, 5, 26, 26, 6, 'white')
    s.render()
    s.d = {}
    # bevel on the coin face edge
    for y in range(N):
        for x in range(N):
            if s.g[y][x] == 'gold' and any(0 <= x + dx < N and 0 <= y + dy < N and s.g[y + dy][x + dx] == 'white' for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                s.px(x, y, R['gold'][3] if x + y < 31 else R['gold'][0])
    # reeding on the outer rim
    for k in range(4, 28, 3):
        for (x, y) in ((k, 2), (k, 29), (2, k), (29, k)):
            s.px(x, y, R['gold'][3])
    b, bl = R['black'][2], R['black'][0]
    def spot(bm, x0, y0):
        for j, row in enumerate(bm):
            for i, ch in enumerate(row):
                x, y = x0 + i, y0 + j
                if ch == '#' and 0 <= x < N and 0 <= y < N and s.g[y][x] == 'white':
                    s.px(x, y, b)
    spot(['..####..', '.######.', '########', '#######.', '.#####..', '..##....'], 4, 4)
    spot(['...#####', '.#######', '########', '.######.', '...##...'], 19, 4)
    spot(['.##', '###', '####', '###', '##.'], 5, 12)
    spot(['..##....', '.#####..', '#######.', '########', '.######.', '..####..'], 4, 20)
    spot(['....###.', '..######', '.#######', '########', '.#######', '...####.'], 19, 19)
    spot(['.###', '####', '###.'], 24, 12)
    spot(['##.', '###'], 13, 25)
    spot(['.##', '###', '##.'], 7, 17)
    spot(['.##', '###', '###', '.#.'], 23, 15)
    spot(['####', '.##.'], 11, 5)
    spot(['.###', '###.'], 17, 25)
    # shine on a couple of spots
    for (x, y) in [(7, 5), (8, 5), (22, 5), (23, 5), (6, 21), (21, 20)]:
        if s.d.get((x, y)) == b: s.px(x, y, bl)
    BIG = [
        '....##....',
        '....##....',
        '.########.',
        '##########',
        '###.##....',
        '###.##....',
        '#########.',
        '.#########',
        '....##.###',
        '....##.###',
        '##########',
        '.########.',
        '....##....',
        '....##....',
    ]
    x0, y0 = 11, 9
    cells = {(x0 + i, y0 + j) for j, row in enumerate(BIG) for i, ch in enumerate(row) if ch == '#'}
    shadow = {(x + 1, y + 1) for x, y in cells}
    body = cells | shadow
    ring = {(x + dx, y + dy) for x, y in body for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))} - body
    halo = {(x + dx, y + dy) for x, y in ring for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))} - body - ring
    for (x, y) in halo:
        if 0 <= x < N and 0 <= y < N and s.g[y][x] == 'white': s.px(x, y, R['white'][2])
    for q in ring: s.px(*q, OUT)
    for q in shadow - cells: s.px(*q, R['green'][4])
    for (x, y) in cells:
        top = (x, y - 1) not in cells
        bottom = (x, y + 1) not in cells
        s.px(x, y, R['green'][1] if top else R['green'][3] if bottom else R['green'][2])
    s.stamp(['##', '#.'], 3, 3, '#ffffff')
    return s.render()


def buckaroo2():
    s = S()
    pts = []
    for k in range(12):
        a = -math.pi / 2 + k * math.pi / 6
        rr = 15.2 if k % 2 == 0 else 10.2
        pts.append((16 + rr * math.cos(a) * 1.12, 16.3 + rr * math.sin(a)))
    s.poly(pts, 'gold')
    tips = []
    for k in range(0, 12, 2):
        x, y = pts[k]
        x = min(max(x, 3.6), 28.4); y = min(max(y, 3.6), 28.4)
        tips.append((x, y))
        s.ell(x, y, 2.7, 2.7, 'gold')
    s.ell(16, 16.3, 8.4, 8.4, 'denim')
    s.render()
    s.d = {}
    ring_px(s, 16, 16.3, 9.6, 8.4, lambda x, y: R['gold'][4])
    for (x, y) in tips:
        s.stamp(['##', '#.'], int(x) - 1, int(y) - 1, R['gold'][0])
    s.stamp(DOLLAR, 14, 13, R['denim'][4])
    s.stamp(DOLLAR, 13, 12, R['gold'][1])
    s.stamp(['......', '#.....', '#.....'], 13, 12, R['gold'][0])
    s.stamp(['##', '#.'], 11, 10, R['denim'][1])
    return s.render()


def buckaroo3():
    s = S()
    rrect(s, 1, 1, 30, 30, 13, 'steel', corners='bl br')
    rrect(s, 1, 1, 30, 30, 2, 'steel', corners='tl tr')
    # carve the inside of the U
    for y in range(0, 22):
        for x in range(10, 22):
            if y < 15 or math.hypot(x + .5 - 16, y + .5 - 15) <= 6.2:
                s.g[y][x] = None
    s.ell(16, 13, 6.6, 6.6, 'gold')
    s.render()
    s.d = {}
    nail = R['steel'][4]
    for (x, y) in [(4, 5), (4, 12), (26, 5), (26, 12), (5, 20), (25, 20), (10, 26), (20, 26)]:
        s.stamp(['##', '##'], x, y, nail); s.px(x, y, R['steel'][1])
    # groove along the shoe
    for y in range(3, 18):
        if y not in (5, 6, 12, 13): s.px(5, y, R['steel'][3]); s.px(26, y, R['steel'][3])
    ring_px(s, 16, 15, 11.2, 10.2, lambda x, y: R['steel'][3] if y >= 17 and (x, y) not in {(5, 20), (6, 20), (5, 21), (6, 21), (25, 20), (26, 20), (25, 21), (26, 21), (10, 26), (11, 26), (10, 27), (11, 27), (20, 26), (21, 26), (20, 27), (21, 27)} else None)
    ring_px(s, 16, 13, 5.4, 4.4, lambda x, y: R['gold'][3] if x + y > 28 else R['gold'][0])
    s.stamp(['.#.', '###', '#..', '###', '..#', '###', '.#.'], 15, 10, R['gold'][4])
    s.stamp(['##', '#.'], 2, 2, '#ffffff'); s.stamp(['##', '#.'], 23, 2, '#ffffff')
    return s.render()


def cowboy_cow():
    s = S()
    # hat: crown and a full-width brim
    s.poly([(5, 11), (6, 3), (10, 1), (14.5, 2), (16, 1), (17.5, 2), (22, 1), (26, 3), (27, 11)], 'brown')
    s.rect(6, 7, 26, 10, 'red')
    s.poly([(1, 7), (4, 10), (10, 11.5), (22, 11.5), (28, 10), (31, 7), (31, 11), (27, 14), (5, 14), (1, 11)], 'brown')
    # horns poking out under the brim
    rrect(s, 1, 14, 6, 19, 3, 'white'); rrect(s, 25, 14, 30, 19, 3, 'white')
    rrect(s, 4, 12, 27, 30, 6, 'white', corners='bl br')
    s.rect(4, 12, 27, 16, 'white')
    rrect(s, 3, 20, 28, 30, 6, 'pink')
    nose_ring(s, 16, 27, 5.0, 2.9)
    s.render()
    s.d = {}
    b = R['black'][2]
    s.stamp(['..###', '.####', '#####', '.###.'], 23, 14, b)
    s.stamp(['##', '###', '##'], 5, 20, b)
    s.stamp(['###', '.#.'], 2, 16, R['pink'][3]); s.stamp(['###', '.#.'], 27, 16, R['pink'][3])
    eye(s, 9, 15); eye(s, 19, 15)
    s.stamp(['.##.', '####', '####', '.##.'], 7, 22, R['pink'][4])
    s.stamp(['.##.', '####', '####', '.##.'], 21, 22, R['pink'][4])
    s.stamp(['######'], 13, 21, R['pink'][1])
    ring_shine(s, 16, 27, 5.0, 2.9)
    # hat details
    s.stamp(SPARK, 15, 7, R['gold'][1]); s.px(16, 8, R['gold'][0])
    s.stamp(['#', '#', '#', '#'], 9, 3, R['brown'][0])
    s.stamp(['#', '#', '#'], 16, 3, R['brown'][3])
    s.stamp(['##########'], 4, 11, R['brown'][1])
    return s.render()


if __name__ == '__main__':
    from PIL import Image, ImageDraw, ImageFont
    d = os.path.join(os.path.dirname(__file__), 'out2'); os.makedirs(d, exist_ok=True)
    items = [('CashCow 1', cashcow1()), ('CashCow 3', cashcow3()), ('Buckaroo 2', buckaroo2()),
             ('Buckaroo 3', buckaroo3()), ('Cowboy cow', cowboy_cow())]
    font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 22)
    W = 340 * len(items) + 20
    sheet = Image.new('RGB', (W, 480), '#f4f1ea')
    dr = ImageDraw.Draw(sheet)
    for i, (name, g) in enumerate(items):
        slug = name.lower().replace(' ', '-')
        open(os.path.join(d, slug + '.svg'), 'w').write(svg(g))
        im = png(g, os.path.join(d, slug + '.png'), 10)
        x = 20 + i * 340
        sheet.paste(im, (x, 20), im)
        dark = Image.new('RGB', (72, 72), '#1d1f22'); dark.paste(im.resize((64, 64), Image.NEAREST), (4, 4), im.resize((64, 64), Image.NEAREST))
        sheet.paste(dark, (x, 380))
        sm = im.resize((32, 32), Image.NEAREST); sheet.paste(sm, (x + 84, 400), sm)
        dr.text((x + 130, 405), name, fill='#1a1426', font=font)
    sheet.save(os.path.join(d, 'sheet.png'))
    print('ok')
