import type { Vec3 } from './types';

/** フィールドの幅（X）・奥行き（Z）。 */
export const W = 4;
export const D = 4;
/** プレイヤーに見える高さ。 */
export const VISIBLE_H = 12;
/** 配列上の高さ。VISIBLE_H の上に4層のスポーンバッファを持つ。 */
export const H = 16;
/** 1層のセル数。 */
export const LAYER = W * D;

export const cellIndex = (x: number, y: number, z: number): number => (y * D + z) * W + x;

export class Board {
  readonly cells: Uint8Array;

  constructor(cells?: Uint8Array) {
    this.cells = cells ?? new Uint8Array(W * D * H);
  }

  clone(): Board {
    return new Board(this.cells.slice());
  }

  reset(): void {
    this.cells.fill(0);
  }

  inBounds(x: number, y: number, z: number): boolean {
    return x >= 0 && x < W && z >= 0 && z < D && y >= 0 && y < H;
  }

  get(x: number, y: number, z: number): number {
    return this.cells[cellIndex(x, y, z)];
  }

  set(x: number, y: number, z: number, value: number): void {
    this.cells[cellIndex(x, y, z)] = value;
  }

  /** そのセルが範囲内かつ空か。 */
  isFree(x: number, y: number, z: number): boolean {
    return this.inBounds(x, y, z) && this.cells[cellIndex(x, y, z)] === 0;
  }

  /** ワールド座標のセル集合が全て置けるか。 */
  canPlace(worldCells: readonly Vec3[]): boolean {
    for (const [x, y, z] of worldCells) {
      if (!this.isFree(x, y, z)) return false;
    }
    return true;
  }

  place(worldCells: readonly Vec3[], value: number): void {
    for (const [x, y, z] of worldCells) {
      this.cells[cellIndex(x, y, z)] = value;
    }
  }

  isLayerFull(y: number): boolean {
    const base = y * LAYER;
    for (let i = 0; i < LAYER; i++) {
      if (this.cells[base + i] === 0) return false;
    }
    return true;
  }

  /**
   * 埋まった層をすべて消し、上の層を詰める。消した層のY座標（昇順）を返す。
   *
   * 1層ずつ消しながら詰めるとインデックスがずれてバグの温床になるので、
   * 先に全対象を集めてから1回のパスで詰める。
   */
  clearFullLayers(): number[] {
    const cleared: number[] = [];
    for (let y = 0; y < H; y++) {
      if (this.isLayerFull(y)) cleared.push(y);
    }
    if (cleared.length === 0) return cleared;

    let write = 0;
    for (let read = 0; read < H; read++) {
      if (cleared.includes(read)) continue;
      if (write !== read) {
        this.cells.copyWithin(write * LAYER, read * LAYER, (read + 1) * LAYER);
      }
      write++;
    }
    this.cells.fill(0, write * LAYER);
    return cleared;
  }

  /** ピースコードごとのセル数。空セルは含まない。 */
  countByCode(): Map<number, number> {
    const counts = new Map<number, number>();
    for (const code of this.cells) {
      if (code !== 0) counts.set(code, (counts.get(code) ?? 0) + 1);
    }
    return counts;
  }

  /** 指定コードのセルをすべて消す。消した数を返す。 */
  removeCode(code: number): number {
    let removed = 0;
    for (let i = 0; i < this.cells.length; i++) {
      if (this.cells[i] === code) {
        this.cells[i] = 0;
        removed++;
      }
    }
    return removed;
  }

  /**
   * 各列で宙に浮いたブロックを下に詰める。
   * 色を消したあとは必ず呼ぶこと。呼ばないとブロックが空中に残る。
   */
  collapseColumns(): void {
    for (let x = 0; x < W; x++) {
      for (let z = 0; z < D; z++) {
        let write = 0;
        for (let read = 0; read < H; read++) {
          const value = this.cells[cellIndex(x, read, z)];
          if (value === 0) continue;
          if (write !== read) {
            this.cells[cellIndex(x, write, z)] = value;
            this.cells[cellIndex(x, read, z)] = 0;
          }
          write++;
        }
      }
    }
  }

  /** 積み上がっている最も高いセルの y + 1（空なら 0）。 */
  stackHeight(): number {
    for (let y = H - 1; y >= 0; y--) {
      const base = y * LAYER;
      for (let i = 0; i < LAYER; i++) {
        if (this.cells[base + i] !== 0) return y + 1;
      }
    }
    return 0;
  }
}
