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
