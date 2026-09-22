// Run from the repository root with JavaScriptCore: jsc tests/game.test.js
load('config.js');
load('map.js');
load('game.js');
function assert(value, message) { if (!value) throw new Error(message); }

function clearPiecesAndFog() {
  revealedClusters.clear(); identifiedClusters.clear();
  units.length = 0; cities.length = 0;
  territory.clear(); territoryCity.clear(); walls.clear();
  selectedUnitId = null; selectedCityId = null;
}

function assertClaimHasNoUnknownNeighborBiomes(key, message) {
  const cluster = tileClusterLookup.get(key);
  if (cluster !== undefined) assert(revealedClusters.has(cluster), message);
  for (const neighbor of neighboringTileKeys(key.split(',').map(Number))) {
    const adjacent = tileClusterLookup.get(neighbor);
    if (adjacent !== undefined) {
      assert(revealedClusters.has(adjacent) || identifiedClusters.has(adjacent), message);
    }
  }
}

const hidden = renderGameMap();
const tileCount = board.groups.length * 3 + board.tundra.length + board.ocean.length;
assert((hidden.match(/assets\/biomes\/scenic\//g) || []).length === 0, 'hidden clusters do not disclose biome art');
assert((hidden.match(/class="cluster-hidden"/g) || []).length === board.groups.length * 3, 'every playable tile starts gray');
assert((hidden.match(/data-cluster=/g) || []).length === board.groups.length * 3, 'every biome tile is clickable');
assert((hidden.match(/class="art-flatten /g) || []).length === tileCount, 'every tile receives the flattening overlay');
assert((hidden.match(/class="resource-marker/g) || []).length === 0, 'hidden tiles do not show resources');
assert(!hidden.includes('class="player-token'), 'players start off board');

const firstResources = JSON.stringify(resourceAllocations);
assert(firstResources === JSON.stringify(generateResourceAllocations(board)), 'resource allocation is seed-reproducible');
resourceAllocations.forEach(cluster => assert(JSON.stringify(cluster.map(result => result.die).sort()) === '[0,1,2]', 'each cluster assigns all dice once'));
resourceAllocations.forEach((cluster, clusterIndex) => {
  const biome = BIOMES[board.groups[clusterIndex].biome].texture;
  cluster.forEach(result => assert(result.resource === BOARD_CONFIG.resourceDice[biome][result.die][result.face], 'roll resolves through assigned die face'));
});
resetGame((board.seed + 1) >>> 0);
assert(firstResources !== JSON.stringify(resourceAllocations), 'changing seed changes resources');
resetGame(GAME_SETTINGS.seed);
assert(firstResources === JSON.stringify(resourceAllocations), 'restoring seed restores resources');

for (let cluster = 0; cluster < clusterAdjacency.length; cluster++) {
  for (const adjacent of clusterAdjacency[cluster]) assert(clusterAdjacency[adjacent].has(cluster), 'cluster adjacency is symmetric');
}

const firstExplorer = spawnExplorer(0, 0, board.groups[0].tiles[0]);
const revealed = renderGameMap();
assert((revealed.match(/assets\/biomes\/scenic\//g) || []).length === clusterAdjacency[0].size, 'adjacent clusters display scenic art');
assert((revealed.match(/class="cluster-hidden"/g) || []).length === (board.groups.length - 1 - clusterAdjacency[0].size) * 3, 'nonadjacent clusters stay gray');
assert((revealed.match(/— revealed ·/g) || []).length === 3, 'entering exposes all terrain tiles');
assert((revealed.match(/class="art-flatten art-flatten--terrain"/g) || []).length === 3, 'entered terrain uses lighter flattening');
assert((revealed.match(/class="resource-marker/g) || []).length === resourceAllocations[0].filter(result => result.resource).length, 'only resourced tiles show symbols');
assert(revealed.includes('class="player-token piece-selected"'), 'spawning places and selects an Explorer');
assert(firstExplorer.owner === 0 && PLAYER_TOKEN_RADIUS === 9 && PLAYER_TOKEN_OFFSET_Y === 19, 'Explorer owner and compact placement are correct');

for (const resource of Object.keys(RESOURCE_NAMES)) {
  const cluster = resourceAllocations.findIndex(results => results.some(result => result.resource === resource));
  assert(cluster >= 0, `seeded board contains ${resource}`);
  clearPiecesAndFog(); revealEnteredCluster(cluster);
  const view = renderGameMap();
  assert(view.includes(`class="resource-marker resource-medallion" data-resource="${resource}"`), `${resource} uses a raster medallion`);
  assert(view.includes(`assets/resources/${resource}.png`), `${resource} loads its artwork`);
  assert(view.includes('<circle r="13"'), 'resource medallions use the larger size');
  assert(!view.includes('resource-line-icon'), 'line-symbol fallback is absent');
}
assert(Object.keys(RESOURCE_NAMES).every(resource => RESOURCE_IMAGES[resource]), 'every resource has artwork');

resetGame(GAME_SETTINGS.seed);
let actionCluster = -1, actionTile = null, actionRemoteUnknown = null;
board.groups.some((group, cluster) => group.tiles.some(tile => {
  const local = adjacentBiomeClusters(tile);
  const initiallyKnown = new Set([cluster, ...clusterAdjacency[cluster]]);
  const remote = new Set();
  local.forEach(revealed => clusterAdjacency[revealed].forEach(adjacent => {
    if (!initiallyKnown.has(adjacent) && !local.has(adjacent)) remote.add(adjacent);
  }));
  if (local.size && local.size < clusterAdjacency[cluster].size && remote.size) {
    actionCluster = cluster; actionTile = tile; actionRemoteUnknown = remote; return true;
  }
  return false;
}));
assert(actionCluster >= 0, 'board contains a locally constrained reveal with a possible remote fringe');
const actionExplorer = spawnExplorer(0, actionCluster, actionTile);
const explorerPosition = actionExplorer.tile.join(',');
const locallyAdjacentBiomes = adjacentBiomeClusters(actionExplorer.tile);
assert(performRevealAction(), 'Explorer can perform reveal action');
assert([...locallyAdjacentBiomes].every(cluster => revealedClusters.has(cluster)), 'reveal action affects immediately adjacent tile biomes');
assert([...clusterAdjacency[actionCluster]].some(cluster => !locallyAdjacentBiomes.has(cluster) && !revealedClusters.has(cluster)), 'reveal action does not expose remote parts of biome boundary');
assert([...actionRemoteUnknown].every(cluster => !revealedClusters.has(cluster) && !identifiedClusters.has(cluster)), 'remote reveal does not propagate a second identification fringe');
assert(actionExplorer.tile.join(',') === explorerPosition && units.includes(actionExplorer), 'reveal does not consume or move Explorer');

const secondExplorer = spawnExplorer(3, 1, board.groups[1].tiles[0]);
assert(units.length === 2 && secondExplorer.owner === 3, 'multiple Explorers and all four owners are supported');
assert(renderGameMap().includes(PLAYERS[3].color), 'fourth player color renders');

resetGame(GAME_SETTINGS.seed);
assert(activePlayer === 0, 'reset restores Red as the active player');
const mountainKey = [...boardTileKeys].find(key => tileBiomeTexture(key) === 'mountains');
const desertKey = [...boardTileKeys].find(key => tileBiomeTexture(key) === 'desert');
const shallowSeaKey = [...boardTileKeys].find(key => tileBiomeTexture(key) === 'shallow-seas');
const tundraKey = board.tundra[0].join(',');
const oceanKey = board.ocean[0].join(',');
assert(!canFoundCity({ tile: mountainKey.split(',').map(Number) }), 'city cannot be founded on mountains');
assert(!canFoundCity({ tile: desertKey.split(',').map(Number) }), 'city cannot be founded in desert');
assert(!canFoundCity({ tile: shallowSeaKey.split(',').map(Number) }), 'city cannot be founded in shallow seas');
assert(!canFoundCity({ tile: tundraKey.split(',').map(Number) }), 'city cannot be founded on tundra');
assert(!canFoundCity({ tile: oceanKey.split(',').map(Number) }), 'city cannot be founded in ocean');
const shallowSeaCluster = tileClusterLookup.get(shallowSeaKey);
const landCluster = board.groups.findIndex(group => !['mountains', 'desert', 'shallow-seas'].includes(BIOMES[group.biome].texture));
const seaTraveler = spawnExplorer(0, landCluster, board.groups[landCluster].tiles[0]);
assert(moveExplorer(seaTraveler, shallowSeaCluster, shallowSeaKey.split(',').map(Number)), 'Explorer can still move through shallow seas');
assert(!canFoundCity(seaTraveler), 'Explorer in shallow seas cannot found a city');
revealedClusters.clear(); identifiedClusters.clear();
enterClaimedTile(tundraKey);
assertClaimHasNoUnknownNeighborBiomes(tundraKey, 'a claimed tundra tile identifies neighboring playable biomes');
resetGame(GAME_SETTINGS.seed);

let foundingCluster = -1, foundingTile = null;
board.groups.some((group, cluster) => group.tiles.some((tile, tileIndex) => {
  const texture = BIOMES[group.biome].texture;
  if (!['mountains', 'desert'].includes(texture) && resourceAllocations[cluster][tileIndex].resource) {
    foundingCluster = cluster; foundingTile = tile; return true;
  }
  return false;
}));
assert(foundingCluster >= 0, 'board contains an eligible resourced city site');
const founder = spawnExplorer(1, foundingCluster, foundingTile);
const cityTile = [...founder.tile];
const foundingResource = tileResource(cityTile.join(','));
const expectedClaims = neighboringTileKeys(cityTile, true);
const cityAdjacentBiomes = adjacentBiomeClusters(cityTile);
const foundingMarker = renderResourceMarker(foundingResource, cityTile);
assert(renderGameMap().includes(foundingMarker), 'resource marker is visible before founding');
assert(foundCity(), 'Explorer can found a city');
const city = cities[0];
assert(units.length === 0 && selectedUnitId === null, 'founding consumes the selected Explorer');
assert(cities.length === 1 && city.tile.join(',') === cityTile.join(',') && city.owner === 1, 'city remains on founding tile for correct player');
assert(territory.size === expectedClaims.length && expectedClaims.every(key => territory.get(key) === 1), 'city claims center and unclaimed adjacent tiles');
assert(city.claimed.size === territory.size && [...city.claimed].every(key => territoryCity.get(key) === city.id), 'claims are tracked to their city');
assert(city.consumedResource === foundingResource && consumedResources.has(cityTile.join(',')), 'founding consumes the resource on the city tile');
assert([...cityAdjacentBiomes].every(cluster => revealedClusters.has(cluster)), 'founding reveals biomes occupied by adjacent city claims');
city.claimed.forEach(key => assertClaimHasNoUnknownNeighborBiomes(key, 'no biome beside founded city territory remains unknown'));
assert(walls.size === 6 && [...walls.values()].every(records => records.length === 1 && records[0].automatic), 'founding creates six automatic walls');
const cityRendered = renderGameMap();
assert(!cityRendered.includes(foundingMarker), 'consumed resource marker disappears beneath the city');
assert(cityRendered.includes('class="city-marker city-medallion piece-selected"'), 'founded city medallion is rendered and selected');
assert(CITY_IMAGES.length === PLAYERS.length, 'every player has a city artwork variant');
assert(cityRendered.includes('assets/cities/city-green.png'), 'city medallion loads artwork for its owner');
assert(cityRendered.includes(`transform="translate(${cityTile[0] * dx} ${cityTile[1] * radius * 1.5})"`), 'city medallion is centered on its tile');
assert(!cityRendered.includes('M -7 5 V -4'), 'legacy line-drawn city symbol is absent');
assert(cityRendered.includes('class="game-territory"') && cityRendered.includes('class="game-walls"'), 'territory and walls render');
assert((cityRendered.match(/class="territory-band"/g) || []).length === territory.size, 'each claimed tile receives a band');
assert((cityRendered.match(/class="territory-gridline"/g) || []).length === territory.size, 'grid lines redraw above territory');
assert(cityRendered.includes(`fill-opacity="${BOARD_CONFIG.appearance.gameTerritoryOpacity / 100}"`) && cityRendered.includes('fill-rule="evenodd"'), 'territory uses configured opacity with a clear center');
const firstCityWall = [...walls.values()][0][0];
const untrimmedWallStart = edgeRecord(firstCityWall.tile, firstCityWall.edgeIndex).a.join(' ');
assert(!renderWalls().includes(`M ${untrimmedWallStart}`), 'wall segments stop short of shared hex corners');

let expansionSource = null, expansionTarget = null;
for (const key of boardTileKeys) {
  if (['mountains', 'desert'].includes(tileBiomeTexture(key))) continue;
  const target = neighboringTileKeys(key.split(',').map(Number))[0];
  if (target) { expansionSource = key; expansionTarget = target; break; }
}
assert(expansionSource && expansionTarget, 'board has an eligible source and connected expansion tile');
territory.clear(); territoryCity.clear();
const growthCity = { id: 800, owner: 2, tile: expansionSource.split(',').map(Number), claimed: new Set([expansionSource]) };
territory.set(expansionSource, growthCity.owner); territoryCity.set(expansionSource, growthCity.id);
assert(expandCityTo(growthCity, expansionTarget.split(',').map(Number)), 'city expands through eligible territory');
assert(territory.get(expansionTarget) === growthCity.owner && territoryCity.get(expansionTarget) === growthCity.id, 'expanded tile belongs to correct player and city');
assertClaimHasNoUnknownNeighborBiomes(expansionTarget, 'a new city claim reveals its biome and identifies neighboring biome types');
assert(!expandCityTo(growthCity, expansionTarget.split(',').map(Number)), 'claimed tile cannot be claimed again');

let blockedSource = null, blockedTarget = null;
for (const group of board.groups) {
  for (const tile of group.tiles) {
    const source = tile.join(',');
    if (!['mountains', 'desert'].includes(tileBiomeTexture(source))) continue;
    const target = neighboringTileKeys(tile)[0];
    if (target) { blockedSource = source; blockedTarget = target; break; }
  }
  if (blockedSource) break;
}
assert(blockedSource && blockedTarget, 'board contains a mountain or desert claim with a neighbor');
territory.clear(); territoryCity.clear();
const blockedCity = { id: 900, owner: 0, tile: blockedSource.split(',').map(Number), claimed: new Set([blockedSource]) };
territory.set(blockedSource, 0); territoryCity.set(blockedSource, blockedCity.id);
assert(!expandCityTo(blockedCity, blockedTarget.split(',').map(Number)), 'mountain and desert claims cannot serve as stepping stones');

walls.clear(); territory.clear(); territoryCity.clear();
let wallTile = null, wallNeighbor = null, wallEdge = -1;
for (const key of boardTileKeys) {
  const tile = key.split(',').map(Number);
  const edge = EDGE_NEIGHBORS.findIndex((unused, index) => boardTileKeys.has(wallNeighborKey(tile, index)));
  if (edge >= 0) { wallTile = tile; wallEdge = edge; wallNeighbor = wallNeighborKey(tile, edge); break; }
}
assert(wallTile && wallNeighbor, 'board contains a shared edge');
territory.set(wallTile.join(','), 0); territory.set(wallNeighbor, 1);
assert(toggleWall(0, wallTile, wallEdge), 'first player can build on owned exterior edge');
const oppositeEdge = (wallEdge + 3) % 6;
assert(toggleWall(1, wallNeighbor.split(',').map(Number), oppositeEdge), 'opponent can wall same boundary');
assert(walls.size === 1 && [...walls.values()][0].length === 2, 'opposing walls share one boundary record');
const doubleWalls = renderWalls();
assert((doubleWalls.match(/class="wall" data-owner=/g) || []).length === 2, 'opposing walls render as two inset lines');
assert(doubleWalls.includes(PLAYERS[0].color) && doubleWalls.includes(PLAYERS[1].color), 'both wall owners render');
walls.clear(); territory.set(wallNeighbor, 0);
assert(!toggleWall(0, wallTile, wallEdge), 'player cannot wall between own tiles');
walls.clear(); territory.set(wallNeighbor, 1); addWall(0, wallTile, wallEdge, true, 77);
assert(!toggleWall(0, wallTile, wallEdge), 'automatic city walls cannot be removed');
print('PASS: hidden map, resources, four-player Explorers, city growth, territory, and walls');

assert(JSON.stringify(board.counts) === '[15,12,5,15,8,5]', 'game uses shared biome baseline');
const savedColumns = BOARD_CONFIG.board.columns;
const savedGrasslands = BOARD_CONFIG.biomeWeights.grasslands;
BOARD_CONFIG.board.columns = 12; BOARD_CONFIG.biomeWeights.grasslands = 20;
const updatedDefaults = defaultMapSettings();
assert(updatedDefaults.columns === 12 && updatedDefaults.weights[0] === 20, 'config changes reach generator settings');
updatedDefaults.weights[0] = 99;
assert(BOARD_CONFIG.biomeWeights.grasslands === 20, 'settings do not mutate shared config');
BOARD_CONFIG.board.columns = savedColumns; BOARD_CONFIG.biomeWeights.grasslands = savedGrasslands;
print('PASS: shared config baseline, propagation, mutation isolation');
