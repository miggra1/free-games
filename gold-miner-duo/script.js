const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const levelEl = document.querySelector("#level");
const targetEl = document.querySelector("#target");
const timeEl = document.querySelector("#time");
const totalScoreEl = document.querySelector("#totalScore");
const p1ScoreEl = document.querySelector("#p1Score");
const p2ScoreEl = document.querySelector("#p2Score");
const restartBtn = document.querySelector("#restart");
const overlay = document.querySelector("#overlay");
const overlayMeta = document.querySelector("#overlayMeta");
const overlayTitle = document.querySelector("#overlayTitle");
const overlayText = document.querySelector("#overlayText");
const overlayAction = document.querySelector("#overlayAction");

const keys = new Set();
const itemTypes = {
  goldLarge: { label: "大金块", value: 650, weight: 2.9, radius: 34, color: "#d99a24", shine: "#ffe28a" },
  goldMedium: { label: "金块", value: 360, weight: 1.7, radius: 25, color: "#e2ae36", shine: "#fff0a8" },
  goldSmall: { label: "小金块", value: 160, weight: 1.05, radius: 17, color: "#f2c756", shine: "#fff3b0" },
  diamond: { label: "钻石", value: 720, weight: 0.75, radius: 15, color: "#8be9ff", shine: "#f0fdff" },
  rock: { label: "石头", value: 60, weight: 2.5, radius: 26, color: "#7c756b", shine: "#c8c0b2" },
  bag: { label: "神秘袋", value: 260, weight: 1.25, radius: 20, color: "#c27b45", shine: "#ffd49a" },
  bomb: { label: "炸弹", value: 0, weight: 1.15, radius: 18, color: "#2a2d33", shine: "#ff775c" },
};

let game;
let lastTime = 0;

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const scale = window.devicePixelRatio || 1;
  canvas.width = Math.round(rect.width * scale);
  canvas.height = Math.round(rect.height * scale);
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  canvas.w = rect.width;
  canvas.h = rect.height;
  if (game) layoutPlayers();
}

function w() { return canvas.w || canvas.clientWidth || 1200; }
function h() { return canvas.h || canvas.clientHeight || 720; }
function rand(min, max) { return min + Math.random() * (max - min); }
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }

function newGame() {
  game = {
    level: 1,
    target: 1100,
    time: 60,
    state: "intro",
    items: [],
    particles: [],
    players: [
      makePlayer("P1", "#f0c86a", "S", -1),
      makePlayer("P2", "#70d6ff", "↓", 1),
    ],
  };
  layoutPlayers();
  startLevel(1, true);
}

function makePlayer(name, color, key, side) {
  return {
    name,
    color,
    key,
    side,
    x: 0,
    y: 0,
    score: 0,
    hook: {
      angle: side < 0 ? 0.65 : Math.PI - 0.65,
      direction: side,
      length: 58,
      state: "swing",
      grabbed: null,
    },
  };
}

function layoutPlayers() {
  if (!game) return;
  game.players[0].x = w() * 0.2;
  game.players[0].y = 78;
  game.players[1].x = w() * 0.8;
  game.players[1].y = 78;
}

function startLevel(level, intro = false) {
  game.level = level;
  game.target = 900 + level * 360 + Math.floor(level / 3) * 260;
  game.time = Math.max(42, 65 - level * 2);
  game.items = createItems(level);
  for (const player of game.players) resetHook(player);
  updateHud();
  if (intro) {
    showOverlay("双人黄金矿工", `第 ${level} 关`, `合作挖到 ${game.target} 金币即可过关。P1 按 S，P2 按 ↓ 放钩。`, "开始");
  } else {
    hideOverlay();
    game.state = "playing";
  }
}

function createItems(level) {
  const items = [];
  const counts = {
    goldLarge: 2 + Math.floor(level / 3),
    goldMedium: 4 + Math.floor(level / 2),
    goldSmall: 6 + level,
    diamond: 2 + Math.floor(level / 4),
    rock: 4 + Math.floor(level / 2),
    bag: 2,
    bomb: 2 + Math.floor(level / 3),
  };

  for (const [type, count] of Object.entries(counts)) {
    for (let i = 0; i < count; i += 1) {
      const data = itemTypes[type];
      const item = { type, ...data, x: 0, y: 0, collected: false, wobble: rand(0, Math.PI * 2) };
      placeItem(item, items);
      items.push(item);
    }
  }
  return items;
}

function placeItem(item, items) {
  const groundTop = h() * 0.32;
  for (let attempt = 0; attempt < 140; attempt += 1) {
    item.x = rand(item.radius + 28, w() - item.radius - 28);
    item.y = rand(groundTop + item.radius, h() - item.radius - 32);
    const tooClose = items.some((other) => Math.hypot(other.x - item.x, other.y - item.y) < other.radius + item.radius + 10);
    if (!tooClose) return;
  }
}

function resetHook(player) {
  player.hook.length = 58;
  player.hook.state = "swing";
  player.hook.grabbed = null;
  player.hook.angle = player.side < 0 ? 0.65 : Math.PI - 0.65;
  player.hook.direction = player.side;
}

function update(delta) {
  if (game.state !== "playing") {
    updateParticles(delta);
    return;
  }

  game.time = Math.max(0, game.time - delta);
  for (const player of game.players) updatePlayer(player, delta);
  updateParticles(delta);
  if (game.time <= 0) finishLevel();
  updateHud();
}

function updatePlayer(player, delta) {
  const hook = player.hook;
  if (hook.state === "swing") {
    const steerLeft = player.name === "P1" ? keys.has("a") : keys.has("arrowleft");
    const steerRight = player.name === "P1" ? keys.has("d") : keys.has("arrowright");
    const steer = (steerRight ? 1 : 0) - (steerLeft ? 1 : 0);
    hook.angle += (hook.direction * 1.25 + steer * 1.2) * delta;
    const min = player.side < 0 ? 0.18 : Math.PI * 0.52;
    const max = player.side < 0 ? Math.PI * 0.48 : Math.PI - 0.18;
    if (hook.angle < min || hook.angle > max) {
      hook.angle = clamp(hook.angle, min, max);
      hook.direction *= -1;
    }
    return;
  }

  if (hook.state === "extend") {
    hook.length += 540 * delta;
    const tip = hookTip(player);
    const hit = game.items.find((item) => !item.collected && Math.hypot(item.x - tip.x, item.y - tip.y) <= item.radius + 8);
    if (hit) {
      hook.grabbed = hit;
      hit.collected = true;
      hook.state = "retract";
      return;
    }
    if (tip.x < 0 || tip.x > w() || tip.y > h() || hook.length > h() * 1.2) hook.state = "retract";
    return;
  }

  const weight = hook.grabbed ? hook.grabbed.weight : 1;
  hook.length -= (hook.grabbed ? 235 / weight : 620) * delta;
  if (hook.grabbed) {
    const tip = hookTip(player);
    hook.grabbed.x = tip.x;
    hook.grabbed.y = tip.y;
  }
  if (hook.length <= 58) collectHook(player);
}

function fireHook(player) {
  if (game.state !== "playing" || player.hook.state !== "swing") return;
  player.hook.state = "extend";
}

function collectHook(player) {
  const item = player.hook.grabbed;
  if (item) {
    if (item.type === "bomb") explode(item.x, item.y, player);
    else {
      const value = item.type === "bag" ? randomBagValue() : item.value;
      player.score += value;
      popText(`+${value}`, player.x, player.y + 46, player.color);
    }
  }
  resetHook(player);
}

function randomBagValue() {
  return [120, 180, 260, 420, 680][Math.floor(Math.random() * 5)];
}

function explode(x, y, player) {
  let value = 0;
  for (const item of game.items) {
    if (item.collected) continue;
    if (Math.hypot(item.x - x, item.y - y) <= 112) {
      item.collected = true;
      value += Math.round(item.value * 0.65);
      burst(item.x, item.y, item.color, 8);
    }
  }
  player.score += value;
  burst(x, y, "#ff704d", 24);
  popText(value > 0 ? `爆破 +${value}` : "爆破", x, y, "#ffb05c");
}

function finishLevel() {
  const total = totalScore();
  if (total >= game.target) {
    game.state = "between";
    showOverlay("过关", `第 ${game.level} 关完成`, `总金币 ${total} / ${game.target}。下一关目标更高，矿层更复杂。`, "下一关");
  } else {
    game.state = "ended";
    showOverlay("挑战失败", `第 ${game.level} 关`, `总金币 ${total} / ${game.target}，差一点。重新开挖吧。`, "重开");
  }
}

function totalScore() {
  return game.players.reduce((sum, player) => sum + player.score, 0);
}

function hookTip(player) {
  return {
    x: player.x + Math.cos(player.hook.angle) * player.hook.length,
    y: player.y + Math.sin(player.hook.angle) * player.hook.length,
  };
}

function updateHud() {
  levelEl.textContent = game.level;
  targetEl.textContent = game.target;
  timeEl.textContent = Math.ceil(game.time);
  totalScoreEl.textContent = totalScore();
  p1ScoreEl.textContent = game.players[0].score;
  p2ScoreEl.textContent = game.players[1].score;
}

function showOverlay(title, meta, text, action) {
  overlayTitle.textContent = title;
  overlayMeta.textContent = meta;
  overlayText.textContent = text;
  overlayAction.textContent = action;
  overlay.classList.remove("hidden");
}

function hideOverlay() {
  overlay.classList.add("hidden");
}

function draw() {
  ctx.clearRect(0, 0, w(), h());
  drawBackground();
  drawItems();
  for (const player of game.players) drawPlayer(player);
  drawParticles();
}

function drawBackground() {
  const sky = ctx.createLinearGradient(0, 0, 0, h());
  sky.addColorStop(0, "#284d68");
  sky.addColorStop(0.29, "#517e91");
  sky.addColorStop(0.3, "#6f4b2d");
  sky.addColorStop(1, "#1a120d");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w(), h());

  ctx.fillStyle = "#6e4a2b";
  ctx.fillRect(0, h() * 0.3, w(), 18);
  ctx.fillStyle = "rgba(255,255,255,.16)";
  for (let i = 0; i < 18; i += 1) {
    ctx.fillRect(i * 90 - 20, h() * 0.32 + (i % 5) * 26, 46, 4);
  }
}

function drawItems() {
  for (const item of game.items) {
    if (item.collected) continue;
    ctx.save();
    ctx.translate(item.x, item.y + Math.sin(performance.now() / 800 + item.wobble) * 1.6);
    if (item.type === "diamond") drawDiamond(item);
    else if (item.type === "bomb") drawBomb(item);
    else drawOre(item);
    ctx.restore();
  }
}

function drawOre(item) {
  ctx.fillStyle = item.color;
  ctx.beginPath();
  ctx.ellipse(0, 0, item.radius * 1.18, item.radius * 0.86, -0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = item.shine;
  ctx.beginPath();
  ctx.ellipse(-item.radius * 0.32, -item.radius * 0.24, item.radius * 0.34, item.radius * 0.18, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,.24)";
  ctx.lineWidth = 3;
  ctx.stroke();
}

function drawDiamond(item) {
  ctx.fillStyle = item.color;
  ctx.beginPath();
  ctx.moveTo(0, -item.radius);
  ctx.lineTo(item.radius * 1.1, -2);
  ctx.lineTo(0, item.radius);
  ctx.lineTo(-item.radius * 1.1, -2);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = item.shine;
  ctx.lineWidth = 3;
  ctx.stroke();
}

function drawBomb(item) {
  ctx.fillStyle = item.color;
  ctx.beginPath();
  ctx.arc(0, 0, item.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = item.shine;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(item.radius * 0.4, -item.radius * 0.6);
  ctx.quadraticCurveTo(item.radius, -item.radius * 1.4, item.radius * 0.45, -item.radius * 1.75);
  ctx.stroke();
}

function drawPlayer(player) {
  const tip = hookTip(player);
  ctx.strokeStyle = "#2f1d10";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(player.x, player.y + 12);
  ctx.lineTo(tip.x, tip.y);
  ctx.stroke();

  ctx.strokeStyle = player.color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(tip.x, tip.y, 12, player.hook.angle + 0.5, player.hook.angle + Math.PI * 1.5);
  ctx.stroke();

  ctx.fillStyle = "#5a371c";
  ctx.fillRect(player.x - 42, player.y - 22, 84, 32);
  ctx.fillStyle = player.color;
  ctx.beginPath();
  ctx.arc(player.x, player.y - 28, 23, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#241308";
  ctx.font = "900 15px Microsoft YaHei";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(player.name, player.x, player.y - 28);
  ctx.fillStyle = "#fff2c0";
  ctx.font = "800 13px Microsoft YaHei";
  ctx.fillText(player.key, player.x, player.y + 25);
}

function burst(x, y, color, count) {
  for (let i = 0; i < count; i += 1) {
    game.particles.push({
      x,
      y,
      vx: rand(-160, 160),
      vy: rand(-190, 80),
      life: rand(0.35, 0.85),
      color,
      size: rand(3, 7),
    });
  }
}

function popText(text, x, y, color) {
  game.particles.push({ x, y, vx: 0, vy: -45, life: 0.9, color, text, size: 20 });
}

function updateParticles(delta) {
  for (const particle of game.particles) {
    particle.life -= delta;
    particle.x += particle.vx * delta;
    particle.y += particle.vy * delta;
    particle.vy += 180 * delta;
  }
  game.particles = game.particles.filter((particle) => particle.life > 0);
}

function drawParticles() {
  for (const particle of game.particles) {
    ctx.globalAlpha = clamp(particle.life * 1.8, 0, 1);
    ctx.fillStyle = particle.color;
    if (particle.text) {
      ctx.font = `900 ${particle.size}px Microsoft YaHei`;
      ctx.textAlign = "center";
      ctx.fillText(particle.text, particle.x, particle.y);
    } else {
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

function handleKeyDown(event) {
  const key = event.key.toLowerCase();
  keys.add(key);
  if (key === "s") fireHook(game.players[0]);
  if (event.key === "ArrowDown") {
    event.preventDefault();
    fireHook(game.players[1]);
  }
}

function handleKeyUp(event) {
  keys.delete(event.key.toLowerCase());
}

function frame(now) {
  const delta = Math.min(0.033, (now - lastTime) / 1000 || 0);
  lastTime = now;
  update(delta);
  draw();
  requestAnimationFrame(frame);
}

overlayAction.addEventListener("click", () => {
  if (game.state === "intro") {
    game.state = "playing";
    hideOverlay();
  } else if (game.state === "between") {
    startLevel(game.level + 1);
  } else {
    newGame();
  }
});

restartBtn.addEventListener("click", newGame);
window.addEventListener("keydown", handleKeyDown);
window.addEventListener("keyup", handleKeyUp);
window.addEventListener("resize", resizeCanvas);

resizeCanvas();
newGame();
requestAnimationFrame(frame);
