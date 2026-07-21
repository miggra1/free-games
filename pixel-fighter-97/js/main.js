/* main.js - game loop & event binding */

const prevKeys = new Set();
function pressed(code) { return KEYS.has(code) && !prevKeys.has(code); }
function updatePrev() { prevKeys.clear(); for (const k of KEYS) prevKeys.add(k); }

function updateMenu() {
  if (pressed("KeyW") || pressed("ArrowUp")) { G.menu = (G.menu + 5) % 6; audio.sfx("select"); }
  if (pressed("KeyS") || pressed("ArrowDown")) { G.menu = (G.menu + 1) % 6; audio.sfx("select"); }
  if (pressed("Enter") || pressed("Space")) {
    audio.init(); audio.sfx("select");
    if (G.menu === 0) { G.mode = "arcade"; G.arcadeStage = 1; G.chosen = [[], []]; G.state = "select"; }
    if (G.menu === 1) { G.mode = "versus"; G.chosen = [[], []]; G.state = "select"; }
    if (G.menu === 2) { G.mode = "cpu"; G.chosen = [[], [3, 2, 4]]; G.state = "select"; }
    if (G.menu === 3) { G.mode = "training"; G.chosen = [[0, 1, 4], [3, 2, 5]]; resetMatch("training"); }
    if (G.menu === 4) { G.state = "settings"; G.menu = 0; }
    if (G.menu === 5) G.state = "moves";
  }
}

function updateSettings() {
  if (G.keySetup && G.keySetup.active) { updateKeySetup(); return; }
  if (pressed("KeyW") || pressed("ArrowUp")) G.menu = (G.menu + 3) % 3;
  if (pressed("KeyS") || pressed("ArrowDown")) G.menu = (G.menu + 1) % 3;
  const delta = (pressed("KeyD") || pressed("ArrowRight") ? 1 : 0) - (pressed("KeyA") || pressed("ArrowLeft") ? 1 : 0);
  if (delta && G.menu === 0) G.settings.ai = clamp(G.settings.ai + delta, 1, 3);
  if (delta && G.menu === 1) G.settings.roundTime = clamp(G.settings.roundTime + delta * 10, 30, 99);
  if (pressed("Enter") && G.menu === 2) { G.keySetup = { active: true, player: 0, action: "lp", listening: false }; }
  if (pressed("Escape")) { G.state = "title"; G.menu = 0; }
}

const KEY_ACTIONS = ["lp","lk","hp","hk","sp","su","dodge","charge","switch","pause"];
const ACTION_LABELS = {lp:"轻拳",lk:"轻脚",hp:"重拳",hk:"重脚",sp:"必杀",su:"超杀",dodge:"闪避",charge:"蓄气",switch:"换人",pause:"暂停"};

function updateKeySetup() {
  const ks = G.keySetup;
  if (!ks.listening) {
    if (pressed("Enter") || pressed("Space")) { ks.listening = true; ks.startFrame = G.frame; }
    if (pressed("Escape")) { ks.active = false; saveKeyConfig(); return; }
    if (pressed("Tab")) { ks.player = ks.player ? 0 : 1; }
    const idx = KEY_ACTIONS.indexOf(ks.action);
    if (pressed("KeyD") || pressed("ArrowRight")) ks.action = KEY_ACTIONS[(idx + 1) % KEY_ACTIONS.length];
    if (pressed("KeyA") || pressed("ArrowLeft")) ks.action = KEY_ACTIONS[(idx + KEY_ACTIONS.length - 1) % KEY_ACTIONS.length];
  } else {
    // 等待上一帧的Enter/Space松开，避免误绑定
    if (G.frame - (ks.startFrame || 0) < 6) return;
    if (KEYS.size === 0) { ks.awaitKey = true; }
    if (!ks.awaitKey) return;
    for (const code of KEYS) {
      if (code === "Escape") { ks.listening = false; ks.awaitKey = false; continue; }
      const keys = ks.player === 0 ? P1_KEYS : P2_KEYS;
      keys[ks.action] = code;
      ks.listening = false; ks.awaitKey = false;
      const idx = KEY_ACTIONS.indexOf(ks.action);
      if (idx < KEY_ACTIONS.length - 1) ks.action = KEY_ACTIONS[idx + 1];
      else if (ks.player === 0) { ks.player = 1; ks.action = KEY_ACTIONS[0]; }
      else { ks.active = false; saveKeyConfig(); }
      audio.sfx("select"); break;
    }
  }
}

function tick() {
  G.frame++;
  // 手柄扫描
  if (G.frame % 60 === 0) { if (G.p1 && G.p1.input) G.p1.input.scanGP(); if (G.p2 && G.p2.input) G.p2.input.scanGP(); }

  if (G.state === "title") updateMenu();
  else if (G.state === "select") updateSelect();
  else if (G.state === "order") updateOrder();
  else if (G.state === "settings") updateSettings();
  else if (G.state === "moves" && pressed("Escape")) G.state = "title";
  else if (G.state === "fight") {
    // 暂停
    if ((G.p1 && G.p1.input && G.p1.input.pressed("pause")) || (G.p2 && G.p2.input && G.p2.input.pressed("pause"))) {
      G.paused = true; G.pauseMenu = 0;
    }
    if (pressed("Escape") && !G.paused) { G.state = "title"; }
    else if (G.paused) updatePause();
    else updateFight();
  }
  else if (G.state === "between") updateBetween();
  else if (G.state === "results") {
    if (pressed("Enter")) { G.arcadeStage = 1; G.chosen = [[], []]; G.state = "select"; }
    if (pressed("Escape")) G.state = "title";
  }

  render();
  updatePrev();
  requestAnimationFrame(tick);
}

// 键盘事件
window.addEventListener("keydown", e => {
  KEYS.add(e.code);
  if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Tab"].includes(e.code)) e.preventDefault();
  audio.init();
});
window.addEventListener("keyup", e => KEYS.delete(e.code));
window.addEventListener("blur", () => { KEYS.clear(); TOUCH.clear(); });

// 触屏事件
document.querySelectorAll("[data-touch]").forEach(btn => {
  const action = btn.dataset.touch;
  btn.addEventListener("pointerdown", e => { e.preventDefault(); TOUCH.add(action); audio.init(); });
  btn.addEventListener("pointerup", e => { e.preventDefault(); TOUCH.delete(action); });
  btn.addEventListener("pointercancel", () => TOUCH.delete(action));
});

// 快速测试模式
if (new URLSearchParams(location.search).has("fight")) {
  G.chosen = [[0, 1, 4], [3, 2, 5]];
  resetMatch("cpu");
}

boot("Starting...");
tick();
