/** 壁蹴りタワーの素材ライブラリ（window.Kabe）。単位はゲーム内の px、1マス = 18px。 */
type ZoneId = 'underground' | 'surface' | 'sky' | 'space';
/** ゾーンの色。tokens.json の名前をキャメルケースにしたもの（bg-top → bgTop）。 */
interface Palette { id: ZoneId; [token: string]: string; }
type Pose = 'stand' | 'cling' | 'jump' | 'air' | 'hurt';
type GhostVariant = 'sheet';
type GemKind = 'greed' | 'hover' | 'slide' | 'triple' | 'predict' | 'turn';
interface Grid { rows: number; cols: number; }
declare const Kabe: {
  CELL: 18;
  ZONES: { id: ZoneId; name: string }[];
  /** ゾーンの色をまとめて読む */
  pal(zone: ZoneId): Palette;
  /** 1文字1マスの地図（# 壁 . 空間 ^ トゲ / \ 45度の斜め）。上の行から */
  grid(map: string[], outside?: '#' | '.'): Grid;
  background(g: CanvasRenderingContext2D, P: Palette, x: number, y: number, w: number, h: number, t: number, scroll?: number): void;
  terrain(g: CanvasRenderingContext2D, P: Palette, G: Grid, t: number, ox?: number, oy?: number): void;
  spike(g: CanvasRenderingContext2D, P: Palette, x: number, y: number, dir: 'L' | 'R' | 'T' | 'B'): void;
  decor(g: CanvasRenderingContext2D, P: Palette, x: number, y: number, scale: number, t: number, seed: number): void;
  /** 行って戻る 0→1→0（端で少し止まる）。往復ブロックの位置に使う */
  slide(t: number, period?: number, offset?: number, hold?: number): number;
  /** 出入りトゲの状態。amount 出ている割合 0〜1、hurt 痛いかどうか */
  popState(t: number, opt?: { in?: number; warn?: number; out?: number; offset?: number }): { s: 'in' | 'warn' | 'out'; k: number; amount: number; hurt: boolean };
  /** 出入りトゲ。(x, y) はマスの左上、dir は生える壁の側。状態を返す */
  popSpike(g: CanvasRenderingContext2D, P: Palette, x: number, y: number, dir: 'L' | 'R' | 'T' | 'B', t: number, opt?: { in?: number; warn?: number; out?: number; offset?: number }): { s: string; amount: number; hurt: boolean };
  /** 鉄の箱。axis 'x' は左右の面、'y' は上下の面にトゲ */
  ironBox(g: CanvasRenderingContext2D, P: Palette, x: number, y: number, w: number, h: number, axis: 'x' | 'y'): void;
  /** 箱の通り道 */
  track(g: CanvasRenderingContext2D, P: Palette, x0: number, y0: number, x1: number, y1: number): void;
  spinAngle(t: number, speed?: number, offset?: number): number;
  /** 回る棒。len は軸から先までの長さ、a は角度 */
  spinner(g: CanvasRenderingContext2D, P: Palette, x: number, y: number, len: number, a: number): void;
  /** シャッターの状態。close 閉じ具合 0〜1 */
  shutterState(t: number, opt?: { open?: number; warn?: number; closed?: number; offset?: number }): { s: 'open' | 'warn' | 'closed'; k: number; close: number };
  /** シャッター。x0, x1 は左右の壁の面、y は板の真ん中 */
  shutter(g: CanvasRenderingContext2D, P: Palette, x0: number, x1: number, y: number, t: number, opt?: { open?: number; warn?: number; closed?: number; offset?: number }): { s: string; close: number };
  /** 扇風機。(x, y) は壁の面、dir は風の向き、reach 風の届く長さ。痛くない */
  fan(g: CanvasRenderingContext2D, P: Palette, x: number, y: number, dir: 'L' | 'R' | 'T' | 'B', reach: number, t: number, on?: boolean): void;
  FAN_BAND: number;
  rise(g: CanvasRenderingContext2D, P: Palette, x: number, y: number, w: number, h: number, t: number): void;
  /** プレイヤー（白いおばけ）。face: 1 右向き / -1 左向き */
  ghost(g: CanvasRenderingContext2D, P: Palette, variant: GhostVariant, pose: Pose, x: number, y: number, t: number, face?: 1 | -1, scale?: number): void;
  effects(g: CanvasRenderingContext2D, P: Palette, x: number, y: number, t: number): void;
  /** 画面の表示の見本。crystals 結晶の数、gems 装備（右上に丸い枠2つ） */
  hud(g: CanvasRenderingContext2D, P: Palette, w: number, h: number, meters: number, opt?: { hp?: number; crystals?: number; gems?: ({ kind: GemKind; star: number; lv?: number; cool?: number } | null)[]; t?: number }): void;
  /** 水晶の種類と★の数 */
  GEM_KINDS: Record<GemKind, { name: string; star: 1 | 2 | 3 }>;
  GEM_ORDER: GemKind[];
  /** レア度の色 [ベース, 影] */
  gemTone(P: Palette, star: number): [string, string];
  /** 結晶（お金）：glow の光の粒。s が 1 以上ならまわりを小さな粒が回る */
  mote(g: CanvasRenderingContext2D, P: Palette, x: number, y: number, t: number, s?: number, seed?: number): void;
  /** 水晶。star 2 でかけら1つ、3 でかけら2つ＋きらめき。高さは 18×s */
  gem(g: CanvasRenderingContext2D, P: Palette, kind: GemKind, star: number, x: number, y: number, s?: number, t?: number): void;
  /** 装備の枠。kind が null なら空き枠。cool はリチャージの残り 0〜1 */
  gemBadge(g: CanvasRenderingContext2D, P: Palette, kind: GemKind | null, star: number, x: number, y: number, t: number, opt?: { lv?: number; cool?: number; r?: number }): void;
  /** ガチャ所（ランタン塔）。(x, y) は床の真ん中。lit=false で使ったあと */
  gachaHouse(g: CanvasRenderingContext2D, P: Palette, x: number, y: number, t: number, lit: boolean): void;
  /** ガチャのフラスコ。spin 0〜1 で液が波打ち湯気が出る。liquid は液の色。口は y-46、台の下は y+42 */
  gachaFlask(g: CanvasRenderingContext2D, P: Palette, x: number, y: number, t: number, spin?: number, liquid?: string): void;
  /** 十字のきらめき（光） */
  twinkle(g: CanvasRenderingContext2D, x: number, y: number, len: number, alpha: number): void;
  /** 出た水晶のまわりの光。k は 0→1 で広がる */
  gemBurst(g: CanvasRenderingContext2D, P: Palette, star: number, x: number, y: number, t: number, k: number): void;
  /** 4ゾーンを横に並べて動かす（見本ページ用） */
  zoneRow(root: HTMLElement, opt: { w: number; h: number; zoom?: number; label?: string; bg?: boolean; draw(g: CanvasRenderingContext2D, P: Palette, t: number): void }): void;
  /** キャラ候補1案ぶんの見本 */
  ghostSheet(root: HTMLElement, variant: GhostVariant): void;
};
