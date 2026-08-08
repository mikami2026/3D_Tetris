import { describe, expect, it } from 'vitest';
import {
  BASE_INTERVAL_MS,
  MIN_INTERVAL_MS,
  gravityInterval,
  levelForLayers,
  scoreForClear,
} from '../src/core/scoring';

describe('落下速度', () => {
  it('レベル1は 1300ms／マス（3Dの判断時間を確保するため2Dより遅い）', () => {
    expect(gravityInterval(1)).toBe(BASE_INTERVAL_MS);
    expect(BASE_INTERVAL_MS).toBeGreaterThanOrEqual(1000);
  });

  it('レベルが上がるほど速くなる（同じ速度に留まらない）', () => {
    for (let level = 1; level < 12; level++) {
      expect(gravityInterval(level + 1), `Lv${level}→${level + 1}`).toBeLessThan(
        gravityInterval(level),
      );
    }
  });

  it('どれだけレベルが上がっても下限より速くならない', () => {
    for (const level of [20, 50, 999]) {
      expect(gravityInterval(level)).toBe(MIN_INTERVAL_MS);
    }
    // 反射神経勝負にならない程度の下限であること
    expect(MIN_INTERVAL_MS).toBeGreaterThanOrEqual(100);
  });

  it('立体ピースが解禁されるレベルでもまだ十分に遅い', () => {
    expect(gravityInterval(3)).toBeGreaterThanOrEqual(1000); // 三又
    expect(gravityInterval(5)).toBeGreaterThanOrEqual(800); // ねじ2種
  });
});

describe('スコアとレベル', () => {
  it('同時消去が多いほど1層あたりの得点が高い', () => {
    const perLayer = [1, 2, 3, 4].map((n) => scoreForClear(n, 1) / n);
    for (let i = 1; i < perLayer.length; i++) {
      expect(perLayer[i]).toBeGreaterThan(perLayer[i - 1]);
    }
  });

  it('得点はレベルに比例する', () => {
    expect(scoreForClear(1, 3)).toBe(scoreForClear(1, 1) * 3);
  });

  it('0層消去は0点', () => {
    expect(scoreForClear(0, 5)).toBe(0);
  });

  it('累計10層ごとにレベルが1上がる', () => {
    expect(levelForLayers(0)).toBe(1);
    expect(levelForLayers(9)).toBe(1);
    expect(levelForLayers(10)).toBe(2);
    expect(levelForLayers(29)).toBe(3);
  });
});
