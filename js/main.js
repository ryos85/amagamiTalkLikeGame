// =============================================================
// アマガミ風会話ゲーム - main.js（コメント付き）
// 目的：UIの初期化／会話エンジン／パック読み込み／状態永続化
// 注意：挙動は元コードと同一。コメントのみ追加しています。
// =============================================================

// ====== 設定 ======
let PLAYER_NAME = "あなた"; // デフォルトのプレイヤー名（ローカルストレージで上書き）

// 会話カテゴリ（アタックを除く9種）※iconはUIボタンに表示
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

// その他設定
const CLEAR_LOG_ON_NEW = true;            // 新しい会話開始時にログをクリア
const REPLY_DELAY_MS = 1200;              // NPCの発話までの待機（考え中演出）
const THOUGHT_CHAR = "…";                // 考え中バブルの表示文字
const THOUGHT_DOT_INTERVAL_MS = Math.floor(REPLY_DELAY_MS / 3); // ドット更新間隔
const PLAYER_DELAY_MS = 800;              // プレイヤー側の発話待機

// テンション3段階（UIバッジ表示・分岐に使用）
const TENSIONS = ["low", "mid", "high"];

// ====== 状態（ゲームの進行状況） ======
const state = {
  affection: 50,          // ドキドキ度：0..255
  tension: "mid",        // テンション："low" | "mid" | "high"
  data: null,            // 会話データ（packsをマージしたもの）
  busy: false,            // 会話処理中はUIをロック
  ended: false,           // クリア/ゲームオーバー後は入力停止
  pendingEnd: null
};

// ====== ユーティリティ ======
/** 数値nを[lo, hi]に丸める */
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
/** 単一要素ショートハンド */
const $ = sel => document.querySelector(sel);
/** 要素生成ヘルパー */
const el = (tag, cls, txt) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (txt != null) e.textContent = txt;
  return e;
};

/** 好感度から段階（tier）を返す */
function affectionTier(value) {
  if (value >= 201) return "love";   // 好き
  if (value >= 101) return "friend"; // 仲良し
  return "normal";                   // 普通
}
/** 段階ラベル（UI表示用の日本語） */
function tierLabel(tier) {
  return tier === "love" ? "好き" : tier === "friend" ? "仲良し" : "普通";
}
/** テンション略記（バッジ表示） */
function tensionText(t) { return t === "high" ? "Hi" : (t === "low" ? "Low" : "Mid"); }

/** テンションに応じてポートレート画像／バッジを更新 */
function setPortraitByTension() {
  const img = $("#portrait");
  const src = state.tension === "low" ? "assets/girl_low.png"
    : state.tension === "high" ? "assets/girl_high.png"
      : "assets/girl_mid.png";
  img.src = src;
  $("#tensionBadge").className = `badge badge-${state.tension}`;
  $("#tensionBadge").textContent = state.tension === "high" ? "Hi" : state.tension === "low" ? "Low" : "Mid";
}

/** ステータスUI（バー／ラベル／ポートレート）を最新化 */
function updateStatusUI() {
  $("#affectionLabel").textContent = state.affection;
  $("#affectionBar").style.width = `${(state.affection / 255) * 100}%`;
  // 値でゲージ色を切替
  (() => {
    const bar = $("#affectionBar");
    bar.classList.remove("aff-bar-red", "aff-bar-pink", "aff-bar-yellow", "aff-bar-cyan");
    const v = state.affection;
    let cls = "aff-bar-yellow";                    // 既定 51–179
    if (v === 255) cls = "aff-bar-red";
    else if (v >= 180) cls = "aff-bar-pink";
    else if (v <= 50) cls = "aff-bar-cyan";
    bar.classList.add(cls);
  })();
  $("#tierLabel").textContent = tierLabel(affectionTier(state.affection));
  setPortraitByTension();
}

/** ログに吹き出しを追加（kind: "npc" | "user" | "system"） */
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

/** 重み付きランダム選択（item.weight を考慮） */
function pickWeighted(arr) {
  if (!arr || arr.length === 0) return null;
  const total = arr.reduce((s, i) => s + (i.weight || 1), 0);
  let r = Math.random() * total;
  for (const it of arr) { r -= (it.weight || 1); if (r < 0) return it; }
  return arr[0]; // フォールバック
}

/** 効果（ドキドキ度・テンション変化）を適用し、UIとログへ反映 */
function applyEffect(effect = {}) {
  if (!effect || typeof effect !== "object") return;

  // --- クリア指定は“保留”にする（ここでは画面を出さない）---
  if (effect.clear === true) {
    state.pendingEnd = { type: "clear", message: "デートに成功！" };
  }

  const beforeAff = state.affection;
  const beforeTen = state.tension;

  // --- ドキドキ度 ---
  if ("affection" in effect) {
    const d = Number(effect.affection || 0);
    state.affection = clamp(state.affection + d, 0, 255); // 0〜255にクリップ
  }

  // --- テンション ---
  if ("tension" in effect) {
    const t = effect.tension;
    if (t === "+1" || t === "-1") {
      const idx = TENSIONS.indexOf(state.tension) + (t === "+1" ? 1 : -1);
      state.tension = TENSIONS[clamp(idx, 0, TENSIONS.length - 1)];
    } else if (TENSIONS.includes(t)) {
      state.tension = t;
    }
  }

  // 反映（UI/保存）
  persist();
  updateStatusUI();

  // --- 終了条件は“保留”に記録だけして、ここでは終了しない ---
  if (state.affection <= 0) {
    state.pendingEnd = { type: "over", message: "会話がつまらない……" };
  } else if (state.affection >= 255) {
    state.pendingEnd = { type: "over", message: "ドキドキさせすぎ……" };
  }

  // --- 変化ログ ---
  const msgs = [];
  if (state.affection !== beforeAff) {
    const delta = state.affection - beforeAff;
    const afterTier = tierLabel(affectionTier(state.affection));
    msgs.push(`ドキドキ度 ${delta > 0 ? "+" : ""}${delta} → ${state.affection}（${afterTier}）`);
  }
  if (state.tension !== beforeTen) {
    msgs.push(`テンション ${tensionText(beforeTen)} → ${tensionText(state.tension)}`);
  }
  if (msgs.length) pushLog("system", msgs.join("<br>"));
}

/** 文字列テンプレート置換：{name} → 変数 */
function format(str, vars) {
  return str.replace(/\{(\w+)\}/g, (_, k) => (vars?.[k] ?? `{${k}}`));
}

/** Promise版スリープ */
const sleep = (ms) => new Promise(res => setTimeout(res, ms));

/**
 * 条件式を評価（affection/tension/tier を用いた簡易評価器）
 * 例："affection >= 100 && tension == 'high' || tier == 'friend'"
 */
function evalCond(expr) {
  const tier = tierLabel(affectionTier(state.affection)) // "普通/仲良し/好き"
    .replace("普通", "normal").replace("仲良し", "friend").replace("好き", "love");
  const ctx = { affection: state.affection, tension: state.tension, tier };

  // ORで分割 → ANDで分割 → 比較
  const orClauses = String(expr).split(/\s*\|\|\s*/);
  const cmp = (l, op, r) => {
    if (typeof r === "string") r = r.replace(/^[\'"]|[\'"]$/g, ""); // 引用符除去
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

/** 選択肢ボタン群を表示し、クリックされた選択肢オブジェクトを返す */
function presentChoices(options) {
  // options: [{label, then, effect?, sleepMs?}, ...]
  let host = document.getElementById("choices");
  if (!host) { // 予備：万一HTMLに無い場合は生成してログ直下に挿す
    host = el("div", "choices"); host.id = "choices";
    $("#log").after(host);
  }
  host.innerHTML = "";
  host.hidden = false;

  return new Promise(resolve => {
    options.forEach((opt, idx) => {
      const b = el("button", "", opt.label || `選択肢${idx + 1}`);
      b.addEventListener("click", () => {
        host.hidden = true;
        host.innerHTML = "";
        resolve(opt);
      });
      host.appendChild(b);
    });
  });
}

/**
 * 会話スクリプトを順次実行
 * - 分岐（if / then / else）
 * - 選択肢（prompt + choice 配列）
 * - 通常セリフ（who: "girl"|"player"|"system", text, effect, sleepMs, delayMs）
 */
async function runScript(steps) {
  for (const step of steps) {
    // 分岐
    if (step && typeof step.if !== "undefined") {
      const cond = evalCond(step.if);
      await runScript(cond ? (step.then || []) : (step.else || []));
      continue;
    }

    // 選択肢
    if (step && Array.isArray(step.choice)) {
      if (step.prompt) {
        const who = step.who || "girl";
        const raw = step.prompt;
        const line = format(String(raw), { name: PLAYER_NAME });
        if (who === "girl") { await showThinking("girl", step.delayMs ?? REPLY_DELAY_MS); pushLog("npc", line); }
        else if (who === "player") { await showThinking("player", step.delayMs ?? PLAYER_DELAY_MS); pushLog("user", line); }
        else { pushLog("system", line); }
      }
      const picked = await presentChoices(step.choice);
      if (picked.label) {
        // プレイヤーが選んだ文言を出す前にも「・・・」
        await showThinking("player", PLAYER_DELAY_MS);
        pushLog("user", format(String(picked.label), { name: PLAYER_NAME }));
      }
      if (picked.effect) applyEffect(picked.effect);
      if (typeof picked.sleepMs === "number") await sleep(picked.sleepMs);
      await runScript(picked.then || []);
      continue;
    }

    // 通常のセリフ（単発）
    const who = step?.who || "girl";
    const raw = step?.text ?? "";
    const line = format(String(raw), { name: PLAYER_NAME });

    if (who === "girl") {
      await showThinking("girl", step?.delayMs ?? REPLY_DELAY_MS);
      pushLog("npc", line);
    } else if (who === "player") {
      await showThinking("player", step?.delayMs ?? PLAYER_DELAY_MS);
      pushLog("user", line);
    } else {
      pushLog("system", line);
    }

    if (step?.effect) applyEffect(step.effect);
    if (typeof step?.sleepMs === "number") await sleep(step.sleepMs);
  }
}
function finalizeTurnIfNeeded() {
  if (!state.pendingEnd) return;
  const { type, message } = state.pendingEnd;
  state.pendingEnd = null;
  state.ended = true;
  setCategoryButtonsEnabled(false);
  openOverlay(type === "clear" ? "ゲームクリア" : "ゲームオーバー", message);
  persist();
}
function openOverlay(title, message) {
  const ov = document.getElementById("overlay");
  const h = document.getElementById("overlayTitle");
  const p = document.getElementById("overlayMessage");
  h.textContent = title;
  p.textContent = message;
  ov.hidden = false;
}


/**
 * ログ欄に「考え中」のバブル（…）を出して、duration後に消す
 * who: "girl" | "player" | "system"
 */
async function showThinking(who = "girl", durationMs) {
  const cls = who === "player" ? "user" : (who === "system" ? "system" : "npc");
  const bubble = el("div", `bubble ${cls} thinking`);
  const span = el("span", "", (typeof THOUGHT_CHAR !== "undefined" ? THOUGHT_CHAR : "・"));
  bubble.appendChild(span);
  $("#log").appendChild(bubble);
  $("#log").scrollTop = $("#log").scrollHeight;

  const step = (typeof THOUGHT_DOT_INTERVAL_MS !== "undefined" ? THOUGHT_DOT_INTERVAL_MS : Math.floor(durationMs / 3));
  let count = 1;
  const timer = setInterval(() => {
    count = (count % 3) + 1;
    span.textContent = (typeof THOUGHT_CHAR !== "undefined" ? THOUGHT_CHAR : "・").repeat(count);
  }, step);

  await sleep(durationMs);
  clearInterval(timer);
  bubble.remove(); // 消してから本セリフ
}

// ===== 会話エンジン：データ読み込み・選択・実行 =====
/** packs（window.DIALOGUE_PACKS配列）をマージして state.data へ格納 */
async function loadData() {
  // packs を全部マージして state.data へ
  const root = {};
  const deepMerge = (into, from) => {
    for (const type of Object.keys(from || {})) {
      const T = (into[type] ??= {});
      for (const tension of Object.keys(from[type] || {})) {
        const TT = (T[tension] ??= {});
        for (const tier of Object.keys(from[type][tension] || {})) {
          const arr = (TT[tier] ??= []);
          arr.push(...from[type][tension][tier]);
        }
      }
    }
  };

  if (Array.isArray(window.DIALOGUE_PACKS) && window.DIALOGUE_PACKS.length) {
    window.DIALOGUE_PACKS.forEach(pack => deepMerge(root, pack));
  }

  state.data = root;

  // 安全策：packs が一つも無い場合は警告を出す
  if (!Object.keys(state.data).length) {
    pushLog("system", "会話パックが読み込まれていません。<br><code>data/packs.manifest.js</code> と各 <code>*.pack.js</code> を確認してください。");
  }
}

/**
 * 現在のテンション/ティアに最適な会話プールを返す
 * フォールバック順：
 * ① 完全一致 (tension & tier) → ② tension一致・tier:any → ③ tension:any・tier一致 → ④ any/any
 */
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

/**
 * 会話実行のエントリ（ボタン押下で呼ばれる）
 * - ログクリア → 該当プールから重み付き抽選 → スクリプト実行または単発応答
 */
async function handleTalk(typeKey, label) {
  if (state.busy || state.ended) return;        // 多重押下防止
  state.busy = true;
  setCategoryButtonsEnabled(false); // 会話中はボタン無効
  try {
    if (CLEAR_LOG_ON_NEW) $("#log").innerHTML = "";

    const pool = getPool(typeKey);
    if (!pool) { pushLog("system", `「${label}」の会話データが見つかりません。`); return; }
    const item = pickWeighted(pool);
    if (!item) { pushLog("system", `「${label}」にパターンがありません。`); return; }

    // script があれば応酬へ
    if (Array.isArray(item.script) && item.script.length) {
      await runScript(item.script);
      finalizeTurnIfNeeded();
      return;
    }

    // 単発：プレイヤー→女の子（双方に考え中の間合い）
    const pText = format(item.player || `(${label})`, { name: PLAYER_NAME });
    await showThinking("player", PLAYER_DELAY_MS);
    pushLog("user", pText);

    await showThinking("girl", REPLY_DELAY_MS);
    const reply = item.girl ?? "……";
    const gText = format(reply, { name: PLAYER_NAME });
    pushLog("npc", gText);

    applyEffect(item.effect);
    finalizeTurnIfNeeded();
  } finally {
    state.busy = false;
    setCategoryButtonsEnabled(true);
  }
}

// ====== UI 構築 ======
/** カテゴリボタン群を生成してクリックハンドラをバインド */
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

/** デバッグUI（好感度±、テンション切替、名前変更、ログ消去、状態リセット） */
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
  // --- プレイヤー名の適用 ---
  const nameInput = document.getElementById("playerNameInput");
  const applyBtn = document.getElementById("applyPlayerName");
  if (nameInput && applyBtn) {
    // 復元済みの名前を反映
    nameInput.value = PLAYER_NAME;

    // クリックで適用
    applyBtn.addEventListener("click", () => {
      const next = (nameInput.value || "").trim() || "あなた";
      PLAYER_NAME = next;
      persist();
      pushLog("system", `プレイヤー名を「${PLAYER_NAME}」に設定しました。`);
    });

    // Enterキーでも適用
    nameInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") applyBtn.click();
    });
  }
  $("#clearLog").addEventListener("click", () => $("#log").innerHTML = "");

}
/* リセット処理 */
function doReset() {
  state.affection = 50;
  state.tension = "mid";
  state.ended = false;
  state.pendingEnd = null;
  persist();
  updateStatusUI();
  const ov = document.getElementById("overlay");
  if (ov) ov.hidden = true;
}
const resetBtn = document.getElementById("resetState");
if (resetBtn) resetBtn.addEventListener("click", doReset);
const overlayReset = document.getElementById("overlayReset");
if (overlayReset) overlayReset.addEventListener("click", doReset);



/** 会話中のカテゴリボタン活性/非活性 */
function setCategoryButtonsEnabled(enabled) {
  document.querySelectorAll('#buttons button').forEach(b => {
    b.disabled = !enabled;
    b.setAttribute('aria-disabled', String(!enabled));
  });
}

// ====== 永続化 ======
/** ローカルストレージへ保存（ドキドキ度／テンション／名前） */
function persist() {
  localStorage.setItem("conv_demo_state", JSON.stringify({
    affection: state.affection,
    tension: state.tension,
    name: PLAYER_NAME,
    ended: state.ended
  }));
}


/** ローカルストレージから復元 */
function restore() {
  const raw = localStorage.getItem("conv_demo_state");
  if (!raw) return;
  try {
    const obj = JSON.parse(raw);
    if (typeof obj.affection === "number") state.affection = clamp(obj.affection, 0, 255);
    if (["low", "mid", "high"].includes(obj.tension)) state.tension = obj.tension;
    if (typeof obj.name === "string" && obj.name.trim()) PLAYER_NAME = obj.name.trim();
    state.ended = Boolean(obj.ended);
  } catch { }
}

// ====== 起動フロー ======
/** 初期化：UI構築→状態復元→デバッグ結線→ステータス更新→データ読込 */
async function init() {
  buildButtons();
  restore();
  bindDebug();
  updateStatusUI();

  try {
    await loadData();
    pushLog("system", "会話データを読み込みました。");
  } catch (e) {
    pushLog("system", "会話データの読み込みに失敗しました。<br>ファイルの配置を確認してください。");
    console.error(e);
  }
}

/**
 * boot：
 * - packsが既に読み込まれていれば即 init
 * - 未読み込みなら、index.html が投げる 'dialogue-packs-ready' を待ってから init
 * - DOMContentLoaded 前後どちらで呼ばれても安全
 */
(function boot() {
  const start = async () => { await init(); };

  const runAfterPacks = () => {
    // すでに読み込み済みなら即開始、未完了ならイベント待ち
    if (Array.isArray(window.DIALOGUE_PACKS) && window.DIALOGUE_PACKS.length) {
      start();
    } else {
      window.addEventListener('dialogue-packs-ready', start, { once: true });
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", runAfterPacks, { once: true });
  } else {
    runAfterPacks();
  }
})();
