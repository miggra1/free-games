/* ============================================================
 * audio.js — WebAudio 合成音效 + 芯片风 BGM + 街机语音
 * 无任何外部音频文件:枪声/爆炸/拾取全部由振荡器与噪声合成,
 * 语音("Heavy Machine Gun!"等)由 speechSynthesis 朗读。
 * ============================================================ */
(function () {
  "use strict";

  let ctx = null, master = null, bgmGain = null, sfxGain = null;
  let muted = false, bgmTimer = null, bgmMode = null;
  let noiseBuf = null;

  function ensure() {
    if (ctx) { if (ctx.state === "suspended") ctx.resume(); return true; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.55; master.connect(ctx.destination);
    sfxGain = ctx.createGain(); sfxGain.gain.value = 1; sfxGain.connect(master);
    bgmGain = ctx.createGain(); bgmGain.gain.value = 0.4; bgmGain.connect(master);
    // 预生成 1 秒白噪声
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return true;
  }

  function tone(freq, dur, type, vol, slideTo, delay) {
    if (!ensure() || muted) return;
    const t0 = ctx.currentTime + (delay || 0);
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || "square";
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    g.gain.setValueAtTime(vol || 0.2, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g); g.connect(sfxGain);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }

  function noise(dur, vol, freq, q, delay, slideTo) {
    if (!ensure() || muted) return;
    const t0 = ctx.currentTime + (delay || 0);
    const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = "bandpass";
    f.frequency.setValueAtTime(freq || 1000, t0);
    if (slideTo) f.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), t0 + dur);
    f.Q.value = q || 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol || 0.3, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(sfxGain);
    src.start(t0); src.stop(t0 + dur + 0.02);
  }

  /* ---------------- 音效 ---------------- */
  const sfx = {
    shot(kind) {
      switch (kind) {
        case "H": noise(0.07, 0.32, 2400, 0.6); tone(520, 0.05, "square", 0.1, 240); break;
        case "S": noise(0.22, 0.5, 900, 0.5, 0, 200); tone(180, 0.16, "sawtooth", 0.22, 60); break;
        case "R": noise(0.35, 0.4, 500, 0.7, 0, 120); tone(140, 0.3, "sawtooth", 0.2, 50); break;
        case "F": noise(0.3, 0.3, 700, 0.4, 0, 1800); break;
        case "L": tone(1800, 0.14, "sawtooth", 0.2, 300); tone(2400, 0.1, "square", 0.12, 600); break;
        default:  noise(0.06, 0.28, 1800, 0.7); tone(700, 0.05, "square", 0.14, 300); break;
      }
    },
    explosion(big) {
      const s = big ? 1 : 0.55;
      noise(0.6 * s + 0.2, 0.6 * s, 320, 0.4, 0, 50);
      tone(90, 0.5 * s, "sine", 0.5 * s, 30);
      noise(0.2, 0.3 * s, 2000, 0.6, 0.02);
    },
    melee() { noise(0.09, 0.25, 3200, 1.2, 0, 800); },
    clang() { tone(2200, 0.1, "square", 0.18, 1400); tone(3300, 0.07, "square", 0.1); },
    jump() { tone(280, 0.12, "square", 0.12, 620); },
    throwG() { tone(500, 0.1, "square", 0.12, 900); },
    pickup() { tone(880, 0.07, "square", 0.16); tone(1320, 0.1, "square", 0.16, null, 0.07); },
    hostage() { tone(660, 0.08, "square", 0.16); tone(990, 0.08, "square", 0.16, null, 0.08); tone(1320, 0.12, "square", 0.16, null, 0.16); },
    enemyDie() { tone(400, 0.18, "sawtooth", 0.16, 90); noise(0.12, 0.2, 1200, 0.8); },
    playerDie() { tone(500, 0.5, "sawtooth", 0.25, 60); noise(0.5, 0.4, 500, 0.5, 0, 60); },
    coin() { tone(990, 0.08, "square", 0.2); tone(1480, 0.2, "square", 0.2, null, 0.08); },
    alarm() { for (let i = 0; i < 3; i++) { tone(700, 0.16, "square", 0.2, 500, i * 0.36); tone(500, 0.16, "square", 0.2, 700, i * 0.36 + 0.18); } },
    click() { tone(1200, 0.04, "square", 0.12); },
    countTick() { tone(880, 0.06, "square", 0.18); },
    missionClear() { [523, 659, 784, 1046, 784, 1046].forEach((f, i) => tone(f, 0.16, "square", 0.2, null, i * 0.14)); },
  };

  /* ---------------- 语音 ---------------- */
  let lastVoice = 0;
  function voice(text) {
    if (muted || !window.speechSynthesis) return;
    const now = performance.now();
    if (now - lastVoice < 500) return;
    lastVoice = now;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "en-US"; u.rate = 1.25; u.pitch = 1.15; u.volume = 0.9;
      speechSynthesis.speak(u);
    } catch (e) { /* 忽略 */ }
  }

  /* ---------------- BGM(步进音序器) ---------------- */
  // 沙漠战场风:A 小调,驱动感贝斯 + 五声音阶旋律
  const N = (semi) => 110 * Math.pow(2, semi / 12); // A2 基准
  const BASS  = [0,0,12,0, 3,0,10,0, 0,0,12,0, 5,3,2,0];        // 16 步
  const LEAD  = [12,-1,15,17, 19,-1,17,15, 12,-1,15,17, 22,19,17,15];
  const LEAD2 = [24,-1,22,19, 17,-1,15,12, 15,-1,17,19, 17,15,12,-1];
  let step = 0, bar = 0, nextT = 0;

  function schedStep(t) {
    const i = step % 16;
    const tempo = bgmMode === "boss" ? 168 : 138;
    const stepDur = 60 / tempo / 4;
    // 鼓
    if (i % 4 === 0) drumN(t, 150, 0.5, 0.12);           // kick
    if (i % 8 === 4) drumN(t, 1800, 0.28, 0.1);          // snare-ish
    drumN(t, 6000, i % 2 === 0 ? 0.06 : 0.04, 0.03);     // hat
    // 贝斯
    const b = BASS[i];
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = "triangle"; o.frequency.value = N(b);
    g.gain.setValueAtTime(0.32, t); g.gain.exponentialRampToValueAtTime(0.001, t + stepDur * 0.95);
    o.connect(g); g.connect(bgmGain); o.start(t); o.stop(t + stepDur);
    // 旋律
    const mel = (bgmMode === "boss" ? LEAD2 : (bar % 2 ? LEAD2 : LEAD));
    const m = mel[i];
    if (m >= 0) {
      const o2 = ctx.createOscillator(), g2 = ctx.createGain();
      o2.type = bgmMode === "boss" ? "sawtooth" : "square";
      o2.frequency.value = N(m + 12);
      g2.gain.setValueAtTime(0.12, t); g2.gain.exponentialRampToValueAtTime(0.001, t + stepDur * 1.8);
      o2.connect(g2); g2.connect(bgmGain); o2.start(t); o2.stop(t + stepDur * 2);
    }
    step++;
    if (step % 16 === 0) bar++;
    nextT += stepDur;
  }
  function drumN(t, freq, vol, dur) {
    const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(g); g.connect(bgmGain);
    src.start(t); src.stop(t + dur + 0.02);
  }

  const bgm = {
    start(mode) {
      if (!ensure()) return;
      if (bgmMode === mode && bgmTimer) return;
      bgm.stop();
      bgmMode = mode; step = 0; bar = 0;
      nextT = ctx.currentTime + 0.05;
      bgmTimer = setInterval(() => {
        if (muted) { nextT = Math.max(nextT, ctx.currentTime + 0.05); return; }
        while (nextT < ctx.currentTime + 0.15) schedStep(nextT);
      }, 40);
    },
    stop() { if (bgmTimer) { clearInterval(bgmTimer); bgmTimer = null; } bgmMode = null; },
  };

  window.AudioSys = {
    ensure, sfx, voice, bgm,
    toggleMute() { muted = !muted; if (master) master.gain.value = muted ? 0 : 0.55; return muted; },
    get muted() { return muted; },
  };
})();
