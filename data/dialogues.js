// data/dialogues.js
(function () {
  // ===== ビルダー =====
  function createDialogues() {
    const root = {};
    function ensure(path) {
      let o = root;
      for (const k of path) o = (o[k] ??= (k === path.at(-1) ? [] : {}));
      return o;
    }
    function add(type, tension, tier, player, girl, effect = {}, weight = 1) {
      const bucket = ensure([type, tension, tier]);
      bucket.push({
        player,
        girl: Array.isArray(girl) ? girl : String(girl).split("|"),
        effect, weight
      });
    }

    // ★ スクリプト投入
    function script(type, tension, tier, steps, weight = 1) {
      const bucket = ensure([type, tension, tier]);
      bucket.push({ script: steps, weight });
    }

    // ★ ステップ生成ショートカット
    const S = {
      p: (text, effect, opts = {}) => ({ who: "player", text, effect, delayMs: opts.delayMs, sleepMs: opts.sleepMs }),
      g: (text, effect, opts = {}) => ({ who: "girl", text, effect, delayMs: opts.delayMs, sleepMs: opts.sleepMs }),
      s: (text, effect, opts = {}) => ({ who: "system", text, effect, delayMs: opts.delayMs, sleepMs: opts.sleepMs })
    };

    const any = (type, player, girl, effect = {}, weight = 1) =>
      add(type, "any", "any", player, girl, effect, weight);

    return { add, any, script, S, build: () => root };
  }


  const D = createDialogues();

  // ===== ここから会話をどんどん足すだけ =====
  // 例: smalltalk / mid / normal で 2往復の応酬
  D.script("smalltalk", "mid", "normal", [
    D.S.p("最近どう？"),
    D.S.g("今週バタバタしてて…|ちょっと眠いかも。"),
    D.S.p("無理しないで。今日は早めに帰ろ。"),
    D.S.g("えへへ、ありがと。{name}優しいね。", { affection: 2 })
  ], 2); // weight=2 （出やすく）

  // 例: romance / high / love で 3往復、途中でちょい間（sleepMs）
  D.script("romance", "high", "love", [
    D.S.p("この後、少し歩かない？"),
    D.S.g("うん…手、つないでもいい？", null, { delayMs: 800 }),
    D.S.p("もちろん。", null, { sleepMs: 300 }),   // 本文後に0.3sウェイト
    D.S.g(["…あのね。", "……ずっと、こうしてたい。"], { affection: 3 })
  ]);

  // 互換：従来の単発も混在OK
  D.add("food", "any", "any", "お腹すいた？", "ハンバーガー…いやサラダにしよっか。");


  // ===== 出力 =====
  window.DIALOGUES = D.build();
})();
