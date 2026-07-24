/**
 * Raiden II - Enemies, Bullets, Items, Explosions
 */

function createBulletPool() {
  return { playerBullets: [], enemyBullets: [], playerMissiles: [] };
}

function spawnPlayerBullets(pool, bullets) {
  if (!bullets) return;
  if (Array.isArray(bullets)) {
    for (const b of bullets) pool.playerBullets.push({ ...b, life: b.type === "laser" ? 0.08 : 2 });
  } else if (bullets.missiles) {
    for (const m of bullets.missiles) pool.playerMissiles.push(m);
  }
}

function updateBullets(pool, dt, enemies) {
  // Player bullets
  for (let i = pool.playerBullets.length - 1; i >= 0; i--) {
    const b = pool.playerBullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (b.y < -10 || b.life <= 0) pool.playerBullets.splice(i, 1);
  }
  // Player missiles
  for (let i = pool.playerMissiles.length - 1; i >= 0; i--) {
    const m = pool.playerMissiles[i];
    if (m.target && !m.target.dead) {
      const dx = m.target.x - m.x;
      const dy = m.target.y - m.y;
      const a = Math.atan2(dy, dx);
      const ca = Math.atan2(-m.vy, -m.vx) || Math.PI / 2;
      let na = ca + Math.sign(Math.sin(a - ca)) * Math.min(Math.abs(a - ca), m.turnSpeed * dt);
      const spd = 200;
      m.vx = Math.cos(na) * spd;
      m.vy = -Math.abs(Math.sin(na) * spd) - 50;
    } else {
      m.vy = -250;
      m.vx *= 0.95;
    }
    m.x += m.vx * dt;
    m.y += m.vy * dt;
    m.life -= dt;
    if (m.y < -30 || m.life <= 0) pool.playerMissiles.splice(i, 1);
  }

  // Enemy bullets
  for (let i = pool.enemyBullets.length - 1; i >= 0; i--) {
    const b = pool.enemyBullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (b.y > H + 20 || b.y < -20 || b.x < -20 || b.x > W + 20) {
      pool.enemyBullets.splice(i, 1);
    }
  }
}

// ── Enemy Factory ──
function spawnEnemy(wave, scrollY) {
  const base = { x: wave.x, y: wave.y + scrollY - H, dead: false, hp: 1, score: 50, parts: null };
  switch (wave.type) {
    case "small":
      return { ...base, hp: 1, score: 50, color: wave.color || "#5a5", size: "small" };
    case "medium":
      return { ...base, hp: 3, score: 150, color: wave.color || "#a55", size: "medium" };
    case "large":
      return { ...base, hp: 15, score: 500, color: "#aa8833", size: "large",
        parts: { body: 15, turretL: 8, turretR: 8 } };
    case "turret":
      return { ...base, hp: 4, score: 200, color: "#555", angle: wave.angle || 0, size: "turret" };
    case "tank":
      return { ...base, hp: 6, score: 250, color: "#4a4a3a", angle: wave.angle || 0, size: "tank" };
    case "boss":
      return { ...base, x: W / 2, y: H * 0.35, hp: 300, maxHp: 300, score: 10000, color: "#887755",
        size: "boss", bossPhase: 0, bossTimer: 0, bossName: wave.name || "BOSS" };
    case "formation":
      return wave.data.map(d => ({ ...base, x: d.x, y: d.y + scrollY - H, hp: 1, score: 50,
        color: wave.color || "#5a5", size: "small" }));
  }
}

function updateEnemy(e, dt, scrollY, pool) {
  if (e.dead) return;
  e.y += SCROLL_SPEED * dt;
  if (e.vy) e.y += e.vy * dt;
  if (e.vx) { e.x += e.vx * dt; if (e.x < 10 || e.x > W - 10) e.vx *= -1; }
  if (e.y > H + 50) e.dead = true;

  // Enemy AI - fire bullets
  if (e.fireRate && e.fireTimer !== undefined) {
    e.fireTimer -= dt;
    if (e.fireTimer <= 0) {
      e.fireTimer = e.fireRate;
      SFX.enemyShot();
      if (e.firePattern === "aimed") {
        const a = Math.atan2(120 - e.y, (W / 2 + Math.sin(Date.now() / 1000) * 100) - e.x);
        pool.enemyBullets.push({ x: e.x, y: e.y + 12, vx: Math.cos(a) * 150, vy: Math.sin(a) * 200, type: "round" });
      } else if (e.firePattern === "spread") {
        for (let i = 0; i < 5; i++) {
          const a = Math.PI / 2 + (i - 2) * 0.25;
          pool.enemyBullets.push({ x: e.x, y: e.y + 12, vx: Math.cos(a) * 100, vy: Math.sin(a) * 180, type: "round" });
        }
      } else if (e.firePattern === "radial") {
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2 + e.fireAngle;
          pool.enemyBullets.push({ x: e.x, y: e.y, vx: Math.cos(a) * 120, vy: Math.sin(a) * 120, type: "arrow" });
        }
        e.fireAngle = (e.fireAngle || 0) + 0.4;
      } else {
        pool.enemyBullets.push({ x: e.x, y: e.y + 10, vx: 0, vy: 180, type: "round" });
      }
    }
  }
}

function damageEnemy(e, dmg) {
  if (e.dead) return false;
  e.hp -= dmg;
  if (e.hp <= 0) {
    e.dead = true;
    e.exploding = 0.5;
    if (e.size === "small") SFX.smallExplosion();
    else if (e.size === "medium") SFX.mediumExplosion();
    else if (e.size === "large") SFX.bigExplosion();
    else SFX.smallExplosion();
    return true;
  }
  return false;
}

// ── Boss Logic ──
function updateBoss(boss, dt, player, pool, scrollY) {
  if (boss.dead) return;
  boss.bossTimer += dt;

  // Entry: move to position
  if (boss.bossPhase === 0) {
    const targetY = H * 0.25;
    if (boss.y < targetY) { boss.y += 40 * dt; }
    else { boss.bossPhase = 1; boss.bossTimer = 0; }
  }

  // Attack patterns
  if (boss.bossPhase === 1) {
    // Aimed shots every 0.4s
    if (boss.bossTimer % 0.4 < dt) {
      for (let i = 0; i < 3; i++) {
        const a = Math.atan2(player.y - boss.y, player.x - boss.x) + (i - 1) * 0.15;
        pool.enemyBullets.push({
          x: boss.x + (i - 1) * 30, y: boss.y + 30,
          vx: Math.cos(a) * 200, vy: Math.sin(a) * 200, type: "round"
        });
      }
      SFX.enemyShot();
    }
    // Spread every 2s
    if (boss.bossTimer > 1 && boss.bossTimer % 2 < dt) {
      for (let i = 0; i < 9; i++) {
        const a = Math.PI / 2 + (i - 4) * 0.2;
        pool.enemyBullets.push({
          x: boss.x, y: boss.y + 20,
          vx: Math.cos(a) * (80 + i * 10), vy: Math.sin(a) * (150 + Math.abs(i - 4) * 15), type: "round"
        });
      }
      SFX.enemyShot();
    }
    // Phase 2 at half HP
    if (boss.hp < boss.maxHp * 0.5) {
      boss.bossPhase = 2;
      boss.bossTimer = 0;
      boss.fireRate = 0.3;
      boss.firePattern = "radial";
      boss.fireAngle = 0;
      boss.fireTimer = 0.3;
    }
  }

  if (boss.bossPhase === 2) {
    // Additional radial bursts
    if (boss.bossTimer % 1.5 < dt) {
      for (let r = 0; r < 3; r++) {
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2 + r * 0.4;
          pool.enemyBullets.push({
            x: boss.x, y: boss.y,
            vx: Math.cos(a) * (60 + r * 30), vy: Math.sin(a) * (60 + r * 30), type: "large"
          });
        }
      }
      SFX.enemyShot();
    }
    // Critical HP - faster
    if (boss.hp < boss.maxHp * 0.2) {
      boss.fireRate = 0.15;
    }
  }

  // Keep boss in view
  if (boss.y < H * 0.18) boss.y += 20 * dt;
}

// ── Items ──
let items = [];
function spawnItem(x, y) {
  const r = Math.random();
  if (r < 0.25) items.push({ x, y, type: "P", vy: 60 });
  else if (r < 0.35) items.push({ x, y, type: "B", vy: 50 });
  else if (r < 0.45) items.push({ x, y, type: "M", vy: 50, subType: Math.random() < 0.6 ? "homing" : "straight" });
  else if (r < 0.50) items.push({ x, y, type: "F", vy: 70 });
  else if (r < 0.52 && Math.random() < 0.05) items.push({ x, y, type: "1UP", vy: 80 });
  else items.push({ x, y, type: "medal", vy: 40, value: 100 });
}

function updateItems(dt, scrollY) {
  for (let i = items.length - 1; i >= 0; i--) {
    const it = items[i];
    it.y += it.vy * dt + SCROLL_SPEED * dt;
    if (it.y > H + 20) items.splice(i, 1);
  }
}

// ── Explosions ──
let explosions = [];
function spawnExplosion(x, y, size) {
  explosions.push({ x, y, size, life: size === "big" ? 0.8 : size === "boss" ? 2 : 0.4, maxLife: size === "boss" ? 2 : 0.4 });
}
function updateExplosions(dt) {
  for (let i = explosions.length - 1; i >= 0; i--) {
    explosions[i].life -= dt;
    if (explosions[i].life <= 0) explosions.splice(i, 1);
  }
}
