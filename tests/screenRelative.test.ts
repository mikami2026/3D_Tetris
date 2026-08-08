import { describe, expect, it } from 'vitest';
import { Game } from '../src/core/game';
import { SCREEN_AWAY, SCREEN_RIGHT, screenToWorld } from '../src/core/view';
import type { Vec3, ViewDir } from '../src/core/types';

const DIRS: ViewDir[] = [0, 1, 2, 3];

/** ワールド座標を画面の軸へ射影する。画面上でどちらに動いたかを数値で見るため。 */
function project(cells: Vec3[], axis: readonly [number, number]): number {
  const total = cells.reduce((sum, [x, , z]) => sum + x * axis[0] + z * axis[1], 0);
  return total / cells.length;
}

/**
 * M3 の完了条件そのもの：どの視点でも「→」が画面上の右へ動くこと。
 * 視点ごとに変わる世界軸へ正しく変換できているかを、実際に Game を動かして確認する。
 */
describe('画面基準の移動', () => {
  it('どの視点でも「右」を押すと画面上で右へ1マス動く', () => {
    let moved = 0;
    for (const dir of DIRS) {
      for (let seed = 0; seed < 20; seed++) {
        const game = new Game({ seed, startLevel: 5 });
        const before = project(game.activeCells() as Vec3[], SCREEN_RIGHT[dir]);

        const [dx, dz] = screenToWorld(dir, 1, 0);
        if (!game.move(dx, dz)) continue; // 壁際で動けないケースは飛ばす

        const after = project(game.activeCells() as Vec3[], SCREEN_RIGHT[dir]);
        expect(after - before, `dir ${dir} / seed ${seed}`).toBeCloseTo(1);
        moved++;
      }
    }
    expect(moved, '一度も動けていない（テストが成立していない）').toBeGreaterThan(0);
  });

  it('どの視点でも「奥」を押すと画面上で奥へ1マス動く', () => {
    let moved = 0;
    for (const dir of DIRS) {
      for (let seed = 0; seed < 20; seed++) {
        const game = new Game({ seed, startLevel: 5 });
        const before = project(game.activeCells() as Vec3[], SCREEN_AWAY[dir]);

        const [dx, dz] = screenToWorld(dir, 0, 1);
        if (!game.move(dx, dz)) continue;

        const after = project(game.activeCells() as Vec3[], SCREEN_AWAY[dir]);
        expect(after - before, `dir ${dir} / seed ${seed}`).toBeCloseTo(1);
        moved++;
      }
    }
    expect(moved).toBeGreaterThan(0);
  });

  it('同じ「右」でも視点ごとに動くワールド軸が変わる', () => {
    // 視点0/2 では X が、視点1/3 では Z が動く。
    expect(screenToWorld(0, 1, 0)[0]).not.toBe(0);
    expect(screenToWorld(0, 1, 0)[1]).toBe(0);
    expect(screenToWorld(1, 1, 0)[0]).toBe(0);
    expect(screenToWorld(1, 1, 0)[1]).not.toBe(0);
    // 反対側から見ると同じ軸が逆向きになる。
    expect(screenToWorld(2, 1, 0)[0]).toBe(-screenToWorld(0, 1, 0)[0]);
    expect(screenToWorld(3, 1, 0)[1]).toBe(-screenToWorld(1, 1, 0)[1]);
  });

  it('右→左と押せば必ず元の位置に戻る（どの視点でも）', () => {
    for (const dir of DIRS) {
      const game = new Game({ seed: 5 });
      const origin = (game.activeCells() as Vec3[]).map((c) => c.join(',')).sort();

      const [rx, rz] = screenToWorld(dir, 1, 0);
      if (!game.move(rx, rz)) continue;
      expect(game.move(-rx, -rz)).toBe(true);

      expect((game.activeCells() as Vec3[]).map((c) => c.join(',')).sort()).toEqual(origin);
    }
  });
});
