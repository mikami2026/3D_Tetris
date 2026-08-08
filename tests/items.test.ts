import { describe, expect, it } from 'vitest';
import { Board, D, H, VISIBLE_H, W } from '../src/core/board';
import { Game, MAX_ITEMS, PIECES_PER_ITEM, STARTING_ITEMS } from '../src/core/game';
import { PIECE_CODE, type Vec3 } from '../src/core/types';

function fillLayer(game: Game, y: number, value = 1): void {
  for (let x = 0; x < W; x++) {
    for (let z = 0; z < D; z++) game.board.set(x, y, z, value);
  }
}

describe('Board の色消しと詰め直し', () => {
  it('指定コードだけが消える', () => {
    const board = new Board();
    board.set(0, 0, 0, 3);
    board.set(1, 0, 0, 5);
    board.set(2, 0, 0, 3);

    expect(board.removeCode(3)).toBe(2);
    expect(board.get(0, 0, 0)).toBe(0);
    expect(board.get(2, 0, 0)).toBe(0);
    expect(board.get(1, 0, 0)).toBe(5); // 別の色は残る
  });

  it('宙に浮いたブロックが下に詰まる', () => {
    const board = new Board();
    board.set(1, 0, 2, 4);
    board.set(1, 5, 2, 6); // 間に大きな隙間
    board.set(1, 9, 2, 7);

    board.collapseColumns();

    expect([board.get(1, 0, 2), board.get(1, 1, 2), board.get(1, 2, 2)]).toEqual([4, 6, 7]);
    expect(board.get(1, 5, 2)).toBe(0);
    expect(board.get(1, 9, 2)).toBe(0);
  });

  it('詰め直しは列ごとに独立している（隣の列に流れない）', () => {
    const board = new Board();
    board.set(0, 4, 0, 1);
    board.set(3, 7, 3, 2);

    board.collapseColumns();

    expect(board.get(0, 0, 0)).toBe(1);
    expect(board.get(3, 0, 3)).toBe(2);
    expect(board.get(1, 0, 0)).toBe(0);
  });

  it('コードごとの個数を数えられる', () => {
    const board = new Board();
    board.set(0, 0, 0, 2);
    board.set(1, 0, 0, 2);
    board.set(2, 0, 0, 8);

    const counts = board.countByCode();
    expect(counts.get(2)).toBe(2);
    expect(counts.get(8)).toBe(1);
    expect(counts.has(0)).toBe(false); // 空セルは数えない
  });
});

describe('アイテムの所持数', () => {
  it('3個持って始まる', () => {
    expect(new Game({ seed: 1 }).items).toBe(STARTING_ITEMS);
    expect(STARTING_ITEMS).toBe(3);
  });

  it('使うと1個減る', () => {
    const game = new Game({ seed: 1 });
    game.board.set(0, 0, 0, PIECE_CODE.I);
    expect(game.useItem()).toBe(true);
    expect(game.items).toBe(STARTING_ITEMS - 1);
  });

  it('0個のときは使えない', () => {
    const game = new Game({ seed: 1 });
    for (let i = 0; i < STARTING_ITEMS; i++) {
      game.board.set(0, 0, 0, PIECE_CODE.I);
      expect(game.useItem()).toBe(true);
    }
    expect(game.items).toBe(0);
    game.board.set(0, 0, 0, PIECE_CODE.I);
    expect(game.useItem()).toBe(false);
  });

  it('盤面が空なら消費されない', () => {
    const game = new Game({ seed: 1 });
    expect(game.useItem()).toBe(false);
    expect(game.items).toBe(STARTING_ITEMS);
  });

  it('層を1つ消すごとに1個もらえる', () => {
    const game = new Game({ seed: 2 });
    game.board.set(0, 0, 0, PIECE_CODE.I);
    game.useItem(); // 3 → 2 に減らしておく
    expect(game.items).toBe(2);

    fillLayer(game, 0);
    game.hardDrop();
    expect(game.totalLayers).toBe(1);
    expect(game.items).toBe(3);
  });

  it('層を消せなくてもピースを一定数置けば補給される', () => {
    const game = new Game({ seed: 3 });
    game.board.set(0, 0, 0, PIECE_CODE.I);
    game.useItem();
    expect(game.items).toBe(2);

    for (let i = 0; i < PIECES_PER_ITEM && game.phase === 'falling'; i++) {
      game.hardDrop();
      // 積み上がって終わらないよう毎回リセットする（補給条件だけを見たい）
      game.board.reset();
    }
    expect(game.items).toBe(3);
  });

  it('上限を超えて溜まらない', () => {
    const game = new Game({ seed: 4 });
    for (let i = 0; i < 12; i++) {
      fillLayer(game, 0);
      game.hardDrop();
      if (game.phase === 'gameover') break;
    }
    expect(game.items).toBe(MAX_ITEMS);
  });
});

describe('アイテムの効果', () => {
  it('盤面で最も多い色だけが消える', () => {
    const game = new Game({ seed: 5 });
    // I を5個、O を2個
    for (let x = 0; x < 4; x++) game.board.set(x, 0, 0, PIECE_CODE.I);
    game.board.set(0, 0, 1, PIECE_CODE.I);
    game.board.set(1, 0, 1, PIECE_CODE.O);
    game.board.set(2, 0, 1, PIECE_CODE.O);

    game.drainEvents();
    expect(game.useItem()).toBe(true);

    const used = game.drainEvents().find((e) => e.type === 'item-used');
    expect(used).toBeDefined();
    expect((used as { id: string }).id).toBe('I');
    expect((used as { removed: number }).removed).toBe(5);
    expect(game.board.countByCode().get(PIECE_CODE.I)).toBeUndefined();
    expect(game.board.countByCode().get(PIECE_CODE.O)).toBe(2);
  });

  it('消したあとブロックが空中に残らない', () => {
    const game = new Game({ seed: 6 });
    for (let y = 0; y < 3; y++) game.board.set(0, y, 0, PIECE_CODE.I);
    game.board.set(0, 3, 0, PIECE_CODE.O); // I の上に乗っている

    game.useItem();

    expect(game.board.get(0, 0, 0)).toBe(PIECE_CODE.O); // 床まで落ちる
    expect(game.board.stackHeight()).toBe(1);
  });

  it('詰め直しで層が揃えば消去と得点が発生する', () => {
    const game = new Game({ seed: 7 });
    // 層0は I で埋め、層1は O で埋める。I を消すと O の層が落ちて揃ったまま消える。
    fillLayer(game, 0, PIECE_CODE.I);
    fillLayer(game, 1, PIECE_CODE.O);
    game.drainEvents();

    expect(game.useItem()).toBe(true);

    const events = game.drainEvents();
    expect(events.some((e) => e.type === 'item-used')).toBe(true);
    expect(events.some((e) => e.type === 'clear')).toBe(true);
    expect(game.board.stackHeight()).toBe(0);
    expect(game.score).toBeGreaterThan(0);
  });

  it('ゲームオーバー後は使えない', () => {
    const game = new Game({ seed: 8 });
    for (let y = 0; y <= VISIBLE_H + 1; y++) {
      for (let x = 1; x < W; x++) {
        for (let z = 0; z < D; z++) game.board.set(x, y, z, PIECE_CODE.I);
      }
    }
    game.hardDrop();
    expect(game.phase).toBe('gameover');
    expect(game.useItem()).toBe(false);
  });
});

describe('落下中のピースとの干渉', () => {
  it('詰め直しで固定ブロックが降りてきても落下中のピースと重ならない', () => {
    const game = new Game({ seed: 9 });
    const active = game.activeCells() as Vec3[];
    const [ax, ay, az] = active[0];

    // 落下中のピースの真下を埋め、そのすぐ上に浮きブロックを置く。
    // 詰め直すと浮きブロックがピースの位置まで降りてくる。
    for (let y = 0; y < ay; y++) game.board.set(ax, y, az, PIECE_CODE.O);
    game.board.set(ax, ay + 1, az, PIECE_CODE.O);

    // 消される色（O より多くする）。層は揃えない。
    let placed = 0;
    for (let y = 0; y < 4 && placed < ay + 4; y++) {
      for (let x = 0; x < W; x++) {
        if (x === ax) continue;
        game.board.set(x, y, 0, PIECE_CODE.I);
        placed++;
      }
    }

    expect(game.useItem()).toBe(true);

    const after = game.activeCells();
    expect(after).not.toBeNull();
    for (const [x, y, z] of after as Vec3[]) {
      expect(game.board.inBounds(x, y, z)).toBe(true);
      expect(game.board.get(x, y, z), `(${x},${y},${z}) が固定ブロックと重複`).toBe(0);
    }
  });

  it('積んだ状態でアイテムを使っても盤面が壊れない', () => {
    for (let seed = 0; seed < 20; seed++) {
      const game = new Game({ seed, startLevel: 5 });
      for (let i = 0; i < 10 && game.phase === 'falling'; i++) {
        game.move(i % 2 === 0 ? 1 : -1, i % 3 === 0 ? 1 : 0);
        game.hardDrop();
      }
      if (game.phase !== 'falling') continue;

      game.useItem();

      const cells = game.activeCells();
      if (!cells) continue;
      for (const [x, y, z] of cells) {
        expect(game.board.inBounds(x, y, z), `seed ${seed}`).toBe(true);
        expect(game.board.get(x, y, z), `seed ${seed} (${x},${y},${z})`).toBe(0);
      }
      // 空中に浮いたブロックが残っていないこと
      for (let x = 0; x < W; x++) {
        for (let z = 0; z < D; z++) {
          let seenGap = false;
          for (let y = 0; y < H; y++) {
            if (game.board.get(x, y, z) === 0) seenGap = true;
            else expect(seenGap, `seed ${seed}: (${x},${y},${z}) が浮いている`).toBe(false);
          }
        }
      }
    }
  });
});
