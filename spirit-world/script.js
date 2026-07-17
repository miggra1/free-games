const canvas = document.querySelector("#world");
const ctx = canvas.getContext("2d");

const ui = {
  zoneName: document.querySelector("#zoneName"),
  hintText: document.querySelector("#hintText"),
  ballCount: document.querySelector("#ballCount"),
  berryCount: document.querySelector("#berryCount"),
  dexCount: document.querySelector("#dexCount"),
  focusType: document.querySelector("#focusType"),
  focusName: document.querySelector("#focusName"),
  catchButton: document.querySelector("#catchButton"),
  touchCatch: document.querySelector("#touchCatch"),
  questList: document.querySelector("#questList"),
  dexGrid: document.querySelector("#dexGrid"),
  resetButton: document.querySelector("#resetButton"),
};

const world = { width: 2200, height: 1500 };
const keys = new Set();
const touchDirs = new Set();
const particles = [];
let lastTime = performance.now();
let messageTimer = 0;

const species = [
  { name: "叶芽灵", type: "草", color: "#7dde83", icon: "芽", rarity: 0.72, zone: "grass" },
  { name: "露珠兔", type: "水", color: "#5bbff5", icon: "露", rarity: 0.68, zone: "lake" },
  { name: "火尾狐", type: "火", color: "#ff9260", icon: "火", rarity: 0.58, zone: "volcano" },
  { name: "电星鸟", type: "电", color: "#f4d35e", icon: "星", rarity: 0.52, zone: "grass" },
  { name: "月影猫", type: "影", color: "#b794f4", icon: "月", rarity: 0.42, zone: "forest" },
  { name: "岩盔犀", type: "岩", color: "#c7aa83", icon: "岩", rarity: 0.48, zone: "volcano" },
  { name: "雾海鲸", type: "水", color: "#8bd3ff", icon: "鲸", rarity: 0.36, zone: "lake" },
  { name: "藤甲鹿", type: "草", color: "#9be36f", icon: "藤", rarity: 0.44, zone: "forest" },
  { name: "霜铃狐", type: "冰", color: "#b7efff", icon: "霜", rarity: 0.32, zone: "lake" },
  { name: "琥珀龙", type: "古", color: "#ffbd63", icon: "龙", rarity: 0.26, zone: "volcano" },
  { name: "星眠熊", type: "梦", color: "#f7c2ff", icon: "梦", rarity: 0.3, zone: "forest" },
  { name: "极光鹿", type: "光", color: "#d8ff7a", icon: "光", rarity: 0.22, zone: "grass" },
];

const state = {
  player: { x: 780, y: 760, speed: 250, dirX: 1, dirY: 0 },
  camera: { x: 0, y: 0 },
  balls: 18,
  berries: 3,
  caught: new Set(),
  nearby: null,
  spirits: [],
  pickups: [],
  quests: [
    { text: "捕捉任意 3 只精灵", target: 3, kind: "caught" },
    { text: "发现 6 种不同精灵", target: 6, kind: "dex" },
    { text: "收集 5 个补给", target: 5, kind: "supplies", value: 0 },
  ],
};

function zoneAt(x, y) {
  if (Math.hypot(x - 530, y - 430) < 330) return { id: "lake", name: "镜蓝湖岸" };
  if (Math.hypot(x - 1740, y - 360) < 360) return { id: "volcano", name: "赤岩火山坡" };
  if (x > 1320 && y > 760) return { id: "forest", name: "古木密林" };
  return { id: "grass", name: "星露草原" };
}

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function makeSpirit(index) {
  const data = species[index % species.length];
  let x = rand(120, world.width - 120);
  let y = rand(120, world.height - 120);
  for (let tries = 0; tries < 80 && zoneAt(x, y).id !== data.zone; tries += 1) {
    x = rand(120, world.width - 120);
    y = rand(120, world.height - 120);
  }
  return {
    ...data,
    x,
    y,
    r: data.rarity < 0.32 ? 19 : 16,
    vx: rand(-35, 35),
    vy: rand(-35, 35),
    phase: rand(0, Math.PI * 2),
    caught: false,
  };
}

function totalCaught() {
  return state.spirits.filter((spirit) => spirit.caught).length;
}

function setMessage(text) {
  messageTimer = 2.2;
  ui.hintText.textContent = text;
}

function updateSidePanel() {
  ui.ballCount.textContent = state.balls;
  ui.berryCount.textContent = state.berries;
  ui.dexCount.textContent = `${state.caught.size}/12`;
  ui.dexGrid.innerHTML = species
    .map((item) => {
      const caught = state.caught.has(item.name);
      return `<div class="dex-card ${caught ? "caught" : ""}"><i>${caught ? item.icon : "？"}</i><span>${caught ? item.name : "未发现"}</span></div>`;
    })
    .join("");
  ui.questList.innerHTML = state.quests
    .map((quest) => {
      const value =
        quest.kind === "caught" ? totalCaught() : quest.kind === "dex" ? state.caught.size : quest.value;
      return `<li><span>${quest.text}</span><b>${value >= quest.target ? "完成" : `${value}/${quest.target}`}</b></li>`;
    })
    .join("");
}

function resetGame() {
  state.player.x = 780;
  state.player.y = 760;
  state.balls = 18;
  state.berries = 3;
  state.caught = new Set();
  state.spirits = Array.from({ length: 30 }, (_, i) => makeSpirit(i));
  state.pickups = Array.from({ length: 18 }, () => ({
    x: rand(90, world.width - 90),
    y: rand(90, world.height - 90),
    type: Math.random() > 0.45 ? "ball" : "berry",
    taken: false,
  }));
  state.quests[2].value = 0;
  setMessage("新的冒险开始了");
  updateSidePanel();
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const scale = window.devicePixelRatio || 1;
  canvas.width = Math.max(640, Math.floor(rect.width * scale));
  canvas.height = Math.max(420, Math.floor(rect.height * scale));
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
}

function screenSize() {
  const scale = window.devicePixelRatio || 1;
  return { width: canvas.width / scale, height: canvas.height / scale };
}

function movePlayer(dt) {
  let dx = 0;
  let dy = 0;
  if (keys.has("arrowup") || keys.has("w") || touchDirs.has("up")) dy -= 1;
  if (keys.has("arrowdown") || keys.has("s") || touchDirs.has("down")) dy += 1;
  if (keys.has("arrowleft") || keys.has("a") || touchDirs.has("left")) dx -= 1;
  if (keys.has("arrowright") || keys.has("d") || touchDirs.has("right")) dx += 1;
  if (dx || dy) {
    const len = Math.hypot(dx, dy);
    dx /= len;
    dy /= len;
    state.player.dirX = dx;
    state.player.dirY = dy;
    state.player.x += dx * state.player.speed * dt;
    state.player.y += dy * state.player.speed * dt;
  }
  state.player.x = Math.max(34, Math.min(world.width - 34, state.player.x));
  state.player.y = Math.max(34, Math.min(world.height - 34, state.player.y));
}

function updateSpirits(dt) {
  for (const spirit of state.spirits) {
    if (spirit.caught) continue;
    spirit.phase += dt;
    spirit.x += (spirit.vx + Math.cos(spirit.phase) * 18) * dt;
    spirit.y += (spirit.vy + Math.sin(spirit.phase * 1.3) * 18) * dt;
    if (spirit.x < 60 || spirit.x > world.width - 60) spirit.vx *= -1;
    if (spirit.y < 60 || spirit.y > world.height - 60) spirit.vy *= -1;
    spirit.x = Math.max(60, Math.min(world.width - 60, spirit.x));
    spirit.y = Math.max(60, Math.min(world.height - 60, spirit.y));
  }
}

function updatePickups() {
  for (const item of state.pickups) {
    if (item.taken) continue;
    if (Math.hypot(item.x - state.player.x, item.y - state.player.y) < 38) {
      item.taken = true;
      if (item.type === "ball") {
        state.balls += 4;
        setMessage("捡到 4 个精灵球");
      } else {
        state.berries += 1;
        setMessage("捡到 1 个浆果");
      }
      state.quests[2].value += 1;
      updateSidePanel();
    }
  }
}

function updateCamera() {
  const size = screenSize();
  state.camera.x = Math.max(0, Math.min(world.width - size.width, state.player.x - size.width / 2));
  state.camera.y = Math.max(0, Math.min(world.height - size.height, state.player.y - size.height / 2));
}

function updateNearby() {
  let closest = null;
  let closestDist = Infinity;
  for (const spirit of state.spirits) {
    if (spirit.caught) continue;
    const dist = Math.hypot(spirit.x - state.player.x, spirit.y - state.player.y);
    if (dist < closestDist) {
      closest = spirit;
      closestDist = dist;
    }
  }
  state.nearby = closestDist < 115 ? closest : null;
  ui.focusType.textContent = state.nearby ? `${state.nearby.type}系精灵` : "发现精灵";
  ui.focusName.textContent = state.nearby ? state.nearby.name : "靠近目标";
}

function burst(x, y, color) {
  for (let i = 0; i < 18; i += 1) {
    particles.push({ x, y, vx: rand(-140, 140), vy: rand(-140, 140), life: rand(0.35, 0.75), color });
  }
}

function tryCatch() {
  if (!state.nearby) {
    setMessage("再靠近一点才能捕捉");
    return;
  }
  if (state.balls <= 0) {
    setMessage("精灵球用完了，去地图上找补给");
    return;
  }
  const spirit = state.nearby;
  state.balls -= 1;
  const distance = Math.hypot(spirit.x - state.player.x, spirit.y - state.player.y);
  const chance = Math.min(0.92, spirit.rarity + Math.max(0, (120 - distance) / 160) + (state.berries > 0 ? 0.12 : 0));
  if (state.berries > 0) state.berries -= 1;
  burst(spirit.x, spirit.y, spirit.color);
  if (Math.random() < chance) {
    spirit.caught = true;
    state.caught.add(spirit.name);
    setMessage(`捕捉成功：${spirit.name}`);
    setTimeout(() => state.spirits.push(makeSpirit(Math.floor(Math.random() * species.length))), 500);
  } else {
    spirit.vx += rand(-90, 90);
    spirit.vy += rand(-90, 90);
    setMessage(`${spirit.name}挣脱了`);
  }
  updateSidePanel();
}

function drawTerrain() {
  const size = screenSize();
  const cam = state.camera;
  ctx.clearRect(0, 0, size.width, size.height);
  ctx.fillStyle = "#21472f";
  ctx.fillRect(0, 0, size.width, size.height);
  [
    { x: 530, y: 430, r: 335, color: "#285e77", edge: "#5bbff5" },
    { x: 1740, y: 360, r: 365, color: "#69402e", edge: "#ff9260" },
    { x: 1660, y: 1080, r: 470, color: "#1c5138", edge: "#7dde83" },
  ].forEach((feature) => {
    ctx.beginPath();
    ctx.arc(feature.x - cam.x, feature.y - cam.y, feature.r, 0, Math.PI * 2);
    ctx.fillStyle = feature.color;
    ctx.fill();
    ctx.globalAlpha = 0.25;
    ctx.lineWidth = 5;
    ctx.strokeStyle = feature.edge;
    ctx.stroke();
    ctx.globalAlpha = 1;
  });
  ctx.strokeStyle = "rgba(247, 243, 232, 0.16)";
  ctx.lineWidth = 3;
  for (let x = -cam.x % 120; x < size.width; x += 120) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, size.height);
    ctx.stroke();
  }
  for (let y = -cam.y % 120; y < size.height; y += 120) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(size.width, y);
    ctx.stroke();
  }
  for (let i = 0; i < 90; i += 1) {
    const x = (i * 197) % world.width;
    const y = (i * 131 + 80) % world.height;
    if (Math.hypot(x - 530, y - 430) < 350 || Math.hypot(x - 1740, y - 360) < 380) continue;
    const sx = x - cam.x;
    const sy = y - cam.y;
    if (sx < -40 || sy < -40 || sx > size.width + 40 || sy > size.height + 40) continue;
    ctx.fillStyle = "#123021";
    ctx.fillRect(sx - 4, sy + 8, 8, 16);
    ctx.beginPath();
    ctx.arc(sx, sy, 18, 0, Math.PI * 2);
    ctx.fillStyle = i % 3 ? "#2f7b4a" : "#3b8f52";
    ctx.fill();
  }
}

function drawPickups() {
  const cam = state.camera;
  for (const item of state.pickups) {
    if (item.taken) continue;
    const x = item.x - cam.x;
    const y = item.y - cam.y;
    ctx.beginPath();
    ctx.arc(x, y, 10, 0, Math.PI * 2);
    ctx.fillStyle = item.type === "ball" ? "#f7f3e8" : "#ff6d83";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI);
    ctx.fillStyle = item.type === "ball" ? "#ff6d83" : "#7dde83";
    ctx.fill();
  }
}

function drawSpirits(time) {
  const cam = state.camera;
  for (const spirit of state.spirits) {
    if (spirit.caught) continue;
    const x = spirit.x - cam.x;
    const y = spirit.y - cam.y + Math.sin(time / 300 + spirit.phase) * 4;
    ctx.save();
    ctx.shadowColor = spirit.color;
    ctx.shadowBlur = spirit.rarity < 0.34 ? 22 : 12;
    ctx.beginPath();
    ctx.arc(x, y, spirit.r, 0, Math.PI * 2);
    ctx.fillStyle = spirit.color;
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = "#17201c";
    ctx.font = "bold 15px Microsoft YaHei, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(spirit.icon, x, y);
    if (state.nearby === spirit) {
      ctx.strokeStyle = "#f4d35e";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, spirit.r + 10, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

function drawPlayer() {
  const cam = state.camera;
  const x = state.player.x - cam.x;
  const y = state.player.y - cam.y;
  ctx.beginPath();
  ctx.arc(x, y, 18, 0, Math.PI * 2);
  ctx.fillStyle = "#f7f3e8";
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + state.player.dirX * 10, y + state.player.dirY * 10, 7, 0, Math.PI * 2);
  ctx.fillStyle = "#5bbff5";
  ctx.fill();
  ctx.strokeStyle = "#111518";
  ctx.lineWidth = 3;
  ctx.stroke();
}

function drawParticles(dt) {
  const cam = state.camera;
  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const p = particles[i];
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.life <= 0) {
      particles.splice(i, 1);
      continue;
    }
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.beginPath();
    ctx.arc(p.x - cam.x, p.y - cam.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function frame(now) {
  const dt = Math.min(0.033, (now - lastTime) / 1000);
  lastTime = now;
  movePlayer(dt);
  updateSpirits(dt);
  updatePickups();
  updateCamera();
  updateNearby();
  ui.zoneName.textContent = zoneAt(state.player.x, state.player.y).name;
  if (messageTimer > 0) {
    messageTimer -= dt;
  } else {
    ui.hintText.textContent = state.nearby ? `靠近了：${state.nearby.name}` : "寻找地图上的精灵和补给";
  }
  drawTerrain();
  drawPickups();
  drawSpirits(now);
  drawPlayer();
  drawParticles(dt);
  requestAnimationFrame(frame);
}

window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if (["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d", " "].includes(key)) {
    event.preventDefault();
  }
  if (key === " ") tryCatch();
  else keys.add(key);
});

window.addEventListener("keyup", (event) => keys.delete(event.key.toLowerCase()));
document.querySelectorAll("[data-dir]").forEach((button) => {
  const dir = button.dataset.dir;
  button.addEventListener("pointerdown", () => touchDirs.add(dir));
  button.addEventListener("pointerup", () => touchDirs.delete(dir));
  button.addEventListener("pointercancel", () => touchDirs.delete(dir));
  button.addEventListener("pointerleave", () => touchDirs.delete(dir));
});

ui.catchButton.addEventListener("click", tryCatch);
ui.touchCatch.addEventListener("click", tryCatch);
ui.resetButton.addEventListener("click", resetGame);
window.addEventListener("resize", resizeCanvas);

resizeCanvas();
resetGame();
requestAnimationFrame(frame);
