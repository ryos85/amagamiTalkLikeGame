// data/dialogues.js
(function(){
  // ===== ビルダー =====
  function createDialogues(){
    const root = {};
    function ensure(path){
      let o = root;
      for (const k of path) o = (o[k] ??= (k === path.at(-1) ? [] : {}));
      return o; // 最後の要素は配列
    }
    function add(type, tension, tier, player, girl, effect = {}, weight = 1){
      const bucket = ensure([type, tension, tier]);
      bucket.push({
        player,
        girl: Array.isArray(girl) ? girl : String(girl).split("|"),
        effect, weight
      });
    }
    // よく使う省略
    const any = (type, player, girl, effect = {}, weight = 1) =>
      add(type, "any", "any", player, girl, effect, weight);

    return { add, any, build: () => root };
  }

  const D = createDialogues();

  // ===== ここから会話をどんどん足すだけ =====
  // 例1：完全指定（テンション=low、帯=普通）
  D.add("smalltalk","low","normal",
    "最近どう？",
    "んー…ふつう。{name}は？|今日は眠いかも…",
    { tension:"+1" } // 効果は任意
  );

  // 例2：テンション=mid、帯=好き
  D.add("smalltalk","mid","love",
    "髪型、変えた？似合ってるよ。",
    "え、ほんと…？ありがと。|気づいてくれるの、{name}だけ。",
    { affection:3 }, 2 // 重み=2（出やすく）
  );

  // 例3：完全汎用（どの状態でも使う）
  D.any("food",
    "お腹すいた？",
    "ハンバーガー…いやサラダにしとく？"
  );

  // 例4：まとめ投入（同じセリフを全テンション/全帯に投下）
  ["low","mid","high"].forEach(t=>{
    ["normal","friend","love"].forEach(r=>{
      D.add("exercise", t, r,
        "散歩でも行く？",
        "うん、気分転換になりそう。"
      );
    });
  });

  // ===== 出力 =====
  window.DIALOGUES = D.build();
})();
