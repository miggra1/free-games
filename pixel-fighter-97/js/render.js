/* render.js */
const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;

function dText(t,x,y,s,c,a){ctx.save();ctx.font="900 "+(s||18)+"px Arial,\"Microsoft YaHei\",monospace";ctx.textAlign=a||"left";ctx.textBaseline="top";ctx.lineWidth=Math.max(3,(s||18)/7|0);ctx.strokeStyle="#050509";ctx.strokeText(String(t),x|0,y|0);ctx.fillStyle=c||"#fff";ctx.fillText(String(t),x|0,y|0);ctx.restore();}
function dRect(x,y,w,h,c){ctx.fillStyle=c;ctx.fillRect(x|0,y|0,w|0,h|0);}
function dORect(x,y,w,h,c,o){dRect(x-2,y-2,w+4,h+4,o||"#050509");dRect(x,y,w,h,c);dRect(x+2,y+2,Math.max(2,w-4),3,"rgba(255,255,255,.18)");dRect(x,y+h-4,w,4,"rgba(0,0,0,.28)");}

function drawBG(){
  const t=G.frame,s=STAGES[G.stageIdx||0];
  const sk=ctx.createLinearGradient(0,0,0,H);sk.addColorStop(0,s.sky[0]);sk.addColorStop(.52,s.sky[1]);sk.addColorStop(1,s.sky[2]);ctx.fillStyle=sk;ctx.fillRect(0,0,W,H);
  for(let i=0;i<15;i++){const bx=i*82-(t*.1)%82;ctx.fillStyle=i%2?s.b1:s.b2;ctx.fillRect(bx,94+(i%4)*8,58,210);for(let w=0;w<4;w++)for(let h=0;h<7;h++)if((w+h+i+(t/45|0))%5===0){ctx.fillStyle=s.win;ctx.fillRect(bx+9+w*11,116+h*20,5,8);}}
  ctx.fillStyle="#080910";ctx.fillRect(0,274,W,174);
  if(s.crowd)for(let i=0;i<24;i++){const cx=i*38+Math.sin((t+i*9)/18)*3,cy=294+(i%3)*13;ctx.fillStyle=s.cc[i%s.cc.length];ctx.fillRect(cx,cy,12,16);ctx.fillStyle="#07080d";ctx.fillRect(cx+3,cy-6,7,7);}
  for(let i=0;i<12;i++){ctx.fillStyle=i%2?s.bn[0]:s.bn[1];ctx.fillRect(i*86+15,240+Math.sin((t+i*30)/35)*4,46,16);}
  dRect(0,348,W,98,"rgba(0,0,0,.54)");dRect(0,358,W,82,"rgba(13,15,20,.82)");
  dRect(0,FLOOR,W,H-FLOOR,s.gnd);
  for(let x=0;x<W;x+=48){dRect(x,FLOOR,48,74,(x/48)%2?s.ga:s.gnd);dRect(x,FLOOR,48,4,s.gl);}
  dRect(0,FLOOR+74,W,36,"#0f1014");
}

function drawFighter(f){
  ctx.save();ctx.globalAlpha=.5;ctx.fillStyle="#030306";ctx.beginPath();ctx.ellipse(f.x,FLOOR+4,f.width*.86,11,0,0,Math.PI*2);ctx.fill();ctx.restore();
  if(f.maxMode){ctx.save();ctx.globalAlpha=.12+Math.sin(G.frame*.2)*.06;ctx.fillStyle=f.data.trail;ctx.beginPath();ctx.ellipse(f.x,f.y-65,f.width*1.2,f.height*.7,0,0,Math.PI*2);ctx.fill();ctx.restore();}
  for(const a of f.afterImage){ctx.save();ctx.globalAlpha=a.life/38;drawSprite(f,a.x,a.y,a.color,true);ctx.restore();}
  if(!(f.invuln>0&&G.frame/3%2|0))drawSprite(f,f.x,f.y,null,false);
  if(G.training){ctx.strokeStyle="rgba(76,214,255,.45)";const h=f.hurtbox();ctx.strokeRect(h.x,h.y,h.w,h.h);const a=f.attackBox();if(a)ctx.strokeRect(a.w<0?a.x+a.w:a.x,a.y,Math.abs(a.w),a.h);}
}

function drawSprite(f,x,y,tint,ghost){
  const d=f.data,fl=f.facing<0?-1:1,cr=f.state==="crouch",ht=f.hitStun>0||f.state==="hurt",ak=f.state==="attack";
  const jp=f.y<FLOOR||f.state==="jump",wk=f.state==="walk"||f.state==="run";
  const bob=Math.sin((G.frame+f.side*12)/(wk?4:14))*(wk?3:1.5);
  const sc=d.id==="daimon"?1.16:d.id==="maiha"?.96:d.id==="boss"?1.08:1;
  ctx.save();ctx.translate(x|0,(y+bob)|0);ctx.scale(fl*sc,sc);
  const sk=tint||d.skin,bd=tint||d.body,tr=tint||d.trim,hr=tint||d.hair;
  const ln=ht?-12:ak?8:jp?5:wk?3:0,cy=cr?18:0;
  const w=d.id==="daimon",sl=d.id==="maiha";
  const tW=w?50:sl?34:40,tH=cr?46:w?72:64,lH=cr?34:w?60:55,hW=w?35:sl?28:31;
  const ol=ghost?"rgba(0,0,0,.2)":"#050509";
  const P=(px,py,pw,ph,c)=>{if(ph<0){py+=ph;ph=-ph;}if(pw<0){px+=pw;pw=-pw;}ghost?dRect(px,py,pw,ph,c):dORect(px,py,pw,ph,c,ol);};
  P(-tW/2+ln,-118+cy,tW,tH,bd);P(-tW/2-2+ln,-116+cy,tW+4,9,tr);P(-tW/2+6+ln,-101+cy,8,38,"rgba(255,255,255,.2)");
  P(-hW/2+ln,-153+cy,hW,33,sk);P(-hW/2-4+ln,-161+cy,hW+8,16,hr);P(6+ln,-139+cy,5,4,"#101014");
  if(sl){P(-33+ln,-127+cy,17,58,tr);P(19+ln,-104+cy,13,38,sk);}else if(w){P(-38+ln,-111+cy,19,48,bd);P(20+ln,-111+cy,19,48,bd);}else{P(-34+ln,-108+cy,16,45,bd);P(20+ln,-106+cy,15,43,bd);}
  const st=wk?Math.sin(G.frame/4)*8:0;
  P(-24+ln-st*.25,-60+cy,17,lH,sl?tr:bd);P(8+ln+st*.25,-60+cy,17,lH,sl?tr:bd);
  P(-31+ln-st*.45,-9+cy,26,9,"#111216");P(6+ln+st*.45,-9+cy,28,9,"#111216");
  if(ak){const m=f.moveData(f.move),act=f.moveFrame>=m.start&&f.moveFrame<m.start+m.active;
    const ext=act?(f.move==="hk"||f.move==="c_hk"||f.move==="j_hk"?76:f.move==="hp"||f.move==="c_hp"||f.move==="j_hp"?68:54):30;
    if(["lk","hk","c_lk","c_hk","j_lk","j_hk"].includes(f.move)){P(14+ln,-66+cy,ext,15,bd);P(64+ln,-69+cy,24,12,tr);}
    else if(f.move==="upper"){P(8+ln,-184+cy,20,65,bd);P(6+ln,-197+cy,25,16,tr);if(!ghost){ctx.globalAlpha=.72;P(23+ln,-190+cy,18,92,tr);ctx.globalAlpha=1;}}
    else if(f.move==="throw"){P(12+ln,-114+cy,54,18,bd);P(56+ln,-117+cy,18,15,sk);}
    else if(f.move==="wave"||f.move==="kaiser"){P(14+ln,-110+cy,44,16,bd);P(50+ln,-114+cy,18,18,sk);if(!ghost){ctx.globalAlpha=.45;P(70+ln,-118+cy,30,28,tr);ctx.globalAlpha=1;}}
    else{P(16+ln,-109+cy,ext,16,bd);P(62+ln,-112+cy,20,16,sk);}
    if(m.super||m.screenFlash){ctx.globalAlpha=.78;P(-58,-151,116,8,tr);P(-52,-132,104,9,tr);P(-62,-90,124,10,tr);ctx.globalAlpha=1;}
  }
  if(d.id==="benrei"){P(-27,-168+cy,54,8,"#eef4ff");P(18,-145+cy,16,10,tr);}
  if(d.id==="ioriha"){P(-25,-165+cy,50,10,hr);P(-23,-74+cy,46,10,"#b21728");}
  if(d.id==="boss"){P(-34,-168+cy,68,12,hr);P(-31,-123+cy,62,13,tr);}
  if(f.stunned)for(let i=0;i<3;i++){const sx=Math.sin(G.frame*.12+i*2.1)*20;P(sx-4+ln,-170+cy+i*4,8,8,"#ffd56b");}
  if(f.blockStun>0){P(-tW/2-8+ln,-108+cy,12,40,bd);P(tW/2-4+ln,-106+cy,12,38,bd);}
  if(f.victoryPose){P(-tW/2+ln,-140+cy,tW,8,"#ffd56b");P(20+ln,-155+cy,28,8,"#ffd56b");}
  if(f.maxMode&&G.frame/3%2|0){ctx.globalAlpha=.15;P(-tW/2-10+ln,-160+cy,tW+20,tH+50,tr);ctx.globalAlpha=1;}
  ctx.restore();
}

function drawProj(){for(const p of G.projectiles){ctx.save();ctx.translate(p.x,p.y);const C={fire:"#ff6633",fan:"#ffe0a0",purple:"#b94cff",bolt:"#65e7ff",void:"#8effd2",quake:"#f5bb62"};ctx.fillStyle=C[p.type]||p.color||"#fff";for(let i=0;i<4;i++)ctx.fillRect(-p.w/2+i*10+Math.sin((G.frame+i)*.6)*5,-p.h/2+i%2*7,p.w-i*12,p.h-i*6);ctx.fillStyle="#fff7c8";ctx.fillRect(-10,-8,20,16);ctx.restore();}}

function drawFX(){for(const e of G.effects){const a=clamp(e.life/34,.1,1);ctx.save();ctx.globalAlpha=a;ctx.translate(e.x,e.y);
  if(e.type==="hit"||e.type==="superhit"||e.type==="block"){ctx.fillStyle=e.type==="block"?"#9fd8ff":e.color;const n=e.type==="superhit"?12:7;for(let i=0;i<n;i++){const ag=i/n*Math.PI*2+G.frame*.08,l=(e.type==="superhit"?58:34)*a;ctx.fillRect(Math.cos(ag)*8,Math.sin(ag)*8,Math.cos(ag)*l,5);}ctx.fillStyle="#fff";ctx.fillRect(-10*a,-10*a,20*a,20*a);}
  else if(e.type==="spark"){ctx.fillStyle=e.color;ctx.fillRect(-3,-3,6,6);ctx.fillRect(-12,0,24,3);ctx.fillRect(0,-12,3,24);}
  else if(e.type==="quake"){ctx.fillStyle=e.color;for(let i=0;i<6;i++)ctx.fillRect(i*24-70,-i*8,18,i*8+18);}
  else if(e.type==="maxmode"){for(let i=0;i<8;i++){const ag=i/8*Math.PI*2+G.frame*.1;ctx.fillStyle=e.color;ctx.fillRect(Math.cos(ag)*40-4,Math.sin(ag)*50-4,8,8);}}
  else if(e.type==="teleport"){for(let i=0;i<6;i++){ctx.fillStyle=e.color;ctx.globalAlpha=a*(1-i*.15);ctx.fillRect(-20+i*8,-30+i*5,12,40-i*4);}}
  ctx.restore();}}

function drawHUD(){
  const p1=G.p1,p2=G.p2;if(!p1||!p2)return;
  function bar(x,y,w,h,pct,fl,bk,rv){dRect(x-4,y-4,w+8,h+8,"#08080d");dRect(x,y,w,h,bk);const ww=(w*clamp(pct,0,1))|0;ctx.fillStyle=fl;ctx.fillRect(rv?x+w-ww:x,y,ww,h);dRect(x,y,w,4,"rgba(255,255,255,.35)");}
  bar(34,24,342,19,p1.hp/1000,p1.maxMode?"#69d9ff":"#f5d65d","#b6272f",false);
  bar(W-376,24,342,19,p2.hp/1000,p2.maxMode?"#69d9ff":"#f5d65d","#b6272f",true);
  bar(72,488,258,12,p1.meter/300,p1.maxMode?"#ffd56b":"#5ad6ff","#263f60",false);
  bar(W-330,488,258,12,p2.meter/300,p2.maxMode?"#ffd56b":"#5ad6ff","#263f60",true);
  bar(72,504,120,6,p1.guardGauge/100,"#5ad6ff","#1a1a2e",false);bar(W-192,504,120,6,p2.guardGauge/100,"#5ad6ff","#1a1a2e",true);
  function port(x,d){dRect(x,49,58,50,"#05050a");dRect(x+8,73,42,20,d.body);dRect(x+17,59,24,25,d.skin);dRect(x+13,54,32,12,d.hair);dRect(x+6,92,46,4,d.trim);}
  port(30,p1.data);port(W-92,p2.data);
  dText(p1.data.name,104,52,16,"#fff4cf");dText(p2.data.name,W-104,52,16,"#fff4cf","right");
  const sec=Math.max(0,Math.ceil(G.time/60));dText(String(sec).padStart(2,"0"),W/2,18,38,sec<=5?"#ff5a57":"#fff4cf","center");
  dText("P1 "+(p1.index+1)+"/"+p1.team.length,36,84,14,"#9fd8ff");dText("P2 "+(p2.index+1)+"/"+p2.team.length,W-36,84,14,"#ffb0a9","right");
  for(let i=0;i<G.p1Wins;i++)dRect(36+i*18,98,14,14,"#ffd56b");for(let i=0;i<G.p2Wins;i++)dRect(W-36-(i+1)*18,98,14,14,"#ffd56b");
  if(p1.combo>1&&G.frame-p1.lastHit<70)dText(p1.combo+" HIT",120,112,30,"#ffd56b");
  if(p2.combo>1&&G.frame-p2.lastHit<70)dText(p2.combo+" HIT",W-120,112,30,"#ffd56b","right");
  if(p1.maxMode)dText("MAX",36,504,12,"#ffd56b");if(p2.maxMode)dText("MAX",W-36,504,12,"#ffd56b","right");
  if(G.training)dText("TRAINING 判定框/伤害 ON",W/2,488,15,"#9fffe6","center");
  if(G.messageTimer>0){dText(G.message,W/2,188,G.message.length>12?34:48,"#fff1b2","center");G.messageTimer--;}
}

function drawTitle(){
  drawBG();dRect(0,0,W,H,"rgba(0,0,0,.52)");dText("格斗皇 97",W/2,82,64,"#ffd56b","center");dText("PIXEL FIGHTER 97",W/2,150,24,"#9fd8ff","center");
  ["街机模式","本地双人","人机对战","训练模式","设置","出招表"].forEach((it,i)=>{const y=220+i*38;if(i===G.menu)dRect(350,y-5,260,30,"#b6272f");dText(it,W/2,y,22,i===G.menu?"#fff":"#fff1b2","center");});
  dText("W/S选择 ENTER确认 | P1:WASD+UIJKOL | P2:方向+小键盘 | P暂停",W/2,486,15,"#d7c6a4","center");
}

function drawSel(){
  drawBG();dRect(0,0,W,H,"rgba(0,0,0,.55)");dText("选择三人队伍",W/2,28,36,"#ffd56b","center");
  CHARACTERS.forEach((c,i)=>{const col=i%3,row=i/3|0,x=180+col*190,y=116+row*160;dRect(x,y,150,126,"#11131d");dRect(x+25,y+19,100,86,"#050509");
    drawSelPort(c,x+75,y+104);if(G.selectCursor[0]===i){ctx.strokeStyle="#69d9ff";ctx.lineWidth=4;ctx.strokeRect(x-5,y-5,160,136);}if(G.selectCursor[1]===i){ctx.strokeStyle="#ff5a57";ctx.lineWidth=4;ctx.strokeRect(x-10,y-10,170,146);}
    dText(c.name,x+75,y+108,15,"#fff4cf","center");dText(c.role,x+75,y+2,12,"#9fd8ff","center");});
  dText("P1: "+(G.chosen[0].map(i=>CHARACTERS[i].name).join("/")||"待选"),40,438,18,"#9fd8ff");
  dText("P2: "+(G.mode==="versus"?(G.chosen[1].map(i=>CHARACTERS[i].name).join("/")||"待选"):"AI自动"),40,466,18,"#ffb0a9");
  dText("方向移动 U确认P1 1确认P2 ESC返回",W/2,506,15,"#d7c6a4","center");
}

function drawSelPort(c,cx,by){const w=c.id==="daimon",s=c.id==="maiha",bW=w?56:s?38:46;dORect(cx-bW/2,by-63,bW,54,c.body);dORect(cx-bW/2-3,by-62,bW+6,8,c.trim);dORect(cx-18,by-94,36,34,c.skin);dORect(cx-25,by-102,50,15,c.hair);dORect(cx-bW/2-20,by-53,18,40,c.body);dORect(cx+bW/2+2,by-53,18,40,c.body);dORect(cx-24,by-12,19,13,"#121217");dORect(cx+5,by-12,23,13,"#121217");if(c.id==="benrei")dORect(cx-28,by-108,56,8,"#eef4ff");if(c.id==="ioriha")dORect(cx-28,by-109,56,10,c.hair);if(c.id==="boss")dORect(cx-35,by-110,70,12,c.hair);}

function drawOrder(){
  drawBG();dRect(0,0,W,H,"rgba(0,0,0,.6)");dText("排兵布阵 — 决定出场顺序",W/2,40,34,"#ffd56b","center");
  for(let p=0;p<2;p++){const tm=G.chosen[p],bx=p?540:100,cl=p?"#ffb0a9":"#9fd8ff";
    dText(p?"P2队伍":"P1队伍",bx+180,100,22,cl,"center");
    tm.forEach((ci,i)=>{const c=CHARACTERS[ci],y=140+i*90;dRect(bx+40,y,280,78,G.orderCursor[p]===i&&!G.orderPhase[p]?"#263f60":"#11131d");
      drawSelPort(c,bx+100,y+68);dText(c.name,bx+150,y+12,20,cl);dText(c.role,bx+150,y+38,14,"#fff4cf");dText("第"+(i+1)+"位",bx+150,y+56,14,i===0?"#ffd56b":"#888");
      if(G.orderCursor[p]===i&&!G.orderPhase[p]){ctx.strokeStyle=cl;ctx.lineWidth=3;ctx.strokeRect(bx+38,y-2,284,82);}});
    dText(G.orderPhase[p]?"已确认":"A/D选位 U确认",bx+180,y+88,14,G.orderPhase[p]?"#4a4":"#d7c6a4","center");
  }
  dText("ESC返回选人",W/2,490,18,"#d7c6a4","center");
}

function drawMoves(){
  drawBG();dRect(0,0,W,H,"rgba(0,0,0,.62)");dText("出招表 / 系统",W/2,34,38,"#ffd56b","center");
  const L=["移动: A/D ←/→ 跳:W/↑ 蹲:S/↓ 防:拉后","轻拳U/1 轻脚J/2 重拳I/4 重脚K/5","闪避Q/3 蓄气E/+ 换人Shift/Enter","投技:近身前+重拳/重脚","必杀:↓↘→+必杀  升龙:→↓↘+重拳","突进:↓↙←+必杀  各角色有独有招式","MAX超必杀:↓↘→+超杀 消耗一格气","爆气:蓄力中+必杀(≥50气) 攻击UP+取消窗扩大","取消:普通技→必杀→超必杀  爆气取消窗更宽","受身:倒地中按轻拳/轻脚/闪避","训练模式显示攻击框、受击框和伤害","ESC返回"];
  L.forEach((l,i)=>dText(l,60,88+i*30,16,i<4?"#9fd8ff":"#fff4cf"));dText("ESC返回",W/2,480,18,"#d7c6a4","center");
}

function drawSettings(){
  drawBG();dRect(0,0,W,H,"rgba(0,0,0,.62)");dText("设置",W/2,60,42,"#ffd56b","center");
  ["AI难度: "+G.settings.ai,"回合时间: "+G.settings.roundTime,"音效/BGM: 合成街机声"].forEach((o,i)=>{if(i===G.menu)dRect(326,170+i*54,308,36,"#263f60");dText(o,W/2,176+i*54,22,"#fff4cf","center");});
  dText("W/S选择 A/D调整 ESC返回",W/2,430,18,"#d7c6a4","center");
}

function drawResults(){
  drawBG();dRect(0,0,W,H,"rgba(0,0,0,.68)");
  const w=G.winner===G.p1;dText(w?"通关胜利":"挑战结束",W/2,88,54,w?"#ffd56b":"#ff8a80","center");
  dText("街机进度 "+G.arcadeStage+"/5",W/2,176,24,"#9fd8ff","center");
  dText("队伍: "+G.p1.team.map(i=>CHARACTERS[i].name).join(" / "),W/2,230,18,"#fff4cf","center");
  dText("ENTER重新开始 ESC回标题",W/2,430,20,"#d7c6a4","center");
}

function drawPause(){
  dRect(0,0,W,H,"rgba(0,0,0,.7)");dText("暂停",W/2,120,48,"#ffd56b","center");
  ["继续对战","重新开始","退出到标题"].forEach((it,i)=>{const y=220+i*48;if(i===G.pauseMenu)dRect(350,y-5,260,36,"#263f60");dText(it,W/2,y,24,i===G.pauseMenu?"#fff":"#fff1b2","center");});
  dText("W/S选择 ENTER确认 ESC继续",W/2,400,16,"#d7c6a4","center");
}

function render(){
  ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=1;ctx.imageSmoothingEnabled=false;
  const ox=G.shake?(rand(-G.shake,G.shake)|0):0,oy=G.shake?(rand(-G.shake,G.shake)|0):0;
  try{ctx.save();ctx.translate(ox,oy);
    if(G.state==="title")drawTitle();
    else if(G.state==="select")drawSel();
    else if(G.state==="order")drawOrder();
    else if(G.state==="moves")drawMoves();
    else if(G.state==="settings")drawSettings();
    else if(G.state==="results")drawResults();
    else if(G.p1&&G.p2){drawBG();drawProj();drawFighter(G.p1);drawFighter(G.p2);drawFX();drawHUD();
      if(G.flash>0){ctx.fillStyle="rgba(255,255,255,"+G.flash/30+")";ctx.fillRect(0,0,W,H);G.flash--;}
      if(G.screenFlashColor&&G.flash>0){ctx.fillStyle=G.screenFlashColor;ctx.globalAlpha=G.flash/40;ctx.fillRect(0,0,W,H);ctx.globalAlpha=1;G.screenFlashColor=null;}
    }else{G.state="title";drawTitle();}
    if(G.paused)drawPause();
    ctx.restore();boot("Ready","ready");
  }catch(e){ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle="#ff8a80";ctx.font="20px Arial";ctx.textAlign="center";ctx.fillText("Error: "+e.message,W/2,260);console.error(e);G.state="title";}
  G.shake*=.82;if(G.shake<.4)G.shake=0;
}
