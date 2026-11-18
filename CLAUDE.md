# 壁蹴りタワー — 作業メモ（Claude 用）

壁を蹴って縦穴を登るゲーム。ユーザーとは日本語で、短く、くだけた言葉で話す。
決まったことの詳細は `IDEAS.md`（動き・方針）、`STAGES.md`（パーツとチェック）、`catalog/project/README.md`（絵の決まり）。ここに同じことを書き写さない。

## ファイル
| ファイル | 中身 |
|---|---|
| `index.html` | 本編（約1150行）。絵は `catalog/project/components/bundle.js`（`Kabe`）と `tokens.css` を読み込んで描く（カタログを変えると本編も変わる） |
| `simulator.html` | 壁ジャンプの数値だけを試すシミュレーター |
| `catalog/project/` | 統一カタログ（Design System 型の公開ページ）の元ファイル。`components/bundle.js` が全素材の描画ライブラリ `Kabe` |
| `tools/` | 確認用スクリプト（下の「確かめ方」） |

`index.html` の中の区切り（`grep -n "^/\* ===" index.html` で行番号を出す）：
動きの数値 `MOVE` → パーツ `piece(...)` と `POOLS` → 地形（マス目→線分） → 動き（`physStep`、ゲームとチェックで共通） → 到達チェック `checkPiece` → ゲーム（状態・更新） → 見た目（`ART`・描画） → 効果音。

## GitHub Pages（だれでも遊べる）
- URL：https://saikinobot72.github.io/terugame888/ （本編）、`/simulator.html`。ブランチ `claude/laughing-hypatia-idf7le` の直下をそのまま配信（`.nojekyll` あり）。
- **作業のたびに必ずコミットして push する**（ユーザーの指示）。`index.html` を変えたら先頭の `VERSION` を上げてから push（タイトルの「アプデ」ボタンがこれで新旧を見分ける）。

## 公開ページ（private。ユーザーが共有メニューで共有しない限り本人だけ）
| ページ | URL | 元ファイル |
|---|---|---|
| 本編 | https://claude.ai/artifact/JQSvu1ytAC94zC9rFFfeJg | `index.html` |
| シミュレーター | https://claude.ai/artifact/U5ZPbS8p3TFK4EzUXYnmLP | `simulator.html` |
| 統一カタログ | https://claude.ai/artifact/Wsug5KamAvvHNbWAuxyc7e | `catalog/project/` |

- 本編・シミュレーターの更新：`python3 tools/build_artifact.py index.html <スクラッチ>/kabegeri-game.html` で外枠を外し、読み込んでいる bundle.js・tokens.css を埋め込んだコピーを作り、`url` を付けて publish。会話の最初の publish の前に、その URL を一度 `read` する（読まずに出すと断られる）。
- カタログの更新：変えたファイルだけを `root: catalog`、`url` 付きで1回の publish に入れる。消すファイルは `null`。`index.d.ts` は `{"from": ..., "contentType": "text/plain"}`。`project/design-system.json` は直前に `read` して、`lastChange` だけ書き換えて同じ呼び出しに入れる。型の説明書（SKILL.md・format.md など）は読み直さない。要点：トークンは一覧形式、`tokens.css` は自分で書いた（`tokens.json` を変えたら作り直す）、見本は `<!-- @dsCard group=… height=… -->` で始める。

## 確かめ方（自分でテスト用スクリプトを書かない）
- パーツ・動き・当たり判定を変えた：`node tools/check.js`（1つだけなら `node tools/check.js z1_funnel`）。全部 OK・詰み0が必須。
- 本編の見た目や処理を変えた：`node tools/smoke.js 20`。エラーの有無と、スクショ1枚（一時フォルダ）。
- カタログを変えた：`node tools/catalog_preview.js [見本名]`。
- スクショは1回の作業で1〜2枚まで。見るときは必要な所だけ切り出す。

## トークン節約のルール
1. 大きいファイル（`index.html`、`bundle.js`）は丸ごと読まない。`grep -n` で場所を探し、`Read` は offset/limit で必要な範囲だけ。
2. 直しは差分だけ（Edit、または python の文字列置換）。ファイル全体の書き直しは、作り直しを頼まれたときだけ。
3. 一度読んだ内容・一度出した結果を、同じ会話で読み直さない・出し直さない。
4. 返事は短く。何を変えたか・確かめた結果・次に決めてほしいことだけ。説明が長くなる決まりごとは MD に書いて、チャットで繰り返さない。
5. 迷ったら作る前に短く聞く。大きな作業は「やること3〜5行」を先に見せる。
6. 見本ページや候補案を作るときは、1ページにまとめる。役目を終えたページ・ファイルはユーザーに確認して消す。
7. git：ブランチ `claude/laughing-hypatia-idf7le` にコミットして push。一時ファイルはスクラッチに置き、リポジトリに入れない。

## いまの状態と次にやること
- 決まり：見た目はC「フラット」、音は「やわらか」、最初のゾーンは地下。プレイヤーは B1「ふんわり」（白いおばけ・線の目・薄ピンクの頬・赤いマフラー）。
- 本編の描画はカタログ通り（キャラB1・地形・トゲ・コウモリ・溶岩・画面の表示・メニューの色）。ポーズは `Kabe.POSES` の5つへ少しずつ寄せて、マフラーとすそを遅らせている。ランタンと画面の上下の暗がりはカタログに無いので外した。ボタンは赤を使えないので `ui-ink`。
- 未決：パーツのつなぎ口の種類、100mの切り替わりのゲート、難しさの上がり方、入れる障害物（候補は `IDEAS.md`）、地上・上空・宇宙の「下から迫るもの」。
