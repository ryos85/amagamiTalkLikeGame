// data/packs/hobby.pack.js
(function(){
  const { createDialogues } = window.dialogues;
  const D = createDialogues("hobby-pack");

  D.any("hobby", "最近ハマってるものある？", "ショート動画！");

  D.script("hobby","mid","normal", [
    D.S.p("おすすめ教えて"),
    D.S.g("癒やされるBGMのチャンネルあるよ。"),
    D.S.p("ほんと？リンク送って。"), 
    D.S.if("tension=='high' || affection>=140",
      [ D.S.g("了解〜、一緒に聴こ。", { affection:1 }) ],
      [ D.S.g("…暇なときでいい？") ]
    )
  ]);

  window.DIALOGUE_PACKS = window.DIALOGUE_PACKS || [];
  window.DIALOGUE_PACKS.push(D.build());
})();
