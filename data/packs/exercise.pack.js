// data/packs/exercise.pack.js
(function(){
  const { createDialogues } = window.dialogues;
  const D = createDialogues("exercise-pack");

  D.any("exercise", "軽く散歩しない？", "賛成〜|今なら行ける！|外の空気すき");

  D.script("exercise","any","any", [
    D.S.g("何する？"),
    D.S.choose(null, [
      D.S.opt("ジムで筋トレ", [
        D.S.p("上半身メニューでいこう。"),
        D.S.g("フォーム見てくれる？助かる〜", { affection: 1, tension:"+1" })
      ]),
      D.S.opt("公園をジョグ", [
        D.S.p("ゆっくりね。"),
        D.S.g("呼吸合わせるの、ちょっと楽しい。", { tension:"mid" })
      ])
    ])
  ], 2);

  window.DIALOGUE_PACKS = window.DIALOGUE_PACKS || [];
  window.DIALOGUE_PACKS.push(D.build());
})();
