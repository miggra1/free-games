/* 数字华容道：不依赖后端，可直接用现代浏览器打开 index.html 运行。 */

const boardElement = document.querySelector('#board');
const timeElement = document.querySelector('#time');
const movesElement = document.querySelector('#moves');
const difficultyValue = document.querySelector('#difficulty-value');
const statusElement = document.querySelector('#status');
const startButton = document.querySelector('#start-button');
const restartButton = document.querySelector('#restart-button');
const pauseButton = document.querySelector('#pause-button');
const difficultyButtons = document.querySelectorAll('.difficulty-button');
const winDialog = document.querySelector('#win-dialog');
const winSummary = document.querySelector('#win-summary');
const playAgainButton = document.querySelector('#play-again-button');
let tileElements = new Map();
let emptyCellElement = null;

const state = {
  size: 3,
  board: [],
  moves: 0,
  seconds: 0,
  timerId: null,
  started: false,
  paused: false,
  won: false,
};

/** Fisher-Yates 洗牌：每次随机选择尚未处理区域中的一个元素来交换。 */
function shuffle(values) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[randomIndex]] = [result[randomIndex], result[index]];
  }
  return result;
}

/**
 * 计算逆序数：忽略 0（空白格），统计前面的数字比后面的数字大的次数。
 * 可解性规则：奇数宽度棋盘逆序数必须为偶数；偶数宽度棋盘则结合空白格
 * 从底部数起的行号判断，(逆序数 + 该行号) 为奇数时可解。
 */
function isSolvable(board, size) {
  const numbers = board.filter((value) => value !== 0);
  let inversions = 0;
  for (let i = 0; i < numbers.length; i += 1) {
    for (let j = i + 1; j < numbers.length; j += 1) {
      if (numbers[i] > numbers[j]) inversions += 1;
    }
  }

  if (size % 2 !== 0) return inversions % 2 === 0;

  const blankIndex = board.indexOf(0);
  const blankRowFromBottom = size - Math.floor(blankIndex / size);
  return (inversions + blankRowFromBottom) % 2 === 1;
}

/**
 * 反复 Fisher-Yates 洗牌，直到得到可解且不是完成状态的棋盘。
 * 因此不会把一个可能无解的随机数组直接交给玩家。
 */
function createSolvableBoard(size) {
  const solved = Array.from({ length: size * size }, (_, index) => (index + 1) % (size * size));
  let candidate;
  do {
    candidate = shuffle(solved);
  } while (!isSolvable(candidate, size) || isSolved(candidate));
  return candidate;
}

function isSolved(board = state.board) {
  return board.every((value, index) => value === (index + 1) % board.length);
}

/** 点击空白格同一行或同一列的任意数字，可将中间整段数字连带滑向空白格。 */
function isAlignedWithBlank(tileIndex, blankIndex) {
  return Math.floor(tileIndex / state.size) === Math.floor(blankIndex / state.size)
    || tileIndex % state.size === blankIndex % state.size;
}

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function updateInfo() {
  timeElement.textContent = formatTime(state.seconds);
  movesElement.textContent = state.moves;
  difficultyValue.textContent = `${state.size} × ${state.size}`;
}

/** 始终只保留一个计时器，防止重复点击按钮后计时速度叠加。 */
function startTimer() {
  clearTimer();
  state.timerId = window.setInterval(() => {
    state.seconds += 1;
    updateInfo();
  }, 1000);
}

function clearTimer() {
  if (state.timerId !== null) {
    window.clearInterval(state.timerId);
    state.timerId = null;
  }
}

function updateControls() {
  const canPause = state.started && !state.won;
  pauseButton.disabled = !canPause;
  pauseButton.textContent = state.paused ? '继续游戏' : '暂停游戏';
  boardElement.setAttribute('aria-label', state.paused ? '棋盘已暂停' : '数字棋盘');
  updateTileInteractivity();
}

/**
 * 每局只创建一次方块 DOM。移动时只改 transform 坐标，不重建棋盘，
 * 因而浏览器能持续地把当前数字块滑向新的空位。
 */
function createTileElements() {
  boardElement.replaceChildren();
  tileElements = new Map();

  emptyCellElement = document.createElement('div');
  emptyCellElement.className = 'empty-cell';
  emptyCellElement.setAttribute('aria-label', '空白格');
  boardElement.append(emptyCellElement);

  for (let value = 1; value < state.size * state.size; value += 1) {
    const tile = document.createElement('button');
    tile.className = 'tile';
    tile.type = 'button';
    tile.textContent = value;
    tile.dataset.value = value;
    tile.setAttribute('aria-label', `数字 ${value}`);
    tile.addEventListener('click', () => moveTile(value));
    tileElements.set(value, tile);
    boardElement.append(tile);
  }
  updateTileInteractivity();
}

function updateTileInteractivity() {
  const blankIndex = state.board.indexOf(0);
  tileElements.forEach((tile, value) => {
    const tileIndex = state.board.indexOf(value);
    const movable = state.started && !state.paused && !state.won && isAlignedWithBlank(tileIndex, blankIndex);
    tile.disabled = !movable;
    tile.classList.toggle('is-movable', movable);
  });
}

function getBoardMetrics() {
  const gap = Number.parseFloat(window.getComputedStyle(boardElement).gap) || 0;
  const cellSize = (boardElement.clientWidth - gap * (state.size - 1)) / state.size;
  return { gap, cellSize };
}

/** 将棋盘索引换算成像素坐标；CSS transition 只负责平滑地过渡 transform。 */
function positionTiles(withoutAnimation = false) {
  if (!emptyCellElement) return;
  const { gap, cellSize } = getBoardMetrics();
  boardElement.classList.toggle('is-positioning', withoutAnimation);

  state.board.forEach((value, index) => {
    const column = index % state.size;
    const row = Math.floor(index / state.size);
    const x = column * (cellSize + gap);
    const y = row * (cellSize + gap);
    const element = value === 0 ? emptyCellElement : tileElements.get(value);
    element.style.width = `${cellSize}px`;
    element.style.height = `${cellSize}px`;
    element.style.transform = `translate(${x}px, ${y}px)`;
  });

  if (withoutAnimation) {
    // 强制浏览器应用无动画定位，再恢复后续玩家移动的过渡效果。
    void boardElement.offsetWidth;
    boardElement.classList.remove('is-positioning');
  }
}

function moveTile(value) {
  if (!state.started || state.paused || state.won) return;
  const tileIndex = state.board.indexOf(value);
  const blankIndex = state.board.indexOf(0);
  if (!isAlignedWithBlank(tileIndex, blankIndex)) return;

  /*
   * 同行/同列时，把点击块和空白格之间的数字逐格向空位平移。
   * 一次点击可以带动多块，空白格最终出现在被点击数字的原位置。
   */
  const step = tileIndex % state.size === blankIndex % state.size ? state.size : 1;
  if (tileIndex > blankIndex) {
    for (let index = blankIndex; index < tileIndex; index += step) {
      state.board[index] = state.board[index + step];
    }
  } else {
    for (let index = blankIndex; index > tileIndex; index -= step) {
      state.board[index] = state.board[index - step];
    }
  }
  state.board[tileIndex] = 0;
  state.moves += 1;
  updateInfo();
  positionTiles();
  updateTileInteractivity();

  if (isSolved()) window.setTimeout(finishGame, 190);
}

/** 胜利时停止计时，并锁定棋盘，直至玩家重新开始。 */
function finishGame() {
  if (state.won) return;
  state.won = true;
  clearTimer();
  updateControls();
  positionTiles();
  statusElement.textContent = '本局已完成，点击“再来一局”继续挑战。';
  winSummary.textContent = `本局用时 ${formatTime(state.seconds)}，共移动 ${state.moves} 步。`;
  winDialog.hidden = false;
  playAgainButton.focus();
}

function startNewGame() {
  clearTimer();
  state.board = createSolvableBoard(state.size);
  state.moves = 0;
  state.seconds = 0;
  state.started = true;
  state.paused = false;
  state.won = false;
  winDialog.hidden = true;
  statusElement.textContent = '游戏进行中，点击空白格同一行或同一列的数字。';
  updateInfo();
  updateControls();
  createTileElements();
  positionTiles(true);
  startTimer();
}

function togglePause() {
  if (!state.started || state.won) return;
  state.paused = !state.paused;
  if (state.paused) {
    clearTimer();
    statusElement.textContent = '游戏已暂停。';
  } else {
    startTimer();
    statusElement.textContent = '游戏继续，祝你顺利还原！';
  }
  updateControls();
  positionTiles();
}

function changeDifficulty(event) {
  state.size = Number(event.currentTarget.dataset.size);
  difficultyButtons.forEach((button) => {
    const selected = button === event.currentTarget;
    button.classList.toggle('is-active', selected);
    button.setAttribute('aria-pressed', selected);
  });
  boardElement.dataset.size = state.size;
  startNewGame(); // 切换难度后自动生成新的一局。
}

startButton.addEventListener('click', startNewGame);
restartButton.addEventListener('click', startNewGame);
pauseButton.addEventListener('click', togglePause);
playAgainButton.addEventListener('click', startNewGame);
difficultyButtons.forEach((button) => button.addEventListener('click', changeDifficulty));

/* 初始棋盘仅用于展示；尚未开始，因此不能点击，也不会启动计时。 */
state.board = [1, 2, 3, 4, 5, 6, 7, 0, 8];
updateInfo();
updateControls();
createTileElements();
positionTiles(true);

// 屏幕旋转或窗口缩放时重新计算像素坐标，但不播放无意义的移动动画。
new ResizeObserver(() => positionTiles(true)).observe(boardElement);
