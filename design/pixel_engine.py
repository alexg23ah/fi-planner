"""32x32 16-bit style sprite engine: full-bleed background, outlined subject, 4-tone ramps with
top-left light. Shapes fill a region map; details are stamped on top."""
import math
from PIL import Image

N = 32
OUT = '#1a1426'
R = {  # highlight, light, base, dark, deep
    'green': ('#c6f7a0', '#7fd65f', '#3fa34d', '#24733a', '#164a2a'),
    'gold': ('#fff6c2', '#ffd95a', '#f2b632', '#c27d1c', '#7f4a14'),
    'white': ('#ffffff', '#ffffff', '#eef1f6', '#c3cad6', '#8e97a8'),
    'black': ('#5a5468', '#3d3848', '#29252f', '#1c1922', '#121016'),
    'pink': ('#ffd6e6', '#ffaecb', '#ff7fae', '#d94f86', '#9c2c5c'),
    'tan': ('#fff3d6', '#f4dca6', '#e0b873', '#a97f3f', '#6d4f22'),
    'brown': ('#e3a36a', '#b8763f', '#8a5228', '#5e3418', '#3a1f0e'),
    'red': ('#ffb0a8', '#ff6f62', '#e0383a', '#a51e2c', '#66101c'),
    'steel': ('#ffffff', '#dfe6ef', '#a9b5c4', '#6f7b8d', '#454e5e'),
    'denim': ('#a9c8f2', '#6d9ce0', '#3b6cba', '#25488a', '#162c58'),
    'teal': ('#b9f0e6', '#6fd1c0', '#2fa597', '#1d7470', '#114846'),
    'sky': ('#d9f2ff', '#a6dcff', '#6fbdf2', '#4691cf', '#2a63a0'),
    'cream': ('#fffdf6', '#fff6e0', '#f7e6c0', '#d6bd8c', '#9c8257'),
}


class S:
    def __init__(s, bg=None):
        s.g = [[None] * N for _ in range(N)]
        s.d = {}
        s.bg = bg  # function (x,y)->colour

    def inb(s, x, y):
        return 0 <= x < N and 0 <= y < N

    def set(s, x, y, r):
        if s.inb(x, y):
            s.g[y][x] = r

    def each(s, test, r):
        for y in range(N):
            for x in range(N):
                if test(x + .5, y + .5):
                    s.set(x, y, r)

    def rect(s, x0, y0, x1, y1, r):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                s.set(x, y, r)

    def ell(s, cx, cy, rx, ry, r):
        s.each(lambda x, y: ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1, r)

    def ring(s, cx, cy, ro, ri, r):
        s.each(lambda x, y: ri <= math.hypot(x - cx, y - cy) <= ro, r)

    def poly(s, pts, r):
        def inside(px, py):
            ins = False
            j = len(pts) - 1
            for i in range(len(pts)):
                xi, yi = pts[i]; xj, yj = pts[j]
                if (yi > py) != (yj > py) and px < (xj - xi) * (py - yi) / (yj - yi) + xi:
                    ins = not ins
                j = i
            return ins
        s.each(inside, r)

    def stamp(s, bm, x0, y0, cmap):
        if isinstance(cmap, str):
            cmap = {'#': cmap}
        for j, row in enumerate(bm):
            for i, ch in enumerate(row):
                if ch in cmap:
                    s.d[(x0 + i, y0 + j)] = cmap[ch]

    def px(s, x, y, c):
        s.d[(x, y)] = c

    def render(s):
        g = s.g
        out = [[None] * N for _ in range(N)]
        f = lambda x, y: s.inb(x, y) and g[y][x] is not None
        same = lambda x, y, r: s.inb(x, y) and g[y][x] == r
        for y in range(N):
            for x in range(N):
                r = g[y][x]
                if r is None:
                    if any(f(x + dx, y + dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                        out[y][x] = OUT
                    else:
                        out[y][x] = s.bg(x, y) if s.bg else None
                    continue
                hi, lt, base, dk, dp = R[r]
                # inner edges between different regions get a dark seam, outer edge handled by outline
                down = not same(x, y + 1, r) and s.inb(x, y + 1)
                right = not same(x + 1, y, r) and s.inb(x + 1, y)
                up = not same(x, y - 1, r) and s.inb(x, y - 1)
                left = not same(x - 1, y, r) and s.inb(x - 1, y)
                down2 = not same(x, y + 2, r) and s.inb(x, y + 2)
                if down or right:
                    out[y][x] = dk
                elif up or left:
                    out[y][x] = lt
                elif down2:
                    out[y][x] = base if g[min(N-1,y+2)][x] is not None else dk
                else:
                    out[y][x] = base
        for (x, y), c in s.d.items():
            if s.inb(x, y):
                out[y][x] = c
        return out


def png(grid, path, scale=10):
    im = Image.new('RGBA', (N, N))
    for y in range(N):
        for x in range(N):
            c = grid[y][x]
            if c:
                im.putpixel((x, y), tuple(int(c[i:i + 2], 16) for i in (1, 3, 5)) + (255,))
    im = im.resize((N * scale, N * scale), Image.NEAREST)
    im.save(path)
    return im


def svg(grid):
    rects = []
    for y, row in enumerate(grid):
        x = 0
        while x < N:
            c = row[x]
            if c is None:
                x += 1; continue
            x2 = x
            while x2 + 1 < N and row[x2 + 1] == c:
                x2 += 1
            rects.append(f'<rect x="{x}" y="{y}" width="{x2 - x + 1}" height="1" fill="{c}"/>')
            x = x2 + 1
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {N} {N}" shape-rendering="crispEdges">' + ''.join(rects) + '</svg>'


def radial_bg(ramp, cx=10, cy=8):
    """Background with a soft dithered glow from top-left."""
    hi, lt, base, dk, dp = R[ramp]
    def f(x, y):
        d = math.hypot(x - cx, y - cy) / (N * 1.1)
        bands = [(0.25, lt), (0.5, base), (0.75, dk), (9, dp)]
        prev = lt
        for lim, c in bands:
            if d < lim:
                # checker dither in the outer 15% of each band
                lo = lim - 0.06
                if d > lo and (x + y) % 2 == 0:
                    nxt = bands[min(bands.index((lim, c)) + 1, 3)][1]
                    return nxt
                return c
        return dp
    return f


def rays_bg(a, b, cx=16, cy=16, n=16):
    """Sunburst: alternating wedges of two colours."""
    def f(x, y):
        ang = math.atan2(y + .5 - cy, x + .5 - cx)
        return a if int((ang + math.pi) / (2 * math.pi) * n) % 2 == 0 else b
    return f
