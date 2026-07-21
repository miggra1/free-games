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
  if (pressed("KeyW") || pressed("ArrowUp")) G.menu = (G.menu + 2) % 3;
  if (pressed("KeyS") || pressed("ArrowDown")) G.menu = (G.menu + 1) % 3;
  const delta = (pressed("KeyD") || pressed("ArrowRight") ? 1 : 0) - (pressed("KeyA") || pressed("ArrowLeft") ? 1 : 0);
  if (delta && G.menu === 0) G.settings.ai = clamp(G.settings.ai + delta, 1, 3);
  if (delta && G.menu === 1) G.settings.roundTime = clamp(G.settings.roundTime + delta * 10, 30, 99);
  if (pressed("Escape")) { G.state = "title"; G.menu = 0; }
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
  if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
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
