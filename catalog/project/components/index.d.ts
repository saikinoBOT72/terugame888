/** 壁蹴りタワーの素材ライブラリ（window.Kabe）。単位はゲーム内の px、1マス = 18px。 */
type ZoneId = 'underground' | 'surface' | 'sky' | 'space';
/** ゾーンの色。tokens.json の名前をキャメルケースにしたもの（bg-top → bgTop）。 */
interface Palette { id: ZoneId; [token: string]: string; }
type Pose = 'stand' | 'cling' | 'jump' | 'air' | 'hurt';
type GhostVariant = 'sheet';
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
  hud(g: CanvasRenderingContext2D, P: Palette, w: number, h: number, meters: number): void;
  /** 4ゾーンを横に並べて動かす（見本ページ用） */
  zoneRow(root: HTMLElement, opt: { w: number; h: number; zoom?: number; label?: string; bg?: boolean; draw(g: CanvasRenderingContext2D, P: Palette, t: number): void }): void;
  /** キャラ候補1案ぶんの見本 */
  ghostSheet(root: HTMLElement, variant: GhostVariant): void;
};
