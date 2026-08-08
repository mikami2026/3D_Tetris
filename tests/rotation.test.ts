import { describe, expect, it } from 'vitest';
import {
  canonical,
  invRotX,
  invRotY,
  invRotZ,
  rotX,
  rotY,
  rotZ,
  rotateCells,
} from '../src/core/rotation';
import type { Vec3 } from '../src/core/types';

const BOXES = [3, 4];
const FORWARD = { x: rotX, y: rotY, z: rotZ };
const INVERSE = { x: invRotX, y: invRotY, z: invRotZ };
const AXES = ['x', 'y', 'z'] as const;

function allCells(box: number): Vec3[] {
  const out: Vec3[] = [];
  for (let x = 0; x < box; x++) {
    for (let y = 0; y < box; y++) {
      for (let z = 0; z < box; z++) out.push([x, y, z]);
    }
  }
  return out;
}

describe('90度回転の代数的性質', () => {
  for (const box of BOXES) {
    for (const axis of AXES) {
      it(`box ${box} / ${axis}軸: ボックス内の全単射である`, () => {
        const images = new Set(allCells(box).map((c) => FORWARD[axis](c, box).join(',')));
        expect(images.size).toBe(box ** 3);
        for (const image of images) {
          for (const v of image.split(',').map(Number)) {
            expect(v).toBeGreaterThanOrEqual(0);
            expect(v).toBeLessThan(box);
          }
        }
      });

      it(`box ${box} / ${axis}軸: 4回まわすと完全に元に戻る（ドリフトしない）`, () => {
        for (const cell of allCells(box)) {
          let c = cell;
          for (let i = 0; i < 4; i++) c = FORWARD[axis](c, box);
          expect(c).toEqual(cell);
        }
      });

      it(`box ${box} / ${axis}軸: 逆回転が正しく打ち消す`, () => {
        for (const cell of allCells(box)) {
          expect(INVERSE[axis](FORWARD[axis](cell, box), box)).toEqual(cell);
          expect(FORWARD[axis](INVERSE[axis](cell, box), box)).toEqual(cell);
        }
      });
    }

    it(`box ${box}: 回転は形を変えない（全セル間距離が保存される）`, () => {
      const shape: Vec3[] = [
        [0, 0, 0],
        [1, 0, 0],
        [1, 1, 0],
        [1, 1, 1],
      ];
      const dist = (cells: Vec3[]) =>
        cells
          .flatMap((a, i) =>
            cells.slice(i + 1).map((b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2),
          )
          .sort((a, b) => a - b);

      for (const axis of AXES) {
        expect(dist(rotateCells(shape, axis, 1, box))).toEqual(dist(shape));
        expect(dist(rotateCells(shape, axis, -1, box))).toEqual(dist(shape));
      }
    });
  }
});

describe('canonical', () => {
  it('平行移動しても同じ正規形になる', () => {
    const a: Vec3[] = [
      [0, 0, 0],
      [1, 0, 0],
    ];
    const b: Vec3[] = [
      [5, 3, 7],
      [6, 3, 7],
    ];
    expect(canonical(a)).toBe(canonical(b));
  });

  it('セルの並び順に依存しない', () => {
    const a: Vec3[] = [
      [0, 0, 0],
      [1, 0, 0],
      [0, 1, 0],
    ];
    expect(canonical(a)).toBe(canonical([...a].reverse()));
  });
});
