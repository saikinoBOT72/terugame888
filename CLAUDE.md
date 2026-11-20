# おばけじゃんぴんぐ（旧：壁蹴りタワー） — 作業メモ（Claude 用）

壁を蹴って縦穴を登るゲーム「おばけじゃんぴんぐ」。ユーザーとは日本語で、短く、くだけた言葉で話す。
決まったことは `IDEAS.md`（動き・ローグライク・見た目）、`STAGES.md`（パーツとチェック）、`catalog/project/README.md`（絵の決まり）。ここに同じことを書き写さない。

## ファイル
| ファイル | 中身 |
|---|---|
| `index.html` | 本編。`bundle.js`（`Kabe`）・`tokens.css`・`data/pieces.js` を読み込む |
| `data/pieces.js` | パーツ `piece(...)` とプール `POOLS`（`KABE_DATA`）。本編と `pools.html` が共通で読む |
| （タイトル） | `#ovTitle`：プレイ・着せ替え（`WARDROBE`：分類→品物→色。持ち物 `kabe_owned`・着ているもの `kabe_look2`）・ろうそくガチャ（`#ovLook`、演出は水晶ガチャと同じ `show`（`kind: 'look'`）とシェーダー `showFx`、器は `Kabe.gachaLantern`）・設定（`#ovSettings`）。ろうそく（`kabe_candles`）は結果画面で 100m ごとに1本（`META`）。右上「開発」に chara・pools・simulator・?perf |
| `pools.html` | プールとパーツの一覧（動く見本） |
| `simulator.html` | 壁ジャンプの数値だけを試すシミュレーター |
| `chara.html` | キャラの動き・表情・マフラーを再生して試すページ（本編のポーズ切り替えとマフラーのひもを写したもの。マフラーの形は `Kabe.SCARF`。本編の `updatePose`・`scarfStep` を変えたらこちらも合わせる） |
| `catalog/project/` | 統一カタログの元ファイル。`components/bundle.js` が全素材の描画ライブラリ `Kabe` |
| `tools/` | 確認用スクリプト（下の「確かめ方」）と公開用のコピー作り、アイコン作り（`make_icon.js`） |
| `manifest.webmanifest`・`sw.js`・`icons/` | ホーム画面アプリ用（オフラインは sw.js が前に取ったものを返す） |

`index.html` の区切り（`grep -n "^/\* ===" index.html`）：動きの数値 → 地形 → 動き（`physStep`、ゲームとチェックで共通）→ 到達チェック → ゲーム → 見た目（2D）→ シェーダー（`glfx`）→ 効果音。
画面は #cv（2D）→ #gl（シェーダー）→ #hud（HUD）の3枚重ね。ガチャの演出は #gShow（2D）を `showFx` が別の WebGL canvas（.gshowfx）で仕上げる。
きれい画質は 2D の画面を送らず、GPU の中で組み立てる（`drawGL` → `glfx.scene`）。地形・地層は1回だけ絵にして少しずつ送り、丸・線・溶岩は GPU で描き、キャラなど動く物だけ小さい絵にまとめて送る。#cv に描くのは「かるい」と D・V の表示のときだけ。描く物を足したら `drawGL` 側にも足す。`?perf` で1フレームに送った量（送信 k/f）が見られる。
軽さの決まり：毎フレーム描き直して送ってよいのはオバケだけ。動く物は1回描いて GPU で回す（`wspr` の rot）か、動きを段階に分けて絵を使い回す。小さく動く粒は GPU の点（`wdisc`）。背景3枚は半分の解像度。点光源と影は1/4の「光の地図」。HUD は表示が変わったときだけ描く。`?perf` の下の段に、1フレームの内訳（動き・組み立て・送る・仕上げ・HUD）が出る。

## GitHub Pages（だれでも遊べる）
- https://saikinobot72.github.io/terugame888/ （本編）、`/pools.html`、`/simulator.html`、`/chara.html`。ブランチ `claude/laughing-hypatia-idf7le` の直下をそのまま配信（`.nojekyll` あり）。
- **作業のたびに必ずコミットして push する**（ユーザーの指示）。`index.html` を変えたら先頭の `VERSION` を上げる（タイトルの「アプデ」ボタンが新旧を見分ける）。読み込む3つ（tokens.css・bundle.js・pieces.js）の `?v=` も同じ番号なので、`sed -i "s/旧番号/新番号/g" index.html` でまとめて上げる（GitHub Pages は10分ほど古いファイルを返すので、新旧が混ざらないように）。

## 公開ページ（private）
| ページ | URL | 元ファイル |
|---|---|---|
| 本編 | https://claude.ai/artifact/JQSvu1ytAC94zC9rFFfeJg | `index.html` |
| シミュレーター | https://claude.ai/artifact/U5ZPbS8p3TFK4EzUXYnmLP | `simulator.html` |
| 統一カタログ | https://claude.ai/artifact/Wsug5KamAvvHNbWAuxyc7e | `catalog/project/` |

- 本編：`python3 tools/build_artifact.py index.html <スクラッチ>/kabegeri-game.html`（読み込むファイルを埋め込んだ1ファイル）を `url` 付きで publish。出し直す前に、いまの版を `read` して全部読む必要があるので重い。ユーザーに頼まれたときだけ。
- カタログ：変えたファイルだけを `root: catalog`、`file_path` は `design-system.json` の絶対パス、`url` 付きで1回の publish。直前に `project/design-system.json` を `read` して `lastChange` だけ書き換える。`index.d.ts` は `{"from": ..., "contentType": "text/plain"}`。`tokens.css` はカタログのページが作るので送らない（手元の `tokens.css` は本編用に自分で作り直す）。送る前に `list`（scope files）の sha256 と手元を比べて、違うファイルを全部送る。見本は `<!-- @dsCard group=… height=… -->` で始める。

## 確かめ方（自分でテスト用スクリプトを書かない）
- 難しさ：`node tools/difficulty.js`（プールごとの中央値と目標、外れたものに▲▽。1つなら id を渡す）。計算は `tools/diff_core.js`（目標 `TARGET` もここ）。易しすぎるパーツには `node tools/harden.js <id> <目標> [ceil]` がトゲを足す案を出す（書き換えない）。新しいパーツはプールの目標の幅に入れる
- パーツ・動き・当たり判定：`node tools/check.js`（1つなら `node tools/check.js z1_funnel`）。全部 OK・詰み0が必須。回る棒・箱・シャッターはチェックでは「無い」扱いなので、壁の張り付き位置に届かないかは自分で確かめる。
- 本編の見た目や処理：`node tools/smoke.js 20`（ガチャ所は自動で閉じる）。
- カタログ：`node tools/catalog_preview.js [見本名]`。
- スクショは1回の作業で1〜2枚まで。必要な所だけ切り出す。

## トークン節約のルール
1. 大きいファイル（`index.html`、`bundle.js`、`data/pieces.js`）は丸ごと読まない。`grep -n` で探し、`Read` は範囲だけ。
2. 直しは差分だけ（Edit、または python の文字列置換）。置換で行末に注釈を足すとき、その行の続きを消さない。
3. 一度読んだ内容・出した結果を読み直さない。
4. 返事は短く。何を変えたか・確かめた結果・次に決めてほしいことだけ。
5. 迷ったら作る前に短く聞く。大きな作業は「やること3〜5行」を先に見せる。
6. 候補案は1ページにまとめ、スクラッチに置いて `SendUserFile` で送る（リポジトリに入れない）。
7. git：ブランチ `claude/laughing-hypatia-idf7le` にコミットして push。

## 守ること（ユーザーの指示）
- 生き物は出さない（障害物は無機物）。赤（`scarf`）はマフラーとハートだけ。危険なものは灰色の金属（`hazard`）。
- 強化（水晶）は動きを強くする方向だけ。

## 未決
パーツのつなぎ口の種類、100mの切り替わりのゲート、難しさの上がり方、地上・上空・宇宙の「下から迫るもの」、400mより上のプール。
