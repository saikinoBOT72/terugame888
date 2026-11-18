地形のブロックです。地形は縁取らず、明るい縁と影で形を見せます。

- 空間に面した角だけ `corner-block` で丸める。となりが壁の角は丸めない。
- 上の面：`terrain-light` の帯（4px）＋縁の飾り `accent`。4つに1つに光る飾り（`glow`）。
- 下の面：`terrain-shade` の帯（3px）。半分くらいに垂れるもの（根・霧・結晶）。
- 奥行き：空間に面したマスは `terrain`、1マス奥は半分混ぜ、2マス奥は `terrain-deep`。
- 面の模様：地層の線（`terrain-line`）1本と、粒（`terrain-grain`）。

使い方：`Kabe.terrain(g, P, Kabe.grid(地図), t)`。地図は1文字1マス（`#` 壁、`.` 空間）。
