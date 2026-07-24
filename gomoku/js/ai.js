/* ============================================================
 * ai.js — 五子棋 AI 引擎
 * 棋型评分 / 极大极小搜索 / Alpha-Beta剪枝 / 置换表 / 迭代加深 / VCF
 * ============================================================ */
(function () {
  "use strict";
  const SIZE = 15, EMPTY = 0, BLACK = 1, WHITE = 2;
  const DIRS = [[1,0],[0,1],[1,1],[1,-1]];

  /* ---------------- 棋型评分表 ---------------- */
  const SCORE = {
    five:      100000,
    liveFour:  10000,
    rushFour:  1000,
    liveThree: 1000,
    sleepThree: 100,
    liveTwo:   100,
    rushTwo:   10,
    liveOne:   1,
  };

  /* ---------------- Zobrist 哈希 ---------------- */
  const zobrist = [];
  for (let i = 0; i < SIZE * SIZE; i++) {
    zobrist.push([BigInt(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)), BigInt(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER))]);
  }
  function hashBoard(grid) {
    let h = 0n;
    for (let y = 0; y < SIZE; y++)
      for (let x = 0; x < SIZE; x++)
        if (grid[y][x] !== EMPTY) h ^= zobrist[y * SIZE + x][grid[y][x] - 1];
    return h.toString(36);
  }

  /* ---------------- 置换表 ---------------- */
  const TT = new Map();
  const TT_SIZE = 500000;
  function ttGet(key) { return TT.get(key); }
  function ttSet(key, val, depth, flag, bestMove) {
    if (TT.size >= TT_SIZE) TT.clear();
    TT.set(key, { val, depth, flag, bestMove });
  }

  /* ---------------- 局面评估 ---------------- */
  // 评估某点在某方向上对某方的棋型得分
  function evalPointDir(grid, x, y, dx, dy, p) {
    let count = 1, openEnds = 0, blockEnds = 0;
    for (let i = 1; i < SIZE; i++) {
      const nx = x + dx * i, ny = y + dy * i;
      if (nx < 0 || nx >= SIZE || ny < 0 || ny >= SIZE) break;
      if (grid[ny][nx] === p) count++;
      else if (grid[ny][nx] === EMPTY) { openEnds++; break; }
      else { blockEnds++; break; }
    }
    for (let i = 1; i < SIZE; i++) {
      const nx = x - dx * i, ny = y - dy * i;
      if (nx < 0 || nx >= SIZE || ny < 0 || ny >= SIZE) break;
      if (grid[ny][nx] === p) count++;
      else if (grid[ny][nx] === EMPTY) { openEnds++; break; }
      else break;
    }
    if (count >= 5) return SCORE.five;
    if (count === 4) return openEnds === 2 ? SCORE.liveFour : openEnds === 1 ? SCORE.rushFour : 0;
    if (count === 3) return openEnds === 2 ? SCORE.liveThree : openEnds === 1 ? SCORE.sleepThree : 0;
    if (count === 2) return openEnds === 2 ? SCORE.liveTwo : openEnds === 1 ? SCORE.rushTwo : 0;
    return openEnds > 0 ? SCORE.liveOne : 0;
  }

  // 局面总评估（正数表示 p 方优势）
  function evaluate(grid, p) {
    const opp = p === BLACK ? WHITE : BLACK;
    let pScore = 0, oppScore = 0;
    const visited = new Set();
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const c = grid[y][x];
        if (c === EMPTY) continue;
        for (const [dx, dy] of DIRS) {
          const prevX = x - dx, prevY = y - dy;
          if (prevX >= 0 && prevX < SIZE && prevY >= 0 && prevY < SIZE && grid[prevY][prevX] === c) continue;
          const key = `${c},${x},${y},${dx},${dy}`;
          if (visited.has(key)) continue;
          visited.add(key);
          const s = evalPointDir(grid, x, y, dx, dy, c);
          if (c === p) pScore += s; else oppScore += s;
        }
      }
    }
    return pScore - oppScore;
  }

  /* ---------------- 生成候选着点 ---------------- */
  // 只考虑已有棋子附近的空位（减少搜索量）
  function genMoves(grid, p) {
    const moves = [];
    const seen = new Set();
    const range = 2; // 搜索半径
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        if (grid[y][x] === EMPTY) continue;
        for (let dy = -range; dy <= range; dy++) {
          for (let dx = -range; dx <= range; dx++) {
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || nx >= SIZE || ny < 0 || ny >= SIZE) continue;
            if (grid[ny][nx] !== EMPTY) continue;
            const key = ny * SIZE + nx;
            if (seen.has(key)) continue;
            seen.add(key);
            // 简单评分排序
            let score = 0;
            for (const [ddx, ddy] of DIRS) {
              score += evalPointDir(grid, nx, ny, ddx, ddy, p);
            }
            moves.push({ x: nx, y: ny, score });
          }
        }
      }
    }
    // 按评分降序排列
    moves.sort((a, b) => b.score - a.score);
    return moves;
  }

  /* ---------------- Alpha-Beta 搜索 ---------------- */
  let searchDepth = 4, searchStart = 0, searchLimit = 3000; // 时间限制 ms
  let nodesSearched = 0;

  function alphabeta(grid, depth, alpha, beta, p, isMax, ply) {
    nodesSearched++;
    if (Date.now() - searchStart > searchLimit) return isMax ? -999999 : 999999; // 超时
    const key = hashBoard(grid);
    const ttEntry = ttGet(key);
    if (ttEntry && ttEntry.depth >= depth) {
      if (ttEntry.flag === 0) return ttEntry.val;
      if (ttEntry.flag === 1 && ttEntry.val >= beta) return ttEntry.val;
      if (ttEntry.flag === 2 && ttEntry.val <= alpha) return ttEntry.val;
    }
    if (depth === 0) return evaluate(grid, isMax ? p : (p === BLACK ? WHITE : BLACK));

    const opp = p === BLACK ? WHITE : BLACK;
    const moves = genMoves(grid, p);
    let bestMove = null;

    if (isMax) {
      let best = -Infinity;
      for (const m of moves) {
        grid[m.y][m.x] = p;
        // 检查是否五连
        let win = false;
        for (const [dx, dy] of DIRS) {
          let cnt = 1;
          for (let i = 1; i < 5; i++) { const nx = m.x + dx * i, ny = m.y + dy * i; if (nx < 0 || nx >= SIZE || ny < 0 || ny >= SIZE || grid[ny][nx] !== p) break; cnt++; }
          for (let i = 1; i < 5; i++) { const nx = m.x - dx * i, ny = m.y - dy * i; if (nx < 0 || nx >= SIZE || ny < 0 || ny >= SIZE || grid[ny][nx] !== p) break; cnt++; }
          if (cnt >= 5) { win = true; break; }
        }
        if (win) { grid[m.y][m.x] = EMPTY; return SCORE.five + depth; }
        const val = alphabeta(grid, depth - 1, alpha, beta, opp, false, ply + 1);
        grid[m.y][m.x] = EMPTY;
        if (val > best) { best = val; bestMove = m; }
        if (best > alpha) alpha = best;
        if (beta <= alpha) break; // 剪枝
      }
      ttSet(key, best, depth, best <= alpha ? 2 : 0, bestMove);
      return best;
    } else {
      let best = Infinity;
      for (const m of moves) {
        grid[m.y][m.x] = p;
        let win = false;
        for (const [dx, dy] of DIRS) {
          let cnt = 1;
          for (let i = 1; i < 5; i++) { const nx = m.x + dx * i, ny = m.y + dy * i; if (nx < 0 || nx >= SIZE || ny < 0 || ny >= SIZE || grid[ny][nx] !== p) break; cnt++; }
          for (let i = 1; i < 5; i++) { const nx = m.x - dx * i, ny = m.y - dy * i; if (nx < 0 || nx >= SIZE || ny < 0 || ny >= SIZE || grid[ny][nx] !== p) break; cnt++; }
          if (cnt >= 5) { win = true; break; }
        }
        if (win) { grid[m.y][m.x] = EMPTY; return -(SCORE.five + depth); }
        const val = alphabeta(grid, depth - 1, alpha, beta, opp, true, ply + 1);
        grid[m.y][m.x] = EMPTY;
        if (val < best) { best = val; bestMove = m; }
        if (best < beta) beta = best;
        if (beta <= alpha) break;
      }
      ttSet(key, best, depth, best >= beta ? 1 : 0, bestMove);
      return best;
    }
  }

  /* ---------------- VCF 检测（连续冲四） ---------------- */
  function hasVCF(grid, p) {
    // 简化: 检查是否存在活四或双冲四
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        if (grid[y][x] !== EMPTY) continue;
        for (const [dx, dy] of DIRS) {
          grid[y][x] = p;
          const s = evalPointDir(grid, x, y, dx, dy, p);
          grid[y][x] = EMPTY;
          if (s >= SCORE.rushFour) return { x, y };
        }
      }
    }
    return null;
  }

  /* ---------------- 难度配置 ---------------- */
  const DIFFICULTY = {
    beginner: { depth: 1, timeLimit: 500,  randomness: 0.4, name: "新手" },
    normal:   { depth: 2, timeLimit: 1000, randomness: 0.2, name: "普通" },
    hard:     { depth: 4, timeLimit: 3000, randomness: 0.05, name: "困难" },
    master:   { depth: 6, timeLimit: 5000, randomness: 0,   name: "大师" },
  };

  /* ---------------- AI 主入口 ---------------- */
  const AI = {
    DIFFICULTY,
    thinking: false,
    thinkTime: 0,

    think(grid, player, difficulty, callback) {
      const cfg = DIFFICULTY[difficulty] || DIFFICULTY.normal;
      AI.thinking = true;
      searchStart = Date.now();
      searchLimit = cfg.timeLimit;
      nodesSearched = 0;
      TT.clear();

      // 迭代加深
      let bestMove = null;
      let bestVal = -Infinity;
      for (let d = 1; d <= cfg.depth; d++) {
        searchDepth = d;
        const moves = genMoves(grid, player);
        if (moves.length === 0) {
          // 棋盘空，下天元
          bestMove = { x: 7, y: 7 };
          break;
        }
        // 取评分最高的一步
        const m = moves[0];
        grid[m.y][m.x] = player;
        const val = alphabeta(grid, d - 1, -Infinity, Infinity, player === BLACK ? WHITE : BLACK, false, 0);
        grid[m.y][m.x] = EMPTY;
        if (val > bestVal) { bestVal = val; bestMove = m; }
        if (Date.now() - searchStart > searchLimit) break;
      }

      // 低难度拟人化失误
      if (cfg.randomness > 0 && Math.random() < cfg.randomness) {
        const moves = genMoves(grid, player);
        if (moves.length > 1) {
          const idx = Math.min(moves.length - 1, 1 + Math.floor(Math.random() * 3));
          bestMove = moves[idx];
        }
      }

      AI.thinkTime = Date.now() - searchStart;
      AI.thinking = false;

      if (callback) callback(bestMove || { x: 7, y: 7 });
    },

    // 快速评估当前局面（用于形势条）
    quickEvaluate(grid, player) {
      return evaluate(grid, player);
    },

    // 推荐最佳着手（用于练习模式）
    suggestMove(grid, player, callback) {
      const moves = genMoves(grid, player);
      if (moves.length === 0) { callback({ x: 7, y: 7 }); return; }
      callback(moves[0]);
    },
  };

  window.AI = AI;
})();
