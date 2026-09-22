// Run from the repository root with JavaScriptCore: jsc tests/map.test.js
load('config.js');
load('map.js');
function assert(value, message) { if (!value) throw new Error(message); }
const settings = { columns: 8, bands: 4, seed: 7, weights: [1, 1, 1, 1, 1, 1] };
const first = generateMap(settings);
assert(JSON.stringify(first.counts) === '[6,6,5,5,5,5]', 'stable rounding ties');
assert(JSON.stringify(first) === JSON.stringify(generateMap(settings)), 'reproducibility');
assert(JSON.stringify(first.groups) !== JSON.stringify(generateMap({...settings, seed: 8}).groups), 'shuffled placement');
for (const columns of [2, 8, 40]) for (const bands of [1, 4, 24]) {
  for (const weights of [[1,1,1,1,1,1], [0,2,0,1,0,0], [1,2,3,4,5,6]]) {
    let inventory;
    for (const seed of [0,7,8,4294967295]) {
      const board = generateMap({columns,bands,weights,seed});
      const counts = Array(6).fill(0);
      board.groups.forEach(g => counts[g.biome]++);
      assert(JSON.stringify(counts) === JSON.stringify(board.counts), 'actual inventory');
      if (inventory) assert(JSON.stringify(counts) === inventory, 'seed-independent inventory');
      inventory = JSON.stringify(counts);
      const sum = weights.reduce((a,b) => a+b,0);
      counts.forEach((n,i) => {
        assert(Math.abs(n-columns*bands*weights[i]/sum)<1, 'quota rounding');
        if (!weights[i]) assert(n===0,'excluded biome');
      });
      const tiles = board.groups.flatMap(g=>g.tiles).concat(board.tundra,board.ocean);
      assert(new Set(tiles.map(t=>t.join(','))).size===tiles.length,'no overlaps');
      assert(board.tundra.length===columns*3,'tundra count');
      assert(board.ocean.length===bands*4+4,'ocean includes corners');
      for (const corner of [[-1,-1],[columns*3+1,-1],[-2,bands*2],[columns*3,bands*2]])
        assert(board.ocean.some(t=>t.toString()===corner.toString()),'ocean corner');
      assert(renderMap(board).endsWith('</svg>'),'SVG renders');
    }
  }
}
assert(JSON.stringify(generateMap({...settings,columns:6,bands:7,weights:[1,2,3,4,5,6]}).counts)==='[2,4,6,8,10,12]','exact divisible fractions');
print('PASS: fixed inventory, rounding, exact fractions, seed reproducibility, shuffled placement, ocean corners, geometry uniqueness, rendering');
const territory = new Map([['0,0',0]]);
assert(territoryEdges(territory,0).length===6,'single hex border');
territory.set('2,0',0);
assert(territoryEdges(territory,0).length===10,'shared edge removed');
territory.set('1,1',0);
assert(territoryEdges(territory,0).length===12,'triangle territory perimeter');
territory.set('2,0',1);
assert(territoryEdges(territory,0).length===10 && territoryEdges(territory,1).length===6,'different owners keep border');
assert((renderTerritory(territory).match(/fill-opacity:var\(--territory-fade, 0\)/g)||[]).length===3,'all claimed tiles support adjustable fade, defaulting to none');
territory.delete('2,0');
assert(territoryEdges(territory,1).length===0,'erased territory removes border');
assert((renderMap(first).match(/data-tile=/g)||[]).length===140,'all hexagons paintable');
print('PASS: territory perimeter merging, distinct owners, shading, erasing, tile hit targets');

assert(JSON.stringify(generateMap({columns:10,bands:6,seed:7,weights:[15,12,5,15,8,5]}).counts)==='[15,12,5,15,8,5]','60-cluster baseline distribution');
