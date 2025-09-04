// data/packs/smalltalk.pack.js
(function(){
  const { createDialogues } = window.dialogues;
  const D = createDialogues("smalltalk-pack");

  // 汎用の一言
  D.any("smalltalk", "最近どう？", "そこそこかな");

  // 応酬：2往復＋分岐
  D.script("smalltalk","mid","normal", [
    D.S.p("今週忙しかった？"),
    D.S.g("ちょっとね。家でゴロゴロしたい気分。"),
    D.S.if("affection>=150 || tension=='high'",
      [
        D.S.p("じゃあ、今日は軽めにしよ。"),
        D.S.g("ありがと。{name}、優しい〜", { affection: 2 })
      ],
      [
        D.S.p("じゃ、無理せずいこ。")
      ]
    )
  ], 2);

  window.DIALOGUE_PACKS = window.DIALOGUE_PACKS || [];
  window.DIALOGUE_PACKS.push(D.build());
})();
