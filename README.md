# board-game-design-scratchpad

First visual study: a rectangular hex board built from three-tile triangular
biome clusters. Cluster columns alternate down/up, with a constant orientation
within each column. White tundra tiles border the top and bottom.

Open `index.html` directly in a browser; no server or dependencies are needed.

Open `game.html` for the game-facing prototype. Playable biomes start hidden in
gray while tundra and ocean remain visible. Spawn an Explorer for Red, Green,
Blue, or Yellow, then click playable tiles to move it. Entering a biome reveals
its three terrain tiles; neighboring biomes are identified with one scenic
image spanning their three tiles. Exploration knowledge accumulates until
Reset returns the board to its initial state. A warm-white overlay mutes scenic
artwork more heavily than revealed terrain while borders and pieces stay crisp.
The identification fringe follows entry rather than visibility. Entering a
biome with an Explorer reveals it and identifies its neighbors. A remote reveal
can expose terrain without propagating another fringe. Every tile claimed by a
city counts as an entered location, ensuring that no biome immediately beside
city territory remains unknown.

Each playable biome also has three configurable d6 resource tables in
`config.js`. The dice are deterministically shuffled among the biome's three
tiles and rolled from the game seed when the board is created. Resources remain
hidden until entry. Food combines wheat, wildlife, and fish and uses a painted
green-apple image inside a centered circular medallion; lumber uses a painted
stack of cut logs; stone uses a painted stack of red masonry bricks; iron uses a
painted gunmetal anvil; and gold uses a painted gold ingot. Every resource now
uses the same raster-medallion system. The larger medallions occupy the tile
center, and the player badge may overlap their lower edge.
A resource marker replaces the terrain symbol, and
resource-free tiles have no marker. Change the seed beside Reset game to
regenerate both the biome layout and resource allocation; the same seed
reproduces both.
The player marker is a small badge at the bottom of its tile so it does not
cover the centered resource symbol.

## Explorer actions

Choose a player and spawn any number of Explorers, then use the action panel.
**Reveal adjacent biomes** fully exposes the terrain and resources only for
biomes represented among the six hexes immediately adjacent to the Explorer,
without consuming the unit. It does not reveal biomes touching some other edge
of the Explorer's three-tile biome. **Found city** performs the same localized
reveal, places a city on the Explorer's tile, claims that tile and every
unclaimed neighboring hex for the Explorer's player, consumes that Explorer,
consumes any resource on the founding tile, and builds an automatic wall around
all six sides of the city center. A city can only be founded on eligible land:
mountain, desert, tundra, shallow-sea, and ocean tiles are invalid city sites.
Those tiles can still be claimed from a neighboring eligible city site, and an
Explorer can move through shallow seas. Founding is irreversible until Reset.
Movement distance is not yet limited in this prototype; select an Explorer and
click any playable biome to move it.

Cities use centered painted settlement medallions, matching the resource art
system. Red, Green, Blue, and Yellow each use the same settlement with a
player-colored roof. Because founding consumes the resource on the city tile,
the city medallion replaces it directly in the middle of the hex.

Select a city and choose **Expand city** to claim a connected unclaimed tile no
more than two hex steps from its center. Each claim belongs to the city that
grew into it. Mountain and desert tiles can be claimed, including during the
initial founding claim, but cannot act as stepping stones for further growth.

Choose **Build walls** and click near the edge of an owned tile to add or remove
a wall. Wall segments stop short of hex corners so adjacent walls do not pile
up at their intersections. A player cannot wall an internal boundary between two of their own
tiles, and automatic city-center walls cannot be removed. One wall sits on the
shared tile boundary. If opponents wall the same boundary, both walls shift
slightly into their respective territories so both remain visible.

Claimed tiles display translucent player color only in the band between the
outer hex edge and a clear circular center. Thin hex grid lines are redrawn
above the band, keeping board geometry, terrain, and resources readable.

- Set width (an even number of cluster columns) and height (two hex rows per band).
- Enter six integer biome weights or adjust their linked sliders. Each displayed
  fraction is the biome's weight divided by the sum (e.g. 2 / 8 = 25%).
  These set a fixed inventory for the chosen board size. Whole-cluster counts
  use largest-remainder rounding; ties follow the displayed biome order.
  Ratios are exact when the board size permits, otherwise rounded to fit.
  Zero excludes a biome; at least one weight must be positive.
- Press **Go** to apply settings. Unchanged settings and seed reproduce the map.
- Press **Reshuffle** to apply settings with a new seed. For unchanged size and weights,
  only placement changes; biome counts stay fixed.

`map.js` generates and draws the interactive map; `styles.css` styles the page.
Browser interaction uses JavaScript so the preview works without a Python server.
`generate_map.py` preserves the original Python sketch and regenerates only
`map.svg`. Its random generator differs from the browser's, so seeds are not
interchangeable between the two versions.

The interactive default has 60 clusters, 30 tundra tiles, and 28 ocean tiles.
Its biome inventory is 15 grasslands, 12 hills, 5 desert, 15 forest, 8 shallow
seas, and 5 mountains. These are the default weights and give these exact counts
on the 10 × 6 board. Other board sizes scale the proportions.
Light blue represents Shallow seas; dark blue ocean forms one border tile per
playable row on each side. Every cluster along either side touches this buffer.
Ocean fills the four outer corners to prevent a tundra bridge. Both border types are fixed
and excluded from the biome weights. The Python SVG remains the original sketch.
Colors are placeholders;
adjacent clusters may share a biome. Thin lines separate tiles and thick lines
outline clusters. The board is fully revealed for layout review. Resources,
exploration, and movement are not implemented yet. The left and right boundaries
have matching row offsets for future horizontal wraparound.

## Territory painting

Choose Red, Green, Blue, or Yellow above the map, then click or drag to claim
individual hexagons. Claims add a player-colored ring,
and draw a border around the player's territory, omitting internal shared edges.
Painting over another player transfers the tile. All tiles are paintable.

Use Eraser to remove individual claims, Clear selected player or Clear all
territory for bulk clearing, and Undo to reverse up to 40 strokes/clear actions.
Biome generation and reshuffling preserve claims. Resizing preserves claims at
surviving coordinates and drops claims outside the new board; it resets undo.
Territory is temporary and resets on page reload. Borders currently describe the
visible board; wraparound ownership connections are not implemented.


## Tile artwork

The browser board uses the eight images in `assets/biomes/terrain/` as individual
hexagon backgrounds, cropped without stretching. Tile and cluster borders remain
visible, and territory painting can optionally fade the artwork beneath player rings.
Legend colors follow the artwork: golden grasslands, red hills, orange desert,
green forest, turquoise shallow seas, purple mountains, white tundra, dark ocean.
The separate eight-image `assets/biomes/scenic/` set is saved for later use.
Open or refresh `index.html` with its asset folders alongside it.

Artwork defaults to 30% opacity over solid biome colors to reduce contrast and
make biome identity readable at a glance. The Artwork strength slider adjusts
this appearance live without regenerating the map or changing territory. Each
biome uses one shared SVG pattern; original image files remain untouched.

Territory background fade controls the white overlay on claimed tiles separately
from Artwork strength. It defaults to 0% (no fade); 100% gives white backgrounds.
It updates live and leaves player rings and borders fully opaque. Both visual
sliders retain their settings during generation and reshuffling in the page.

## Biome symbols

Every tile carries a bold white line symbol: grass blades, layered rounded hills,
a cactus, a conifer, gentle wave lines (shallow seas), a single mountain peak,
a snowflake (tundra), or a large breaking wave (ocean). A subtle dark outline keeps
symbols visible on pale tiles. Symbols remain visible at every artwork and
territory-fade setting. Player rings surround them; painting works through them.


## Shared configuration

Edit **`config.js`** to change defaults for both `index.html` and `game.html`:
board columns, bands, seed, named biome weights, and appearance percentages.
Refresh each page after saving. In-page controls are temporary and do not save
back to the configuration. The reveal prototype uses `gameFlatten` for scenic
and static artwork, `gameTerrainFlatten` for entered terrain, and
`gameTerritoryOpacity` for player territory bands; the studio uses
`artworkStrength` and `territoryFade`. Resource die faces live in `resourceDice`.

For another HTML prototype, load `config.js` before `map.js`, then call
`defaultMapSettings()` to get fresh generator settings. The standalone Python
script remains an independent original sketch and does not read this JS config.
