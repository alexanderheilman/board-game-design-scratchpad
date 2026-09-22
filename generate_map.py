"""Generate a reproducible, fully revealed board sketch using only Python."""

from collections import Counter
from math import cos, sin, pi, sqrt
from pathlib import Path
import random


ROOT = Path(__file__).resolve().parent
BIOMES = [
    ("Grasslands", "#e56565"),
    ("Hills", "#ed9c4b"),
    ("Desert", "#f0d866"),
    ("Forest", "#65ad7c"),
    ("Ocean", "#589ed5"),
    ("Mountains", "#a084cd"),
]


def generate(seed=7, columns=8, bands=4):
    """Columns alternate down/up; each band contains two rows of hexagons.

    Coordinates are doubled horizontal center positions and vertical row numbers.
    A pair of cluster columns occupies three hexagons in each of two rows.
    """
    if columns < 2 or columns % 2 or bands < 1:
        raise ValueError("Use an even number of columns and at least one band")
    rng = random.Random(seed)
    groups = []
    for band in range(bands):
        row = band * 2
        for column in range(columns):
            x = (column // 2) * 6
            tiles = ([(x, row), (x + 2, row), (x + 1, row + 1)]
                     if column % 2 == 0 else
                     [(x + 4, row), (x + 3, row + 1), (x + 5, row + 1)])
            groups.append((rng.choice(BIOMES), tiles))
    width = columns // 2 * 3
    tundra = [(2 * i + 1, -1) for i in range(width)]
    tundra += [(2 * i, bands * 2) for i in range(width)]
    return groups, tundra


def render(groups, tundra):
    radius = 31
    def polygon(tile):
        x, row = tile
        cx, cy = 85 + x * sqrt(3) * radius / 2, 135 + row * radius * 1.5
        return [(round(cx + radius * cos(pi / 180 * (60 * i - 30)), 4),
                 round(cy + radius * sin(pi / 180 * (60 * i - 30)), 4))
                for i in range(6)]

    def points(vertices):
        return " ".join(f"{x},{y}" for x, y in vertices)

    out = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 650" role="img" aria-labelledby="title desc">',
           '<title id="title">Triangular biome clusters</title>',
           '<desc id="desc">Rectangular hex board with alternating down and up three-tile clusters, and white tundra at the top and bottom. All tiles are revealed.</desc>',
           '<rect width="800" height="650" fill="#f5f3ee"/>',
           '<g font-family="system-ui, sans-serif" fill="#28343c">',
           '<text x="48" y="40" font-size="24" font-weight="700">First map study</text>',
           '<text x="48" y="65" font-size="13">32 biome clusters · 3 hexagons each · white tundra borders</text>']
    for (name, color), tiles in groups + [(("Tundra", "#ffffff"), tundra)]:
        edges = Counter()
        for tile in tiles:
            vertices = polygon(tile)
            out.append(f'<polygon points="{points(vertices)}" fill="{color}" stroke="#34424c" stroke-opacity="0.4" stroke-width="1"><title>{name}</title></polygon>')
            for a, b in zip(vertices, vertices[1:] + vertices[:1]):
                edges[tuple(sorted((a, b)))] += 1
        for (a, b), count in edges.items():
            if count == 1:
                out.append(f'<path d="M {a[0]} {a[1]} L {b[0]} {b[1]}" fill="none" stroke="#34424c" stroke-width="2.8" stroke-linecap="round"/>')
    for i, (name, color) in enumerate(BIOMES + [("Tundra", "#ffffff")]):
        x, y = 48 + (i % 4) * 180, 565 + (i // 4) * 30
        out.append(f'<rect x="{x}" y="{y - 12}" width="16" height="16" rx="3" fill="{color}" stroke="#34424c"/>')
        out.append(f'<text x="{x + 24}" y="{y}" font-size="13">{name}</text>')
    out.append('<text x="48" y="634" font-size="12">Fully revealed sketch · colors are placeholders · left/right edges intended to wrap</text></g></svg>')
    return "\n".join(out)


if __name__ == "__main__":
    svg = render(*generate())
    (ROOT / "map.svg").write_text(svg)
    print("Created map.svg (static sketch)")
