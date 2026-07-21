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
  // 阴影
  ctx.save();ctx.globalAlpha=.45;ctx.fillStyle="#030306";ctx.beginPath();ctx.ellipse(f.x,FLOOR+4,f.width*.86,11,0,0,Math.PI*2);ctx.fill();ctx.restore();
  // 爆气MAX光环
  if(f.maxMode){ctx.save();ctx.globalAlpha=.14+Math.sin(G.frame*.22)*.07;ctx.fillStyle=f.data.trail;ctx.beginPath();ctx.ellipse(f.x,f.y-65,f.width*1.3,f.height*.75,0,0,Math.PI*2);ctx.fill();ctx.restore();}
  // 受击闪烁
  if(f.hitStun>0&&G.frame%4<2){ctx.save();ctx.globalAlpha=.6;ctx.fillStyle="#fff";ctx.beginPath();ctx.ellipse(f.x,f.y-65,f.width*.6,f.height*.5,0,0,Math.PI*2);ctx.fill();ctx.restore();}
  // 角色侧光
  ctx.save();ctx.globalAlpha=.08;ctx.fillStyle=f.side?"#ff6b5c":"#5bd4ff";ctx.beginPath();ctx.ellipse(f.x,FLOOR-65,f.width*.9,f.height*.6,0,0,Math.PI*2);ctx.fill();ctx.restore();
  // 残影
  for(const a of f.afterImage){ctx.save();ctx.globalAlpha=a.life/38;drawSprite(f,a.x,a.y,a.color,true);ctx.restore();}
  // 本体
  const flicker = f.invuln > 0 && Math.floor(G.frame/3)%2===0;
  if(!flicker) drawSprite(f,f.x,f.y,null,false);
  // 训练模式判定框
  if(G.training){ctx.strokeStyle="rgba(76,214,255,.45)";const h=f.hurtbox();ctx.strokeRect(h.x,h.y,h.w,h.h);const a=f.attackBox();if(a){ctx.strokeStyle="rgba(255,70,70,.8)";ctx.strokeRect(a.w<0?a.x+a.w:a.x,a.y,Math.abs(a.w),a.h);}}
  // 眩晕条
  if(f.stunGauge>50&&!f.stunned){const pct=f.stunGauge/1000;dRect(f.x-20,f.y-f.height-8,40,4,"#333");dRect(f.x-20,f.y-f.height-8,40*pct,4,pct>.7?"#ff5a57":"#ffd56b");}
}

function drawSprite(f,x,y,tint,ghost){
  const d=f.data,fl=f.facing<0?-1:1,cr=f.state==="crouch",ht=f.hitStun>0||f.state==="hurt",ak=f.state==="attack";
  const jp=f.y<FLOOR||f.state==="jump",wk=f.state==="walk"||f.state==="run";
  const run=f.state==="run";
  const sc=d.id==="daimon"?1.16:d.id==="maiha"?.96:d.id==="boss"?1.08:1;
  ctx.save();ctx.translate(x|0,(y+bob)|0);ctx.scale(fl*sc,sc);
  const sk=tint||d.skin,bd=tint||d.body,tr=tint||d.trim,hr=tint||d.hair;
  const w=d.id==="daimon",sl=d.id==="maiha",bs=d.id==="boss";
  // 帧动画周期
  const aFrame = Math.floor(G.frame / (wk?4:run?3:8)) % 4;
  const bob2 = wk ? Math.sin(G.frame/(run?3:4))*3 : Math.sin(G.frame/14)*1.5;
  const ln=ht?-14:ak?8:jp?5:wk?(run?4:2):0, cy=cr?20:0;
  const tW=w?50:sl?34:40,tH=cr?44:w?72:64,lH=cr?32:w?60:55,hW=w?35:sl?28:31;
  const ol=ghost?"rgba(0,0,0,.2)":"#050509";
  const P=(px,py,pw,ph,c)=>{if(ph<0){py+=ph;ph=-ph;}if(pw<0){px+=pw;pw=-pw;}ghost?dRect(px,py,pw,ph,c):dORect(px,py,pw,ph,c,ol);};
  // 阴影纹理 - 身体更精细
  const sh=c=>ghost?c:c+"44";
  // ─── 腿部（含帧动画） ───
  const legSwing = wk ? Math.sin(G.frame/(run?3:4)) * (run?10:7) : 0;
  const legKick = ak && ["lk","hk","c_lk","c_hk","j_lk","j_hk"].includes(f.move);
  if(!legKick) {
    // 左腿
    P(-20+ln-legSwing*.3,-56+cy,15,lH,sl?tr:bd);
    // 右腿
    P(6+ln+legSwing*.3,-56+cy,15,lH,sl?tr:bd);
    // 鞋
    P(-26+ln-legSwing*.4,-9+cy,22,10,"#111216");
    P(4+ln+legSwing*.4,-9+cy,24,10,"#111216");
    // 腿部高光
    if(!ghost){P(-18+ln-legSwing*.3,-54+cy,4,lH-6,"rgba(255,255,255,.1)");P(8+ln+legSwing*.3,-54+cy,4,lH-6,"rgba(255,255,255,.1)");}
  }
  // ─── 躯干 ───
  P(-tW/2+ln,-118+cy,tW,tH,bd);
  // 腰带
  P(-tW/2+ln,-62+cy,tW,6,d.id==="benrei"?tr:d.id==="ioriha"?"#b21728":w?tr:"#8a7a32");
  // 衣领/肩带
  P(-tW/2-2+ln,-118+cy,tW+4,10,tr);
  // 躯干阴影
  if(!ghost){P(-tW/2+6+ln,-104+cy,6,tH-14,"rgba(255,255,255,.12)");P(-tW/2+tW-10+ln,-104+cy,6,tH-14,"rgba(0,0,0,.1)");}
  // ─── 头部 ───
  P(-hW/2+ln,-155+cy,hW,35,sk);
  // 头发
  P(-hW/2-5+ln,-164+cy,hW+10,18,hr);
  if(!ghost){P(-hW/2+2+ln,-162+cy,hW-4,6,"rgba(255,255,255,.08)");}
  // 眼睛
  if(!ht){P(4+ln,-141+cy,4,5,"#101014");P(-8+ln,-141+cy,4,5,"#101014");P(5+ln,-142+cy,2,2,"#fff");}
  else{P(2+ln,-141+cy,8,4,"#101014");} // 受击X眼
  // 嘴
  if(ht) P(-2+ln,-134+cy,10,3,"#a04040");
  else if(ak) P(0+ln,-134+cy,6,2,"#a07050");
  // ─── 手臂（含帧动画） ───
  const armSwing = wk ? Math.sin(G.frame/(run?3:4)+Math.PI) * (run?6:4) : 0;
  if(!ak) {
    // 后臂
    P(-tW/2-12+ln+armSwing*.2,-110+cy,14,w?48:sl?36:42,bd);
    P(-tW/2-10+ln+armSwing*.2,-66+cy,10,12,sk);
    // 前臂
    P(tW/2-2+ln-armSwing*.2,-108+cy,14,w?48:sl?36:42,bd);
    P(tW/2+ln-armSwing*.2,-64+cy,10,12,sk);
    // 拳头高光
    if(!ghost){P(tW/2+1+ln-armSwing*.2,-62+cy,4,4,"rgba(255,255,255,.15)");}
  }
  // ─── 防御姿态 ───
  if(f.blockStun>0){
    P(-tW/2-6+ln,-120+cy,10,55,bd);P(tW/2-4+ln,-118+cy,10,55,bd);
    P(-tW/2-4+ln,-120+cy,8,8,tr);P(tW/2-2+ln,-118+cy,8,8,tr);
    // 格挡火花
    if(!ghost&&G.frame%4===0){P(tW/2+4+ln,-100+cy,6,6,"#9fd8ff");P(-tW/2-8+ln,-105+cy,5,5,"#9fd8ff");}
  }
  // ─── 攻击动作（三阶段） ───
  if(ak) {
    const m=f.moveData(f.move);
    const phase = f.moveFrame < m.start ? 0 : f.moveFrame < m.start+m.active ? 1 : 2;
    const phaseLabel = ["蓄力","命中","收招"][phase];
    const windup = phase===0 ? (f.moveFrame/m.start) : 0; // 0-1蓄力进度
    const recovery = phase===2 ? ((f.moveFrame-m.start-m.active)/m.recover) : 0; // 0-1收招进度
    // 拳类攻击
    if(["lp","hp","c_lp","c_hp","j_lp","j_hp"].includes(f.move)){
      const ext = phase===1 ? (f.move==="hp"||f.move==="c_hp"||f.move==="j_hp"?68:52) : phase===0 ? 20+windup*30 : 50-recovery*30;
      P(14+ln,-112+cy,ext,14,bd); // 出拳手臂
      P(12+ext+ln,-114+cy,14,14,sk); // 拳头
      if(!ghost&&phase===1){P(12+ext+ln,-116+cy,6,6,tr);P(12+ext+4+ln,-112+cy,4,4,"rgba(255,255,255,.3)");} // 拳套
      // 后臂
      P(-tW/2-4+ln,-108+cy,12,40,bd);
      // 蓄力拉回
      if(phase===0){P(10+ln,-112+cy,20,12,bd);}
    }
    // 脚类攻击
    else if(["lk","hk","c_lk","c_hk","j_lk","j_hk"].includes(f.move)){
      const ext = phase===1 ? (f.move==="hk"||f.move==="c_hk"||f.move==="j_hk"?76:54) : phase===0 ? 16+windup*28 : 48-recovery*28;
      P(14+ln,-62+cy,ext,14,bd); // 踢腿
      P(12+ext+ln,-64+cy,18,12,tr); // 鞋
      // 后腿
      P(-20+ln,-56+cy,15,lH,bd);P(-26+ln,-9+cy,22,10,"#111216");
      // 旋转踢的弧线残影
      if(!ghost&&phase===1&&(f.move==="hk"||f.move==="c_hk")){ctx.globalAlpha=.2;P(8+ln,-70+cy,ext+10,8,tr);ctx.globalAlpha=1;}
    }
    // 升龙拳
    else if(f.move==="upper"){
      if(phase===1){P(8+ln,-188+cy,18,68,bd);P(4+ln,-200+cy,22,16,tr);if(!ghost){ctx.globalAlpha=.72;P(22+ln,-194+cy,16,94,tr);ctx.globalAlpha=1;}}
      else if(phase===0){P(10+ln,-130+cy+windup*40,14,50,bd);}
      else{P(10+ln,-130+cy,14,50,bd);}
      P(-28+ln,-92+cy,14,38,bd);
    }
    // 投技
    else if(f.move==="throw"){
      if(phase===1){P(12+ln,-116+cy,56,18,bd);P(58+ln,-118+cy,16,14,sk);P(-30+ln,-110+cy,12,42,bd);}
      else{P(14+ln,-112+cy,30,14,bd);}
    }
    // 波动拳
    else if(f.move==="wave"||f.move==="kaiser"){
      P(14+ln,-112+cy,44,16,bd);P(50+ln,-116+cy,16,16,sk);
      if(phase===1&&!ghost){ctx.globalAlpha=.45;P(68+ln,-120+cy,28,26,tr);ctx.globalAlpha=1;}
    }
    // 默认攻击
    else{
      const ext = phase===1 ? 54 : phase===0 ? 16+windup*28 : 40-recovery*20;
      P(16+ln,-112+cy,ext,16,bd);P(12+ext+ln,-114+cy,18,14,sk);
    }
    // 超必杀特效
    if(m.super||m.screenFlash){
      ctx.globalAlpha=.78;
      P(-58,-155,116,10,tr);P(-52,-136,104,10,tr);P(-62,-94,124,12,tr);
      if(!ghost){ctx.globalAlpha=.3;P(-70,-170,140,140,tr);ctx.globalAlpha=.78;}
      ctx.globalAlpha=1;
    }
  }
  // ─── 角色独有装饰 ───
  if(d.id==="kyoji"&&!ghost){P(-12+ln,-168+cy,24,4,tr);P(8+ln,-168+cy,14,4,tr);} // 头带
  if(d.id==="kyoji"&&!ghost){P(-tW/2-6+ln,-55+cy,8,4,tr);P(tW/2-2+ln,-55+cy,8,4,tr);} // 护腕
  if(d.id==="benrei"){P(-27,-168+cy,54,8,"#eef4ff");P(18,-145+cy,16,10,tr);if(!ghost){P(-25,-166+cy,50,4,"rgba(255,255,255,.15)");}}
  if(d.id==="ioriha"){P(-25,-165+cy,50,10,hr);P(-23,-74+cy,46,10,"#b21728");if(!ghost){P(-20,-163+cy,42,3,"rgba(180,30,60,.2)");}} // 紫炎纹
  if(d.id==="boss"){P(-34,-168+cy,68,12,hr);P(-31,-123+cy,62,13,tr);if(!ghost){P(-32,-166+cy,64,3,"rgba(142,255,210,.15)");}} // 暗月光环
  if(d.id==="maiha"&&!ghost){P(-30+ln,-127+cy,15,55,tr);P(20+ln,-104+cy,12,36,sk);P(-33+ln,-70+cy,18,8,tr);} // 翎扇/飘带
  if(d.id==="daimon"&&!ghost){P(-36+ln,-111+cy,17,46,bd);P(20+ln,-111+cy,17,46,bd);P(-38+ln,-68+cy,20,8,"#0c4f50");P(20+ln,-68+cy,20,8,"#0c4f50");} // 柔道服
  // ─── 眩晕星星 ───
  if(f.stunned)for(let i=0;i<4;i++){const sx=Math.sin(G.frame*.15+i*1.57)*22,sy=-174+Math.cos(G.frame*.18+i*1.57)*6;dORect(sx-4+ln,sy+cy,8,8,i%2?"#ffd56b":"#fff","#050509");}
  // ─── 胜利动画 ───
  if(f.victoryPose){
    const vBob = Math.sin(f.victoryTimer*.1)*3;
    P(-tW/2+ln,-145+vBob+cy,tW,8,"#ffd56b");P(18+ln,-160+vBob+cy,26,8,"#ffd56b");
    // 胜利光环
    if(!ghost){ctx.globalAlpha=.08+Math.sin(f.victoryTimer*.08)*.04;P(-40+ln,-180+vBob+cy,tW+80,tH+80,tr);ctx.globalAlpha=1;}
  }
  // ─── 爆气MAX闪烁 ───
  if(f.maxMode){
    const mPulse = Math.sin(G.frame*.25)*.08+.1;
    if(!ghost){ctx.globalAlpha=mPulse;P(-tW/2-10+ln,-165+cy,tW+20,tH+55,tr);ctx.globalAlpha=1;}
    // MAX能量粒子
    if(G.frame%6===0&&!ghost){ctx.globalAlpha=.5;P(rand(-tW/2,tW/2)+ln,-rand(50,160)+cy,4,4,tr);ctx.globalAlpha=1;}
  }
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
  if(G.keySetup&&G.keySetup.active){drawKeySetup();return;}
  ["AI难度: "+G.settings.ai,"回合时间: "+G.settings.roundTime,"按键自定义"].forEach((o,i)=>{if(i===G.menu)dRect(326,170+i*54,308,36,"#263f60");dText(o,W/2,176+i*54,22,"#fff4cf","center");});
  dText("W/S选择 A/D调整 ENTER按键设置 ESC返回",W/2,430,18,"#d7c6a4","center");
}

function drawKeySetup(){
  const ks=G.keySetup; if(!ks) return;
  const keys=ks.player===0?P1_KEYS:P2_KEYS;
  dText("按键自定义 — "+(ks.player===0?"P1":"P2"),W/2,30,32,ks.player===0?"#9fd8ff":"#ffb0a9","center");
  dText("Tab切换P1/P2 | A/D切换按键 | Enter绑定 | ESC完成",W/2,62,14,"#d7c6a4","center");
  KEY_ACTIONS.forEach((act,i)=>{
    const y=90+i*38,isCur=act===ks.action;
    if(isCur)dRect(120,y-2,720,34,ks.listening?"#5a2a2a":"#263f60");
    dText(ACTION_LABELS[act]||act,140,y+4,18,isCur?"#fff":"#fff4cf");
    dText(keys[act]||"—",340,y+4,18,isCur?(ks.listening?"#ff8a80":"#ffd56b"):"#aaa");
    if(isCur&&ks.listening)dText("← 按任意键绑定",520,y+4,18,"#ff8a80");
    else if(isCur)dText("← Enter开始绑定",520,y+4,18,"#ffd56b");
  });
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
