/* ============================================================
 * game.js — 五子棋游戏主控
 * 状态机 / 模式(人机/双人/AI观战) / 计时 / 输入 / UI / 教学 / 设置
 * ============================================================ */
(function () {
  "use strict";
  const SIZE = 15, EMPTY = 0, BLACK = 1, WHITE = 2;

  const GAME = {
    mode: "pve",         // "pve" | "pvp" | "aivai"
    state: "menu",       // "menu" | "playing" | "paused" | "gameover" | "review" | "teaching"
    difficulty: "normal",
    // 计时
    timers: {
      [BLACK]: { total: 600, remain: 600, byo: 30, byoCount: 3, byoUsed: 0, inByo: false },
      [WHITE]: { total: 600, remain: 600, byo: 30, byoCount: 3, byoUsed: 0, inByo: false },
    },
    timerInterval: null,
    lastTick: 0,
    // 复盘
    reviewStep: -1,
    reviewGrid: null,
    // 设置
    settings: {
      theme: "wood", sound: true, coords: true,
      moveNum: false, showEval: true, bgm: true,
    },
    // 教学
    teaching: {
      lesson: 0, step: 0,
      lessons: [],
    },
    // AI 观战
    aiVsAi: { black: "hard", white: "normal", delay: 800 },
    // 评估
    evalScore: 0,
    // 侧面板是否需要完整重绘
    panelDirty: true,
  };

  /* ---------------- DOM 引用 ---------------- */
  let canvas, sidePanel, bottomBar, overlay;
  function $(id) { return document.getElementById(id); }

  /* ---------------- 初始化 ---------------- */
  GAME.init = function () {
    canvas = $("board");
    RENDER.init(canvas);
    RENDER.theme = GAME.settings.theme;
    RENDER.showCoords = GAME.settings.coords;
    RENDER.showMoveNum = GAME.settings.moveNum;
    sidePanel = $("side-panel");
    bottomBar = $("bottom-bar");
    overlay = $("overlay");
    GAME.bindInput();
    GAME.showMenu();
    GAME.loop();
  };

  /* ---------------- 主循环 ---------------- */
  GAME.loop = function () {
    requestAnimationFrame(GAME.loop);
    if (GAME.state === "playing" || GAME.state === "review") {
      const grid = GAME.state === "review" ? GAME.reviewGrid : BOARD.grid;
      const moves = GAME.state === "review" ? BOARD.moves.slice(0, GAME.reviewStep + 1) : BOARD.moves;
      const winLine = GAME.state === "review" ? null : BOARD.winLine;
      const lastM = GAME.state === "review"
        ? (GAME.reviewStep >= 0 ? BOARD.moves[GAME.reviewStep] : null)
        : (BOARD.moves.length > 0 ? BOARD.moves[BOARD.moves.length - 1] : null);
      RENDER.draw(grid, moves, winLine, lastM);
    }
    if (GAME.state === "playing") {
      GAME.updateTimer();
      if (GAME.panelDirty) {
        GAME.updatePanel();
        GAME.panelDirty = false;
      } else {
        GAME.updatePanelInfo();
      }
    }
  };

  /* ---------------- 菜单 ---------------- */
  GAME.showMenu = function () {
    GAME.state = "menu";
    overlay.innerHTML = `
      <div class="menu-box">
        <h1 class="menu-title">五 子 棋</h1>
        <p class="menu-sub">Gomoku · Five in a Row</p>
        <div class="menu-group">
          <button class="menu-btn" onclick="GAME.startGame('pve')">人机对战</button>
          <button class="menu-btn" onclick="GAME.startGame('pvp')">本地双人</button>
          <button class="menu-btn" onclick="GAME.startGame('aivai')">AI 观战</button>
        </div>
        <div class="menu-group">
          <button class="menu-btn small" onclick="GAME.showTeaching()">教学模式</button>
          <button class="menu-btn small" onclick="GAME.showSettings()">设 置</button>
        </div>
        <div class="menu-rules">
          <p>规则：<select id="menu-rule" onchange="BOARD.ruleMode=this.value">
            <option value="free">自由规则</option>
            <option value="forbidden">有禁手</option>
            <option value="rif">RIF 规则</option>
          </select></p>
        </div>
      </div>`;
    overlay.style.display = "flex";
  };

  /* ---------------- 开始游戏 ---------------- */
  GAME.startGame = function (mode) {
    GAME.mode = mode;
    BOARD.reset();
    BOARD.firstMove = BLACK;
    BOARD.scores = { black: 0, white: 0, draws: 0 };
    BOARD.round = 1;
    GAME.resetTimers();
    GAME.reviewStep = -1;
    overlay.style.display = "none";
    GAME.state = "playing";
    GAME.lastTick = Date.now();
    if (GAME.settings.bgm) AUDIO.bgm.start();

    // PvE 选择难度
    if (mode === "pve") {
      GAME.state = "menu";
      overlay.innerHTML = `
        <div class="menu-box">
          <h2 class="menu-title">选择难度</h2>
          <div class="menu-group">
            ${Object.entries(AI.DIFFICULTY).map(([k, v]) =>
              `<button class="menu-btn" onclick="GAME.startPve('${k}')">${v.name}</button>`
            ).join("")}
          </div>
          <button class="menu-btn small" onclick="GAME.showMenu()">返 回</button>
        </div>`;
      overlay.style.display = "flex";
      return;
    }
    // AI 观战选择难度
    if (mode === "aivai") {
      GAME.state = "menu";
      overlay.innerHTML = `
        <div class="menu-box">
          <h2 class="menu-title">AI 观战设置</h2>
          <div class="menu-group">
            <p>黑方：<select id="aivai-b">${Object.entries(AI.DIFFICULTY).map(([k,v])=>`<option value="${k}" ${k==="hard"?"selected":""}>${v.name}</option>`).join("")}</select></p>
            <p>白方：<select id="aivai-w">${Object.entries(AI.DIFFICULTY).map(([k,v])=>`<option value="${k}" ${k==="normal"?"selected":""}>${v.name}</option>`).join("")}</select></p>
            <button class="menu-btn" onclick="GAME.startAivai()">开始观战</button>
          </div>
          <button class="menu-btn small" onclick="GAME.showMenu()">返 回</button>
        </div>`;
      overlay.style.display = "flex";
      return;
    }
    // 双人直接开始
    GAME.startRound();
  };

  GAME.startPve = function (diff) {
    GAME.difficulty = diff;
    GAME.state = "playing";
    overlay.style.display = "none";
    GAME.startRound();
  };

  GAME.startAivai = function () {
    GAME.aiVsAi.black = $("aivai-b").value;
    GAME.aiVsAi.white = $("aivai-w").value;
    GAME.state = "playing";
    overlay.style.display = "none";
    GAME.startRound();
    GAME.aiMove(); // AI 先行
  };

  GAME.startRound = function () {
    BOARD.reset();
    GAME.resetTimers();
    GAME.reviewStep = -1;
    GAME.state = "playing";
    GAME.lastTick = Date.now();
    GAME.panelDirty = true;
    // AI 先手时自动落子
    if (GAME.mode !== "pvp" && BOARD.current === BLACK && GAME.isAiTurn()) {
      setTimeout(() => GAME.aiMove(), 500);
    }
  };

  /* ---------------- AI 回合一 ---------------- */
  GAME.isAiTurn = function () {
    if (GAME.mode === "pvp") return false;
    if (GAME.mode === "aivai") return true;
    // pve: 玩家执黑，AI 执白
    return BOARD.current === WHITE;
  };

  GAME.aiMove = function () {
    if (BOARD.result !== 0 || !GAME.isAiTurn()) return;
    const diff = GAME.mode === "aivai"
      ? (BOARD.current === BLACK ? GAME.aiVsAi.black : GAME.aiVsAi.white)
      : GAME.difficulty;
    // 显示 AI 思考动画
    const thinkEl = $("ai-thinking");
    if (thinkEl) thinkEl.style.display = "block";
    setTimeout(() => {
      AI.think(BOARD.grid.map(r => [...r]), BOARD.current, diff, (move) => {
        if (thinkEl) thinkEl.style.display = "none";
        if (move && GAME.state === "playing") {
          BOARD.place(move.x, move.y);
          RENDER.playPlace(move.x, move.y, BOARD.moves[BOARD.moves.length - 1].player);
          AUDIO.stone();
          if (BOARD.result === 4) { RENDER.playForbidden(move.x, move.y); AUDIO.forbidden(); }
          GAME.onMoveEnd();
        }
      });
    }, 300);
  };

  /* ---------------- 落子后处理 ---------------- */
  GAME.onMoveEnd = function () {
    if (BOARD.result !== 0) {
      GAME.onGameEnd();
      return;
    }
    // 更新评估
    if (GAME.settings.showEval) {
      GAME.evalScore = AI.quickEvaluate(BOARD.grid, BLACK);
    }
    GAME.panelDirty = true;
    // AI 回合
    if (GAME.isAiTurn() && GAME.state === "playing") {
      setTimeout(() => GAME.aiMove(), GAME.mode === "aivai" ? GAME.aiVsAi.delay : 200);
    }
  };

  GAME.onGameEnd = function () {
    GAME.state = "gameover";
    if (BOARD.result === 1 || BOARD.result === 2) {
      RENDER.playWin();
      AUDIO.win();
    } else if (BOARD.result === 4) {
      AUDIO.forbidden();
    } else {
      AUDIO.lose();
    }
    BOARD.recordResult();
    setTimeout(() => GAME.showResult(), 1500);
  };

  GAME.showResult = function () {
    const names = ["", "黑棋胜", "白棋胜", "和棋", "黑棋禁手负"];
    const resultName = names[BOARD.result] || "结束";
    const isLast = BOARD.round >= 1; // 始终可以继续
    overlay.innerHTML = `
      <div class="menu-box">
        <h2 class="menu-title">${resultName}</h2>
        <p class="menu-sub">第 ${BOARD.round} 局 · ${BOARD.moves.length} 手</p>
        <p class="menu-sub">比分 黑 ${BOARD.scores.black} : ${BOARD.scores.white} 白</p>
        <div class="menu-group">
          <button class="menu-btn" onclick="GAME.nextRound()">下一局（交换先手）</button>
          <button class="menu-btn small" onclick="GAME.enterReview()">复盘</button>
          <button class="menu-btn small" onclick="GAME.showMenu()">返回菜单</button>
        </div>
      </div>`;
    overlay.style.display = "flex";
  };

  GAME.nextRound = function () {
    BOARD.nextRound();
    overlay.style.display = "none";
    GAME.startRound();
  };

  /* ---------------- 计时系统 ---------------- */
  GAME.resetTimers = function () {
    for (const p of [BLACK, WHITE]) {
      GAME.timers[p] = { total: 600, remain: 600, byo: 30, byoCount: 3, byoUsed: 0, inByo: false };
    }
    GAME.lastTick = Date.now();
  };

  GAME.updateTimer = function () {
    if (GAME.state !== "playing" || BOARD.result !== 0) return;
    const now = Date.now();
    const dt = (now - GAME.lastTick) / 1000;
    GAME.lastTick = now;
    const p = BOARD.current;
    const t = GAME.timers[p];
    if (!t.inByo) {
      t.remain -= dt;
      if (t.remain <= 0) {
        t.remain = 0;
        t.inByo = true;
        t.byoUsed = 0;
      }
    } else {
      t.remain -= dt;
      if (t.remain <= 0) {
        t.byoUsed++;
        if (t.byoUsed >= t.byoCount) {
          // 超时判负
          BOARD.result = p === BLACK ? 2 : 1;
          GAME.onGameEnd();
          return;
        }
        t.remain = t.byo;
        AUDIO.countTick();
      }
    }
  };

  /* ---------------- 输入处理 ---------------- */
  GAME.bindInput = function () {
    // 鼠标/触屏
    canvas.addEventListener("click", (e) => GAME.handleClick(e));
    canvas.addEventListener("mousemove", (e) => GAME.handleHover(e));
    canvas.addEventListener("mouseleave", () => { RENDER.hoverPos = null; });
    // 触屏
    canvas.addEventListener("touchstart", (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      GAME.handleClick({ clientX: touch.clientX, clientY: touch.clientY });
    }, { passive: false });
    // 键盘
    document.addEventListener("keydown", (e) => GAME.handleKey(e));
    // 手柄
    GAME.pollGamepad();
  };

  GAME.handleClick = function (e) {
    if (GAME.state !== "playing" || BOARD.result !== 0) return;
    if (GAME.isAiTurn()) return; // AI 回合不能落子
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
    const pos = RENDER.screenToBoard(sx, sy);
    if (!pos) return;
    GAME.tryPlace(pos.x, pos.y);
  };

  GAME.handleHover = function (e) {
    if (GAME.state !== "playing" || BOARD.result !== 0) return;
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
    const pos = RENDER.screenToBoard(sx, sy);
    RENDER.hoverPos = pos;
    RENDER.hoverPlayer = BOARD.current;
  };

  GAME.tryPlace = function (x, y) {
    if (BOARD.grid[y][x] !== EMPTY) { AUDIO.illegal(); return; }
    // 禁手预检查
    if (BOARD.ruleMode !== "free" && BOARD.current === BLACK) {
      const fb = BOARD.checkForbidden(x, y);
      if (fb) {
        RENDER.playForbidden(x, y);
        AUDIO.forbidden();
        BOARD.place(x, y); // 放置以触发禁手判负
        GAME.onMoveEnd();
        return;
      }
    }
    const ok = BOARD.place(x, y);
    if (ok) {
      RENDER.playPlace(x, y, BOARD.moves[BOARD.moves.length - 1].player);
      AUDIO.stone();
      GAME.onMoveEnd();
    } else {
      AUDIO.illegal();
    }
  };

  /* ---------------- 键盘操作 ---------------- */
  let kbdCursor = { x: 7, y: 7 };
  GAME.handleKey = function (e) {
    if (GAME.state === "playing" && BOARD.result === 0 && !GAME.isAiTurn()) {
      switch (e.key) {
        case "ArrowUp": kbdCursor.y = Math.max(0, kbdCursor.y - 1); e.preventDefault(); break;
        case "ArrowDown": kbdCursor.y = Math.min(SIZE - 1, kbdCursor.y + 1); e.preventDefault(); break;
        case "ArrowLeft": kbdCursor.x = Math.max(0, kbdCursor.x - 1); e.preventDefault(); break;
        case "ArrowRight": kbdCursor.x = Math.min(SIZE - 1, kbdCursor.x + 1); e.preventDefault(); break;
        case "Enter": case " ": GAME.tryPlace(kbdCursor.x, kbdCursor.y); e.preventDefault(); break;
      }
      RENDER.hoverPos = { ...kbdCursor };
      RENDER.hoverPlayer = BOARD.current;
    }
    if (GAME.state === "review") {
      if (e.key === "ArrowLeft") GAME.reviewNav(-1);
      if (e.key === "ArrowRight") GAME.reviewNav(1);
      if (e.key === "Escape") GAME.exitReview();
    }
    if (e.key === "Escape" && GAME.state === "playing") GAME.pauseGame();
  };

  /* ---------------- 手柄 ---------------- */
  let padState = {};
  GAME.pollGamepad = function () {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const pad = pads && pads[0];
    if (pad) {
      const ax = pad.axes[0] || 0, ay = pad.axes[1] || 0;
      const btns = pad.buttons.map(b => b.pressed);
      if (GAME.state === "playing" && !GAME.isAiTurn()) {
        if ((ax < -0.5 || btns[14]) && !padState.left) { kbdCursor.x = Math.max(0, kbdCursor.x - 1); padState.left = true; }
        else if (!(ax < -0.5 || btns[14])) padState.left = false;
        if ((ax > 0.5 || btns[15]) && !padState.right) { kbdCursor.x = Math.min(SIZE - 1, kbdCursor.x + 1); padState.right = true; }
        else if (!(ax > 0.5 || btns[15])) padState.right = false;
        if ((ay < -0.5 || btns[12]) && !padState.up) { kbdCursor.y = Math.max(0, kbdCursor.y - 1); padState.up = true; }
        else if (!(ay < -0.5 || btns[12])) padState.up = false;
        if ((ay > 0.5 || btns[13]) && !padState.down) { kbdCursor.y = Math.min(SIZE - 1, kbdCursor.y + 1); padState.down = true; }
        else if (!(ay > 0.5 || btns[13])) padState.down = false;
        if (btns[0] && !padState.a) { GAME.tryPlace(kbdCursor.x, kbdCursor.y); padState.a = true; }
        else if (!btns[0]) padState.a = false;
        RENDER.hoverPos = { ...kbdCursor };
        RENDER.hoverPlayer = BOARD.current;
      }
    }
    requestAnimationFrame(GAME.pollGamepad);
  };

  /* ---------------- 游戏操作 ---------------- */
  GAME.undoMove = function () {
    if (GAME.state !== "playing" && GAME.state !== "review") return;
    if (GAME.mode === "pve") {
      // 人机：悔两步（玩家+AI）
      BOARD.undo(); BOARD.undo();
    } else {
      BOARD.undo();
    }
    AUDIO.undo();
    GAME.state = "playing";
    overlay.style.display = "none";
    GAME.panelDirty = true;
  };

  GAME.resign = function () {
    if (BOARD.result !== 0) return;
    BOARD.result = BOARD.current === BLACK ? 2 : 1;
    GAME.panelDirty = true;
    GAME.onGameEnd();
  };

  GAME.offerDraw = function () {
    if (BOARD.result !== 0) return;
    GAME.panelDirty = true;
    if (GAME.mode === "pvp") {
      BOARD.result = 3;
      GAME.onGameEnd();
    } else {
      // AI 判断是否接受和棋
      const eval_ = AI.quickEvaluate(BOARD.grid, BOARD.current);
      if (Math.abs(eval_) < 500) { BOARD.result = 3; GAME.onGameEnd(); }
      else AUDIO.illegal();
    }
  };

  GAME.pauseGame = function () {
    if (GAME.state === "playing") { GAME.state = "paused"; }
    else if (GAME.state === "paused") { GAME.state = "playing"; GAME.lastTick = Date.now(); }
    GAME.panelDirty = true;
  };

  /* ---------------- 复盘 ---------------- */
  GAME.enterReview = function () {
    GAME.state = "review";
    GAME.reviewStep = BOARD.moves.length - 1;
    overlay.style.display = "none";
    GAME.updateReviewGrid();
    GAME.panelDirty = true;
  };

  GAME.reviewNav = function (dir) {
    GAME.reviewStep = Math.max(-1, Math.min(BOARD.moves.length - 1, GAME.reviewStep + dir));
    GAME.updateReviewGrid();
  };

  GAME.updateReviewGrid = function () {
    GAME.reviewGrid = [];
    for (let y = 0; y < SIZE; y++) GAME.reviewGrid.push(new Array(SIZE).fill(EMPTY));
    for (let i = 0; i <= GAME.reviewStep && i < BOARD.moves.length; i++) {
      const m = BOARD.moves[i];
      GAME.reviewGrid[m.y][m.x] = m.player;
    }
  };

  GAME.exitReview = function () {
    GAME.state = "gameover";
    GAME.showResult();
    GAME.panelDirty = true;
  };

  /* ---------------- SGF ---------------- */
  GAME.exportSGF = function () {
    const sgf = BOARD.toSGF();
    const blob = new Blob([sgf], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "gomoku_" + Date.now() + ".sgf";
    a.click();
  };

  GAME.importSGF = function () {
    const input = document.createElement("input");
    input.type = "file"; input.accept = ".sgf";
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (re) => {
        const n = BOARD.fromSGF(re.target.result);
        if (n > 0) {
          GAME.state = "playing";
          overlay.style.display = "none";
          GAME.enterReview();
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  /* ---------------- 教学模式 ---------------- */
  GAME.showTeaching = function () {
    GAME.state = "teaching";
    overlay.innerHTML = `
      <div class="menu-box">
        <h2 class="menu-title">教学模式</h2>
        <div class="menu-group">
          <button class="menu-btn small" onclick="GAME.teachLesson(0)">棋型演示：活三与活四</button>
          <button class="menu-btn small" onclick="GAME.teachLesson(1)">经典开局：浦月与花月</button>
          <button class="menu-btn small" onclick="GAME.teachLesson(2)">禁手规则详解</button>
        </div>
        <button class="menu-btn small" onclick="GAME.showMenu()">返 回</button>
      </div>`;
    overlay.style.display = "flex";
  };

  GAME.teachLesson = function (id) {
    const lessons = [
      {
        title: "棋型演示：活三与活四",
        desc: "活三：三子连线且两端开放，下一步可成活四。活四：四子连线且两端开放，下一步必胜。",
        moves: [
          { x: 7, y: 7, p: 1 }, { x: 8, y: 7, p: 1 }, { x: 9, y: 7, p: 1 },
          { x: 5, y: 5, p: 2 }, { x: 5, y: 6, p: 2 }, { x: 5, y: 7, p: 2 },
        ],
      },
      {
        title: "经典开局：浦月与花月",
        desc: "浦月：黑1天元，黑3斜出，是黑棋优势开局。花月：黑1天元，黑3直出，同样是黑优开局。",
        moves: [
          { x: 7, y: 7, p: 1 }, { x: 8, y: 7, p: 2 }, { x: 8, y: 8, p: 1 },
          { x: 7, y: 8, p: 2 }, { x: 6, y: 6, p: 1 },
        ],
      },
      {
        title: "禁手规则详解",
        desc: "黑棋三三禁手：同时形成两个活三。黑棋四四禁手：同时形成两个活四。黑棋长连禁手：形成六子以上连线。白棋无禁手。",
        moves: [
          { x: 7, y: 7, p: 1 }, { x: 7, y: 8, p: 2 }, { x: 8, y: 7, p: 1 },
          { x: 8, y: 8, p: 2 }, { x: 6, y: 7, p: 1 }, { x: 6, y: 8, p: 2 },
        ],
      },
    ];
    const lesson = lessons[id];
    BOARD.reset();
    for (const m of lesson.moves) BOARD.place(m.x, m.y);
    GAME.state = "review";
    GAME.reviewStep = BOARD.moves.length - 1;
    GAME.updateReviewGrid();
    overlay.innerHTML = `
      <div class="menu-box">
        <h2 class="menu-title">${lesson.title}</h2>
        <p class="menu-desc">${lesson.desc}</p>
        <p class="menu-sub">在棋盘上查看演示 · 按 Esc 返回</p>
      </div>`;
    overlay.style.display = "flex";
    setTimeout(() => { overlay.style.display = "none"; }, 3000);
  };

  /* ---------------- 设置 ---------------- */
  GAME.showSettings = function () {
    const s = GAME.settings;
    overlay.innerHTML = `
      <div class="menu-box">
        <h2 class="menu-title">设 置</h2>
        <div class="settings-list">
          <label>棋盘主题：
            <select id="set-theme" onchange="GAME.setTheme(this.value)">
              <option value="wood" ${s.theme === "wood" ? "selected" : ""}>实木</option>
              <option value="ink" ${s.theme === "ink" ? "selected" : ""}>水墨</option>
              <option value="pixel" ${s.theme === "pixel" ? "selected" : ""}>像素街机</option>
            </select>
          </label>
          <label><input type="checkbox" id="set-sound" ${s.sound ? "checked" : ""} onchange="GAME.settings.sound=this.checked; if(!this.checked)AUDIO.toggleMute();"> 音效</label>
          <label><input type="checkbox" id="set-coords" ${s.coords ? "checked" : ""} onchange="RENDER.showCoords=this.checked; GAME.settings.coords=this.checked;"> 坐标刻度</label>
          <label><input type="checkbox" id="set-movenum" ${s.moveNum ? "checked" : ""} onchange="RENDER.showMoveNum=this.checked; GAME.settings.moveNum=this.checked;"> 手数编号</label>
          <label><input type="checkbox" id="set-eval" ${s.showEval ? "checked" : ""} onchange="GAME.settings.showEval=this.checked; GAME.panelDirty=true;"> 形势评估</label>
          <label><input type="checkbox" id="set-bgm" ${s.bgm ? "checked" : ""} onchange="GAME.settings.bgm=this.checked; this.checked?AUDIO.bgm.start():AUDIO.bgm.stop();"> 背景音乐</label>
        </div>
        <div class="menu-group">
          <button class="menu-btn small" onclick="GAME.showMenu()">返 回</button>
        </div>
      </div>`;
    overlay.style.display = "flex";
  };

  GAME.setTheme = function (theme) {
    GAME.settings.theme = theme;
    RENDER.theme = theme;
  };

  /* ---------------- 侧面板更新 ---------------- */
  GAME.updatePanel = function () {
    const el = $("side-panel");
    if (!el) return;
    const t1 = GAME.timers[BLACK], t2 = GAME.timers[WHITE];
    const names = { pve: "人机对战", pvp: "本地双人", aivai: "AI 观战" };
    const diffNames = { beginner: "新手", normal: "普通", hard: "困难", master: "大师" };
    let html = `<div class="panel-section">`;
    html += `<div class="panel-mode">${names[GAME.mode] || ""} ${GAME.mode === "pve" ? "· " + diffNames[GAME.difficulty] : ""}</div>`;
    html += `<div class="panel-round">第 ${BOARD.round} 局 · ${BOARD.moves.length} 手</div>`;
    html += `<div class="panel-score">比分 黑 ${BOARD.scores.black} : ${BOARD.scores.white} 白</div>`;
    html += `</div>`;
    // 黑方
    html += `<div class="panel-section player ${BOARD.current === BLACK ? "active" : ""}" id="panel-player-black">`;
    html += `<div class="player-label"><span class="piece-icon black"></span>黑方${GAME.mode === "pve" ? "（你）" : GAME.mode === "aivai" ? "（AI " + diffNames[GAME.aiVsAi.black] + "）" : ""}</div>`;
    html += `<div class="player-timer" id="timer-black">${GAME.formatTime(t1)}</div>`;
    if (t1.inByo) html += `<div class="player-byo">读秒 ${t1.byoUsed}/${t1.byoCount}</div>`;
    html += `</div>`;
    // 白方
    html += `<div class="panel-section player ${BOARD.current === WHITE ? "active" : ""}" id="panel-player-white">`;
    html += `<div class="player-label"><span class="piece-icon white"></span>白方${GAME.mode === "pve" ? "（AI " + diffNames[GAME.difficulty] + "）" : GAME.mode === "aivai" ? "（AI " + diffNames[GAME.aiVsAi.white] + "）" : ""}</div>`;
    html += `<div class="player-timer" id="timer-white">${GAME.formatTime(t2)}</div>`;
    if (t2.inByo) html += `<div class="player-byo">读秒 ${t2.byoUsed}/${t2.byoCount}</div>`;
    html += `</div>`;
    // 评估条
    if (GAME.settings.showEval && GAME.mode !== "aivai") {
      const eval_ = Math.max(-5000, Math.min(5000, GAME.evalScore));
      const pct = 50 + (eval_ / 5000) * 50;
      html += `<div class="panel-section">`;
      html += `<div class="eval-label">形势评估</div>`;
      html += `<div class="eval-bar"><div class="eval-fill" id="eval-fill" style="width:${pct}%"></div></div>`;
      html += `<div class="eval-text" id="eval-text">${eval_ > 0 ? "黑优" : eval_ < 0 ? "白优" : "均势"} ${Math.abs(eval_)}</div>`;
      html += `</div>`;
    }
    // AI 思考动画
    html += `<div id="ai-thinking" class="ai-thinking" style="display:none">AI 思考中<span class="dots"><span>.</span><span>.</span><span>.</span></span></div>`;
    // 操作按钮
    html += `<div class="panel-section panel-btns">`;
    html += `<button class="btn" onclick="GAME.undoMove()">悔棋</button>`;
    html += `<button class="btn" onclick="GAME.resign()">认输</button>`;
    html += `<button class="btn" onclick="GAME.offerDraw()">求和</button>`;
    html += `<button class="btn" id="btn-pause" onclick="GAME.pauseGame()">${GAME.state === "paused" ? "继续" : "暂停"}</button>`;
    html += `</div>`;
    html += `<div class="panel-section panel-btns">`;
    html += `<button class="btn small" onclick="GAME.exportSGF()">导出SGF</button>`;
    html += `<button class="btn small" onclick="GAME.importSGF()">导入SGF</button>`;
    html += `<button class="btn small" onclick="GAME.showSettings()">设置</button>`;
    html += `<button class="btn small" onclick="GAME.showMenu()">菜单</button>`;
    html += `</div>`;
    // 复盘导航
    if (GAME.state === "review") {
      html += `<div class="panel-section">`;
      html += `<div class="eval-label">复盘 ${GAME.reviewStep + 1}/${BOARD.moves.length}</div>`;
      html += `<div class="panel-btns">`;
      html += `<button class="btn" onclick="GAME.reviewNav(-1)">◀ 上一步</button>`;
      html += `<button class="btn" onclick="GAME.reviewNav(1)">下一步 ▶</button>`;
      html += `<button class="btn" onclick="GAME.exitReview()">退出复盘</button>`;
      html += `</div></div>`;
    }
    el.innerHTML = html;
  };

  /* ---------------- 侧面板轻量更新（不重建 DOM，保证按钮可点击） ---------------- */
  GAME.updatePanelInfo = function () {
    const el = $("side-panel");
    if (!el) return;
    // 计时器
    const tb = $("timer-black"), tw = $("timer-white");
    if (tb) tb.textContent = GAME.formatTime(GAME.timers[BLACK]);
    if (tw) tw.textContent = GAME.formatTime(GAME.timers[WHITE]);
    // 当前行棋方高亮
    const pb = $("panel-player-black"), pw = $("panel-player-white");
    if (pb) pb.classList.toggle("active", BOARD.current === BLACK);
    if (pw) pw.classList.toggle("active", BOARD.current === WHITE);
    // 形势条
    if (GAME.settings.showEval && GAME.mode !== "aivai") {
      const eval_ = Math.max(-5000, Math.min(5000, GAME.evalScore));
      const pct = 50 + (eval_ / 5000) * 50;
      const fill = $("eval-fill"), txt = $("eval-text");
      if (fill) fill.style.width = pct + "%";
      if (txt) txt.textContent = `${eval_ > 0 ? "黑优" : eval_ < 0 ? "白优" : "均势"} ${Math.abs(eval_)}`;
    }
    // 暂停按钮文字
    const btnPause = $("btn-pause");
    if (btnPause) btnPause.textContent = GAME.state === "paused" ? "继续" : "暂停";
  };

  /* ---------------- 时间格式化 ---------------- */
  GAME.formatTime = function (t) {
    const r = Math.max(0, t.remain);
    const m = Math.floor(r / 60), s = Math.floor(r % 60);
    return t.inByo ? `${s}s` : `${m}:${String(s).padStart(2, "0")}`;
  };

  window.GAME = GAME;
})();