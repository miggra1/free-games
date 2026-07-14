const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");

const ui = {
  level: document.querySelector("#levelText"),
  time: document.querySelector("#timeText"),
  goal: document.querySelector("#goalText"),
  gems: document.querySelector("#gemText"),
  lives: document.querySelector("#lifeText"),
  toast: document.querySelector("#toast"),
  restart: document.querySelector("#restartBtn"),
  mode: document.querySelector("#modeBtn"),
  hint: document.querySelector("#hintBtn"),
  pause: document.querySelector("#pauseBtn"),
};

const dirs = [
  { x: 0, y: -1, wall: "n", opposite: "s" },
  { x: 1, y: 0, wall: "e", opposite: "w" },
  { x: 0, y: 1, wall: "s", opposite: "n" },
  { x: -1, y: 0, wall: "w", opposite: "e" },
];

const keys = new Set();
const touchState = { x: 0, y: 0 };
const state = {
  level: 1,
  mode: "normal",
  paused: false,
  started: false,
  won: false,
  cell: 32,
  cols: 17,
  rows: 13,
  elapsed: 0,
  timeLimit: 90,
  lives: 3,
  score: 0,
  revealHint: 0,
  shake: 0,
  flash: 0,
  grid: [],
  path: [],
  gems: [],
  traps: [],
  portals: [],
  enemies: [],
  particles: [],
  exit: { x: 0, y: 0 },
  key: { x: 0, y: 0, taken: false },
  player: { x: 0, y: 0, px: 0, py: 0, dirX: 0, dirY: 1, cooldown: 0, invuln: 0 },
};

function randInt(max) {
  return Math.floor(Math.random() * max);
}

function shuffle(items) {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = randInt(i + 1);
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

function cellAt(x, y) {
  return state.grid[y]?.[x];
}

function canMove(x, y, dx, dy) {
  const cell = cellAt(x, y);
  if (!cell) return false;
  if (dx === 1) return !cell.e;
  if (dx === -1) return !cell.w;
  if (dy === 1) return !cell.s;
  if (dy === -1) return !cell.n;
  return false;
}

function generateMaze(cols, rows) {
  const grid = Array.from({ length: rows }, (_, y) =>
    Array.from({ length: cols }, (_, x) => ({ x, y, n: true, e: true, s: true, w: true, seen: false, visited: false })),
  );
  const stack = [grid[0][0]];
  grid[0][0].visited = true;

  while (stack.length) {
    const current = stack[stack.length - 1];
    const options = shuffle([...dirs]).filter(({ x, y }) => {
      const next = grid[current.y + y]?.[current.x + x];
      return next && !next.visited;
    });

    if (!options.length) {
      stack.pop();
      continue;
    }

    const dir = options[0];
    const next = grid[current.y + dir.y][current.x + dir.x];
    current[dir.wall] = false;
    next[dir.opposite] = false;
    next.visited = true;
    stack.push(next);
  }

  for (let i = 0; i < Math.floor(cols * rows * 0.11); i += 1) {
    const x = randInt(cols);
    const y = randInt(rows);
    const dir = dirs[randInt(dirs.length)];
    const next = grid[y + dir.y]?.[x + dir.x];
    if (next) {
      grid[y][x][dir.wall] = false;
      next[dir.opposite] = false;
    }
  }

  return grid.map((row) => row.map((cell) => ({ ...cell, visited: false })));
}

function findPath(from, to) {
  const queue = [{ ...from, trail: [] }];
  const seen = new Set([`${from.x},${from.y}`]);
  while (queue.length) {
    const current = queue.shift();
    if (current.x === to.x && current.y === to.y) return [...current.trail, { x: current.x, y: current.y }];
    for (const dir of dirs) {
      const nx = current.x + dir.x;
      const ny = current.y + dir.y;
      const id = `${nx},${ny}`;
      if (!seen.has(id) && canMove(current.x, current.y, dir.x, dir.y)) {
        seen.add(id);
        queue.push({ x: nx, y: ny, trail: [...current.trail, { x: current.x, y: current.y }] });
      }
    }
  }
  return [];
}

function farthestCell() {
  const queue = [{ x: 0, y: 0, d: 0 }];
  const seen = new Set(["0,0"]);
  let far = queue[0];
  while (queue.length) {
    const current = queue.shift();
    if (current.d > far.d) far = current;
    for (const dir of dirs) {
      const nx = current.x + dir.x;
      const ny = current.y + dir.y;
      const id = `${nx},${ny}`;
      if (!seen.has(id) && canMove(current.x, current.y, dir.x, dir.y)) {
        seen.add(id);
        queue.push({ x: nx, y: ny, d: current.d + 1 });
      }
    }
  }
  return { x: far.x, y: far.y };
}

function pickPathCell(minIndex, maxIndex) {
  const span = Math.max(1, maxIndex - minIndex);
  return state.path[Math.min(state.path.length - 2, minIndex + randInt(span))];
}

function startLevel(level = state.level) {
  state.level = level;
  state.cols = Math.min(29, 15 + level * 2);
  state.rows = Math.min(21, 11 + Math.floor(level * 1.4));
  if (state.cols % 2 === 0) state.cols += 1;
  if (state.rows % 2 === 0) state.rows += 1;
  state.grid = generateMaze(state.cols, state.rows);
  state.exit = farthestCell();
  state.path = findPath({ x: 0, y: 0 }, state.exit);
  state.timeLimit = Math.max(52, 96 - level * 4);
  state.elapsed = 0;
  state.lives = 3;
  state.revealHint = 2.4;
  state.shake = 0;
  state.flash = 0;
  state.won = false;
  state.paused = false;
  state.started = false;
  state.player = { x: 0, y: 0, px: 0, py: 0, dirX: 0, dirY: 1, cooldown: 0, invuln: 0 };
  state.key = { ...pickPathCell(Math.floor(state.path.length * 0.45), Math.floor(state.path.length * 0.72)), taken: false };
  state.gems = [];
  state.traps = [];
  state.portals = [];
  state.enemies = [];
  state.particles = [];

  const gemCount = Math.min(12, 5 + level);
  const occupied = new Set(["0,0", `${state.exit.x},${state.exit.y}`, `${state.key.x},${state.key.y}`]);
  for (let i = 0; i < gemCount; i += 1) {
    placeItem(state.gems, occupied, { taken: false, pulse: Math.random() * 6 });
  }
  for (let i = 0; i < Math.min(10, 3 + level); i += 1) {
    placeItem(state.traps, occupied, { hot: Math.random() * 4 });
  }
  for (let i = 0; i < Math.min(4, Math.floor(level / 2) + 1); i += 1) {
    const cell = pickPathCell(3 + i * 4, state.path.length - 4);
    state.enemies.push({ x: cell.x, y: cell.y, from: 0, speed: 0.7 + level * 0.08, wait: i * 0.4, route: makeEnemyRoute(cell) });
  }
  if (level >= 2) {
    const a = pickPathCell(4, Math.floor(state.path.length * 0.34));
    const b = pickPathCell(Math.floor(state.path.length * 0.68), state.path.length - 3);
    state.portals = [{ ...a, to: b }, { ...b, to: a }];
  }

  showToast("方向键或 WASD 移动。拿钥匙开出口，宝石会加分。");
  updateHud();
}

function placeItem(list, occupied, extra) {
  for (let tries = 0; tries < 200; tries += 1) {
    const x = 1 + randInt(state.cols - 1);
    const y = 1 + randInt(state.rows - 1);
    const id = `${x},${y}`;
    if (!occupied.has(id)) {
      occupied.add(id);
      list.push({ x, y, ...extra });
      return;
    }
  }
}

function makeEnemyRoute(cell) {
  const route = [{ x: cell.x, y: cell.y }];
  let current = cell;
  for (let i = 0; i < 5; i += 1) {
    const options = dirs.filter((dir) => canMove(current.x, current.y, dir.x, dir.y));
    const dir = options[randInt(options.length)];
    current = { x: current.x + dir.x, y: current.y + dir.y };
    route.push(current);
  }
  return route;
}

function showToast(text, seconds = 2.4) {
  ui.toast.textContent = text;
  ui.toast.classList.remove("is-hidden");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => ui.toast.classList.add("is-hidden"), seconds * 1000);
}

function updateHud() {
  ui.level.textContent = state.level;
  ui.time.textContent = Math.max(0, Math.ceil(state.timeLimit - state.elapsed));
  ui.gems.textContent = `${state.gems.filter((gem) => gem.taken).length}/${state.gems.length}`;
  ui.lives.textContent = state.lives;
  ui.mode.textContent = state.mode === "normal" ? "普通" : "硬核";
  if (state.key.taken) {
    ui.goal.textContent = "钥匙到手，去出口";
  } else {
    ui.goal.textContent = "找钥匙，冲出口";
  }
  ui.pause.textContent = state.paused ? "继续" : "暂停";
}

function movePlayer(dx, dy) {
  if (state.paused || state.won || state.player.cooldown > 0) return;
  state.started = true;
  if (!canMove(state.player.x, state.player.y, dx, dy)) {
    state.shake = 0.16;
    state.player.dirX = dx;
    state.player.dirY = dy;
    return;
  }
  state.player.x += dx;
  state.player.y += dy;
  state.player.dirX = dx;
  state.player.dirY = dy;
  state.player.cooldown = 0.105;
  state.score += 1;
  collectAtPlayer();
}

function collectAtPlayer() {
  const { x, y } = state.player;
  const here = (item) => item.x === x && item.y === y;
  if (!state.key.taken && here(state.key)) {
    state.key.taken = true;
    state.score += 150;
    burst(x, y, "key");
    showToast("钥匙拿到了！出口已经解锁。");
  }
  for (const gem of state.gems) {
    if (!gem.taken && here(gem)) {
      gem.taken = true;
      state.score += 40;
      burst(x, y, "gem");
    }
  }
  for (const trap of state.traps) {
    if (here(trap)) hitPlayer("踩到陷阱，少一条命。");
  }
  for (const portal of state.portals) {
    if (here(portal)) {
      state.player.x = portal.to.x;
      state.player.y = portal.to.y;
      state.player.cooldown = 0.18;
      state.score += 20;
      burst(state.player.x, state.player.y, "portal");
      showToast("传送成功，路线变短了。", 1.3);
      break;
    }
  }
  if (x === state.exit.x && y === state.exit.y) {
    if (state.key.taken) finishLevel();
    else showToast("出口锁着，先去找钥匙。", 1.4);
  }
  updateHud();
}

function hitPlayer(text) {
  if (state.player.invuln > 0) return;
  state.lives -= 1;
  state.player.invuln = 1.1;
  state.shake = 0.34;
  state.flash = 0.25;
  showToast(text, 1.5);
  if (state.lives <= 0) {
    if (state.mode === "hard") {
      state.level = 1;
      state.score = 0;
    }
    startLevel(state.level);
    showToast("失败了，迷宫已重置。再来一局。", 2.2);
  }
  updateHud();
}

function finishLevel() {
  state.won = true;
  const gems = state.gems.filter((gem) => gem.taken).length;
  const bonus = Math.ceil(state.timeLimit - state.elapsed) * 5 + gems * 60;
  state.score += bonus;
  burst(state.exit.x, state.exit.y, "win");
  showToast(`通关！得分 ${state.score}，下一关更难。`, 2.6);
  setTimeout(() => startLevel(state.level + 1), 1500);
}

function burst(x, y, type) {
  const colors = {
    gem: ["#58ffd0", "#f7ff8a"],
    key: ["#ffe27b", "#ffffff"],
    portal: ["#c694ff", "#58ffd0"],
    win: ["#ffffff", "#ffe27b", "#58ffd0"],
  }[type] || ["#ffffff"];
  for (let i = 0; i < 18; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 70 + Math.random() * 150;
    state.particles.push({
      x: x + 0.5,
      y: y + 0.5,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.45 + Math.random() * 0.35,
      color: colors[randInt(colors.length)],
    });
  }
}

function update(dt) {
  if (!state.paused && !state.won && state.started) {
    state.elapsed += dt;
    if (state.elapsed >= state.timeLimit) hitPlayer("时间耗尽，重新开始这一关。");
  }
  state.player.cooldown = Math.max(0, state.player.cooldown - dt);
  state.player.invuln = Math.max(0, state.player.invuln - dt);
  state.revealHint = Math.max(0, state.revealHint - dt);
  state.shake = Math.max(0, state.shake - dt);
  state.flash = Math.max(0, state.flash - dt);

  const inputX = (keys.has("ArrowRight") || keys.has("KeyD") ? 1 : 0) - (keys.has("ArrowLeft") || keys.has("KeyA") ? 1 : 0) + touchState.x;
  const inputY = (keys.has("ArrowDown") || keys.has("KeyS") ? 1 : 0) - (keys.has("ArrowUp") || keys.has("KeyW") ? 1 : 0) + touchState.y;
  if (Math.abs(inputX) > Math.abs(inputY) && inputX !== 0) movePlayer(Math.sign(inputX), 0);
  else if (inputY !== 0) movePlayer(0, Math.sign(inputY));

  for (const enemy of state.enemies) {
    enemy.wait -= dt;
    if (enemy.wait > 0 || state.paused || state.won) continue;
    enemy.from += dt * enemy.speed;
    const index = Math.floor(enemy.from) % enemy.route.length;
    const next = enemy.route[index];
    enemy.x = next.x;
    enemy.y = next.y;
    if (enemy.x === state.player.x && enemy.y === state.player.y) hitPlayer("被巡逻者抓住了。");
  }

  for (const particle of state.particles) {
    particle.life -= dt;
    particle.x += (particle.vx * dt) / state.cell;
    particle.y += (particle.vy * dt) / state.cell;
    particle.vx *= 0.92;
    particle.vy *= 0.92;
  }
  state.particles = state.particles.filter((particle) => particle.life > 0);
  cellAt(state.player.x, state.player.y).seen = true;
  for (const dir of dirs) {
    const seen = cellAt(state.player.x + dir.x, state.player.y + dir.y);
    if (seen) seen.seen = true;
  }
  updateHud();
}

function draw() {
  const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  const rect = canvas.getBoundingClientRect();
  if (canvas.width !== Math.floor(rect.width * dpr) || canvas.height !== Math.floor(rect.height * dpr)) {
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const width = rect.width;
  const height = rect.height;
  ctx.clearRect(0, 0, width, height);

  const padding = 18;
  state.cell = Math.floor(Math.min((width - padding * 2) / state.cols, (height - padding * 2) / state.rows));
  const ox = Math.floor((width - state.cell * state.cols) / 2);
  const oy = Math.floor((height - state.cell * state.rows) / 2);
  const shakeX = state.shake ? (Math.random() - 0.5) * state.shake * 24 : 0;
  const shakeY = state.shake ? (Math.random() - 0.5) * state.shake * 24 : 0;
  ctx.save();
  ctx.translate(ox + shakeX, oy + shakeY);

  drawFloor();
  drawItems();
  drawWalls();
  drawPlayer();
  drawFog();
  drawMiniMap(width - ox - 152, 14 - oy);
  ctx.restore();

  if (state.flash > 0) {
    ctx.fillStyle = `rgba(255, 72, 55, ${state.flash * 0.52})`;
    ctx.fillRect(0, 0, width, height);
  }
}

function drawFloor() {
  const c = state.cell;
  ctx.fillStyle = "#182733";
  ctx.fillRect(0, 0, state.cols * c, state.rows * c);
  for (let y = 0; y < state.rows; y += 1) {
    for (let x = 0; x < state.cols; x += 1) {
      ctx.fillStyle = (x + y) % 2 ? "#1b2d38" : "#172630";
      ctx.fillRect(x * c, y * c, c, c);
      if (cellAt(x, y).seen) {
        ctx.fillStyle = "rgba(108, 255, 212, 0.035)";
        ctx.fillRect(x * c + 2, y * c + 2, c - 4, c - 4);
      }
    }
  }
  if (state.revealHint > 0) drawRoute(state.path, `rgba(100, 255, 212, ${0.16 * Math.min(1, state.revealHint)})`, 4);
  if (state.revealHint > 2.15) drawRoute(findPath({ x: state.player.x, y: state.player.y }, state.key.taken ? state.exit : state.key), "rgba(255, 226, 123, 0.35)", 5);
}

function drawRoute(path, color, lineWidth) {
  if (path.length < 2) return;
  const c = state.cell;
  ctx.beginPath();
  path.forEach((point, index) => {
    const x = point.x * c + c / 2;
    const y = point.y * c + c / 2;
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke();
}

function drawItems() {
  const c = state.cell;
  drawExit();
  if (!state.key.taken) {
    drawToken(state.key.x, state.key.y, "#ffe27b", "钥");
  }
  for (const gem of state.gems) {
    if (!gem.taken) drawToken(gem.x, gem.y, "#58ffd0", "◆");
  }
  for (const trap of state.traps) {
    drawToken(trap.x, trap.y, "#ff665d", "!");
  }
  for (const portal of state.portals) {
    const cx = portal.x * c + c / 2;
    const cy = portal.y * c + c / 2;
    ctx.strokeStyle = "#c694ff";
    ctx.lineWidth = Math.max(2, c * 0.08);
    ctx.beginPath();
    ctx.arc(cx, cy, c * 0.28, performance.now() / 280, Math.PI * 1.7 + performance.now() / 280);
    ctx.stroke();
  }
  for (const enemy of state.enemies) drawEnemy(enemy);
  for (const p of state.particles) {
    ctx.globalAlpha = Math.max(0, p.life * 1.8);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x * c, p.y * c, Math.max(2, c * 0.06), 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function drawToken(x, y, color, label) {
  const c = state.cell;
  const cx = x * c + c / 2;
  const cy = y * c + c / 2;
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.arc(cx, cy, c * 0.23, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#10202a";
  ctx.font = `800 ${Math.max(11, c * 0.32)}px system-ui`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, cx, cy + 1);
}

function drawExit() {
  const c = state.cell;
  const x = state.exit.x * c;
  const y = state.exit.y * c;
  ctx.fillStyle = state.key.taken ? "#58ffd0" : "#5b6670";
  ctx.fillRect(x + c * 0.22, y + c * 0.18, c * 0.56, c * 0.64);
  ctx.fillStyle = "#101821";
  ctx.fillRect(x + c * 0.32, y + c * 0.3, c * 0.36, c * 0.52);
  ctx.fillStyle = state.key.taken ? "#ffe27b" : "#9aa3aa";
  ctx.fillRect(x + c * 0.44, y + c * 0.47, c * 0.12, c * 0.12);
}

function drawEnemy(enemy) {
  const c = state.cell;
  const cx = enemy.x * c + c / 2;
  const cy = enemy.y * c + c / 2;
  ctx.fillStyle = "#ff665d";
  ctx.beginPath();
  ctx.roundRect(cx - c * 0.26, cy - c * 0.24, c * 0.52, c * 0.48, c * 0.12);
  ctx.fill();
  ctx.fillStyle = "#261014";
  ctx.fillRect(cx - c * 0.12, cy - c * 0.04, c * 0.08, c * 0.08);
  ctx.fillRect(cx + c * 0.04, cy - c * 0.04, c * 0.08, c * 0.08);
}

function drawWalls() {
  const c = state.cell;
  ctx.strokeStyle = "#76ffe0";
  ctx.lineWidth = Math.max(3, c * 0.11);
  ctx.lineCap = "round";
  ctx.shadowColor = "rgba(88, 255, 208, 0.55)";
  ctx.shadowBlur = 9;
  for (const row of state.grid) {
    for (const cell of row) {
      const x = cell.x * c;
      const y = cell.y * c;
      ctx.beginPath();
      if (cell.n) {
        ctx.moveTo(x, y);
        ctx.lineTo(x + c, y);
      }
      if (cell.e) {
        ctx.moveTo(x + c, y);
        ctx.lineTo(x + c, y + c);
      }
      if (cell.s) {
        ctx.moveTo(x, y + c);
        ctx.lineTo(x + c, y + c);
      }
      if (cell.w) {
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + c);
      }
      ctx.stroke();
    }
  }
  ctx.shadowBlur = 0;
}

function drawPlayer() {
  const c = state.cell;
  const cx = state.player.x * c + c / 2;
  const cy = state.player.y * c + c / 2;
  const blink = state.player.invuln > 0 && Math.floor(performance.now() / 90) % 2 === 0;
  if (blink) return;
  ctx.fillStyle = "#ffe27b";
  ctx.shadowColor = "rgba(255, 226, 123, 0.8)";
  ctx.shadowBlur = 16;
  ctx.beginPath();
  ctx.arc(cx, cy, c * 0.28, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#10202a";
  ctx.beginPath();
  ctx.arc(cx + state.player.dirX * c * 0.09 - c * 0.06, cy + state.player.dirY * c * 0.09 - c * 0.04, c * 0.035, 0, Math.PI * 2);
  ctx.arc(cx + state.player.dirX * c * 0.09 + c * 0.06, cy + state.player.dirY * c * 0.09 - c * 0.04, c * 0.035, 0, Math.PI * 2);
  ctx.fill();
}

function drawFog() {
  const c = state.cell;
  const px = state.player.x * c + c / 2;
  const py = state.player.y * c + c / 2;
  const radius = c * (state.mode === "hard" ? 2.4 : 3.4);
  const fog = ctx.createRadialGradient(px, py, radius * 0.35, px, py, radius);
  fog.addColorStop(0, "rgba(0,0,0,0)");
  fog.addColorStop(1, "rgba(0,0,0,0.84)");
  ctx.fillStyle = fog;
  ctx.fillRect(0, 0, state.cols * c, state.rows * c);
  ctx.fillStyle = "rgba(2, 9, 15, 0.58)";
  ctx.beginPath();
  ctx.rect(0, 0, state.cols * c, state.rows * c);
  ctx.arc(px, py, radius, 0, Math.PI * 2, true);
  ctx.fill("evenodd");
}

function drawMiniMap(x, y) {
  const w = 132;
  const h = 96;
  const sx = w / state.cols;
  const sy = h / state.rows;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = "rgba(6, 14, 20, 0.76)";
  ctx.fillRect(0, 0, w, h);
  for (let row = 0; row < state.rows; row += 1) {
    for (let col = 0; col < state.cols; col += 1) {
      if (cellAt(col, row).seen || state.revealHint > 0) {
        ctx.fillStyle = "rgba(118, 255, 224, 0.22)";
        ctx.fillRect(col * sx, row * sy, Math.max(1, sx - 1), Math.max(1, sy - 1));
      }
    }
  }
  ctx.fillStyle = "#ffe27b";
  ctx.fillRect(state.player.x * sx - 1, state.player.y * sy - 1, 4, 4);
  ctx.fillStyle = state.key.taken ? "#58ffd0" : "#ff665d";
  ctx.fillRect(state.exit.x * sx - 1, state.exit.y * sy - 1, 4, 4);
  ctx.restore();
}

function bindButton(id, x, y) {
  const button = document.querySelector(id);
  const down = (event) => {
    event.preventDefault();
    touchState.x = x;
    touchState.y = y;
    button.classList.add("is-active");
  };
  const up = () => {
    if (touchState.x === x && touchState.y === y) {
      touchState.x = 0;
      touchState.y = 0;
    }
    button.classList.remove("is-active");
  };
  button.addEventListener("pointerdown", down);
  button.addEventListener("pointerup", up);
  button.addEventListener("pointercancel", up);
  button.addEventListener("pointerleave", up);
}

window.addEventListener("keydown", (event) => {
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(event.code)) event.preventDefault();
  if (event.code === "KeyR") startLevel(state.level);
  if (event.code === "KeyH") state.revealHint = 2.6;
  if (event.code === "Space") {
    state.paused = !state.paused;
    updateHud();
  }
  keys.add(event.code);
});

window.addEventListener("keyup", (event) => keys.delete(event.code));
ui.restart.addEventListener("click", () => startLevel(state.level));
ui.hint.addEventListener("click", () => {
  state.revealHint = 2.6;
  showToast("路线会短暂显示，抓紧看。", 1.4);
});
ui.pause.addEventListener("click", () => {
  state.paused = !state.paused;
  showToast(state.paused ? "已暂停" : "继续闯迷宫", 1);
  updateHud();
});
ui.mode.addEventListener("click", () => {
  state.mode = state.mode === "normal" ? "hard" : "normal";
  state.score = 0;
  startLevel(1);
  showToast(state.mode === "hard" ? "硬核模式：视野更窄，失败回到第一关。" : "普通模式：适合练路线。");
});
canvas.addEventListener("pointerdown", () => {
  state.started = true;
  showToast("开跑！", 0.7);
});

bindButton("#upBtn", 0, -1);
bindButton("#downBtn", 0, 1);
bindButton("#leftBtn", -1, 0);
bindButton("#rightBtn", 1, 0);

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

startLevel(1);
requestAnimationFrame(loop);
