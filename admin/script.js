const draftForm = document.querySelector("#draftForm");
const draftTitle = document.querySelector("#draftTitle");
const draftCategory = document.querySelector("#draftCategory");
const draftRoute = document.querySelector("#draftRoute");
const draftPitch = document.querySelector("#draftPitch");
const draftState = document.querySelector("#draftState");
const previewArt = document.querySelector("#previewArt");
const previewCategory = document.querySelector("#previewCategory");
const previewTitle = document.querySelector("#previewTitle");
const previewPitch = document.querySelector("#previewPitch");
const gameList = document.querySelector("#gameList");
const scoreList = document.querySelector("#scoreList");
const scoreCount = document.querySelector("#scoreCount");
const gameCount = document.querySelector("#gameCount");
const resetChecklist = document.querySelector("#resetChecklist");
const checks = document.querySelectorAll("[data-check]");

const draftKey = "miggra-admin-draft";
const checklistKey = "miggra-admin-checklist";

const games = [
  ["合金弹头", "/metal-slug/", "街机射击"],
  ["格斗皇97", "/pixel-fighter-97/", "街机格斗"],
  ["烈火篮球", "/fire-basketball/", "限时挑战"],
  ["速度与激情", "/speed-fury/", "云端分数"],
  ["水果连连看", "/link-link-game/", "最高记录"],
  ["愤怒的小鸟", "/angry-birds/", "物理关卡"],
  ["双人黄金矿工", "/gold-miner-duo/", "本地双人"],
  ["皇城突袭塔防", "/tower-defense/", "策略塔防"],
  ["狂扁外星人3D", "/alien-brawler/", "3D动作"],
  ["赵云与阿斗", "/zhaoyun-adou/", "三国合成"],
  ["双人分屏赛车", "/racing-game/", "同屏竞速"],
  ["双人竞技场", "/two-player-battle/", "本地对战"],
  ["前线守卫战", "/frontline-shooter/", "射击闯关"],
  ["铠甲动漫格斗", "/armored-duel/", "技能格斗"],
  ["趣味迷宫", "/maze-game/", "益智闯关"],
  ["宝石消消乐", "/match-3-game/", "消除关卡"],
];

const scoreGames = [
  "fire-basketball-v2",
  "speed-fury",
  "link-link-game",
  "angry-birds",
];

function loadJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || "") || fallback;
  } catch {
    return fallback;
  }
}

function saveDraft() {
  localStorage.setItem(draftKey, JSON.stringify({
    title: draftTitle.value,
    category: draftCategory.value,
    route: draftRoute.value,
    pitch: draftPitch.value,
  }));
  draftState.textContent = "已保存";
}

function restoreDraft() {
  const draft = loadJson(draftKey, null);
  if (!draft) return;
  draftTitle.value = draft.title || "";
  draftCategory.value = draft.category || "动作";
  draftRoute.value = draft.route || "";
  draftPitch.value = draft.pitch || "";
  draftState.textContent = "已保存";
}

function updatePreview() {
  const title = draftTitle.value.trim() || "新游戏";
  const pitch = draftPitch.value.trim() || "填写草稿后，这里会同步成前台卡片的视觉节奏。";
  previewTitle.textContent = title;
  previewPitch.textContent = pitch;
  previewCategory.textContent = draftCategory.value;
  previewArt.textContent = title.slice(0, 1).toUpperCase();
  if (draftState.textContent === "已保存") draftState.textContent = "有修改";
}

function renderGames() {
  gameCount.textContent = String(games.length);
  gameList.replaceChildren(...games.map(([name, href, status]) => {
    const row = document.createElement("article");
    row.className = "game-row";
    row.innerHTML = `<div><b>${name}</b><span>${status}</span></div><a href="${href}">打开</a>`;
    return row;
  }));
}

async function loadScores() {
  if (!window.FreeGamesScores) {
    scoreList.innerHTML = "<p>云端未连接</p>";
    return;
  }

  const records = await Promise.all(scoreGames.map(async (gameKey) => {
    const record = await window.FreeGamesScores.getBestScore(gameKey);
    return { gameKey, record };
  }));

  const rows = records.filter((item) => item.record);
  scoreCount.textContent = String(rows.length);
  if (!rows.length) {
    scoreList.innerHTML = "<p>暂无云端分数</p>";
    return;
  }

  scoreList.replaceChildren(...rows.map(({ gameKey, record }) => {
    const row = document.createElement("article");
    row.className = "score-row";
    row.innerHTML = `<div><b>${gameKey}</b><span>${record.player_name || "匿名玩家"}</span></div><strong>${record.score}</strong>`;
    return row;
  }));
}

function restoreChecklist() {
  const values = loadJson(checklistKey, {});
  for (const item of checks) item.checked = Boolean(values[item.dataset.check]);
}

function saveChecklist() {
  const values = {};
  for (const item of checks) values[item.dataset.check] = item.checked;
  localStorage.setItem(checklistKey, JSON.stringify(values));
}

draftForm.addEventListener("submit", (event) => {
  event.preventDefault();
  saveDraft();
});

for (const input of [draftTitle, draftCategory, draftRoute, draftPitch]) {
  input.addEventListener("input", updatePreview);
}

for (const item of checks) item.addEventListener("change", saveChecklist);

resetChecklist.addEventListener("click", () => {
  for (const item of checks) item.checked = false;
  saveChecklist();
});

restoreDraft();
updatePreview();
renderGames();
restoreChecklist();
loadScores();
