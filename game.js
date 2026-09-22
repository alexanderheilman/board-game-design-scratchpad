"use strict";

const GAME_SETTINGS = defaultMapSettings();

let board = generateMap(GAME_SETTINGS);
const revealedClusters = new Set();
const identifiedClusters = new Set();
const territory = new Map();
const territoryCity = new Map();
const consumedResources = new Set();
const units = [];
const cities = [];
const walls = new Map();
let nextUnitId = 1;
let nextCityId = 1;
let activePlayer = 0;
let selectedUnitId = null;
let selectedCityId = null;
let activeTool = null;
let feedback = '';

const RESOURCE_NAMES = {
  food: 'Food',
  lumber: 'Lumber',
  stone: 'Stone',
  iron: 'Iron',
  gold: 'Gold',
};

const RESOURCE_IMAGES = {
  food: 'assets/resources/food.png',
  lumber: 'assets/resources/lumber.png',
  stone: 'assets/resources/stone.png',
  iron: 'assets/resources/iron.png',
  gold: 'assets/resources/gold.png',
};
const CITY_IMAGES = [
  'assets/cities/city-red.png',
  'assets/cities/city-green.png',
  'assets/cities/city-blue.png',
  'assets/cities/city-yellow.png',
];

const PLAYER_TOKEN_OFFSET_Y = 19;
const PLAYER_TOKEN_RADIUS = 9;

function renderResourceMarker(resource, tile) {
  const transform = `translate(${tile[0] * dx} ${tile[1] * radius * 1.5})`;
  const name = RESOURCE_NAMES[resource];
  return `<g class="resource-marker resource-medallion" data-resource="${resource}" transform="${transform}" aria-label="${name} resource"><circle r="13" fill="#f8f7f3" stroke="#28343c" stroke-width="2.5"/><image href="${RESOURCE_IMAGES[resource]}" x="-10.5" y="-10.5" width="21" height="21" preserveAspectRatio="xMidYMid meet" pointer-events="none"/></g>`;
}

function generateResourceAllocations(currentBoard) {
  const random = seededRandom((currentBoard.seed ^ 0xA511E9B3) >>> 0);
  return currentBoard.groups.map(group => {
    const biome = BIOMES[group.biome];
    const dice = BOARD_CONFIG.resourceDice[biome.texture];
    if (!dice || dice.length !== 3 || dice.some(die => !Array.isArray(die) || die.length !== 6)) {
      throw new Error(`Resource dice for ${biome.name} must contain three six-face tables.`);
    }
    if (dice.some(die => die.some(resource => resource !== null && !RESOURCE_NAMES[resource]))) {
      throw new Error(`Resource dice for ${biome.name} contain an unknown resource.`);
    }
    const assignment = [0, 1, 2];
    for (let i = assignment.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [assignment[i], assignment[j]] = [assignment[j], assignment[i]];
    }
    return assignment.map(die => {
      const face = Math.floor(random() * 6);
      return { die, face, resource: dice[die][face] };
    });
  });
}

let resourceAllocations = generateResourceAllocations(board);

const HEX_NEIGHBORS = [[-2, 0], [2, 0], [-1, -1], [1, -1], [-1, 1], [1, 1]];
const EDGE_NEIGHBORS = [[2, 0], [1, 1], [-1, 1], [-2, 0], [-1, -1], [1, -1]];

function buildClusterAdjacency(groups) {
  const tileClusters = new Map();
  groups.forEach((group, cluster) => {
    group.tiles.forEach(tile => tileClusters.set(tile.join(','), cluster));
  });
  return groups.map((group, cluster) => {
    const adjacent = new Set();
    for (const [x, row] of group.tiles) {
      for (const [offsetX, offsetRow] of HEX_NEIGHBORS) {
        const neighbor = tileClusters.get(`${x + offsetX},${row + offsetRow}`);
        if (neighbor !== undefined && neighbor !== cluster) adjacent.add(neighbor);
      }
    }
    return adjacent;
  });
}

let clusterAdjacency = buildClusterAdjacency(board.groups);

function buildBoardTileKeys(currentBoard) {
  return new Set(currentBoard.groups.flatMap(group => group.tiles)
    .concat(currentBoard.tundra, currentBoard.ocean)
    .map(tile => tile.join(',')));
}

let boardTileKeys = buildBoardTileKeys(board);

function buildTileClusterLookup(groups) {
  const lookup = new Map();
  groups.forEach((group, cluster) => group.tiles.forEach(tile => lookup.set(tile.join(','), cluster)));
  return lookup;
}

let tileClusterLookup = buildTileClusterLookup(board.groups);

function neighboringTileKeys(tile, includeCenter = false) {
  const [x, row] = tile;
  const keys = HEX_NEIGHBORS.map(([offsetX, offsetRow]) => `${x + offsetX},${row + offsetRow}`)
    .filter(key => boardTileKeys.has(key));
  if (includeCenter && boardTileKeys.has(tile.join(','))) keys.unshift(tile.join(','));
  return keys;
}

function adjacentBiomeClusters(tile) {
  if (!tile) return new Set();
  const clusters = new Set();
  const centerCluster = tileClusterLookup.get(tile.join(','));
  neighboringTileKeys(tile).forEach(key => {
    const cluster = tileClusterLookup.get(key);
    if (cluster !== undefined && cluster !== centerCluster) clusters.add(cluster);
  });
  return clusters;
}

function revealBiomesAroundTile(tile) {
  let count = 0;
  for (const adjacent of adjacentBiomeClusters(tile)) {
    if (!revealedClusters.has(adjacent)) count++;
    revealedClusters.add(adjacent);
    identifiedClusters.delete(adjacent);
  }
  return count;
}

function revealEnteredCluster(cluster) {
  revealedClusters.add(cluster);
  identifiedClusters.delete(cluster);
  for (const adjacent of clusterAdjacency[cluster]) {
    if (!revealedClusters.has(adjacent)) identifiedClusters.add(adjacent);
  }
}

function enterClaimedTile(key) {
  const cluster = tileClusterLookup.get(key);
  if (cluster !== undefined) {
    revealEnteredCluster(cluster);
    return;
  }
  neighboringTileKeys(key.split(',').map(Number)).forEach(neighbor => {
    const adjacent = tileClusterLookup.get(neighbor);
    if (adjacent !== undefined && !revealedClusters.has(adjacent)) identifiedClusters.add(adjacent);
  });
}

function selectedUnit() {
  return units.find(unit => unit.id === selectedUnitId) || null;
}

function selectedCity() {
  return cities.find(city => city.id === selectedCityId) || null;
}

function spawnExplorer(owner, cluster, tile) {
  const unit = { id: nextUnitId++, owner, type: 'explorer', cluster, tile: [...tile] };
  units.push(unit);
  selectedUnitId = unit.id;
  selectedCityId = null;
  activePlayer = owner;
  revealEnteredCluster(cluster);
  return unit;
}

function moveExplorer(unit, cluster, tile) {
  if (!unit) return false;
  unit.cluster = cluster;
  unit.tile = [...tile];
  revealEnteredCluster(cluster);
  return true;
}

function performRevealAction() {
  const unit = selectedUnit();
  if (!unit) return false;
  revealBiomesAroundTile(unit.tile);
  if (typeof document !== 'undefined') redrawGame();
  return true;
}

function canFoundCity(unit) {
  if (!unit) return false;
  const key = unit.tile.join(',');
  return !territory.has(key) && !['mountains', 'desert', 'shallow-seas', 'tundra', 'ocean'].includes(tileBiomeTexture(key));
}

function tileResource(key) {
  const cluster = tileClusterLookup.get(key);
  if (cluster === undefined) return null;
  const tileIndex = board.groups[cluster].tiles.findIndex(tile => tile.join(',') === key);
  return tileIndex < 0 ? null : resourceAllocations[cluster][tileIndex].resource;
}

function foundCity() {
  const unit = selectedUnit();
  if (!canFoundCity(unit)) return false;
  const cityKey = unit.tile.join(',');
  const consumedResource = tileResource(cityKey);
  if (consumedResource) consumedResources.add(cityKey);
  const city = { id: nextCityId++, owner: unit.owner, tile: [...unit.tile], claimed: new Set(), consumedResource };
  neighboringTileKeys(unit.tile, true).forEach(key => {
    if (territory.has(key)) return;
    territory.set(key, unit.owner);
    territoryCity.set(key, city.id);
    city.claimed.add(key);
  });
  city.claimed.forEach(enterClaimedTile);
  cities.push(city);
  addCityWalls(city);
  units.splice(units.findIndex(candidate => candidate.id === unit.id), 1);
  selectedUnitId = null;
  selectedCityId = city.id;
  activePlayer = city.owner;
  activeTool = null;
  if (typeof document !== 'undefined') redrawGame();
  return true;
}

function pointsAttribute(points) {
  return points.map(point => point.join(',')).join(' ');
}

function clusterBounds(tiles) {
  const points = tiles.flatMap(vertices);
  const xs = points.map(point => point[0]);
  const ys = points.map(point => point[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return {
    x,
    y,
    width: Math.max(...xs) - x,
    height: Math.max(...ys) - y,
  };
}

function boundaryPath(tiles) {
  const edges = new Map();
  for (const tile of tiles) {
    const points = vertices(tile);
    points.forEach((a, index) => {
      const b = points[(index + 1) % points.length];
      const key = [a.join(','), b.join(',')].sort().join('|');
      if (edges.has(key)) edges.delete(key);
      else edges.set(key, [a, b]);
    });
  }
  return [...edges.values()].map(([a, b]) => `M ${a.join(' ')} L ${b.join(' ')}`).join(' ');
}

function renderTerritoryBands(claims) {
  const innerRadius = 19;
  const parts = [];
  for (const [key, owner] of claims) {
    const tile = key.split(',').map(Number);
    const [cx, cy] = [tile[0] * dx, tile[1] * radius * 1.5];
    const outer = vertices(tile);
    const path = `M ${outer.map(point => point.join(' ')).join(' L ')} Z M ${cx + innerRadius} ${cy} A ${innerRadius} ${innerRadius} 0 1 0 ${cx - innerRadius} ${cy} A ${innerRadius} ${innerRadius} 0 1 0 ${cx + innerRadius} ${cy} Z`;
    parts.push(`<path class="territory-band" data-owner="${owner}" d="${path}" fill="${PLAYERS[owner].color}" fill-opacity="${BOARD_CONFIG.appearance.gameTerritoryOpacity / 100}" fill-rule="evenodd"/>`);
    parts.push(`<polygon class="territory-gridline" points="${pointsAttribute(outer)}" fill="none" stroke="#34424c" stroke-opacity=".65" stroke-width="1.2"/>`);
  }
  return parts.join('');
}

function tileBiomeTexture(key) {
  const cluster = tileClusterLookup.get(key);
  if (cluster !== undefined) return BIOMES[board.groups[cluster].biome].texture;
  if (board.tundra.some(tile => tile.join(',') === key)) return 'tundra';
  if (board.ocean.some(tile => tile.join(',') === key)) return 'ocean';
  return null;
}

function tileDistance(startKey, targetKey, limit = 2) {
  if (startKey === targetKey) return 0;
  let frontier = new Set([startKey]);
  const visited = new Set(frontier);
  for (let distance = 1; distance <= limit; distance++) {
    const next = new Set();
    for (const key of frontier) {
      const tile = key.split(',').map(Number);
      for (const neighbor of neighboringTileKeys(tile)) {
        if (neighbor === targetKey) return distance;
        if (!visited.has(neighbor)) { visited.add(neighbor); next.add(neighbor); }
      }
    }
    frontier = next;
  }
  return Infinity;
}

function expandCityTo(city, tile) {
  if (!city) return false;
  const key = tile.join(',');
  if (!boardTileKeys.has(key) || territory.has(key) || tileDistance(city.tile.join(','), key, 2) > 2) return false;
  const connected = neighboringTileKeys(tile).some(source => {
    const texture = tileBiomeTexture(source);
    return city.claimed.has(source) && texture !== 'mountains' && texture !== 'desert';
  });
  if (!connected) return false;
  territory.set(key, city.owner);
  territoryCity.set(key, city.id);
  city.claimed.add(key);
  enterClaimedTile(key);
  return true;
}

function edgeRecord(tile, edgeIndex) {
  const points = vertices(tile);
  const a = points[edgeIndex], b = points[(edgeIndex + 1) % 6];
  const key = [a.join(','), b.join(',')].sort().join('|');
  return { key, a, b };
}

function wallNeighborKey(tile, edgeIndex) {
  const [offsetX, offsetRow] = EDGE_NEIGHBORS[edgeIndex];
  return `${tile[0] + offsetX},${tile[1] + offsetRow}`;
}

function addWall(owner, tile, edgeIndex, automatic = false, cityId = null) {
  const { key } = edgeRecord(tile, edgeIndex);
  const records = walls.get(key) || [];
  if (records.some(record => record.owner === owner)) return false;
  records.push({ owner, tile: [...tile], edgeIndex, automatic, cityId });
  walls.set(key, records);
  return true;
}

function addCityWalls(city) {
  for (let edgeIndex = 0; edgeIndex < 6; edgeIndex++) addWall(city.owner, city.tile, edgeIndex, true, city.id);
}

function toggleWall(owner, tile, edgeIndex) {
  const tileKey = tile.join(',');
  if (territory.get(tileKey) !== owner) return false;
  const { key } = edgeRecord(tile, edgeIndex);
  const records = walls.get(key) || [];
  const ownIndex = records.findIndex(record => record.owner === owner);
  if (ownIndex >= 0) {
    if (records[ownIndex].automatic) return false;
    records.splice(ownIndex, 1);
    if (records.length) walls.set(key, records); else walls.delete(key);
    return true;
  }
  if (territory.get(wallNeighborKey(tile, edgeIndex)) === owner) return false;
  return addWall(owner, tile, edgeIndex);
}

function renderWalls() {
  const parts = [];
  for (const records of walls.values()) {
    for (const record of records) {
      let { a, b } = edgeRecord(record.tile, record.edgeIndex);
      if (records.length > 1) {
        const center = [record.tile[0] * dx, record.tile[1] * radius * 1.5];
        const midpoint = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        const vector = [center[0] - midpoint[0], center[1] - midpoint[1]];
        const length = Math.hypot(...vector);
        const inset = vector.map(value => value / length * 4);
        a = [a[0] + inset[0], a[1] + inset[1]];
        b = [b[0] + inset[0], b[1] + inset[1]];
      }
      const edgeVector = [b[0] - a[0], b[1] - a[1]];
      const edgeLength = Math.hypot(...edgeVector);
      const endGap = 5;
      const trim = edgeVector.map(value => value / edgeLength * endGap);
      a = [a[0] + trim[0], a[1] + trim[1]];
      b = [b[0] - trim[0], b[1] - trim[1]];
      const d = `M ${a.join(' ')} L ${b.join(' ')}`;
      parts.push(`<path class="wall wall-underlay" d="${d}" stroke="#28343c" stroke-width="6"/><path class="wall" data-owner="${record.owner}" d="${d}" stroke="${PLAYERS[record.owner].color}" stroke-width="3.5"/>`);
    }
  }
  return parts.join('');
}

function renderBorderTile(tile, biome) {
  const points = pointsAttribute(vertices(tile));
  return `<polygon points="${points}" fill="url(#game-terrain-${biome.texture})"><title>${biome.name}</title></polygon><polygon class="art-flatten art-flatten--static" points="${points}"/><polygon points="${points}" fill="none" stroke="#34424c" stroke-opacity=".4" stroke-width="1" pointer-events="none"/><polygon data-tile="${tile.join(',')}" data-static-tile="true" points="${points}" fill="transparent" stroke="transparent"/>`;
}

function renderGameMap() {
  const width = (board.columns * 3 + 3) * dx + 2 * dx + 24;
  const height = (board.bands * 2 + 1) * radius * 1.5 + radius * 2 + 24;
  const parts = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-3 * dx - 12} ${-radius * 2.5 - 12} ${width} ${height}" role="img" aria-labelledby="game-map-title"><title id="game-map-title">Interactive board with hidden, identified, and entered biomes</title>`];
  const textures = [...BIOMES, { name: 'Tundra', texture: 'tundra', color: '#ffffff' }, { name: 'Ocean', texture: 'ocean', color: '#245084' }];

  parts.push('<defs>');
  for (const { texture, color } of textures) {
    parts.push(`<pattern id="game-terrain-${texture}" width="1" height="1" patternUnits="objectBoundingBox" viewBox="0 0 ${2 * dx} ${2 * radius}" preserveAspectRatio="none"><rect width="${2 * dx}" height="${2 * radius}" fill="${color}"/><image href="assets/biomes/terrain/${texture}.png" x="${dx - radius}" y="0" width="${2 * radius}" height="${2 * radius}" preserveAspectRatio="xMidYMid slice"/></pattern>`);
  }
  board.groups.forEach((group, index) => {
    parts.push(`<clipPath id="scenic-cluster-${index}" clipPathUnits="userSpaceOnUse">${group.tiles.map(tile => `<polygon points="${pointsAttribute(vertices(tile))}"/>`).join('')}</clipPath>`);
  });
  parts.push('</defs>');

  board.groups.forEach((group, index) => {
    const biome = BIOMES[group.biome];
    if (revealedClusters.has(index)) {
      group.tiles.forEach((tile, tileIndex) => {
        const points = pointsAttribute(vertices(tile));
        const allocation = resourceAllocations[index][tileIndex];
        const resource = allocation.resource;
        const resourceTitle = resource ? ` · ${RESOURCE_NAMES[resource]} resource` : ' · No resource';
        parts.push(`<polygon points="${points}" fill="url(#game-terrain-${biome.texture})"><title>${biome.name} — revealed${resourceTitle}</title></polygon><polygon class="art-flatten art-flatten--terrain" points="${points}"/><polygon points="${points}" fill="none" stroke="#34424c" stroke-opacity=".4" stroke-width="1" pointer-events="none"/>`);
        if (resource && !consumedResources.has(tile.join(','))) parts.push(renderResourceMarker(resource, tile));
      });
    } else if (identifiedClusters.has(index)) {
      const bounds = clusterBounds(group.tiles);
      parts.push(`<image href="assets/biomes/scenic/${biome.texture}.png" x="${bounds.x}" y="${bounds.y}" width="${bounds.width}" height="${bounds.height}" preserveAspectRatio="xMidYMid slice" clip-path="url(#scenic-cluster-${index})"/>`);
      group.tiles.forEach(tile => {
        const points = pointsAttribute(vertices(tile));
        parts.push(`<polygon class="art-flatten art-flatten--scenic" points="${points}"/><polygon points="${points}" fill="none" stroke="#34424c" stroke-opacity=".4" stroke-width="1" pointer-events="none"><title>${biome.name} biome — identified</title></polygon>`);
      });
    } else {
      group.tiles.forEach(tile => {
        const points = pointsAttribute(vertices(tile));
        parts.push(`<polygon class="cluster-hidden" points="${points}"><title>Hidden biome</title></polygon><polygon class="art-flatten art-flatten--hidden" points="${points}"/><polygon points="${points}" fill="none" stroke="#34424c" stroke-opacity=".4" stroke-width="1" pointer-events="none"/>`);
      });
    }
    parts.push(`<path d="${boundaryPath(group.tiles)}" fill="none" stroke="#34424c" stroke-width="2.8" stroke-linecap="round" pointer-events="none"/>`);
    const label = revealedClusters.has(index) || identifiedClusters.has(index) ? `Enter ${biome.name} biome` : 'Enter hidden biome';
    group.tiles.forEach(tile => parts.push(`<polygon data-cluster="${index}" data-tile="${tile.join(',')}" points="${pointsAttribute(vertices(tile))}" fill="transparent" stroke="transparent" aria-label="${label}"/>`));
  });

  const tundra = { name: 'Tundra', texture: 'tundra' };
  const ocean = { name: 'Ocean', texture: 'ocean' };
  board.tundra.forEach(tile => parts.push(renderBorderTile(tile, tundra)));
  board.ocean.forEach(tile => parts.push(renderBorderTile(tile, ocean)));

  if (territory.size) parts.push(`<g class="game-territory" pointer-events="none">${renderTerritoryBands(territory)}</g>`);
  if (walls.size) parts.push(`<g class="game-walls">${renderWalls()}</g>`);

  for (const city of cities) {
    const [x, row] = city.tile;
    const cx = x * dx, cy = row * radius * 1.5;
    const selected = city.id === selectedCityId ? ' piece-selected' : '';
    parts.push(`<g class="city-marker city-medallion${selected}" data-city="${city.id}" data-owner="${city.owner}" transform="translate(${cx} ${cy})" aria-label="${PLAYERS[city.owner].name} city"><circle r="15" fill="#f8f7f3" stroke="#28343c" stroke-width="2.5"/><image href="${CITY_IMAGES[city.owner]}" x="-12.5" y="-12.5" width="25" height="25" preserveAspectRatio="xMidYMid meet" pointer-events="none"/></g>`);
  }

  for (const unit of units) {
    const [x, row] = unit.tile;
    const stack = units.filter(candidate => candidate.tile.join(',') === unit.tile.join(','));
    const stackIndex = stack.findIndex(candidate => candidate.id === unit.id);
    const offsetX = (stackIndex - (stack.length - 1) / 2) * 8;
    const cx = x * dx + offsetX, cy = row * radius * 1.5;
    const selected = unit.id === selectedUnitId ? ' piece-selected' : '';
    parts.push(`<g class="player-token${selected}" data-unit="${unit.id}" transform="translate(${cx} ${cy + PLAYER_TOKEN_OFFSET_Y})" aria-label="${PLAYERS[unit.owner].name} Explorer"><circle r="${PLAYER_TOKEN_RADIUS}" fill="#f8f7f3" stroke="#28343c" stroke-width="2.5"/><circle r="5.5" fill="${PLAYERS[unit.owner].color}"/><circle cy="-1.8" r="1.8" fill="#f8f7f3"/><path d="M -3.2 3.6 Q 0 -1 3.2 3.6" fill="none" stroke="#f8f7f3" stroke-width="1.8" stroke-linecap="round"/></g>`);
  }
  parts.push('</svg>');
  return parts.join('');
}

function redrawGame() {
  document.querySelector('#game-map').innerHTML = renderGameMap();
  const status = document.querySelector('#game-status');
  status.textContent = `${units.length} Explorers · ${cities.length} cities · ${territory.size} claimed tiles · ${revealedClusters.size} revealed biomes.`;
  const revealButton = document.querySelector('#reveal-adjacent');
  const foundButton = document.querySelector('#found-city');
  const expandButton = document.querySelector('#expand-city');
  const unit = selectedUnit(), city = selectedCity();
  revealButton.disabled = !unit || [...adjacentBiomeClusters(unit.tile)].every(cluster => revealedClusters.has(cluster));
  foundButton.disabled = !canFoundCity(unit);
  expandButton.disabled = !city;
  document.querySelector('#cancel-tool').disabled = !activeTool;
  document.querySelectorAll('.explorer-actions button').forEach(button => button.classList.toggle('tool-active', button.id === `${activeTool}-explorer` || button.id === activeTool));
  document.querySelectorAll('#game-player-tools button').forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.player) === activePlayer)));
  const toolStatus = document.querySelector('#tool-status');
  const selection = unit ? `${PLAYERS[unit.owner].name} Explorer selected.` : city ? `${PLAYERS[city.owner].name} city selected.` : 'No piece selected.';
  const toolText = activeTool === 'spawn' ? ' Click a playable tile to spawn.' : activeTool === 'expand-city' ? ' Click a valid expansion tile.' : activeTool === 'build-wall' ? ' Click near a territory edge.' : '';
  toolStatus.textContent = feedback || selection + toolText;
}

function resetGame(seed) {
  board = generateMap({ ...GAME_SETTINGS, seed });
  clusterAdjacency = buildClusterAdjacency(board.groups);
  boardTileKeys = buildBoardTileKeys(board);
  tileClusterLookup = buildTileClusterLookup(board.groups);
  resourceAllocations = generateResourceAllocations(board);
  revealedClusters.clear();
  identifiedClusters.clear();
  territory.clear();
  territoryCity.clear();
  consumedResources.clear();
  units.length = 0;
  cities.length = 0;
  walls.clear();
  nextUnitId = 1;
  nextCityId = 1;
  activePlayer = 0;
  selectedUnitId = null;
  selectedCityId = null;
  activeTool = null;
  feedback = '';
  if (typeof document !== 'undefined') redrawGame();
}

function pointSegmentDistance(point, a, b) {
  const lengthSquared = (b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2;
  const t = Math.max(0, Math.min(1, ((point[0] - a[0]) * (b[0] - a[0]) + (point[1] - a[1]) * (b[1] - a[1])) / lengthSquared));
  const projection = [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];
  return Math.hypot(point[0] - projection[0], point[1] - projection[1]);
}

function nearestEdgeIndex(tile, point) {
  const points = vertices(tile);
  let nearest = 0, distance = Infinity;
  points.forEach((a, index) => {
    const candidate = pointSegmentDistance(point, a, points[(index + 1) % 6]);
    if (candidate < distance) { nearest = index; distance = candidate; }
  });
  return nearest;
}

if (typeof document !== 'undefined') {
  const mapElement = document.querySelector('#game-map');
  const seedInput = document.querySelector('#game-seed');
  const playerTools = document.querySelector('#game-player-tools');
  seedInput.value = board.seed;
  playerTools.innerHTML = PLAYERS.map((player, index) => `<button type="button" data-player="${index}" aria-pressed="${index === activePlayer}"><span class="swatch" style="background:${player.color}"></span>${player.name}</button>`).join('');
  mapElement.style.setProperty('--scenic-flatten', BOARD_CONFIG.appearance.gameFlatten / 100);
  mapElement.style.setProperty('--terrain-flatten', BOARD_CONFIG.appearance.gameTerrainFlatten / 100);
  mapElement.addEventListener('click', event => {
    feedback = '';
    const unitElement = event.target.closest('[data-unit]');
    if (unitElement) {
      selectedUnitId = Number(unitElement.dataset.unit);
      selectedCityId = null;
      activePlayer = selectedUnit().owner;
      activeTool = null;
      redrawGame();
      return;
    }
    const cityElement = event.target.closest('[data-city]');
    if (cityElement) {
      selectedCityId = Number(cityElement.dataset.city);
      selectedUnitId = null;
      activePlayer = selectedCity().owner;
      activeTool = null;
      redrawGame();
      return;
    }
    const tileElement = event.target.closest('[data-tile]');
    if (!tileElement) return;
    const tile = tileElement.dataset.tile.split(',').map(Number);
    const cluster = tileClusterLookup.get(tileElement.dataset.tile);
    if (activeTool === 'spawn') {
      if (cluster === undefined) feedback = 'Explorers must spawn on a playable biome tile.';
      else { spawnExplorer(activePlayer, cluster, tile); activeTool = null; }
    } else if (activeTool === 'expand-city') {
      const city = selectedCity();
      if (!city || city.owner !== activePlayer || !expandCityTo(city, tile)) feedback = 'That tile is not a valid connected expansion for the selected city.';
    } else if (activeTool === 'build-wall') {
      const svg = mapElement.querySelector('svg');
      const svgPoint = svg.createSVGPoint();
      svgPoint.x = event.clientX; svgPoint.y = event.clientY;
      const local = svgPoint.matrixTransform(svg.getScreenCTM().inverse());
      const edgeIndex = nearestEdgeIndex(tile, [local.x, local.y]);
      if (!toggleWall(activePlayer, tile, edgeIndex)) feedback = 'That wall cannot be changed for the active player.';
    } else {
      const unit = selectedUnit();
      if (unit && cluster !== undefined) moveExplorer(unit, cluster, tile);
      else feedback = 'Select or spawn an Explorer, choose a city action, or activate the wall tool.';
    }
    redrawGame();
  });

  document.querySelector('#reveal-adjacent').addEventListener('click', performRevealAction);
  document.querySelector('#found-city').addEventListener('click', foundCity);
  document.querySelector('#spawn-explorer').addEventListener('click', () => { activeTool = 'spawn'; selectedUnitId = null; selectedCityId = null; feedback = ''; redrawGame(); });
  document.querySelector('#expand-city').addEventListener('click', () => { activeTool = 'expand-city'; feedback = ''; redrawGame(); });
  document.querySelector('#build-wall').addEventListener('click', () => { activeTool = 'build-wall'; feedback = ''; redrawGame(); });
  document.querySelector('#cancel-tool').addEventListener('click', () => { activeTool = null; feedback = ''; redrawGame(); });
  playerTools.addEventListener('click', event => {
    const button = event.target.closest('[data-player]');
    if (!button) return;
    activePlayer = Number(button.dataset.player);
    selectedUnitId = null; selectedCityId = null; feedback = '';
    redrawGame();
  });

  document.querySelector('#reset-game').addEventListener('click', () => {
    if (!seedInput.reportValidity()) return;
    resetGame(Number(seedInput.value));
  });

  redrawGame();
}
