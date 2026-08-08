import type { RotAxis, Turn, ViewDir, WorldAxis } from './types';

/**
 * 画面「右」に対応するワールド方向 [dx, dz]。
 *
 *   ViewDir 0 (North) … カメラは +Z 側から -Z を見る
 *   ViewDir 1 (East)  … カメラは +X 側から -X を見る
 *   以降 90° ずつ時計回り。
 */
export const SCREEN_RIGHT: Record<ViewDir, readonly [number, number]> = {
  0: [1, 0],
  1: [0, -1],
  2: [-1, 0],
  3: [0, 1],
};

/** 画面「奥」（視点から遠ざかる向き）に対応するワールド方向 [dx, dz]。 */
export const SCREEN_AWAY: Record<ViewDir, readonly [number, number]> = {
  0: [0, -1],
  1: [-1, 0],
  2: [0, 1],
  3: [1, 0],
};

/**
 * 画面基準の移動量をワールドの [dx, dz] に変換する。
 * これがあるおかげで「→」はどの視点でも常に画面上の右へ動く。
 */
export function screenToWorld(dir: ViewDir, right: number, away: number): [number, number] {
  const r = SCREEN_RIGHT[dir];
  const a = SCREEN_AWAY[dir];
  return [right * r[0] + away * a[0], right * r[1] + away * a[1]];
}

export interface SignedAxis {
  axis: WorldAxis;
  sign: Turn;
}

function toSignedAxis([dx, dz]: readonly [number, number]): SignedAxis {
  return dx !== 0
    ? { axis: 'x', sign: dx > 0 ? 1 : -1 }
    : { axis: 'z', sign: dz > 0 ? 1 : -1 };
}

/**
 * 画面基準の回転指示をワールド軸に解決する。
 *
 *   yaw   … 常にワールドY軸（「上から見て時計回り」は視点に依存しないため）
 *   pitch … 画面右方向の軸まわり
 *   roll  … 画面手前（視点に向かってくる）方向の軸まわり
 */
export function resolveRotation(
  kind: RotAxis,
  turn: Turn,
  dir: ViewDir,
): { axis: WorldAxis; turn: Turn } {
  if (kind === 'yaw') return { axis: 'y', turn };

  const signed =
    kind === 'pitch'
      ? toSignedAxis(SCREEN_RIGHT[dir])
      : toSignedAxis([-SCREEN_AWAY[dir][0], -SCREEN_AWAY[dir][1]]);

  return { axis: signed.axis, turn: (signed.sign * turn) as Turn };
}

export const turnView = (dir: ViewDir, delta: 1 | -1): ViewDir =>
  (((dir + delta) % 4) + 4) % 4 as ViewDir;
