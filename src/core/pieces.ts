import type { PieceId, Vec3 } from './types';
import { PIECE_IDS } from './types';

export interface PieceDef {
  readonly id: PieceId;
  /** 回転ボックスの一辺。3 か 4。 */
  readonly box: number;
  /** ボックス内に中央寄せされたセル集合。 */
  readonly cells: readonly Vec3[];
  readonly color: number;
}

/**
 * 回転ボックスの辺長は「ピースの伸びている方向の長さと偶奇を揃える」必要がある。
 * 偶奇がずれると 90° 回転のたびにピースが 1 セル横滑りする（2D SRS が
 * T/L/J/S/Z に 3×3、I/O に 4×4 を使い分けているのと同じ理由）。
 *
 *   L / T / S      … 長辺 3（奇数）→ box 3
 *   I              … 長辺 4（偶数）→ box 4
 *   O / 立体3種    … 各辺 2（偶数）→ box 4
 */
interface RawPiece {
  box: number;
  cells: Vec3[];
  color: number;
}

const RAW: Record<PieceId, RawPiece> = {
  // --- 平面形 5 種 -------------------------------------------------------
  // 3Dでは裏返せるため、S と Z、L と J はそれぞれ同一のピースになる。
  I: {
    box: 4,
    cells: [
      [0, 0, 0],
      [1, 0, 0],
      [2, 0, 0],
      [3, 0, 0],
    ],
    color: 0x22d3ee,
  },
  O: {
    box: 4,
    cells: [
      [0, 0, 0],
      [1, 0, 0],
      [0, 0, 1],
      [1, 0, 1],
    ],
    color: 0xfacc15,
  },
  L: {
    box: 3,
    cells: [
      [0, 0, 0],
      [1, 0, 0],
      [2, 0, 0],
      [2, 0, 1],
    ],
    color: 0xfb923c,
  },
  T: {
    box: 3,
    cells: [
      [0, 0, 0],
      [1, 0, 0],
      [2, 0, 0],
      [1, 0, 1],
    ],
    color: 0xc084fc,
  },
  S: {
    box: 3,
    cells: [
      [0, 0, 0],
      [1, 0, 0],
      [1, 0, 1],
      [2, 0, 1],
    ],
    color: 0x4ade80,
  },

  // --- 立体形 3 種 -------------------------------------------------------
  /** 三又: 1セルから X / Y / Z の3方向へ腕が伸びる。鏡像は自分自身。 */
  TRIPOD: {
    box: 4,
    cells: [
      [0, 0, 0],
      [1, 0, 0],
      [0, 0, 1],
      [0, 1, 0],
    ],
    color: 0x60a5fa,
  },
  /** 右ねじ: +X → +Z → +Y と3回連続で直交方向に曲がる螺旋。 */
  SCREW_R: {
    box: 4,
    cells: [
      [0, 0, 0],
      [1, 0, 0],
      [1, 0, 1],
      [1, 1, 1],
    ],
    color: 0xef4444,
  },
  /** 左ねじ: +X → +Z → -Y。右ねじの鏡像で、3D回転では絶対に重ならない。 */
  SCREW_L: {
    box: 4,
    cells: [
      [0, 1, 0],
      [1, 1, 0],
      [1, 1, 1],
      [1, 0, 1],
    ],
    color: 0xe2e8f0,
  },
};

/**
 * セル集合をボックスの中央に寄せる。
 * 移動量 s は「移動後の中心 (min+max)/2 + s がボックス中心 (box-1)/2 になる」よう決める。
 */
function centerInBox(cells: Vec3[], box: number): Vec3[] {
  const shift = [0, 1, 2].map((axis) => {
    let min = Infinity;
    let max = -Infinity;
    for (const cell of cells) {
      const v = cell[axis];
      if (v < min) min = v;
      if (v > max) max = v;
    }
    return Math.round((box - 1 - min - max) / 2);
  });
  return cells.map(([x, y, z]) => [x + shift[0], y + shift[1], z + shift[2]] as Vec3);
}

function build(id: PieceId): PieceDef {
  const raw = RAW[id];
  const cells = centerInBox(raw.cells, raw.box);

  // 定義ミスは起動時に落とす。3D形状は目視で検証しづらいため。
  if (cells.length !== 4) {
    throw new Error(`piece ${id}: expected 4 cells, got ${cells.length}`);
  }
  const seen = new Set(cells.map((c) => c.join(',')));
  if (seen.size !== 4) {
    throw new Error(`piece ${id}: duplicate cells`);
  }
  for (const [x, y, z] of cells) {
    if (x < 0 || y < 0 || z < 0 || x >= raw.box || y >= raw.box || z >= raw.box) {
      throw new Error(`piece ${id}: cell (${x},${y},${z}) is outside its ${raw.box}-box`);
    }
  }

  return { id, box: raw.box, cells, color: raw.color };
}

export const PIECES: Record<PieceId, PieceDef> = Object.fromEntries(
  PIECE_IDS.map((id) => [id, build(id)]),
) as Record<PieceId, PieceDef>;

/** 画面表示用の名前。立体3種は SCREW_R のような内部IDのままだと読みにくいので整える。 */
export const PIECE_LABELS: Record<PieceId, string> = {
  I: 'I',
  O: 'O',
  L: 'L',
  T: 'T',
  S: 'S',
  TRIPOD: 'Tripod',
  SCREW_R: 'R-Screw',
  SCREW_L: 'L-Screw',
};
