# おばけじゃんぴんぐ（旧：壁蹴りタワー） — 作業メモ（Claude 用）

壁を蹴って縦穴を登るゲーム「おばけじゃんぴんぐ」。ユーザーとは日本語で、短く、くだけた言葉で話す。
決まったことは `IDEAS.md`（ソロ / 2人対戦 / 開発用。未決の ☐ もここ）、`STAGES.md`（パーツ・チェック・プール）、`catalog/project/README.md`（絵の決まり）。ここに同じことを書き写さない。

## ファイル
**ソロ（本編）**
| ファイル | 中身 |
|---|---|
| `index.html` | 本編。`bundle.js`（`Kabe`）・`catalog/project/tokens.css`・`data/pieces.js` を読み込む |
| `data/pieces.js` | パーツ `piece(...)` とプール `POOLS`（`KABE_DATA`）。本編・2人対戦・`pools.html` が共通で読む |
| `manifest.webmanifest`・`sw.js`・`icons/` | ホーム画面アプリ用（sw.js は毎回サーバーに確かめ、取れないときだけ前に取ったものを返す。控えは `?v=` ごと。起動時と戻ったときに `autoUpdate` が新しい版を見て、タイトルなら読み直す。アイコンは `tools/make_icon.js`） |

モードは `MODE`（simple＝シンプルジャンプ／advance＝アドバンス。`MODES`・「モード」の区切り。復活は `respDown`→`respawn`）。タイトル `#ovTitle`：モード選び・プレイ・着せ替え（`WARDROBE`：着る `scarf`・かぶる `hat`・小物 `prop`。絵は `Kabe.OUTFIT`・`outfitIcon`。最初から全部選べる。着ているもの `kabe_look2`）・設定（`#ovSettings`。タブ：音・画面・その他）。ろうそく・ろうそくガチャはやめた（絵の `Kabe.candle`・`gachaLantern` はカタログに残す）。UI は文の長さ・タブ・モードを変えてもボタンが動かないように、枠の高さを決めておく（モードの枠 `.modeBox`、設定の `.setList`、着せ替えの色 `.swatches`）。「ひとりで」の横の「ふたりで」は `versus.html` へ。右上「開発」に開発用ページへのリンク。

**2人対戦**
| ファイル | 中身 |
|---|---|
| `versus.html` | 親ページ。本編を `index.html?vs=0`・`?vs=1` で左右に2つ並べ、入力（コントローラー2台・キーボード・プレイ中のタッチは膜 `.tl` でまとめて受けて `tap`）・音（`__vsAudio`）・溶岩と時計・相手の位置・勝ち負け・対面（左を逆さ）を受け持つ |
| `index.html` の「2人対戦」の区切り | `VERSUS`（上の方で定義）があるときだけ動く。地形の乱数 `trnd` を種つきにする・親とのやりとり `window.__vs`（start・title・input・get・put・frame・fx・pad・mode・halt）・相手をうすく描く `vsRival`。ループは親が `frame` で回し、溶岩と試合の時計（`G.time`＝障害物の動き）も親が `put` で配る。タイトルは `body.vs.p1`／`p2` で左右の中身を変える。着せ替えは全部使えて `kabe_vs_look0/1` に覚える |

本編を変えるときは2人対戦でも動くかを気にする（`state`・`press`・`end` まわり）。

**開発用**
| ファイル | 中身 |
|---|---|
| `pools.html` | プールとパーツの一覧（動く見本・「ここから遊ぶ」・「ボット ▶」でボットの遊びを再生・「直す」でメーカーへ） |
| `maker.html` | パーツメーカー（タッチ向け）。はじめはパーツ一覧（プールごとの絵・下書きだけに絞れる・上のボタンでいつでも開く）→文字のマス目に塗る（◀ ▶ で前・次のパーツ、← 一覧でメーカーの一覧へ）→「チェック」（本編を見えない枠で開いて `checkPiece`）・「試す ▶」（`index.html?try`：`kabe_maker_try` のパーツ `__try` を繰り返す）・「コピー」（`piece(...)` の文。ユーザーが貼ってきたら pieces.js に入れる。一覧の「まとめて出す」で下書きを複数選んで1つの文に）。下書きは端末に `kabe_maker_drafts`（pieces.js と同じになった下書きは開いたときに消える） |
| `data/piece_view.js` | パーツの見本の描き方と浮きの調べ方（`KABE_VIEW`：prepare・draw・mounts）。pools.html・maker.html・tools/check.js が共通で使う |
| `simulator.html` | 壁ジャンプの数値だけを試すシミュレーター |
| `chara.html` | キャラの動き・表情・マフラー（本編の `updatePose`・`scarfStep` を写したもの。変えたらこちらも合わせる。マフラーの形は `Kabe.SCARF`） |
| `catalog/project/` | 統一カタログの元ファイル。`components/bundle.js` が全素材の描画ライブラリ `Kabe` |
| `tools/` | 確認用スクリプト（下の「確かめ方」）と公開用のコピー作り |

`index.html` の区切り（`grep -n "^/\* ===" index.html`）：動きの数値 → 地形 → 動き（`physStep`、ゲームとチェックで共通）→ 到達チェック → ゲーム → 見た目（2D）→ シェーダー（`glfx`）→ 効果音 → モード → 2人対戦。
画面は #cv（2D）→ #gl（シェーダー）→ #hud（HUD）の3枚重ね。画面の形が `ASPECT`（0.375〜0.8）の間なら画面いっぱい（太い分は額縁 `#deco`、`resize` と `decoSync`）。ガチャの演出は #gShow（2D）を `showFx` が別の WebGL canvas（.gshowfx）で仕上げる。
きれい画質は 2D の画面を送らず、GPU の中で組み立てる（`drawGL` → `glfx.scene`）。地形・地層は1回だけ絵にして少しずつ送り、丸・線・溶岩は GPU で描き、キャラなど動く物だけ小さい絵にまとめて送る。#cv に描くのは「かるい」と D・V の表示のときだけ。描く物を足したら `drawGL` 側にも足す。`?perf` で1フレームに送った量（送信 k/f）が見られる。
軽さの決まり：毎フレーム描き直して送ってよいのはオバケだけ。動く物は1回描いて GPU で回す（`wspr` の rot）か、動きを段階に分けて絵を使い回す。小さく動く粒は GPU の点（`wdisc`）。背景3枚は半分の解像度。点光源と影は1/4の「光の地図」。HUD は表示が変わったときだけ描く。`?perf` の下の段に、1フレームの内訳（動き・組み立て・送る・仕上げ・HUD）が出る。

## GitHub Pages（だれでも遊べる）
- https://saikinobot72.github.io/terugame888/ （ソロ）、`/versus.html`（2人対戦）、`/pools.html`・`/maker.html`・`/simulator.html`・`/chara.html`（開発用）。ブランチ `claude/laughing-hypatia-idf7le` の直下をそのまま配信（`.nojekyll` あり）。
- **作業のたびに必ずコミットして push する**（ユーザーの指示）。`index.html` を変えたら先頭の `VERSION` を上げる。番号は日本の日付と、その日の何回目か（`2026.11.21.1`、`TZ=Asia/Tokyo date +%Y.%m.%d`）（タイトルの「アプデ」ボタンが新旧を見分ける）。読み込む3つ（tokens.css・bundle.js・pieces.js）の `?v=` も同じ番号なので、`sed -i "s/旧番号/新番号/g" index.html` でまとめて上げる（GitHub Pages は10分ほど古いファイルを返すので、新旧が混ざらないように）。

## 公開ページ（private）
| ページ | URL | 元ファイル |
|---|---|---|
| 本編 | https://claude.ai/artifact/JQSvu1ytAC94zC9rFFfeJg | `index.html` |
| シミュレーター | https://claude.ai/artifact/U5ZPbS8p3TFK4EzUXYnmLP | `simulator.html` |
| 統一カタログ | https://claude.ai/artifact/Wsug5KamAvvHNbWAuxyc7e | `catalog/project/` |

- 本編：`python3 tools/build_artifact.py index.html <スクラッチ>/kabegeri-game.html`（読み込むファイルを埋め込んだ1ファイル）を `url` 付きで publish。出し直す前に、いまの版を `read` して全部読む必要があるので重い。ユーザーに頼まれたときだけ。
- カタログ：変えたファイルだけを `root: catalog`、`file_path` は `design-system.json` の絶対パス、`url` 付きで1回の publish。直前に `project/design-system.json` を `read` して `lastChange` だけ書き換える。`index.d.ts` は `{"from": ..., "contentType": "text/plain"}`。`tokens.css` はカタログのページが作るので送らない（手元の `tokens.css` は本編用に自分で作り直す）。送る前に `list`（scope files）の sha256 と手元を比べて、違うファイルを全部送る。見本は `<!-- @dsCard group=… height=… -->` で始める。

## 確かめ方（自分でテスト用スクリプトを書かない）
- 難しさ：`node tools/difficulty.js`（プールごとの中央値と目標、外れたものに▲▽。1つなら id を渡す）。計算は `tools/diff_core.js`（目標 `TARGET` もここ）。易しすぎるパーツには `node tools/harden.js <id> <目標> [ceil]` がトゲを足す案を、難しすぎるパーツには `node tools/ease.js <id> <目標>` がトゲを外す案を、仕掛けが多くて難しすぎるパーツには `node tools/lighten.js <id> <目標>` が仕掛けを1つずつ外す案を出す（どれも書き換えない）。新しいパーツはプールの目標の幅に入れる。目標は 700m の 2.4 まで上がり、上空（800m〜）はほぼ平ら（1100m で 2.5）
- パーツ・動き・当たり判定：`node tools/check.js`（1つなら `node tools/check.js z1_funnel`）。全部 OK・詰み0・「浮き」（壁から浮いた杭・扇風機など）0が必須。回る棒・箱・シャッターはチェックでは「無い」扱いなので、壁の張り付き位置に届かないかは自分で確かめる。
- 本物の動きで遊ばせる：`node tools/bot.js <id | プール番号 | all> [-n 12] [-j 4]`（ボットが本物の `update()` で動く物ごと遊ぶ。2手先まで試して選び、押す時間に人っぽいずれ ±15/40/80ms。ずれ0 でノーダメで抜けられないと NG。成功率から「ボD」。中身は `tools/bot_core.js`。`index.html?bot` のときだけ読み込まれ、index.html の中で eval される。`?bot=<id>` は本物の画面で再生（`pools.html` の「ボット ▶」）。1パーツ10〜60秒）
- 本編の見た目や処理：`node tools/smoke.js 20`（ガチャ所は自動で閉じる）。
- 2人対戦：`smoke.js` は本編（ソロ）だけ。`versus.html` は開いて、左右で地形のパーツの並びが同じか・相手がうすく出るかを見る。
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
- 生き物は出さない（障害物は無機物）。赤（`scarf`）はプレイヤーの着せ替え（マフラー・帽子など）とハートだけ。危険なものは灰色の金属（`hazard`）。
- 強化（水晶）は動きを強くする方向だけ。
