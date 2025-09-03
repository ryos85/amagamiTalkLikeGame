// data/packs/adult.pack.js
(function(){
  const { createDialogues } = window.dialogues;
  const D = createDialogues("adult-pack");

  D.any("adult", "ちょっとドキッとした。", "え…なにそれ|気になること言うね…");

  D.script("adult","high","friend", [
    D.S.p("手、つないでもいい？"),
    D.S.g("……うん。", { affection:2 }, { delayMs: 800 }),
    D.S.p("温かいね。"),
    D.S.g("離さないで。", { affection:2 })
  ]);

  D.script("adult","high","love", [
    D.S.p("距離、近いかも。"),
    D.S.g("近いほうが安心するの。", { affection:2 })
  ]);

  window.DIALOGUE_PACKS = window.DIALOGUE_PACKS || [];
  window.DIALOGUE_PACKS.push(D.build());
})();
