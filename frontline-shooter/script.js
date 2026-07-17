const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const levelEl = document.querySelector("#level");
const hpEl = document.querySelector("#hp");
const weaponEl = document.querySelector("#weapon");
const ammoEl = document.querySelector("#ammo");
const messageEl = document.querySelector("#message");
const startBtn = document.querySelector("#start");
const restartBtn = document.querySelector("#restart");
const statusEl = document.querySelector("#status");

const lanes = [-1, 0, 1];
const weapons = [
  { name: "步枪", mag: 10, damage: 42, rate: 0.48, reload: 1.0, spread: 0.018, pellets: 1 },
  { name: "冲锋枪", mag: 32, damage: 18, rate: 0.11, reload: 1.2, spread: 0.04, pellets: 1 },
  { name: "霰弹枪", mag: 10, damage: 19, rate: 0.66, reload: 1.25, spread: 0.085, pellets: 6 },
  { name: "机枪", mag: 70, damage: 16, rate: 0.07, reload: 1.55, spread: 0.05, pellets: 1 },
  { name: "加特林", mag: Infinity, damage: 24, rate: 0.035, reload: 0, spread: 0.06, pellets: 1, gatling: true },
];

let game;
let keys = new Set();
let mouseDown = false;
let pointer = { x: 0, y: 0 };
let lastTime = 0;

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const scale = window.devicePixelRatio || 1;
  canvas.width = Math.round(rect.width * scale);
  canvas.height = Math.round(rect.height * scale);
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  canvas.w = rect.width;
  canvas.h = rect.height;
}

function w() { return canvas.w || canvas.clientWidth || 1120; }
function h() { return canvas.h || canvas.clientHeight || 640; }
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }

function newGame() {
  game = {
    state: "ready",
    level: 1,
    hp: 100,
    lane: 1,
    enemies: [],
    shots: [],
    sparks: [],
    spawnTimer: 0,
    spawnLeft: 0,
    levelActive: false,
    kills: 0,
    weaponIndex: 0,
    ammo: weapons[0].mag,
    cooldown: 0,
    reload: 0,
    shake: 0,
  };
  startLevel();
  updateHud();
  messageEl.classList.remove("hidden");
}

function currentWeapon() {
  return weapons[game.weaponIndex];
}

function startLevel() {
  const level = game.level;
  game.enemies = [];
  game.spawnLeft = 6 + level * 3;
  game.spawnTimer = 0.4;
  game.levelActive = true;
  game.kills = 0;
  game.weaponIndex = level >= 8 ? 4 : level >= 6 ? 3 : level >= 4 ? 2 : level >= 2 ? 1 : 0;
  game.ammo = currentWeapon().mag;
  statusEl.textContent = level >= 8 ? "军官出现，已解锁加特林无限火力。" : `第 ${level} 关：敌兵正在推进。`;
}

function spawnEnemy() {
  const boss = game.level >= 5 && game.spawnLeft === 1;
  const lane = Math.floor(Math.random() * 3);
  game.enemies.push({
    lane,
    x: lanes[lane],
    depth: 1.08,
    hp: boss ? 280 + game.level * 55 : 70 + game.level * 16,
    maxHp: boss ? 280 + game.level * 55 : 70 + game.level * 16,
    speed: boss ? 0.045 : 0.07 + game.level * 0.006,
    shootTimer: boss ? 1.35 : 2.2 + Math.random() * 1.0,
    color: boss ? "#5b2631" : "#7c6a47",
    boss,
  });
}

function update(delta) {
  if (game.state !== "playing") {
    updateEffects(delta);
    return;
  }

  handleMovement();
  game.cooldown = Math.max(0, game.cooldown - delta);
  game.reload = Math.max(0, game.reload - delta);
  game.shake = Math.max(0, game.shake - delta * 30);

  if (game.reload === 0 && game.ammo === 0) {
    game.ammo = currentWeapon().mag;
    statusEl.textContent = "换弹完成。";
  }

  if (mouseDown || currentWeapon().gatling) shoot();

  if (game.levelActive) {
    game.spawnTimer -= delta;
    if (game.spawnTimer <= 0 && game.spawnLeft > 0) {
      spawnEnemy();
      game.spawnLeft -= 1;
      game.spawnTimer = Math.max(0.42, 1.0 - game.level * 0.045);
    }
  }

  updateEnemies(delta);
  updateEffects(delta);

  if (game.levelActive && game.spawnLeft <= 0 && game.enemies.length === 0) {
    game.levelActive = false;
    if (game.level >= 10) {
      endGame("阵地守住了");
    } else {
      game.level += 1;
      startLevel();
    }
  }

  updateHud();
}

function handleMovement() {
  if (keys.has("ArrowLeft") || keys.has("KeyA")) game.lane = Math.max(0, game.lane - 1), keys.delete("ArrowLeft"), keys.delete("KeyA");
  if (keys.has("ArrowRight") || keys.has("KeyD")) game.lane = Math.min(2, game.lane + 1), keys.delete("ArrowRight"), keys.delete("KeyD");
}

function shoot() {
  const weapon = currentWeapon();
  if (game.cooldown > 0 || game.reload > 0) return;
  if (!weapon.gatling && game.ammo <= 0) {
    reload();
    return;
  }

  game.cooldown = weapon.rate;
  if (!weapon.gatling) game.ammo -= 1;
  game.shake = weapon.gatling ? 2 : 4;

  for (let i = 0; i < weapon.pellets; i += 1) {
    const sx = pointer.x || w() / 2;
    const sy = pointer.y || h() * 0.52;
    const spreadX = (Math.random() - 0.5) * weapon.spread * w();
    const spreadY = (Math.random() - 0.5) * weapon.spread * h();
    hitScan(sx + spreadX, sy + spreadY, weapon.damage);
  }

  game.shots.push({ x: pointer.x || w() / 2, y: pointer.y || h() * 0.52, life: 0.08 });
  if (!weapon.gatling && game.ammo <= 0) reload();
}

function reload() {
  const weapon = currentWeapon();
  if (weapon.gatling || game.reload > 0 || game.ammo === weapon.mag) return;
  game.reload = weapon.reload;
  statusEl.textContent = "自动换弹中...";
}

function hitScan(x, y, damage) {
  const targets = [...game.enemies].sort((a, b) => a.depth - b.depth);
  for (const enemy of targets) {
    const box = enemyBox(enemy);
    if (x >= box.x - box.w / 2 && x <= box.x + box.w / 2 && y >= box.y - box.h / 2 && y <= box.y + box.h / 2) {
      enemy.hp -= damage;
      addSpark(box.x, box.y, "#f0c86a", 8);
      if (enemy.hp <= 0) {
        game.kills += 1;
        addSpark(box.x, box.y, enemy.color, enemy.boss ? 28 : 14);
      }
      return;
    }
  }
}

function updateEnemies(delta) {
  for (const enemy of game.enemies) {
    enemy.depth -= enemy.speed * delta;
    if (enemy.depth < 0.62) enemy.shootTimer -= delta;
    if (enemy.shootTimer <= 0) {
      const nearFactor = clamp((0.62 - enemy.depth) / 0.49, 0, 1);
      const damage = Math.ceil((enemy.boss ? 10 : 5) * (0.45 + nearFactor * 0.75));
      const shielded = enemy.lane !== game.lane;
      game.hp -= shielded ? Math.floor(damage * 0.45) : damage;
      game.shake = 8;
      enemy.shootTimer = enemy.boss ? 1.15 : 1.75 + Math.random() * 0.65;
      statusEl.textContent = shielded ? "掩体挡下了部分伤害。" : "正面中弹，切换掩体躲避火力。";
      if (game.hp <= 0) endGame("阵地失守");
    }
    if (enemy.depth <= 0.13) {
      enemy.hp = 0;
      game.hp -= enemy.boss ? 25 : 12;
      if (game.hp <= 0) endGame("阵地失守");
    }
  }
  game.enemies = game.enemies.filter((enemy) => enemy.hp > 0);
}

function updateEffects(delta) {
  for (const shot of game.shots) shot.life -= delta;
  game.shots = game.shots.filter((shot) => shot.life > 0);
  for (const spark of game.sparks) {
    spark.life -= delta;
    spark.x += spark.vx * delta;
    spark.y += spark.vy * delta;
  }
  game.sparks = game.sparks.filter((spark) => spark.life > 0);
}

function addSpark(x, y, color, amount) {
  for (let i = 0; i < amount; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 50 + Math.random() * 170;
    game.sparks.push({ x, y, color, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 0.3 });
  }
}

function enemyBox(enemy) {
  const width = w();
  const height = h();
  const scale = 1.2 - enemy.depth;
  const laneX = width / 2 + enemy.x * width * 0.26 * (1 - enemy.depth * 0.25);
  const y = height * (0.28 + (1 - enemy.depth) * 0.44);
  const bw = (enemy.boss ? 80 : 48) * (0.7 + scale);
  const bh = (enemy.boss ? 130 : 88) * (0.7 + scale);
  return { x: laneX, y, w: bw, h: bh };
}

function draw() {
  ctx.clearRect(0, 0, w(), h());
  ctx.save();
  if (game.shake > 0) ctx.translate((Math.random() - 0.5) * game.shake, (Math.random() - 0.5) * game.shake);
  drawScene();
  game.enemies.sort((a, b) => b.depth - a.depth).forEach(drawEnemy);
  drawCover();
  drawWeapon();
  drawCrosshair();
  drawEffects();
  ctx.restore();
}

function drawScene() {
  const width = w();
  const height = h();
  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, "#41515d");
  sky.addColorStop(0.48, "#79806d");
  sky.addColorStop(0.5, "#4f5f3c");
  sky.addColorStop(1, "#252a20");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "rgba(40,32,26,.55)";
  for (let i = 0; i < 18; i += 1) {
    const x = (i * 89 + game.level * 23) % width;
    ctx.fillRect(x, height * 0.45 + (i % 5) * 28, 40, 10);
  }

  ctx.strokeStyle = "rgba(255,255,255,.18)";
  ctx.lineWidth = 2;
  lanes.forEach((lane, index) => {
    const x = width / 2 + lane * width * 0.26;
    ctx.beginPath();
    ctx.moveTo(width / 2, height * 0.46);
    ctx.lineTo(x, height);
    ctx.stroke();
    if (index === game.lane) {
      ctx.fillStyle = "rgba(240,200,106,.08)";
      ctx.beginPath();
      ctx.moveTo(width / 2, height * 0.46);
      ctx.lineTo(x - width * 0.13, height);
      ctx.lineTo(x + width * 0.13, height);
      ctx.closePath();
      ctx.fill();
    }
  });
}

function drawEnemy(enemy) {
  const b = enemyBox(enemy);
  ctx.fillStyle = "rgba(0,0,0,.28)";
  ctx.beginPath();
  ctx.ellipse(b.x, b.y + b.h * 0.48, b.w * 0.55, b.h * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = enemy.color;
  roundRect(b.x - b.w * 0.32, b.y - b.h * 0.1, b.w * 0.64, b.h * 0.56, 8);
  ctx.fill();
  ctx.fillStyle = "#d0b38a";
  ctx.beginPath();
  ctx.arc(b.x, b.y - b.h * 0.3, b.w * 0.22, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#4a3a28";
  ctx.fillRect(b.x - b.w * 0.27, b.y - b.h * 0.47, b.w * 0.54, b.h * 0.12);
  ctx.fillStyle = "#171717";
  ctx.fillRect(b.x - b.w * 0.36, b.y + b.h * 0.05, b.w * 0.72, b.h * 0.08);
  if (enemy.boss) {
    ctx.fillStyle = "#f0c86a";
    ctx.fillRect(b.x - b.w * 0.28, b.y - b.h * 0.58, b.w * 0.56, b.h * 0.08);
  }

  ctx.fillStyle = "#111";
  ctx.fillRect(b.x - b.w * 0.42, b.y - b.h * 0.66, b.w * 0.84, 6);
  ctx.fillStyle = enemy.boss ? "#f0c86a" : "#69d08c";
  ctx.fillRect(b.x - b.w * 0.42, b.y - b.h * 0.66, b.w * 0.84 * Math.max(0, enemy.hp / enemy.maxHp), 6);
}

function drawCover() {
  const width = w();
  const height = h();
  lanes.forEach((lane, index) => {
    const x = width / 2 + lane * width * 0.3;
    ctx.fillStyle = index === game.lane ? "#7e6a47" : "#4f4634";
    roundRect(x - 92, height - 118, 184, 84, 8);
    ctx.fill();
    ctx.fillStyle = "rgba(0,0,0,.26)";
    ctx.fillRect(x - 92, height - 58, 184, 24);
  });
}

function drawWeapon() {
  const width = w();
  const height = h();
  const weapon = currentWeapon();
  ctx.fillStyle = "#22252a";
  roundRect(width * 0.58, height - 118, width * 0.28, 54, 10);
  ctx.fill();
  ctx.fillStyle = weapon.gatling ? "#f0c86a" : "#9da6ad";
  ctx.fillRect(width * 0.55, height - 102, width * 0.24, 18);
  if (weapon.gatling) {
    for (let i = 0; i < 5; i += 1) ctx.fillRect(width * 0.53, height - 112 + i * 9, width * 0.2, 4);
  }
  if (game.reload > 0) {
    ctx.fillStyle = "rgba(240,200,106,.9)";
    ctx.fillRect(width * 0.42, height - 52, width * 0.16 * (1 - game.reload / Math.max(0.1, weapon.reload)), 8);
  }
}

function drawCrosshair() {
  const x = pointer.x || w() / 2;
  const y = pointer.y || h() * 0.52;
  ctx.strokeStyle = "#f7f1e5";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - 16, y);
  ctx.lineTo(x - 5, y);
  ctx.moveTo(x + 5, y);
  ctx.lineTo(x + 16, y);
  ctx.moveTo(x, y - 16);
  ctx.lineTo(x, y - 5);
  ctx.moveTo(x, y + 5);
  ctx.lineTo(x, y + 16);
  ctx.stroke();
}

function drawEffects() {
  for (const shot of game.shots) {
    ctx.globalAlpha = Math.max(0, shot.life * 10);
    ctx.strokeStyle = "#f0c86a";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(w() * 0.62, h() - 94);
    ctx.lineTo(shot.x, shot.y);
    ctx.stroke();
  }
  for (const spark of game.sparks) {
    ctx.globalAlpha = Math.max(0, spark.life * 3);
    ctx.fillStyle = spark.color;
    ctx.fillRect(spark.x - 2, spark.y - 2, 4, 4);
  }
  ctx.globalAlpha = 1;
}

function roundRect(x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function endGame(text) {
  game.state = "ended";
  messageEl.querySelector("strong").textContent = text;
  messageEl.querySelector("span").textContent = "点击重新开始再战一局";
  messageEl.classList.remove("hidden");
}

function updateHud() {
  levelEl.textContent = game.level;
  hpEl.textContent = Math.max(0, Math.floor(game.hp));
  weaponEl.textContent = currentWeapon().name;
  ammoEl.textContent = currentWeapon().gatling ? "无限" : game.reload > 0 ? "换弹中" : `${game.ammo} / ${currentWeapon().mag}`;
}

function frame(now) {
  const delta = Math.min(0.033, (now - lastTime) / 1000 || 0);
  lastTime = now;
  update(delta);
  draw();
  requestAnimationFrame(frame);
}

canvas.addEventListener("pointermove", (event) => {
  const rect = canvas.getBoundingClientRect();
  pointer.x = event.clientX - rect.left;
  pointer.y = event.clientY - rect.top;
});
canvas.addEventListener("pointerdown", () => {
  mouseDown = true;
  if (game.state === "ready") {
    game.state = "playing";
    messageEl.classList.add("hidden");
  }
});
window.addEventListener("pointerup", () => { mouseDown = false; });
window.addEventListener("keydown", (event) => {
  keys.add(event.code);
  if (event.code === "KeyR") reload();
  if (["ArrowLeft", "ArrowRight", "Space"].includes(event.code)) event.preventDefault();
});
window.addEventListener("keyup", (event) => keys.delete(event.code));
startBtn.addEventListener("click", () => {
  game.state = "playing";
  messageEl.classList.add("hidden");
});
restartBtn.addEventListener("click", newGame);
window.addEventListener("resize", resizeCanvas);

resizeCanvas();
newGame();
requestAnimationFrame(frame);
