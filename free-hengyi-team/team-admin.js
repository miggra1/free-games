const SUPABASE_URL = "https://etaedrixhwtcfykczram.supabase.co";
const SUPABASE_KEY = "sb_publishable_F3CdHW5XABUrO-Fc4TAeVA_UVpnYen3";
const AUTH_REDIRECT_URL = "https://free-games-kohl.vercel.app/free-hengyi-team/team-admin.html";
const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const statusLabels = { draft: "草稿", sent: "已发送", accepted: "已确认", declined: "已拒绝", completed: "已完成", planned: "待执行", active: "进行中", done: "已完成", cancelled: "已取消" };
let currentUser = null;

const $ = (selector) => document.querySelector(selector);
const authView = $("#authView"), setupView = $("#setupView"), workspace = $("#workspace");
function setStatus(selector, message, type = "") { const node = $(selector); node.textContent = message; node.className = `form-status ${type}`; }
function escapeText(value) {
  return String(value || "").replace(/[&<>'"]/g, (character) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", '"':"&quot;" })[character]);
}
function formatDate(value, withTime = false) { if (!value) return "未安排"; return new Intl.DateTimeFormat("zh-CN", withTime ? { dateStyle:"medium", timeStyle:"short" } : { dateStyle:"medium" }).format(new Date(value)); }
function show(view) { authView.hidden = view !== "auth"; setupView.hidden = view !== "setup"; workspace.hidden = view !== "workspace"; $("#signOutButton").hidden = !currentUser || view !== "workspace"; $("#sessionName").textContent = view === "workspace" ? (currentUser?.email || "") : ""; }

async function refreshSession() {
  const { data: { session } } = await client.auth.getSession();
  currentUser = session?.user || null;
  if (!currentUser) { show("auth"); return; }
  const { data, error } = await client.from("free_team_admins").select("display_name, role").eq("user_id", currentUser.id).maybeSingle();
  if (error) { show("auth"); setStatus("#authStatus", "数据库尚未初始化。请先执行 supabase-schema.sql。", "error"); return; }
  if (!data) { show("setup"); return; }
  $("#sessionName").textContent = data.display_name || currentUser.email;
  show("workspace");
  await loadRecords();
}

$("#authForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const values = Object.fromEntries(new FormData(event.currentTarget));
  setStatus("#authStatus", "登录中...");
  const { error } = await client.auth.signInWithPassword({ email: values.email.trim(), password: values.password });
  if (error) { setStatus("#authStatus", error.message, "error"); return; }
  await refreshSession();
});
$("#signUpButton").addEventListener("click", async () => {
  const email = $("#authEmail").value.trim(), password = $("#authPassword").value;
  if (!email || password.length < 6) { setStatus("#authStatus", "请输入邮箱和至少 6 位密码。", "error"); return; }
  setStatus("#authStatus", "创建账号中...");
  const { data, error } = await client.auth.signUp({ email, password, options:{ emailRedirectTo: AUTH_REDIRECT_URL } });
  if (error) { setStatus("#authStatus", error.message, "error"); return; }
  setStatus("#authStatus", data.session ? "账号已创建。正在进入后台..." : "账号已创建，请完成邮箱验证后登录。", "success");
  if (data.session) await refreshSession();
});
$("#resendButton").addEventListener("click", async () => {
  const email = $("#authEmail").value.trim();
  if (!email) { setStatus("#authStatus", "请先填写注册邮箱。", "error"); return; }
  setStatus("#authStatus", "正在发送验证邮件...");
  const { error } = await client.auth.resend({ type:"signup", email, options:{ emailRedirectTo: AUTH_REDIRECT_URL } });
  if (error) { setStatus("#authStatus", error.message, "error"); return; }
  setStatus("#authStatus", "验证邮件已发送，请打开新邮件完成确认。", "success");
});
$("#signOutButton").addEventListener("click", async () => { await client.auth.signOut(); currentUser = null; show("auth"); });
$("#setupForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const displayName = $("#adminName").value.trim() || currentUser.email;
  setStatus("#setupStatus", "正在初始化...");
  const { error } = await client.rpc("bootstrap_free_team_admin", { staff_name: displayName });
  if (error) { setStatus("#setupStatus", error.message, "error"); return; }
  await refreshSession();
});

$("#matchForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const values = Object.fromEntries(new FormData(event.currentTarget));
  setStatus("#matchStatus", "正在保存...");
  const payload = { ...values, proposed_at: new Date(values.proposed_at).toISOString(), status:"draft" };
  const { error } = await client.from("team_match_requests").insert(payload);
  if (error) { setStatus("#matchStatus", error.message, "error"); return; }
  event.currentTarget.reset(); setStatus("#matchStatus", "战队赛申请已创建。", "success"); await loadRecords();
});
$("#planForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const values = Object.fromEntries(new FormData(event.currentTarget));
  setStatus("#planStatus", "正在保存...");
  const { error } = await client.from("team_plans").insert({ ...values, status:"planned" });
  if (error) { setStatus("#planStatus", error.message, "error"); return; }
  event.currentTarget.reset(); setStatus("#planStatus", "作战计划已保存。", "success"); await loadRecords();
});

function recordActions(table, item, statuses) {
  const actions = document.createElement("div"); actions.className = "record-actions";
  const select = document.createElement("select"); select.className = "status-select";
  for (const status of statuses) { const option = document.createElement("option"); option.value = status; option.textContent = statusLabels[status]; option.selected = item.status === status; select.append(option); }
  select.addEventListener("change", async () => { const { error } = await client.from(table).update({ status:select.value, updated_at:new Date().toISOString() }).eq("id", item.id); if (error) alert(error.message); await loadRecords(); });
  const remove = document.createElement("button"); remove.className = "delete-button"; remove.type = "button"; remove.textContent = "删除";
  remove.addEventListener("click", async () => { if (!confirm("删除这条记录？")) return; const { error } = await client.from(table).delete().eq("id", item.id); if (error) alert(error.message); await loadRecords(); });
  actions.append(select, remove); return actions;
}
function renderMatches(records) {
  const list = $("#matchList"); list.replaceChildren();
  if (!records.length) { list.innerHTML = '<p class="empty-records">暂无战队赛申请。</p>'; return; }
  for (const item of records) { const record = document.createElement("article"); record.className = "record"; record.innerHTML = `<div class="record-top"><div><h3>${escapeText(item.opponent_name)}</h3><p class="record-meta">${formatDate(item.proposed_at, true)} · ${escapeText(item.format)}</p></div></div><p>${escapeText(item.message)}</p><p class="record-meta">联系人：${escapeText(item.contact_name)} · ${escapeText(item.contact_method)}${item.roster_note ? ` · ${escapeText(item.roster_note)}` : ""}</p>`; record.append(recordActions("team_match_requests", item, ["draft","sent","accepted","declined","completed"])); list.append(record); }
}
function renderPlans(records) {
  const list = $("#planList"); list.replaceChildren();
  if (!records.length) { list.innerHTML = '<p class="empty-records">暂无作战计划。</p>'; return; }
  for (const item of records) { const record = document.createElement("article"); record.className = "record"; record.innerHTML = `<div class="record-top"><div><h3>${escapeText(item.title)}</h3><p class="record-meta">${formatDate(item.scheduled_for)} · ${escapeText(item.plan_type)}</p></div></div><p>${escapeText(item.content)}</p>`; record.append(recordActions("team_plans", item, ["planned","active","done","cancelled"])); list.append(record); }
}
async function loadRecords() {
  const [matchesResult, plansResult] = await Promise.all([
    client.from("team_match_requests").select("*").order("proposed_at", { ascending:false }),
    client.from("team_plans").select("*").order("scheduled_for", { ascending:false })
  ]);
  if (matchesResult.error || plansResult.error) { alert((matchesResult.error || plansResult.error).message); return; }
  const matches = matchesResult.data || [], plans = plansResult.data || [];
  renderMatches(matches); renderPlans(plans);
  $("#pendingMatches").textContent = String(matches.filter((item) => ["draft","sent"].includes(item.status)).length);
  $("#totalMatches").textContent = String(matches.length);
  const today = new Date(); today.setHours(0, 0, 0, 0); const nextWeek = new Date(today); nextWeek.setDate(today.getDate() + 7);
  $("#weeklyPlans").textContent = String(plans.filter((item) => { const date = new Date(`${item.scheduled_for}T00:00:00`); return date >= today && date < nextWeek && item.status !== "cancelled"; }).length);
}
$("#refreshButton").addEventListener("click", loadRecords);
client.auth.onAuthStateChange(() => setTimeout(refreshSession, 0));
refreshSession();
