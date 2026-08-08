/** 同時消去数（0〜4層）ごとの基礎点。 */
export const LAYER_SCORES = [0, 100, 300, 700, 1500] as const;

export function scoreForClear(layers: number, level: number): number {
  const base = LAYER_SCORES[Math.min(layers, LAYER_SCORES.length - 1)] ?? 0;
  return base * level;
}

/** 累計消去層数 10 ごとにレベルが 1 上がる。 */
export function levelForLayers(totalLayers: number): number {
  return Math.floor(totalLayers / 10) + 1;
}

/**
 * 自然落下の間隔（ミリ秒）。
 *
 * 3D は「どの列にいるか」の判断に時間がかかるため、2Dテトリスよりかなり遅くしている。
 * 下限も高めに置いてあり、どれだけレベルが上がっても反射神経勝負にはならない。
 */
export const BASE_INTERVAL_MS = 1300;
export const INTERVAL_STEP_MS = 80;
export const MIN_INTERVAL_MS = 150;

export function gravityInterval(level: number): number {
  return Math.max(MIN_INTERVAL_MS, BASE_INTERVAL_MS - (level - 1) * INTERVAL_STEP_MS);
}

export const SOFT_DROP_INTERVAL_MS = 40;
export const HARD_DROP_SCORE_PER_CELL = 2;
export const SOFT_DROP_SCORE_PER_CELL = 1;
