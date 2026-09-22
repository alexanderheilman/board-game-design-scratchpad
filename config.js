"use strict";

// Shared defaults for index.html, game.html, and future prototypes.
// Edit this file, then refresh the page. Browser controls do not write back here.
const BOARD_CONFIG = {
  board: {
    columns: 10, // Even number, 2–40; triangular cluster columns.
    bands: 6,   // 1–24; each band contains two hexagon rows.
    seed: 7,    // Integer, 0–4294967295.
  },
  // Nonnegative integer weights. At 60 clusters these are exact counts.
  // Other board sizes scale the proportions and round to whole clusters.
  biomeWeights: {
    grasslands: 15,
    hills: 12,
    desert: 5,
    forest: 15,
    'shallow-seas': 8,
    mountains: 5,
  },
  // Each playable biome rolls three d6 resource tables. The three dice are
  // randomly assigned to its three tiles; null means no resource.
  resourceDice: {
    grasslands: [
      ['food', 'food', 'food', 'food', null, null],
      ['food', 'food', 'food', null, null, null],
      ['food', 'food', null, null, null, null],
    ],
    forest: [
      ['lumber', 'lumber', 'lumber', 'lumber', 'lumber', 'food'],
      ['lumber', 'lumber', 'lumber', 'lumber', 'lumber', 'food'],
      ['lumber', 'lumber', 'lumber', 'lumber', 'lumber', 'food'],
    ],
    hills: [
      ['stone', 'stone', 'stone', 'iron', 'iron', 'gold'],
      ['stone', 'stone', 'stone', 'stone', 'iron', 'iron'],
      ['stone', 'stone', 'stone', 'stone', 'iron', 'gold'],
    ],
    'shallow-seas': [
      ['food', 'food', 'food', null, null, null],
      ['food', 'food', 'food', null, null, null],
      ['food', 'food', null, null, null, null],
    ],
    mountains: [
      ['iron', 'iron', 'iron', 'gold', null, null],
      ['iron', 'iron', 'iron', null, null, null],
      ['iron', 'iron', 'iron', 'gold', null, null],
    ],
    desert: [
      ['gold', 'gold', 'gold', null, null, null],
      ['gold', 'gold', null, null, null, null],
      ['gold', null, null, null, null, null],
    ],
  },
  appearance: {
    artworkStrength: 30, // Percent, 0–100: studio terrain artwork.
    territoryFade: 0,    // Percent, 0–100: white wash on claimed studio tiles.
    gameFlatten: 60,     // Percent, 0–100: scenic/static artwork wash in game.html.
    gameTerrainFlatten: 25, // Percent, 0–100: lighter wash on entered terrain.
    gameTerritoryOpacity: 60, // Percent, 0–100: player-color territory bands in game.html.
  },
};
