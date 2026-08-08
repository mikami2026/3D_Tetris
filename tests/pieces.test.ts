import { describe, expect, it } from 'vitest';
import { PIECES } from '../src/core/pieces';
import { canonical, mirrorX, rotateCells, rotationOrbit } from '../src/core/rotation';
import { PIECE_IDS } from '../src/core/types';
import type { PieceId, Vec3 } from '../src/core/types';

const orbitOf = (id: PieceId) => rotationOrbit([...PIECES[id].cells] as Vec3[], PIECES[id].box);

/** 各軸のセル数（バウンディングボックスの辺長）。 */
function extents(cells: readonly Vec3[]): [number, number, number] {
  return [0, 1, 2].map((axis) => {
    const values = cells.map((c) => c[axis]);
    return Math.max(...values) - Math.min(...values) + 1;
  }) as [number, number, number];
}

describe('ピース定義', () => {
  it('8種すべてが4セルでボックス内に収まっている', () => {
    expect(PIECE_IDS).toHaveLength(8);
    for (const id of PIECE_IDS) {
      const { cells, box } = PIECES[id];
      expect(cells, id).toHaveLength(4);
      for (const [x, y, z] of cells) {
        expect([x, y, z].every((v) => v >= 0 && v < box), `${id} (${x},${y},${z})`).toBe(true);
      }
    }
  });

  it('4セルが連結している（バラバラの塊ではない）', () => {
    for (const id of PIECE_IDS) {
      const keys = new Set(PIECES[id].cells.map((c) => c.join(',')));
      const start = PIECES[id].cells[0];
      const seen = new Set<string>([start.join(',')]);
      const stack: Vec3[] = [[...start] as Vec3];
      while (stack.length > 0) {
        const [x, y, z] = stack.pop() as Vec3;
        const neighbours: Vec3[] = [
          [x + 1, y, z],
          [x - 1, y, z],
          [x, y + 1, z],
          [x, y - 1, z],
          [x, y, z + 1],
          [x, y, z - 1],
        ];
        for (const n of neighbours) {
          const key = n.join(',');
          if (keys.has(key) && !seen.has(key)) {
            seen.add(key);
            stack.push(n);
          }
        }
      }
      expect(seen.size, id).toBe(4);
    }
  });

  it('8種はすべて互いに異なる形（回転で重ならない）', () => {
    const orbits = PIECE_IDS.map((id) => ({ id, orbit: orbitOf(id) }));
    for (let i = 0; i < orbits.length; i++) {
      for (let j = i + 1; j < orbits.length; j++) {
        const a = orbits[i];
        const b = orbits[j];
        const overlap = [...a.orbit].some((key) => b.orbit.has(key));
        expect(overlap, `${a.id} と ${b.id} が同一形状`).toBe(false);
      }
    }
  });
});

describe('3Dにおける鏡像の扱い（8種になる根拠）', () => {
  it('S の鏡像（=Z）は S を回転すれば作れる → 同一ピース', () => {
    expect(orbitOf('S').has(canonical(mirrorX([...PIECES.S.cells] as Vec3[])))).toBe(true);
  });

  it('L の鏡像（=J）は L を回転すれば作れる → 同一ピース', () => {
    expect(orbitOf('L').has(canonical(mirrorX([...PIECES.L.cells] as Vec3[])))).toBe(true);
  });

  it('I / O / T / TRIPOD は鏡像が自分自身', () => {
    for (const id of ['I', 'O', 'T', 'TRIPOD'] as const) {
      expect(orbitOf(id).has(canonical(mirrorX([...PIECES[id].cells] as Vec3[]))), id).toBe(true);
    }
  });

  it('右ねじの鏡像は左ねじであり、回転では絶対に重ならない', () => {
    const mirroredR = canonical(mirrorX([...PIECES.SCREW_R.cells] as Vec3[]));
    expect(orbitOf('SCREW_L').has(mirroredR), '鏡像が左ねじと一致しない').toBe(true);
    expect(orbitOf('SCREW_R').has(mirroredR), '右ねじの回転で鏡像が作れてしまう').toBe(false);
  });
});

describe('回転ボックスの選択', () => {
  /** ピースの辺長とボックス辺長の偶奇がずれている軸の数。少ないほど回転時のズレが小さい。 */
  function offCenterAxes(cells: readonly Vec3[], box: number): number {
    return extents(cells).filter((e) => e % 2 !== box % 2).length;
  }

  it('各ピースのボックスは 3 / 4 のうち回転ズレが最小になる方を選んでいる', () => {
    for (const id of PIECE_IDS) {
      const { cells, box } = PIECES[id];
      const longest = Math.max(...extents(cells));
      const candidates = [3, 4].filter((b) => b >= longest);
      const best = Math.min(...candidates.map((b) => offCenterAxes(cells, b)));
      expect(offCenterAxes(cells, box), `${id} は box ${box} だがより良い候補がある`).toBe(best);
    }
  });

  it('立体3種は全軸の偶奇が揃っていて回転してもまったくズレない', () => {
    for (const id of ['TRIPOD', 'SCREW_R', 'SCREW_L'] as const) {
      expect(offCenterAxes(PIECES[id].cells, PIECES[id].box), id).toBe(0);
    }
  });

  it('どの向きに回してもボックスからはみ出さない', () => {
    for (const id of PIECE_IDS) {
      const { box } = PIECES[id];
      // 24通りの向きを実座標のまま探索する（正規化すると検証にならない）。
      const seen = new Set<string>();
      const queue: Vec3[][] = [[...PIECES[id].cells] as Vec3[]];
      while (queue.length > 0) {
        const current = queue.pop() as Vec3[];
        const key = current.map((c) => c.join(',')).sort().join('|');
        if (seen.has(key)) continue;
        seen.add(key);
        for (const [x, y, z] of current) {
          expect([x, y, z].every((v) => v >= 0 && v < box), `${id} → (${x},${y},${z})`).toBe(true);
        }
        for (const axis of ['x', 'y', 'z'] as const) {
          queue.push(rotateCells(current, axis, 1, box));
        }
      }
      expect(seen.size, `${id} の向きの数`).toBeGreaterThan(0);
    }
  });
});
