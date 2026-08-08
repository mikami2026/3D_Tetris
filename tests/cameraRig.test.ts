import { describe, expect, it } from 'vitest';
import { CameraRig, TURN_DURATION_MS } from '../src/render/cameraRig';
import { SCREEN_RIGHT } from '../src/core/view';

/** カメラ位置から見た「画面右」の向きを xz 平面で求める。 */
function screenRightFromCamera(rig: CameraRig): [number, number] {
  const forward = {
    x: rig.target.x - rig.camera.position.x,
    z: rig.target.z - rig.camera.position.z,
  };
  // 上向き(0,1,0) との外積が画面右。y成分を落として xz だけ見る。
  return [-forward.z, forward.x];
}

describe('CameraRig', () => {
  it('回転先の視点は押した瞬間に切り替わる（入力が待たされない）', () => {
    const rig = new CameraRig();
    expect(rig.viewDir).toBe(0);
    rig.turn(1);
    expect(rig.viewDir).toBe(1);
    rig.turn(1);
    expect(rig.viewDir).toBe(2);
  });

  it('角度は瞬間移動せず 250ms かけて 90° 進む', () => {
    const rig = new CameraRig();
    rig.turn(1);
    expect(rig.angleDeg).toBe(0);
    expect(rig.isTurning).toBe(true);

    rig.update(TURN_DURATION_MS / 2);
    const middle = rig.angleDeg;
    expect(middle).toBeGreaterThan(0);
    expect(middle).toBeLessThan(90);

    rig.update(TURN_DURATION_MS / 2);
    expect(rig.angleDeg).toBeCloseTo(90);
    expect(rig.isTurning).toBe(false);
  });

  it('角度は単調に増える（行き過ぎて戻らない）', () => {
    const rig = new CameraRig();
    rig.turn(1);
    let previous = -Infinity;
    for (let i = 0; i < 30; i++) {
      rig.update(TURN_DURATION_MS / 20);
      expect(rig.angleDeg).toBeGreaterThanOrEqual(previous);
      previous = rig.angleDeg;
    }
    expect(previous).toBeCloseTo(90);
  });

  it('3→0 を跨いでも逆回転で270°戻ったりしない', () => {
    const rig = new CameraRig();
    for (let i = 0; i < 4; i++) {
      rig.turn(1);
      rig.update(TURN_DURATION_MS);
    }
    expect(rig.viewDir).toBe(0);
    expect(rig.angleDeg).toBeCloseTo(360); // 0 に巻き戻さず回り続ける
  });

  it('補間の途中で回しても角度が飛ばない', () => {
    const rig = new CameraRig();
    rig.turn(1);
    rig.update(TURN_DURATION_MS * 0.4);
    const before = rig.angleDeg;

    rig.turn(1); // 到着前に追加入力
    rig.update(1);
    expect(Math.abs(rig.angleDeg - before)).toBeLessThan(5);

    rig.update(TURN_DURATION_MS);
    expect(rig.angleDeg).toBeCloseTo(180);
    expect(rig.viewDir).toBe(2);
  });

  it('カメラの実際の向きが core/view.ts の SCREEN_RIGHT と一致する', () => {
    const rig = new CameraRig();
    for (const dir of [0, 1, 2, 3] as const) {
      rig.update(TURN_DURATION_MS); // 到着させる
      const [x, z] = screenRightFromCamera(rig);
      const length = Math.hypot(x, z);
      const expected = SCREEN_RIGHT[dir];

      expect(x / length, `dir ${dir} の x`).toBeCloseTo(expected[0]);
      expect(z / length, `dir ${dir} の z`).toBeCloseTo(expected[1]);

      rig.turn(1);
    }
  });
});
