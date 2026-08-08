import { describe, expect, it } from 'vitest';
import { Board, D, H, VISIBLE_H, W } from '../src/core/board';

function fillLayer(board: Board, y: number, value = 1): void {
  for (let x = 0; x < W; x++) {
    for (let z = 0; z < D; z++) board.set(x, y, z, value);
  }
}

describe('Board', () => {
  it('サイズは 4 × 4 × 16（可視12＋スポーンバッファ4）', () => {
    expect([W, D, VISIBLE_H, H]).toEqual([4, 4, 12, 16]);
    expect(new Board().cells).toHaveLength(W * D * H);
  });

  it('範囲外は置けない', () => {
    const board = new Board();
    expect(board.isFree(0, 0, 0)).toBe(true);
    expect(board.isFree(-1, 0, 0)).toBe(false);
    expect(board.isFree(W, 0, 0)).toBe(false);
    expect(board.isFree(0, -1, 0)).toBe(false);
    expect(board.isFree(0, H, 0)).toBe(false);
    expect(board.isFree(0, 0, D)).toBe(false);
  });

  it('16セル揃った層だけが埋まったと判定される', () => {
    const board = new Board();
    fillLayer(board, 0);
    expect(board.isLayerFull(0)).toBe(true);
    board.set(2, 0, 3, 0);
    expect(board.isLayerFull(0)).toBe(false);
  });

  it('1層消すと上の層が1つ下がる', () => {
    const board = new Board();
    fillLayer(board, 0, 1);
    board.set(3, 1, 3, 7); // 消えない層に目印を置く

    expect(board.clearFullLayers()).toEqual([0]);
    expect(board.get(3, 0, 3)).toBe(7);
    expect(board.get(3, 1, 3)).toBe(0);
    expect(board.isLayerFull(0)).toBe(false);
  });

  it('離れた複数層を同時に消してもインデックスがずれない', () => {
    const board = new Board();
    fillLayer(board, 0, 1);
    board.set(0, 1, 0, 5); // 残る層 A
    fillLayer(board, 2, 1);
    board.set(1, 3, 1, 6); // 残る層 B

    expect(board.clearFullLayers()).toEqual([0, 2]);
    // A は 1 → 0 へ、B は 3 → 1 へ落ちる
    expect(board.get(0, 0, 0)).toBe(5);
    expect(board.get(1, 1, 1)).toBe(6);
    expect(board.stackHeight()).toBe(2);
  });

  it('4層同時消去', () => {
    const board = new Board();
    for (let y = 0; y < 4; y++) fillLayer(board, y);
    expect(board.clearFullLayers()).toEqual([0, 1, 2, 3]);
    expect(board.stackHeight()).toBe(0);
  });

  it('埋まった層がなければ何も起きない', () => {
    const board = new Board();
    fillLayer(board, 0);
    board.set(0, 0, 0, 0);
    expect(board.clearFullLayers()).toEqual([]);
    expect(board.stackHeight()).toBe(1);
  });

  it('clone は独立したコピーを返す', () => {
    const board = new Board();
    board.set(1, 1, 1, 3);
    const copy = board.clone();
    copy.set(1, 1, 1, 0);
    expect(board.get(1, 1, 1)).toBe(3);
  });
});
