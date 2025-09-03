// ====== 設定 ======
const PLAYER_NAME = "あなた";

// 会話カテゴリ（アタックを除く9種）
// 会話カテゴリ（アタック抜き9種）※icon追加
const TYPES = [
  { key: "smalltalk", label: "世間話", icon: "💬" },
  { key: "study", label: "勉強", icon: "📚" },
  { key: "exercise", label: "運動", icon: "🏃‍♀️" },
  { key: "hobby", label: "娯楽", icon: "🎮" },
  { key: "food", label: "食べ物", icon: "🍔" },
  { key: "fashion", label: "おしゃれ", icon: "💄" },
  { key: "romance", label: "恋愛", icon: "💞" },
  { key: "adult", label: "エッチ", icon: "💋" },
  { key: "action", label: "行動", icon: "🧭" }
];

// 設定
const CLEAR_LOG_ON_NEW = true;
const REPLY_DELAY_MS = 1200;                 // ← 0.5s → 1.0s に変更
const THOUGHT_CHAR = "…";                 // 表示する点（"…" にしてもOK）
const THOUGHT_DOT_INTERVAL_MS = Math.floor(REPLY_DELAY_MS / 3);
const PLAYER_DELAY_MS = 800;          // プレイヤーの発話待機（0.5s）

// テンション3段階
const TENSIONS = ["low", "mid", "high"];

// ====== 状態 ======
const state = {
  affection: 0,                // 0..255
  tension: "mid",              // "low" | "mid" | "high"
  data: null,                   // dialogues.json
  busy: false
};

// ====== ユーティリティ ======
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const $ = sel => document.querySelector(sel);
const el = (tag, cls, txt) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (txt != null) e.textContent = txt;
  return e;
};

function affectionTier(value) {
  if (value >= 201) return "love";      // 好き
  if (value >= 101) return "friend";    // 仲良し
  return "normal";                      // 普通
}
function tierLabel(tier) {
  return tier === "love" ? "好き" : tier === "friend" ? "仲良し" : "普通";
}
function tensionText(t){ return t==="high" ? "Hi" : (t==="low" ? "Low" : "Mid"); }

function setPortraitByTension() {
  const img = $("#portrait");
  const src = state.tension === "low" ? "assets/girl_low.png"
    : state.tension === "high" ? "assets/girl_high.png"
      : "assets/girl_mid.png";
  img.src = src;
  $("#tensionBadge").className = `badge badge-${state.tension}`;
  $("#tensionBadge").textContent = state.tension === "high" ? "Hi" : state.tension === "low" ? "Low" : "Mid";
}
function updateStatusUI() {
  $("#affectionLabel").textContent = state.affection;
  $("#affectionBar").style.width = `${(state.affection / 255) * 100}%`;
  $("#tierLabel").textContent = tierLabel(affectionTier(state.affection));
  setPortraitByTension();
}
function pushLog(kind, text) {
  const wrap = el("div", `bubble ${kind}`);
  wrap.innerHTML = text.replace(/\n/g, "<br>");
  $("#log").appendChild(wrap);
  // メタ情報（現在の条件）
  if (kind !== "system") {
    const meta = el("div", "meta",
      `条件: ${$("#tensionBadge").textContent} / ${$("#tierLabel").textContent}`);
    $("#log").appendChild(meta);
  }
  $("#log").scrollTop = $("#log").scrollHeight;
}
function pickWeighted(arr) {
  if (!arr || arr.length === 0) return null;
  const total = arr.reduce((s, i) => s + (i.weight || 1), 0);
  let r = Math.random() * total;
  for (const it of arr) { r -= (it.weight || 1); if (r < 0) return it; }
  return arr[0];
}
function applyEffect(effect = {}){
  if (!effect || typeof effect !== "object") return;

  const beforeAff = state.affection;
  const beforeTen = state.tension;

  // --- 好感度 ---
  if ("affection" in effect){
    const d = Number(effect.affection || 0);
    state.affection = clamp(state.affection + d, 0, 255);
  }

  // --- テンション ---
  if ("tension" in effect){
    const t = effect.tension;
    if (t === "+1" || t === "-1"){
      const idx = TENSIONS.indexOf(state.tension) + (t === "+1" ? 1 : -1);
      state.tension = TENSIONS[clamp(idx, 0, TENSIONS.length-1)];
    } else if (TENSIONS.includes(t)){
      state.tension = t;
    }
  }

  // 反映
  persist();
  updateStatusUI();

  // --- 変化をログ（system）に出す ---
  const msgs = [];

  if (state.affection !== beforeAff){
    const delta = state.affection - beforeAff;
    const afterTier = tierLabel(affectionTier(state.affection));
    msgs.push(`好感度 ${delta>0?"+":""}${delta} → ${state.affection}（${afterTier}）`);
  }
  if (state.tension !== beforeTen){
    msgs.push(`テンション ${tensionText(beforeTen)} → ${tensionText(state.tension)}`);
  }

  if (msgs.length){
    pushLog("system", msgs.join("<br>"));
  }
}

function format(str, vars) {
  return str.replace(/\{(\w+)\}/g, (_, k) => (vars?.[k] ?? `{${k}}`));
}

const sleep = (ms) => new Promise(res => setTimeout(res, ms));

// 発話バリエーションから1つ選ぶ（配列 or "A|B|C" 文字列に対応）
function chooseVariant(text) {
  if (Array.isArray(text)) return text[Math.floor(Math.random() * text.length)];
  if (typeof text === "string" && text.includes("|")) {
    const parts = text.split("|").map(s => s.trim()).filter(Boolean);
    return parts[Math.floor(Math.random() * parts.length)];
  }
  return text;
}
// 条件式を評価（affection/tension/tier を使った簡易式のみ）
function evalCond(expr) {
  const tier = tierLabel(affectionTier(state.affection)) // "普通/仲良し/好き"
    .replace("普通", "normal").replace("仲良し", "friend").replace("好き", "love");
  const ctx = { affection: state.affection, tension: state.tension, tier };

  // ORで分割 → ANDで分割 → 比較
  const orClauses = String(expr).split(/\s*\|\|\s*/);
  const cmp = (l, op, r) => {
    if (typeof r === "string") r = r.replace(/^['"]|['"]$/g, ""); // 引用符除去
    const L = (l === "affection") ? ctx.affection : (l === "tension") ? ctx.tension : (l === "tier") ? ctx.tier : undefined;
    const R = (l === "affection") ? Number(r) : String(r);
    switch (op) {
      case "==": return L == R;
      case "!=": return L != R;
      case ">": return Number(L) > Number(R);
      case "<": return Number(L) < Number(R);
      case ">=": return Number(L) >= Number(R);
      case "<=": return Number(L) <= Number(R);
      default: return false;
    }
  };
  for (const orc of orClauses) {
    let ok = true;
    const ands = orc.split(/\s*&&\s*/);
    for (const a of ands) {
      const m = a.trim().match(/^(affection|tension|tier)\s*(==|!=|>=|<=|>|<)\s*([^\s].*)$/);
      if (!m) { ok = false; break; }
      if (!cmp(m[1], m[2], m[3])) { ok = false; break; }
    }
    if (ok) return true;
  }
  return false;
}
function presentChoices(options){
  // options: [{label, then, effect?, sleepMs?}, ...]
  let host = document.getElementById("choices");
  if (!host){ // 予備：万一HTMLに無い場合は生成してログ直下に挿す
    host = el("div","choices"); host.id = "choices";
    $("#log").after(host);
  }
  host.innerHTML = "";
  host.hidden = false;

  return new Promise(resolve=>{
    options.forEach((opt, idx)=>{
      const b = el("button","", opt.label || `選択肢${idx+1}`);
      b.addEventListener("click", ()=>{
        host.hidden = true;
        host.innerHTML = "";
        resolve(opt);
      });
      host.appendChild(b);
    });
  });
}

// スクリプト（会話の応酬）を順に実行
async function runScript(steps){
  for (const step of steps){
    // 分岐
    if (step && typeof step.if !== "undefined"){
      const cond = evalCond(step.if);
      await runScript(cond ? (step.then || []) : (step.else || []));
      continue;
    }

    // 選択肢
    if (step && Array.isArray(step.choice)){
      if (step.prompt){
        const who = step.who || "girl";
        const raw  = chooseVariant(step.prompt);
        const line = format(String(raw), { name: PLAYER_NAME });
        if (who === "girl"){ await showThinking("girl",   step.delayMs ?? REPLY_DELAY_MS);  pushLog("npc", line); }
        else if (who === "player"){ await showThinking("player", step.delayMs ?? PLAYER_DELAY_MS); pushLog("user", line); }
        else { pushLog("system", line); }
      }
      const picked = await presentChoices(step.choice);
      if (picked.label){
        // プレイヤーが選んだ文言を出す前にも「・・・」
        await showThinking("player", PLAYER_DELAY_MS);
        pushLog("user", format(String(picked.label), { name: PLAYER_NAME }));
      }
      if (picked.effect) applyEffect(picked.effect);
      if (typeof picked.sleepMs === "number") await sleep(picked.sleepMs);
      await runScript(picked.then || []);
      continue;
    }

    // 通常のセリフ
    const who = step?.who || "girl";
    const raw = chooseVariant(step?.text ?? "");
    const line = format(String(raw), { name: PLAYER_NAME });

    if (who === "girl"){
      await showThinking("girl", step?.delayMs ?? REPLY_DELAY_MS);
      pushLog("npc", line);
    } else if (who === "player"){
      await showThinking("player", step?.delayMs ?? PLAYER_DELAY_MS);
      pushLog("user", line);
    } else {
      pushLog("system", line);
    }

    if (step?.effect) applyEffect(step.effect);
    if (typeof step?.sleepMs === "number") await sleep(step.sleepMs);
  }
}


// ログ欄に「考え中」のバブルを出して、duration後に消す
// 置換版：who = "girl" | "player" | "system"（既定は "girl"）
async function showThinking(who = "girl", durationMs){
  const cls = who === "player" ? "user" : (who === "system" ? "system" : "npc");
  const bubble = el("div", `bubble ${cls} thinking`);
  const span = el("span", "", (typeof THOUGHT_CHAR !== "undefined" ? THOUGHT_CHAR : "・"));
  bubble.appendChild(span);
  $("#log").appendChild(bubble);
  $("#log").scrollTop = $("#log").scrollHeight;

  const step = (typeof THOUGHT_DOT_INTERVAL_MS !== "undefined" ? THOUGHT_DOT_INTERVAL_MS : Math.floor(durationMs/3));
  let count = 1;
  const timer = setInterval(()=>{
    count = (count % 3) + 1;
    span.textContent = (typeof THOUGHT_CHAR !== "undefined" ? THOUGHT_CHAR : "・").repeat(count);
  }, step);

  await sleep(durationMs);
  clearInterval(timer);
  bubble.remove(); // 消してから本セリフ
}


// packs 読み込み完了のイベントを待つ（最大 5 秒で諦めて続行）
function waitForPacks(timeoutMs = 5000){
  // すでに読み込み済みなら即 resolve
  if (Array.isArray(window.DIALOGUE_PACKS) && window.DIALOGUE_PACKS.length) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const onReady = () => { window.removeEventListener('dialogue-packs-ready', onReady); resolve(); };
    window.addEventListener('dialogue-packs-ready', onReady, { once: true });
    // 念のためタイムアウト（pack がゼロでも進める）
    setTimeout(() => {
      window.removeEventListener('dialogue-packs-ready', onReady);
      resolve();
    }, timeoutMs);
  });
}

// ===== 会話エンジン =====
async function loadData(){
  // packs を全部マージして state.data へ
  const root = {};
  const deepMerge = (into, from) => {
    for (const type of Object.keys(from || {})){
      const T = (into[type] ??= {});
      for (const tension of Object.keys(from[type] || {})){
        const TT = (T[tension] ??= {});
        for (const tier of Object.keys(from[type][tension] || {})){
          const arr = (TT[tier] ??= []);
          arr.push(...from[type][tension][tier]);
        }
      }
    }
  };

  if (Array.isArray(window.DIALOGUE_PACKS) && window.DIALOGUE_PACKS.length){
    window.DIALOGUE_PACKS.forEach(pack => deepMerge(root, pack));
  }

  state.data = root;

  // 安全策：packs が一つも無い場合は警告を出す
  if (!Object.keys(state.data).length){
    pushLog("system", "会話パックが読み込まれていません。<br><code>data/packs.manifest.js</code> と各 <code>*.pack.js</code> を確認してください。");
  }
}


function getPool(typeKey) {
  const tier = affectionTier(state.affection);   // normal / friend / love
  const t = state.tension;                       // low / mid / high
  const type = state.data[typeKey];
  if (!type) return null;
  // ①完全一致
  if (type[t]?.[tier]?.length) return type[t][tier];

  // ②テンション一致→tier汎用
  if (type[t]?.any?.length) return type[t].any;

  // ③テンション汎用→tier一致
  if (type.any?.[tier]?.length) return type.any[tier];

  // ④完全汎用
  if (type.any?.any?.length) return type.any.any;

  return null;
}
async function handleTalk(typeKey, label){
  if (state.busy) return;
  state.busy = true;
  try{
    if (CLEAR_LOG_ON_NEW) $("#log").innerHTML = "";

    const pool = getPool(typeKey);
    if (!pool){ pushLog("system", `「${label}」の会話データが見つかりません。`); return; }
    const item = pickWeighted(pool);
    if (!item){ pushLog("system", `「${label}」にパターンがありません。`); return; }

    // script があれば応酬へ
    if (Array.isArray(item.script) && item.script.length){
      await runScript(item.script);
      return;
    }

    // 単発：プレイヤー→女の子（双方に「・・・」）
    const pText = format(item.player || `(${label})`, { name: PLAYER_NAME });
    await showThinking("player", PLAYER_DELAY_MS);
    pushLog("user", pText);

    await showThinking("girl", REPLY_DELAY_MS);
    const reply = chooseVariant(item.girl ?? "……");
    const gText = format(reply, { name: PLAYER_NAME });
    pushLog("npc", gText);

    applyEffect(item.effect);
  } finally {
    state.busy = false;
  }
}

// ====== UI 構築 ======
function buildButtons() {
  const host = $("#buttons");
  TYPES.forEach(t => {
    const b = el("button", "iconbtn");
    b.innerHTML = `
      <span class="emoji" aria-hidden="true">${t.icon}</span>
      <span class="label">${t.label}</span>
    `;
    b.setAttribute("aria-label", t.label);
    b.addEventListener("click", () => handleTalk(t.key, t.label));
    host.appendChild(b);
  });
}

function bindDebug() {
  document.querySelectorAll("[data-aff-delta]").forEach(btn => {
    btn.addEventListener("click", () => {
      const d = Number(btn.getAttribute("data-aff-delta"));
      state.affection = clamp(state.affection + d, 0, 255);
      $("#affectionInput").value = state.affection;
      updateStatusUI(); persist();
    });
  });
  $("#affectionInput").addEventListener("change", (e) => {
    state.affection = clamp(Number(e.target.value || 0), 0, 255);
    updateStatusUI(); persist();
  });
  document.querySelectorAll("[data-tension]").forEach(btn => {
    btn.addEventListener("click", () => {
      state.tension = btn.getAttribute("data-tension");
      updateStatusUI(); persist();
    });
  });
  $("#clearLog").addEventListener("click", () => $("#log").innerHTML = "");
  $("#resetState").addEventListener("click", () => {
    state.affection = 0; state.tension = "mid"; persist(); updateStatusUI();
  });
}

// ====== 永続化 ======
function persist() {
  localStorage.setItem("conv_demo_state", JSON.stringify({ affection: state.affection, tension: state.tension }));
}
function restore() {
  const raw = localStorage.getItem("conv_demo_state");
  if (!raw) return;
  try {
    const obj = JSON.parse(raw);
    if (typeof obj.affection === "number") state.affection = clamp(obj.affection, 0, 255);
    if (["low", "mid", "high"].includes(obj.tension)) state.tension = obj.tension;
  } catch { }
}

// ====== 起動 ======
async function init(){
  buildButtons();
  bindDebug();
  restore();
  updateStatusUI();

  try{
    await loadData();
    pushLog("system","会話データを読み込みました。");
  }catch(e){
    pushLog("system","会話データの読み込みに失敗しました。<br>ファイルの配置を確認してください。");
    console.error(e);
  }
}

// main.js が先に実行されても、packs 完了イベントを待ってから init
(function boot(){
  const start = async () => { await waitForPacks(); await init(); };
  if (document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
