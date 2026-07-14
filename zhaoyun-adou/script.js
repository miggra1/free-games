const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const foodEl = document.querySelector("#food");
const waveEl = document.querySelector("#wave");
const myHpEl = document.querySelector("#myHp");
const enemyHpEl = document.querySelector("#enemyHp");
const summonBtn = document.querySelector("#summon");
const startWaveBtn = document.querySelector("#startWave");
const restartBtn = document.querySelector("#restart");
const statusEl = document.querySelector("#status");
const overlay = document.querySelector("#overlay");

const unitTypes = {
  刀: { hp: 74, damage: 14, range: 46, rate: 0.52, color: "#e8785b", note: "近战快刀" },
  枪: { hp: 92, damage: 13, range: 66, rate: 0.62, color: "#d9b76a", note: "中距穿刺" },
  骑: { hp: 68, damage: 19, range: 52, rate: 0.48, color: "#7bd08d", note: "突进压线" },
  弓: { hp: 48, damage: 12, range: 190, rate: 0.7, color: "#68b9ed", note: "后排远射" },
  士: { hp: 140, damage: 8, range: 40, rate: 0.78, color: "#bec8d0", note: "前排抗伤" },
};

const heroRecipes = [
  {
    name: "赵云",
    chars: ["赵", "云"],
    title: "龙胆",
    hp: 390,
    damage: 43,
    range: 225,
    rate: 0.24,
    color: "#f0c86a",
  },
  {
    name: "关羽",
    chars: ["关", "羽"],
    title: "青龙斩",
    hp: 500,
    damage: 76,
    range: 88,
    rate: 0.58,
    color: "#8fe07c",
  },
  {
    name: "张飞",
    chars: ["张", "飞"],
    title: "咆哮震退",
    hp: 620,
    damage: 58,
    range: 74,
    rate: 0.5,
    color: "#ef6b5b",
  },
  {
    name: "马超",
    chars: ["马", "超"],
    title: "银枪冲锋",
    hp: 430,
    damage: 50,
    range: 118,
    rate: 0.34,
    color: "#9bd2ff",
  },
  {
    name: "黄忠",
    chars: ["黄", "忠"],
    title: "百步穿杨",
    hp: 330,
    damage: 64,
    range: 280,
    rate: 0.48,
    color: "#ffd574",
  },
  {
    name: "诸葛亮",
    chars: ["诸", "葛", "亮"],
    title: "八阵雷火",
    hp: 360,
    damage: 38,
    range: 245,
    rate: 0.2,
    color: "#bda6ff",
    splash: 24,
  },
];

const summonPool = [
  "刀", "刀", "枪", "枪", "骑", "骑", "弓", "弓", "士", "士",
  "赵", "云", "关", "羽", "张", "飞", "马", "超", "黄", "忠", "诸", "葛", "亮",
];
const heroChars = new Set(heroRecipes.flatMap((hero) => hero.chars));
const bestWaveKey = "zhaoyun-adou-best-wave";

let game;
let lastTime = 0;
let pointer = null;
let drag = null;

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const scale = window.devicePixelRatio || 1;
  canvas.width = Math.round(rect.width * scale);
  canvas.height = Math.round(rect.height * scale);
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  canvas.w = rect.width;
  canvas.h = rect.height;
  if (game) layoutBoard();
}

function w() { return canvas.w || canvas.clientWidth || 1180; }
function h() { return canvas.h || canvas.clientHeight || 680; }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function uid() { return crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`; }

function newGame() {
  game = {
    food: 14,
    wave: 1,
    myHp: 3,
    bestWave: Number(localStorage.getItem(bestWaveKey) || 0),
    state: "build",
    units: [],
    enemies: [],
    projectiles: [],
    effects: [],
    board: [],
    bench: [],
    adou: { x: 0, y: 0, t: 0 },
    enemyAdou: { x: 0, y: 0, t: 0 },
    spawnLeft: 0,
    spawnTimer: 0,
  };
  layoutBoard();
  overlay.classList.add("hidden");
  statusEl.textContent = "召唤文字，拖到棋盘。兵种同字同等级二合一；武将名字按顺序相邻会自动合成。";
  updateHud();
}

function layoutBoard() {
  const width = w();
  const height = h();
  const cell = Math.min(width * 0.073, 66);
  const startX = width * 0.08;
  const startY = height * 0.16;
  game.board = [];
  for (let r = 0; r < 4; r += 1) {
    for (let c = 0; c < 6; c += 1) {
      game.board.push({ r, c, x: startX + c * (cell + 9), y: startY + r * (cell + 9), size: cell });
    }
  }
  game.benchY = height - 78;
}

function makePiece(kind, level = 1) {
  const type = unitTypes[kind] ? "troop" : "letter";
  return { id: uid(), kind, type, level, hp: maxHp(kind, level, type), maxHp: maxHp(kind, level, type), cooldown: 0, cell: null, x: 0, y: 0 };
}

function makeHero(recipe, level = 1) {
  return {
    id: uid(),
    kind: recipe.name,
    type: "hero",
    recipe,
    level,
    hp: Math.round(recipe.hp * (1 + (level - 1) * 0.45)),
    maxHp: Math.round(recipe.hp * (1 + (level - 1) * 0.45)),
    cooldown: 0,
    cell: null,
    x: 0,
    y: 0,
  };
}

function maxHp(kind, level, type = unitTypes[kind] ? "troop" : "letter") {
  if (type === "letter") return 35;
  const base = unitTypes[kind]?.hp || 40;
  return Math.round(base * (1 + (level - 1) * 0.7));
}

function summon() {
  if (game.state === "ended" || game.food < 3 || game.bench.length >= 14) return;
  game.food -= 3;
  const kind = summonPool[Math.floor(Math.random() * summonPool.length)];
  const unit = makePiece(kind);
  game.bench.push(unit);
  statusEl.textContent = heroChars.has(kind) ? `召唤出武将字“${kind}”，放到棋盘凑姓名。` : `召唤出 Lv1 “${kind}”。`;
  updateHud();
}

function startWave() {
  if (game.state !== "build") return;
  game.state = "battle";
  game.spawnLeft = waveEnemyCount(game.wave);
  game.spawnTimer = 0.2;
  game.adou.t = 0;
  game.enemyAdou.t = 0;
  statusEl.textContent = isBossWave(game.wave) ? `第 ${game.wave} 波 Boss 来袭。` : `第 ${game.wave} 波敌军来袭。`;
  updateHud();
}

function isBossWave(wave) {
  return wave % 5 === 0;
}

function waveEnemyCount(wave) {
  return 8 + Math.floor(wave * 2.4) + Math.floor(wave / 3) * 2 + (isBossWave(wave) ? 1 : 0);
}

function spawnEnemy() {
  const wave = game.wave;
  const boss = isBossWave(wave) && game.spawnLeft === 1;
  const normalHp = 76 + wave * 22 + Math.floor(Math.pow(wave, 1.35) * 7);
  const maxHp = boss ? 620 + wave * 110 + Math.floor(Math.pow(wave, 1.25) * 45) : normalHp;
  game.enemies.push({
    x: w() + 42,
    y: h() * (0.27 + Math.random() * 0.4),
    hp: maxHp,
    maxHp,
    speed: boss ? 25 + Math.min(20, wave * 0.7) : Math.min(92, 42 + wave * 2.1),
    damage: boss ? 2 + Math.floor(wave / 15) : 1,
    boss,
    color: boss ? "#702b3a" : "#826b49",
  });
}

function update(delta) {
  if (game.state === "battle") {
    game.spawnTimer -= delta;
    if (game.spawnTimer <= 0 && game.spawnLeft > 0) {
      spawnEnemy();
      game.spawnLeft -= 1;
      game.spawnTimer = Math.max(0.28, 1.05 - game.wave * 0.045);
    }
    updateAdou(delta);
    updateUnits(delta);
    updateEnemies(delta);
    updateProjectiles(delta);
    if (game.spawnLeft <= 0 && game.enemies.length === 0) finishWave();
  }
  updateEffects(delta);
  updateHud();
}

function updateAdou(delta) {
  game.adou.t = clamp(game.adou.t + delta * 0.03, 0, 1);
  game.enemyAdou.t = clamp(game.enemyAdou.t + delta * 0.026, 0, 1);
  game.adou.x = w() * (0.08 + game.adou.t * 0.72);
  game.adou.y = h() * 0.87;
  game.enemyAdou.x = w() * (0.92 - game.enemyAdou.t * 0.72);
  game.enemyAdou.y = h() * 0.1;
}

function updateUnits(delta) {
  const fighters = game.units.filter((u) => u.type === "troop" || u.type === "hero");
  for (const unit of fighters) {
    unit.cooldown = Math.max(0, unit.cooldown - delta);
    const data = getCombatData(unit);
    if (unit.kind === "骑" || unit.kind === "马超") unit.x += delta * 8;
    const target = nearestEnemy(unit.x, unit.y, data.range);
    if (target && unit.cooldown <= 0) {
      unit.cooldown = Math.max(0.12, data.rate - unit.level * 0.025);
      game.projectiles.push({ x: unit.x, y: unit.y, target, damage: data.damage, color: data.color, splash: data.splash || 0 });
    }
  }
}

function getCombatData(unit) {
  if (unit.type === "hero") {
    const r = unit.recipe;
    return {
      range: r.range,
      rate: r.rate,
      damage: Math.round(r.damage * (1 + (unit.level - 1) * 0.55)),
      color: r.color,
      splash: r.splash || 0,
    };
  }
  const base = unitTypes[unit.kind];
  return {
    range: base.range,
    rate: base.rate,
    damage: Math.round(base.damage * (1 + (unit.level - 1) * 0.55)),
    color: base.color,
  };
}

function updateEnemies(delta) {
  for (const enemy of game.enemies) {
    enemy.x -= enemy.speed * delta;
    const blocker = game.units.find((u) => (u.type === "troop" || u.type === "hero") && Math.hypot(u.x - enemy.x, u.y - enemy.y) < 34);
    if (blocker) {
      enemy.x += enemy.speed * delta;
      blocker.hp -= delta * (enemy.boss ? 26 : 12);
      enemy.hp -= delta * getCombatData(blocker).damage * 0.28;
    }
    if (Math.hypot(enemy.x - game.adou.x, enemy.y - game.adou.y) < 40 || enemy.x < 20) {
      enemy.hp = 0;
      game.myHp -= enemy.damage;
      addEffect(game.adou.x, game.adou.y, "#ef5d50", 24);
      if (game.myHp <= 0) endGame("阿斗失守");
    }
  }
  game.units = game.units.filter((u) => u.type === "letter" || u.hp > 0);
  game.enemies = game.enemies.filter((e) => {
    if (e.hp > 0) return true;
    if (e.x > 20) {
      game.food += e.boss ? 20 : 2;
      addEffect(e.x, e.y, e.color, e.boss ? 38 : 18);
    }
    return false;
  });
}

function updateProjectiles(delta) {
  for (const p of game.projectiles) {
    if (!p.target || p.target.hp <= 0) {
      p.dead = true;
      continue;
    }
    const dx = p.target.x - p.x;
    const dy = p.target.y - p.y;
    const len = Math.hypot(dx, dy);
    const step = 540 * delta;
    if (len <= step) {
      p.target.hp -= p.damage;
      if (p.splash) {
        for (const enemy of game.enemies) {
          if (enemy !== p.target && Math.hypot(enemy.x - p.target.x, enemy.y - p.target.y) <= p.splash) {
            enemy.hp -= Math.round(p.damage * 0.45);
          }
        }
      }
      addEffect(p.target.x, p.target.y, p.color, p.splash ? 18 : 8);
      p.dead = true;
    } else {
      p.x += dx / len * step;
      p.y += dy / len * step;
    }
  }
  game.projectiles = game.projectiles.filter((p) => !p.dead);
}

function updateEffects(delta) {
  for (const effect of game.effects) {
    effect.life -= delta;
    effect.radius += delta * 50;
  }
  game.effects = game.effects.filter((e) => e.life > 0);
}

function nearestEnemy(x, y, range) {
  return game.enemies.filter((e) => Math.hypot(e.x - x, e.y - y) <= range).sort((a, b) => a.x - b.x)[0];
}

function finishWave() {
  const clearedWave = game.wave;
  game.state = "build";
  game.wave += 1;
  game.food += 7 + Math.floor(clearedWave / 2) + (isBossWave(clearedWave) ? 6 : 0);
  if (isBossWave(clearedWave)) game.myHp = Math.min(5, game.myHp + 1);
  if (clearedWave > game.bestWave) {
    game.bestWave = clearedWave;
    localStorage.setItem(bestWaveKey, String(game.bestWave));
  }
  statusEl.textContent = `第 ${clearedWave} 波守住了。下一波敌人更多更硬，Boss 每 5 波出现一次。`;
}

function endGame(text) {
  game.state = "ended";
  overlay.textContent = text;
  overlay.classList.remove("hidden");
}

function addEffect(x, y, color, radius) {
  game.effects.push({ x, y, color, radius, life: 0.35 });
}

function screenPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function hitUnit(x, y) {
  return [...game.bench, ...game.units].reverse().find((u) => Math.hypot(u.x - x, u.y - y) < 30);
}

function hitCell(x, y) {
  return game.board.find((cell) => x >= cell.x && x <= cell.x + cell.size && y >= cell.y && y <= cell.y + cell.size);
}

function placeUnit(unit, x, y) {
  const cell = hitCell(x, y);
  if (!cell) return;
  const existing = game.units.find((u) => u.cell === cell);
  if (existing === unit) return;
  if (existing && canMerge(existing, unit)) {
    mergeInto(existing, unit);
    return;
  }
  if (existing) return;
  removeLoose(unit);
  unit.cell = cell;
  unit.x = cell.x + cell.size / 2;
  unit.y = cell.y + cell.size / 2;
  game.units.push(unit);
  tryActivateHeroes();
}

function canMerge(a, b) {
  return a.type !== "letter" && a.type === b.type && a.kind === b.kind && a.level === b.level;
}

function mergeInto(target, source) {
  target.level += 1;
  if (target.type === "hero") {
    target.hp = Math.round(target.recipe.hp * (1 + (target.level - 1) * 0.45));
  } else {
    target.hp = maxHp(target.kind, target.level, target.type);
  }
  target.maxHp = target.hp;
  removeLoose(source);
  addEffect(target.x, target.y, "#f0c86a", 24);
  statusEl.textContent = `${target.kind} 升到 Lv${target.level}`;
}

function removeLoose(unit) {
  game.bench = game.bench.filter((u) => u !== unit);
  game.units = game.units.filter((u) => u !== unit);
}

function tryActivateHeroes() {
  let activated = true;
  while (activated) {
    activated = false;
    for (const recipe of heroRecipes) {
      const chain = findHeroChain(recipe);
      if (!chain) continue;
      const first = chain[0];
      const hero = makeHero(recipe);
      hero.cell = first.cell;
      hero.x = first.x;
      hero.y = first.y;
      for (const piece of chain) removeLoose(piece);
      game.units.push(hero);
      addEffect(hero.x, hero.y, recipe.color, 32);
      statusEl.textContent = `${recipe.name}激活：${recipe.title}`;
      activated = true;
      break;
    }
  }
}

function findHeroChain(recipe) {
  const letters = game.units.filter((u) => u.type === "letter");
  const starters = letters.filter((u) => u.kind === recipe.chars[0]);
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (const start of starters) {
    for (const [dc, dr] of dirs) {
      const chain = [start];
      let ok = true;
      for (let i = 1; i < recipe.chars.length; i += 1) {
        const r = start.cell.r + dr * i;
        const c = start.cell.c + dc * i;
        const next = letters.find((u) => u.kind === recipe.chars[i] && u.cell.r === r && u.cell.c === c);
        if (!next) {
          ok = false;
          break;
        }
        chain.push(next);
      }
      if (ok) return chain;
    }
  }
  return null;
}

function updateHud() {
  foodEl.textContent = game.food;
  waveEl.textContent = `第 ${game.wave} 波`;
  myHpEl.textContent = "♥".repeat(Math.max(0, game.myHp));
  enemyHpEl.textContent = `最高 ${Math.max(game.bestWave, game.wave - 1)}`;
  summonBtn.disabled = game.food < 3 || game.state === "ended" || game.bench.length >= 14;
  startWaveBtn.disabled = game.state !== "build";
}

function draw() {
  ctx.clearRect(0, 0, w(), h());
  drawBackground();
  drawBoard();
  drawAdou();
  drawUnits();
  drawEnemies();
  drawProjectiles();
  drawEffects();
  drawHintText();
  if (drag) drawTextBlock(drag.unit, pointer.x, pointer.y, 30);
}

function drawBackground() {
  const bg = ctx.createLinearGradient(0, 0, w(), h());
  bg.addColorStop(0, "#263246");
  bg.addColorStop(0.52, "#30412e");
  bg.addColorStop(1, "#1b211c");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w(), h());
  ctx.strokeStyle = "rgba(240,200,106,.25)";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(w() * 0.05, h() * 0.86);
  ctx.lineTo(w() * 0.82, h() * 0.86);
  ctx.moveTo(w() * 0.95, h() * 0.1);
  ctx.lineTo(w() * 0.22, h() * 0.1);
  ctx.stroke();
}

function drawBoard() {
  for (const cell of game.board) {
    ctx.fillStyle = "rgba(255,255,255,.08)";
    ctx.fillRect(cell.x, cell.y, cell.size, cell.size);
    ctx.strokeStyle = "rgba(255,255,255,.18)";
    ctx.strokeRect(cell.x, cell.y, cell.size, cell.size);
  }
}

function drawHintText() {
  ctx.fillStyle = "rgba(247,241,229,.76)";
  ctx.font = "700 13px Microsoft YaHei";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("英雄：赵云 / 关羽 / 张飞 / 马超 / 黄忠 / 诸葛亮。按顺序横竖相邻即可合成。", w() * 0.08, h() * 0.1);
}

function drawAdou() {
  drawTextBlock({ kind: "斗", level: game.myHp, type: "adou", color: "#ef5d50" }, game.adou.x || w() * 0.08, game.adou.y || h() * 0.87, 28);
  drawTextBlock({ kind: "斗", level: Math.max(1, Math.floor(game.wave / 5) + 1), type: "adou", color: "#66b8e8" }, game.enemyAdou.x || w() * 0.92, game.enemyAdou.y || h() * 0.1, 28);
}

function drawUnits() {
  for (const [i, unit] of game.bench.entries()) {
    unit.x = 58 + i * 52;
    unit.y = game.benchY;
    if (!drag || drag.unit !== unit) drawTextBlock(unit, unit.x, unit.y, 25);
  }
  for (const unit of game.units) {
    if (!drag || drag.unit !== unit) drawTextBlock(unit, unit.x, unit.y, unit.type === "hero" ? 32 : 28);
    if (unit.type === "troop" || unit.type === "hero") drawHp(unit.x, unit.y + 30, unit.hp / unit.maxHp, unit.type === "hero" ? 58 : 42);
  }
}

function drawEnemies() {
  for (const enemy of game.enemies) {
    drawTextBlock({ kind: enemy.boss ? "将" : "兵", level: enemy.boss ? Math.max(5, game.wave) : game.wave, type: "enemy", color: enemy.color }, enemy.x, enemy.y, enemy.boss ? 36 : 28);
    drawHp(enemy.x, enemy.y + 30, enemy.hp / enemy.maxHp, enemy.boss ? 64 : 44);
  }
}

function drawProjectiles() {
  for (const p of game.projectiles) {
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.splash ? 6 : 5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawEffects() {
  for (const e of game.effects) {
    ctx.globalAlpha = Math.max(0, e.life * 3);
    ctx.strokeStyle = e.color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawTextBlock(unit, x, y, size) {
  const color = unit.color || unitTypes[unit.kind]?.color || unit.recipe?.color || "#f0c86a";
  const label = unit.type === "hero" ? unit.kind.slice(-1) : unit.kind;
  ctx.fillStyle = "rgba(0,0,0,.38)";
  ctx.fillRect(x - size, y - size, size * 2, size * 2);
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.strokeRect(x - size, y - size, size * 2, size * 2);
  if (unit.type === "hero") {
    ctx.fillStyle = "rgba(240,200,106,.18)";
    ctx.fillRect(x - size + 4, y - size + 4, size * 2 - 8, size * 2 - 8);
  }
  ctx.fillStyle = color;
  ctx.font = `900 ${unit.type === "hero" ? size * 0.95 : size * 1.15}px Microsoft YaHei, monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, x, y + 1);
  ctx.fillStyle = "#f7f1e5";
  ctx.font = `900 ${size * 0.36}px Microsoft YaHei, monospace`;
  const tag = unit.type === "letter" ? "字" : `Lv${unit.level}`;
  ctx.fillText(tag, x + size * 0.44, y - size * 0.58);
}

function drawHp(x, y, ratio, width) {
  ctx.fillStyle = "#151719";
  ctx.fillRect(x - width / 2, y, width, 5);
  ctx.fillStyle = "#69d08c";
  ctx.fillRect(x - width / 2, y, width * clamp(ratio, 0, 1), 5);
}

function frame(now) {
  const delta = Math.min(0.033, (now - lastTime) / 1000 || 0);
  lastTime = now;
  update(delta);
  draw();
  requestAnimationFrame(frame);
}

canvas.addEventListener("pointerdown", (event) => {
  if (game.state === "ended") return;
  pointer = screenPoint(event);
  const unit = hitUnit(pointer.x, pointer.y);
  if (unit) drag = { unit };
});
canvas.addEventListener("pointermove", (event) => {
  pointer = screenPoint(event);
});
canvas.addEventListener("pointerup", (event) => {
  if (!drag) return;
  pointer = screenPoint(event);
  placeUnit(drag.unit, pointer.x, pointer.y);
  drag = null;
});
summonBtn.addEventListener("click", summon);
startWaveBtn.addEventListener("click", startWave);
restartBtn.addEventListener("click", newGame);
window.addEventListener("resize", resizeCanvas);

resizeCanvas();
newGame();
requestAnimationFrame(frame);
