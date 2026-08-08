import { describe, expect, it } from 'vitest';
import { SCREEN_AWAY, SCREEN_RIGHT, resolveRotation, screenToWorld, turnView } from '../src/core/view';
import type { ViewDir } from '../src/core/types';

const DIRS: ViewDir[] = [0, 1, 2, 3];

/** -0 と +0 は toEqual/toBe が別物として扱うので潰しておく。 */
const norm = (v: number): number => v + 0;
const normPair = (p: readonly [number, number]): [number, number] => [norm(p[0]), norm(p[1])];

describe('視点と操作方向の対応', () => {
  it('視点0では「右」が +X、「奥」が -Z', () => {
    expect(screenToWorld(0, 1, 0)).toEqual([1, 0]);
    expect(screenToWorld(0, 0, 1)).toEqual([0, -1]);
  });

  it('視点を1つ進めるたびに方向ベクトルが90°回る', () => {
    for (const dir of DIRS) {
      const next = turnView(dir, 1);
      const [x, z] = SCREEN_RIGHT[dir];
      // xz平面で (x, z) → (z, -x) の回転
      expect(normPair(SCREEN_RIGHT[next])).toEqual(normPair([z, -x]));
      const [ax, az] = SCREEN_AWAY[dir];
      expect(normPair(SCREEN_AWAY[next])).toEqual(normPair([az, -ax]));
    }
  });

  it('「右」と「奥」は常に直交する', () => {
    for (const dir of DIRS) {
      const r = SCREEN_RIGHT[dir];
      const a = SCREEN_AWAY[dir];
      expect(norm(r[0] * a[0] + r[1] * a[1])).toBe(0);
    }
  });

  it('どの視点でも右へ4回動かすと元に戻る', () => {
    for (const dir of DIRS) {
      let x = 0;
      let z = 0;
      let d: ViewDir = dir;
      for (let i = 0; i < 4; i++) {
        const [dx, dz] = screenToWorld(d, 1, 0);
        x += dx;
        z += dz;
        d = turnView(d, 1);
      }
      expect([x, z]).toEqual([0, 0]);
    }
  });

  it('turnView は 0..3 を循環する', () => {
    expect(turnView(3, 1)).toBe(0);
    expect(turnView(0, -1)).toBe(3);
  });
});

describe('画面基準の回転軸の解決', () => {
  it('yaw は視点によらず常にワールドY軸', () => {
    for (const dir of DIRS) {
      expect(resolveRotation('yaw', 1, dir)).toEqual({ axis: 'y', turn: 1 });
      expect(resolveRotation('yaw', -1, dir)).toEqual({ axis: 'y', turn: -1 });
    }
  });

  it('pitch は画面右方向の軸まわりになる', () => {
    expect(resolveRotation('pitch', 1, 0)).toEqual({ axis: 'x', turn: 1 }); // 右 = +X
    expect(resolveRotation('pitch', 1, 1)).toEqual({ axis: 'z', turn: -1 }); // 右 = -Z
    expect(resolveRotation('pitch', 1, 2)).toEqual({ axis: 'x', turn: -1 }); // 右 = -X
    expect(resolveRotation('pitch', 1, 3)).toEqual({ axis: 'z', turn: 1 }); // 右 = +Z
  });

  it('roll は画面手前（視点に向かう）方向の軸まわりになる', () => {
    expect(resolveRotation('roll', 1, 0)).toEqual({ axis: 'z', turn: 1 }); // 手前 = +Z
    expect(resolveRotation('roll', 1, 1)).toEqual({ axis: 'x', turn: 1 }); // 手前 = +X
    expect(resolveRotation('roll', 1, 2)).toEqual({ axis: 'z', turn: -1 });
    expect(resolveRotation('roll', 1, 3)).toEqual({ axis: 'x', turn: -1 });
  });

  it('pitch と roll の軸は必ず食い違う（同じ軸に潰れない）', () => {
    for (const dir of DIRS) {
      expect(resolveRotation('pitch', 1, dir).axis).not.toBe(resolveRotation('roll', 1, dir).axis);
    }
  });

  it('回転方向を反転すると符号だけが反転する', () => {
    for (const dir of DIRS) {
      for (const kind of ['pitch', 'roll'] as const) {
        const fwd = resolveRotation(kind, 1, dir);
        const back = resolveRotation(kind, -1, dir);
        expect(back.axis).toBe(fwd.axis);
        expect(back.turn).toBe(-fwd.turn);
      }
    }
  });
});
