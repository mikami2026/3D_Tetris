import type { Vec3, WorldAxis, Turn } from './types';

/**
 * n×n×n ボックス内の 90° 回転。
 *
 * 各写像は [0, n-1] を [0, n-1] へ写す全単射なので、整数のまま完全に可逆で、
 * 何度回しても座標のドリフトや丸め誤差が発生しない。
 * 3つとも行列式 +1 の正しい回転（鏡映ではない）。
 */
export const rotX = ([x, y, z]: Vec3, n: number): Vec3 => [x, n - 1 - z, y];
export const rotY = ([x, y, z]: Vec3, n: number): Vec3 => [z, y, n - 1 - x];
export const rotZ = ([x, y, z]: Vec3, n: number): Vec3 => [n - 1 - y, x, z];

export const invRotX = ([x, y, z]: Vec3, n: number): Vec3 => [x, z, n - 1 - y];
export const invRotY = ([x, y, z]: Vec3, n: number): Vec3 => [n - 1 - z, y, x];
export const invRotZ = ([x, y, z]: Vec3, n: number): Vec3 => [y, n - 1 - x, z];

const FORWARD: Record<WorldAxis, (c: Vec3, n: number) => Vec3> = {
  x: rotX,
  y: rotY,
  z: rotZ,
};
const INVERSE: Record<WorldAxis, (c: Vec3, n: number) => Vec3> = {
  x: invRotX,
  y: invRotY,
  z: invRotZ,
};

/** セル集合をワールド軸まわりに 90° 回す。 */
export function rotateCells(cells: Vec3[], axis: WorldAxis, turn: Turn, box: number): Vec3[] {
  const fn = turn > 0 ? FORWARD[axis] : INVERSE[axis];
  return cells.map((c) => fn(c, box));
}

/**
 * 回転が衝突したときに試すオフセット。上から順に試し、最初に成功したものを採用する。
 * 上方向（+Y）のキックを含めることで、壁際・床際でも立体ピースが回りやすくなる。
 */
export const KICKS: readonly Vec3[] = [
  [0, 0, 0],
  [1, 0, 0],
  [-1, 0, 0],
  [0, 0, 1],
  [0, 0, -1],
  [0, 1, 0],
  [1, 1, 0],
  [-1, 1, 0],
  [0, 1, 1],
  [0, 1, -1],
  [0, 2, 0],
] as const;

/** セル集合を「最小値が0、順序が一意」な正規形に直し、比較用の文字列を返す。 */
export function canonical(cells: Vec3[]): string {
  let mx = Infinity;
  let my = Infinity;
  let mz = Infinity;
  for (const [x, y, z] of cells) {
    if (x < mx) mx = x;
    if (y < my) my = y;
    if (z < mz) mz = z;
  }
  return cells
    .map(([x, y, z]) => `${x - mx},${y - my},${z - mz}`)
    .sort()
    .join('|');
}

/**
 * 3D の 24 通りの回転をすべて適用し、得られる正規形の集合（回転軌道）を返す。
 * 2つの形状が「回転で重なるか」を判定するのに使う。
 */
export function rotationOrbit(cells: Vec3[], box: number): Set<string> {
  const seen = new Set<string>();
  const queue: Vec3[][] = [cells];
  seen.add(canonical(cells));

  while (queue.length > 0) {
    const current = queue.pop() as Vec3[];
    for (const axis of ['x', 'y', 'z'] as const) {
      const next = rotateCells(current, axis, 1, box);
      const key = canonical(next);
      if (!seen.has(key)) {
        seen.add(key);
        queue.push(next);
      }
    }
  }
  return seen;
}

/** X軸方向に鏡映した（左右反転した）セル集合を返す。 */
export function mirrorX(cells: Vec3[]): Vec3[] {
  return cells.map(([x, y, z]) => [-x, y, z] as Vec3);
}
