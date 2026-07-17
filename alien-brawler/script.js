import * as THREE from "../shared/three.module.min.js";

const canvas = document.querySelector("#stage");
const hpEl = document.querySelector("#hp");
const energyEl = document.querySelector("#energy");
const waveEl = document.querySelector("#wave");
const scoreEl = document.querySelector("#score");
const comboEl = document.querySelector("#combo");
const banner = document.querySelector("#banner");

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x07111d);
scene.fog = new THREE.Fog(0x07111d, 24, 62);

const camera = new THREE.PerspectiveCamera(46, 16 / 9, 0.1, 120);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const clock = new THREE.Clock();
const keys = new Set();
const arena = { x: 15.5, z: 3.6 };
const blackMat = new THREE.MeshBasicMaterial({ color: 0x071018, side: THREE.BackSide });

const mat = {
  road: toon(0x263443),
  curb: toon(0x5e7180),
  stripe: toon(0xf4d06f),
  skin: toon(0xf0bf83),
  hair: toon(0x181a20),
  shirt: toon(0x236dff),
  shirtDark: toon(0x123368),
  pants: toon(0x18294d),
  glove: toon(0xffcf4a),
  sole: toon(0xf4f8ff),
  alien: toon(0x9dff63),
  alienDark: toon(0x2e6945),
  alienBelly: toon(0xd9ff8f),
  boss: toon(0xff5e67),
  eye: new THREE.MeshStandardMaterial({ color: 0xf7fdff, emissive: 0x79eaff, emissiveIntensity: 0.55, roughness: 0.35 }),
  portal: new THREE.MeshStandardMaterial({ color: 0x68ddff, emissive: 0x1dbfff, emissiveIntensity: 1.4, transparent: true, opacity: 0.55 }),
  blast: new THREE.MeshStandardMaterial({ color: 0x68ddff, emissive: 0x20cbff, emissiveIntensity: 1.9 }),
  fire: new THREE.MeshStandardMaterial({ color: 0xff8b3d, emissive: 0xff5e20, emissiveIntensity: 1.5 }),
};

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
  action: "idle",
  actionTime: 0,
  actionDuration: 0,
  punchStep: 0,
  moveSpeed: 0,
  animTime: 0,
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
let cameraShake = 0;

init();
requestAnimationFrame(frame);

function toon(color) {
  return new THREE.MeshToonMaterial({ color });
}

function init() {
  createLights();
  createStage();
  player.group = createHero();
  player.group.position.set(-4, 0, 0);
  player.group.rotation.y = -Math.PI / 2;
  scene.add(player.group);
  resize();
  startWave();
}

function createLights() {
  scene.add(new THREE.HemisphereLight(0xbdf3ff, 0x151923, 1.8));
  const sun = new THREE.DirectionalLight(0xffffff, 2.25);
  sun.position.set(6, 12, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -24;
  sun.shadow.camera.right = 24;
  sun.shadow.camera.top = 18;
  sun.shadow.camera.bottom = -18;
  scene.add(sun);
  const fill = new THREE.PointLight(0x68ddff, 2.8, 26);
  fill.position.set(0, 4, 8);
  scene.add(fill);
}

function createStage() {
  const floor = new THREE.Mesh(new THREE.BoxGeometry(38, 0.5, 11), mat.road);
  floor.position.y = -0.25;
  floor.receiveShadow = true;
  scene.add(floor);

  for (let z of [-3.9, 3.9]) {
    const curb = new THREE.Mesh(new THREE.BoxGeometry(38, 0.22, 0.35), mat.curb);
    curb.position.set(0, 0.02, z);
    curb.receiveShadow = true;
    scene.add(curb);
  }

  for (let x = -14; x <= 14; x += 3) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.06, 0.08), mat.stripe);
    stripe.position.set(x, 0.07, 0);
    scene.add(stripe);
  }

  for (let i = 0; i < 13; i += 1) {
    addBuilding(-18 + i * 3.2, -6.2, 1.6 + Math.random() * 1.5, 2.4 + Math.random() * 3.8);
  }
  addPortal(-13.2, 0x4b83ff);
  addPortal(13.2, 0xaaff55);
}

function addBuilding(x, z, width, height) {
  const body = new THREE.Mesh(new THREE.BoxGeometry(width, height, 1.2), toon(0x2c3b4d + Math.floor(Math.random() * 0x101010)));
  body.position.set(x, height / 2 - 0.05, z);
  body.castShadow = true;
  body.receiveShadow = true;
  scene.add(body);
  for (let y = 0.8; y < height - 0.2; y += 0.7) {
    const win = new THREE.Mesh(new THREE.BoxGeometry(width * 0.55, 0.09, 0.04), mat.portal);
    win.position.set(x, y, z + 0.62);
    scene.add(win);
  }
}

function addPortal(x, color) {
  const group = new THREE.Group();
  const ringMat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.2, roughness: 0.3 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.08, 12, 48), ringMat);
  ring.rotation.x = Math.PI / 2;
  group.add(ring);
  const core = new THREE.Mesh(new THREE.CylinderGeometry(0.82, 0.82, 0.06, 48), mat.portal);
  core.rotation.x = Math.PI / 2;
  group.add(core);
  group.position.set(x, 1.08, 0);
  scene.add(group);
  effects.push({ type: "portal", group, life: Infinity });
}

function outlined(geometry, material, scale = 1.055) {
  const group = new THREE.Group();
  const edge = new THREE.Mesh(geometry, blackMat);
  edge.scale.setScalar(scale);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(edge, mesh);
  group.mesh = mesh;
  return group;
}

function makeJoint(x, y, z) {
  const joint = new THREE.Group();
  joint.position.set(x, y, z);
  return joint;
}

function createHero() {
  const root = new THREE.Group();
  const body = outlined(new THREE.CapsuleGeometry(0.38, 0.7, 5, 14), mat.shirt);
  body.position.set(0, 1.1, 0);
  body.rotation.z = -0.04;
  root.add(body);

  const belly = outlined(new THREE.SphereGeometry(0.34, 20, 12), mat.shirtDark, 1.04);
  belly.scale.set(1, 0.7, 0.72);
  belly.position.set(0.03, 1.02, -0.02);
  root.add(belly);

  const neck = outlined(new THREE.CapsuleGeometry(0.13, 0.12, 4, 10), mat.skin);
  neck.position.set(0, 1.55, 0);
  root.add(neck);

  const head = outlined(new THREE.SphereGeometry(0.48, 26, 18), mat.skin);
  head.scale.set(1.02, 1.08, 0.95);
  head.position.set(0, 1.98, 0);
  root.add(head);

  const hair = outlined(new THREE.SphereGeometry(0.5, 22, 12), mat.hair, 1.035);
  hair.scale.set(1.03, 0.45, 0.96);
  hair.position.set(0, 2.22, -0.03);
  root.add(hair);

  const face = new THREE.Group();
  face.position.set(0, 1.98, -0.42);
  root.add(face);
  addFace(face);

  const leftArm = makeArm(-0.42, 1.42, 0, -1);
  const rightArm = makeArm(0.42, 1.42, 0, 1);
  root.add(leftArm.joint, rightArm.joint);
  const leftLeg = makeLeg(-0.23, 0.72, 0);
  const rightLeg = makeLeg(0.23, 0.72, 0);
  root.add(leftLeg.joint, rightLeg.joint);

  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.75, 32), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28 }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.015;
  root.add(shadow);

  root.userData.parts = { body, belly, neck, head, hair, face, leftArm, rightArm, leftLeg, rightLeg };
  return root;
}

function addFace(face) {
  const eyeGeo = new THREE.SphereGeometry(0.055, 12, 8);
  const mouthGeo = new THREE.BoxGeometry(0.2, 0.035, 0.025);
  const leftEye = new THREE.Mesh(eyeGeo, blackMat);
  const rightEye = new THREE.Mesh(eyeGeo, blackMat);
  leftEye.position.set(-0.16, 0.07, 0);
  rightEye.position.set(0.16, 0.07, 0);
  const mouth = new THREE.Mesh(mouthGeo, blackMat);
  mouth.position.set(0, -0.12, 0);
  face.add(leftEye, rightEye, mouth);
}

function makeArm(x, y, z, side) {
  const joint = makeJoint(x, y, z);
  const upper = outlined(new THREE.CapsuleGeometry(0.105, 0.38, 4, 10), mat.shirtDark);
  upper.position.y = -0.22;
  upper.rotation.z = side * 0.12;
  const glove = outlined(new THREE.SphereGeometry(0.19, 18, 12), mat.glove, 1.06);
  glove.scale.set(1.18, 1, 1);
  glove.position.set(side * 0.03, -0.52, -0.02);
  joint.add(upper, glove);
  return { joint, upper, glove, base: joint.position.clone(), side };
}

function makeLeg(x, y, z) {
  const joint = makeJoint(x, y, z);
  const leg = outlined(new THREE.CapsuleGeometry(0.12, 0.48, 4, 10), mat.pants);
  leg.position.y = -0.28;
  const shoe = outlined(new THREE.BoxGeometry(0.32, 0.15, 0.48), mat.sole, 1.04);
  shoe.position.set(0, -0.58, -0.1);
  joint.add(leg, shoe);
  return { joint, leg, shoe, base: joint.position.clone() };
}

function createAlien(boss = false) {
  const scale = boss ? 1.45 : 1;
  const root = new THREE.Group();
  const bodyMat = boss ? mat.boss : mat.alien;
  const body = outlined(new THREE.SphereGeometry(0.48 * scale, 24, 16), bodyMat);
  body.scale.set(1.08, 1.24, 0.86);
  body.position.set(0, 0.98 * scale, 0);
  root.add(body);

  const belly = outlined(new THREE.SphereGeometry(0.26 * scale, 18, 10), mat.alienBelly, 1.035);
  belly.scale.set(1.15, 0.75, 0.42);
  belly.position.set(0, 0.88 * scale, -0.36 * scale);
  root.add(belly);

  const head = outlined(new THREE.SphereGeometry(0.45 * scale, 26, 16), bodyMat);
  head.scale.set(1.05, 0.92, 1);
  head.position.set(0, 1.62 * scale, 0);
  root.add(head);

  const face = new THREE.Group();
  face.position.set(0, 1.62 * scale, -0.42 * scale);
  root.add(face);
  const eyeGeo = new THREE.SphereGeometry(0.09 * scale, 12, 8);
  const leftEye = new THREE.Mesh(eyeGeo, mat.eye);
  const rightEye = new THREE.Mesh(eyeGeo, mat.eye);
  leftEye.position.set(-0.16 * scale, 0.04 * scale, 0);
  rightEye.position.set(0.16 * scale, 0.04 * scale, 0);
  face.add(leftEye, rightEye);

  const leftArm = makeAlienArm(-0.45 * scale, 1.12 * scale, scale, -1);
  const rightArm = makeAlienArm(0.45 * scale, 1.12 * scale, scale, 1);
  const leftLeg = makeAlienLeg(-0.2 * scale, 0.46 * scale, scale);
  const rightLeg = makeAlienLeg(0.2 * scale, 0.46 * scale, scale);
  root.add(leftArm.joint, rightArm.joint, leftLeg.joint, rightLeg.joint);

  const antenna = makeJoint(0, 1.98 * scale, 0);
  const stalk = outlined(new THREE.CapsuleGeometry(0.025 * scale, 0.46 * scale, 4, 8), mat.alienDark);
  stalk.position.y = 0.25 * scale;
  stalk.rotation.z = 0.22;
  const bulb = outlined(new THREE.SphereGeometry(0.09 * scale, 12, 8), bodyMat, 1.04);
  bulb.position.set(0.1 * scale, 0.5 * scale, 0);
  antenna.add(stalk, bulb);
  root.add(antenna);

  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.66 * scale, 32), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.24 }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.018;
  root.add(shadow);

  root.userData.parts = { body, belly, head, face, leftArm, rightArm, leftLeg, rightLeg, antenna };
  root.userData.animTime = Math.random() * 20;
  root.userData.scale = scale;
  return root;
}

function makeAlienArm(x, y, scale, side) {
  const joint = makeJoint(x, y, 0);
  const arm = outlined(new THREE.CapsuleGeometry(0.075 * scale, 0.42 * scale, 4, 10), mat.alienDark);
  arm.position.y = -0.24 * scale;
  arm.rotation.z = side * 0.22;
  const hand = outlined(new THREE.SphereGeometry(0.12 * scale, 12, 8), mat.alienDark, 1.04);
  hand.position.set(side * 0.04 * scale, -0.5 * scale, -0.03 * scale);
  joint.add(arm, hand);
  return { joint, arm, hand, base: joint.position.clone(), side };
}

function makeAlienLeg(x, y, scale) {
  const joint = makeJoint(x, y, 0);
  const leg = outlined(new THREE.CapsuleGeometry(0.085 * scale, 0.32 * scale, 4, 10), mat.alienDark);
  leg.position.y = -0.2 * scale;
  const foot = outlined(new THREE.BoxGeometry(0.25 * scale, 0.12 * scale, 0.34 * scale), mat.alienDark, 1.04);
  foot.position.set(0, -0.38 * scale, -0.06 * scale);
  joint.add(leg, foot);
  return { joint, leg, foot, base: joint.position.clone() };
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
  group.position.set(side * 12.8, 0, THREE.MathUtils.randFloatSpread(4.8));
  group.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
  scene.add(group);
  aliens.push({
    group,
    hp: boss ? 260 + player.wave * 42 : 48 + player.wave * 10,
    maxHp: boss ? 260 + player.wave * 42 : 48 + player.wave * 10,
    speed: boss ? 1.12 + player.wave * 0.03 : 1.75 + player.wave * 0.045,
    damage: boss ? 18 : 8 + Math.floor(player.wave / 4),
    attack: 0,
    stun: 0,
    hitFlash: 0,
    boss,
  });
}

function frame() {
  const delta = Math.min(0.033, clock.getDelta());
  if (!ended) update(delta);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

function update(delta) {
  player.attackCooldown = Math.max(0, player.attackCooldown - delta);
  player.dashCooldown = Math.max(0, player.dashCooldown - delta);
  player.invincible = Math.max(0, player.invincible - delta);
  player.comboTimer = Math.max(0, player.comboTimer - delta);
  player.actionTime = Math.max(0, player.actionTime - delta);
  cameraShake = Math.max(0, cameraShake - delta * 4.5);
  if (player.actionTime <= 0) player.action = "idle";
  if (player.comboTimer <= 0) player.combo = 0;
  player.energy = Math.min(100, player.energy + delta * 12);

  updateInput(delta);
  updatePlayerAnimation(delta);
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
  const run = keys.has("ShiftLeft") ? 1.25 : 1;
  const targetSpeed = dir.lengthSq() > 0 ? 4.7 * run : 0;
  player.moveSpeed += (targetSpeed - player.moveSpeed) * (1 - Math.pow(0.001, delta));
  player.group.position.addScaledVector(dir, player.moveSpeed * delta);
  player.group.position.x = clamp(player.group.position.x, -arena.x, arena.x);
  player.group.position.z = clamp(player.group.position.z, -arena.z, arena.z);
  if (Math.abs(dir.x) > 0.08 && player.action !== "punch" && player.action !== "kick") {
    const targetRot = dir.x > 0 ? Math.PI / 2 : -Math.PI / 2;
    player.group.rotation.y = lerpAngle(player.group.rotation.y, targetRot, 1 - Math.pow(0.0004, delta));
  }
}

function updatePlayerAnimation(delta) {
  player.animTime += delta * (4 + player.moveSpeed * 1.6);
  const p = player.group.userData.parts;
  const walk = Math.min(1, player.moveSpeed / 4.5);
  const bob = Math.sin(player.animTime * 2) * 0.055 * walk;
  player.group.position.y = Math.max(0, bob);
  resetHeroPose(p);

  p.body.rotation.z = Math.sin(player.animTime * 2) * 0.055 * walk;
  p.head.rotation.z = -p.body.rotation.z * 0.45;
  p.leftArm.joint.rotation.x = Math.sin(player.animTime * 2) * 0.75 * walk;
  p.rightArm.joint.rotation.x = -Math.sin(player.animTime * 2) * 0.75 * walk;
  p.leftLeg.joint.rotation.x = -Math.sin(player.animTime * 2) * 0.58 * walk;
  p.rightLeg.joint.rotation.x = Math.sin(player.animTime * 2) * 0.58 * walk;

  if (player.action === "punch") posePunch(p);
  if (player.action === "kick") poseKick(p);
  if (player.action === "shoot") poseShoot(p);
  if (player.action === "grenade") poseGrenade(p);
  if (player.action === "dash") poseDash(p);
  if (player.invincible > 0) player.group.scale.setScalar(1 + Math.sin(performance.now() * 0.04) * 0.025);
  else player.group.scale.setScalar(1);
}

function resetHeroPose(p) {
  for (const limb of [p.leftArm, p.rightArm, p.leftLeg, p.rightLeg]) {
    limb.joint.rotation.set(0, 0, 0);
    limb.joint.position.copy(limb.base);
  }
  p.body.rotation.set(-0.02, 0, 0);
  p.belly.rotation.set(0, 0, 0);
  p.head.rotation.set(0, 0, 0);
  p.hair.rotation.set(0, 0, 0);
}

function actionProgress() {
  return 1 - clamp(player.actionTime / player.actionDuration, 0, 1);
}

function posePunch(p) {
  const t = actionProgress();
  const snap = Math.sin(Math.min(1, t * 1.35) * Math.PI);
  const out = easeOutBack(clamp((t - 0.08) / 0.34, 0, 1));
  const recover = easeOut(clamp((t - 0.48) / 0.52, 0, 1));
  const side = player.punchStep % 2 === 0 ? 1 : -1;
  const arm = side > 0 ? p.rightArm : p.leftArm;
  const other = side > 0 ? p.leftArm : p.rightArm;
  p.body.rotation.z = -side * 0.22 * snap;
  p.head.rotation.z = side * 0.1 * snap;
  arm.joint.rotation.x = -1.2 * out + 1.2 * recover;
  arm.joint.rotation.z = -side * 0.72 * out + side * 0.72 * recover;
  arm.joint.position.z = -0.42 * out + 0.42 * recover;
  arm.glove.scale.set(1 + 0.58 * out, 1 + 0.18 * out, 1 + 0.58 * out);
  other.joint.rotation.x = 0.55 * snap;
}

function poseKick(p) {
  const t = actionProgress();
  const wind = easeOut(clamp(t / 0.3, 0, 1));
  const strike = easeOutBack(clamp((t - 0.18) / 0.34, 0, 1));
  const leg = p.rightLeg;
  const arm = p.leftArm;
  p.body.rotation.z = -0.28 * strike;
  p.body.rotation.x = -0.18 * wind;
  leg.joint.rotation.x = -1.25 * strike;
  leg.joint.rotation.z = -0.35 * strike;
  leg.joint.position.z = -0.62 * strike;
  leg.shoe.scale.set(1.35, 1, 1.25);
  arm.joint.rotation.x = 0.75 * strike;
  p.head.rotation.z = 0.16 * strike;
}

function poseShoot(p) {
  const t = actionProgress();
  const out = easeOutBack(clamp(t / 0.46, 0, 1));
  p.body.rotation.z = -0.12 * out;
  p.rightArm.joint.rotation.x = -1.38 * out;
  p.rightArm.joint.position.z = -0.35 * out;
  p.rightArm.glove.scale.set(1.22, 1, 1.22);
  p.leftArm.joint.rotation.x = -0.55 * out;
}

function poseGrenade(p) {
  const t = actionProgress();
  const throwT = Math.sin(clamp(t, 0, 1) * Math.PI);
  p.body.rotation.z = -0.24 * throwT;
  p.rightArm.joint.rotation.x = -2.2 * throwT;
  p.rightArm.joint.rotation.z = -0.45 * throwT;
  p.head.rotation.x = -0.14 * throwT;
}

function poseDash(p) {
  const t = actionProgress();
  const lean = Math.sin(t * Math.PI);
  p.body.rotation.x = -0.48 * lean;
  p.head.rotation.x = 0.18 * lean;
  p.leftArm.joint.rotation.x = 0.9 * lean;
  p.rightArm.joint.rotation.x = 0.9 * lean;
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
    alien.hitFlash = Math.max(0, alien.hitFlash - delta);
    const pos = alien.group.position;
    const toPlayer = p.clone().sub(pos);
    const dist = toPlayer.length();
    if (alien.stun <= 0 && dist > (alien.boss ? 1.45 : 1.05)) {
      toPlayer.normalize();
      pos.addScaledVector(toPlayer, alien.speed * delta);
      alien.group.rotation.y = lerpAngle(alien.group.rotation.y, Math.atan2(toPlayer.x, toPlayer.z), 0.16);
    }
    animateAlien(alien, delta, dist);
    if (dist < (alien.boss ? 1.75 : 1.18) && alien.attack <= 0) {
      alien.attack = alien.boss ? 0.92 : 0.72;
      alien.group.userData.attackFlash = 0.28;
      damagePlayer(alien.damage);
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
    addBurst(alien.group.position, alien.boss ? 0xff5e67 : 0xb7ff5a, alien.boss ? 22 : 12);
    cameraShake = Math.max(cameraShake, alien.boss ? 0.55 : 0.25);
    return false;
  });
}

function animateAlien(alien, delta, dist) {
  const group = alien.group;
  const parts = group.userData.parts;
  const scale = group.userData.scale;
  group.userData.animTime += delta * (alien.stun > 0 ? 12 : 6.5);
  group.userData.attackFlash = Math.max(0, (group.userData.attackFlash || 0) - delta);
  const t = group.userData.animTime;
  const walk = alien.stun > 0 ? 0.2 : clamp(dist / 5, 0.25, 1);
  const hop = Math.abs(Math.sin(t * 2.2)) * 0.07 * scale * walk;
  group.position.y = hop;
  group.scale.setScalar(1 + (alien.hitFlash > 0 ? 0.08 : 0));
  parts.body.rotation.z = Math.sin(t * 2) * 0.1 * walk;
  parts.head.rotation.z = -parts.body.rotation.z * 0.8;
  parts.leftArm.joint.rotation.x = Math.sin(t * 2) * 0.75 * walk;
  parts.rightArm.joint.rotation.x = -Math.sin(t * 2) * 0.75 * walk;
  parts.leftLeg.joint.rotation.x = -Math.sin(t * 2) * 0.55 * walk;
  parts.rightLeg.joint.rotation.x = Math.sin(t * 2) * 0.55 * walk;
  parts.antenna.rotation.z = Math.sin(t * 3.3) * 0.18;
  if (alien.stun > 0) {
    group.rotation.z = Math.sin(t * 10) * 0.08;
    parts.head.rotation.x = 0.35;
  } else {
    group.rotation.z *= 0.8;
  }
  if (group.userData.attackFlash > 0) {
    const a = Math.sin((1 - group.userData.attackFlash / 0.28) * Math.PI);
    parts.leftArm.joint.rotation.x = -1.4 * a;
    parts.rightArm.joint.rotation.x = -1.4 * a;
    parts.body.rotation.x = -0.2 * a;
  }
}

function updateProjectiles(delta) {
  for (const shot of projectiles) {
    shot.mesh.position.addScaledVector(shot.velocity, delta);
    shot.life -= delta;
    for (const alien of aliens) {
      if (alien.hp > 0 && shot.mesh.position.distanceTo(alien.group.position.clone().add(new THREE.Vector3(0, 1.1, 0))) < (alien.boss ? 1.25 : 0.75)) {
        alien.hp -= shot.damage;
        alien.stun = Math.max(alien.stun, 0.16);
        alien.hitFlash = 0.12;
        shot.life = 0;
        addBurst(shot.mesh.position, 0x68ddff, 7);
        cameraShake = Math.max(cameraShake, 0.16);
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
    grenade.mesh.rotation.x += delta * 12;
    grenade.mesh.rotation.z += delta * 9;
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
      effect.group.rotation.z += delta * 1.3;
      effect.group.scale.setScalar(1 + Math.sin(performance.now() * 0.004) * 0.04);
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
  const shakeX = (Math.random() - 0.5) * cameraShake * 0.25;
  const shakeY = (Math.random() - 0.5) * cameraShake * 0.18;
  const desired = new THREE.Vector3(target.x * 0.82 + shakeX, 5.1 + shakeY, 10.6);
  camera.position.lerp(desired, 1 - Math.pow(0.001, delta));
  camera.lookAt(target.x * 0.82, 1.15, -0.7);
}

function melee(kind) {
  if (player.attackCooldown > 0) return;
  const heavy = kind === "kick";
  player.punchStep += heavy ? 0 : 1;
  player.action = heavy ? "kick" : "punch";
  player.actionDuration = heavy ? 0.5 : 0.32;
  player.actionTime = player.actionDuration;
  player.attackCooldown = heavy ? 0.44 : 0.22;
  const range = heavy ? 2.35 : 1.72 + Math.min(0.75, player.combo * 0.05);
  const damage = (heavy ? 34 : 19 + player.combo * 2) + player.weaponLevel * 4;
  const knock = heavy ? 2.2 : 1.05;
  const origin = player.group.position.clone();
  const forward = getForward();
  let hit = false;
  for (const alien of aliens) {
    const offset = alien.group.position.clone().sub(origin);
    const dist = offset.length();
    const facing = offset.normalize().dot(forward);
    if (dist <= range && facing > -0.12) {
      alien.hp -= damage;
      alien.stun = heavy ? 0.38 : 0.19;
      alien.hitFlash = 0.14;
      alien.group.position.addScaledVector(forward, knock);
      hit = true;
      addBurst(alien.group.position.clone().add(new THREE.Vector3(0, 1.05, 0)), heavy ? 0xffd166 : 0x68ddff, heavy ? 13 : 8);
    }
  }
  if (hit) {
    player.combo += 1;
    player.comboTimer = 2.4;
    cameraShake = Math.max(cameraShake, heavy ? 0.28 : 0.18);
  }
}

function shoot() {
  if (player.attackCooldown > 0 || player.energy < 14) return;
  player.energy -= 14;
  player.attackCooldown = 0.18;
  player.action = "shoot";
  player.actionDuration = 0.25;
  player.actionTime = player.actionDuration;
  const forward = getForward();
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.13 + player.weaponLevel * 0.015, 18, 12), mat.blast);
  mesh.position.copy(player.group.position).add(new THREE.Vector3(0, 1.28, 0)).addScaledVector(forward, 0.75);
  scene.add(mesh);
  projectiles.push({
    mesh,
    velocity: forward.multiplyScalar(15 + player.weaponLevel * 1.8),
    damage: 22 + player.weaponLevel * 7,
    life: 1.15,
  });
}

function throwGrenade() {
  if (player.attackCooldown > 0 || player.energy < 38) return;
  player.energy -= 38;
  player.attackCooldown = 0.34;
  player.action = "grenade";
  player.actionDuration = 0.42;
  player.actionTime = player.actionDuration;
  const forward = getForward();
  const mesh = outlined(new THREE.SphereGeometry(0.18, 16, 10), mat.fire, 1.08);
  mesh.position.copy(player.group.position).add(new THREE.Vector3(0, 1.35, 0)).addScaledVector(forward, 0.55);
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
  addRing(pos, 0xff8b3d, 2.8);
  cameraShake = Math.max(cameraShake, 0.5);
  for (const alien of aliens) {
    const dist = alien.group.position.distanceTo(pos);
    if (dist <= 3.2) {
      alien.hp -= Math.round(82 * (1 - dist / 4));
      alien.stun = 0.54;
      alien.hitFlash = 0.16;
      alien.group.position.add(alien.group.position.clone().sub(pos).setY(0).normalize().multiplyScalar(1.8));
    }
  }
}

function dash() {
  if (player.dashCooldown > 0 || player.energy < 18) return;
  player.energy -= 18;
  player.dashCooldown = 0.75;
  player.invincible = 0.22;
  player.action = "dash";
  player.actionDuration = 0.2;
  player.actionTime = player.actionDuration;
  player.group.position.addScaledVector(getForward(), 3.2);
  player.group.position.x = clamp(player.group.position.x, -arena.x, arena.x);
  player.group.position.z = clamp(player.group.position.z, -arena.z, arena.z);
  addRing(player.group.position, 0x68ddff, 1.4);
}

function damagePlayer(amount) {
  if (player.invincible > 0) return;
  player.hp -= amount;
  player.invincible = 0.34;
  cameraShake = Math.max(cameraShake, 0.35);
  addRing(player.group.position, 0xff5e67, 1.15);
  if (player.hp <= 0) {
    ended = true;
    showBanner(`被外星人包围了<br>击败 ${player.score} 个`, Infinity);
  }
}

function getForward() {
  return new THREE.Vector3(Math.sin(player.group.rotation.y), 0, Math.cos(player.group.rotation.y)).normalize();
}

function addBurst(position, color, count) {
  for (let i = 0; i < count; i += 1) {
    const sparkMat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.1, transparent: true, opacity: 0.95 });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.05 + Math.random() * 0.075, 8, 6), sparkMat);
    mesh.position.copy(position);
    scene.add(mesh);
    const velocity = new THREE.Vector3(THREE.MathUtils.randFloatSpread(4.4), Math.random() * 3.4, THREE.MathUtils.randFloatSpread(3.2));
    effects.push({ type: "spark", mesh, velocity, life: 0.45, maxLife: 0.45, grow: 0.55 });
  }
}

function addRing(position, color, scale) {
  const ringMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.68, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(new THREE.RingGeometry(0.35, 0.44, 40), ringMat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.copy(position).setY(0.08);
  mesh.scale.setScalar(scale);
  scene.add(mesh);
  effects.push({ type: "ring", mesh, life: 0.34, maxLife: 0.34, grow: 2.3 });
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
  if (ms !== Infinity) setTimeout(() => banner.classList.add("hidden"), ms);
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
  player.action = "idle";
  player.actionTime = 0;
  player.group.position.set(-4, 0, 0);
  player.group.rotation.set(0, -Math.PI / 2, 0);
  spawnSide = -1;
  ended = false;
  banner.classList.add("hidden");
  startWave();
}

function easeOut(t) {
  return 1 - Math.pow(1 - t, 3);
}

function easeOutBack(t) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

function lerpAngle(a, b, t) {
  const diff = Math.atan2(Math.sin(b - a), Math.cos(b - a));
  return a + diff * t;
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
