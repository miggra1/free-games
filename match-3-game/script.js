const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const levelEl = document.querySelector("#level");
const scoreEl = document.querySelector("#score");
const movesEl = document.querySelector("#moves");
const targetEl = document.querySelector("#target");
const messageEl = document.querySelector("#message");
const restartBtn = document.querySelector("#restart");

const size = 8;
const colors = ["#f05d55", "#59b6ff", "#69d08c", "#f0c86a", "#b985ff", "#ff8bd1"];
const levels = [
  { target: 1800, moves: 28 },
  { target: 2600, moves: 30 },
  { target: 3600, moves: 31 },
  { target: 4800, moves: 32 },
  { target: 6500, moves: 34 },
];

let game;

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const scale = window.devicePixelRatio || 1;
  canvas.width = Math.round(rect.width * scale);
  canvas.height = Math.round(rect.height * scale);
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  canvas.w = rect.width;
  canvas.h = rect.height;
}

function w() { return canvas.w || canvas.clientWidth || 720; }
function h() { return canvas.h || canvas.clientHeight || 720; }
function randomGem() { return { color: Math.floor(Math.random() * colors.length), power: null }; }
function sameColor(a, b) { return a && b && a.color === b.color; }

function newGame(level = game?.level || 0) {
  const config = levels[level] || levels[levels.length - 1];
  game = {
    level,
    board: Array.from({ length: size }, () => Array(size).fill(null)),
    selected: null,
    score: 0,
    moves: config.moves,
    target: config.target,
    busy: false,
    pointerStart: null,
    suppressClick: false,
    state: "playing",
    pops: [],
    offsets: new Map(),
  };
  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      do game.board[r][c] = randomGem();
      while (createsMatch(r, c));
    }
  }
  messageEl.classList.add("hidden");
  updateHud();
  draw();
}

function createsMatch(r, c) {
  const gem = game.board[r][c];
  return (c >= 2 && sameColor(gem, game.board[r][c - 1]) && sameColor(gem, game.board[r][c - 2])) ||
    (r >= 2 && sameColor(gem, game.board[r - 1][c]) && sameColor(gem, game.board[r - 2][c]));
}

function metrics() {
  const pad = 24;
  const cell = Math.min((w() - pad * 2) / size, (h() - pad * 2) / size);
  return { cell, x: (w() - cell * size) / 2, y: (h() - cell * size) / 2 };
}

function cellAt(x, y) {
  const m = metrics();
  const c = Math.floor((x - m.x) / m.cell);
  const r = Math.floor((y - m.y) / m.cell);
  if (r < 0 || r >= size || c < 0 || c >= size) return null;
  return { r, c };
}

function adjacent(a, b) {
  return Math.abs(a.r - b.r) + Math.abs(a.c - b.c) === 1;
}

function swap(a, b) {
  [game.board[a.r][a.c], game.board[b.r][b.c]] = [game.board[b.r][b.c], game.board[a.r][a.c]];
}

async function handleClick(event) {
  if (game.suppressClick) {
    game.suppressClick = false;
    return;
  }
  if (game.state !== "playing" || game.busy) return;
  const rect = canvas.getBoundingClientRect();
  const cell = cellAt(event.clientX - rect.left, event.clientY - rect.top);
  if (!cell) return;

  if (!game.selected) {
    game.selected = cell;
    draw();
    return;
  }
  if (!adjacent(game.selected, cell)) {
    game.selected = cell;
    draw();
    return;
  }

  await trySwap(game.selected, cell);
}

async function trySwap(a, b) {
  if (game.state !== "playing" || game.busy || !a || !b || !adjacent(a, b)) return;
  game.busy = true;
  game.selected = null;
  await animateSwap(a, b);
  swap(a, b);

  const powerCells = [];
  if (game.board[a.r][a.c]?.power) powerCells.push(a);
  if (game.board[b.r][b.c]?.power) powerCells.push(b);
  let matches = findMatches();

  if (!matches.cells.length && !powerCells.length) {
    await animateSwap(a, b);
    swap(a, b);
    game.busy = false;
    draw();
    return;
  }

  game.moves -= 1;
  await resolveBoard(matches, powerCells, b);
  game.busy = false;

  if (game.score >= game.target) {
    if (game.level < levels.length - 1) endGame(`第 ${game.level + 1} 关完成，点击进入下一关`, true);
    else endGame("全部通关");
  } else if (game.moves <= 0) {
    endGame("步数用完");
  }
  updateHud();
  draw();
}

async function animateSwap(a, b) {
  const steps = 5;
  for (let i = 1; i <= steps; i += 1) {
    const t = i / steps;
    game.offsets.set(`${a.r},${a.c}`, { dr: (b.r - a.r) * t, dc: (b.c - a.c) * t });
    game.offsets.set(`${b.r},${b.c}`, { dr: (a.r - b.r) * t, dc: (a.c - b.c) * t });
    draw();
    await sleep(10);
  }
  game.offsets.clear();
}

function lineRuns() {
  const runs = [];
  for (let r = 0; r < size; r += 1) {
    let start = 0;
    for (let c = 1; c <= size; c += 1) {
      if (c < size && sameColor(game.board[r][c], game.board[r][c - 1])) continue;
      const len = c - start;
      if (len >= 3) runs.push({ dir: "h", cells: Array.from({ length: len }, (_, i) => ({ r, c: start + i })) });
      start = c;
    }
  }
  for (let c = 0; c < size; c += 1) {
    let start = 0;
    for (let r = 1; r <= size; r += 1) {
      if (r < size && sameColor(game.board[r][c], game.board[r - 1][c])) continue;
      const len = r - start;
      if (len >= 3) runs.push({ dir: "v", cells: Array.from({ length: len }, (_, i) => ({ r: start + i, c })) });
      start = r;
    }
  }
  return runs;
}

function findMatches() {
  const runs = lineRuns();
  const keys = new Set();
  runs.forEach((run) => run.cells.forEach((cell) => keys.add(key(cell))));
  return { runs, cells: [...keys].map(fromKey) };
}

function choosePower(matches, preferred) {
  const runs = matches.runs;
  if (!runs.length) return null;
  const byCell = new Map();
  for (const run of runs) {
    for (const cell of run.cells) {
      const k = key(cell);
      if (!byCell.has(k)) byCell.set(k, []);
      byCell.get(k).push(run);
    }
  }
  const cross = [...byCell.entries()].find(([, list]) => list.some((r) => r.dir === "h") && list.some((r) => r.dir === "v"));
  if (cross) return { cell: fromKey(cross[0]), power: "bomb" };

  const five = runs.find((run) => run.cells.length >= 5);
  if (five) return { cell: pickPowerCell(five.cells, preferred), power: "rainbow" };

  const four = runs.find((run) => run.cells.length >= 4);
  if (four) return { cell: pickPowerCell(four.cells, preferred), power: four.dir === "h" ? "row" : "col" };

  return null;
}

function pickPowerCell(cells, preferred) {
  return cells.find((cell) => preferred && cell.r === preferred.r && cell.c === preferred.c) || cells[Math.floor(cells.length / 2)];
}

async function resolveBoard(matches, powerCells = [], preferred = null) {
  let chain = 0;
  let pendingPowers = powerCells;
  while (matches.cells.length || pendingPowers.length) {
    chain += 1;
    const remove = new Set(matches.cells.map(key));
    const created = pendingPowers.flatMap((cell) => expandPower(cell));
    created.forEach((cell) => remove.add(key(cell)));

    const power = choosePower(matches, preferred);
    if (power) remove.delete(key(power.cell));

    const cells = [...remove].map(fromKey).filter((cell) => inBounds(cell));
    game.score += cells.length * 70 * chain;
    game.pops = cells;
    draw();
    await sleep(90);

    for (const cell of cells) game.board[cell.r][cell.c] = null;
    if (power && game.board[power.cell.r]?.[power.cell.c]) {
      game.board[power.cell.r][power.cell.c].power = power.power;
    }
    await collapseAnimated();
    game.pops = [];
    matches = findMatches();
    pendingPowers = [];
  }
  updateHud();
}

function expandPower(cell) {
  const gem = game.board[cell.r]?.[cell.c];
  if (!gem?.power) return [];
  if (gem.power === "row") return Array.from({ length: size }, (_, c) => ({ r: cell.r, c }));
  if (gem.power === "col") return Array.from({ length: size }, (_, r) => ({ r, c: cell.c }));
  if (gem.power === "bomb") {
    const cells = [];
    for (let r = cell.r - 1; r <= cell.r + 1; r += 1) {
      for (let c = cell.c - 1; c <= cell.c + 1; c += 1) cells.push({ r, c });
    }
    return cells;
  }
  if (gem.power === "rainbow") {
    const color = game.board[cell.r][cell.c].color;
    const cells = [];
    for (let r = 0; r < size; r += 1) {
      for (let c = 0; c < size; c += 1) if (game.board[r][c]?.color === color) cells.push({ r, c });
    }
    return cells;
  }
  return [];
}

async function collapseAnimated() {
  const drops = [];
  for (let c = 0; c < size; c += 1) {
    const stack = [];
    for (let r = size - 1; r >= 0; r -= 1) if (game.board[r][c]) stack.push({ gem: game.board[r][c], from: r });
    for (let r = size - 1; r >= 0; r -= 1) {
      const item = stack[size - 1 - r];
      if (item) {
        game.board[r][c] = item.gem;
        if (item.from !== r) drops.push({ r, c, from: item.from });
      } else {
        game.board[r][c] = randomGem();
        drops.push({ r, c, from: -1 - Math.floor(Math.random() * 4) });
      }
    }
  }
  const steps = 7;
  for (let i = 0; i <= steps; i += 1) {
    const t = 1 - i / steps;
    game.offsets.clear();
    for (const drop of drops) game.offsets.set(`${drop.r},${drop.c}`, { dr: (drop.from - drop.r) * t, dc: 0 });
    draw();
    await sleep(12);
  }
  game.offsets.clear();
}

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
function key(cell) { return `${cell.r},${cell.c}`; }
function fromKey(value) { const [r, c] = value.split(",").map(Number); return { r, c }; }
function inBounds(cell) { return cell.r >= 0 && cell.r < size && cell.c >= 0 && cell.c < size; }

function endGame(text, next = false) {
  game.state = "ended";
  messageEl.textContent = next ? `${text}` : text;
  messageEl.title = next ? "点击进入下一关" : "";
  messageEl.classList.remove("hidden");
  messageEl.onclick = next ? () => newGame(game.level + 1) : null;
}

function updateHud() {
  levelEl.textContent = game.level + 1;
  scoreEl.textContent = game.score;
  movesEl.textContent = game.moves;
  targetEl.textContent = game.target;
}

function draw() {
  ctx.clearRect(0, 0, w(), h());
  ctx.fillStyle = "#1c2230";
  ctx.fillRect(0, 0, w(), h());
  const m = metrics();
  const popSet = new Set(game.pops.map(key));
  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      const offset = game.offsets.get(`${r},${c}`) || { dr: 0, dc: 0 };
      const x = m.x + (c + offset.dc) * m.cell;
      const y = m.y + (r + offset.dr) * m.cell;
      const selected = game.selected && game.selected.r === r && game.selected.c === c;
      ctx.fillStyle = selected ? "rgba(240,200,106,.35)" : "rgba(255,255,255,.08)";
      roundRect(x + 5, y + 5, m.cell - 10, m.cell - 10, 8);
      ctx.fill();
      const gem = game.board[r][c];
      if (!gem) continue;
      ctx.globalAlpha = popSet.has(`${r},${c}`) ? 0.35 : 1;
      drawGem(x + m.cell / 2, y + m.cell / 2, m.cell * 0.34, gem);
      ctx.globalAlpha = 1;
    }
  }
}

function drawGem(x, y, radius, gem) {
  ctx.fillStyle = colors[gem.color];
  ctx.beginPath();
  ctx.moveTo(x, y - radius);
  ctx.lineTo(x + radius, y);
  ctx.lineTo(x, y + radius);
  ctx.lineTo(x - radius, y);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,.35)";
  ctx.beginPath();
  ctx.arc(x - radius * 0.25, y - radius * 0.28, radius * 0.22, 0, Math.PI * 2);
  ctx.fill();

  if (!gem.power) return;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 4;
  ctx.beginPath();
  if (gem.power === "row") {
    ctx.moveTo(x - radius * 0.75, y);
    ctx.lineTo(x + radius * 0.75, y);
  } else if (gem.power === "col") {
    ctx.moveTo(x, y - radius * 0.75);
    ctx.lineTo(x, y + radius * 0.75);
  } else if (gem.power === "bomb") {
    ctx.arc(x, y, radius * 0.48, 0, Math.PI * 2);
  } else {
    ctx.moveTo(x - radius * 0.55, y - radius * 0.55);
    ctx.lineTo(x + radius * 0.55, y + radius * 0.55);
    ctx.moveTo(x + radius * 0.55, y - radius * 0.55);
    ctx.lineTo(x - radius * 0.55, y + radius * 0.55);
  }
  ctx.stroke();
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

window.addEventListener("resize", () => {
  resizeCanvas();
  draw();
});
canvas.addEventListener("click", handleClick);
canvas.addEventListener("pointerdown", (event) => {
  if (game.state !== "playing" || game.busy) return;
  const rect = canvas.getBoundingClientRect();
  const cell = cellAt(event.clientX - rect.left, event.clientY - rect.top);
  if (!cell) return;
  game.pointerStart = { cell, x: event.clientX, y: event.clientY };
  game.selected = cell;
  draw();
});
canvas.addEventListener("pointerup", async (event) => {
  if (!game.pointerStart || game.busy) return;
  const start = game.pointerStart;
  game.pointerStart = null;
  const dx = event.clientX - start.x;
  const dy = event.clientY - start.y;
  const m = metrics();
  if (Math.hypot(dx, dy) < m.cell * 0.28) return;

  const target = { ...start.cell };
  if (Math.abs(dx) > Math.abs(dy)) target.c += dx > 0 ? 1 : -1;
  else target.r += dy > 0 ? 1 : -1;

  game.suppressClick = true;
  if (!inBounds(target)) {
    game.selected = null;
    draw();
    return;
  }
  await trySwap(start.cell, target);
});
restartBtn.addEventListener("click", () => newGame(0));

resizeCanvas();
newGame(0);
