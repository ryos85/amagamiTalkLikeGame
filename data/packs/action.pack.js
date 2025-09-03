// data/packs/action.pack.js
(function(){
  const { createDialogues } = window.dialogues;
  const D = createDialogues("action-pack");

  D.any("action", "このあと何しよう？", "勉強|運動|どこか行く？");

  D.script("action","any","any", [
    D.S.g("方針決めよ？"),
    D.S.choose(null, [
      D.S.opt("勉強する", [
        D.S.p("集中30分、タイマーセット。"),
        D.S.g("終わったら休憩ね。", { affection:1 })
      ]),
      D.S.opt("運動する", [
        D.S.p("ストレッチから。"),
        D.S.g("体ほぐすの大事〜", { tension:"+1" })
      ]),
      D.S.opt("デートに行く", [
        D.S.p("じゃ、駅前集合で。"),
        D.S.g("支度する！", { affection:2 })
      ])
    ])
  ], 2);

  window.DIALOGUE_PACKS = window.DIALOGUE_PACKS || [];
  window.DIALOGUE_PACKS.push(D.build());
})();
