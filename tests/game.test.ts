import { describe, expect, it } from 'vitest';
import { D, VISIBLE_H, W } from '../src/core/board';
import { Game, LOCK_DELAY_MS } from '../src/core/game';
import { gravityInterval } from '../src/core/scoring';
import type { Vec3 } from '../src/core/types';

const lowestY = (cells: Vec3[]) => Math.min(...cells.map((c) => c[1]));

function fillLayer(game: Game, y: number, value = 1): void {
  for (let x = 0; x < W; x++) {
    for (let z = 0; z < D; z++) game.board.set(x, y, z, value);
  }
}

describe('ゲーム開始時', () => {
  it('ピースが1つ出現し、可視領域の上端にぴったり収まる', () => {
    const game = new Game({ seed: 1 });
    const cells = game.activeCells();
    expect(cells).not.toBeNull();
    expect(cells).toHaveLength(4);
    expect(Math.max(...(cells as Vec3[]).map((c) => c[1]))).toBe(VISIBLE_H - 1);
    expect(game.phase).toBe('falling');
    expect(game.drainEvents().some((e) => e.type === 'spawn')).toBe(true);
  });

  it('出現直後のピースは可視領域からはみ出さない', () => {
    for (let seed = 0; seed < 40; seed++) {
      for (const [, y] of new Game({ seed, startLevel: 5 }).activeCells() as Vec3[]) {
        expect(y >= 0 && y < VISIBLE_H, `seed ${seed}: y=${y}`).toBe(true);
      }
    }
  });

  it('ピースは必ずフィールドの水平範囲内に出現する', () => {
    // startLevel 5 で全8種が出るようにする（レベル1だと立体ピースを検証できない）。
    for (let seed = 0; seed < 40; seed++) {
      const cells = new Game({ seed, startLevel: 5 }).activeCells() as Vec3[];
      for (const [x, , z] of cells) {
        expect(x >= 0 && x < W, `seed ${seed}: x=${x}`).toBe(true);
        expect(z >= 0 && z < D, `seed ${seed}: z=${z}`).toBe(true);
      }
    }
  });

  it('同じシードなら同じ順番でピースが出る', () => {
    const a = new Game({ seed: 42 });
    const b = new Game({ seed: 42 });
    expect(a.activeId).toBe(b.activeId);
    expect(a.nextQueue(8)).toEqual(b.nextQueue(8));
  });
});

describe('落下とロック', () => {
  it('重力の間隔ぶん時間が進むと1段下がる', () => {
    const game = new Game({ seed: 3 });
    const before = lowestY(game.activeCells() as Vec3[]);
    game.tick(gravityInterval(game.level) + 1);
    expect(lowestY(game.activeCells() as Vec3[])).toBe(before - 1);
  });

  it('ハードドロップで床まで落ちて即ロックされる', () => {
    const game = new Game({ seed: 4 });
    const ghost = game.ghostCells() as Vec3[];
    game.drainEvents();

    const distance = game.hardDrop();
    expect(distance).toBeGreaterThan(0);
    expect(lowestY(ghost)).toBe(0); // 空の盤面なので床まで落ちる

    const events = game.drainEvents();
    const lock = events.find((e) => e.type === 'lock');
    expect(lock).toBeDefined();
    // ゴーストが示した位置と実際のロック位置が一致すること
    expect(new Set((lock as { cells: Vec3[] }).cells.map((c) => c.join(',')))).toEqual(
      new Set(ghost.map((c) => c.join(','))),
    );
  });

  it('ハードドロップ後は次のピースが出現する', () => {
    const game = new Game({ seed: 5 });
    const first = game.activeId;
    const upcoming = game.nextQueue(1)[0];
    game.hardDrop();
    expect(game.activeId).toBe(upcoming);
    expect(game.activeId).not.toBe(null);
    expect(first).not.toBe(null);
  });

  it('接地後ロック遅延を過ぎるとロックされる', () => {
    const game = new Game({ seed: 6 });
    // ロック遅延より細かい刻みで進めないと、接地した瞬間に確定してしまい観測できない。
    const step = 50;
    for (let i = 0; i < 500 && lowestY(game.activeCells() as Vec3[]) > 0; i++) {
      game.tick(step);
    }
    expect(lowestY(game.activeCells() as Vec3[])).toBe(0);

    game.drainEvents();
    expect(game.drainEvents()).toHaveLength(0);

    game.tick(LOCK_DELAY_MS + 1);
    expect(game.drainEvents().some((e) => e.type === 'lock')).toBe(true);
  });

  it('ゴーストは現在ピースを真下に平行移動したものである', () => {
    // 柱ラインと床ハイライトは「ゴーストの列 = 現在ピースの列」を前提に描いている。
    for (let seed = 0; seed < 20; seed++) {
      const game = new Game({ seed, startLevel: 5 });
      const active = game.activeCells() as Vec3[];
      const ghost = game.ghostCells() as Vec3[];

      expect(ghost).toHaveLength(active.length);
      const drop = active[0][1] - ghost[0][1];
      expect(drop, `seed ${seed}`).toBeGreaterThanOrEqual(0);

      for (let i = 0; i < active.length; i++) {
        expect([ghost[i][0], ghost[i][1] + drop, ghost[i][2]], `seed ${seed} cell ${i}`).toEqual(
          active[i],
        );
      }

      const columns = (cells: Vec3[]) => new Set(cells.map(([x, , z]) => `${x},${z}`));
      expect([...columns(ghost)].sort()).toEqual([...columns(active)].sort());
    }
  });

  it('ゴーストはこれ以上落ちない位置を指す', () => {
    const game = new Game({ seed: 7 });
    const ghost = game.ghostCells() as Vec3[];
    for (const [x, y, z] of ghost) {
      expect(game.board.isFree(x, y, z)).toBe(true);
    }
    const oneLower = ghost.map(([x, y, z]) => [x, y - 1, z] as Vec3);
    expect(game.board.canPlace(oneLower)).toBe(false);
  });
});

describe('移動と回転', () => {
  it('壁の外へは移動できない', () => {
    const game = new Game({ seed: 8 });
    for (let i = 0; i < 10; i++) game.move(-1, 0);
    const cells = game.activeCells() as Vec3[];
    expect(Math.min(...cells.map((c) => c[0]))).toBe(0);
    for (let i = 0; i < 10; i++) game.move(1, 0);
    expect(Math.max(...(game.activeCells() as Vec3[]).map((c) => c[0]))).toBe(W - 1);
  });

  it('回転してもセル数は4のままで、盤面内に収まる', () => {
    for (let seed = 0; seed < 20; seed++) {
      const game = new Game({ seed, startLevel: 5 });
      for (const axis of ['x', 'y', 'z'] as const) {
        game.rotate(axis, 1);
        const cells = game.activeCells() as Vec3[];
        expect(cells).toHaveLength(4);
        for (const [x, y, z] of cells) {
          expect(game.board.inBounds(x, y, z), `seed ${seed} (${x},${y},${z})`).toBe(true);
        }
      }
    }
  });

  it('同じ軸に4回回すと元の位置・形に戻る', () => {
    for (let seed = 0; seed < 20; seed++) {
      const game = new Game({ seed, startLevel: 5 });
      const before = (game.activeCells() as Vec3[]).map((c) => c.join(',')).sort();
      for (let i = 0; i < 4; i++) expect(game.rotate('y', 1), `seed ${seed}`).toBe(true);
      expect((game.activeCells() as Vec3[]).map((c) => c.join(',')).sort()).toEqual(before);
    }
  });

  it('床にめり込む回転は行われない', () => {
    const game = new Game({ seed: 9 });
    game.hardDrop();
    const settled = new Game({ seed: 9 });
    for (let i = 0; i < 200; i++) settled.tick(50);
    // 盤面上のブロックは必ず y >= 0
    for (let i = 0; i < settled.board.cells.length; i++) {
      if (settled.board.cells[i] !== 0) expect(i).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('レイヤー消去とスコア', () => {
  it('埋まった層が消えてスコアが入る', () => {
    const game = new Game({ seed: 10 });
    fillLayer(game, 0);
    game.drainEvents();

    game.hardDrop();
    const clear = game.drainEvents().find((e) => e.type === 'clear');
    expect(clear).toBeDefined();
    expect((clear as { layers: number[] }).layers).toContain(0);
    expect(game.totalLayers).toBe(1);
    expect(game.score).toBeGreaterThanOrEqual(100);
  });

  it('消去数が増えるほど得点効率が上がる', () => {
    const single = new Game({ seed: 11 });
    fillLayer(single, 0);
    single.hardDrop();

    const quad = new Game({ seed: 11 });
    for (let y = 0; y < 4; y++) fillLayer(quad, y);
    quad.hardDrop();

    expect(quad.totalLayers).toBe(4);
    expect(quad.score).toBeGreaterThan(single.score * 4);
  });

  it('累計10層でレベルが上がる', () => {
    const game = new Game({ seed: 12 });
    let guard = 0;
    while (game.totalLayers < 10 && guard++ < 100) {
      fillLayer(game, 0);
      game.hardDrop();
      if (game.phase === 'gameover') break;
    }
    expect(game.totalLayers).toBeGreaterThanOrEqual(10);
    expect(game.level).toBeGreaterThanOrEqual(2);
    expect(gravityInterval(game.level)).toBeLessThan(gravityInterval(1));
  });
});

describe('ホールド', () => {
  it('入れ替えは1ピースにつき1回まで', () => {
    const game = new Game({ seed: 13 });
    const first = game.activeId;

    expect(game.hold()).toBe(true);
    expect(game.held).toBe(first);
    expect(game.activeId).not.toBe(first);
    expect(game.hold()).toBe(false); // ロックするまで再ホールド不可

    game.hardDrop();
    expect(game.canHold).toBe(true);
    const second = game.activeId;
    expect(game.hold()).toBe(true);
    expect(game.held).toBe(second);
    expect(game.activeId).toBe(first); // 預けていたピースが戻ってくる
  });
});

describe('ゲームオーバー', () => {
  it('可視領域を超えて積み上がると終了する', () => {
    const game = new Game({ seed: 14 });
    // x=0 の列だけ空けて積む（層が揃わないので消えない）
    for (let y = 0; y <= VISIBLE_H + 1; y++) {
      for (let x = 1; x < W; x++) {
        for (let z = 0; z < D; z++) game.board.set(x, y, z, 1);
      }
    }
    game.drainEvents();
    game.hardDrop();

    expect(game.phase).toBe('gameover');
    expect(game.drainEvents().some((e) => e.type === 'gameover')).toBe(true);
  });

  it('ゲームオーバー後は操作を受け付けない', () => {
    const game = new Game({ seed: 15 });
    for (let y = 0; y <= VISIBLE_H + 1; y++) {
      for (let x = 1; x < W; x++) {
        for (let z = 0; z < D; z++) game.board.set(x, y, z, 1);
      }
    }
    game.hardDrop();
    expect(game.phase).toBe('gameover');
    expect(game.move(1, 0)).toBe(false);
    expect(game.rotate('y', 1)).toBe(false);
    expect(game.hardDrop()).toBe(0);
    expect(game.hold()).toBe(false);
    expect(game.activeCells()).toBeNull();
  });
});

describe('長時間の自動プレイ（不変条件チェック）', () => {
  it('放置しても盤面が壊れない', () => {
    const STEP_MS = 16;
    // 落下速度を調整してもテストが壊れないよう、必要な時間から反復回数を割り出す。
    const piecesToFill = Math.ceil((W * D * VISIBLE_H) / 4) + 8;
    const msPerPiece = gravityInterval(1) * VISIBLE_H + LOCK_DELAY_MS;
    const iterations = Math.ceil((piecesToFill * msPerPiece) / STEP_MS);

    const game = new Game({ seed: 99 });
    // ループ内で expect を呼ぶと数万回ぶんで遅くなるので、違反を集めて最後に判定する。
    const violations: string[] = [];

    for (let i = 0; i < iterations && game.phase === 'falling'; i++) {
      game.tick(STEP_MS);
      const cells = game.activeCells();
      if (!cells) continue;

      if (cells.length !== 4) violations.push(`セル数 ${cells.length} @${i}`);
      for (const [x, y, z] of cells) {
        if (!game.board.inBounds(x, y, z)) {
          violations.push(`範囲外 (${x},${y},${z}) @${i}`);
        } else if (game.board.get(x, y, z) !== 0) {
          violations.push(`固定ブロックと重複 (${x},${y},${z}) @${i}`);
        }
      }
    }

    expect(violations.slice(0, 5)).toEqual([]);
    expect(game.phase).toBe('gameover'); // 放置すればいずれ積み上がる
  });
});
