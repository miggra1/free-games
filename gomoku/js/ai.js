/* ============================================================
 * ai.js — 五子棋 AI 引擎
 * 棋型评分 / 极大极小搜索 / Alpha-Beta 剪枝 / 置换表 / 迭代加深
 * ============================================================
 * 2026-07-24: 重写搜索主循环，真正遍历候选点而非只评估第一步；
 *             优化评估函数与着法排序；大师难度显著增强。
 * ============================================================ */
(function () {
  "use strict";
  const SIZE = 15, EMPTY = 0, BLACK = 1, WHITE = 2;
  const DIRS = [[1, 0], [0, 1], [1, 1], [1, -1]];

  const WIN_SCORE = 100000000;
  const PAT_VAL = {
    five:       100000000,
    liveFour:   1000000,
    rushFour:   25000,
    liveThree:  12000,
    sleepThree: 600,
    liveTwo:    250,
    rushTwo:    30,
    liveOne:    2,
  };

  /* ---------------- Zobrist 哈希 ---------------- */
  const zobrist = [];
  for (let i = 0; i < SIZE * SIZE; i++) {
    zobrist.push([
      BigInt(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)),
      BigInt(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER))
    ]);
  }
  function hashBoard(grid) {
    let h = 0n;
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        if (grid[y][x] !== EMPTY) h ^= zobrist[y * SIZE + x][grid[y][x] - 1];
      }
    }
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

  /* ---------------- 局面工具 ---------------- */
  function inBoard(x, y) { return x >= 0 && x < SIZE && y >= 0 && y < SIZE; }

  function analyzeDir(grid, x, y, dx, dy, p) {
    let count = 1, openEnds = 0;
    for (let i = 1; i < SIZE; i++) {
      const nx = x + dx * i, ny = y + dy * i;
      if (!inBoard(nx, ny)) break;
      if (grid[ny][nx] === p) count++;
      else if (grid[ny][nx] === EMPTY) { openEnds++; break; }
      else break;
    }
    for (let i = 1; i < SIZE; i++) {
      const nx = x - dx * i, ny = y - dy * i;
      if (!inBoard(nx, ny)) break;
      if (grid[ny][nx] === p) count++;
      else if (grid[ny][nx] === EMPTY) { openEnds++; break; }
      else break;
    }
    return { count, openEnds };
  }

  function getPattern(grid, x, y, dx, dy, p) {
    const a = analyzeDir(grid, x, y, dx, dy, p);
    if (a.count >= 5) return "five";
    if (a.count === 4) return a.openEnds === 2 ? "liveFour" : a.openEnds === 1 ? "rushFour" : null;
    if (a.count === 3) return a.openEnds === 2 ? "liveThree" : a.openEnds === 1 ? "sleepThree" : null;
    if (a.count === 2) return a.openEnds === 2 ? "liveTwo" : a.openEnds === 1 ? "rushTwo" : null;
    return a.openEnds > 0 ? "liveOne" : null;
  }

  /* ---------------- 禁手检查（黑棋） ---------------- */
  function isForbiddenMove(grid, x, y, p, ruleMode) {
    if (ruleMode === "free" || p !== BLACK) return false;
    if (grid[y][x] !== EMPTY) return false;
    grid[y][x] = BLACK;
    let threeCount = 0, fourCount = 0, overline = false;
    for (const [dx, dy] of DIRS) {
      const a = analyzeDir(grid, x, y, dx, dy, BLACK);
      if (a.count > 5) overline = true;
      else if (a.count === 5) { /* 五连不算禁手 */ }
      else if (a.count === 4 && a.openEnds >= 1) fourCount++;
      else if (a.count === 3 && a.openEnds === 2) threeCount++;
    }
    grid[y][x] = EMPTY;
    return overline || fourCount >= 2 || threeCount >= 2;
  }

  /* ---------------- 局面评估 ---------------- */
  function patternScore(grid, p) {
    let score = 0;
    const visited = new Set();
    let liveThree = 0, rushFour = 0, liveFour = 0;
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        if (grid[y][x] !== p) continue;
        for (const [dx, dy] of DIRS) {
          const px = x - dx, py = y - dy;
          if (inBoard(px, py) && grid[py][px] === p) continue;
          const key = `${x},${y},${dx},${dy}`;
          if (visited.has(key)) continue;
          visited.add(key);
          const pat = getPattern(grid, x, y, dx, dy, p);
          if (!pat) continue;
          score += PAT_VAL[pat];
          if (pat === "liveThree") liveThree++;
          else if (pat === "rushFour") rushFour++;
          else if (pat === "liveFour") liveFour++;
        }
      }
    }
    // 多线威胁奖励
    if (liveThree >= 2) score += 200000;
    if (rushFour >= 2) score += 50000;
    if (liveFour >= 1 && (liveThree + rushFour) >= 1) score += 20000;
    return score;
  }

  function evaluate(grid, rootPlayer) {
    const opp = rootPlayer === BLACK ? WHITE : BLACK;
    return patternScore(grid, rootPlayer) - patternScore(grid, opp);
  }

  /* ---------------- 着点威胁评估（用于着法生成与排序） ---------------- */
  function pointThreat(grid, x, y, p) {
    if (grid[y][x] !== EMPTY) return -1;
    let s = 0;
    grid[y][x] = p;
    for (const [dx, dy] of DIRS) {
      const pat = getPattern(grid, x, y, dx, dy, p);
      if (pat) s += PAT_VAL[pat];
    }
    grid[y][x] = EMPTY;
    return s;
  }

  function moveHeuristic(grid, x, y, p) {
    const opp = p === BLACK ? WHITE : BLACK;
    const atk = pointThreat(grid, x, y, p);
    const def = pointThreat(grid, x, y, opp);
    return atk + def * 1.25;
  }

  /* ---------------- 生成候选着点 ---------------- */
  function boardHasStone(grid) {
    for (let y = 0; y < SIZE; y++)
      for (let x = 0; x < SIZE; x++)
        if (grid[y][x] !== EMPTY) return true;
    return false;
  }

  function generateMoves(grid, player, limit, ruleMode) {
    if (!boardHasStone(grid)) return [{ x: 7, y: 7, score: 0 }];
    const moves = [];
    const seen = new Set();
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        if (grid[y][x] === EMPTY) continue;
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            const nx = x + dx, ny = y + dy;
            if (!inBoard(nx, ny)) continue;
            if (grid[ny][nx] !== EMPTY) continue;
            const key = ny * SIZE + nx;
            if (seen.has(key)) continue;
            seen.add(key);
            if (isForbiddenMove(grid, nx, ny, player, ruleMode)) continue;
            const score = moveHeuristic(grid, nx, ny, player);
            moves.push({ x: nx, y: ny, score });
          }
        }
      }
    }
    moves.sort((a, b) => b.score - a.score);
    return moves.slice(0, limit);
  }

  /* ---------------- 胜负判定 ---------------- */
  function isWinningMove(grid, x, y, p) {
    if (grid[y][x] !== EMPTY) return false;
    grid[y][x] = p;
    let win = false;
    for (const [dx, dy] of DIRS) {
      let cnt = 1;
      for (let i = 1; i < 5; i++) {
        const nx = x + dx * i, ny = y + dy * i;
        if (!inBoard(nx, ny) || grid[ny][nx] !== p) break;
        cnt++;
      }
      for (let i = 1; i < 5; i++) {
        const nx = x - dx * i, ny = y - dy * i;
        if (!inBoard(nx, ny) || grid[ny][nx] !== p) break;
        cnt++;
      }
      if (cnt >= 5) { win = true; break; }
    }
    grid[y][x] = EMPTY;
    return win;
  }

  /* ---------------- Alpha-Beta 搜索 ---------------- */
  let searchStart = 0, searchLimit = 5000;
  let nodesSearched = 0;
  let AI_ABORT = false;
  let RULE_MODE = "free";

  function searchMoveLimit(depth, isRoot) {
    if (isRoot) return depth <= 2 ? 24 : depth <= 4 ? 28 : 32;
    return depth <= 1 ? 16 : depth <= 3 ? 20 : 24;
  }

  function alphabeta(grid, depth, alpha, beta, player, isMax, rootPlayer) {
    if (AI_ABORT) return evaluate(grid, rootPlayer);
    nodesSearched++;
    // 每 1024 个节点检查一次时间，防止单次分支超时过长
    if ((nodesSearched & 1023) === 0 && Date.now() - searchStart > searchLimit) {
      AI_ABORT = true;
      return evaluate(grid, rootPlayer);
    }

    const key = hashBoard(grid);
    const ttEntry = ttGet(key);
    const oldAlpha = alpha, oldBeta = beta;
    if (ttEntry && ttEntry.depth >= depth) {
      if (ttEntry.flag === 0) return ttEntry.val;
      if (ttEntry.flag === 1 && ttEntry.val >= beta) return ttEntry.val;
      if (ttEntry.flag === 2 && ttEntry.val <= alpha) return ttEntry.val;
    }

    if (depth <= 0) return evaluate(grid, rootPlayer);

    const opp = player === BLACK ? WHITE : BLACK;
    const moves = generateMoves(grid, player, searchMoveLimit(depth, false), RULE_MODE);
    if (moves.length === 0) return evaluate(grid, rootPlayer);

    let bestMove = null;
    if (isMax) {
      let best = -Infinity;
      for (const m of moves) {
        grid[m.y][m.x] = player;
        let val;
        if (isWinningMove(grid, m.x, m.y, player)) {
          val = WIN_SCORE + depth;
        } else {
          val = alphabeta(grid, depth - 1, alpha, beta, opp, false, rootPlayer);
        }
        grid[m.y][m.x] = EMPTY;
        if (AI_ABORT) return evaluate(grid, rootPlayer);
        if (val > best) { best = val; bestMove = m; }
        if (best > alpha) alpha = best;
        if (beta <= alpha) break;
      }
      let flag = 0;
      if (best >= oldBeta) flag = 1;
      else if (best <= oldAlpha) flag = 2;
      ttSet(key, best, depth, flag, bestMove);
      return best;
    } else {
      let best = Infinity;
      for (const m of moves) {
        grid[m.y][m.x] = player;
        let val;
        if (isWinningMove(grid, m.x, m.y, player)) {
          val = -(WIN_SCORE + depth);
        } else {
          val = alphabeta(grid, depth - 1, alpha, beta, opp, true, rootPlayer);
        }
        grid[m.y][m.x] = EMPTY;
        if (AI_ABORT) return evaluate(grid, rootPlayer);
        if (val < best) { best = val; bestMove = m; }
        if (best < beta) beta = best;
        if (beta <= alpha) break;
      }
      let flag = 0;
      if (best <= oldAlpha) flag = 2;
      else if (best >= oldBeta) flag = 1;
      ttSet(key, best, depth, flag, bestMove);
      return best;
    }
  }

  /* ---------------- 难度配置 ---------------- */
  const DIFFICULTY = {
    beginner: { depth: 1, timeLimit: 400,  randomness: 0.45, name: "新手" },
    normal:   { depth: 2, timeLimit: 1000, randomness: 0.18, name: "普通" },
    hard:     { depth: 4, timeLimit: 3000, randomness: 0.04, name: "困难" },
    master:   { depth: 6, timeLimit: 6000, randomness: 0,    name: "大师" },
  };

  /* ---------------- AI 主入口 ---------------- */
  const AI = {
    DIFFICULTY,
    thinking: false,
    thinkTime: 0,

    think(grid, player, difficulty, callback) {
      const cfg = DIFFICULTY[difficulty] || DIFFICULTY.normal;
      AI.thinking = true;
      AI_ABORT = false;
      searchStart = Date.now();
      searchLimit = cfg.timeLimit;
      nodesSearched = 0;
      RULE_MODE = (typeof BOARD !== "undefined" && BOARD.ruleMode) ? BOARD.ruleMode : "free";
      TT.clear();

      // 空棋盘直接下天元
      if (!boardHasStone(grid)) {
        AI.thinkTime = Date.now() - searchStart;
        AI.thinking = false;
        if (callback) callback({ x: 7, y: 7 });
        return;
      }

      const opp = player === BLACK ? WHITE : BLACK;
      let candidates = generateMoves(grid, player, 40, RULE_MODE);

      // 1. 自己能直接五连，立刻下
      for (const m of candidates) {
        if (isWinningMove(grid, m.x, m.y, player)) {
          AI.thinkTime = Date.now() - searchStart;
          AI.thinking = false;
          if (callback) callback({ x: m.x, y: m.y });
          return;
        }
      }

      // 2. 对手有 immediate 五连威胁，必须堵；若只有一处则强制作答
      const blocks = [];
      for (const m of candidates) {
        if (isWinningMove(grid, m.x, m.y, opp)) blocks.push(m);
      }
      if (blocks.length === 1) {
        AI.thinkTime = Date.now() - searchStart;
        AI.thinking = false;
        if (callback) callback({ x: blocks[0].x, y: blocks[0].y });
        return;
      }

      // 3. 迭代加深主搜索
      let bestMove = candidates[0] || { x: 7, y: 7 };
      let bestVal = -Infinity;
      let completedDepth = 0;

      for (let d = 1; d <= cfg.depth; d++) {
        let curBest = null;
        let curVal = -Infinity;
        const limit = searchMoveLimit(d, true);
        const movesThisDepth = candidates.slice(0, limit);

        for (const m of movesThisDepth) {
          if (isForbiddenMove(grid, m.x, m.y, player, RULE_MODE)) continue;
          grid[m.y][m.x] = player;
          let val;
          if (isWinningMove(grid, m.x, m.y, player)) {
            val = WIN_SCORE + d;
          } else {
            val = alphabeta(grid, d - 1, -Infinity, Infinity, opp, false, player);
          }
          grid[m.y][m.x] = EMPTY;
          if (AI_ABORT) break;
          if (val > curVal) { curVal = val; curBest = m; }
          if (Date.now() - searchStart > searchLimit) { AI_ABORT = true; break; }
        }

        if (AI_ABORT) break;
        if (curBest) {
          bestMove = curBest;
          bestVal = curVal;
          completedDepth = d;
          // 下一轮把当前最佳排在最前，增强剪枝
          candidates = [curBest, ...candidates.filter(c => c !== curBest)];
        }
      }

      // 4. 低难度拟人化失误
      if (cfg.randomness > 0 && Math.random() < cfg.randomness) {
        const backup = generateMoves(grid, player, 8, RULE_MODE);
        if (backup.length > 1) {
          const idx = Math.min(backup.length - 1, 1 + Math.floor(Math.random() * 3));
          bestMove = backup[idx];
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
      const moves = generateMoves(grid, player, 12, (typeof BOARD !== "undefined" && BOARD.ruleMode) ? BOARD.ruleMode : "free");
      if (moves.length === 0) { callback({ x: 7, y: 7 }); return; }
      callback(moves[0]);
    },
  };

  window.AI = AI;
})();
