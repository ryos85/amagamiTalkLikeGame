// data/dialogues.builder.js
// ============================================================
// 会話データ“構築専用”のビルダー。
// - 目的：JSON直書きのダルさを解消し、関数で量産できるようにする。
// - 出力：最終的に「type → tension → tier → 配列」の入れ子構造を返す。
//   例）root["smalltalk"]["mid"]["love"] = [ {player, girl, ...}, ... ]
// - 特殊キー： "any" を使うと「どのテンション/帯でも使う」汎用バケット。
// ============================================================

(function () {
    /** 小さな補助：存在しなければ作る（オブジェクト） */
    function ensureObj(obj, key) {
        return (obj[key] ??= {});
    }

    /** 指定の入れ子（type/tension/tier）まで降り、配列バケットを返す */
    function ensureBucket(root, type, tension, tier) {
        const t = ensureObj(root, type);      // 例: smalltalk
        const ten = ensureObj(t, tension);      // 例: mid / any
        const r = (ten[tier] ??= []);         // 例: love / any
        return r;                               // ここに push していく
    }

    /**
     * createDialogues:
     *   1つの会話“パック”を作るためのビルダーを返す。
     *   最後に build() で完成データ（素のオブジェクト）を取得。
     */
    function createDialogues(packName = "pack") {
        // ルート構造（最終的に window.DIALOGUE_PACKS に入れる素データ）
        const root = {};

        /**
         * add(type, tension, tier, player, girl, effect?, weight?)
         *   単発の1往復（プレイヤー→女の子）パターンを追加。
         *
         *  - type:     "smalltalk" などカテゴリ
         *  - tension:  "low"|"mid"|"high"|"any"
         *  - tier:     "normal"|"friend"|"love"|"any"
         *  - player:   プレイヤーのセリフ（文字列）
         *  - girl:     女の子の返答（文字列 or 配列）
         *  - effect:   { affection:+3, tension:"high"|"+1"|"-1" } 等（任意）
         *  - weight:   出やすさ（任意, 既定=1）
         */
        function add(type, tension, tier, player, girl, effect = {}, weight = 1) {
            const bucket = ensureBucket(root, type, tension, tier);
            const text = Array.isArray(girl) ? String(girl[0] ?? "") : String(girl);
            bucket.push({ player, girl: text, effect, weight });
        }

        /**
         * script(type, tension, tier, steps, weight?)
         *   複数ターンの“応酬会話”を追加。
         *  - steps: runScript() が順に処理する配列（D.S.* で作るのが楽）
         *    例: [{ who:"player", text:"やぁ"}, { who:"girl", text:"こんにちは" }]
         */
        function script(type, tension, tier, steps, weight = 1) {
            const bucket = ensureBucket(root, type, tension, tier);
            bucket.push({ script: steps, weight });
        }

        /**
         * any(type, player, girl, effect?, weight?)
         *   完全汎用（tension:any, tier:any）へ単発を追加。
         */
        function any(type, player, girl, effect = {}, weight = 1) {
            add(type, "any", "any", player, girl, effect, weight);
        }

        // ------------------------------------------------------------
        // S: スクリプト記述を簡単にするショートカット
        // ------------------------------------------------------------
        const S = {
            /**
             * p/g/s : 1行のステップを作る（who = player/girl/system）
             *  - text:   セリフ（配列 or "A|B|C" でランダム化可）
             *  - effect: 各行ごとに効果を付与（任意）
             *  - opts:   { delayMs, sleepMs } 返答前/後の待機を個別調整
             */
            p: (text, effect, opts = {}) => ({ who: "player", text, effect, delayMs: opts.delayMs, sleepMs: opts.sleepMs }),
            g: (text, effect, opts = {}) => ({ who: "girl", text, effect, delayMs: opts.delayMs, sleepMs: opts.sleepMs }),
            s: (text, effect, opts = {}) => ({ who: "system", text, effect, delayMs: opts.delayMs, sleepMs: opts.sleepMs }),

            /**
             * if(cond, thenSteps, elseSteps?)
             *  - cond: "affection>=150 && tension=='high'" のような簡易式
             *  - then/else: それぞれ配列（中に S.p/S.g/S.s や S.if/S.choose を入れられる）
             */
            if: (cond, thenSteps, elseSteps = []) => ({ if: cond, then: thenSteps, else: elseSteps }),

            /**
             * choose(prompt, options, who?, opts?)
             *  - prompt: 選択前に表示する問い（null なら出さない。直前のセリフが問いになる）
             *  - options: 配列（S.opt(...), S.opt(...)）
             *  - who: 問いかけの話者（既定="girl"）
             */
            choose: (prompt, options, who = "girl", opts = {}) =>
                ({ prompt, choice: options, who, delayMs: opts.delayMs, sleepMs: opts.sleepMs }),

            /**
             * opt(label, then, effect?, sleepMs?)
             *  - label: 選択肢に表示される文言（プレイヤーの発話としてログにも残る）
             *  - then:  選択後に実行される steps 配列
             *  - effect/sleepMs: 押した直後の効果と待機（任意）
             */
            opt: (label, then, effect, sleepMs) => ({ label, then, effect, sleepMs })
        };

        /**
         * build(): これまでに追加した内容を“素のオブジェクト”で返す。
         *  - main.js の loadData() でマージして使われます。
         */
        function build() { return root; }

        // 使う関数群を公開
        return { add, script, any, S, build, packName };
    }

    // 名前もとりあえず公開しておく（ログなどに使いたい場合）
    function packName() { /* 何か必要なら拡張。今はダミー */ }

    // ------------------------------------------------------------
    // グローバル公開
    // ------------------------------------------------------------
    window.dialogues = { createDialogues };
})();
