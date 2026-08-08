import type { PieceId } from './types';

/**
 * 最初に出るピース。平面5種だけなら、3D空間での回転がまだ頭で追える。
 */
export const STARTER_PIECES: readonly PieceId[] = ['I', 'O', 'L', 'T', 'S'];

/**
 * 立体ピースの解禁レベル。
 *
 * 三又とねじ2種は 4×4 の狭いフィールドで詰まりの主因になるので、
 * 平面ピースの扱いに慣れてから出てくるようにする。
 * ねじは左右が鏡像で紛らわしいため、三又より後に、2種まとめて解禁する。
 */
export const UNLOCKS: readonly { readonly level: number; readonly ids: readonly PieceId[] }[] = [
  { level: 3, ids: ['TRIPOD'] },
  { level: 5, ids: ['SCREW_R', 'SCREW_L'] },
];

/** そのレベルで出現しうるピース一覧。 */
export function piecePoolForLevel(level: number): PieceId[] {
  const pool = [...STARTER_PIECES];
  for (const unlock of UNLOCKS) {
    if (level >= unlock.level) pool.push(...unlock.ids);
  }
  return pool;
}

/** ちょうどこのレベルで解禁されたピース。お知らせ表示に使う。 */
export function unlockedAtLevel(level: number): readonly PieceId[] {
  return UNLOCKS.find((unlock) => unlock.level === level)?.ids ?? [];
}

/** 次に解禁されるピース。すべて解禁済みなら null。 */
export function nextUnlock(
  level: number,
): { readonly level: number; readonly ids: readonly PieceId[] } | null {
  return UNLOCKS.find((unlock) => unlock.level > level) ?? null;
}
