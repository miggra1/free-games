import * as THREE from "../shared/three.module.min.js";

const canvas = document.querySelector("#stage");
const hpEl = document.querySelector("#hp");
const energyEl = document.querySelector("#energy");
const waveEl = document.querySelector("#wave");
const scoreEl = document.querySelector("#score");
const comboEl = document.querySelector("#combo");
const banner = document.querySelector("#banner");

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x071019);
scene.fog = new THREE.Fog(0x071019, 18, 58);

const camera = new THREE.PerspectiveCamera(55, 16 / 9, 0.1, 120);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const clock = new THREE.Clock();
const keys = new Set();
const arena = { x: 17, z: 11 };

const player = {
  hp: 100,
  energy: 100,
  score: 0,
  combo: 0,
  comboTimer: 0,
  wave: 1,
  weaponLevel: 1,
  attackCooldown: 0,
  dashCooldown: 0,
  invincible: 0,
  velocity: new THREE.Vector3(),
  group: null,
};

let aliens = [];
let projectiles = [];
let grenades = [];
let effects = [];
let spawnQueue = 0;
let spawnTimer = 0;
let spawnSide = -1;
let waveActive = false;
let ended = false;

const materials = {
  ground: new THREE.MeshStandardMaterial({ color: 0x182330, roughness: 0.86, metalness: 0.08 }),
  road: new THREE.MeshStandardMaterial({ color: 0x20262e, roughness: 0.78 }),
  stripe: new THREE.MeshStandardMaterial({ color: 0xf2c86d, roughness: 0.5 }),
  player: new THREE.MeshStandardMaterial({ color: 0x2d79ff, roughness: 0.48, metalness: 0.12 }),
  playerDark: new THREE.MeshStandardMaterial({ color: 0x16396e, roughness: 0.5 }),
  skin: new THREE.MeshStandardMaterial({ color: 0xf0c18b, roughness: 0.55 }),
  glove: new THREE.MeshStandardMaterial({ color: 0xffd166, roughness: 0.36, metalness: 0.1 }),
  alien: new THREE.MeshStandardMaterial({ color: 0x91e85a, roughness: 0.5 }),
  alienDark: new THREE.MeshStandardMaterial({ color: 0x29503a, roughness: 0.62 }),
  boss: new THREE.MeshStandardMaterial({ color: 0xff5e67, roughness: 0.44, metalness: 0.08 }),
  eye: new THREE.MeshStandardMaterial({ color: 0xf4fbff, emissive: 0x98f7ff, emissiveIntensity: 0.35 }),
  portal: new THREE.MeshStandardMaterial({ color: 0x6bdcff, emissive: 0x1eb9ff, emissiveIntensity: 1.2, transparent: true, opacity: 0.48 }),
  blast: new THREE.MeshStandardMaterial({ color: 0x6bdcff, emissive: 0x25c8ff, emissiveIntensity: 1.6 }),
  fire: new THREE.MeshStandardMaterial({ color: 0xff8b3d, emissive: 0xff5b1d, emissiveIntensity: 1.2 }),
};

init();
requestAnimationFrame(frame);

function init() {
  createLights();
  createArena();
  player.group = createHero();
  player.group.position.set(-4, 0, 0);
  scene.add(player.group);
  startWave();
  resize();
}

function createLights() {
  scene.add(new THREE.HemisphereLight(0x9fe9ff, 0x15191b, 1.45));
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(8, 13, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -22;
  sun.shadow.camera.right = 22;
  sun.shadow.camera.top = 18;
  sun.shadow.camera.bottom = -18;
  scene.add(sun);
  const neon = new THREE.PointLight(0x6bdcff, 3.4, 24);
  neon.position.set(0, 5, -7);
  scene.add(neon);
}

function createArena() {
  const ground = new THREE.Mesh(new THREE.BoxGeometry(38, 0.45, 24), materials.ground);
  ground.position.y = -0.26;
  ground.receiveShadow = true;
  scene.add(ground);

  const road = new THREE.Mesh(new THREE.BoxGeometry(34, 0.05, 7), materials.road);
  road.position.set(0, 0.01, 0);
  road.receiveShadow = true;
  scene.add(road);

  for (let i = -7; i <= 7; i += 2) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, 0.08), materials.stripe);
    stripe.position.set(i, 0.06, 0);
    scene.add(stripe);
  }

  for (let i = 0; i < 12; i += 1) {
    const x = -18 + i * 3.2;
    addBuilding(x, -10.3, 1.6 + Math.random() * 2.8, 2 + Math.random() * 4);
    addBuilding(x + 1.2, 10.4, 1.3 + Math.random() * 2.5, 2 + Math.random() * 3.5);
  }

  addPortal(-13.7, 0x3c7cff);
  addPortal(13.7, 0xaaff55);
}

function addBuilding(x, z, width, height) {
  const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(0.58 + Math.random() * 0.08, 0.18, 0.16 + Math.random() * 0.08), roughness: 0.72 });
  const building = new THREE.Mesh(new THREE.BoxGeometry(width, height, 1.2), mat);
  building.position.set(x, height / 2 - 0.04, z);
  building.castShadow = true;
  building.receiveShadow = true;
  scene.add(building);

  const rows = Math.max(1, Math.floor(height / 0.9));
  for (let r = 0; r < rows; r += 1) {
    const win = new THREE.Mesh(new THREE.BoxGeometry(width * 0.55, 0.08, 0.04), materials.portal);
    win.position.set(x, 0.7 + r * 0.72, z + Math.sign(z) * -0.63);
    scene.add(win);
  }
}

function addPortal(x, color) {
  const group = new THREE.Group();
  const ringMat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.1, roughness: 0.35 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.08, 12, 44), ringMat);
  ring.rotation.x = Math.PI / 2;
  ring.castShadow = true;
  group.add(ring);
  const glow = new THREE.Mesh(new THREE.CylinderGeometry(1.02, 1.02, 0.06, 44), materials.portal);
  glow.rotation.x = Math.PI / 2;
  group.add(glow);
  group.position.set(x, 1.08, 0);
  scene.add(group);
  effects.push({ type: "portal", group, life: Infinity });
}

function createHero() {
  const group = new THREE.Group();
  addPart(group, new THREE.BoxGeometry(0.82, 1.05, 0.42), materials.player, [0, 1.15, 0], true);
  addPart(group, new THREE.SphereGeometry(0.36, 24, 16), materials.skin, [0, 1.88, 0], true);
  addPart(group, new THREE.BoxGeometry(0.95, 0.18, 0.48), materials.playerDark, [0, 1.58, 0], true);
  addLimb(group, -0.58, 1.26, 0, materials.playerDark, materials.glove);
  addLimb(group, 0.58, 1.26, 0, materials.playerDark, materials.glove);
  addLeg(group, -0.24);
  addLeg(group, 0.24);
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.08, 0.04), materials.eye);
  visor.position.set(0, 1.93, -0.33);
  group.add(visor);
  return group;
}

function addLimb(group, x, y, z, armMat, handMat) {
  addPart(group, new THREE.BoxGeometry(0.2, 0.7, 0.22), armMat, [x, y, z], true);
  addPart(group, new THREE.SphereGeometry(0.2, 18, 12), handMat, [x, y - 0.42, -0.04], true);
}

function addLeg(group, x) {
  addPart(group, new THREE.BoxGeometry(0.22, 0.7, 0.24), materials.playerDark, [x, 0.43, 0], true);
  addPart(group, new THREE.BoxGeometry(0.28, 0.14, 0.46), materials.glove, [x, 0.03, -0.1], true);
}

function addPart(group, geometry, material, pos, shadow) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(pos[0], pos[1], pos[2]);
  mesh.castShadow = shadow;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

function createAlien(boss = false) {
  const scale = boss ? 1.7 : 1;
  const group = new THREE.Group();
  const mat = boss ? materials.boss : materials.alien;
  addPart(group, new THREE.SphereGeometry(0.44 * scale, 24, 18), mat, [0, 1.16 * scale, 0], true);
  addPart(group, new THREE.SphereGeometry(0.36 * scale, 24, 16), mat, [0, 1.75 * scale, 0], true);
  addPart(group, new THREE.BoxGeometry(0.22 * scale, 0.58 * scale, 0.18 * scale), materials.alienDark, [-0.4 * scale, 0.8 * scale, 0], true);
  addPart(group, new THREE.BoxGeometry(0.22 * scale, 0.58 * scale, 0.18 * scale), materials.alienDark, [0.4 * scale, 0.8 * scale, 0], true);
  addPart(group, new THREE.BoxGeometry(0.22 * scale, 0.58 * scale, 0.18 * scale), materials.alienDark, [-0.18 * scale, 0.32 * scale, 0], true);
  addPart(group, new THREE.BoxGeometry(0.22 * scale, 0.58 * scale, 0.18 * scale), materials.alienDark, [0.18 * scale, 0.32 * scale, 0], true);
  addPart(group, new THREE.SphereGeometry(0.08 * scale, 12, 8), materials.eye, [-0.13 * scale, 1.82 * scale, -0.31 * scale], false);
  addPart(group, new THREE.SphereGeometry(0.08 * scale, 12, 8), materials.eye, [0.13 * scale, 1.82 * scale, -0.31 * scale], false);
  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.025 * scale, 0.025 * scale, 0.5 * scale, 8), materials.alienDark);
  antenna.position.set(0, 2.2 * scale, 0);
  antenna.rotation.z = 0.3;
  group.add(antenna);
  addPart(group, new THREE.SphereGeometry(0.08 * scale, 10, 8), mat, [0.08 * scale, 2.46 * scale, 0], false);
  return group;
}

function startWave() {
  waveActive = true;
  spawnQueue = 5 + Math.floor(player.wave * 1.8) + (player.wave % 5 === 0 ? 1 : 0);
  spawnTimer = 0.2;
  showBanner(`第 ${player.wave} 波`, 900);
}

function spawnAlien() {
  const boss = player.wave % 5 === 0 && spawnQueue === 1;
  const group = createAlien(boss);
  const side = spawnSide;
  spawnSide *= -1;
  group.position.set(side * 12.8, 0, THREE.MathUtils.randFloatSpread(7));
  group.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
  scene.add(group);
  aliens.push({
    group,
    hp: boss ? 260 + player.wave * 42 : 48 + player.wave * 10,
    maxHp: boss ? 260 + player.wave * 42 : 48 + player.wave * 10,
    speed: boss ? 1.15 + player.wave * 0.03 : 1.75 + player.wave * 0.045,
    damage: boss ? 18 : 8 + Math.floor(player.wave / 4),
    attack: 0,
    stun: 0,
    boss,
  });
}

function frame() {
  const delta = Math.min(0.033, clock.getDelta());
  if (!ended) update(delta);
  render();
  requestAnimationFrame(frame);
}

function update(delta) {
  player.attackCooldown = Math.max(0, player.attackCooldown - delta);
  player.dashCooldown = Math.max(0, player.dashCooldown - delta);
  player.invincible = Math.max(0, player.invincible - delta);
  player.comboTimer = Math.max(0, player.comboTimer - delta);
  if (player.comboTimer <= 0) player.combo = 0;
  player.energy = Math.min(100, player.energy + delta * 12);

  updateInput(delta);
  updateSpawning(delta);
  updateAliens(delta);
  updateProjectiles(delta);
  updateGrenades(delta);
  updateEffects(delta);
  updateCamera(delta);
  updateHud();
}

function updateInput(delta) {
  const dir = new THREE.Vector3(
    (keys.has("KeyD") || keys.has("ArrowRight") ? 1 : 0) - (keys.has("KeyA") || keys.has("ArrowLeft") ? 1 : 0),
    0,
    (keys.has("KeyS") || keys.has("ArrowDown") ? 1 : 0) - (keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0),
  );
  if (dir.lengthSq() > 0) dir.normalize();
  const speed = keys.has("ShiftLeft") ? 6 : 4.5;
  player.group.position.addScaledVector(dir, speed * delta);
  player.group.position.x = clamp(player.group.position.x, -arena.x, arena.x);
  player.group.position.z = clamp(player.group.position.z, -arena.z * 0.55, arena.z * 0.55);
  if (dir.lengthSq() > 0) {
    player.group.rotation.y = Math.atan2(dir.x, dir.z);
  }
}

function updateSpawning(delta) {
  if (!waveActive) return;
  spawnTimer -= delta;
  if (spawnTimer <= 0 && spawnQueue > 0) {
    spawnAlien();
    spawnQueue -= 1;
    spawnTimer = Math.max(0.28, 1.05 - player.wave * 0.035);
  }
  if (spawnQueue <= 0 && aliens.length === 0) {
    waveActive = false;
    player.wave += 1;
    player.weaponLevel = 1 + Math.floor(player.wave / 4);
    player.hp = Math.min(120, player.hp + 14);
    player.energy = 100;
    setTimeout(() => {
      if (!ended) startWave();
    }, 1000);
  }
}

function updateAliens(delta) {
  const p = player.group.position;
  for (const alien of aliens) {
    alien.stun = Math.max(0, alien.stun - delta);
    alien.attack = Math.max(0, alien.attack - delta);
    const pos = alien.group.position;
    const toPlayer = p.clone().sub(pos);
    const dist = toPlayer.length();
    if (alien.stun <= 0 && dist > 1.15) {
      toPlayer.normalize();
      pos.addScaledVector(toPlayer, alien.speed * delta);
      alien.group.rotation.y = Math.atan2(toPlayer.x, toPlayer.z);
    }
    alien.group.position.y = Math.sin(performance.now() * 0.006 + pos.x) * 0.035;
    if (dist < (alien.boss ? 1.65 : 1.15) && alien.attack <= 0) {
      damagePlayer(alien.damage);
      alien.attack = alien.boss ? 0.92 : 0.72;
      addRing(pos, alien.boss ? 0xff5e67 : 0xb7ff5a, alien.boss ? 1.6 : 1.0);
    }
  }
  aliens = aliens.filter((alien) => {
    if (alien.hp > 0) return true;
    scene.remove(alien.group);
    player.score += alien.boss ? 8 : 1;
    player.combo += 1;
    player.comboTimer = 2.2;
    player.energy = Math.min(100, player.energy + (alien.boss ? 30 : 9));
    addBurst(alien.group.position, alien.boss ? 0xff5e67 : 0xb7ff5a, alien.boss ? 18 : 10);
    return false;
  });
}

function updateProjectiles(delta) {
  for (const shot of projectiles) {
    shot.mesh.position.addScaledVector(shot.velocity, delta);
    shot.life -= delta;
    for (const alien of aliens) {
      if (alien.hp > 0 && shot.mesh.position.distanceTo(alien.group.position.clone().add(new THREE.Vector3(0, 1.1, 0))) < (alien.boss ? 1.25 : 0.75)) {
        alien.hp -= shot.damage;
        alien.stun = Math.max(alien.stun, 0.12);
        shot.life = 0;
        addBurst(shot.mesh.position, 0x6bdcff, 5);
        break;
      }
    }
  }
  projectiles = projectiles.filter((shot) => {
    if (shot.life > 0) return true;
    scene.remove(shot.mesh);
    return false;
  });
}

function updateGrenades(delta) {
  for (const grenade of grenades) {
    grenade.velocity.y -= 9.8 * delta;
    grenade.mesh.position.addScaledVector(grenade.velocity, delta);
    grenade.life -= delta;
    if (grenade.mesh.position.y < 0.15) {
      grenade.mesh.position.y = 0.15;
      grenade.velocity.y *= -0.35;
      grenade.velocity.x *= 0.8;
      grenade.velocity.z *= 0.8;
    }
    if (grenade.life <= 0) explode(grenade);
  }
  grenades = grenades.filter((grenade) => {
    if (!grenade.dead) return true;
    scene.remove(grenade.mesh);
    return false;
  });
}

function updateEffects(delta) {
  for (const effect of effects) {
    if (effect.type === "portal") {
      effect.group.rotation.z += delta * 0.9;
      continue;
    }
    effect.life -= delta;
    if (effect.mesh) {
      if (effect.velocity) {
        effect.velocity.y -= 5.5 * delta;
        effect.mesh.position.addScaledVector(effect.velocity, delta);
      }
      effect.mesh.scale.addScalar(delta * effect.grow);
      effect.mesh.material.opacity = Math.max(0, effect.life / effect.maxLife);
    }
  }
  effects = effects.filter((effect) => {
    if (effect.type === "portal" || effect.life > 0) return true;
    if (effect.mesh) scene.remove(effect.mesh);
    return false;
  });
}

function updateCamera(delta) {
  const target = player.group.position;
  const desired = new THREE.Vector3(target.x, 8.2, target.z + 11.5);
  camera.position.lerp(desired, 1 - Math.pow(0.001, delta));
  camera.lookAt(target.x, 0.9, target.z - 1.4);
}

function render() {
  renderer.render(scene, camera);
}

function melee(kind) {
  if (player.attackCooldown > 0) return;
  const heavy = kind === "kick";
  player.attackCooldown = heavy ? 0.48 : 0.25;
  const range = heavy ? 2.25 : 1.65 + Math.min(0.7, player.combo * 0.05);
  const damage = (heavy ? 32 : 20 + player.combo * 2) + player.weaponLevel * 4;
  const knock = heavy ? 2.1 : 1.0;
  const origin = player.group.position.clone();
  const forward = getForward();
  let hit = false;
  for (const alien of aliens) {
    const offset = alien.group.position.clone().sub(origin);
    const dist = offset.length();
    const facing = offset.normalize().dot(forward);
    if (dist <= range && facing > -0.18) {
      alien.hp -= damage;
      alien.stun = heavy ? 0.36 : 0.18;
      alien.group.position.addScaledVector(forward, knock);
      hit = true;
      addBurst(alien.group.position.clone().add(new THREE.Vector3(0, 1, 0)), heavy ? 0xffd166 : 0x6bdcff, heavy ? 9 : 6);
    }
  }
  if (hit) {
    player.combo += 1;
    player.comboTimer = 2.2;
  }
  swingArm(heavy);
}

function shoot() {
  if (player.attackCooldown > 0 || player.energy < 14) return;
  player.energy -= 14;
  player.attackCooldown = 0.18;
  const forward = getForward();
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.13 + player.weaponLevel * 0.015, 18, 12), materials.blast);
  mesh.position.copy(player.group.position).add(new THREE.Vector3(0, 1.25, 0)).addScaledVector(forward, 0.75);
  scene.add(mesh);
  projectiles.push({
    mesh,
    velocity: forward.multiplyScalar(14 + player.weaponLevel * 1.8),
    damage: 22 + player.weaponLevel * 7,
    life: 1.15,
  });
}

function throwGrenade() {
  if (player.attackCooldown > 0 || player.energy < 38) return;
  player.energy -= 38;
  player.attackCooldown = 0.35;
  const forward = getForward();
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 10), materials.fire);
  mesh.position.copy(player.group.position).add(new THREE.Vector3(0, 1.2, 0)).addScaledVector(forward, 0.55);
  scene.add(mesh);
  grenades.push({
    mesh,
    velocity: forward.multiplyScalar(7.8).add(new THREE.Vector3(0, 4.4, 0)),
    life: 0.72,
    dead: false,
  });
}

function explode(grenade) {
  grenade.dead = true;
  const pos = grenade.mesh.position;
  addRing(pos, 0xff8b3d, 2.6);
  for (const alien of aliens) {
    const dist = alien.group.position.distanceTo(pos);
    if (dist <= 3) {
      alien.hp -= Math.round(76 * (1 - dist / 4));
      alien.stun = 0.5;
      alien.group.position.add(alien.group.position.clone().sub(pos).setY(0).normalize().multiplyScalar(1.7));
    }
  }
}

function dash() {
  if (player.dashCooldown > 0 || player.energy < 18) return;
  player.energy -= 18;
  player.dashCooldown = 0.75;
  player.invincible = 0.22;
  player.group.position.addScaledVector(getForward(), 3.2);
  player.group.position.x = clamp(player.group.position.x, -arena.x, arena.x);
  player.group.position.z = clamp(player.group.position.z, -arena.z * 0.55, arena.z * 0.55);
  addRing(player.group.position, 0x6bdcff, 1.4);
}

function damagePlayer(amount) {
  if (player.invincible > 0) return;
  player.hp -= amount;
  player.invincible = 0.34;
  addRing(player.group.position, 0xff5e67, 1.15);
  if (player.hp <= 0) {
    ended = true;
    showBanner(`被外星人包围了<br>击败 ${player.score} 个`, Infinity);
  }
}

function getForward() {
  return new THREE.Vector3(Math.sin(player.group.rotation.y), 0, Math.cos(player.group.rotation.y)).normalize();
}

function swingArm(heavy) {
  const arm = player.group.children[4];
  if (!arm) return;
  arm.rotation.x = heavy ? -1.6 : -1.05;
  setTimeout(() => { arm.rotation.x = 0; }, heavy ? 180 : 110);
}

function addBurst(position, color, count) {
  for (let i = 0; i < count; i += 1) {
    const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.9, transparent: true, opacity: 0.95 });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.045 + Math.random() * 0.055, 8, 6), mat);
    mesh.position.copy(position);
    scene.add(mesh);
    const velocity = new THREE.Vector3(THREE.MathUtils.randFloatSpread(4), Math.random() * 3, THREE.MathUtils.randFloatSpread(4));
    effects.push({ type: "spark", mesh, velocity, life: 0.45, maxLife: 0.45, grow: 0.4 });
  }
}

function addRing(position, color, scale) {
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.65, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(new THREE.RingGeometry(0.35, 0.42, 40), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.copy(position).setY(0.08);
  mesh.scale.setScalar(scale);
  scene.add(mesh);
  effects.push({ type: "ring", mesh, life: 0.34, maxLife: 0.34, grow: 2.2 });
}

function updateHud() {
  hpEl.textContent = Math.max(0, Math.round(player.hp));
  energyEl.textContent = Math.round(player.energy);
  waveEl.textContent = player.wave;
  scoreEl.textContent = player.score;
  comboEl.textContent = player.combo;
}

function showBanner(text, ms) {
  banner.innerHTML = text;
  banner.classList.remove("hidden");
  if (ms !== Infinity) {
    setTimeout(() => banner.classList.add("hidden"), ms);
  }
}

function resetGame() {
  for (const alien of aliens) scene.remove(alien.group);
  for (const shot of projectiles) scene.remove(shot.mesh);
  for (const grenade of grenades) scene.remove(grenade.mesh);
  aliens = [];
  projectiles = [];
  grenades = [];
  player.hp = 100;
  player.energy = 100;
  player.score = 0;
  player.combo = 0;
  player.wave = 1;
  player.weaponLevel = 1;
  player.group.position.set(-4, 0, 0);
  player.group.rotation.set(0, 0, 0);
  spawnSide = -1;
  ended = false;
  banner.classList.add("hidden");
  startWave();
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function resize() {
  const rect = canvas.parentElement.getBoundingClientRect();
  renderer.setSize(rect.width, rect.height, false);
  camera.aspect = rect.width / rect.height;
  camera.updateProjectionMatrix();
}

window.addEventListener("resize", resize);
window.addEventListener("keydown", (event) => {
  keys.add(event.code);
  if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.code)) event.preventDefault();
  if (ended && event.code !== "KeyR") return;
  if (event.code === "KeyJ") melee("punch");
  if (event.code === "KeyK") melee("kick");
  if (event.code === "KeyL") shoot();
  if (event.code === "KeyI") throwGrenade();
  if (event.code === "Space") dash();
  if (event.code === "KeyR") resetGame();
});
window.addEventListener("keyup", (event) => {
  keys.delete(event.code);
});
