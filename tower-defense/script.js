const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const goldEl = document.querySelector("#gold");
const livesEl = document.querySelector("#lives");
const levelEl = document.querySelector("#level");
const statusEl = document.querySelector("#status");
const nextLevelBtn = document.querySelector("#nextLevel");
const restartBtn = document.querySelector("#restart");
const buildMenu = document.querySelector("#buildMenu");
const sellValueEl = document.querySelector("#sellValue");
const upgradeValueEl = document.querySelector("#upgradeValue");

const towerData = {
  archer: { name: "弓箭塔", cost: 75, range: 165, rate: 0.48, damage: 17, color: "#8bd17c" },
  barracks: { name: "兵营", cost: 95, range: 115, rate: 3.5, damage: 11, color: "#d9c38a" },
  mage: { name: "魔法塔", cost: 115, range: 150, rate: 1.05, damage: 46, color: "#8a8cff" },
  cannon: { name: "大炮", cost: 130, range: 165, rate: 1.35, damage: 52, splash: 86, color: "#e29d57" },
};

const levels = [
  { name: "城郊小路", count: 12, hp: 58, speed: 58, reward: 8, interval: 0.72, color: "#d9c38a", layout: 0 },
  { name: "麦田弯道", count: 15, hp: 78, speed: 64, reward: 9, interval: 0.66, color: "#d8915d", layout: 1 },
  { name: "北门急袭", count: 18, hp: 104, speed: 72, reward: 10, interval: 0.58, color: "#ca6a60", layout: 2 },
  { name: "石桥快攻", count: 20, hp: 128, speed: 84, reward: 11, interval: 0.5, color: "#8fb6e8", layout: 3 },
  { name: "先锋首领", count: 16, hp: 170, speed: 58, reward: 14, interval: 0.62, color: "#a477d9", boss: true, bossHp: 760, layout: 4 },
  { name: "林地包围", count: 24, hp: 150, speed: 78, reward: 12, interval: 0.46, color: "#74c08a", layout: 5 },
  { name: "重甲军团", count: 22, hp: 205, speed: 62, reward: 15, interval: 0.54, color: "#c28b5b", layout: 6 },
  { name: "疾风斥候", count: 26, hp: 185, speed: 88, reward: 14, interval: 0.42, color: "#6aa7d9", layout: 7 },
  { name: "皇城外墙", count: 24, hp: 260, speed: 68, reward: 18, interval: 0.48, color: "#b96f83", layout: 8 },
  { name: "魔王压城", count: 20, hp: 330, speed: 58, reward: 24, interval: 0.52, color: "#5b2631", boss: true, bossHp: 2200, layout: 9 },
];

const levelNames = [
  "城郊小路",
  "麦田弯道",
  "北门急袭",
  "石桥快攻",
  "先锋首领",
  "林地包围",
  "重甲军团",
  "疾风斥候",
  "皇城外墙",
  "魔王压城",
];

let game;
let lastTime = 0;
let selectedSite = null;
let selectedTower = null;

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const scale = window.devicePixelRatio || 1;
  canvas.width = Math.round(rect.width * scale);
  canvas.height = Math.round(rect.height * scale);
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  canvas.w = rect.width;
  canvas.h = rect.height;
  if (game) buildLevel();
}

function w() {
  return canvas.w || canvas.clientWidth || 1120;
}

function h() {
  return canvas.h || canvas.clientHeight || 640;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function levelName(index) {
  return levelNames[index] || `第 ${index + 1} 关`;
}

function levelBudget(index) {
  return 245 + index * 42 + (levels[index]?.boss ? 55 : 0);
}

function makeGame() {
  game = {
    gold: levelBudget(0),
    lives: 20,
    levelIndex: 0,
    levelActive: false,
    spawning: false,
    spawnTimer: 0,
    spawnLeft: 0,
    state: "playing",
    enemies: [],
    towers: [],
    bullets: [],
    soldiers: [],
    effects: [],
    path: [],
    sites: [],
  };
  buildLevel();
  statusEl.textContent = "先点黄色圆圈建塔，再开始本关";
  updateHud();
}

function buildLevel() {
  const width = w();
  const height = h();
  const layout = levels[game.levelIndex]?.layout || 0;
  const paths = [
    [[-0.04, 0.45], [0.18, 0.45], [0.18, 0.24], [0.42, 0.24], [0.42, 0.66], [0.7, 0.66], [0.7, 0.36], [1.05, 0.36]],
    [[-0.04, 0.3], [0.25, 0.3], [0.25, 0.62], [0.52, 0.62], [0.52, 0.25], [0.78, 0.25], [0.78, 0.56], [1.05, 0.56]],
    [[-0.04, 0.62], [0.16, 0.62], [0.16, 0.42], [0.38, 0.42], [0.38, 0.22], [0.66, 0.22], [0.66, 0.68], [1.05, 0.68]],
    [[-0.04, 0.5], [0.2, 0.5], [0.34, 0.28], [0.52, 0.5], [0.66, 0.72], [0.82, 0.48], [1.05, 0.48]],
    [[-0.04, 0.36], [0.14, 0.36], [0.14, 0.72], [0.36, 0.72], [0.36, 0.18], [0.58, 0.18], [0.58, 0.52], [0.82, 0.52], [1.05, 0.34]],
    [[-0.04, 0.22], [0.2, 0.22], [0.2, 0.5], [0.42, 0.5], [0.42, 0.78], [0.64, 0.78], [0.64, 0.38], [1.05, 0.38]],
    [[-0.04, 0.7], [0.24, 0.7], [0.24, 0.32], [0.48, 0.32], [0.48, 0.58], [0.72, 0.58], [0.72, 0.28], [1.05, 0.28]],
    [[-0.04, 0.4], [0.18, 0.4], [0.3, 0.18], [0.48, 0.4], [0.6, 0.62], [0.78, 0.4], [1.05, 0.4]],
    [[-0.04, 0.28], [0.12, 0.28], [0.12, 0.58], [0.34, 0.58], [0.34, 0.35], [0.56, 0.35], [0.56, 0.72], [0.84, 0.72], [0.84, 0.42], [1.05, 0.42]],
    [[-0.04, 0.52], [0.18, 0.52], [0.18, 0.22], [0.44, 0.22], [0.44, 0.5], [0.62, 0.5], [0.62, 0.78], [0.82, 0.78], [0.82, 0.34], [1.05, 0.34]],
  ];
  const sites = [
    [[0.12, 0.28], [0.28, 0.38], [0.32, 0.72], [0.5, 0.43], [0.61, 0.78], [0.78, 0.52], [0.85, 0.24]],
    [[0.12, 0.48], [0.3, 0.18], [0.34, 0.76], [0.48, 0.45], [0.64, 0.16], [0.72, 0.42], [0.88, 0.72]],
    [[0.1, 0.78], [0.24, 0.52], [0.34, 0.28], [0.52, 0.14], [0.58, 0.44], [0.76, 0.72], [0.86, 0.5]],
    [[0.14, 0.32], [0.28, 0.64], [0.42, 0.2], [0.52, 0.72], [0.66, 0.42], [0.78, 0.76], [0.9, 0.3]],
    [[0.08, 0.18], [0.22, 0.82], [0.34, 0.48], [0.48, 0.12], [0.62, 0.34], [0.72, 0.66], [0.9, 0.2]],
    [[0.12, 0.38], [0.3, 0.68], [0.38, 0.28], [0.52, 0.64], [0.68, 0.24], [0.8, 0.54], [0.9, 0.18]],
    [[0.12, 0.52], [0.26, 0.18], [0.38, 0.72], [0.54, 0.44], [0.66, 0.7], [0.78, 0.16], [0.9, 0.48]],
    [[0.1, 0.58], [0.24, 0.24], [0.38, 0.5], [0.5, 0.18], [0.62, 0.72], [0.78, 0.28], [0.9, 0.58]],
    [[0.1, 0.44], [0.22, 0.72], [0.34, 0.22], [0.48, 0.52], [0.62, 0.2], [0.72, 0.84], [0.9, 0.58]],
    [[0.1, 0.34], [0.28, 0.68], [0.38, 0.36], [0.52, 0.16], [0.6, 0.66], [0.72, 0.44], [0.9, 0.18]],
  ];
  const siteCount = Math.min(sites[layout].length, 5 + Math.floor(game.levelIndex / 2) + (levels[game.levelIndex]?.boss ? 1 : 0));
  game.path = paths[layout].map(([x, y]) => ({ x: x * width, y: y * height }));
  game.sites = sites[layout].slice(0, siteCount).map(([x, y], index) => ({ id: index, x: x * width, y: y * height }));
  for (const tower of game.towers || []) {
    const site = game.sites.find((item) => item.id === tower.siteId);
    if (!site) continue;
    tower.site = site;
    tower.x = site.x;
    tower.y = site.y;
    if (tower.type === "barracks") {
      delete tower.squad;
      tower.rally = null;
    }
  }
}

function startLevel() {
  if (game.state !== "playing" || game.spawning || game.enemies.length) return;
  if (game.levelIndex >= levels.length) return;
  const level = levels[game.levelIndex];
  game.spawning = true;
  game.levelActive = true;
  game.spawnLeft = level.boss ? level.count + 1 : level.count;
  game.spawnTimer = 0;
  statusEl.textContent = level.boss ? `${level.name}：Boss 来袭！` : `${level.name}：敌军进攻`;
  statusEl.textContent = level.boss ? `${levelName(game.levelIndex)}：Boss 来袭！` : `${levelName(game.levelIndex)}：敌军进攻`;
  statusEl.textContent = level.boss ? `${levelName(game.levelIndex)}\uff1aBoss \u6765\u88ad\uff01` : `${levelName(game.levelIndex)}\uff1a\u654c\u519b\u8fdb\u653b`;
  hideBuildMenu();
}

function spawnEnemy() {
  const level = levels[game.levelIndex];
  const isBoss = level.boss && game.spawnLeft === 1;
  const start = game.path[0];
  game.enemies.push({
    x: start.x,
    y: start.y,
    pathIndex: 1,
    hp: isBoss ? level.bossHp : level.hp,
    maxHp: isBoss ? level.bossHp : level.hp,
    speed: isBoss ? 34 : level.speed,
    reward: isBoss ? 180 : level.reward,
    radius: isBoss ? 28 : 14,
    color: isBoss ? "#5b2631" : level.color,
    boss: isBoss,
    slow: 0,
    blockedBy: null,
    blockedTime: 0,
    stuckTime: 0,
    lastX: start.x,
    lastY: start.y,
  });
}

function update(delta) {
  if (game.state !== "playing") {
    updateEffects(delta);
    return;
  }

  if (game.spawning) {
    const level = levels[game.levelIndex];
    game.spawnTimer -= delta;
    if (game.spawnTimer <= 0 && game.spawnLeft > 0) {
      spawnEnemy();
      game.spawnLeft -= 1;
      game.spawnTimer = level.interval;
    }
    if (game.spawnLeft <= 0) game.spawning = false;
  }

  updateEnemies(delta);
  updateTowers(delta);
  updateBullets(delta);
  updateSoldiers(delta);
  updateEffects(delta);

  if (game.levelActive && !game.spawning && game.enemies.length === 0 && game.levelIndex < levels.length && game.spawnLeft <= 0) {
    const clearedLevel = game.levelIndex + 1;
    game.levelIndex += 1;
    game.levelActive = false;
    game.gold = levelBudget(game.levelIndex);
    game.towers = [];
    game.soldiers = [];
    game.bullets = [];
    hideBuildMenu();
    if (game.levelIndex >= levels.length) {
      game.state = "won";
      statusEl.textContent = "皇城守住了！";
    } else {
      buildLevel();
      statusEl.textContent = `第 ${clearedLevel} 关完成。下一关重新建造防御工事，预算和塔位已更新。`;
    }
  }

  updateHud();
}

function updateEnemies(delta) {
  for (const enemy of game.enemies) {
    enemy.slow = Math.max(0, enemy.slow - delta);
    if (enemy.blockedBy) {
      enemy.blockedTime = (enemy.blockedTime || 0) + delta;
      const guardGone = enemy.blockedBy.hp <= 0 || enemy.blockedBy.target !== enemy;
      const tooFar = distance(enemy, enemy.blockedBy) > enemy.radius + 34;
      if (guardGone || tooFar || enemy.blockedTime > 4.5) {
        enemy.blockedBy = null;
        enemy.blockedTime = 0;
      } else {
        enemy.blockedBy.hp -= delta * (enemy.boss ? 9 : 4);
        continue;
      }
    }

    const target = game.path[enemy.pathIndex];
    if (!target) {
      enemy.hp = 0;
      continue;
    }
    const dx = target.x - enemy.x;
    const dy = target.y - enemy.y;
    const len = Math.hypot(dx, dy);
    const speed = enemy.speed * (enemy.slow > 0 ? 0.55 : 1);
    if (len < 0.001 || len < speed * delta) {
      enemy.x = target.x;
      enemy.y = target.y;
      enemy.pathIndex += 1;
      if (enemy.pathIndex >= game.path.length) {
        enemy.hp = 0;
        game.lives -= enemy.boss ? 8 : 1;
        if (game.lives <= 0) {
          game.state = "lost";
          statusEl.textContent = "城门被攻破了";
        }
      }
    } else {
      enemy.x += (dx / len) * speed * delta;
      enemy.y += (dy / len) * speed * delta;
    }

    if (Math.hypot(enemy.x - enemy.lastX, enemy.y - enemy.lastY) < 0.4) enemy.stuckTime += delta;
    else enemy.stuckTime = 0;
    enemy.lastX = enemy.x;
    enemy.lastY = enemy.y;
    if (enemy.stuckTime > 3) {
      enemy.blockedBy = null;
      enemy.stuckTime = 0;
      enemy.pathIndex = Math.min(enemy.pathIndex + 1, game.path.length - 1);
    }
  }

  game.enemies = game.enemies.filter((enemy) => {
    if (enemy.hp > 0) return true;
    if (enemy.pathIndex < game.path.length) {
      game.gold += enemy.reward;
      addEffect(enemy.x, enemy.y, enemy.color, enemy.boss ? 28 : 12);
    }
    return false;
  });
}

function updateTowers(delta) {
  for (const tower of game.towers) {
    tower.cooldown -= delta;
    const data = towerStats(tower);
    if (tower.type === "barracks") {
      updateBarracks(tower, delta);
      continue;
    }

    if (tower.cooldown > 0) continue;
    const target = findTarget(tower.x, tower.y, data.range);
    if (!target) continue;
    tower.cooldown = data.rate;
    game.bullets.push({
      type: tower.type,
      x: tower.x,
      y: tower.y - 18,
      target,
      speed: tower.type === "cannon" ? 340 : tower.type === "mage" ? 430 : 540,
      damage: data.damage,
      splash: data.splash || 0,
      color: data.color,
    });
  }
}

function updateBarracks(tower, delta) {
  const stats = towerStats(tower);
  if (!tower.squad) {
    tower.rally = findBarracksRally(tower);
    tower.squad = [0, 1, 2].map((i) => ({
      x: tower.rally.x + tower.rally.nx * (i - 1) * 18,
      y: tower.rally.y + tower.rally.ny * (i - 1) * 18,
      hp: stats.soldierHp,
      maxHp: stats.soldierHp,
      damage: stats.damage,
      level: tower.level || 1,
      cooldown: 0,
      homeX: tower.rally.x + tower.rally.nx * (i - 1) * 18,
      homeY: tower.rally.y + tower.rally.ny * (i - 1) * 18,
      target: null,
    }));
    game.soldiers.push(...tower.squad);
  }

  for (const soldier of tower.squad) {
    if (soldier.hp <= 0) {
      soldier.hp += (22 + (soldier.level || 1) * 5) * delta;
      soldier.hp = Math.min(soldier.hp, soldier.maxHp);
      soldier.x = soldier.homeX;
      soldier.y = soldier.homeY;
    }
  }
}

function updateSoldiers(delta) {
  for (const soldier of game.soldiers) {
    if (soldier.hp <= 0) continue;
    soldier.cooldown = Math.max(0, soldier.cooldown - delta);
    let target = soldier.target && soldier.target.hp > 0 ? soldier.target : null;
    if (!target || distance(soldier, target) > 118) {
      target = nearestEnemy(soldier.homeX, soldier.homeY, 128) || nearestEnemy(soldier.x, soldier.y, 92);
      soldier.target = target;
    }

    if (target) {
      const d = distance(soldier, target);
      if (d > target.radius + 20) {
        moveToward(soldier, target.x, target.y, 86 * delta);
      } else {
        target.blockedBy = soldier;
        target.blockedTime = 0;
        if (soldier.cooldown <= 0) {
          target.hp -= soldier.damage || towerData.barracks.damage;
          soldier.hp -= target.boss ? 16 : 6;
          soldier.cooldown = 0.55;
          addEffect(target.x, target.y, "#f0c86a", 4);
        }
      }
    } else {
      moveToward(soldier, soldier.homeX, soldier.homeY, 62 * delta);
    }
  }
}

function findBarracksRally(tower) {
  const point = closestPointOnPath(tower.x, tower.y);
  return {
    x: point.x,
    y: point.y,
    nx: point.nx,
    ny: point.ny,
  };
}

function towerStats(tower) {
  const base = towerData[tower.type];
  const level = tower.level || 1;
  return {
    ...base,
    range: Math.round(base.range * (1 + (level - 1) * 0.16)),
    damage: Math.round(base.damage * (1 + (level - 1) * 0.42)),
    rate: Math.max(0.18, base.rate * (1 - (level - 1) * 0.1)),
    splash: base.splash ? Math.round(base.splash * (1 + (level - 1) * 0.08)) : 0,
    soldierHp: Math.round(88 * (1 + (level - 1) * 0.38)),
  };
}

function upgradeCost(tower) {
  if (!tower || (tower.level || 1) >= 3) return 0;
  return Math.round(towerData[tower.type].cost * (0.68 + (tower.level || 1) * 0.42));
}

function closestPointOnPath(x, y) {
  let best = { x: game.path[0].x, y: game.path[0].y, nx: 0, ny: 1, distance: Infinity };
  for (let i = 0; i < game.path.length - 1; i += 1) {
    const a = game.path[i];
    const b = game.path[i + 1];
    const vx = b.x - a.x;
    const vy = b.y - a.y;
    const lenSq = vx * vx + vy * vy || 1;
    const t = clamp(((x - a.x) * vx + (y - a.y) * vy) / lenSq, 0, 1);
    const px = a.x + vx * t;
    const py = a.y + vy * t;
    const dist = Math.hypot(px - x, py - y);
    if (dist < best.distance) {
      const len = Math.sqrt(lenSq);
      best = { x: px, y: py, nx: -vy / len, ny: vx / len, distance: dist };
    }
  }
  return best;
}

function updateBullets(delta) {
  for (const bullet of game.bullets) {
    if (!bullet.target || bullet.target.hp <= 0) {
      bullet.dead = true;
      continue;
    }
    const speed = bullet.speed * delta;
    const dx = bullet.target.x - bullet.x;
    const dy = bullet.target.y - bullet.y;
    const len = Math.hypot(dx, dy);
    if (len <= speed) {
      hitBullet(bullet);
      bullet.dead = true;
    } else {
      bullet.x += (dx / len) * speed;
      bullet.y += (dy / len) * speed;
    }
  }
  game.bullets = game.bullets.filter((bullet) => !bullet.dead);
}

function hitBullet(bullet) {
  if (bullet.splash) {
    for (const enemy of game.enemies) {
      if (distance(enemy, bullet.target) <= bullet.splash) enemy.hp -= bullet.damage;
    }
    addEffect(bullet.target.x, bullet.target.y, bullet.color, 18);
    return;
  }

  bullet.target.hp -= bullet.damage;
  if (bullet.type === "mage") bullet.target.slow = 1.35;
  addEffect(bullet.target.x, bullet.target.y, bullet.color, 8);
}

function updateEffects(delta) {
  for (const effect of game.effects) {
    effect.life -= delta;
    effect.radius += delta * 48;
  }
  game.effects = game.effects.filter((effect) => effect.life > 0);
}

function findTarget(x, y, range) {
  return game.enemies
    .filter((enemy) => enemy.hp > 0 && distance({ x, y }, enemy) <= range)
    .sort((a, b) => b.pathIndex - a.pathIndex || b.x - a.x)[0];
}

function nearestEnemy(x, y, range) {
  return game.enemies
    .filter((enemy) => enemy.hp > 0 && distance({ x, y }, enemy) <= range)
    .sort((a, b) => distance({ x, y }, a) - distance({ x, y }, b))[0];
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function moveToward(unit, x, y, amount) {
  const dx = x - unit.x;
  const dy = y - unit.y;
  const len = Math.hypot(dx, dy);
  if (len <= amount || len === 0) {
    unit.x = x;
    unit.y = y;
  } else {
    unit.x += (dx / len) * amount;
    unit.y += (dy / len) * amount;
  }
}

function roundRect(x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
}

function shadeColor(hex, amount) {
  const value = Number.parseInt(hex.slice(1), 16);
  const r = clamp((value >> 16) + amount, 0, 255);
  const g = clamp(((value >> 8) & 255) + amount, 0, 255);
  const b = clamp((value & 255) + amount, 0, 255);
  return `rgb(${r}, ${g}, ${b})`;
}

function lighten(hex, amount) {
  return shadeColor(hex, amount);
}

function darken(hex, amount) {
  return shadeColor(hex, -amount);
}

function addEffect(x, y, color, radius) {
  game.effects.push({ x, y, color, radius, life: 0.35 });
}

function updateHud() {
  goldEl.textContent = game.gold;
  livesEl.textContent = game.lives;
  levelEl.textContent = `${Math.min(game.levelIndex + 1, levels.length)} / ${levels.length}`;
  nextLevelBtn.textContent = game.levelActive ? "关卡进行中" : game.levelIndex === 0 ? "开始本关" : "开始下一关";
  nextLevelBtn.disabled = game.state !== "playing" || game.spawning || game.enemies.length > 0 || game.levelIndex >= levels.length || game.levelActive;
  updateBuildMenuState();
}

function draw() {
  ctx.clearRect(0, 0, w(), h());
  drawMap();
  drawSites();
  drawTowers();
  drawEnemies();
  drawSoldiers();
  drawBullets();
  drawEffects();
  drawOverlay();
}

function drawMap() {
  const width = w();
  const height = h();
  const grass = ctx.createLinearGradient(0, 0, width, height);
  grass.addColorStop(0, "#466b3d");
  grass.addColorStop(0.45, "#315938");
  grass.addColorStop(1, "#243d2a");
  ctx.fillStyle = grass;
  ctx.fillRect(0, 0, width, height);

  for (let i = 0; i < 120; i += 1) {
    ctx.fillStyle = i % 2 ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.055)";
    ctx.fillRect((i * 73) % width, (i * 41) % height, 34, 8);
  }

  drawPathStroke("#60472d", 62);
  drawPathStroke("#9d7447", 50);
  drawPathStroke("#caa06a", 36);
  drawPathStroke("rgba(255,232,170,.28)", 6, 10);
  drawCastleGate(width, height);
}

function drawPathStroke(color, lineWidth, dash = 0) {
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.setLineDash(dash ? [dash, dash * 1.5] : []);
  ctx.beginPath();
  game.path.forEach((point, index) => {
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawCastleGate(width, height) {
  const y = game.path[game.path.length - 1]?.y || height * 0.4;
  ctx.fillStyle = "rgba(0,0,0,.34)";
  ctx.beginPath();
  ctx.ellipse(width - 28, y + 54, 76, 18, 0, 0, Math.PI * 2);
  ctx.fill();
  const wall = ctx.createLinearGradient(width - 96, y - 84, width, y + 84);
  wall.addColorStop(0, "#9e8370");
  wall.addColorStop(0.5, "#6e5144");
  wall.addColorStop(1, "#3e2d2a");
  ctx.fillStyle = wall;
  roundRect(width - 86, y - 78, 100, 156, 8);
  ctx.fill();
  ctx.fillStyle = "#2b1715";
  roundRect(width - 52, y - 42, 40, 84, 8);
  ctx.fill();
  ctx.fillStyle = "#c3aa87";
  for (let i = 0; i < 4; i += 1) ctx.fillRect(width - 82 + i * 26, y - 90, 16, 24);
}

function drawSites() {
  for (const site of game.sites) {
    const occupied = game.towers.some((tower) => tower.siteId === site.id);
    ctx.fillStyle = occupied ? "rgba(0,0,0,0.18)" : "rgba(255,255,255,0.18)";
    ctx.beginPath();
    ctx.arc(site.x, site.y, 31, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = occupied ? "rgba(0,0,0,0.28)" : "#f0c86a";
    ctx.lineWidth = 3;
    ctx.stroke();
  }
}

function drawTowers() {
  for (const tower of game.towers) {
    const data = towerData[tower.type];
    ctx.fillStyle = "rgba(0,0,0,0.22)";
    ctx.beginPath();
    ctx.ellipse(tower.x, tower.y + 18, 34, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    const body = ctx.createLinearGradient(tower.x - 26, tower.y - 36, tower.x + 24, tower.y + 28);
    body.addColorStop(0, lighten(data.color, 28));
    body.addColorStop(0.45, data.color);
    body.addColorStop(1, darken(data.color, 44));
    ctx.fillStyle = body;
    roundRect(tower.x - 22, tower.y - 34, 44, 58, 6);
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,.42)";
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = "#2b3038";
    roundRect(tower.x - 29, tower.y + 10, 58, 18, 5);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.16)";
    ctx.fillRect(tower.x - 14, tower.y - 25, 8, 38);
    ctx.fillStyle = "#fff6d7";
    ctx.font = "900 12px Microsoft YaHei";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`Lv${tower.level || 1}`, tower.x, tower.y + 19);

    if (tower.type === "archer") drawIconBow(tower.x, tower.y - 10);
    if (tower.type === "mage") drawIconOrb(tower.x, tower.y - 12, data.color);
    if (tower.type === "cannon") drawIconCannon(tower.x, tower.y - 7);
    if (tower.type === "barracks") drawIconBanner(tower.x, tower.y - 8);
  }
}

function drawEnemies() {
  for (const enemy of game.enemies) {
    ctx.fillStyle = "rgba(0,0,0,0.22)";
    ctx.beginPath();
    ctx.ellipse(enemy.x, enemy.y + enemy.radius * 0.65, enemy.radius * 1.15, enemy.radius * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();

    const body = ctx.createRadialGradient(enemy.x - enemy.radius * 0.35, enemy.y - enemy.radius * 0.4, 2, enemy.x, enemy.y, enemy.radius * 1.25);
    body.addColorStop(0, lighten(enemy.color, 48));
    body.addColorStop(0.45, enemy.color);
    body.addColorStop(1, darken(enemy.color, 48));
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = enemy.boss ? "#f0c86a" : "rgba(0,0,0,.45)";
    ctx.lineWidth = enemy.boss ? 4 : 2;
    ctx.stroke();
    ctx.fillStyle = enemy.boss ? "#f0c86a" : "#20242b";
    roundRect(enemy.x - enemy.radius * 0.62, enemy.y - enemy.radius * 0.18, enemy.radius * 1.24, enemy.radius * 0.3, 3);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.28)";
    ctx.beginPath();
    ctx.arc(enemy.x - enemy.radius * 0.32, enemy.y - enemy.radius * 0.36, enemy.radius * 0.22, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#171717";
    ctx.fillRect(enemy.x - enemy.radius, enemy.y - enemy.radius - 12, enemy.radius * 2, 5);
    ctx.fillStyle = enemy.boss ? "#f0c86a" : "#5cc887";
    ctx.fillRect(enemy.x - enemy.radius, enemy.y - enemy.radius - 12, enemy.radius * 2 * clamp(enemy.hp / enemy.maxHp, 0, 1), 5);
  }
}

function drawSoldiers() {
  for (const soldier of game.soldiers) {
    if (soldier.hp <= 0) continue;
    ctx.fillStyle = "rgba(0,0,0,.24)";
    ctx.beginPath();
    ctx.ellipse(soldier.x, soldier.y + 8, 12, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    const armor = ctx.createLinearGradient(soldier.x - 8, soldier.y - 12, soldier.x + 8, soldier.y + 10);
    armor.addColorStop(0, "#fff0b2");
    armor.addColorStop(0.5, "#d9c38a");
    armor.addColorStop(1, "#7e6845");
    ctx.fillStyle = armor;
    ctx.beginPath();
    ctx.arc(soldier.x, soldier.y - 3, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#5d4933";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(soldier.x + 7, soldier.y - 5);
    ctx.lineTo(soldier.x + 14, soldier.y - 17);
    ctx.stroke();
  }
}

function drawBullets() {
  for (const bullet of game.bullets) {
    ctx.fillStyle = bullet.color;
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, bullet.type === "cannon" ? 8 : 5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawEffects() {
  for (const effect of game.effects) {
    ctx.globalAlpha = clamp(effect.life * 2.5, 0, 1);
    ctx.strokeStyle = effect.color;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(effect.x, effect.y, effect.radius, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawOverlay() {
  if (game.state === "playing") return;
  ctx.fillStyle = "rgba(10,12,16,0.58)";
  ctx.fillRect(0, 0, w(), h());
  ctx.fillStyle = "#f6f1e6";
  ctx.font = "900 42px Microsoft YaHei, Arial";
  ctx.textAlign = "center";
  ctx.fillText(game.state === "won" ? "皇城守住了" : "城门被攻破", w() / 2, h() * 0.42);
  ctx.font = "16px Microsoft YaHei, Arial";
  ctx.fillStyle = "#d8dce0";
  ctx.fillText("点击重新开始再来一局", w() / 2, h() * 0.5);
}

function drawIconBow(x, y) {
  ctx.strokeStyle = "#252a31";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(x, y, 14, -1.1, 1.1);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + 6, y - 13);
  ctx.lineTo(x + 6, y + 13);
  ctx.stroke();
}

function drawIconOrb(x, y, color) {
  ctx.fillStyle = "#f6f1e6";
  ctx.beginPath();
  ctx.arc(x, y, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.stroke();
}

function drawIconCannon(x, y) {
  ctx.fillStyle = "#252a31";
  ctx.fillRect(x - 5, y - 12, 26, 12);
  ctx.beginPath();
  ctx.arc(x - 4, y + 8, 9, 0, Math.PI * 2);
  ctx.fill();
}

function drawIconBanner(x, y) {
  ctx.fillStyle = "#252a31";
  ctx.fillRect(x - 2, y - 19, 4, 34);
  ctx.fillStyle = "#f0c86a";
  ctx.fillRect(x + 2, y - 18, 18, 13);
}

function canvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function showBuildMenu(site) {
  selectedSite = site;
  selectedTower = game.towers.find((tower) => tower.siteId === site.id) || null;
  const isOccupied = Boolean(selectedTower);
  buildMenu.querySelectorAll("button[data-type]").forEach((button) => {
    button.classList.toggle("hidden", isOccupied);
  });
  const sellButton = buildMenu.querySelector("button[data-action='sell']");
  const upgradeButton = buildMenu.querySelector("button[data-action='upgrade']");
  sellButton.classList.toggle("hidden", !isOccupied);
  upgradeButton.classList.toggle("hidden", !isOccupied);
  if (selectedTower) {
    const refund = sellValue(selectedTower);
    sellValueEl.textContent = `返还 ${refund} 金币`;
    const cost = upgradeCost(selectedTower);
    upgradeButton.disabled = cost <= 0 || game.gold < cost;
    upgradeValueEl.textContent = cost <= 0 ? "已满级" : `${cost} 金币升 Lv${(selectedTower.level || 1) + 1}`;
  }
  updateBuildMenuState();
  buildMenu.classList.remove("hidden");
  buildMenu.style.left = `${site.x + canvas.offsetLeft}px`;
  buildMenu.style.top = `${site.y + canvas.offsetTop}px`;
}

function hideBuildMenu() {
  selectedSite = null;
  selectedTower = null;
  buildMenu.classList.add("hidden");
}

function sellValue(tower) {
  const spent = towerData[tower.type].cost + towerUpgradeSpent(tower);
  return Math.floor(spent * 0.7);
}

function towerUpgradeSpent(tower) {
  let spent = 0;
  for (let level = 1; level < (tower.level || 1); level += 1) {
    spent += Math.round(towerData[tower.type].cost * (0.68 + level * 0.42));
  }
  return spent;
}

function updateBuildMenuState() {
  buildMenu.querySelectorAll("button[data-type]").forEach((button) => {
    const data = towerData[button.dataset.type];
    button.disabled = !data || game.gold < data.cost;
  });
}

canvas.addEventListener("click", (event) => {
  if (game.state !== "playing") return;
  const point = canvasPoint(event);
  const site = game.sites.find((item) => distance(point, item) <= 34);
  if (!site) {
    hideBuildMenu();
    return;
  }
  showBuildMenu(site);
});

buildMenu.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-type]");
  const sellButton = event.target.closest("button[data-action='sell']");
  const upgradeButton = event.target.closest("button[data-action='upgrade']");
  if (upgradeButton && selectedTower) {
    upgradeTower(selectedTower);
    showBuildMenu(selectedTower.site);
    return;
  }
  if (sellButton && selectedTower) {
    sellTower(selectedTower);
    hideBuildMenu();
    return;
  }
  if (!button || !selectedSite || selectedTower) return;
  const type = button.dataset.type;
  const data = towerData[type];
  if (game.gold < data.cost) {
    statusEl.textContent = "金币不足";
    return;
  }
  game.gold -= data.cost;
  game.towers.push({ type, level: 1, x: selectedSite.x, y: selectedSite.y, site: selectedSite, siteId: selectedSite.id, cooldown: 0 });
  statusEl.textContent = `建造了${data.name}`;
  hideBuildMenu();
  updateHud();
});

function sellTower(tower) {
  game.gold += sellValue(tower);
  game.towers = game.towers.filter((item) => item !== tower);
  if (tower.squad) {
    game.soldiers = game.soldiers.filter((soldier) => !tower.squad.includes(soldier));
  }
  statusEl.textContent = `售卖了${towerData[tower.type].name}`;
  updateHud();
}

function upgradeTower(tower) {
  const cost = upgradeCost(tower);
  if (!cost || game.gold < cost) {
    statusEl.textContent = cost ? "金币不足" : "防御工事已满级";
    return;
  }
  game.gold -= cost;
  tower.level = (tower.level || 1) + 1;
  tower.cooldown = 0;
  if (tower.type === "barracks") {
    if (tower.squad) game.soldiers = game.soldiers.filter((soldier) => !tower.squad.includes(soldier));
    delete tower.squad;
  }
  statusEl.textContent = `${towerData[tower.type].name} 升到 Lv${tower.level}`;
  updateHud();
}

nextLevelBtn.addEventListener("click", startLevel);
restartBtn.addEventListener("click", makeGame);
window.addEventListener("resize", resizeCanvas);

function frame(now) {
  const delta = Math.min(0.033, (now - lastTime) / 1000 || 0);
  lastTime = now;
  update(delta);
  draw();
  requestAnimationFrame(frame);
}

resizeCanvas();
makeGame();
requestAnimationFrame(frame);
