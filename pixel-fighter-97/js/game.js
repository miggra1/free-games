/* game.js - game loop, state, round management */

function rectsOverlap(a, b) { const ax = a.w < 0 ? a.x + a.w : a.x, aw = Math.abs(a.w); return ax < b.x + b.w && ax + aw > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }

function resetMatch(mode) {
  G.mode = mode; G.training = mode === "training"; G.aiLevel = mode === "arcade" && G.arcadeStage >= 4 ? 3 : G.settings.ai;
  const p1Team = G.chosen[0].length ? G.chosen[0] : [0, 1, 4];
  let p2Team = G.chosen[1].length ? G.chosen[1] : [3, 2, 5];
  if (mode === "arcade" && G.arcadeStage >= 5) p2Team = [5, 3, 5];
  G.p1 = new Fighter(p1Team, 0, new Input(P1_KEYS, 0), false);
  G.p2 = new Fighter(p2Team, 1, new Input(P2_KEYS, 1), mode !== "versus");
  G.p1.readyAt(250); G.p2.readyAt(710);
  G.p1.hpStock = p1Team.map(() => 1000); G.p2.hpStock = p2Team.map(() => 1000);
  G.p1.hp = 1000; G.p2.hp = 1000;
  G.round = 1; G.p1Wins = 0; G.p2Wins = 0; G.time = G.settings.roundTime * 60;
  G.projectiles = []; G.effects = []; G.winner = null; G.paused = false;
  G.stageIdx = mode === "arcade" ? Math.min(G.arcadeStage - 1, 4) : 0;
  G.message = mode === "training" ? "TRAINING" : "ROUND 1"; G.messageTimer = 100; G.state = "fight";
  audio.sfx("round"); setTimeout(() => { G.message = "FIGHT!"; G.messageTimer = 50; audio.sfx("fight"); }, 800);
}

function nextMember(f) {
  f.hpStock[f.index] = 0; f.index++;
  if (f.index >= f.team.length) return false;
  const meter = f.meter; f.hp = 1000; f.spawn(true); f.meter = meter; f.readyAt(f.side ? 725 : 235);
  G.message = f.data.name + " 登场"; G.messageTimer = 90; return true;
}

function finishRound(winner) {
  if (G.training) { G.p1.hp = 1000; G.p2.hp = 1000; G.time = 999 * 60; return; }
  if (winner === G.p1) G.p1Wins++; else G.p2Wins++;
  if (winner === G.p1) G.p1.victoryPose = true; else G.p2.victoryPose = true;
  winner === G.p1 ? audio.sfx("win") : audio.sfx("lose");
  G.winner = winner; G.message = winner === G.p1 ? "PLAYER 1 WINS" : "PLAYER 2 WINS";
  G.messageTimer = 130; G.state = "between";
}

function updateFight() {
  if (G.paused) return;
  if (G.hitStop > 0) { G.hitStop--; return; }
  if (G.slow > 0 && G.frame % 2 === 0) { G.slow--; return; }
  G.time--;
  if (G.time > 0 && G.time % 60 === 0 && G.time / 60 <= 5) audio.sfx("countdown");
  audio.music(G.frame, G.stageIdx, G.time < 900);
  G.p1.tick(G.p2); G.p2.tick(G.p1);
  // 推挤
  const dx = G.p2.x - G.p1.x;
  if (Math.abs(dx) < 58) { const push = (58 - Math.abs(dx)) / 2 * sign(dx || 1); G.p1.x -= push; G.p2.x += push; }
  // 攻击判定
  resolveHits(G.p1, G.p2); resolveHits(G.p2, G.p1); resolveProjectiles();
  // 效果更新
  G.effects.forEach(e => e.life--); G.effects = G.effects.filter(e => e.life > 0);
  G.projectiles.forEach(p => { p.x += p.vx; p.life--; });
  G.projectiles = G.projectiles.filter(p => p.life > 0 && p.x > -80 && p.x < W + 80 && !p.hit);
  // 胜负
  if (G.p1.hp <= 0) { if (!nextMember(G.p1)) finishRound(G.p2); }
  if (G.p2.hp <= 0) { if (!nextMember(G.p2)) finishRound(G.p1); }
  if (G.time <= 0 && !G.training) {
    if (G.p1.hp === G.p2.hp) { G.time = 10 * 60; G.message = "OVERTIME"; G.messageTimer = 80; }
    else finishRound(G.p1.hp > G.p2.hp ? G.p1 : G.p2);
  }
}

function resolveHits(a, b) {
  const box = a.attackBox(); if (!box || a.hitOnce) return;
  if (rectsOverlap(box, b.hurtbox())) a.hitOnce = b.receiveHit(a, box.move);
}

function resolveProjectiles() {
  for (const p of G.projectiles) {
    const target = p.owner === G.p1 ? G.p2 : G.p1;
    const box = { x: p.x - p.w / 2, y: p.y - p.h / 2, w: p.w, h: p.h };
    if (rectsOverlap(box, target.hurtbox())) p.hit = target.receiveHit(p.owner, "wave", p);
  }
}

function updateSelect() {
  const moveCursor = (p, dx, dy) => { let c = G.selectCursor[p], col = c % 3, row = Math.floor(c / 3); col = clamp(col + dx, 0, 2); row = clamp(row + dy, 0, 1); G.selectCursor[p] = row * 3 + col; };
  if (pressed("KeyA")) moveCursor(0, -1, 0); if (pressed("KeyD")) moveCursor(0, 1, 0);
  if (pressed("KeyW")) moveCursor(0, 0, -1); if (pressed("KeyS")) moveCursor(0, 0, 1);
  if (pressed("ArrowLeft")) moveCursor(1, -1, 0); if (pressed("ArrowRight")) moveCursor(1, 1, 0);
  if (pressed("ArrowUp")) moveCursor(1, 0, -1); if (pressed("ArrowDown")) moveCursor(1, 0, 1);
  if (pressed("KeyU") || pressed("Enter")) choose(0, G.selectCursor[0]);
  if (G.mode === "versus" && (pressed("Numpad1") || pressed("Space"))) choose(1, G.selectCursor[1]);
  if (pressed("Escape")) G.state = "title";
  const needP2 = G.mode === "versus";
  if (G.chosen[0].length >= TEAM_SIZE && (!needP2 || G.chosen[1].length >= TEAM_SIZE)) {
    if (!needP2) G.chosen[1] = G.mode === "arcade" ? [3, 2, 4] : [4, 3, 2];
    G.state = "order"; G.orderCursor = [0, 0]; G.orderPhase = [false, false];
  }
  function choose(p, idx) { if (G.chosen[p].length < TEAM_SIZE && !G.chosen[p].includes(idx)) { G.chosen[p].push(idx); audio.sfx("select"); } }
}

function updateOrder() {
  for (let p = 0; p < 2; p++) {
    if (G.orderPhase[p]) continue;
    const keys = p === 0 ? { l: "KeyA", r: "KeyD", ok: "KeyU" } : { l: "ArrowLeft", r: "ArrowRight", ok: "Numpad1" };
    const team = G.chosen[p];
    if (pressed(keys.l)) G.orderCursor[p] = (G.orderCursor[p] + 1) % team.length;
    if (pressed(keys.r)) G.orderCursor[p] = (G.orderCursor[p] + team.length - 1) % team.length;
    if (pressed(keys.ok)) {
      const sel = team.splice(G.orderCursor[p], 1)[0]; team.unshift(sel);
      G.orderPhase[p] = true; audio.sfx("select");
    }
  }
  if (G.orderPhase[0] && (G.mode !== "versus" || G.orderPhase[1])) {
    resetMatch(G.mode);
  }
  if (pressed("Escape")) { G.state = "select"; G.orderPhase = [false, false]; }
}

function updateBetween() {
  if (G.messageTimer > 0) G.messageTimer--;
  else {
    if (G.mode === "arcade" && G.winner === G.p1 && G.arcadeStage < 5) {
      G.arcadeStage++; G.chosen[1] = G.arcadeStage >= 5 ? [5, 3, 5] : shuffle([0,1,2,3,4]).slice(0, 3);
      resetMatch("arcade");
    } else if (G.mode === "arcade") { G.state = "results"; }
    else resetMatch(G.mode);
  }
}

function updatePause() {
  if (pressed("Escape") || pressed("KeyP") || pressed("NumpadDecimal")) { G.paused = false; return; }
  if (pressed("KeyW") || pressed("ArrowUp")) G.pauseMenu = (G.pauseMenu + 2) % 3;
  if (pressed("KeyS") || pressed("ArrowDown")) G.pauseMenu = (G.pauseMenu + 1) % 3;
  if (pressed("Enter") || pressed("Space")) {
    if (G.pauseMenu === 0) G.paused = false;
    else if (G.pauseMenu === 1) { resetMatch(G.mode); }
    else if (G.pauseMenu === 2) { G.state = "title"; G.paused = false; }
  }
}

function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
