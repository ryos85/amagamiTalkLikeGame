// data/packs/food.pack.js
(function(){
  const { createDialogues } = window.dialogues;
  const D = createDialogues("food-pack");

  D.any("food", "何食べたい？", "麺！|ごはん|甘いもの…");

  D.script("food","any","any", [
    D.S.g("今日は…"),
    D.S.choose(null, [
      D.S.opt("ラーメン", [
        D.S.p("こってり控えめなとこ行こう。"),
        D.S.g("ねぎ多めにしよ。", { affection:1 })
      ]),
      D.S.opt("定食", [
        D.S.p("焼き魚もいいね。"),
        D.S.g("健康的〜、えらい！", { tension:"mid" })
      ])
    ]),
    D.S.g("悩んでる時間も楽しいね。", { affection:1 })
  ]);

  window.DIALOGUE_PACKS = window.DIALOGUE_PACKS || [];
  window.DIALOGUE_PACKS.push(D.build());
})();
