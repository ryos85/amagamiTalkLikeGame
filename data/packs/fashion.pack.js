// data/packs/fashion.pack.js
(function(){
  const { createDialogues } = window.dialogues;
  const D = createDialogues("fashion-pack");

  D.any("fashion", "この服、どう？", "似合ってる|色が好き|大人っぽい");

  D.script("fashion","mid","friend", [
    D.S.p("今日のコーデ、良いね。"),
    D.S.g("ほんと？鏡の前で迷ってたんだ。"),
    D.S.p("アクセも合ってる。"),
    D.S.g("気づいてくれたの嬉しい…", { affection:2 })
  ]);

  window.DIALOGUE_PACKS = window.DIALOGUE_PACKS || [];
  window.DIALOGUE_PACKS.push(D.build());
})();
