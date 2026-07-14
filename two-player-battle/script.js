const canvas = document.querySelector("#arena");
const ctx = canvas.getContext("2d");
const messageEl = document.querySelector("#message");
const p1ScoreEl = document.querySelector("#p1Score");
const p2ScoreEl = document.querySelector("#p2Score");
const p1HpEl = document.querySelector("#p1Hp");
const p2HpEl = document.querySelector("#p2Hp");
const restartBtn = document.querySelector("#restartBtn");

const keys = new Set();
const maxHp = 100;
const roundWins = 5;

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
  if (game) keepPlayersInside();
}

function w() {
  return canvas.w || canvas.clientWidth || 960;
}

function h() {
  return canvas.h || canvas.clientHeight || 560;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function makePlayer(id, x, color, controls) {
  return {
    id,
    x,
    y: h() / 2,
    radius: 24,
    color,
    hp: maxHp,
    score: 0,
    speed: 250,
    angle: id === 1 ? 0 : Math.PI,
    cooldown: 0,
    invincible: 0,
    controls,
  };
}

function newGame(keepScore = false) {
  const score1 = keepScore && game ? game.p1.score : 0;
  const score2 = keepScore && game ? game.p2.score : 0;
  game = {
    state: "ready",
    time: 0,
    winner: null,
    shake: 0,
    bullets: [],
    sparks: [],
    obstacles: [],
    p1: makePlayer(1, w() * 0.22, "#f05b55", {
      up: "KeyW",
      down: "KeyS",
      left: "KeyA",
      right: "KeyD",
      fire: "KeyF",
    }),
    p2: makePlayer(2, w() * 0.78, "#4aa7ff", {
      up: "ArrowUp",
      down: "ArrowDown",
      left: "ArrowLeft",
      right: "ArrowRight",
      fire: "1",
      altFire: "+",
      extraFire: ["Digit1", "Numpad1", "NumpadAdd", "Equal"],
    }),
  };
  game.p1.score = score1;
  game.p2.score = score2;
  buildObstacles();
  updateHud();
}

function buildObstacles() {
  const centerX = w() / 2;
  const centerY = h() / 2;
  game.obstacles = [
    { x: centerX - 20, y: centerY - 92, width: 40, height: 120 },
    { x: centerX - 20, y: centerY + 38, width: 40, height: 120 },
    { x: centerX - 150, y: centerY - 18, width: 90, height: 36 },
    { x: centerX + 60, y: centerY - 18, width: 90, height: 36 },
  ];
}

function keepPlayersInside() {
  for (const player of [game.p1, game.p2]) {
    player.x = clamp(player.x, playerMinX(player), playerMaxX(player));
    player.y = clamp(player.y, player.radius + 8, h() - player.radius - 8);
  }
  buildObstacles();
}

function playerMinX(player) {
  const center = w() / 2;
  return player.id === 1 ? player.radius + 8 : center + player.radius + 4;
}

function playerMaxX(player) {
  const center = w() / 2;
  return player.id === 1 ? center - player.radius - 4 : w() - player.radius - 8;
}

function pressed(code, altCode, extraCodes = []) {
  return keys.has(code) || (altCode && keys.has(altCode)) || extraCodes.some((extraCode) => keys.has(extraCode));
}

function movePlayer(player, delta) {
  let dx = 0;
  let dy = 0;
  if (pressed(player.controls.left)) dx -= 1;
  if (pressed(player.controls.right)) dx += 1;
  if (pressed(player.controls.up)) dy -= 1;
  if (pressed(player.controls.down)) dy += 1;

  if (dx || dy) {
    const length = Math.hypot(dx, dy);
    dx /= length;
    dy /= length;
    player.angle = Math.atan2(dy, dx);
    player.x += dx * player.speed * delta;
    player.y += dy * player.speed * delta;
    player.x = clamp(player.x, playerMinX(player), playerMaxX(player));
    player.y = clamp(player.y, player.radius + 8, h() - player.radius - 8);
    resolveObstacleCollision(player);
    player.x = clamp(player.x, playerMinX(player), playerMaxX(player));
  }
}

function resolveObstacleCollision(player) {
  for (const wall of game.obstacles) {
    const nearestX = clamp(player.x, wall.x, wall.x + wall.width);
    const nearestY = clamp(player.y, wall.y, wall.y + wall.height);
    const dx = player.x - nearestX;
    const dy = player.y - nearestY;
    const distance = Math.hypot(dx, dy);
    if (distance < player.radius) {
      const push = player.radius - distance + 0.2;
      if (distance === 0) {
        player.x += player.x < wall.x + wall.width / 2 ? -push : push;
      } else {
        player.x += (dx / distance) * push;
        player.y += (dy / distance) * push;
      }
    }
  }
}

function shoot(player) {
  const firePressed = pressed(player.controls.fire, player.controls.altFire, player.controls.extraFire);
  if (!firePressed || player.cooldown > 0) return;

  player.cooldown = 0.34;
  const speed = 560;
  const muzzle = player.radius + 13;
  game.bullets.push({
    owner: player.id,
    x: player.x + Math.cos(player.angle) * muzzle,
    y: player.y + Math.sin(player.angle) * muzzle,
    vx: Math.cos(player.angle) * speed,
    vy: Math.sin(player.angle) * speed,
    radius: 6,
    life: 1.25,
    bounces: 0,
    color: player.color,
  });
}

function hitPlayer(player, bullet) {
  if (player.id === bullet.owner || player.invincible > 0) return false;
  return Math.hypot(player.x - bullet.x, player.y - bullet.y) < player.radius + bullet.radius;
}

function bounceBullet(bullet) {
  const radius = bullet.radius;

  if (bullet.x - radius < 0) {
    bullet.x = radius;
    bullet.vx = Math.abs(bullet.vx);
    return true;
  }
  if (bullet.x + radius > w()) {
    bullet.x = w() - radius;
    bullet.vx = -Math.abs(bullet.vx);
    return true;
  }
  if (bullet.y - radius < 0) {
    bullet.y = radius;
    bullet.vy = Math.abs(bullet.vy);
    return true;
  }
  if (bullet.y + radius > h()) {
    bullet.y = h() - radius;
    bullet.vy = -Math.abs(bullet.vy);
    return true;
  }

  for (const wall of game.obstacles) {
    if (
      bullet.x > wall.x &&
      bullet.x < wall.x + wall.width &&
      bullet.y > wall.y &&
      bullet.y < wall.y + wall.height
    ) {
      const left = Math.abs(bullet.x - wall.x);
      const right = Math.abs(wall.x + wall.width - bullet.x);
      const top = Math.abs(bullet.y - wall.y);
      const bottom = Math.abs(wall.y + wall.height - bullet.y);
      const min = Math.min(left, right, top, bottom);

      if (min === left) {
        bullet.x = wall.x - radius;
        bullet.vx = -Math.abs(bullet.vx);
      } else if (min === right) {
        bullet.x = wall.x + wall.width + radius;
        bullet.vx = Math.abs(bullet.vx);
      } else if (min === top) {
        bullet.y = wall.y - radius;
        bullet.vy = -Math.abs(bullet.vy);
      } else {
        bullet.y = wall.y + wall.height + radius;
        bullet.vy = Math.abs(bullet.vy);
      }
      return true;
    }
  }

  return false;
}

function addSparks(x, y, color, amount = 12) {
  for (let i = 0; i < amount; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 70 + Math.random() * 240;
    game.sparks.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.25 + Math.random() * 0.35,
      color,
    });
  }
}

function damage(player, amount, sourceColor) {
  player.hp = Math.max(0, player.hp - amount);
  player.invincible = 0.18;
  game.shake = 8;
  addSparks(player.x, player.y, sourceColor, 18);

  if (player.hp <= 0) {
    const winner = player.id === 1 ? game.p2 : game.p1;
    winner.score += 1;
    game.winner = winner.id;
    game.state = winner.score >= roundWins ? "matchOver" : "roundOver";
    game.roundTimer = 1.35;
    addSparks(player.x, player.y, "#f0c86a", 34);
  }
}

function update(delta) {
  if (game.state === "ready" && keys.size > 0) {
    game.state = "playing";
  }

  if (game.state === "playing") {
    game.time += delta;
    for (const player of [game.p1, game.p2]) {
      player.cooldown = Math.max(0, player.cooldown - delta);
      player.invincible = Math.max(0, player.invincible - delta);
      movePlayer(player, delta);
      shoot(player);
    }

    for (const bullet of game.bullets) {
      bullet.x += bullet.vx * delta;
      bullet.y += bullet.vy * delta;
      bullet.life -= delta;

      if (hitPlayer(game.p1, bullet)) {
        bullet.life = 0;
        damage(game.p1, 20, bullet.color);
      } else if (hitPlayer(game.p2, bullet)) {
        bullet.life = 0;
        damage(game.p2, 20, bullet.color);
      }

      if (bullet.life > 0 && bounceBullet(bullet)) {
        if (bullet.bounces < 1) {
          bullet.bounces += 1;
          addSparks(bullet.x, bullet.y, bullet.color, 6);
        } else {
          bullet.life = 0;
          addSparks(bullet.x, bullet.y, bullet.color, 8);
        }
      }
    }

    game.bullets = game.bullets.filter((bullet) => bullet.life > 0);
  } else if (game.state === "roundOver") {
    game.roundTimer -= delta;
    if (game.roundTimer <= 0) {
      newGame(true);
      game.state = "playing";
    }
  }

  for (const spark of game.sparks) {
    spark.life -= delta;
    spark.x += spark.vx * delta;
    spark.y += spark.vy * delta;
    spark.vx *= 0.94;
    spark.vy *= 0.94;
  }
  game.sparks = game.sparks.filter((spark) => spark.life > 0);
  game.shake = Math.max(0, game.shake - delta * 40);
  updateHud();
}

function updateHud() {
  p1ScoreEl.textContent = game.p1.score;
  p2ScoreEl.textContent = game.p2.score;
  p1HpEl.style.width = `${game.p1.hp}%`;
  p2HpEl.style.width = `${game.p2.hp}%`;

  if (game.state === "ready") {
    messageEl.textContent = "按任意操作开始";
  } else if (game.state === "roundOver") {
    messageEl.textContent = `玩家 ${game.winner} 赢下本回合`;
  } else if (game.state === "matchOver") {
    messageEl.textContent = `玩家 ${game.winner} 获胜！点重新开始`;
  } else {
    messageEl.textContent = "先拿 5 分获胜";
  }
}

function drawFloor() {
  const width = w();
  const height = h();
  ctx.fillStyle = "#282d34";
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "rgba(255,255,255,0.055)";
  ctx.lineWidth = 1;
  for (let x = 0; x < width; x += 48) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y < height; y += 48) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  ctx.strokeStyle = "rgba(240, 200, 106, 0.25)";
  ctx.lineWidth = 3;
  ctx.setLineDash([14, 14]);
  ctx.beginPath();
  ctx.moveTo(width / 2, 0);
  ctx.lineTo(width / 2, height);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawObstacles() {
  for (const wall of game.obstacles) {
    ctx.fillStyle = "#1b1e24";
    roundRect(wall.x, wall.y, wall.width, wall.height, 8);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.13)";
    ctx.stroke();
  }
}

function drawPlayer(player) {
  const flicker = player.invincible > 0 && Math.floor(performance.now() / 45) % 2 === 0;
  if (flicker) return;

  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(player.angle);

  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.beginPath();
  ctx.ellipse(2, 5, player.radius * 1.1, player.radius * 0.86, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = player.color;
  ctx.beginPath();
  ctx.arc(0, 0, player.radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#f5f2ea";
  ctx.fillRect(4, -7, player.radius + 14, 14);
  ctx.fillStyle = "#171717";
  ctx.fillRect(player.radius + 12, -4, 12, 8);

  ctx.rotate(-player.angle);
  ctx.fillStyle = "#171717";
  ctx.font = "800 16px Microsoft YaHei, Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(player.id, 0, 0);
  ctx.restore();
}

function drawBullets() {
  for (const bullet of game.bullets) {
    ctx.fillStyle = bullet.color;
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.beginPath();
    ctx.arc(bullet.x - 2, bullet.y - 2, bullet.radius * 0.35, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawSparks() {
  for (const spark of game.sparks) {
    ctx.globalAlpha = Math.max(0, spark.life * 2);
    ctx.fillStyle = spark.color;
    ctx.fillRect(spark.x - 2, spark.y - 2, 4, 4);
  }
  ctx.globalAlpha = 1;
}

function drawOverlay() {
  if (game.state === "playing" || game.state === "roundOver") return;
  ctx.fillStyle = "rgba(10, 12, 15, 0.54)";
  ctx.fillRect(0, 0, w(), h());
  ctx.textAlign = "center";
  ctx.fillStyle = "#f5f2ea";
  ctx.font = "800 38px Microsoft YaHei, Arial";
  ctx.fillText(game.state === "matchOver" ? `玩家 ${game.winner} 获胜` : "双人竞技场", w() / 2, h() * 0.42);
  ctx.fillStyle = "#d5d8dd";
  ctx.font = "16px Microsoft YaHei, Arial";
  ctx.fillText(game.state === "matchOver" ? "点击重新开始再战一局" : "移动躲避，瞄准射击，先拿 5 分", w() / 2, h() * 0.5);
}

function roundRect(x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function draw() {
  ctx.clearRect(0, 0, w(), h());
  ctx.save();
  if (game.shake > 0) {
    ctx.translate((Math.random() - 0.5) * game.shake, (Math.random() - 0.5) * game.shake);
  }
  drawFloor();
  drawObstacles();
  drawBullets();
  drawPlayer(game.p1);
  drawPlayer(game.p2);
  drawSparks();
  ctx.restore();
  drawOverlay();
}

function frame(now) {
  const delta = Math.min(0.035, (now - lastTime) / 1000 || 0);
  lastTime = now;
  update(delta);
  draw();
  requestAnimationFrame(frame);
}

window.addEventListener("keydown", (event) => {
  keys.add(event.code);
  keys.add(event.key);
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space", "NumpadAdd", "Equal"].includes(event.code) || event.key === "+") {
    event.preventDefault();
  }
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.code);
  keys.delete(event.key);
});

restartBtn.addEventListener("click", () => {
  keys.clear();
  newGame(false);
});

window.addEventListener("resize", resizeCanvas);

resizeCanvas();
newGame(false);
requestAnimationFrame(frame);
