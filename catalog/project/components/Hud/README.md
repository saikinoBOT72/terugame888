画面の表示です。どのゾーンでも同じ作りで、色だけゾーンに合わせます。

- 丸い板（`ui-panel` を85%、`corner-pill`）に `ui-ink` の文字。画面の端から `hud-gap`。
- HPはハート3つ（`scarf`）。減った分は `ui-ink` の25%。
- 高さは `hud-number`（15px・太字）。層の名前は `hud-label`。
- 結晶の数はハートの下の丸い板（`Kabe.mote` の印＋数）。
- 装備している水晶は右上に丸い枠2つ（`Kabe.gemBadge`）。空き枠は点線。リチャージ中は暗い扇形が減っていく。
- `Kabe.hud(g, P, w, h, 高さ, {hp, crystals, gems, t})` で見本を描く。本編は同じ並びを自分で描く。
