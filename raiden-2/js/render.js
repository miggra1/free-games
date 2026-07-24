/**
 * Raiden II - Renderer
 * All drawing: sprites, HUD, background, effects
 */

const R = {
  ctx: null,
  flashAlpha: 0,
  shakeX: 0, shakeY: 0,
  scrollY: 0,

  init(ctx) { R.ctx = ctx; },

  bgColor() { return "#0a0a12"; },

  // ── Background ──
  drawStarfield() {
    for (let i = 0; i < 60; i++) {
      const y = ((i * 73 + R.scrollY * 0.3) % H + H) % H;
      const x = (i * 137 + 50) % W;
      const size = (i % 3) + 1;
      const alpha = 0.3 + (i % 3) * 0.2;
      R.ctx.globalAlpha = alpha;
      R.ctx.fillStyle = "#fff";
      R.ctx.fillRect(x, y, size, size);
      R.ctx.globalAlpha = 1;
    }
  },

  drawOceanLayers() {
    for (let layer = 0; layer < 3; layer++) {
      const speed = 0.6 + layer * 0.3;
      const alpha = 0.06 + layer * 0.03;
      R.ctx.globalAlpha = alpha;
      R.ctx.fillStyle = layer === 0 ? "#1a3a5c" : layer === 1 ? "#0d2840" : "#071828";
      for (let i = 0; i < 12; i++) {
        const y = ((i * 65 + R.scrollY * speed) % H + H) % H - 40;
        R.ctx.fillRect(0, y, W, 38 - layer * 8);
      }
      R.ctx.globalAlpha = 1;
    }
  },

  drawGroundLayer(theme) {
    R.ctx.globalAlpha = 0.08;
    if (theme === 0) {
      // Ocean islands
      R.ctx.fillStyle = "#2a4a20";
      for (let i = 0; i < 6; i++) {
        const y = ((i * 180 + R.scrollY * 0.4) % H + H) % H;
        R.ctx.fillRect(30 + (i * 70) % 300, y, 80, 12);
        R.ctx.fillRect(50 + (i * 70) % 300, y - 6, 40, 6);
      }
    } else if (theme === 1) {
      // Base
      R.ctx.fillStyle = "#3a3a2a";
      for (let i = 0; i < 4; i++) {
        const y = ((i * 250 + R.scrollY * 0.5) % H + H) % H;
        R.ctx.fillRect(20, y, W - 40, 20);
        R.ctx.fillStyle = "#555";
        R.ctx.fillRect(W / 2 - 40, y - 30, 80, 30);
        R.ctx.fillStyle = "#3a3a2a";
      }
    }
    R.ctx.globalAlpha = 1;
  },

  // ── Player Sprite ──
  drawPlayerShip(x, y, weaponColor, invincible, tiltX) {
    const t = Math.sin(Date.now() / 60) * 0.5;
    R.ctx.save();
    R.ctx.translate(x, y);
    R.ctx.rotate(tiltX * 0.15);

    if (invincible && Math.floor(Date.now() / 80) % 2 === 0) {
      R.ctx.globalAlpha = 0.4;
    }

    // Engine glow
    R.ctx.fillStyle = "#ff6622";
    R.ctx.beginPath();
    R.ctx.moveTo(-5, 14); R.ctx.lineTo(5, 14);
    R.ctx.lineTo(0, 18 + t * 3); R.ctx.closePath(); R.ctx.fill();
    R.ctx.fillStyle = "#ffaa44";
    R.ctx.beginPath();
    R.ctx.moveTo(-3, 13); R.ctx.lineTo(3, 13);
    R.ctx.lineTo(0, 16 + t * 2); R.ctx.closePath(); R.ctx.fill();

    // Fuselage
    const bodyGrad = R.ctx.createLinearGradient(0, -10, 0, 14);
    bodyGrad.addColorStop(0, "#ddd");
    bodyGrad.addColorStop(0.3, "#ccc");
    bodyGrad.addColorStop(0.5, "#999");
    bodyGrad.addColorStop(1, "#555");
    R.ctx.fillStyle = bodyGrad;
    R.ctx.beginPath();
    R.ctx.moveTo(0, -12);
    R.ctx.lineTo(6, -6); R.ctx.lineTo(10, 0);
    R.ctx.lineTo(14, 8); R.ctx.lineTo(10, 12);
    R.ctx.lineTo(-10, 12); R.ctx.lineTo(-14, 8);
    R.ctx.lineTo(-10, 0); R.ctx.lineTo(-6, -6);
    R.ctx.closePath(); R.ctx.fill();

    // Panel lines
    R.ctx.strokeStyle = "#444";
    R.ctx.lineWidth = 1;
    R.ctx.beginPath(); R.ctx.moveTo(0, -8); R.ctx.lineTo(0, 6); R.ctx.stroke();
    R.ctx.beginPath(); R.ctx.moveTo(-7, 4); R.ctx.lineTo(7, 4); R.ctx.stroke();

    // Wings
    R.ctx.fillStyle = "#bbb";
    R.ctx.beginPath();
    R.ctx.moveTo(-10, 0); R.ctx.lineTo(-18, 5); R.ctx.lineTo(-12, 8); R.ctx.closePath(); R.ctx.fill();
    R.ctx.beginPath();
    R.ctx.moveTo(10, 0); R.ctx.lineTo(18, 5); R.ctx.lineTo(12, 8); R.ctx.closePath(); R.ctx.fill();

    // Cockpit
    R.ctx.fillStyle = "#4488cc";
    R.ctx.beginPath();
    R.ctx.ellipse(0, -4, 4, 5, 0, 0, Math.PI * 2); R.ctx.fill();
    R.ctx.fillStyle = "rgba(255,255,255,0.5)";
    R.ctx.beginPath();
    R.ctx.ellipse(-1, -5, 1.5, 2, 0, 0, Math.PI * 2); R.ctx.fill();

    // Weapon indicator
    R.ctx.fillStyle = weaponColor;
    R.ctx.beginPath();
    R.ctx.arc(0, 0, 3, 0, Math.PI * 2); R.ctx.fill();

    // Hitbox (tiny core)
    R.ctx.strokeStyle = "rgba(255,255,255,0.3)";
    R.ctx.lineWidth = 1;
    R.ctx.beginPath();
    R.ctx.arc(0, 0, 5, 0, Math.PI * 2); R.ctx.stroke();

    R.ctx.globalAlpha = 1;
    R.ctx.restore();
  },

  // ── Enemy Sprites ──
  drawSmallFighter(x, y, color, frame) {
    R.ctx.save(); R.ctx.translate(x, y);
    R.ctx.fillStyle = color;
    R.ctx.beginPath();
    R.ctx.moveTo(0, 8); R.ctx.lineTo(7, -3); R.ctx.lineTo(3, -8);
    R.ctx.lineTo(0, -5); R.ctx.lineTo(-3, -8);
    R.ctx.lineTo(-7, -3); R.ctx.closePath(); R.ctx.fill();
    R.ctx.fillStyle = "#333";
    R.ctx.beginPath();
    R.ctx.ellipse(0, 0, 2, 2, 0, 0, Math.PI * 2); R.ctx.fill();
    // Wing guns
    if (frame % 30 < 4) {
      R.ctx.fillStyle = "#ff0";
      R.ctx.fillRect(-7, -4, 2, 3);
      R.ctx.fillRect(5, -4, 2, 3);
    }
    R.ctx.restore();
  },

  drawMediumEnemy(x, y, color, frame) {
    R.ctx.save(); R.ctx.translate(x, y);
    // Body
    const grad = R.ctx.createLinearGradient(0, -15, 0, 15);
    grad.addColorStop(0, color);
    grad.addColorStop(1, "#222");
    R.ctx.fillStyle = grad;
    R.ctx.beginPath();
    R.ctx.moveTo(0, -15);
    R.ctx.lineTo(14, -5); R.ctx.lineTo(18, 5);
    R.ctx.lineTo(12, 14); R.ctx.lineTo(-12, 14);
    R.ctx.lineTo(-18, 5); R.ctx.lineTo(-14, -5);
    R.ctx.closePath(); R.ctx.fill();
    // Panels
    R.ctx.strokeStyle = "#444";
    R.ctx.lineWidth = 1;
    R.ctx.beginPath(); R.ctx.moveTo(0, -10); R.ctx.lineTo(0, 8); R.ctx.stroke();
    R.ctx.beginPath(); R.ctx.moveTo(-8, 2); R.ctx.lineTo(8, 2); R.ctx.stroke();
    // Cockpit
    R.ctx.fillStyle = "#c44";
    R.ctx.beginPath();
    R.ctx.ellipse(0, -6, 5, 4, 0, 0, Math.PI * 2); R.ctx.fill();
    R.ctx.restore();
  },

  drawLargeEnemy(x, y, parts, frame) {
    // Main body
    R.ctx.save(); R.ctx.translate(x, y);
    if (parts.body > 0) {
      const grad = R.ctx.createLinearGradient(0, -25, 0, 25);
      grad.addColorStop(0, "#7a6a4a");
      grad.addColorStop(1, "#3a2a1a");
      R.ctx.fillStyle = grad;
      R.ctx.beginPath();
      R.ctx.moveTo(0, -25);
      R.ctx.lineTo(22, -10); R.ctx.lineTo(28, 10);
      R.ctx.lineTo(18, 24); R.ctx.lineTo(-18, 24);
      R.ctx.lineTo(-28, 10); R.ctx.lineTo(-22, -10);
      R.ctx.closePath(); R.ctx.fill();
      R.ctx.fillStyle = "#555";
      R.ctx.beginPath(); R.ctx.ellipse(0, -8, 7, 5, 0, 0, Math.PI * 2); R.ctx.fill();
    }
    // Turret left
    if (parts.turretL > 0) {
      R.ctx.fillStyle = "#665";
      R.ctx.fillRect(-32, -8, 14, 14);
      R.ctx.fillStyle = "#aa4";
      R.ctx.beginPath(); R.ctx.arc(-28, -2, 6, 0, Math.PI * 2); R.ctx.fill();
    }
    // Turret right
    if (parts.turretR > 0) {
      R.ctx.fillStyle = "#665";
      R.ctx.fillRect(18, -8, 14, 14);
      R.ctx.fillStyle = "#aa4";
      R.ctx.beginPath(); R.ctx.arc(22, -2, 6, 0, Math.PI * 2); R.ctx.fill();
    }
    R.ctx.restore();
  },

  drawGroundTurret(x, y, angle) {
    R.ctx.save(); R.ctx.translate(x, y);
    // Base
    R.ctx.fillStyle = "#555";
    R.ctx.fillRect(-10, -8, 20, 16);
    // Barrel
    R.ctx.save(); R.ctx.rotate(angle);
    R.ctx.fillStyle = "#333";
    R.ctx.fillRect(-3, -14, 6, 14);
    R.ctx.restore();
    R.ctx.restore();
  },

  drawGroundTank(x, y, angle) {
    R.ctx.save(); R.ctx.translate(x, y);
    R.ctx.fillStyle = "#4a4a3a";
    R.ctx.fillRect(-8, -12, 16, 12);
    R.ctx.fillRect(-14, -6, 28, 6);
    R.ctx.save(); R.ctx.rotate(angle);
    R.ctx.fillStyle = "#333";
    R.ctx.fillRect(-3, -16, 6, 14);
    R.ctx.restore();
    R.ctx.restore();
  },

  // ── Bullets ──
  drawPlayerBullet(x, y, type, power) {
    R.ctx.save();
    if (type === "vulcan") {
      R.ctx.fillStyle = "#ffcc44";
      R.ctx.shadowColor = "#ff8800";
      R.ctx.shadowBlur = 6;
      R.ctx.beginPath();
      R.ctx.ellipse(x, y, 3, 4, 0, 0, Math.PI * 2); R.ctx.fill();
      R.ctx.fillStyle = "#fff";
      R.ctx.beginPath();
      R.ctx.ellipse(x, y - 1, 1.5, 2, 0, 0, Math.PI * 2); R.ctx.fill();
    } else if (type === "laser") {
      R.ctx.fillStyle = "#4488ff";
      R.ctx.shadowColor = "#2266ff";
      R.ctx.shadowBlur = 8;
      const w = 2 + power;
      R.ctx.fillRect(x - w, y - 12, w * 2, 24);
      R.ctx.fillStyle = "#aaccff";
      R.ctx.fillRect(x - 1, y - 10, 2, 20);
    }
    R.ctx.shadowBlur = 0;
    R.ctx.restore();
  },

  drawEnemyBullet(x, y, type) {
    R.ctx.save();
    if (type === "round") {
      R.ctx.fillStyle = "#ff4444";
      R.ctx.shadowColor = "#ff0000";
      R.ctx.shadowBlur = 4;
      R.ctx.beginPath();
      R.ctx.arc(x, y, 4, 0, Math.PI * 2); R.ctx.fill();
      R.ctx.fillStyle = "#ffaaaa";
      R.ctx.beginPath();
      R.ctx.arc(x - 1, y - 1, 1.5, 0, Math.PI * 2); R.ctx.fill();
    } else if (type === "arrow") {
      R.ctx.fillStyle = "#ff8822";
      R.ctx.shadowColor = "#ff4400";
      R.ctx.shadowBlur = 3;
      R.ctx.beginPath();
      R.ctx.moveTo(x, y - 5); R.ctx.lineTo(x + 5, y + 3);
      R.ctx.lineTo(x, y); R.ctx.lineTo(x - 5, y + 3);
      R.ctx.closePath(); R.ctx.fill();
    } else if (type === "large") {
      R.ctx.fillStyle = "#ff3333";
      R.ctx.shadowColor = "#cc0000";
      R.ctx.shadowBlur = 6;
      R.ctx.beginPath();
      R.ctx.arc(x, y, 7, 0, Math.PI * 2); R.ctx.fill();
      R.ctx.fillStyle = "#ffbbbb";
      R.ctx.beginPath();
      R.ctx.arc(x, y, 3, 0, Math.PI * 2); R.ctx.fill();
    }
    R.ctx.shadowBlur = 0;
    R.ctx.restore();
  },

  drawMissile(x, y, type, angle) {
    R.ctx.save(); R.ctx.translate(x, y);
    if (angle) R.ctx.rotate(angle);
    if (type === "homing") {
      R.ctx.fillStyle = "#44cc44";
      R.ctx.fillRect(-2, -6, 4, 12);
      R.ctx.fillStyle = "#ff0";
      R.ctx.beginPath(); R.ctx.arc(0, 6, 2, 0, Math.PI * 2); R.ctx.fill();
    } else {
      R.ctx.fillStyle = "#cc4444";
      R.ctx.fillRect(-3, -7, 6, 14);
      R.ctx.fillStyle = "#ff0";
      R.ctx.beginPath(); R.ctx.arc(0, 7, 2.5, 0, Math.PI * 2); R.ctx.fill();
    }
    R.ctx.restore();
  },

  // ── Explosions ──
  drawExplosion(x, y, size, alpha, phase) {
    R.ctx.save();
    R.ctx.globalAlpha = alpha;
    for (let ring = 0; ring < 3; ring++) {
      const r = size * (0.4 + ring * 0.3) * phase;
      const colors = ["#ff0", "#f80", "#f40"];
      R.ctx.strokeStyle = colors[ring];
      R.ctx.lineWidth = 2 + ring;
      R.ctx.beginPath();
      R.ctx.arc(x, y, r, 0, Math.PI * 2); R.ctx.stroke();
    }
    // Spark particles
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + phase * 2;
      const d = size * phase * 1.5;
      R.ctx.fillStyle = i % 2 === 0 ? "#ff0" : "#f80";
      R.ctx.fillRect(x + Math.cos(a) * d - 1, y + Math.sin(a) * d - 1, 3, 3);
    }
    R.ctx.globalAlpha = 1;
    R.ctx.restore();
  },

  drawBossExplosion(x, y, phase) {
    R.ctx.save();
    R.ctx.globalAlpha = 1 - phase;
    // Multiple explosion rings
    for (let ring = 0; ring < 5; ring++) {
      const r = 20 + ring * 15 + phase * 60;
      R.ctx.strokeStyle = ring < 2 ? "#ff0" : ring < 4 ? "#f80" : "#f40";
      R.ctx.lineWidth = 3 + ring * 1.5;
      R.ctx.beginPath();
      R.ctx.arc(x + Math.sin(phase * 5 + ring) * 10, y + Math.cos(phase * 5 + ring) * 10, r, 0, Math.PI * 2);
      R.ctx.stroke();
    }
    // Sparks
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * Math.PI * 2 + phase * 3;
      const d = 20 + phase * 80;
      R.ctx.fillStyle = ["#ff0", "#f80", "#f40", "#fff"][i % 4];
      R.ctx.fillRect(x + Math.cos(a) * d - 1, y + Math.sin(a) * d - 1, 3, 3);
    }
    R.ctx.globalAlpha = 1;
    R.ctx.restore();
  },

  // ── Items ──
  drawItem(x, y, type) {
    R.ctx.save(); R.ctx.translate(x, y);
    const glow = Math.sin(Date.now() / 200) * 0.3 + 0.7;
    R.ctx.globalAlpha = glow;

    switch (type) {
      case "P":
        R.ctx.fillStyle = "#ff0";
        R.ctx.beginPath(); R.ctx.arc(0, 0, 10, 0, Math.PI * 2); R.ctx.fill();
        R.ctx.fillStyle = "#000";
        R.ctx.font = "bold 14px 'Courier New'";
        R.ctx.textAlign = "center";
        R.ctx.fillText("P", 0, 5);
        break;
      case "F":
        R.ctx.fillStyle = "#f80";
        R.ctx.beginPath(); R.ctx.arc(0, 0, 10, 0, Math.PI * 2); R.ctx.fill();
        R.ctx.fillStyle = "#000";
        R.ctx.font = "bold 12px 'Courier New'";
        R.ctx.textAlign = "center";
        R.ctx.fillText("F", 0, 5);
        break;
      case "M":
        R.ctx.fillStyle = "#4f4";
        R.ctx.beginPath(); R.ctx.arc(0, 0, 8, 0, Math.PI * 2); R.ctx.fill();
        R.ctx.fillStyle = "#000";
        R.ctx.font = "bold 11px 'Courier New'";
        R.ctx.textAlign = "center";
        R.ctx.fillText("M", 0, 4);
        break;
      case "B":
        R.ctx.fillStyle = "#f44";
        R.ctx.beginPath(); R.ctx.arc(0, 0, 8, 0, Math.PI * 2); R.ctx.fill();
        R.ctx.fillStyle = "#000";
        R.ctx.font = "bold 11px 'Courier New'";
        R.ctx.textAlign = "center";
        R.ctx.fillText("B", 0, 4);
        break;
      case "1UP":
        R.ctx.fillStyle = "#0ff";
        R.ctx.beginPath(); R.ctx.arc(0, 0, 10, 0, Math.PI * 2); R.ctx.fill();
        R.ctx.fillStyle = "#000";
        R.ctx.font = "bold 9px 'Courier New'";
        R.ctx.textAlign = "center";
        R.ctx.fillText("1UP", 0, 3);
        break;
      case "medal":
        R.ctx.fillStyle = "#fd0";
        R.ctx.beginPath(); R.ctx.arc(0, 0, 6, 0, Math.PI * 2); R.ctx.fill();
        R.ctx.fillStyle = "#fa0";
        R.ctx.beginPath(); R.ctx.arc(0, 0, 3, 0, Math.PI * 2); R.ctx.fill();
        break;
    }
    R.ctx.globalAlpha = 1;
    R.ctx.restore();
  },

  // ── HUD ──
  drawHUD(score, highScore, lives, bombs, weaponLevel, weaponColor, col2) {
    R.ctx.save();
    // Background bar
    R.ctx.fillStyle = "rgba(0,0,0,0.7)";
    R.ctx.fillRect(0, 0, W, 24);

    // Score
    R.ctx.fillStyle = "#ddd";
    R.ctx.font = "12px 'Courier New'";
    R.ctx.textAlign = "left";
    R.ctx.fillText(`SCORE ${String(score).padStart(8, "0")}`, 8, 16);
    R.ctx.fillText(`HI ${String(highScore).padStart(8, "0")}`, W / 2, 16);

    // Weapon level indicator
    R.ctx.fillStyle = weaponColor;
    R.ctx.font = "bold 11px 'Courier New'";
    R.ctx.textAlign = "right";
    R.ctx.fillText(`Lv.${weaponLevel}`, W - 8, 16);

    // Lives at top-left
    for (let i = 0; i < lives; i++) {
      R.ctx.fillStyle = "#ccc";
      R.ctx.beginPath();
      R.ctx.moveTo(20 + i * 16, 8);
      R.ctx.lineTo(28 + i * 16, 8);
      R.ctx.lineTo(24 + i * 16, 4);
      R.ctx.closePath(); R.ctx.fill();
    }

    // Bottom bar
    R.ctx.fillStyle = "rgba(0,0,0,0.5)";
    R.ctx.fillRect(0, H - 20, W, 20);

    // Bomb icons
    R.ctx.font = "10px 'Courier New'";
    R.ctx.textAlign = "left";
    R.ctx.fillStyle = "#fa4";
    R.ctx.fillText(`BOMB × ${bombs}`, 8, H - 6);

    // P2 info if active
    if (col2 !== undefined) {
      R.ctx.textAlign = "right";
      R.ctx.fillText(`2P Lv.${col2}`, W - 8, H - 6);
    }

    R.ctx.textAlign = "left";
    R.ctx.restore();
  },

  // ── Boss HP Bar ──
  drawBossBar(name, hp, maxHp) {
    R.ctx.save();
    const barW = W - 40, barH = 10, barX = 20, barY = 28;
    R.ctx.fillStyle = "rgba(0,0,0,0.6)";
    R.ctx.fillRect(barX - 2, barY - 2, barW + 4, barH + 4);
    // HP
    const ratio = Math.max(0, hp / maxHp);
    const hpGrad = R.ctx.createLinearGradient(barX, 0, barX + barW, 0);
    hpGrad.addColorStop(0, "#f00");
    hpGrad.addColorStop(0.3, "#f80");
    hpGrad.addColorStop(0.7, "#ff0");
    hpGrad.addColorStop(1, "#0f0");
    R.ctx.fillStyle = hpGrad;
    R.ctx.fillRect(barX, barY, barW * ratio, barH);
    // Boss name
    R.ctx.fillStyle = "#f00";
    R.ctx.font = "bold 10px 'Courier New'";
    R.ctx.textAlign = "center";
    R.ctx.fillText(name, W / 2, barY - 4);
    R.ctx.textAlign = "left";
    R.ctx.restore();
  },

  // ── WARNING overlay ──
  drawWarning(alpha) {
    if (alpha <= 0) return;
    R.ctx.save();
    R.ctx.globalAlpha = alpha * 0.4;
    R.ctx.fillStyle = "#f00";
    R.ctx.fillRect(0, 0, W, H);
    R.ctx.globalAlpha = alpha;
    R.ctx.fillStyle = "#f44";
    R.ctx.font = "bold 40px 'Courier New'";
    R.ctx.textAlign = "center";
    R.ctx.fillText("WARNING", W / 2, H / 2);
    R.ctx.textAlign = "left";
    R.ctx.restore();
  },

  // ── Screen Flash ──
  drawFlash() {
    if (R.flashAlpha > 0) {
      R.ctx.save();
      R.ctx.globalAlpha = R.flashAlpha;
      R.ctx.fillStyle = "#fff";
      R.ctx.fillRect(0, 0, W, H);
      R.ctx.restore();
    }
  },

  // ── Title Screen ──
  drawTitle(highScore) {
    R.drawStarfield();
    R.ctx.fillStyle = "#ffcc00";
    R.ctx.font = "bold 36px 'Courier New'";
    R.ctx.textAlign = "center";
    R.ctx.fillText("RAIDEN II", W / 2, 180);
    R.ctx.font = "14px 'Courier New'";
    R.ctx.fillStyle = "#ddd";
    R.ctx.fillText("BROWSER EDITION", W / 2, 210);
    R.ctx.fillText(`HI-SCORE  ${String(highScore).padStart(8, "0")}`, W / 2, 260);
    R.ctx.fillStyle = "#888";
    R.ctx.font = "12px 'Courier New'";
    R.ctx.fillText("PRESS ENTER OR START", W / 2, 360);
    R.ctx.fillText("ARROWS/WASD  MOVE   Z/SPACE  SHOT", W / 2, 400);
    R.ctx.fillText("X/SHIFT  BOMB   ESC  PAUSE", W / 2, 420);
    R.ctx.fillText("© 1993 SEIBU KAIHATSU", W / 2, H - 40);
    R.ctx.textAlign = "left";
  },

  // ── Game Over ──
  drawGameOver(score, highScore) {
    R.ctx.fillStyle = "rgba(0,0,0,0.7)";
    R.ctx.fillRect(0, H / 2 - 60, W, 120);
    R.ctx.fillStyle = "#f00";
    R.ctx.font = "bold 32px 'Courier New'";
    R.ctx.textAlign = "center";
    R.ctx.fillText("GAME OVER", W / 2, H / 2 - 15);
    R.ctx.fillStyle = "#ddd";
    R.ctx.font = "14px 'Courier New'";
    R.ctx.fillText(`SCORE  ${String(score).padStart(8, "0")}`, W / 2, H / 2 + 15);
    R.ctx.fillText("CONTINUE? PRESS ENTER", W / 2, H / 2 + 40);
    R.ctx.textAlign = "left";
  },

  // ── Pause ──
  drawPause() {
    R.ctx.fillStyle = "rgba(0,0,0,0.5)";
    R.ctx.fillRect(0, 0, W, H);
    R.ctx.fillStyle = "#fff";
    R.ctx.font = "bold 28px 'Courier New'";
    R.ctx.textAlign = "center";
    R.ctx.fillText("PAUSED", W / 2, H / 2);
    R.ctx.textAlign = "left";
  },
};
