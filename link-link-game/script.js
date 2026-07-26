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
const modeButtons = [...document.querySelectorAll("[data-mode]")];
const modeLabelEl = document.querySelector("#modeLabel");
const levelGoalEl = document.querySelector("#levelGoal");
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
const maxAdventureLevel = 8;
const icons = [
  "🍎", "🍊", "🍌", "🍇", "🍉",
  "🍓", "🍒", "🍑", "🥝", "🍍",
  "🥥", "🍐", "🥭", "🍋", "🫐",
  "🍈", "🍏", "🥑", "🌽", "🥕",
];
const WALL = "WALL";
const bestRecordPrefix = "free-link-link-best-record";

const modes = {
  speed: {
    label: "极速记录",
    bestLabel: "最快记录",
    remoteKey: "link-link-game-speed",
  },
  adventure: {
    label: "闯关模式",
    bestLabel: "闯关记录",
    remoteKey: "link-link-game-adventure",
  },
};

const text = {
  playing: "进行中",
  win: "通关成功",
  timeUp: "时间到",
  ended: "已结束",
  tiles: "牌",
  bestCombo: "最高连击",
  bestRecord: "最高记录",
  newBest: "新纪录",
  usedTime: "用时",
};

let game;
let timerId = 0;
let currentMode = "speed";
let cheatTyped = "";
let cheatTypedAt = 0;
let tileBrightness = 76;
let hintPair = null;
let remoteBestRecord = null;

function newGame(mode = currentMode) {
  currentMode = mode;
  remoteBestRecord = null;
  game = {
    mode: currentMode,
    level: 1,
    score: 0,
    selected: null,
    path: null,
    left: 0,
    time: currentMode === "speed" ? 0 : levelConfig(1).timeLimit,
    elapsed: 0,
    combo: 0,
    bestCombo: 0,
    result: text.playing,
    state: "playing",
    lastMatchAt: 0,
    walls: 0,
    isNewBest: false,
  };

  hintPair = null;
  resultModalEl.classList.add("hidden");
  updateModeUi();
  startLevel(1);
  renderBestRecord();
  loadRemoteBestRecord();
}

function levelConfig(level) {
  if (currentMode === "speed") {
    return {
      iconCount: 10,
      wallCount: 0,
      timeLimit: 0,
      pairScore: 100,
    };
  }

  return {
    iconCount: Math.min(icons.length, 6 + level),
    wallCount: level > 1 ? Math.min(18, Math.floor((level - 1) * 2)) : 0,
    timeLimit: Math.max(75, 150 - (level - 1) * 8),
    pairScore: 100 + level * 30,
  };
}

function startLevel(level) {
  if (!game) return;
  const cfg = levelConfig(level);
  game.level = level;
  game.selected = null;
  game.path = null;
  game.combo = 0;
  game.lastMatchAt = 0;
  if (game.mode === "adventure") game.time = cfg.timeLimit;

  buildLevel(level);
  ensureSolvable();
  renderBoard();
  updateHud();
  syncCheatInputs();
}

function buildLevel(level) {
  const cfg = levelConfig(level);
  game.walls = cfg.wallCount;

  const board = Array.from({ length: rows + 2 }, () => Array(cols + 2).fill(null));
  const cells = [];
  for (let r = 1; r <= rows; r += 1) {
    for (let c = 1; c <= cols; c += 1) cells.push({ r, c });
  }
  shuffleArray(cells);

  for (let i = 0; i < cfg.wallCount; i += 1) {
    const { r, c } = cells[i];
    board[r][c] = WALL;
  }

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
}

function regenerateBoard() {
  if (!game) return;
  const savedScore = game.score;
  const savedTime = game.time;
  const savedElapsed = game.elapsed;
  buildLevel(game.level);
  game.score = savedScore;
  game.time = savedTime;
  game.elapsed = savedElapsed;
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

  const cfg = levelConfig(game.level);
  const comboMult = 1 + (game.combo - 1) * 0.3;
  game.score += Math.floor(cfg.pairScore * comboMult);
  if (game.mode === "adventure") game.time = Math.min(cfg.timeLimit, game.time + 1 + Math.floor(game.combo / 4));

  game.selected = null;
  hintPair = null;

  if (game.left <= 0) endLevel();
  else ensureSolvable();

  syncCheatInputs();
  return true;
}

function endLevel() {
  if (!game || game.state !== "playing") return;

  if (game.mode === "speed") {
    game.score += Math.max(0, 10000 - game.elapsed * 10);
    endGame(text.win);
    return;
  }

  game.score += Math.floor(game.time * 8) + game.level * 500;
  if (game.level >= maxAdventureLevel) {
    endGame(text.win);
    return;
  }

  startLevel(game.level + 1);
}

function shuffleRemain() {
  if (!game || game.state !== "playing") return;
  shuffleRemainOnce();
  if (game.mode === "speed") game.elapsed += 5;
  else game.time = Math.max(0, game.time - 5);
  game.selected = null;
  hintPair = null;
  ensureSolvable();
  updateHud();
  renderBoard();
}

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
  for (let gen = 0; gen < 3; gen += 1) {
    for (let attempt = 0; attempt < 50; attempt += 1) {
      if (findAnyMove()) return;
      shuffleRemainOnce();
    }
    regenerateBoard();
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
  updateHud();
  renderBoard();
  showResultModal();
}

function tick() {
  if (!game || game.state !== "playing") return;

  game.elapsed += 1;
  if (game.mode === "adventure") {
    game.time = Math.max(0, game.time - 1);
    if (game.time <= 0) {
      game.time = 0;
      endGame(text.timeUp);
    }
  } else {
    game.time = game.elapsed;
  }

  updateHud();
  syncCheatInputs();
}

function updateHud() {
  leftEl.textContent = game.left;
  timerEl.textContent = game.mode === "speed" ? `${Math.ceil(game.elapsed)}s` : Math.ceil(game.time);
  comboEl.textContent = game.combo;

  const roundEl = document.querySelector("#round");
  const scoreEl = document.querySelector("#score");
  if (roundEl) roundEl.textContent = game.mode === "speed" ? "1" : `${game.level}/${maxAdventureLevel}`;
  if (scoreEl) scoreEl.textContent = game.score;
  if (modeLabelEl) modeLabelEl.textContent = modes[game.mode].label;
  if (levelGoalEl) levelGoalEl.textContent = game.mode === "speed" ? "目标：刷新最短通关时间" : `目标：通过第 ${maxAdventureLevel} 关`;
}

function updateModeUi() {
  modeButtons.forEach((button) => {
    const active = button.dataset.mode === currentMode;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  document.body.dataset.gameMode = currentMode;
}

function currentResultRecord() {
  return {
    mode: game.mode,
    level: game.level,
    score: game.score,
    bestCombo: game.bestCombo,
    used: game.elapsed,
    left: game.left,
    won: game.left <= 0 && game.result === text.win,
    savedAt: new Date().toLocaleString(),
  };
}

function recordKey(mode = currentMode) {
  return `${bestRecordPrefix}-${mode}`;
}

function readBestRecord(mode = currentMode) {
  try {
    const record = JSON.parse(localStorage.getItem(recordKey(mode)) || "null");
    return record && typeof record === "object" ? record : null;
  } catch {
    return null;
  }
}

function writeBestRecord(record) {
  localStorage.setItem(recordKey(record.mode), JSON.stringify(record));
}

function isBetterRecord(next, current) {
  if (!current) return true;

  if (next.mode === "speed") {
    if (next.won && !current.won) return true;
    if (!next.won && current.won) return false;
    if (next.won && current.won && next.used !== current.used) return next.used < current.used;
    return next.bestCombo > (current.bestCombo ?? 0);
  }

  if (next.level !== current.level) return next.level > current.level;
  if (next.won !== current.won) return next.won;
  if (next.score !== current.score) return next.score > current.score;
  return next.bestCombo > (current.bestCombo ?? 0);
}

function formatBestRecord(record, mode = currentMode) {
  if (!record) return "--";
  const normalized = normalizeRecord(record, mode);

  if (mode === "speed") {
    if (normalized.won) return `${normalized.used}s / ${normalized.bestCombo}`;
    return `${text.tiles}${normalized.left} / ${normalized.bestCombo}`;
  }

  return `Lv${normalized.level} / ${normalized.score}`;
}

function normalizeRecord(record, mode = currentMode) {
  return {
    mode,
    level: record.level ?? record.round ?? 1,
    score: record.score ?? 0,
    bestCombo: record.bestCombo ?? record.best_combo ?? 0,
    used: record.used ?? record.time_used ?? 0,
    left: record.left ?? record.remaining ?? 0,
    won: Boolean(record.won),
  };
}

function updateBestRecord() {
  const next = currentResultRecord();
  const current = readBestRecord(game.mode);
  game.isNewBest = isBetterRecord(next, current);
  if (game.isNewBest) writeBestRecord(next);
  renderBestRecord();
  saveRemoteRecord(next);
}

function renderBestRecord() {
  const source = remoteBestRecord || readBestRecord(currentMode);
  bestRecordEl.textContent = formatBestRecord(source, currentMode);
}

async function loadRemoteBestRecord() {
  if (!window.FreeGamesScores) return;
  const requestedMode = currentMode;
  const record = await window.FreeGamesScores.getBestScore(modes[requestedMode].remoteKey);
  if (!record || requestedMode !== currentMode || requestedMode !== game.mode) return;
  remoteBestRecord = normalizeRecord(record, requestedMode);
  renderBestRecord();
}

async function saveRemoteRecord(record) {
  if (!window.FreeGamesScores) return;
  const saved = await window.FreeGamesScores.saveScore({
    game_key: modes[record.mode].remoteKey,
    score: record.mode === "speed" && record.won ? Math.max(1, 100000 - record.used) : record.score,
    level: record.level || 1,
    won: record.won,
    time_used: record.used,
    remaining: record.left,
    best_combo: record.bestCombo,
    detail: record,
  });
  if (saved) loadRemoteBestRecord();
}

function showResultModal() {
  const record = currentResultRecord();
  resultTitleEl.textContent = game.result || text.ended;
  resultTimeEl.textContent = `${modes[game.mode].label} · ${text.usedTime} ${record.used}s`;
  resultLeftEl.textContent = game.mode === "speed"
    ? `剩余 ${game.left} 牌`
    : `第 ${game.level}/${maxAdventureLevel} 关 · 剩余 ${game.left} 牌`;
  resultComboEl.textContent = `分数 ${game.score} · 最高连击 ${game.bestCombo}`;
  resultBestEl.textContent = game.isNewBest ? text.newBest : `${modes[game.mode].bestLabel} ${formatBestRecord(remoteBestRecord || readBestRecord(game.mode), game.mode)}`;
  resultModalEl.classList.remove("hidden");
}

function toggleCheatPanel(force) {
  const open = typeof force === "boolean" ? force : cheatPanel.classList.contains("hidden");
  cheatPanel.classList.toggle("hidden", !open);
  if (open) syncCheatInputs();
}

function syncCheatInputs() {
  if (!game) return;
  cheatTimeEl.value = game.mode === "speed" ? Math.ceil(game.elapsed) : Math.ceil(game.time);
  cheatComboEl.value = game.combo;
  cheatBrightnessEl.value = tileBrightness;
}

function applyCheatSettings() {
  if (!game) return;
  const cheatTime = clamp(Number(cheatTimeEl.value) || 0, 0, 9999);
  if (game.mode === "speed") {
    game.elapsed = cheatTime;
    game.time = cheatTime;
  } else {
    game.time = cheatTime;
  }

  game.combo = clamp(Number(cheatComboEl.value) || 0, 0, 999);
  game.bestCombo = Math.max(game.bestCombo, game.combo);
  tileBrightness = clamp(Number(cheatBrightnessEl.value) || 76, 45, 100);

  if (game.state === "ended" && game.left > 0 && (game.mode === "speed" || game.time > 0)) {
    game.state = "playing";
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
  if (game.mode === "speed") {
    game.elapsed = Math.max(0, game.elapsed - 15);
    game.time = game.elapsed;
  } else {
    game.time = clamp(game.time + 60, 0, 9999);
  }

  if (game.state === "ended" && game.left > 0) {
    game.state = "playing";
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
restartBtn.addEventListener("click", () => newGame(currentMode));
shuffleBtn.addEventListener("click", shuffleRemain);
resultRestartBtn.addEventListener("click", () => newGame(currentMode));
modeButtons.forEach((button) => {
  button.addEventListener("click", () => newGame(button.dataset.mode));
});
cheatCloseBtn.addEventListener("click", () => toggleCheatPanel(false));
cheatApplyBtn.addEventListener("click", applyCheatSettings);
cheatAddTimeBtn.addEventListener("click", cheatAddTime);
cheatSolveBtn.addEventListener("click", cheatSolvePair);
cheatWinBtn.addEventListener("click", cheatWinNow);
cheatBrightnessEl.addEventListener("input", applyCheatSettings);
cheatHintsEl.addEventListener("change", renderBoard);

const params = new URLSearchParams(window.location.search);
if (params.get("mode") === "adventure") currentMode = "adventure";
newGame(currentMode);
if (params.get("cheat") === "1") toggleCheatPanel(true);
if (params.get("result") === "1") {
  game.elapsed = 126;
  game.bestCombo = 6;
  endGame(text.win);
}
timerId = window.setInterval(tick, 1000);
