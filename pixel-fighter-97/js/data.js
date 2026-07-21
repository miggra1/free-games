/* data.js — 角色数据、招式模板、场景 */

const W = 960, H = 540, FLOOR = 430, GRAVITY = 0.68;
const ROUND_TIME = 60, TEAM_SIZE = 3;
const KEYS = new Set(), TOUCH = new Set();
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const sign = v => v < 0 ? -1 : 1;

function boot(t, s = "") {
  const el = document.querySelector("#bootStatus");
  if (el) { el.textContent = t; el.className = `boot-status ${s}`.trim(); }
}
boot("Loading data...");

const P1_KEYS = {
  left:"KeyA",right:"KeyD",up:"KeyW",down:"KeyS",
  lp:"KeyU",lk:"KeyJ",hp:"KeyI",hk:"KeyK",
  sp:"KeyO",su:"KeyL",dodge:"KeyQ",charge:"KeyE",
  switch:"ShiftLeft",start:"Enter",pause:"KeyP"
};
const P2_KEYS = {
  left:"ArrowLeft",right:"ArrowRight",up:"ArrowUp",down:"ArrowDown",
  lp:"Numpad1",lk:"Numpad2",hp:"Numpad4",hk:"Numpad5",
  sp:"Numpad6",su:"Numpad0",dodge:"Numpad3",charge:"NumpadAdd",
  switch:"NumpadEnter",start:"Space",pause:"NumpadDecimal"
};

const CHARACTERS = [
  { id:"kyoji", name:"草焰京介", role:"近身压制", body:"#273c7a", skin:"#f0bd86", hair:"#221913", trim:"#f04e36",
    speed:4.5, jump:14.2, weight:1, reach:1.02, power:1.0, projectile:"fire", trail:"#ff6633",
    specials:["upper","wave","rush","arashi"], superName:"orochinagi",
    moveMod:{
      upper:{label:"百式·鬼焼き",trail:"fire"},
      wave:{label:"百八式·暗払い"},
      rush:{label:"百弐拾七式·葵花",trail:"fire"},
      arashi:{label:"弐百拾弐式·琴月陽",start:8,active:12,recover:22,dmg:72,stun:28,block:18,push:9,w:64,h:54,y:-72,vx:7,special:true,cancel:true,hitStop:11,sfx:"rush"},
      orochinagi:{label:"裏百八式·大蛇薙",start:5,active:42,recover:36,dmg:180,stun:50,block:32,push:16,w:130,h:100,y:-108,super:true,cost:100,invuln:18,hitStop:20,sfx:"super",screenFlash:"#ff6633"}
    }
  },
  { id:"maiha", name:"不知舞华", role:"高速牵制", body:"#b91e36", skin:"#f4c48a", hair:"#61371b", trim:"#ffd56b",
    speed:5.15, jump:15.4, weight:0.92, reach:0.92, power:0.88, projectile:"fan", trail:"#ffe0a0",
    specials:["upper","wave","rush","musasabi"], superName:"shinku",
    moveMod:{
      upper:{label:"花蝶扇·昇",trail:"fan"},
      wave:{label:"花蝶扇"},
      rush:{label:"超必殺忍蜂",trail:"fan",vx:9},
      musasabi:{label:"ムササビの舞",start:6,active:14,recover:20,dmg:68,stun:26,block:16,push:8,w:58,h:48,y:-90,airOnly:true,special:true,cancel:true,hitStop:10,sfx:"rush"},
      shinku:{label:"超必殺·不知火流奥義",start:5,active:40,recover:34,dmg:170,stun:48,block:28,push:14,w:120,h:96,y:-100,super:true,cost:100,invuln:16,hitStop:18,sfx:"super",screenFlash:"#ff6688"}
    }
  },
  { id:"daimon", name:"大门刚藏", role:"投技反击", body:"#f1f1d8", skin:"#dca66d", hair:"#1c1711", trim:"#0c4f50",
    speed:3.35, jump:12.3, weight:1.25, reach:1.16, power:1.2, projectile:"quake", trail:"#2a8a8a",
    specials:["jirai","quake","upper","tenchi"], superName:"jigoku",
    moveMod:{
      jirai:{label:"地雷震",start:10,active:8,recover:24,dmg:78,stun:30,block:20,push:10,w:80,h:30,y:-24,ground:true,special:true,hitStop:12,sfx:"quake"},
      quake:{label:"超大外刈り",start:5,active:6,recover:26,dmg:82,stun:32,block:0,push:14,w:44,h:80,y:-86,throw:true,special:true,hitStop:14,sfx:"throw"},
      upper:{label:"雲つかみ",start:7,active:10,recover:22,dmg:70,stun:28,block:18,push:8,w:60,h:88,y:-108,invuln:8,launch:6,special:true,hitStop:10,sfx:"slash"},
      tenchi:{label:"天地返し",start:4,active:5,recover:28,dmg:90,stun:36,block:0,push:16,w:46,h:82,y:-88,throw:true,special:true,hitStop:16,sfx:"throw"},
      jigoku:{label:"地獄極楽落とし",start:4,active:8,recover:38,dmg:200,stun:60,block:0,push:20,w:48,h:84,y:-90,throw:true,super:true,cost:100,invuln:14,hitStop:22,sfx:"super",screenFlash:"#2a8a8a"}
    }
  },
  { id:"ioriha", name:"八神庵影", role:"残影连段", body:"#171417", skin:"#e8ad7a", hair:"#8f1828", trim:"#c6d1e8",
    speed:4.8, jump:14.0, weight:1, reach:1.05, power:1.06, projectile:"purple", trail:"#b94cff",
    specials:["upper","wave","rush","yaotome"], superName:"yaomi",
    moveMod:{
      upper:{label:"百弐拾七式·葵花",trail:"purple"},
      wave:{label:"百八式·闇払い"},
      rush:{label:"弐百拾弐式·神速",trail:"purple",vx:9},
      yaotome:{label:"八稚女·爪櫛",start:7,active:16,recover:22,dmg:86,stun:32,block:20,push:11,w:68,h:56,y:-74,vx:8,special:true,cancel:true,hitStop:13,sfx:"slash"},
      yaomi:{label:"裏参百拾六式·豺華",start:4,active:46,recover:38,dmg:190,stun:54,block:34,push:18,w:136,h:104,y:-112,super:true,cost:100,invuln:20,hitStop:22,sfx:"super",screenFlash:"#b94cff"}
    }
  },
  { id:"benrei", name:"二阶堂雷", role:"电流远控", body:"#f0d64f", skin:"#f3bf82", hair:"#e8e5c2", trim:"#2b2b64",
    speed:4.35, jump:13.7, weight:0.96, reach:1.0, power:0.96, projectile:"bolt", trail:"#65e7ff",
    specials:["upper","wave","rush","raijin"], superName:"raikou",
    moveMod:{
      upper:{label:"雷靭拳",trail:"bolt"},
      wave:{label:"雷光拳"},
      rush:{label:"超稲妻キック",trail:"bolt"},
      raijin:{label:"反動三段蹴り",start:6,active:14,recover:20,dmg:74,stun:28,block:18,push:9,w:62,h:52,y:-70,vx:6,special:true,cancel:true,hitStop:11,sfx:"rush"},
      raikou:{label:"雷光拳·MAX",start:5,active:44,recover:36,dmg:175,stun:50,block:30,push:15,w:126,h:98,y:-106,super:true,cost:100,invuln:16,hitStop:20,sfx:"super",screenFlash:"#65e7ff"}
    }
  },
  { id:"boss", name:"黑月卢卡", role:"最终Boss", body:"#302446", skin:"#d7b28d", hair:"#f4f4f8", trim:"#8effd2",
    speed:4.65, jump:13.9, weight:1.05, reach:1.24, power:1.18, projectile:"void", trail:"#8effd2",
    specials:["upper","wave","rush","teleport","kaiser"], superName:"darkmoon",
    moveMod:{
      upper:{label:"昇天斬",trail:"void",invuln:12},
      wave:{label:"闇の波動"},
      rush:{label:"疾風突",trail:"void",vx:10},
      teleport:{label:"瞬移",start:3,active:2,recover:16,dmg:0,stun:0,block:0,push:0,w:0,h:0,y:0,special:true,cost:0,hitStop:0,sfx:"teleport",teleport:true},
      kaiser:{label:"カイザーウェイブ",start:14,active:6,recover:26,dmg:88,stun:34,block:22,push:12,w:100,h:40,y:-80,projectile:true,special:true,hitStop:14,sfx:"wave"},
      darkmoon:{label:"暗月·終焉",start:3,active:50,recover:40,dmg:220,stun:60,block:38,push:20,w:140,h:110,y:-115,super:true,cost:100,invuln:22,hitStop:24,sfx:"super",screenFlash:"#8effd2"}
    }
  }
];

const BASE_MOVES = {
  lp:{label:"轻拳",start:4,active:5,recover:9,dmg:24,stun:14,block:9,push:3,w:48,h:20,y:-80,cancel:true,hitStop:5,sfx:"tap"},
  lk:{label:"轻脚",start:5,active:5,recover:10,dmg:22,stun:13,block:9,push:3.4,w:52,h:22,y:-48,cancel:true,hitStop:5,sfx:"tap"},
  hp:{label:"重拳",start:8,active:6,recover:18,dmg:48,stun:22,block:15,push:6,w:68,h:26,y:-82,launch:1,cancel:true,hitStop:9,sfx:"heavy"},
  hk:{label:"重脚",start:10,active:7,recover:19,dmg:52,stun:22,block:16,push:6.5,w:76,h:25,y:-55,knock:5,cancel:true,hitStop:10,sfx:"heavy"},
  c_lp:{label:"屈轻拳",start:4,active:5,recover:8,dmg:20,stun:12,block:8,push:2.5,w:50,h:18,y:-36,crouch:true,cancel:true,hitStop:4,sfx:"tap"},
  c_lk:{label:"屈轻脚",start:5,active:6,recover:9,dmg:18,stun:11,block:8,push:2.8,w:56,h:16,y:-20,crouch:true,cancel:true,hitStop:4,sfx:"tap"},
  c_hp:{label:"屈重拳",start:7,active:6,recover:16,dmg:44,stun:20,block:14,push:5.5,w:64,h:24,y:-38,crouch:true,launch:1,cancel:true,hitStop:8,sfx:"heavy"},
  c_hk:{label:"屈重脚",start:9,active:7,recover:18,dmg:48,stun:20,block:15,push:6,w:72,h:20,y:-18,crouch:true,sweep:true,knock:4,cancel:true,hitStop:9,sfx:"heavy"},
  j_lp:{label:"空轻拳",start:3,active:6,recover:6,dmg:26,stun:14,block:8,push:3,w:44,h:22,y:-78,airOnly:true,cancel:true,hitStop:5,sfx:"tap"},
  j_lk:{label:"空轻脚",start:4,active:6,recover:7,dmg:24,stun:13,block:8,push:3,w:48,h:24,y:-44,airOnly:true,cancel:true,hitStop:5,sfx:"tap"},
  j_hp:{label:"空重拳",start:6,active:7,recover:12,dmg:50,stun:22,block:14,push:5,w:60,h:28,y:-80,airOnly:true,launch:2,cancel:true,hitStop:8,sfx:"heavy"},
  j_hk:{label:"空重脚",start:8,active:8,recover:14,dmg:54,stun:24,block:15,push:6,w:68,h:26,y:-50,airOnly:true,knock:3,cancel:true,hitStop:9,sfx:"heavy"},
  throw:{label:"投技",start:4,active:3,recover:23,dmg:72,stun:34,block:0,push:12,w:42,h:78,y:-88,throw:true,hitStop:12,sfx:"throw"},
  upper:{label:"升龙裂",start:5,active:10,recover:25,dmg:78,stun:30,block:22,push:8,w:62,h:92,y:-110,invuln:10,launch:8,special:true,cost:0,hitStop:12,sfx:"slash"},
  wave:{label:"气功波",start:12,active:4,recover:23,dmg:64,stun:24,block:17,push:8,projectile:true,special:true,cost:0,hitStop:9,sfx:"wave"},
  rush:{label:"荒咬突",start:7,active:15,recover:20,dmg:82,stun:29,block:18,push:10,w:70,h:52,y:-70,vx:8.5,special:true,cancel:true,hitStop:12,sfx:"rush"},
  quake:{label:"地裂震",start:15,active:10,recover:27,dmg:88,stun:34,block:24,push:13,w:116,h:36,y:-28,ground:true,special:true,hitStop:14,sfx:"quake"},
  super:{label:"MAX超必杀",start:6,active:38,recover:34,dmg:168,stun:46,block:30,push:15,w:118,h:96,y:-106,super:true,cost:100,invuln:16,hitStop:18,sfx:"super"}
};

function getMove(charId, moveName) {
  const ch = CHARACTERS.find(c => c.id === charId);
  const base = BASE_MOVES[moveName] || {special:true,cost:0,sfx:"slash",start:6,active:10,recover:20,dmg:60,stun:20,block:15,push:8,w:60,h:50,y:-70};
  if (ch && ch.moveMod && ch.moveMod[moveName])
    return Object.assign({}, base, ch.moveMod[moveName]);
  return base;
}

const STAGES = [
  {name:"日本街頭",sky:["#0b0f2a","#2a101c","#07080c"],b1:"#141a33",b2:"#10162d",win:"#ffd56b",gnd:"#201c1a",ga:"#302d2a",gl:"#ffd56b",crowd:true,cc:["#7e2c32","#8d7636","#32657c","#8c8770"],bn:["#a2292f","#b8862e"]},
  {name:"中国古刹",sky:["#1a0a0a","#3a1a0a","#0a0505"],b1:"#2a1a0a",b2:"#1a0a05",win:"#ff8844",gnd:"#1a1410",ga:"#2a2018",gl:"#ff8844",crowd:true,cc:["#8b4513","#a0522d","#6b3410","#d2691e"],bn:["#cc3333","#ffcc00"]},
  {name:"霓虹都市",sky:["#05051a","#1a0a2a","#050510"],b1:"#0a0a1e",b2:"#0e0e28",win:"#00ffcc",gnd:"#0a0a14",ga:"#141420",gl:"#00ffcc",crowd:true,cc:["#00ccff","#ff00ff","#00ff66","#ffff00"],bn:["#ff0066","#00ccff"]},
  {name:"火山熔岩",sky:["#1a0500","#3a0a00","#0a0200"],b1:"#2a0a00",b2:"#1a0500",win:"#ff4400",gnd:"#1a0a00",ga:"#2a1000",gl:"#ff4400",crowd:false,cc:[],bn:["#ff2200","#ff8800"]},
  {name:"暗月祭壇",sky:["#050010","#0a0020","#020008"],b1:"#0a0018",b2:"#0e0020",win:"#8effd2",gnd:"#080010",ga:"#100020",gl:"#8effd2",crowd:false,cc:[],bn:["#8effd2","#4a6aff"]}
];

boot("Data loaded");

// 按键自定义 - 从 localStorage 加载
function loadKeyConfig() {
  try {
    const saved = localStorage.getItem("pf97_keys");
    if (saved) {
      const cfg = JSON.parse(saved);
      if (cfg.p1) Object.assign(P1_KEYS, cfg.p1);
      if (cfg.p2) Object.assign(P2_KEYS, cfg.p2);
    }
  } catch (e) { }
}
function saveKeyConfig() {
  try { localStorage.setItem("pf97_keys", JSON.stringify({ p1: P1_KEYS, p2: P2_KEYS })); } catch (e) { }
}
loadKeyConfig();

const G = { frame: 0, state: "title", mode: "arcade", menu: 0, selectCursor: [0, 3], chosen: [[], []], orderCursor: [0, 0], orderPhase: [false, false], p1: null, p2: null, round: 1, time: ROUND_TIME * 60, message: "READY", messageTimer: 0, hitStop: 0, slow: 0, shake: 0, flash: 0, projectiles: [], effects: [], aiLevel: 2, training: false, arcadeStage: 1, finalBoss: false, winner: null, stageIdx: 0, paused: false, pauseMenu: 0, screenFlashColor: null, p1Wins: 0, p2Wins: 0, settings: { roundTime: 60, ai: 2, sound: true }, keySetup: { active: false, player: 0, action: "", listening: false } };
