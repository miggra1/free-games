/**
 * Raiden II - Game Orchestration
 * Main game loop, state management, collision detection
 */

let gameState = "title";
let player, player2;
let pool = createBulletPool();
let enemies = [];
let stageTimer = 0;
let currentStage = 0;
let boss = null;
let bossWarning = 0;
let gameTimer = 0;
let highScore = parseInt(localStorage.getItem("raiden2-hi") || "0");
let bombEffect = null;
let shakeTimer = 0;
let scrollY = 0;
let stageClearing = false;

function resetGame() {
  player = createPlayer(W / 2, H - 120);
  player2 = null;
  pool = createBulletPool();
  enemies = [];
  items = [];
  explosions = [];
  stageTimer = 0;
  currentStage = 0;
  boss = null;
  bossWarning = 0;
  gameTimer = 0;
  bombEffect = null;
  shakeTimer = 0;
  scrollY = 0;
  stageClearing = false;
  STAGES[0].waves.forEach(w => w.done = false);
}

function startStage(stageIdx) {
  currentStage = stageIdx;
  stageTimer = 0;
  boss = null;
  bossWarning = 0;
  STAGES[stageIdx].waves.forEach(w => w.done = false);
}

function updateGame(dt) {
  if (gameState !== "playing") return;

  const stageData = STAGES[currentStage];
  gameTimer += dt;
  R.scrollY += SCROLL_SPEED * dt;
  scrollY += SCROLL_SPEED * dt;
  if (shakeTimer > 0) shakeTimer -= dt;

  // Stage timer (only advance if no boss)
  if (!boss || boss.dead) {
    stageTimer += dt;
  }

  // Boss warning
  for (const wave of stageData.waves) {
    if (!wave.done && wave.type === "boss" && wave.time - 2 < stageTimer) {
      bossWarning = Math.max(0, wave.time - stageTimer);
    }
  }

  // Spawn enemies
  const newEnemies = spawnWaves(stageData, stageTimer, scrollY);
  for (const e of newEnemies) {
    if (e.type === "boss" || e.size === "boss") boss = e;
    enemies.push(e);
  }

  // Update player
  const bombPressed = input.isJustPressed(KEY_BOMB);
  if (bombPressed && player.bombs > 0 && !player.dead && player.canBomb) {
    bombEffect = playerUseBomb(player, pool.enemyBullets);
    // Clear enemy bullets in blast radius
    pool.enemyBullets = pool.enemyBullets.filter(b => Math.hypot(b.x - bombEffect.x, b.y - bombEffect.y) > 200);
    // Damage all enemies on screen
    for (const e of enemies) {
      if (!e.dead && Math.hypot(e.x - bombEffect.x, e.y - bombEffect.y) < 200) {
        if (damageEnemy(e, 20)) {
          player.score += e.score;
          spawnItem(e.x, e.y);
          spawnExplosion(e.x, e.y, e.size === "large" ? "big" : "small");
        }
      }
    }
    shakeTimer = 0.3;
  }

  // Player weapon update
  const shotResult = updatePlayer(player, dt, input.isDown(KEY_SHOT), false, 500, enemies);
  if (shotResult) spawnPlayerBullets(pool, shotResult);

  // Update player timers
  if (player.canBomb === false) {
    player.bombTimer -= dt;
    if (player.bombTimer <= 0) player.canBomb = true;
  }
  if (R.flashAlpha > 0) R.flashAlpha = Math.max(0, R.flashAlpha - dt * 2);
  if (bombEffect) {
    bombEffect.radius = (bombEffect.radius || 50) + dt * 400;
    if (bombEffect.radius > 250) bombEffect = null;
  }

  // Update bullets
  updateBullets(pool, dt, enemies);

  // Update enemies
  for (const e of enemies) {
    if (e.size === "boss") { updateBoss(e, dt, player, pool, scrollY); continue; }
    updateEnemy(e, dt, scrollY, pool);
  }

  // Update items
  updateItems(dt, scrollY);

  // Update explosions
  updateExplosions(dt);

  // Collision: player bullets vs enemies
  for (let bi = pool.playerBullets.length - 1; bi >= 0; bi--) {
    const b = pool.playerBullets[bi];
    let hit = false;
    for (const e of enemies) {
      if (e.dead) continue;
      if (e.size === "boss" && Math.hypot(b.x - e.x, b.y - e.y) < 35) {
        if (damageEnemy(e, b.dmg)) {
          hit = true; break;
        }
      } else if (e.size !== "boss" && Math.hypot(b.x - e.x, b.y - e.y) < (e.size === "large" ? 24 : 14)) {
        if (damageEnemy(e, b.dmg)) {
          player.score += e.score;
          spawnItem(e.x, e.y);
          spawnExplosion(e.x, e.y, e.size === "large" ? "big" : "small");
          hit = true; break;
        }
      }
    }
    if (hit) {
      if (b.type === "laser") b.life = 0;
      else pool.playerBullets.splice(bi, 1);
    }
  }

  // Missile hits
  for (let mi = pool.playerMissiles.length - 1; mi >= 0; mi--) {
    const m = pool.playerMissiles[mi];
    let hit = false;
    for (const e of enemies) {
      if (e.dead) continue;
      if (Math.hypot(m.x - e.x, m.y - e.y) < (e.size === "boss" ? 30 : 18)) {
        const dmg = m.dmg || 3;
        if (damageEnemy(e, dmg)) {
          player.score += e.score;
          spawnItem(e.x, e.y);
          spawnExplosion(e.x, e.y, "big");
        }
        spawnExplosion(m.x, m.y, "small");
        pool.playerMissiles.splice(mi, 1);
        hit = true; break;
      }
    }
    if (!hit && m.y < -40) pool.playerMissiles.splice(mi, 1);
  }

  // Collision: enemy bullets vs player
  if (!player.dead && player.invincible <= 0) {
    for (let bi = pool.enemyBullets.length - 1; bi >= 0; bi--) {
      const b = pool.enemyBullets[bi];
      if (Math.hypot(b.x - player.x, b.y - player.y) < (PLAYER_HIT_R + 4)) {
        pool.enemyBullets.splice(bi, 1);
        if (playerHit(player)) {
          spawnExplosion(player.x, player.y, "big");
        }
        break;
      }
    }
    // Enemy body vs player
    for (const e of enemies) {
      if (e.dead || e.size === "boss") continue;
      if (Math.hypot(e.x - player.x, e.y - player.y) < 14) {
        if (playerHit(player)) {
          spawnExplosion(player.x, player.y, "big");
        }
        break;
      }
    }
  }

  // Item collection
  for (let i = items.length - 1; i >= 0; i--) {
    const it = items[i];
    if (!player.dead && Math.hypot(it.x - player.x, it.y - player.y) < 24) {
      playerCollectItem(player, it);
      items.splice(i, 1);
    }
  }

  // Cleanup dead enemies
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    if (e.dead && e.exploding !== undefined) {
      e.exploding -= dt;
      if (e.exploding <= 0) {
        if (e === boss) {
          // Boss defeated
          player.score += e.score;
          spawnExplosion(e.x, e.y, "boss");
          boss = null;
          stageClearing = true;
          SFX.stageClear();
          if (currentStage >= STAGES.length - 1) {
            // All stages clear
            setTimeout(() => { gameState = "gameover"; }, 3000);
          } else {
            setTimeout(() => {
              startStage(currentStage + 1);
              stageClearing = false;
            }, 4000);
          }
        }
        enemies.splice(i, 1);
      }
      continue;
    }
    if (e.dead && e.size !== "boss") enemies.splice(i, 1);
  }

  // Game over check
  if (player.dead && player.lives <= 0 && player.respawnTimer <= 0) {
    if (highScore < player.score) {
      highScore = player.score;
      localStorage.setItem("raiden2-hi", highScore);
    }
    gameState = "gameover";
  }

  // Shake
  if (shakeTimer > 0) {
    R.shakeX = (Math.random() - 0.5) * shakeTimer * 15;
    R.shakeY = (Math.random() - 0.5) * shakeTimer * 15;
  } else {
    R.shakeX = 0;
    R.shakeY = 0;
  }
}

function renderGame() {
  const ctx = R.ctx;
  ctx.save();
  ctx.translate(R.shakeX, R.shakeY);

  // Background
  ctx.fillStyle = R.bgColor();
  ctx.fillRect(0, 0, W, H);

  const stageData = STAGES[currentStage] || STAGES[0];
  R.drawStarfield();
  if (stageData.theme === 0) {
    R.drawOceanLayers();
    R.drawGroundLayer(0);
  } else {
    R.drawGroundLayer(1);
  }

  // Draw ground enemies (drawn before player for z-ordering)
  for (const e of enemies) {
    if (e.dead || (e.size !== "turret" && e.size !== "tank")) continue;
    if (e.size === "turret") R.drawGroundTurret(e.x, e.y, e.angle || 0);
    else R.drawGroundTank(e.x, e.y, e.angle || 0);
  }

  // Draw items
  for (const it of items) R.drawItem(it.x, it.y, it.type);

  // Draw air enemies
  for (const e of enemies) {
    if (e.dead || e.size === "turret" || e.size === "tank" || e.size === "boss") continue;
    const frame = Math.floor(Date.now() / 100);
    if (e.size === "small") R.drawSmallFighter(e.x, e.y, e.color, frame);
    else if (e.size === "medium") R.drawMediumEnemy(e.x, e.y, e.color, frame);
    else if (e.size === "large") R.drawLargeEnemy(e.x, e.y, e.parts, frame);
  }

  // Draw boss
  if (boss && !boss.dead) {
    R.drawLargeEnemy(boss.x, boss.y, boss.parts || { body: 1 }, Math.floor(Date.now() / 100));
    R.drawBossBar(boss.bossName, boss.hp, boss.maxHp);
  }

  // Draw explosions
  for (const ex of explosions) {
    const phase = 1 - ex.life / ex.maxLife;
    if (ex.size === "boss") R.drawBossExplosion(ex.x, ex.y, phase);
    else R.drawExplosion(ex.x, ex.y, 20 + (ex.size === "big" ? 15 : 0), 1 - phase, phase);
  }

  // Draw bomb effect
  if (bombEffect) {
    R.ctx.save();
    R.ctx.globalAlpha = 0.4;
    const r = bombEffect.radius;
    R.ctx.fillStyle = "#ffaa00";
    R.ctx.beginPath();
    R.ctx.arc(bombEffect.x, bombEffect.y, r, 0, Math.PI * 2);
    R.ctx.fill();
    R.ctx.globalAlpha = 1;
    R.ctx.restore();
  }

  // Draw bullets
  for (const b of pool.playerBullets) R.drawPlayerBullet(b.x, b.y, b.type, b.w || 0);
  for (const m of pool.playerMissiles) R.drawMissile(m.x, m.y, m.type || "straight");
  for (const b of pool.enemyBullets) R.drawEnemyBullet(b.x, b.y, b.type);

  // Draw player
  if (!player.dead) {
    R.drawPlayerShip(player.x, player.y,
      player.weapon === "laser" ? "#4488ff" : "#ffcc44",
      player.invincible > 0,
      player.tiltX);
  }

  // Boss warning overlay
  if (bossWarning > 0) R.drawWarning(Math.sin(Date.now() / 200) * 0.5 + 0.5);
  R.drawFlash();

  ctx.restore();

  // HUD (not affected by shake)
  R.drawHUD(player.score, highScore, Math.max(0, player.lives), player.bombs,
    player.weaponLevel, player.weapon === "laser" ? "#4488ff" : "#ffcc44");
}

function handleMenus() {
  if (gameState === "title" && input.isJustPressed(KEY_START)) {
    initAudio();
    resetGame();
    gameState = "playing";
    startStage(0);
  }
  if (gameState === "gameover" && input.isJustPressed(KEY_START)) {
    resetGame();
    gameState = "playing";
    startStage(0);
  }
  if (gameState === "playing" && input.isJustPressed(KEY_PAUSE)) {
    gameState = "pause";
  } else if (gameState === "pause" && input.isJustPressed(KEY_PAUSE)) {
    gameState = "playing";
  }
}
