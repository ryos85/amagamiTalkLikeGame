// data/packs/study.pack.js
(function(){
  const { createDialogues } = window.dialogues;
  const D = createDialogues("study-pack");

  D.any("study", "宿題もう終わった？", "まだ半分…。終わったら連絡するね");

  D.script("study","mid","normal", [
    D.S.p("一緒に勉強する？"),
    D.S.g("うん、30分だけ付き合って！"),
    D.S.p("OK、まずは英語からいこう。"),
    D.S.g("発音、{name}のが好き。なんか落ち着く。", { affection: 1 })
  ], 2);

  D.script("study","high","friend", [
    D.S.p("苦手なとこ、どこ？"),
    D.S.g("数学…説明してくれたら、がんばれる気がする！"),
    D.S.p("じゃ、公式からサクッと復習。"),
    D.S.g("わかった…！今日はちゃんと頭に入ってるかも。", { affection: 2 })
  ]);

  window.DIALOGUE_PACKS = window.DIALOGUE_PACKS || [];
  window.DIALOGUE_PACKS.push(D.build());
})();
