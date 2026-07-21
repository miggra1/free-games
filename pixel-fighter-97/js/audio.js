/* audio.js — 音频系统（增强BGM + 语音播报） */

class AudioArcade {
  constructor() { this.ctx = null; this.master = null; this.mt = 0; this.bgmBeat = 0; }
  init() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.3;
      this.master.connect(this.ctx.destination);
    } catch (e) { }
  }
  tone(f, d, tp, g, sl, dl) {
    if (!this.ctx) return;
    tp = tp || "square"; g = g || 0.18; sl = sl || 0; dl = dl || 0;
    const t = this.ctx.currentTime + dl;
    const o = this.ctx.createOscillator(), gn = this.ctx.createGain();
    o.type = tp; o.frequency.setValueAtTime(f, t);
    if (sl) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + sl), t + d);
    gn.gain.setValueAtTime(g, t); gn.gain.exponentialRampToValueAtTime(0.001, t + d);
    o.connect(gn); gn.connect(this.master); o.start(t); o.stop(t + d);
  }
  chord(freqs, d, tp, g, dl) {
    for (const f of freqs) this.tone(f, d, tp, g / freqs.length, 0, dl || 0);
  }
  noise(d, g, dl) {
    if (!this.ctx) return;
    g = g || 0.16; dl = dl || 0;
    const t = this.ctx.currentTime + dl;
    const l = Math.floor(this.ctx.sampleRate * d);
    const buf = this.ctx.createBuffer(1, l, this.ctx.sampleRate);
    const dt = buf.getChannelData(0);
    for (let i = 0; i < l; i++) dt[i] = Math.random() * 2 - 1;
    const s = this.ctx.createBufferSource(), gn = this.ctx.createGain();
    gn.gain.setValueAtTime(g, t); gn.gain.exponentialRampToValueAtTime(0.001, t + d);
    s.buffer = buf; s.connect(gn); gn.connect(this.master); s.start(t); s.stop(t + d);
  }
  // 模拟语音的共振峰合成
  voice(freq, dur, formants, g, dl) {
    if (!this.ctx) return; g = g || .12; dl = dl || 0;
    const t = this.ctx.currentTime + dl;
    // 基频
    const o = this.ctx.createOscillator(), gn = this.ctx.createGain();
    o.type = "sawtooth"; o.frequency.setValueAtTime(freq, t);
    gn.gain.setValueAtTime(g, t); gn.gain.exponentialRampToValueAtTime(0.001, t + dur);
    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass"; filter.Q.value = 5;
    // 切换共振峰模拟不同元音
    const stepDur = dur / formants.length;
    for (let i = 0; i < formants.length; i++) {
      filter.frequency.setValueAtTime(formants[i], t + i * stepDur);
    }
    o.connect(filter); filter.connect(gn); gn.connect(this.master); o.start(t); o.stop(t + dur);
  }
  sfx(n) {
    this.init();
    const M = {
      tap: () => this.tone(280, .04, "square", .09, -80),
      heavy: () => { this.noise(.06, .18); this.tone(95, .09, "sawtooth", .16, -25); },
      block: () => { this.noise(.045, .11); this.tone(160, .05, "triangle", .1); },
      wave: () => { this.tone(180, .12, "sawtooth", .14, 240); this.tone(360, .1, "square", .08, 320); },
      rush: () => { this.noise(.07, .14); this.tone(410, .08, "square", .12, -170); },
      slash: () => { this.tone(740, .08, "sawtooth", .12, -360); this.noise(.04, .08); },
      quake: () => { this.tone(62, .18, "sawtooth", .2, -18); this.noise(.09, .12); },
      throw: () => { this.tone(120, .12, "square", .16, -50); this.noise(.07, .13); },
      super: () => { this.tone(110, .28, "sawtooth", .2, 560); this.tone(660, .2, "square", .11, -240); this.noise(.15, .1, .05); this.chord([440,554,660], .3, "sawtooth", .06, .1); },
      ko: () => { this.tone(190, .18, "square", .2, -90); setTimeout(() => this.tone(80, .5, "sawtooth", .22, -28), 120); this.voice(180, .4, [800, 600, 400], .1, .05); },
      select: () => this.tone(520, .05, "square", .11, 120),
      round: () => { this.tone(440, .12, "square", .12); this.tone(660, .12, "square", .1, .12); this.voice(220, .25, [600, 800, 600], .08); },
      fight: () => { this.tone(880, .15, "sawtooth", .15, 200); this.noise(.08, .1, .05); this.voice(280, .3, [400, 800, 1200], .1); },
      dodge: () => this.tone(300, .06, "triangle", .08, -100),
      charge: () => this.tone(200, .08, "sine", .06, 100),
      maxmode: () => { this.tone(440, .1, "square", .14); this.tone(880, .15, "square", .12, .1); this.tone(1320, .2, "sawtooth", .1, .2); this.chord([523, 659, 784], .3, "square", .06, .15); },
      stun: () => { this.tone(600, .06, "square", .08, -200); this.tone(400, .06, "square", .08, -200, .06); this.tone(200, .1, "square", .1, .12); },
      countdown: () => { this.tone(880, .08, "square", .1); this.voice(350, .15, [1200, 800], .06); },
      countdown_final: () => { this.tone(1200, .15, "square", .12); this.voice(400, .2, [800, 1200, 800], .08); },
      win: () => { this.tone(523, .12, "square", .14); this.tone(659, .12, "square", .12, .12); this.tone(784, .2, "square", .14, .24); this.voice(260, .5, [600, 800, 1000, 800], .08, .3); },
      lose: () => { this.tone(330, .2, "sawtooth", .14, -100); this.tone(220, .3, "sawtooth", .12, -80, .2); this.voice(180, .5, [600, 400, 300], .07, .15); },
      teleport: () => { this.tone(1200, .04, "sine", .1, -800); this.tone(400, .06, "sine", .08, 400, .03); },
      guardbreak: () => { this.tone(150, .15, "sawtooth", .2, -60); this.noise(.1, .15); this.voice(200, .2, [400, 800], .08); },
      perfect: () => { this.chord([523, 659, 784, 1047], .5, "sine", .08); this.tone(1047, .3, "square", .06, 0, .2); },
      ukemi: () => this.tone(500, .05, "triangle", .08, -200)
    };
    if (M[n]) M[n]();
  }
  music(frame, si, intense) {
    if (!this.ctx || frame < this.mt) return;
    const interval = intense ? 10 : 16;
    this.mt = frame + interval;
    this.bgmBeat++;
    const bar = this.bgmBeat % 64;
    // 各场景不同的音阶和节奏
    const scales = [
      [82,98,110,123,147,165,82,98], // 日本
      [110,123,147,165,196,220,147,123], // 中国
      [65,82,98,110,123,147,98,82], // 霓虹
      [55,65,73,82,98,110,82,65], // 火山
      [73,82,98,110,131,147,110,98] // Boss
    ];
    const scale = scales[si] || scales[0];
    const note = scale[bar % scale.length];
    const octave = Math.floor(bar / scale.length) % 2;
    const b = note * (octave + 1);
    // 低音线
    this.tone(b / 2, .06, "square", .025);
    // 旋律（每4拍一次）
    if (bar % 4 === 0) { this.tone(b, .08, "square", .03); this.tone(b * 1.5, .04, "triangle", .015); }
    // 节拍鼓点
    if (bar % 2 === 0) this.noise(.02, .03);
    if (bar % 8 === 0) { this.tone(b * 2, .04, "triangle", .02); this.tone(b * 4, .03, "sine", .012); }
    // 副旋律（每16拍变化）
    if (bar % 16 < 8 && bar % 4 === 2) this.tone(b * 1.25, .06, "sine", .018);
    if (bar % 16 >= 8 && bar % 4 === 2) this.tone(b * 1.5, .06, "sine", .018);
    // 紧张时加速
    if (intense && bar % 2 === 0) { this.tone(b * 1.5, .04, "sawtooth", .018); this.noise(.015, .02); }
    // Boss场景特殊处理
    if (si === 4 && bar % 32 === 0) this.chord([b, b * 1.25, b * 1.5], .2, "sawtooth", .03);
  }
}
const audio = new AudioArcade();
