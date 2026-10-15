"""16x16 tab icon: gold coin, white face, big green $, two cow spots. Nothing else."""
from PIL import Image
K = {'O': '#1a1426', 'G': '#f2b632', 'L': '#ffd95a', 'g': '#c27d1c', 'W': '#ffffff', 'w': '#dfe4ec',
     'B': '#29252f', '$': '#2f9a45', 'd': '#164a2a', '.': None}
ART = [
    '.OOOOOOOOOOOOOO.',
    'OLLLLLLLLLLLLLLO',
    'OLGGGGGGGGGGGGgO',
    'OLGWBBW$$WWWWGgO',
    'OLGWBW$$$$$$WGgO',
    'OLGWW$$WWWWWWGgO',
    'OLGWW$$WWWWWWGgO',
    'OLGWWW$$$$WWWGgO',
    'OLGBWWWWWW$$WGgO',
    'OLGBBWWWWW$$WGgO',
    'OLGBW$$$$$$WWGgO',
    'OLGWWWW$$WWWWGgO',
    'OLGWWWWWWBBWWGgO',
    'OLGGGGGGGGGGGGgO',
    'OggggggggggggggO',
    '.OOOOOOOOOOOOOO.',
]
assert all(len(r) == 16 for r in ART)
im = Image.new('RGBA', (16, 16))
rects = []
for y, row in enumerate(ART):
    for x, ch in enumerate(row):
        c = K[ch]
        if c:
            im.putpixel((x, y), tuple(int(c[i:i+2], 16) for i in (1, 3, 5)) + (255,))
            rects.append(f'<rect x="{x}" y="{y}" width="1" height="1" fill="{c}"/>')
open('favicon.svg', 'w').write('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" shape-rendering="crispEdges">' + ''.join(rects) + '</svg>')
im.save('favicon-16.png'); im.resize((32, 32), Image.NEAREST).save('favicon-32.png')
# preview: big, plus mock tab bars at real size
sheet = Image.new('RGB', (520, 220), '#f4f1ea')
big = im.resize((160, 160), Image.NEAREST); sheet.paste(big, (20, 20), big)
for i, (bg, scale) in enumerate([('#dee1e6', 1), ('#35363a', 1), ('#dee1e6', 2), ('#35363a', 2)]):
    tab = Image.new('RGB', (100 * scale // 1, 34 * scale), bg)
    ic = im.resize((16 * scale, 16 * scale), Image.NEAREST); tab.paste(ic, (9 * scale, 9 * scale), ic)
    sheet.paste(tab, (210 + (i % 2) * 150, 30 + (i // 2) * 60))
sheet.save('fav-preview.png')
