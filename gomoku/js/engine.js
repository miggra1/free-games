/* ============================================================
 * engine.js — 五子棋核心引擎
 * 棋盘状态 / 落子规则 / 五连判定 / 禁手规则 / RIF规则 / SGF
 * ============================================================ */
(function () {
  "use strict";

  const SIZE = 15;
  const EMPTY = 0, BLACK = 1, WHITE = 2;
  const DIRS = [[1, 0], [0, 1], [1, 1], [1, -1]]; // 横竖左右斜

  const BOARD = {
    size: SIZE,
    grid: [],
    moves: [],       // [{x, y, player}]
    current: BLACK,  // 当前行棋方
    result: 0,       // 0=进行中 1=黑胜 2=白胜 3=和棋 4=黑禁手负
    winLine: null,   // 五连坐标 [{x,y},...]
    winType: "",     // "normal" | "overline"
    forbidden: null, // 当前禁手信息 {x, y, type}
    ruleMode: "free", // "free" | "forbidden" | "rif"
    scores: { black: 0, white: 0, draws: 0 }, // 多局比分
    round: 1,        // 当前局数
    firstMove: BLACK, // 当前局先手
  };

  /* ---------------- 初始化 ---------------- */
  BOARD.reset = function () {
    BOARD.grid = [];
    for (let y = 0; y < SIZE; y++) {
      BOARD.grid.push(new Array(SIZE).fill(EMPTY));
    }
    BOARD.moves = [];
    BOARD.current = BOARD.firstMove;
    BOARD.result = 0;
    BOARD.winLine = null;
    BOARD.winType = "";
    BOARD.forbidden = null;
  };

  /* ---------------- 坐标工具 ---------------- */
  function inBoard(x, y) { return x >= 0 && x < SIZE && y >= 0 && y < SIZE; }
  BOARD.inBoard = inBoard;

  /* ---------------- 落子 ---------------- */
  BOARD.place = function (x, y) {
    if (!inBoard(x, y) || BOARD.grid[y][x] !== EMPTY || BOARD.result !== 0) return false;
    // 禁手检查（仅黑棋，且规则模式不为 free）
    if (BOARD.ruleMode !== "free" && BOARD.current === BLACK) {
      const fb = BOARD.checkForbidden(x, y);
      if (fb) {
        BOARD.forbidden = { x, y, type: fb };
        BOARD.result = 4; // 黑禁手负
        return false;
      }
    }
    BOARD.grid[y][x] = BOARD.current;
    BOARD.moves.push({ x, y, player: BOARD.current });
    // 胜负判定
    const win = BOARD.checkWin(x, y);
    if (win.win) {
      BOARD.result = BOARD.current;
      BOARD.winLine = win.line;
      BOARD.winType = win.type;
      // 长连禁手（黑棋）
      if (win.type === "overline" && BOARD.ruleMode !== "free" && BOARD.current === BLACK) {
        BOARD.result = 4;
        BOARD.forbidden = { x, y, type: "overline" };
      }
    } else if (BOARD.moves.length >= SIZE * SIZE) {
      BOARD.result = 3; // 和棋
    }
    BOARD.current = BOARD.current === BLACK ? WHITE : BLACK;
    return true;
  };

  /* ---------------- 悔棋 ---------------- */
  BOARD.undo = function () {
    if (BOARD.moves.length === 0) return false;
    const m = BOARD.moves.pop();
    BOARD.grid[m.y][m.x] = EMPTY;
    BOARD.current = m.player;
    BOARD.result = 0;
    BOARD.winLine = null;
    BOARD.winType = "";
    BOARD.forbidden = null;
    return true;
  };

  /* ---------------- 胜负判定 ---------------- */
  BOARD.checkWin = function (x, y) {
    const p = BOARD.grid[y][x];
    if (p === EMPTY) return { win: false };
    for (const [dx, dy] of DIRS) {
      const line = [{ x, y }];
      // 正向延伸
      for (let i = 1; i < SIZE; i++) {
        const nx = x + dx * i, ny = y + dy * i;
        if (!inBoard(nx, ny) || BOARD.grid[ny][nx] !== p) break;
        line.push({ x: nx, y: ny });
      }
      // 反向延伸
      for (let i = 1; i < SIZE; i++) {
        const nx = x - dx * i, ny = y - dy * i;
        if (!inBoard(nx, ny) || BOARD.grid[ny][nx] !== p) break;
        line.unshift({ x: nx, y: ny });
      }
      if (line.length >= 5) {
        return { win: true, line: line.slice(0, 5), type: line.length > 5 ? "overline" : "normal" };
      }
    }
    return { win: false };
  };

  /* ---------------- 连子分析（用于禁手和 AI 评估） ---------------- */
  // 返回 { count, openEnds, gapOpen } 表示某点在某方向上的连子情况
  BOARD.analyzeDir = function (x, y, dx, dy, p) {
    let count = 1, openEnds = 0;
    let gapOpen = false;
    // 正向
    let blocked = false;
    for (let i = 1; i < SIZE; i++) {
      const nx = x + dx * i, ny = y + dy * i;
      if (!inBoard(nx, ny)) break;
      if (BOARD.grid[ny][nx] === p) count++;
      else if (BOARD.grid[ny][nx] === EMPTY) { openEnds++; break; }
      else { blocked = true; break; }
    }
    // 反向
    for (let i = 1; i < SIZE; i++) {
      const nx = x - dx * i, ny = y - dy * i;
      if (!inBoard(nx, ny)) break;
      if (BOARD.grid[ny][nx] === p) count++;
      else if (BOARD.grid[ny][nx] === EMPTY) { openEnds++; break; }
      else break;
    }
    return { count, openEnds, blocked };
  };

  /* ---------------- 禁手检测（黑棋） ---------------- */
  // 返回禁手类型字符串或 null
  BOARD.checkForbidden = function (x, y) {
    // 临时放置
    BOARD.grid[y][x] = BLACK;
    let threeCount = 0, fourCount = 0;
    let isOverline = false;
    for (const [dx, dy] of DIRS) {
      const a = BOARD.analyzeDir(x, y, dx, dy, BLACK);
      if (a.count >= 6) isOverline = true;
      else if (a.count === 5) { /* 五连不是禁手 */ }
      else if (a.count === 4) {
        if (a.openEnds >= 1) fourCount++;
      }
      else if (a.count === 3) {
        if (a.openEnds === 2) threeCount++;
      }
    }
    BOARD.grid[y][x] = EMPTY; // 恢复
    if (isOverline) return "overline";
    if (fourCount >= 2) return "four-four";
    if (threeCount >= 2) return "three-three";
    return null;
  };

  /* ---------------- RIF 规则状态 ---------------- */
  // RIF: 黑先(天元) → 白子 → 黑子 → 白方选择交换或继续 → 黑方五手两打
  BOARD.rifState = function () {
    const n = BOARD.moves.length;
    if (n === 0) return { phase: "opening", canSwap: false, isTwoChoice: false };
    if (n === 1) return { phase: "opening", canSwap: false, isTwoChoice: false };
    if (n === 2) return { phase: "opening", canSwap: true, isTwoChoice: false };
    if (n === 3) return { phase: "opening", canSwap: false, isTwoChoice: false };
    if (n === 4) return { phase: "opening", canSwap: false, isTwoChoice: true };
    return { phase: "normal", canSwap: false, isTwoChoice: false };
  };

  /* ---------------- 棋型识别（用于 AI 评估和教学） ---------------- */
  // 返回某点在某方向上的棋型: "five" | "liveFour" | "rushFour" | "liveThree" | "sleepThree" | "liveTwo" | "rushTwo" | null
  BOARD.getPattern = function (x, y, dx, dy, p) {
    const a = BOARD.analyzeDir(x, y, dx, dy, p);
    if (a.count >= 5) return "five";
    if (a.count === 4) return a.openEnds === 2 ? "liveFour" : a.openEnds === 1 ? "rushFour" : null;
    if (a.count === 3) return a.openEnds === 2 ? "liveThree" : a.openEnds === 1 ? "sleepThree" : null;
    if (a.count === 2) return a.openEnds === 2 ? "liveTwo" : a.openEnds === 1 ? "rushTwo" : null;
    return null;
  };

  /* ---------------- 全棋盘棋型扫描 ---------------- */
  // 返回 { black: {...counts}, white: {...counts} } 各棋型数量
  BOARD.scanPatterns = function () {
    const counts = { [BLACK]: {}, [WHITE]: {} };
    const patterns = ["five", "liveFour", "rushFour", "liveThree", "sleepThree", "liveTwo", "rushTwo"];
    for (const p of [BLACK, WHITE]) {
      for (const pt of patterns) counts[p][pt] = 0;
    }
    const visited = new Set();
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const p = BOARD.grid[y][x];
        if (p === EMPTY) continue;
        for (const [dx, dy] of DIRS) {
          // 只从每段连子的起点开始统计，避免重复
          const key = `${p},${x},${y},${dx},${dy}`;
          const prevX = x - dx, prevY = y - dy;
          if (inBoard(prevX, prevY) && BOARD.grid[prevY][prevX] === p) continue; // 不是起点
          const pt = BOARD.getPattern(x, y, dx, dy, p);
          if (pt) counts[p][pt]++;
        }
      }
    }
    return counts;
  };

  /* ---------------- SGF 导出/导入 ---------------- */
  BOARD.toSGF = function () {
    const coords = "abcdefghijklmnop";
    let sgf = "(;GM[4]FF[4]SZ[15]PB[黑]PW[白]";
    if (BOARD.result === 1) sgf += "RE[B+R]";
    else if (BOARD.result === 2) sgf += "RE[W+R]";
    else if (BOARD.result === 3) sgf += "RE[0]";
    for (const m of BOARD.moves) {
      const p = m.player === BLACK ? "B" : "W";
      sgf += `;${p}[${coords[m.x]}${coords[m.y]}]`;
    }
    sgf += ")";
    return sgf;
  };

  BOARD.fromSGF = function (sgf) {
    BOARD.reset();
    const coords = "abcdefghijklmnop";
    const re = /;([BW])\[([a-o])([a-o])\]/g;
    let m;
    while ((m = re.exec(sgf)) !== null) {
      const p = m[1] === "B" ? BLACK : WHITE;
      const x = coords.indexOf(m[2]), y = coords.indexOf(m[3]);
      if (x >= 0 && y >= 0 && BOARD.grid[y][x] === EMPTY) {
        BOARD.grid[y][x] = p;
        BOARD.moves.push({ x, y, player: p });
      }
    }
    if (BOARD.moves.length > 0) {
      BOARD.current = BOARD.moves[BOARD.moves.length - 1].player === BLACK ? WHITE : BLACK;
    }
    return BOARD.moves.length;
  };

  /* ---------------- 多局比分 ---------------- */
  BOARD.recordResult = function () {
    if (BOARD.result === 1) BOARD.scores.black++;
    else if (BOARD.result === 2) BOARD.scores.white++;
    else if (BOARD.result === 3) BOARD.scores.draws++;
  };

  BOARD.nextRound = function () {
    BOARD.round++;
    BOARD.firstMove = BOARD.firstMove === BLACK ? WHITE : BLACK; // 交换先手
    BOARD.reset();
  };

  window.BOARD = BOARD;
})();
