// ARDIT'S GAME - PHASE 1 CORE
const SAVE_KEY = 'ardits_game_v1';

// 1. ITEM & CRAFTING DEFINITIONS
const ITEMS = {
  hand:     { name: 'Fist',       type: 'tool', dmg: 8,  chop: 1 },
  axe:      { name: 'Stone Axe',  type: 'tool', dmg: 16, chop: 3 },
  spear:    { name: 'Wood Spear', type: 'tool', dmg: 26, chop: 1 },
  wood:     { name: 'Wood',       type: 'mat' },
  stone:    { name: 'Stone',      type: 'mat' },
  fiber:    { name: 'Plant Fiber',type: 'mat' },
  hide:     { name: 'Hide',       type: 'mat' },
  berry:    { name: 'Berries',    type: 'food', hunger: 18, hp: 4 },
  rawmeat:  { name: 'Raw Meat',   type: 'food', hunger: 12, hp: -5, tame: true },
  meat:     { name: 'Cooked Meat',type: 'food', hunger: 45, hp: 18, tame: true },
  bandage:  { name: 'Bandage',    type: 'heal', hp: 35 },
  seed:     { name: 'Berry Seed', type: 'seed' },
  campfire: { name: 'Campfire',   type: 'build', bType: 'campfire' },
  floor:    { name: 'Wood Floor', type: 'build', bType: 'floor' },
  wall:     { name: 'Cabin Wall', type: 'build', bType: 'wall' },
  torch:    { name: 'Torch',      type: 'build', bType: 'torch' },
  farm:     { name: 'Farm Plot',  type: 'build', bType: 'farm' }
};

const RECIPES = [
  { id: 'axe',      out: 1, req: { wood: 2, stone: 2 } },
  { id: 'spear',    out: 1, req: { wood: 3, stone: 1 } },
  { id: 'bandage',  out: 1, req: { fiber: 2, berry: 1 } },
  { id: 'campfire', out: 1, req: { wood: 3, stone: 2 } },
  { id: 'floor',    out: 2, req: { wood: 2 } },
  { id: 'wall',     out: 2, req: { wood: 3 } },
  { id: 'torch',    out: 2, req: { wood: 1, fiber: 1 } },
  { id: 'farm',     out: 1, req: { wood: 3, fiber: 2 } }
];

// 2. GAME STATE
let state = {
  hp: 100, hunger: 100, thirst: 100,
  day: 1, time: 0.25,
  px: 0, pz: 6,
  selected: 'hand',
  inv: { hand: 1, wood: 2, berry: 3, seed: 2 },
  placed: []
};

const saved = localStorage.getItem(SAVE_KEY);
if (saved) {
  try { state = { ...state, ...JSON.parse(saved) }; } catch (e) {}
}

function saveGame() {
  localStorage.setItem(SAVE_KEY, JSON.stringify(state));
}

// 3. THREE.JS SCENE & PIXEL TEXTURES
const canvas = document.getElementById('game-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1) * 0.48);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x13261a);
scene.fog = new THREE.Fog(0x13261a, 24, 52);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 140);

function makePixelTex(c1, c2) {
  const c = document.createElement('canvas');
  c.width = 8; c.height = 8;
  const ctx = c.getContext('2d');
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    ctx.fillStyle = ((x + y) % 2 === 0 || Math.random() > 0.4) ? c1 : c2;
    ctx.fillRect(x, y, 1, 1);
  }
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

const texGrass = makePixelTex('#284c2c', '#213f24');
texGrass.repeat.set(45, 45);
const texWater = makePixelTex('#1d5e8a', '#2672a6');
const texWood  = makePixelTex('#7a4b26', '#5e381b');
const texLeaf  = makePixelTex('#2f6e34', '#1f5224');
const texStone = makePixelTex('#757a7e', '#595d61');

// Lights
const ambLight = new THREE.AmbientLight(0xffffff, 0.65);
scene.add(ambLight);
const sunLight = new THREE.DirectionalLight(0xfff1d6, 0.9);
sunLight.position.set(20, 35, 15);
scene.add(sunLight);
const torchLight = new THREE.PointLight(0xff9436, 0, 12);
scene.add(torchLight);

// Ground
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(160, 160),
  new THREE.MeshLambertMaterial({ map: texGrass })
);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

// 4. PLAYER MESH (ARDIT)
const playerGroup = new THREE.Group();
const pBody = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.0, 0.6), new THREE.MeshLambertMaterial({ color: 0x3b82f6 }));
pBody.position.y = 0.8;
const pHead = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.65, 0.65), new THREE.MeshLambertMaterial({ color: 0xf1c27d }));
pHead.position.y = 1.65;
const pCap = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.25, 0.7), new THREE.MeshLambertMaterial({ color: 0xdc2626 }));
pCap.position.y = 2.02;
playerGroup.add(pBody, pHead, pCap);
playerGroup.position.set(state.px, 0, state.pz);
scene.add(playerGroup);

// 5. WORLD OBJECTS (LAKES, TREES, ROCKS, BUSHES, RUINS, ANIMALS)
const lakes = [ { x: -16, z: -12, r: 8 }, { x: 22, z: 18, r: 7 } ];
lakes.forEach(l => {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(l.r, l.r, 0.15, 12), new THREE.MeshLambertMaterial({ map: texWater }));
  m.position.set(l.x, 0.03, l.z);
  scene.add(m);
});

const nodes = []; // trees, rocks, bushes, crates
const walls = []; // solid collision

function randPos(minR, maxR) {
  const a = Math.random() * Math.PI * 2;
  const r = minR + Math.random() * (maxR - minR);
  return { x: Math.round(Math.cos(a) * r), z: Math.round(Math.sin(a) * r) };
}
function nearLake(x, z) { return lakes.some(l => Math.hypot(x - l.x, z - l.z) < l.r + 2); }

function spawnTree(x, z) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.BoxGeometry(0.7, 2.2, 0.7), new THREE.MeshLambertMaterial({ map: texWood }));
  trunk.position.y = 1.1;
  const top1 = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.0, 2.4), new THREE.MeshLambertMaterial({ map: texLeaf }));
  top1.position.y = 3.0;
  const top2 = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.4, 1.5), new THREE.MeshLambertMaterial({ map: texLeaf }));
  top2.position.y = 4.4;
  g.add(trunk, top1, top2);
  g.position.set(x, 0, z);
  scene.add(g);
  nodes.push({ kind: 'tree', x, z, hp: 30, mesh: g, drop: { wood: 3, seed: Math.random() > 0.6 ? 1 : 0 } });
}

function spawnRock(x, z) {
  const m = new THREE.Mesh(new THREE.DodecahedronGeometry(0.95, 0), new THREE.MeshLambertMaterial({ map: texStone }));
  m.position.set(x, 0.6, z);
  scene.add(m);
  nodes.push({ kind: 'rock', x, z, hp: 35, mesh: m, drop: { stone: 3 } });
}

function spawnBush(x, z) {
  const g = new THREE.Group();
  const b = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.9, 1.1), new THREE.MeshLambertMaterial({ color: 0x265c2b }));
  b.position.y = 0.45;
  const ber = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, 0.25), new THREE.MeshLambertMaterial({ color: 0xef4444 }));
  ber.position.set(0.3, 0.85, 0.3);
  g.add(b, ber);
  g.position.set(x, 0, z);
  scene.add(g);
  nodes.push({ kind: 'bush', x, z, hp: 10, mesh: g, drop: { berry: 2, fiber: 2 } });
}

// Abandoned Houses & Tents with Loot Crates
function spawnRuin(x, z, isHouse) {
  const g = new THREE.Group();
  const col = isHouse ? 0x6b4423 : 0x8f7a56;
  const w1 = new THREE.Mesh(new THREE.BoxGeometry(4, 2.2, 0.4), new THREE.MeshLambertMaterial({ color: col }));
  w1.position.set(0, 1.1, -2);
  const w2 = new THREE.Mesh(new THREE.BoxGeometry(0.4, 2.2, 4), new THREE.MeshLambertMaterial({ color: col }));
  w2.position.set(-2, 1.1, 0);
  g.add(w1, w2);
  if (isHouse) {
    const roof = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.3, 4.4), new THREE.MeshLambertMaterial({ color: 0x422b18 }));
    roof.position.set(0, 2.3, 0);
    g.add(roof);
  }
  g.position.set(x, 0, z);
  scene.add(g);

  // Loot Crate inside
  const crate = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.9), new THREE.MeshLambertMaterial({ color: 0xd97706 }));
  crate.position.set(x, 0.45, z);
  scene.add(crate);
  nodes.push({ kind: 'crate', x, z, hp: 1, mesh: crate, drop: { bandage: 1, wood: 3, stone: 2, fiber: 2 } });
}

for (let i = 0; i < 65; i++) { const p = randPos(6, 58); if (!nearLake(p.x, p.z)) spawnTree(p.x, p.z); }
for (let i = 0; i < 28; i++) { const p = randPos(7, 55); if (!nearLake(p.x, p.z)) spawnRock(p.x, p.z); }
for (let i = 0; i < 30; i++) { const p = randPos(5, 50); if (!nearLake(p.x, p.z)) spawnBush(p.x, p.z); }

spawnRuin(14, -10, true);
spawnRuin(-22, 18, true);
spawnRuin(6, 18, false);
spawnRuin(-8, -24, false);

// 6. ANIMALS (FRIENDLY PUP, DEER, HOSTILE BOARS/WOLVES)
const animals = [];
function spawnAnimal(type, x, z) {
  const g = new THREE.Group();
  const col = type === 'dog' ? 0xd9a066 : type === 'deer' ? 0xa16207 : type === 'boar' ? 0x4a3525 : 0x52525b;
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.65, 1.3), new THREE.MeshLambertMaterial({ color: col }));
  body.position.y = 0.55;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 0.6), new THREE.MeshLambertMaterial({ color: col }));
  head.position.set(0, 0.9, 0.75);
  g.add(body, head);
  g.position.set(x, 0, z);
  scene.add(g);
  animals.push({
    type, x, z, mesh: g,
    hp: type === 'boar' || type === 'wolf' ? 35 : 20,
    hostile: type === 'boar' || type === 'wolf',
    tamed: false,
    dir: Math.random() * Math.PI * 2,
    cd: 0
  });
}

spawnAnimal('dog', 4, 4);
for (let i = 0; i < 6; i++) { const p = randPos(10, 45); spawnAnimal('deer', p.x, p.z); }
for (let i = 0; i < 5; i++) { const p = randPos(16, 50); spawnAnimal('boar', p.x, p.z); }
for (let i = 0; i < 4; i++) { const p = randPos(22, 55); spawnAnimal('wolf', p.x, p.z); }

// 7. PLACED CABIN OBJECTS & FARMS
const builtMeshes = [];
function renderPlaced(obj) {
  let m;
  if (obj.type === 'floor') {
    m = new THREE.Mesh(new THREE.BoxGeometry(2, 0.15, 2), new THREE.MeshLambertMaterial({ map: texWood }));
    m.position.set(obj.x, 0.08, obj.z);
  } else if (obj.type === 'wall') {
    m = new THREE.Mesh(new THREE.BoxGeometry(2, 2.2, 2), new THREE.MeshLambertMaterial({ map: texWood }));
    m.position.set(obj.x, 1.1, obj.z);
    walls.push({ x: obj.x, z: obj.z, r: 1.1 });
  } else if (obj.type === 'campfire') {
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.7, 0.25, 6), new THREE.MeshLambertMaterial({ map: texStone }));
    const fire = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.65, 0.45), new THREE.MeshBasicMaterial({ color: 0xff6a00 }));
    fire.position.y = 0.4;
    const pl = new THREE.PointLight(0xff7b29, 1.5, 14);
    pl.position.y = 1.2;
    g.add(base, fire, pl);
    g.position.set(obj.x, 0.12, obj.z);
    m = g;
  } else if (obj.type === 'torch') {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.8, 0.2), new THREE.MeshLambertMaterial({ map: texWood }));
    pole.position.y = 0.9;
    const flame = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), new THREE.MeshBasicMaterial({ color: 0xffaa00 }));
    flame.position.y = 1.9;
    const pl = new THREE.PointLight(0xffaa33, 1.2, 11);
    pl.position.y = 2.0;
    g.add(pole, flame, pl);
    g.position.set(obj.x, 0, obj.z);
    m = g;
  } else if (obj.type === 'farm') {
    const g = new THREE.Group();
    const soil = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.16, 1.8), new THREE.MeshLambertMaterial({ color: 0x3b2313 }));
    soil.position.y = 0.08;
    g.add(soil);
    if (obj.grown) {
      const plant = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.6, 0.7), new THREE.MeshLambertMaterial({ color: 0x22c55e }));
      plant.position.y = 0.45;
      g.add(plant);
    }
    g.position.set(obj.x, 0, obj.z);
    m = g;
  }
  if (m) { scene.add(m); builtMeshes.push({ obj, mesh: m }); }
}
state.placed.forEach(renderPlaced);

// 8. UI HELPERS
let toastTimer = null;
function toast(msg) {
  const el = document.getElementById('txt-toast');
  el.textContent = msg;
  el.style.opacity = '1';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.style.opacity = '0'; }, 1800);
}

function addItem(id, qty = 1) {
  state.inv[id] = (state.inv[id] || 0) + qty;
  refreshUI();
  saveGame();
}

function refreshUI() {
  document.getElementById('val-hp').textContent = Math.ceil(state.hp);
  document.getElementById('bar-hp').style.width = Math.max(0, state.hp) + '%';
  document.getElementById('val-hunger').textContent = Math.ceil(state.hunger);
  document.getElementById('bar-hunger').style.width = Math.max(0, state.hunger) + '%';
  document.getElementById('val-thirst').textContent = Math.ceil(state.thirst);
  document.getElementById('bar-thirst').style.width = Math.max(0, state.thirst) + '%';

  const hb = document.getElementById('hotbar');
  const keys = Object.keys(state.inv).filter(k => state.inv[k] > 0);
  if (!state.inv[state.selected]) state.selected = 'hand';

  hb.innerHTML = keys.map(k => {
    const active = state.selected === k ? 'border-emerald-400 bg-emerald-950/80' : 'border-white/15 bg-zinc-900/90';
    return `<button onclick="selectItem('${k}')" class="px-2.5 py-1.5 rounded-lg border ${active} text-[10px] shrink-0">
      <div class="font-bold text-white">${ITEMS[k].name}</div>
      <div class="text-zinc-400">x${state.inv[k]}</div>
    </button>`;
  }).join('');
}

window.selectItem = (k) => { state.selected = k; refreshUI(); toast('Equipped: ' + ITEMS[k].name); };

// Bag & Crafting Modal
document.getElementById('btn-bag').onclick = () => {
  const modal = document.getElementById('bag-modal');
  modal.classList.remove('hidden');
  document.getElementById('craft-list').innerHTML = RECIPES.map(r => {
    const reqTxt = Object.entries(r.req).map(([k, v]) => `${ITEMS[k].name} x${v}`).join(', ');
    const can = Object.entries(r.req).every(([k, v]) => (state.inv[k] || 0) >= v);
    return `<button onclick="craftItem('${r.id}')" class="flex justify-between items-center p-2.5 rounded-lg border ${can ? 'border-emerald-500/50 bg-emerald-950/40' : 'border-white/10 bg-black/40 opacity-50'} text-left text-xs">
      <div><div class="font-bold">${ITEMS[r.id].name} (x${r.out})</div><div class="text-[10px] text-zinc-400">${reqTxt}</div></div>
      <span class="px-2 py-1 rounded bg-white text-black text-[10px] font-bold">CRAFT</span>
    </button>`;
  }).join('');
  document.getElementById('inv-list').innerHTML = Object.keys(state.inv).filter(k => state.inv[k] > 0).map(k => `
    <button onclick="selectItem('${k}');document.getElementById('bag-modal').classList.add('hidden')" class="p-2 rounded border border-white/15 bg-black/40 text-left text-xs">
      <div class="font-bold">${ITEMS[k].name}</div><div class="text-zinc-400">x${state.inv[k]}</div>
    </button>`).join('');
};
document.getElementById('btn-close-bag').onclick = () => document.getElementById('bag-modal').classList.add('hidden');

window.craftItem = (id) => {
  const r = RECIPES.find(x => x.id === id);
  if (!r) return;
  for (const [k, v] of Object.entries(r.req)) if ((state.inv[k] || 0) < v) return toast('Not enough materials!');
  for (const [k, v] of Object.entries(r.req)) state.inv[k] -= v;
  addItem(id, r.out);
  state.selected = id;
  toast('Crafted ' + ITEMS[id].name + '!');
  document.getElementById('btn-bag').click();
};

// 9. PLAYER ACTIONS (HIT / CHOP / USE / LOOT / BUILD / TAME / FARM)
document.getElementById('btn-act').onclick = () => {
  const tool = ITEMS[state.selected] || ITEMS.hand;
  const dmg = tool.dmg || 8;
  const chop = tool.chop || 1;

  // Hit nearby hostile/huntable animal
  for (let i = animals.length - 1; i >= 0; i--) {
    const a = animals[i];
    if (!a.tamed && Math.hypot(a.x - state.px, a.z - state.pz) < 2.6) {
      a.hp -= dmg;
      a.mesh.position.y = 0.3;
      setTimeout(() => { if (a.mesh) a.mesh.position.y = 0; }, 120);
      if (a.hp <= 0) {
        scene.remove(a.mesh);
        animals.splice(i, 1);
        addItem('rawmeat', 2);
        if (a.hostile) addItem('hide', 1);
        toast('Got Raw Meat!');
      } else toast('Hit ' + a.type + '!');
      return;
    }
  }

  // Chop / Mine / Gather nearby resource
  for (let i = nodes.length - 1; i >= 0; i--) {
    const n = nodes[i];
    if (n.kind !== 'crate' && Math.hypot(n.x - state.px, n.z - state.pz) < 2.7) {
      n.hp -= (n.kind === 'tree' ? chop * 10 : dmg);
      n.mesh.rotation.z = 0.12;
      setTimeout(() => { if (n.mesh) n.mesh.rotation.z = 0; }, 100);
      if (n.hp <= 0) {
        scene.remove(n.mesh);
        nodes.splice(i, 1);
        Object.entries(n.drop).forEach(([k, v]) => { if (v > 0) addItem(k, v); });
        toast('Gathered ' + Object.keys(n.drop).join(', '));
      }
      return;
    }
  }
  toast('Nothing close to hit');
};

document.getElementById('btn-use').onclick = () => {
  // 1. Loot nearby crate
  for (let i = nodes.length - 1; i >= 0; i--) {
    const n = nodes[i];
    if (n.kind === 'crate' && Math.hypot(n.x - state.px, n.z - state.pz) < 2.6) {
      scene.remove(n.mesh);
      nodes.splice(i, 1);
      Object.entries(n.drop).forEach(([k, v]) => addItem(k, v));
      toast('Looted Crate!');
      return;
    }
  }

  // 2. Drink from lake
  if (nearLake(state.px, state.pz)) {
    state.thirst = Math.min(100, state.thirst + 45);
    refreshUI();
    toast('Drank fresh lake water!');
    return;
  }

  // 3. Tame friendly dog
  const dog = animals.find(a => a.type === 'dog' && !a.tamed && Math.hypot(a.x - state.px, a.z - state.pz) < 2.8);
  if (dog && ((state.inv.rawmeat || 0) > 0 || (state.inv.berry || 0) > 0)) {
    if (state.inv.rawmeat > 0) state.inv.rawmeat--; else state.inv.berry--;
    dog.tamed = true;
    refreshUI(); saveGame();
    toast('You tamed the Forest Pup! Friend!');
    return;
  }

  // 4. Cook raw meat at nearby campfire
  const nearFire = state.placed.some(p => p.type === 'campfire' && Math.hypot(p.x - state.px, p.z - state.pz) < 2.8);
  if (nearFire && (state.inv.rawmeat || 0) > 0) {
    state.inv.rawmeat--;
    addItem('meat', 1);
    toast('Cooked Meat on Campfire!');
    return;
  }

  // 5. Plant/Harvest Farm Plot
  const farmObj = state.placed.find(p => p.type === 'farm' && Math.hypot(p.x - state.px, p.z - state.pz) < 2.2);
  if (farmObj) {
    if (farmObj.grown) {
      farmObj.grown = false;
      addItem('berry', 3); addItem('seed', 1);
      builtMeshes.forEach(b => { if (b.obj === farmObj) { scene.remove(b.mesh); } });
      renderPlaced(farmObj);
      toast('Harvested Fresh Berries!');
      return;
    } else if (state.selected === 'seed' && state.inv.seed > 0) {
      state.inv.seed--;
      farmObj.planted = true;
      setTimeout(() => {
        farmObj.grown = true;
        builtMeshes.forEach(b => { if (b.obj === farmObj) scene.remove(b.mesh); });
        renderPlaced(farmObj);
        saveGame();
      }, 15000);
      refreshUI(); saveGame();
      toast('Planted Seed! Grows in 15s');
      return;
    }
  }

  // 6. Use selected Food / Bandage / Build item
  const item = ITEMS[state.selected];
  if (!item || (state.inv[state.selected] || 0) <= 0) return;

  if (item.type === 'food') {
    state.inv[state.selected]--;
    state.hunger = Math.min(100, state.hunger + item.hunger);
    state.hp = Math.min(100, Math.max(1, state.hp + (item.hp || 0)));
    refreshUI(); saveGame();
    toast('Ate ' + item.name);
  } else if (item.type === 'heal') {
    state.inv[state.selected]--;
    state.hp = Math.min(100, state.hp + item.hp);
    refreshUI(); saveGame();
    toast('Healed +' + item.hp + ' HP!');
  } else if (item.type === 'build') {
    const gx = Math.round(state.px / 2) * 2;
    const gz = Math.round((state.pz - 2) / 2) * 2;
    state.inv[state.selected]--;
    const newObj = { type: item.bType, x: gx, z: gz, grown: false };
    state.placed.push(newObj);
    renderPlaced(newObj);
    refreshUI(); saveGame();
    toast('Placed ' + item.name + '!');
  }
};

// 10. DUAL-THUMB VIRTUAL JOYSTICK + KEYBOARD
let joyX = 0, joyY = 0, joyTouchId = null;
const joyZone = document.getElementById('joy-zone');
const joyKnob = document.getElementById('joy-knob');

function updateJoy(cx, cy) {
  const r = joyZone.getBoundingClientRect();
  const dx = cx - (r.left + r.width / 2);
  const dy = cy - (r.top + r.height / 2);
  const dist = Math.min(40, Math.hypot(dx, dy));
  const ang = Math.atan2(dy, dx);
  joyKnob.style.transform = `translate(${Math.cos(ang) * dist}px, ${Math.sin(ang) * dist}px)`;
  joyX = (Math.cos(ang) * dist) / 40;
  joyY = (Math.sin(ang) * dist) / 40;
}

joyZone.addEventListener('touchstart', e => {
  const t = e.changedTouches[0];
  joyTouchId = t.identifier;
  updateJoy(t.clientX, t.clientY);
});
window.addEventListener('touchmove', e => {
  for (const t of e.changedTouches) if (t.identifier === joyTouchId) updateJoy(t.clientX, t.clientY);
});
window.addEventListener('touchend', e => {
  for (const t of e.changedTouches) if (t.identifier === joyTouchId) {
    joyTouchId = null; joyX = 0; joyY = 0; joyKnob.style.transform = 'translate(0,0)';
  }
});

const keysDown = {};
window.addEventListener('keydown', e => { keysDown[e.key.toLowerCase()] = true; });
window.addEventListener('keyup', e => { keysDown[e.key.toLowerCase()] = false; });

// 11. MAIN GAME LOOP
let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  let mx = joyX, mz = joyY;
  if (keysDown['w'] || keysDown['arrowup']) mz = -1;
  if (keysDown['s'] || keysDown['arrowdown']) mz = 1;
  if (keysDown['a'] || keysDown['arrowleft']) mx = -1;
  if (keysDown['d'] || keysDown['arrowright']) mx = 1;

  if (Math.abs(mx) > 0.1 || Math.abs(mz) > 0.1) {
    const nx = state.px + mx * 6.5 * dt;
    const nz = state.pz + mz * 6.5 * dt;
    const hitWall = walls.some(w => Math.abs(nx - w.x) < w.r && Math.abs(nz - w.z) < w.r);
    const inDeepLake = lakes.some(l => Math.hypot(nx - l.x, nz - l.z) < l.r - 0.5);
    if (!hitWall && !inDeepLake) {
      state.px = Math.max(-72, Math.min(72, nx));
      state.pz = Math.max(-72, Math.min(72, nz));
      playerGroup.position.set(state.px, 0, state.pz);
      playerGroup.rotation.y = Math.atan2(mx, mz);
    }
  }

  // Camera follow (top-down 3D angle)
  camera.position.set(state.px, 16, state.pz + 13);
  camera.lookAt(state.px, 0.5, state.pz);

  // Day / Night cycle (180 seconds full cycle)
  state.time += dt / 180;
  if (state.time >= 1) { state.time = 0; state.day++; saveGame(); }
  const isNight = state.time > 0.65 || state.time < 0.12;
  const lightLvl = isNight ? 0.25 : 0.72;
  ambLight.intensity = lightLvl;
  sunLight.intensity = isNight ? 0.15 : 0.9;
  scene.background.setHex(isNight ? 0x050a08 : 0x13261a);
  scene.fog.color.setHex(isNight ? 0x050a08 : 0x13261a);
  document.getElementById('txt-day').textContent = `DAY ${state.day} // ${isNight ? 'NIGHT' : 'DAY'}`;

  // Survival decay
  state.hunger = Math.max(0, state.hunger - dt * 0.35);
  state.thirst = Math.max(0, state.thirst - dt * 0.45);
  if (state.hunger <= 0 || state.thirst <= 0) state.hp -= dt * 2.5;

  // Animal AI
  animals.forEach(a => {
    const dist = Math.hypot(state.px - a.x, state.pz - a.z);
    if (a.tamed) {
      if (dist > 2.8) {
        const ang = Math.atan2(state.px - a.x, state.pz - a.z);
        a.x += Math.sin(ang) * 4.5 * dt;
        a.z += Math.cos(ang) * 4.5 * dt;
        a.mesh.rotation.y = ang;
      }
    } else if (a.hostile && dist < (isNight ? 13 : 8)) {
      const ang = Math.atan2(state.px - a.x, state.pz - a.z);
      a.x += Math.sin(ang) * 3.8 * dt;
      a.z += Math.cos(ang) * 3.8 * dt;
      a.mesh.rotation.y = ang;
      a.cd -= dt;
      if (dist < 1.5 && a.cd <= 0) {
        state.hp -= 10;
        a.cd = 1.2;
        toast('Attacked by ' + a.type + '!');
      }
    } else {
      a.x += Math.sin(a.dir) * 1.2 * dt;
      a.z += Math.cos(a.dir) * 1.2 * dt;
      if (Math.random() < 0.01) a.dir = Math.random() * Math.PI * 2;
    }
    a.mesh.position.set(a.x, 0, a.z);
  });

  // Respawn if HP hits 0
  if (state.hp <= 0) {
    state.hp = 75; state.hunger = 75; state.thirst = 75;
    state.px = 0; state.pz = 6;
    playerGroup.position.set(0, 0, 6);
    saveGame();
    toast('You passed out & respawned at camp!');
  }

  refreshUI();
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

refreshUI();
setInterval(saveGame, 5000);
requestAnimationFrame(loop);
// END OF ARDITS GAME 
