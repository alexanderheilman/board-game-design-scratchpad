"use strict";
const BIOMES = [
  { name: "Grasslands", color: "#d7b34f", texture: "grasslands" },
  { name: "Hills", color: "#ba5342", texture: "hills" },
  { name: "Desert", color: "#ed8a28", texture: "desert" },
  { name: "Forest", color: "#287446", texture: "forest" },
  { name: "Shallow seas", color: "#589ed5", texture: "shallow-seas" },
  { name: "Mountains", color: "#a084cd", texture: "mountains" },
];

// Return a fresh settings object so prototype edits never mutate defaults.
function defaultMapSettings() {
  return {
    ...BOARD_CONFIG.board,
    weights: BIOMES.map(biome => BOARD_CONFIG.biomeWeights[biome.texture]),
  };
}

// A deterministic 32-bit generator makes settings + seed reproducible.
function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function generateMap({ columns, bands, seed, weights }) {
  if (!Number.isInteger(columns) || columns < 2 || columns > 40 || columns % 2 ||
      !Number.isInteger(bands) || bands < 1 || bands > 24 ||
      !Number.isInteger(seed) || seed < 0 || seed > 4294967295) {
    throw new Error("Enter an even width from 2–40, height from 1–24, and a valid seed.");
  }
  if (weights.length !== 6 || weights.some(w => !Number.isSafeInteger(w) || w < 0 || w > 1000000) || !weights.some(w => w > 0)) {
    throw new Error("Give at least one biome a weight above zero.");
  }
  const random = seededRandom(seed);
  const total = weights.reduce((a, b) => a + b, 0);
  const groups = [];
  // Largest remainders give a fixed whole-cluster inventory. Ties use biome
  // order, never the seed, so reshuffling cannot alter the inventory.
  const size = columns * bands;
  const counts = weights.map(w => Math.floor(size * w / total));
  const ranked = weights.map((w, i) => ({ i, remainder: (size * w) % total }))
    .sort((a, b) => b.remainder - a.remainder || a.i - b.i);
  const remaining = size - counts.reduce((a, b) => a + b, 0);
  for (let i = 0; i < remaining; i++) counts[ranked[i].i]++;
  const inventory = counts.flatMap((count, biome) => Array(count).fill(biome));
  for (let i = inventory.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [inventory[i], inventory[j]] = [inventory[j], inventory[i]];
  }
  for (let band = 0; band < bands; band++) {
    for (let column = 0; column < columns; column++) {
      const x = Math.floor(column / 2) * 6, row = band * 2;
      const tiles = column % 2 === 0
        ? [[x, row], [x + 2, row], [x + 1, row + 1]]
        : [[x + 4, row], [x + 3, row + 1], [x + 5, row + 1]];
      const biome = inventory[groups.length];
      groups.push({ biome, tiles });
    }
  }
  const tundra = [];
  for (let i = 0; i < columns / 2 * 3; i++) {
    tundra.push([2 * i + 1, -1], [2 * i, bands * 2]);
  }
  // One border hex per side per playable row; ocean continues through the corners.
  const ocean = [];
  for (let row = 0; row < bands * 2; row++) {
    ocean.push([row % 2 - 2, row], [columns * 3 + row % 2, row]);
  }
  ocean.push([-1, -1], [columns * 3 + 1, -1], [-2, bands * 2], [columns * 3, bands * 2]);
  return { groups, tundra, ocean, counts, columns, bands, seed };
}

const PLAYERS = [
  { name: "Red", color: "#ed1525" },
  { name: "Green", color: "#009b38" },
  { name: "Blue", color: "#124bff" },
  { name: "Yellow", color: "#ffdc00" },
];
const radius = 31, dx = Math.sqrt(3) * radius / 2;
function vertices([x, row]) {
  return Array.from({ length: 6 }, (_, i) => {
    const angle = Math.PI / 180 * (60 * i - 30);
    return [dx * x + radius * Math.cos(angle), row * radius * 1.5 + radius * Math.sin(angle)]
      .map(n => Number(n.toFixed(4)));
  });
}
function territoryEdges(territory, player) {
  const edges = new Map();
  for (const [key, owner] of territory) {
    if (owner !== player) continue;
    const points = vertices(key.split(',').map(Number));
    points.forEach((a, i) => {
      const b = points[(i + 1) % 6];
      const edge = [a.join(','), b.join(',')].sort().join('|');
      if (edges.has(edge)) edges.delete(edge); else edges.set(edge, [a, b]);
    });
  }
  return [...edges.values()];
}
function renderTerritory(territory) {
  const parts = [];
  for (const [key, owner] of territory) {
    const tile = key.split(',').map(Number);
    parts.push(`<polygon points="${vertices(tile).map(p => p.join(',')).join(' ')}" fill="white" style="fill-opacity:var(--territory-fade, ${BOARD_CONFIG.appearance.territoryFade / 100})"/>`);
    parts.push(`<circle cx="${tile[0] * dx}" cy="${tile[1] * radius * 1.5}" r="19" fill="none" stroke="#28343c" stroke-width="5"/><circle cx="${tile[0] * dx}" cy="${tile[1] * radius * 1.5}" r="19" fill="none" stroke="${PLAYERS[owner].color}" stroke-width="3.5"/>`);
  }
  PLAYERS.forEach((player, i) => {
    const d = territoryEdges(territory, i).map(([a,b]) => `M ${a.join(' ')} L ${b.join(' ')}`).join(' ');
    parts.push(`<path d="${d}" fill="none" stroke="#28343c" stroke-width="6" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="${player.color}" stroke-width="3.5" stroke-linejoin="round"/>`);
  });
  return parts.join('');
}

// Simple terrain marks, independent of artwork and biome color.
const BIOME_ICONS = {
  grasslands: 'M -11 10 Q -13 0 -10 -6 M -5 10 Q -8 -2 -4 -11 M 1 10 Q -2 -2 3 -10 M 7 10 Q 6 1 12 -4',
  hills: 'M -2 -2.7 Q 7 -15 13 9 M -13 9 Q -5 -15 4 9',
  desert: 'M 0 12 L 0 -11 M 0 3 L -6 3 Q -10 3 -10 -1 L -10 -6 M 0 -1 L 6 -1 Q 10 -1 10 -5 L 10 -9',
  forest: 'M 0 -12 L -8 -2 L -4 -2 L -11 7 L 11 7 L 4 -2 L 8 -2 Z M 0 7 L 0 12',
  'shallow-seas': 'M -12 -8 Q -8 -12 -4 -8 T 4 -8 T 12 -8 M -12 0 Q -8 -4 -4 0 T 4 0 T 12 0 M -12 8 Q -8 4 -4 8 T 4 8 T 12 8',
  mountains: 'M -12 10 L 0 -12 L 12 10 Z M -5 -3 L -1 0 L 2 -3 L 5 -3',
  tundra: 'M 0 -12 L 0 12 M -10 -6 L 10 6 M -10 6 L 10 -6 M -3 -9 L 0 -6 L 3 -9 M -3 9 L 0 6 L 3 9 M -9 -2 L -5 -3 L -6 -7 M 9 2 L 5 3 L 6 7 M -9 2 L -5 3 L -6 7 M 9 -2 L 5 -3 L 6 -7',
  ocean: 'M -13 7 Q -7 8 -4 0 C 0 -10 11 -9 10 -2 C 6 -5 3 0 7 4 Q 10 7 13 7',
};
function iconDefinitions() {
  return Object.entries(BIOME_ICONS).map(([name, path]) =>
    `<g id="biome-icon-${name}" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="${path}" stroke="#253641" stroke-opacity=".55" stroke-width="4.5"/><path d="${path}" stroke="white" stroke-width="2.8"/></g>`
  ).join('');
}

function renderMap(board) {
  const width = (board.columns * 3 + 3) * dx + 2 * dx + 24;
  const height = (board.bands * 2 + 1) * radius * 1.5 + radius * 2 + 24;
  const parts = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-3 * dx - 12} ${-radius * 2.5 - 12} ${width} ${height}" role="img" aria-labelledby="map-title"><title id="map-title">${board.columns} columns by ${board.bands} bands of triangular biome clusters with tundra and ocean borders</title>`];
  const textures = [...BIOMES, { texture: 'tundra', color: '#ffffff' }, { texture: 'ocean', color: '#245084' }];
  // Each polygon maps the same square artwork to its own bounds. A square
  // image is centered and cropped horizontally, preserving its proportions.
  parts.push('<defs>' + iconDefinitions() + textures.map(({ texture, color }) =>
    `<pattern id="terrain-${texture}" width="1" height="1" patternUnits="objectBoundingBox" viewBox="0 0 ${2 * dx} ${2 * radius}" preserveAspectRatio="none"><rect width="${2 * dx}" height="${2 * radius}" fill="${color}"/><image class="terrain-art" style="opacity:var(--artwork-strength, ${BOARD_CONFIG.appearance.artworkStrength / 100})" href="assets/biomes/terrain/${texture}.png" x="${dx - radius}" y="0" width="${2 * radius}" height="${2 * radius}" preserveAspectRatio="xMidYMid slice"/></pattern>`
  ).join('') + '</defs>');
  const outlines = [];
  const icons = [];
  for (const group of [...board.groups, { biome: -1, tiles: board.tundra }, { biome: -2, tiles: board.ocean }]) {
    const biome = group.biome === -2 ? { name: "Ocean", color: "#245084", texture: "ocean" } : group.biome === -1 ? { name: "Tundra", color: "#fff", texture: "tundra" } : BIOMES[group.biome];
    const edges = new Map();
    for (const tile of group.tiles) {
      const points = vertices(tile);
      icons.push(`<use href="#biome-icon-${biome.texture}" transform="translate(${tile[0] * dx} ${tile[1] * radius * 1.5})"/>`);
      parts.push(`<polygon data-tile="${tile.join(',')}" points="${points.map(p => p.join(',')).join(' ')}" fill="url(#terrain-${biome.texture}) ${biome.color}" stroke="#34424c" stroke-opacity=".4" stroke-width="1"><title>${biome.name}</title></polygon>`);
      points.forEach((a, i) => {
        const b = points[(i + 1) % 6];
        const key = [a.join(','), b.join(',')].sort().join('|');
        if (edges.has(key)) edges.delete(key); else edges.set(key, [a, b]);
      });
    }
    for (const [a, b] of edges.values()) outlines.push(`M ${a.join(' ')} L ${b.join(' ')}`);
  }
  parts.push(`<path d="${outlines.join(' ')}" fill="none" stroke="#34424c" stroke-width="2.8" stroke-linecap="round" pointer-events="none"/><g id="territory-overlay" pointer-events="none"></g><g class="biome-icons" pointer-events="none" aria-hidden="true">${icons.join('')}</g></svg>`);
  return parts.join('');
}

// The map studio owns the settings form. Other prototypes can load this file
// for the shared generator and geometry helpers without initializing the studio.
if (typeof document !== "undefined" && document.querySelector('#settings')) {
  const defaults = defaultMapSettings();
  for (const key of ['columns', 'bands', 'seed']) {
    document.querySelector(`#${key}`).value = defaults[key];
  }
  document.querySelector('#artwork-strength').value = BOARD_CONFIG.appearance.artworkStrength;
  document.querySelector('#territory-fade').value = BOARD_CONFIG.appearance.territoryFade;
  const artworkSlider = document.querySelector('#artwork-strength');
  function updateArtworkStrength() {
    document.querySelector('#map').style.setProperty('--artwork-strength', Number(artworkSlider.value) / 100);
    document.querySelector('#artwork-value').textContent = `${artworkSlider.value}%`;
  }
  artworkSlider.addEventListener('input', updateArtworkStrength);
  updateArtworkStrength();
  const territoryFadeSlider = document.querySelector('#territory-fade');
  function updateTerritoryFade() {
    document.querySelector('#map').style.setProperty('--territory-fade', Number(territoryFadeSlider.value) / 100);
    document.querySelector('#territory-fade-value').textContent = `${territoryFadeSlider.value}%`;
  }
  territoryFadeSlider.addEventListener('input', updateTerritoryFade);
  updateTerritoryFade();
  const territory = new Map();
  const mapElement = document.querySelector('#map');
  let activePlayer = 0;
  let stroke = null;
  const history = [];
  function saveUndo() {
    history.push(new Map(territory));
    if (history.length > 40) history.shift();
  }
  function redrawTerritory() {
    const overlay = document.querySelector('#territory-overlay');
    if (overlay) overlay.innerHTML = renderTerritory(territory);
    document.querySelector('#territory-status').textContent = PLAYERS.map((p,i) => `${p.name}: ${[...territory.values()].filter(v => v === i).length}`).join(' · ');
    document.querySelector('#undo-territory').disabled = !history.length;
    document.querySelector('#clear-player').disabled = activePlayer === null;
  }
  const palette = document.querySelector('#player-tools');
  palette.innerHTML = PLAYERS.map((p,i) => `<button type="button" data-player="${i}" aria-pressed="${i === 0}"><span class="swatch" style="background:${p.color}"></span>${p.name}</button>`).join('') + '<button type="button" data-player="erase" aria-pressed="false">Eraser</button>';
  palette.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    activePlayer = button.dataset.player === 'erase' ? null : Number(button.dataset.player);
    palette.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
    redrawTerritory();
  });
  function paintAt(x,y) {
    const target = document.elementFromPoint(x,y);
    if (!target || !mapElement.contains(target) || !target.dataset.tile) return false;
    const key = target.dataset.tile;
    if (activePlayer === null) return territory.delete(key);
    if (territory.get(key) === activePlayer) return false;
    territory.set(key, activePlayer);
    return true;
  }
  mapElement.addEventListener('pointerdown', event => {
    if (stroke || event.button !== 0 || !event.target.dataset.tile) return;
    event.preventDefault();
    saveUndo();
    stroke = { id: event.pointerId, x: event.clientX, y: event.clientY };
    mapElement.setPointerCapture(event.pointerId);
    paintAt(event.clientX, event.clientY);
    redrawTerritory();
  });
  mapElement.addEventListener('pointermove', event => {
    if (!stroke || event.pointerId !== stroke.id) return;
    // Sample the whole pointer segment so fast strokes do not skip hexagons.
    const steps = Math.max(1, Math.ceil(Math.hypot(event.clientX-stroke.x,event.clientY-stroke.y)/3));
    let changed = false;
    for (let i=1; i<=steps; i++) changed = paintAt(stroke.x+(event.clientX-stroke.x)*i/steps,stroke.y+(event.clientY-stroke.y)*i/steps) || changed;
    stroke.x = event.clientX; stroke.y = event.clientY;
    if (changed) redrawTerritory();
  });
  for (const eventName of ['pointerup','pointercancel','lostpointercapture']) {
    mapElement.addEventListener(eventName, event => {
      if (stroke && stroke.id === event.pointerId) stroke = null;
    });
  }
  document.querySelector('#clear-player').addEventListener('click', () => {
    saveUndo();
    for (const [key, owner] of territory) if (owner === activePlayer) territory.delete(key);
    redrawTerritory();
  });
  document.querySelector('#clear-territory').addEventListener('click', () => {
    saveUndo(); territory.clear(); redrawTerritory();
  });
  document.querySelector('#undo-territory').addEventListener('click', () => {
    const previous = history.pop();
    if (!previous) return;
    territory.clear(); previous.forEach((owner,key) => territory.set(key,owner));
    redrawTerritory();
  });
  let currentBoard = null;
  const form = document.querySelector('#settings');
  const weightsPanel = document.querySelector('#weights');
  const defaultWeights = defaults.weights;
  weightsPanel.innerHTML = BIOMES.map((b, i) => `<label class="weight-label" for="weight-${i}"><span class="swatch" style="background:${b.color}"></span>${b.name}</label><div class="weight-controls"><input id="slider-${i}" aria-label="${b.name} weight slider" type="range" min="0" max="100" value="${defaultWeights[i]}" step="1"><input id="weight-${i}" type="number" min="0" max="1000000" value="${defaultWeights[i]}" step="1" required></div><output id="chance-${i}" for="weight-${i} slider-${i}"></output>`).join('');
  const weightInputs = [...weightsPanel.querySelectorAll('input[type=number]')];
  const sliders = [...weightsPanel.querySelectorAll('input[type=range]')];
  function updateChances() {
    const total = weightInputs.reduce((sum, input) => sum + Number(input.value), 0);
    weightInputs.forEach((input, i) => {
      const value = Number(input.value);
      document.querySelector(`#chance-${i}`).textContent = `${value} / ${total} · ${total ? (100 * value / total).toFixed(1) : '0.0'}% target`;
    });
  }
  weightsPanel.addEventListener('input', event => {
    const sliderIndex = sliders.indexOf(event.target);
    if (sliderIndex >= 0) weightInputs[sliderIndex].value = event.target.value;
    const inputIndex = weightInputs.indexOf(event.target);
    if (inputIndex >= 0 && event.target.validity.valid) {
      sliders[inputIndex].max = Math.max(100, Number(event.target.value));
      sliders[inputIndex].value = event.target.value;
    }
    updateChances();
  });
  function apply(reshuffle = false) {
    if (!form.reportValidity()) return;
    const seedInput = document.querySelector('#seed');
    let seed = Number(seedInput.value);
    if (reshuffle) {
      const next = crypto.getRandomValues(new Uint32Array(1))[0];
      seed = next === seed ? (next + 1) >>> 0 : next;
    }
    try {
      const board = generateMap({ columns: Number(document.querySelector('#columns').value), bands: Number(document.querySelector('#bands').value), seed, weights: weightInputs.map(s => Number(s.value)) });
      if (currentBoard && (currentBoard.columns !== board.columns || currentBoard.bands !== board.bands)) {
        const valid = new Set(board.groups.flatMap(g => g.tiles).concat(board.tundra,board.ocean).map(t => t.join(',')));
        for (const key of territory.keys()) if (!valid.has(key)) territory.delete(key);
        history.length = 0;
      }
      currentBoard = board;
      mapElement.innerHTML = renderMap(board);
      redrawTerritory();
      document.querySelector('#summary').textContent = `${board.columns} columns × ${board.bands} bands · ${board.groups.length} clusters · ${board.groups.length * 3 + board.tundra.length + board.ocean.length} tiles · Seed ${seed}`;
      document.querySelector('#legend').innerHTML = BIOMES.map((b, i) => `<span><i class="swatch" style="background:${b.color}"></i>${b.name}: ${board.counts[i]} clusters (${board.counts[i] * 3} tiles)</span>`).join('') + `<span><i class="swatch" style="background:white"></i>Tundra: ${board.tundra.length} tiles</span><span><i class="swatch" style="background:#245084"></i>Ocean: ${board.ocean.length} tiles</span>`;
      seedInput.value = seed;
      document.querySelector('#error').textContent = '';
    } catch (error) {
      document.querySelector('#error').textContent = error.message;
    }
  }
  form.addEventListener('submit', event => { event.preventDefault(); apply(); });
  document.querySelector('#reshuffle').addEventListener('click', () => apply(true));
  updateChances();
  apply();
}
