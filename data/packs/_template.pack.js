// data/packs/_template.pack.js
// このファイルをコピペしてファイル名と中身を変えれば新しい pack を追加できます。
// 命名例：school.pack.js / food.pack.js / event.summer.pack.js など

(function(){
  const { createDialogues } = window.dialogues;         // 1) ビルダーを取得
  const D = createDialogues("your-pack-name");          // 2) “1つの会話パック”を開始

  // ========== ここから会話を追加していく ==========

  // 単発（1往復）を追加：
  // add(type, tension, tier, player, girl[, effect, weight])
  // - type:     "smalltalk" など 9カテゴリのキー
  // - tension:  "low"|"mid"|"high"|"any"
  // - tier:     "normal"|"friend"|"love"|"any"
  // - player:   プレイヤーの一言
  // - girl:     女の子の返答
  // - effect:   { affection:+3, tension:"high"|"+1"|"-1" } など（省略可）
  // - weight:   出やすさ（数値・省略可）
  D.add("smalltalk","any","any", "テンプレだよ", "了解");

  // 応酬（複数ターン）を追加：
  // script(type, tension, tier, steps[, weight])
  // steps は D.S.* で作る：
  //   D.S.p(text[, effect, {delayMs, sleepMs}])  … プレイヤー
  //   D.S.g(text[, effect, {delayMs, sleepMs}])  … 女の子（前に考え中ドットが入る）
  //   D.S.s(text[, effect, {delayMs, sleepMs}])  … システム
  //   D.S.if(cond, thenSteps[, elseSteps])       … 分岐（affection/tension/tierが使える）
  //   D.S.choose(prompt, [ D.S.opt(label, then[, effect, sleepMs]) ], who?, opts?) … 選択肢
  D.script("smalltalk","mid","normal", [
    D.S.p("テンプレの会話、はじめる？"),
    D.S.g("うん、試運転しよ〜"),
    D.S.if("affection>=120 && tension=='high'",
      [ D.S.g("なんだか調子いいかも！", { affection: 2 }) ],
      [ D.S.g("まぁ、ぼちぼち。") ]
    ),
    D.S.choose("次どうする？", [
      D.S.opt("コーヒー買う", [ D.S.g("わたしはカフェラテで！", { affection: 1 }) ]),
      D.S.opt("散歩する",     [ D.S.g("ゆっくり歩こ〜",          { tension: "mid" }) ])
    ])
  ], 2);

  // ========== ここまで ==========

  // 3) 完成データを“登録”する（複数 pack は main.js 側でマージ）
  window.DIALOGUE_PACKS = window.DIALOGUE_PACKS || [];
  window.DIALOGUE_PACKS.push(D.build());
})();
