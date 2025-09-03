// data/packs/romance.pack.js
(function(){
  const { createDialogues } = window.dialogues;
  const D = createDialogues("romance-pack");

  // 応酬：選択肢＋効果
  D.script("romance","high","love", [
    D.S.g("このあと、どうする？"),
    D.S.choose(null, [
      D.S.opt("海まで散歩", [
        D.S.p("潮の匂い、好き。"),
        D.S.g("わたしも。手、つないでいい？", { affection: 2 })
      ], { affection: 1 }),
      D.S.opt("静かなカフェ", [
        D.S.p("新作ケーキ、気になってたんだ。"),
        D.S.g("半分こしよ。はい、あーん。", { affection: 2 })
      ], { tension: "mid" })
    ]),
    D.S.g("今日、すごく楽しかった。ありがと、{name}。", { affection: 2 })
  ]);

  window.DIALOGUE_PACKS = window.DIALOGUE_PACKS || [];
  window.DIALOGUE_PACKS.push(D.build());
})();
