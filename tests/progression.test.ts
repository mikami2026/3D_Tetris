import { describe, expect, it } from 'vitest';
import { Game } from '../src/core/game';
import {
  STARTER_PIECES,
  UNLOCKS,
  nextUnlock,
  piecePoolForLevel,
  unlockedAtLevel,
} from '../src/core/progression';
import { BagRandomizer } from '../src/core/randomizer';
import { PIECE_IDS, type PieceId } from '../src/core/types';

const SOLIDS: PieceId[] = ['TRIPOD', 'SCREW_R', 'SCREW_L'];

describe('ピースの段階解禁', () => {
  it('レベル1〜2は平面5種だけ（立体は出ない）', () => {
    for (const level of [1, 2]) {
      const pool = piecePoolForLevel(level);
      expect(pool.sort()).toEqual([...STARTER_PIECES].sort());
      for (const solid of SOLIDS) expect(pool).not.toContain(solid);
    }
  });

  it('レベル3で三又が、レベル5でねじ2種が加わる', () => {
    expect(piecePoolForLevel(3)).toContain('TRIPOD');
    expect(piecePoolForLevel(3)).not.toContain('SCREW_R');
    expect(piecePoolForLevel(4)).not.toContain('SCREW_L');
    expect(piecePoolForLevel(5).sort()).toEqual([...PIECE_IDS].sort());
    expect(piecePoolForLevel(99).sort()).toEqual([...PIECE_IDS].sort());
  });

  it('解禁は一度きりで、後から減ることはない', () => {
    for (let level = 1; level < 12; level++) {
      const previous = piecePoolForLevel(level);
      const current = piecePoolForLevel(level + 1);
      for (const id of previous) expect(current, `Lv${level + 1}`).toContain(id);
    }
  });

  it('解禁されるピースに重複や漏れがない', () => {
    const all = [...STARTER_PIECES, ...UNLOCKS.flatMap((u) => u.ids)];
    expect(all.sort()).toEqual([...PIECE_IDS].sort());
  });

  it('unlockedAtLevel はちょうどそのレベルの解禁だけを返す', () => {
    expect(unlockedAtLevel(1)).toEqual([]);
    expect(unlockedAtLevel(3)).toEqual(['TRIPOD']);
    expect(unlockedAtLevel(4)).toEqual([]);
    expect(unlockedAtLevel(5)).toEqual(['SCREW_R', 'SCREW_L']);
  });

  it('nextUnlock は次の解禁を返し、全部出たら null', () => {
    expect(nextUnlock(1)?.level).toBe(3);
    expect(nextUnlock(3)?.level).toBe(5);
    expect(nextUnlock(5)).toBeNull();
  });
});

describe('BagRandomizer', () => {
  it('渡された候補だけを排出する', () => {
    const rng = new BagRandomizer(1, () => piecePoolForLevel(1));
    for (let i = 0; i < 200; i++) {
      expect(SOLIDS).not.toContain(rng.next());
    }
  });

  it('1バッグぶんは候補の順列になる（偏りが出ない）', () => {
    const rng = new BagRandomizer(7, () => [...STARTER_PIECES]);
    const drawn = Array.from({ length: STARTER_PIECES.length }, () => rng.next());
    expect(drawn.sort()).toEqual([...STARTER_PIECES].sort());
  });

  it('候補が増えると次のバッグから反映される', () => {
    let level = 1;
    const rng = new BagRandomizer(3, () => piecePoolForLevel(level));
    for (let i = 0; i < 5; i++) rng.next();

    level = 5;
    const drawn = Array.from({ length: 40 }, () => rng.next());
    expect(drawn).toContain('TRIPOD');
    expect(drawn.some((id) => id === 'SCREW_R' || id === 'SCREW_L')).toBe(true);
  });

  it('peek は消費せず、next と同じ順番を返す', () => {
    const rng = new BagRandomizer(11, () => [...PIECE_IDS]);
    const peeked = rng.peek(5);
    expect(Array.from({ length: 5 }, () => rng.next())).toEqual(peeked);
  });
});

describe('Game への反映', () => {
  it('レベル1で遊び続けても立体ピースは一度も出ない', () => {
    for (let seed = 0; seed < 10; seed++) {
      const game = new Game({ seed });
      for (let i = 0; i < 60 && game.phase === 'falling'; i++) {
        expect(SOLIDS, `seed ${seed}`).not.toContain(game.activeId as PieceId);
        for (const id of game.nextQueue(3)) expect(SOLIDS).not.toContain(id);
        game.hardDrop();
      }
    }
  });

  it('startLevel を上げると最初から解禁済みで始まる', () => {
    const game = new Game({ seed: 2, startLevel: 5 });
    expect(game.level).toBe(5);

    const seen = new Set<PieceId>();
    for (let i = 0; i < 60 && game.phase === 'falling'; i++) {
      seen.add(game.activeId as PieceId);
      game.hardDrop();
    }
    for (const solid of SOLIDS) expect(seen.has(solid), `${solid} が出ていない`).toBe(true);
  });

  it('startLevel はレベルの上がり方にそのまま加算される', () => {
    const game = new Game({ seed: 4, startLevel: 3 });
    let guard = 0;
    while (game.totalLayers < 10 && guard++ < 100) {
      for (let x = 0; x < 4; x++) {
        for (let z = 0; z < 4; z++) game.board.set(x, 0, z, 1);
      }
      game.hardDrop();
      if (game.phase === 'gameover') break;
    }
    expect(game.totalLayers).toBeGreaterThanOrEqual(10);
    expect(game.level).toBe(4); // 開始3 + 10層で1つ上がって4
  });
});
