const boardEl = document.querySelector("#gameBoard");
const leftEl = document.querySelector("#leftCount");
const timerEl = document.querySelector("#timer");
const comboEl = document.querySelector("#combo");
const bestRecordEl = document.querySelector("#bestRecord");
const restartBtn = document.querySelector("#restart");
const shuffleBtn = document.querySelector("#shuffle");
const resultModalEl = document.querySelector("#resultModal");
const resultTitleEl = document.querySelector("#resultTitle");
const resultTimeEl = document.querySelector("#resultTime");
const resultLeftEl = document.querySelector("#resultLeft");
const resultComboEl = document.querySelector("#resultCombo");
const resultBestEl = document.querySelector("#resultBest");
const resultRestartBtn = document.querySelector("#resultRestart");
const cheatPanel = document.querySelector("#cheatPanel");
const cheatCloseBtn = document.querySelector("#cheatClose");
const cheatTimeEl = document.querySelector("#cheatTime");
const cheatComboEl = document.querySelector("#cheatCombo");
const cheatBrightnessEl = document.querySelector("#cheatBrightness");
const cheatHintsEl = document.querySelector("#cheatHints");
const cheatApplyBtn = document.querySelector("#cheatApply");
const cheatAddTimeBtn = document.querySelector("#cheatAddTime");
const cheatSolveBtn = document.querySelector("#cheatSolve");
const cheatWinBtn = document.querySelector("#cheatWin");

const rows = 8;
const cols = 10;
const icons = [
  "🍎", "🍋", "🍇", "🍓", "🍒",
  "🥝", "🍑", "🍍", "🍉", "🍊",
  "🥥", "🍈", "🥭", "🍐", "🫐",
  "🍌", "🍏", "🥑", "🍆", "🥕",
];
const WALL = "WALL";
const bestRecordKey = "free-link-link-best-record";

const text = {
  playing: "\u8fdb\u884c\u4e2d",
  win: "\u901a\u5173\u6210\u529f",
  timeUp: "\u65f6\u95f4\u5230",
  ended: "\u5df2\u7ed3\u675f",
  remaining: "\u5269\u4f59",
  tiles: "\u724c",
  bestCombo: "\u6700\u9ad8\u8fde\u51fb",
  bestRecord: "\u6700\u9ad8\u8bb0\u5f55",
  newBest: "\u65b0\u7eaa\u5f55",
  usedTime: "\u7528\u65f6",
};

let game;
let timerId = 0;
let cheatTyped = "";
let cheatTypedAt = 0;
let tileBrightness = 76;
let hintPair = null;
let remoteBestRecord = null;

function newGame() {
  game = {
    round: 1,
    score: 0,
    selected: null,
    path: null,
    left: 0,
    startTime: 120,
    time: 120,
    combo: 0,
    bestCombo: 0,
    result: text.playing,
    recorded: false,
    state: "playing",
    lastMatchAt: 0,
    walls: 0,
  };
  hintPair = null;
  resultModalEl.classList.add("hidden");
  startRound(1);
  renderBestRecord();
  loadRemoteBestRecord();
}

function roundConfig(round) {
  return {
    iconCount: Math.min(icons.length, 6 + round),
    wallCount: round > 2 ? Math.min(14, Math.floor((round - 2) * 1.5) * 2) : 0,
    timeBonus: 30,
    pairScore: 100 * round,
  };
}

function startRound(round) {
  if (!game) return;
  game.round = round;
  game.selected = null;
  game.path = null;
  game.combo = 0;
  game.lastMatchAt = 0;
  const cfg = roundConfig(round);
  game.walls = cfg.wallCount;

  const board = Array.from({ length: rows + 2 }, () => Array(cols + 2).fill(null));
  const cells = [];
  for (let r = 1; r <= rows; r += 1) {
    for (let c = 1; c <= cols; c += 1) cells.push({ r, c });
  }
  shuffleArray(cells);

  // 放置墙壁
  for (let i = 0; i < cfg.wallCount; i += 1) {
    const { r, c } = cells[i];
    board[r][c] = WALL;
  }

  // 填充剩余格子为成对图标
  const remain = cells.slice(cfg.wallCount);
  const pairs = [];
  for (let i = 0; i < remain.length / 2; i += 1) {
    pairs.push(icons[i % cfg.iconCount]);
  }
  const deck = [];
  for (const value of pairs) deck.push(value, value);
  shuffleArray(deck);
  for (let i = 0; i < remain.length; i += 1) {
    board[remain[i].r][remain[i].c] = deck[i];
  }

  game.board = board;
  game.left = remain.length;
  game.time = Math.min(300, game.time + cfg.timeBonus);
  game.startTime = Math.max(game.startTime, game.time);
  ensureSolvable();
  renderBoard();
  updateHud();
  syncCheatInputs();
}

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

function renderBoard() {
  updateHint();
  boardEl.replaceChildren();
  boardEl.style.display = "grid";
  boardEl.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
  boardEl.style.gridTemplateRows = `repeat(${rows}, minmax(0, 1fr))`;
  boardEl.style.setProperty("--tile-brightness", `${tileBrightness}%`);

  for (let r = 1; r <= rows; r += 1) {
    for (let c = 1; c <= cols; c += 1) {
      const tile = document.createElement("button");
      tile.type = "button";
      tile.className = "tile";
      tile.dataset.r = String(r);
      tile.dataset.c = String(c);

      const value = game.board[r][c];
      if (value === WALL) {
        tile.classList.add("wall");
        tile.textContent = "🧱";
        tile.disabled = true;
      } else if (!value) {
        tile.classList.add("empty");
        tile.disabled = true;
      } else {
        tile.textContent = value;
      }

      if (game.selected?.r === r && game.selected?.c === c) tile.classList.add("selected");
      if (hintPair?.some((cell) => cell.r === r && cell.c === c)) tile.classList.add("hinted");
      boardEl.append(tile);
    }
  }
}

function handleTileClick(event) {
  const tile = event.target.closest(".tile");
  if (!tile || tile.disabled || !game || game.state !== "playing") return;
  event.preventDefault();
  const cell = { r: Number(tile.dataset.r), c: Number(tile.dataset.c) };
  const value = game.board[cell.r]?.[cell.c];
  if (!value || value === WALL) return;

  if (!game.selected) {
    game.selected = cell;
    renderBoard();
    return;
  }

  if (game.selected.r === cell.r && game.selected.c === cell.c) {
    game.selected = null;
    renderBoard();
    return;
  }

  const selected = game.selected;
  const selectedValue = game.board[selected.r]?.[selected.c];
  if (selectedValue !== value) {
    game.combo = 0;
    game.selected = cell;
    updateHud();
    renderBoard();
    return;
  }

  if (!removePair(selected, cell)) {
    game.combo = 0;
    game.selected = cell;
  }
  updateHud();
  renderBoard();
}

function isEmpty(r, c, allowA, allowB) {
  if ((allowA && allowA.r === r && allowA.c === c) || (allowB && allowB.r === r && allowB.c === c)) return true;
  return game.board[r]?.[c] == null;
}

function clearLine(a, b, allowA, allowB) {
  if (a.r === b.r) {
    const min = Math.min(a.c, b.c);
    const max = Math.max(a.c, b.c);
    for (let c = min + 1; c < max; c += 1) {
      if (!isEmpty(a.r, c, allowA, allowB)) return false;
    }
    return true;
  }
  if (a.c === b.c) {
    const min = Math.min(a.r, b.r);
    const max = Math.max(a.r, b.r);
    for (let r = min + 1; r < max; r += 1) {
      if (!isEmpty(r, a.c, allowA, allowB)) return false;
    }
    return true;
  }
  return false;
}

function findPath(a, b) {
  if (!a || !b) return null;
  if (a.r === b.r && a.c === b.c) return null;
  if (game.board[a.r]?.[a.c] !== game.board[b.r]?.[b.c]) return null;
  if (clearLine(a, b, a, b)) return [a, b];

  const p1 = { r: a.r, c: b.c };
  if (isEmpty(p1.r, p1.c, a, b) && clearLine(a, p1, a, b) && clearLine(p1, b, a, b)) return [a, p1, b];

  const p2 = { r: b.r, c: a.c };
  if (isEmpty(p2.r, p2.c, a, b) && clearLine(a, p2, a, b) && clearLine(p2, b, a, b)) return [a, p2, b];

  for (let r = 0; r <= rows + 1; r += 1) {
    const pA = { r, c: a.c };
    const pB = { r, c: b.c };
    if (isEmpty(pA.r, pA.c, a, b) && isEmpty(pB.r, pB.c, a, b) && clearLine(a, pA, a, b) && clearLine(pA, pB, a, b) && clearLine(pB, b, a, b)) return [a, pA, pB, b];
  }

  for (let c = 0; c <= cols + 1; c += 1) {
    const pA = { r: a.r, c };
    const pB = { r: b.r, c };
    if (isEmpty(pA.r, pA.c, a, b) && isEmpty(pB.r, pB.c, a, b) && clearLine(a, pA, a, b) && clearLine(pA, pB, a, b) && clearLine(pB, b, a, b)) return [a, pA, pB, b];
  }
  return null;
}

function removePair(a, b) {
  const path = findPath(a, b);
  if (!path) return false;

  game.board[a.r][a.c] = null;
  game.board[b.r][b.c] = null;
  game.path = path;
  game.left = Math.max(0, game.left - 2);

  const now = Date.now();
  if (now - game.lastMatchAt < 3500) game.combo += 1;
  else game.combo = 1;
  game.lastMatchAt = now;
  game.bestCombo = Math.max(game.bestCombo, game.combo);

  const cfg = roundConfig(game.round);
  const comboMult = 1 + (game.combo - 1) * 0.3;
  game.score += Math.floor(cfg.pairScore * comboMult);
  game.time = Math.min(300, game.time + 1 + Math.floor(game.combo / 3));

  game.selected = null;
  hintPair = null;
  if (game.left <= 0) endRound();
  else ensureSolvable();
  syncCheatInputs();
  return true;
}

function endRound() {
  if (!game || game.state !== "playing") return;
  game.score += Math.floor(game.time * 5);
  const nextRound = game.round + 1;
  startRound(nextRound);
}

function shuffleRemain() {
  if (!game || game.state !== "playing") return;
  shuffleRemainOnce();
  game.selected = null;
  hintPair = null;
  ensureSolvable();
  updateHud();
  renderBoard();
}

function isWall(r, c) { return game.board[r]?.[c] === WALL; }

function findAnyMove() {
  const cells = [];
  for (let r = 1; r <= rows; r += 1) {
    for (let c = 1; c <= cols; c += 1) {
      const v = game.board[r][c];
      if (v && v !== WALL) cells.push({ r, c, value: v });
    }
  }
  for (let i = 0; i < cells.length; i += 1) {
    for (let j = i + 1; j < cells.length; j += 1) {
      if (cells[i].value === cells[j].value && findPath(cells[i], cells[j])) return [cells[i], cells[j]];
    }
  }
  return null;
}

function ensureSolvable() {
  if (!game || game.left <= 0) return;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (findAnyMove()) return;
    shuffleRemainOnce();
  }
}

function shuffleRemainOnce() {
  const remain = [];
  const positions = [];
  for (let r = 1; r <= rows; r += 1) {
    for (let c = 1; c <= cols; c += 1) {
      const v = game.board[r][c];
      if (v && v !== WALL) {
        remain.push(v);
        positions.push({ r, c });
      }
    }
  }
  shuffleArray(remain);
  for (let i = 0; i < positions.length; i += 1) {
    game.board[positions[i].r][positions[i].c] = remain[i];
  }
}

function endGame(resultText) {
  game.state = "ended";
  game.result = resultText;
  updateBestRecord();
  showResultModal();
}

function tick() {
  if (!game || game.state !== "playing") return;
  game.time = Math.max(0, game.time - 1);
  if (game.time <= 0) {
    game.time = 0;
    endGame(text.timeUp);
  }
  updateHud();
  syncCheatInputs();
}

function updateHud() {
  leftEl.textContent = game.left;
  timerEl.textContent = Math.ceil(game.time);
  comboEl.textContent = game.combo;
  const roundEl = document.querySelector("#round");
  const scoreEl = document.querySelector("#score");
  if (roundEl) roundEl.textContent = game.round;
  if (scoreEl) scoreEl.textContent = game.score;
}

function currentResultRecord() {
  const used = Math.max(0, game.startTime - Math.ceil(game.time));
  return {
    round: game.round,
    score: game.score,
    bestCombo: game.bestCombo,
    used,
    left: game.left,
    savedAt: new Date().toLocaleString(),
  };
}

function readBestRecord() {
  try {
    const record = JSON.parse(localStorage.getItem(bestRecordKey) || "null");
    return record && typeof record === "object" ? record : null;
  } catch {
    return null;
  }
}

function writeBestRecord(record) {
  localStorage.setItem(bestRecordKey, JSON.stringify(record));
}

function isBetterRecord(next, current) {
  if (!current) return true;
  if (next.round !== current.round) return next.round > current.round;
  if (next.score !== current.score) return next.score > current.score;
  return next.bestCombo > current.bestCombo;
}

function formatBestRecord(record) {
  if (!record) return "--";
  if ("round" in record) return `Lv${record.round} / ${record.score}`;
  if ("time_used" in record || "best_combo" in record) {
    const combo = record.best_combo ?? 0;
    if (record.won) return `${record.time_used ?? 0}s / ${combo}`;
    return `${text.tiles}${record.remaining ?? 0} / ${combo}`;
  }
  if (record.won) return `${record.used}s / ${record.bestCombo}`;
  return `${text.tiles}${record.left} / ${record.bestCombo}`;
}

function updateBestRecord() {
  const next = currentResultRecord();
  const current = readBestRecord();
  game.isNewBest = isBetterRecord(next, current);
  if (game.isNewBest) writeBestRecord(next);
  renderBestRecord();
  saveRemoteRecord(next);
}

function renderBestRecord() {
  bestRecordEl.textContent = formatBestRecord(remoteBestRecord || readBestRecord());
}

async function loadRemoteBestRecord() {
  if (!window.FreeGamesScores) return;
  const record = await window.FreeGamesScores.getBestScore("link-link-game");
  if (!record) return;
  remoteBestRecord = record;
  renderBestRecord();
}

async function saveRemoteRecord(record) {
  if (!window.FreeGamesScores) return;
  const saved = await window.FreeGamesScores.saveScore({
    game_key: "link-link-game",
    score: record.score,
    level: record.round || 1,
    won: record.left <= 0,
    time_used: record.used,
    remaining: record.left,
    best_combo: record.bestCombo,
    detail: record,
  });
  if (saved) loadRemoteBestRecord();
}

function showResultModal() {
  const used = Math.max(0, game.startTime - Math.ceil(game.time));
  resultTitleEl.textContent = game.result || text.ended;
  resultTimeEl.textContent = `${text.usedTime} ${used}s`;
  resultLeftEl.textContent = `第 ${game.round} 轮 · 剩余 ${game.left} 牌`;
  resultComboEl.textContent = `分数 ${game.score} · 最高连击 ${game.bestCombo}`;
  resultBestEl.textContent = game.isNewBest ? text.newBest : `${text.bestRecord} ${formatBestRecord(remoteBestRecord || readBestRecord())}`;
  resultModalEl.classList.remove("hidden");
}

function toggleCheatPanel(force) {
  const open = typeof force === "boolean" ? force : cheatPanel.classList.contains("hidden");
  cheatPanel.classList.toggle("hidden", !open);
  if (open) syncCheatInputs();
}

function syncCheatInputs() {
  if (!game) return;
  cheatTimeEl.value = Math.ceil(game.time);
  cheatComboEl.value = game.combo;
  cheatBrightnessEl.value = tileBrightness;
}

function applyCheatSettings() {
  if (!game) return;
  game.time = clamp(Number(cheatTimeEl.value) || 0, 0, 9999);
  game.combo = clamp(Number(cheatComboEl.value) || 0, 0, 999);
  game.bestCombo = Math.max(game.bestCombo, game.combo);
  tileBrightness = clamp(Number(cheatBrightnessEl.value) || 76, 45, 100);
  if (game.state === "ended" && game.left > 0 && game.time > 0) {
    game.state = "playing";
    game.recorded = false;
    resultModalEl.classList.add("hidden");
  }
  updateHud();
  renderBoard();
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function cheatAddTime() {
  if (!game) return;
  game.time = clamp(game.time + 60, 0, 9999);
  if (game.state === "ended" && game.left > 0) {
    game.state = "playing";
    game.recorded = false;
    resultModalEl.classList.add("hidden");
  }
  updateHud();
  syncCheatInputs();
}

function cheatSolvePair() {
  if (!game || game.state !== "playing") return;
  const pair = findAnyMove();
  if (!pair) return;
  removePair(pair[0], pair[1]);
  updateHud();
  renderBoard();
}

function cheatWinNow() {
  if (!game) return;
  for (let r = 1; r <= rows; r += 1) {
    for (let c = 1; c <= cols; c += 1) {
      game.board[r][c] = null;
    }
  }
  game.left = 0;
  game.combo += 1;
  game.bestCombo = Math.max(game.bestCombo, game.combo);
  endGame(text.win);
  updateHud();
  renderBoard();
  syncCheatInputs();
}

function updateHint() {
  if (!game || !cheatHintsEl.checked || game.state !== "playing") {
    hintPair = null;
    return;
  }
  if (!hintPair || !game.board[hintPair[0].r]?.[hintPair[0].c] || !game.board[hintPair[1].r]?.[hintPair[1].c]) {
    hintPair = findAnyMove();
  }
}

function handleCheatShortcut(event) {
  if (event.key === "Escape") {
    toggleCheatPanel(false);
    return;
  }

  const key = String(event.key || "").toLowerCase();
  const code = String(event.code || "");
  const codeKey = /^Key[A-Z]$/.test(code) ? code.slice(3).toLowerCase() : "";
  const typedKey = codeKey || (key.length === 1 ? key : "");
  if (!/^[a-z]$/.test(typedKey)) return;

  const now = performance.now();
  if (now - cheatTypedAt > 1600) cheatTyped = "";
  cheatTypedAt = now;
  cheatTyped = (cheatTyped + typedKey).slice(-4);
  if (cheatTyped === "free") {
    toggleCheatPanel();
    cheatTyped = "";
    event.preventDefault();
  }
}

boardEl.addEventListener("pointerdown", handleTileClick);
document.addEventListener("keydown", handleCheatShortcut, true);
restartBtn.addEventListener("click", newGame);
shuffleBtn.addEventListener("click", shuffleRemain);
resultRestartBtn.addEventListener("click", newGame);
cheatCloseBtn.addEventListener("click", () => toggleCheatPanel(false));
cheatApplyBtn.addEventListener("click", applyCheatSettings);
cheatAddTimeBtn.addEventListener("click", cheatAddTime);
cheatSolveBtn.addEventListener("click", cheatSolvePair);
cheatWinBtn.addEventListener("click", cheatWinNow);
cheatBrightnessEl.addEventListener("input", applyCheatSettings);
cheatHintsEl.addEventListener("change", renderBoard);

newGame();
if (new URLSearchParams(window.location.search).get("cheat") === "1") {
  toggleCheatPanel(true);
}
if (new URLSearchParams(window.location.search).get("result") === "1") {
  game.time = 126;
  game.bestCombo = 6;
  endGame(text.win);
}
timerId = window.setInterval(tick, 1000);
