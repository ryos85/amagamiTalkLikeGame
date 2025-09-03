// ====== 設定 ======
const PLAYER_NAME = "あなた";

// 会話カテゴリ（アタックを除く9種）
// 会話カテゴリ（アタック抜き9種）※icon追加
const TYPES = [
  { key: "smalltalk", label: "世間話", icon: "💬" },
  { key: "study",     label: "勉強",   icon: "📚" },
  { key: "exercise",  label: "運動",   icon: "🏃‍♀️" },
  { key: "hobby",     label: "娯楽",   icon: "🎮" },
  { key: "food",      label: "食べ物", icon: "🍔" },
  { key: "fashion",   label: "おしゃれ", icon: "💄" },
  { key: "romance",   label: "恋愛",   icon: "💞" },
  { key: "adult",     label: "エッチ", icon: "💋" },
  { key: "action",    label: "行動",   icon: "🧭" }
];

// 設定
const CLEAR_LOG_ON_NEW = true;
const REPLY_DELAY_MS   = 1000;                 // ← 0.5s → 1.0s に変更
const THOUGHT_CHAR     = "…";                 // 表示する点（"…" にしてもOK）
const THOUGHT_DOT_INTERVAL_MS = Math.floor(REPLY_DELAY_MS / 3);


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

function affectionTier(value){
  if (value >= 201) return "love";      // 好き
  if (value >= 101) return "friend";    // 仲良し
  return "normal";                      // 普通
}
function tierLabel(tier){
  return tier === "love" ? "好き" : tier === "friend" ? "仲良し" : "普通";
}
function setPortraitByTension(){
  const img = $("#portrait");
  const src = state.tension === "low" ? "assets/girl_low.png"
             : state.tension === "high" ? "assets/girl_high.png"
             : "assets/girl_mid.png";
  img.src = src;
  $("#tensionBadge").className = `badge badge-${state.tension}`;
  $("#tensionBadge").textContent = state.tension === "high" ? "Hi" : state.tension === "low" ? "Low" : "Mid";
}
function updateStatusUI(){
  $("#affectionLabel").textContent = state.affection;
  $("#affectionBar").style.width = `${(state.affection/255)*100}%`;
  $("#tierLabel").textContent = tierLabel(affectionTier(state.affection));
  setPortraitByTension();
}
function pushLog(kind, text){
  const wrap = el("div", `bubble ${kind}`);
  wrap.innerHTML = text.replace(/\n/g,"<br>");
  $("#log").appendChild(wrap);
  // メタ情報（現在の条件）
  if (kind !== "system"){
    const meta = el("div","meta",
      `条件: ${$("#tensionBadge").textContent} / ${$("#tierLabel").textContent}`);
    $("#log").appendChild(meta);
  }
  $("#log").scrollTop = $("#log").scrollHeight;
}
function pickWeighted(arr){
  if (!arr || arr.length === 0) return null;
  const total = arr.reduce((s,i)=>s+(i.weight||1),0);
  let r = Math.random()*total;
  for (const it of arr){ r -= (it.weight||1); if (r < 0) return it; }
  return arr[0];
}
function applyEffect(effect={}){
  if ("affection" in effect){
    state.affection = clamp(state.affection + Number(effect.affection), 0, 255);
  }
  if ("tension" in effect){
    const t = effect.tension;
    if (t === "low" || t === "mid" || t === "high") state.tension = t;
    else if (t === "+1" || t === "-1"){
      const idx = TENSIONS.indexOf(state.tension) + (t === "+1" ? 1 : -1);
      state.tension = TENSIONS[clamp(idx,0,2)];
    }
  }
  persist(); updateStatusUI();
}
function format(str, vars){
  return str.replace(/\{(\w+)\}/g, (_,k)=> (vars?.[k] ?? `{${k}}`));
}

const sleep = (ms) => new Promise(res => setTimeout(res, ms));

// 発話バリエーションから1つ選ぶ（配列 or "A|B|C" 文字列に対応）
function chooseVariant(text){
  if (Array.isArray(text)) return text[Math.floor(Math.random()*text.length)];
  if (typeof text === "string" && text.includes("|")){
    const parts = text.split("|").map(s=>s.trim()).filter(Boolean);
    return parts[Math.floor(Math.random()*parts.length)];
  }
  return text;
}

// スクリプト（会話の応酬）を順に実行
async function runScript(steps){
  for (const step of steps){
    const who = step.who || "girl";   // 省略時は女の子扱い
    const raw  = chooseVariant(step.text ?? "");
    const line = format(String(raw), { name: PLAYER_NAME });

    if (who === "girl"){
      // 考え中アニメ（デフォルトは REPLY_DELAY_MS。個別 delayMs 指定可）
      await showThinking(typeof step.delayMs === "number" ? step.delayMs : REPLY_DELAY_MS);
      pushLog("npc", line);
    } else if (who === "player"){
      pushLog("user", line);
    } else {
      pushLog("system", line);
    }

    if (step.effect) applyEffect(step.effect);
    if (typeof step.sleepMs === "number") await sleep(step.sleepMs); // 追いウェイト任意
  }
}

// ログ欄に「考え中」のバブルを出して、duration後に消す
async function showThinking(durationMs){
  const bubble = el("div", "bubble npc thinking");
  const span = el("span", "", THOUGHT_CHAR);         // ・
  bubble.appendChild(span);
  $("#log").appendChild(bubble);
  $("#log").scrollTop = $("#log").scrollHeight;

  let count = 1;
  const timer = setInterval(()=>{
    count = (count % 3) + 1;                         // 1→2→3
    span.textContent = THOUGHT_CHAR.repeat(count);   // ・ / ・・ / ・・・
  }, THOUGHT_DOT_INTERVAL_MS);

  await sleep(durationMs);
  clearInterval(timer);
  bubble.remove();                                    // 消してから本セリフ
}


// ====== 会話エンジン ======
async function loadData(){
  // ① dialogues.js があればそれを使う
  if (window.DIALOGUES) { state.data = window.DIALOGUES; return; }
  // ② なければ dialogues.json を fetch
  const res = await fetch("data/dialogues.json");
  state.data = await res.json();
}

function getPool(typeKey){
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

    // --- 新: script があれば応酬会話を実行 ---
    if (Array.isArray(item.script) && item.script.length){
      await runScript(item.script);
      return;
    }

    // --- 互換: 旧式（1往復） ---
    const pText = format(item.player || `(${label})`, { name: PLAYER_NAME });
    pushLog("user", pText);
    await showThinking(REPLY_DELAY_MS);
    const reply = chooseVariant(item.girl ?? "……");
    const gText = format(reply, { name: PLAYER_NAME });
    pushLog("npc", gText);
    applyEffect(item.effect);
  } finally {
    state.busy = false;
  }
}

// ====== UI 構築 ======
function buildButtons(){
  const host = $("#buttons");
  TYPES.forEach(t=>{
    const b = el("button", "iconbtn");
    b.innerHTML = `
      <span class="emoji" aria-hidden="true">${t.icon}</span>
      <span class="label">${t.label}</span>
    `;
    b.setAttribute("aria-label", t.label);
    b.addEventListener("click", ()=> handleTalk(t.key, t.label));
    host.appendChild(b);
  });
}

function bindDebug(){
  document.querySelectorAll("[data-aff-delta]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const d = Number(btn.getAttribute("data-aff-delta"));
      state.affection = clamp(state.affection + d, 0, 255);
      $("#affectionInput").value = state.affection;
      updateStatusUI(); persist();
    });
  });
  $("#affectionInput").addEventListener("change", (e)=>{
    state.affection = clamp(Number(e.target.value||0),0,255);
    updateStatusUI(); persist();
  });
  document.querySelectorAll("[data-tension]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      state.tension = btn.getAttribute("data-tension");
      updateStatusUI(); persist();
    });
  });
  $("#clearLog").addEventListener("click", ()=> $("#log").innerHTML = "");
  $("#resetState").addEventListener("click", ()=>{
    state.affection = 0; state.tension = "mid"; persist(); updateStatusUI();
  });
}

// ====== 永続化 ======
function persist(){
  localStorage.setItem("conv_demo_state", JSON.stringify({ affection: state.affection, tension: state.tension }));
}
function restore(){
  const raw = localStorage.getItem("conv_demo_state");
  if (!raw) return;
  try{
    const obj = JSON.parse(raw);
    if (typeof obj.affection === "number") state.affection = clamp(obj.affection,0,255);
    if (["low","mid","high"].includes(obj.tension)) state.tension = obj.tension;
  }catch{}
}

// ====== 起動 ======
(async function init(){
  buildButtons(); bindDebug(); restore(); updateStatusUI();
  try{
    await loadData();
    pushLog("system","会話データを読み込みました。");
  }catch(e){
    pushLog("system","会話データの読み込みに失敗しました。<br>ファイルの配置を確認してください。");
    console.error(e);
  }
})();
