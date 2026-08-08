import { Board, D, H, VISIBLE_H, W } from './board';
import { PIECES, type PieceDef } from './pieces';
import { piecePoolForLevel } from './progression';
import { BagRandomizer } from './randomizer';
import { KICKS, rotateCells } from './rotation';
import {
  HARD_DROP_SCORE_PER_CELL,
  SOFT_DROP_INTERVAL_MS,
  SOFT_DROP_SCORE_PER_CELL,
  gravityInterval,
  levelForLayers,
  scoreForClear,
} from './scoring';
import { CODE_TO_PIECE, PIECE_CODE, type PieceId, type Turn, type Vec3, type WorldAxis } from './types';

export const LOCK_DELAY_MS = 500;
/** ロック遅延をリセットできる回数の上限。無限回転で永久に固定できてしまうのを防ぐ。 */
export const MAX_LOCK_RESETS = 15;
export const NEXT_COUNT = 3;

/** アイテムの初期所持数。 */
export const STARTING_ITEMS = 3;
export const MAX_ITEMS = 5;
/**
 * 層を消せなくてもアイテムが補給される間隔（設置したピース数）。
 * 「層を消すたびに1個」だけだと、層を消せない人にアイテムが渡らず
 * 一番必要としている人が一番もらえない構造になってしまう。
 */
export const PIECES_PER_ITEM = 25;

export type GamePhase = 'falling' | 'gameover';

export type GameEvent =
  | { type: 'spawn'; id: PieceId }
  | { type: 'lock'; id: PieceId; cells: Vec3[] }
  | { type: 'clear'; layers: number[]; gained: number }
  | { type: 'levelup'; level: number }
  | { type: 'item-used'; id: PieceId; removed: number }
  | { type: 'item-gained'; total: number }
  | { type: 'gameover' };

interface ActivePiece {
  def: PieceDef;
  /** ボックス内座標。 */
  cells: Vec3[];
  /** ボックス原点のワールド座標。 */
  origin: Vec3;
}

function toWorld(cells: readonly Vec3[], origin: Vec3): Vec3[] {
  return cells.map(([x, y, z]) => [x + origin[0], y + origin[1], z + origin[2]] as Vec3);
}

export interface GameOptions {
  seed?: number;
  /** 開始レベル。上げるとピースの解禁が最初から進んだ状態で始まる。 */
  startLevel?: number;
}

/**
 * ゲームのルール本体。Three.js には一切依存しないので Node 上でテストできる。
 * 描画層はこのクラスの getter を毎フレーム読むだけで、逆方向の依存は作らない。
 */
export class Game {
  readonly board = new Board();

  private rng: BagRandomizer;
  private active: ActivePiece | null = null;
  private events: GameEvent[] = [];

  private fallTimer = 0;
  private lockTimer = 0;
  private lockResets = 0;
  private grounded = false;
  private softDropping = false;

  private heldId: PieceId | null = null;
  private canHoldNow = true;

  private _phase: GamePhase = 'falling';
  private _score = 0;
  private _level = 1;
  private _totalLayers = 0;
  private _items = STARTING_ITEMS;
  private piecesSinceItem = 0;

  private readonly startLevel: number;

  constructor(options: GameOptions = {}) {
    this.startLevel = Math.max(1, Math.floor(options.startLevel ?? 1));
    this._level = this.startLevel;
    // バッグを詰めるたびに現在のレベルを問い合わせ、解禁済みのピースだけを入れる。
    this.rng = new BagRandomizer(options.seed, () => piecePoolForLevel(this._level));
    this.spawn(this.rng.next());
  }

  // --- 状態の読み出し ------------------------------------------------------

  get phase(): GamePhase {
    return this._phase;
  }
  get score(): number {
    return this._score;
  }
  get level(): number {
    return this._level;
  }
  get totalLayers(): number {
    return this._totalLayers;
  }
  get items(): number {
    return this._items;
  }
  get held(): PieceId | null {
    return this.heldId;
  }
  get canHold(): boolean {
    return this.canHoldNow;
  }
  get activeId(): PieceId | null {
    return this.active?.def.id ?? null;
  }

  nextQueue(count = NEXT_COUNT): PieceId[] {
    return this.rng.peek(count);
  }

  /** 落下中ピースが占めるワールドセル。 */
  activeCells(): Vec3[] | null {
    return this.active ? toWorld(this.active.cells, this.active.origin) : null;
  }

  /** ハードドロップしたときに着地する位置。3Dで奥行きを読むための必須表示。 */
  ghostCells(): Vec3[] | null {
    if (!this.active) return null;
    const origin: Vec3 = [...this.active.origin];
    while (this.board.canPlace(toWorld(this.active.cells, [origin[0], origin[1] - 1, origin[2]]))) {
      origin[1] -= 1;
    }
    return toWorld(this.active.cells, origin);
  }

  /** 前回の drain 以降に発生したイベントを取り出す。 */
  drainEvents(): GameEvent[] {
    const out = this.events;
    this.events = [];
    return out;
  }

  // --- 操作 ----------------------------------------------------------------

  /** ワールド座標系での水平移動。画面基準からの変換は input 層が行う。 */
  move(dx: number, dz: number): boolean {
    return this.shift(dx, 0, dz);
  }

  rotate(axis: WorldAxis, turn: Turn): boolean {
    if (this._phase !== 'falling' || !this.active) return false;
    const piece = this.active;
    const rotated = rotateCells(piece.cells, axis, turn, piece.def.box);

    for (const [kx, ky, kz] of KICKS) {
      const origin: Vec3 = [piece.origin[0] + kx, piece.origin[1] + ky, piece.origin[2] + kz];
      if (this.board.canPlace(toWorld(rotated, origin))) {
        piece.cells = rotated;
        piece.origin = origin;
        this.onPlayerAction();
        return true;
      }
    }
    return false;
  }

  setSoftDrop(on: boolean): void {
    this.softDropping = on;
  }

  /** 一気に着地させて即ロックする。落下したセル数を返す。 */
  hardDrop(): number {
    if (this._phase !== 'falling' || !this.active) return 0;
    let distance = 0;
    while (this.shift(0, -1, 0)) distance++;
    this._score += distance * HARD_DROP_SCORE_PER_CELL;
    this.lockPiece();
    return distance;
  }

  /**
   * アイテムを使う。盤面で最も多い色のブロックをすべて消し、残りを下に詰める。
   * 消す色は自動で決まる。キー1つで完結させ、覚える操作を増やさないため。
   */
  useItem(): boolean {
    if (this._phase !== 'falling' || this._items <= 0) return false;

    const code = this.dominantCode();
    if (code === 0) return false; // 盤面が空

    const removed = this.board.removeCode(code);
    this.board.collapseColumns();
    this._items--;
    this.events.push({ type: 'item-used', id: CODE_TO_PIECE[code], removed });

    this.liftActiveOutOfStack();
    this.resolveClears();
    return true;
  }

  /** 盤面で最も多いピースコード。空なら 0。 */
  private dominantCode(): number {
    let best = 0;
    let bestCount = 0;
    for (const [code, count] of this.board.countByCode()) {
      // 同数のときはコードの小さい方に決めて、結果を再現可能にする。
      if (count > bestCount || (count === bestCount && code < best)) {
        best = code;
        bestCount = count;
      }
    }
    return best;
  }

  /**
   * 列を詰めた結果、固定ブロックが落下中のピースの位置まで落ちてくることがある。
   * 盤面配列に落下中のピースは載っていないため、詰め処理からは「空き」に見えてしまう。
   */
  private liftActiveOutOfStack(): void {
    if (!this.active) return;
    for (let i = 0; i <= H; i++) {
      if (this.board.canPlace(toWorld(this.active.cells, this.active.origin))) return;
      this.active.origin[1] += 1;
    }
    this.gameOver();
  }

  private grantItems(count: number): void {
    const next = Math.min(MAX_ITEMS, this._items + count);
    if (next === this._items) return;
    this._items = next;
    this.events.push({ type: 'item-gained', total: next });
  }

  hold(): boolean {
    if (this._phase !== 'falling' || !this.active || !this.canHoldNow) return false;
    const current = this.active.def.id;
    const incoming = this.heldId;
    this.heldId = current;
    this.canHoldNow = false;
    this.spawn(incoming ?? this.rng.next());
    return true;
  }

  // --- 時間経過 ------------------------------------------------------------

  tick(dtMs: number): void {
    if (this._phase !== 'falling' || !this.active) return;

    const interval = this.softDropping
      ? Math.min(SOFT_DROP_INTERVAL_MS, gravityInterval(this._level))
      : gravityInterval(this._level);

    this.fallTimer += dtMs;
    while (this.fallTimer >= interval) {
      this.fallTimer -= interval;
      if (this.shift(0, -1, 0)) {
        if (this.softDropping) this._score += SOFT_DROP_SCORE_PER_CELL;
      } else {
        this.fallTimer = 0;
        break;
      }
    }

    this.grounded = !this.canShift(0, -1, 0);
    if (this.grounded) {
      this.lockTimer += dtMs;
      if (this.lockTimer >= LOCK_DELAY_MS || this.lockResets >= MAX_LOCK_RESETS) {
        this.lockPiece();
      }
    } else {
      this.lockTimer = 0;
    }
  }

  // --- 内部処理 ------------------------------------------------------------

  private canShift(dx: number, dy: number, dz: number): boolean {
    if (!this.active) return false;
    const origin: Vec3 = [
      this.active.origin[0] + dx,
      this.active.origin[1] + dy,
      this.active.origin[2] + dz,
    ];
    return this.board.canPlace(toWorld(this.active.cells, origin));
  }

  private shift(dx: number, dy: number, dz: number): boolean {
    if (this._phase !== 'falling' || !this.active) return false;
    if (!this.canShift(dx, dy, dz)) return false;

    this.active.origin[0] += dx;
    this.active.origin[1] += dy;
    this.active.origin[2] += dz;

    if (dy < 0) {
      // 1段でも落ちたらロック猶予は完全に初期化する（step reset）。
      this.lockTimer = 0;
      this.lockResets = 0;
    } else {
      this.onPlayerAction();
    }
    return true;
  }

  /** 接地中の移動・回転はロック猶予を延長する。ただし回数には上限がある。 */
  private onPlayerAction(): void {
    if (!this.grounded) return;
    if (this.lockResets < MAX_LOCK_RESETS) {
      this.lockResets++;
      this.lockTimer = 0;
    }
  }

  private lockPiece(): void {
    if (!this.active) return;
    const piece = this.active;
    const cells = toWorld(piece.cells, piece.origin);
    this.board.place(cells, PIECE_CODE[piece.def.id]);
    this.events.push({ type: 'lock', id: piece.def.id, cells });

    this.resolveClears();

    this.piecesSinceItem++;
    if (this.piecesSinceItem >= PIECES_PER_ITEM) {
      this.piecesSinceItem = 0;
      this.grantItems(1);
    }

    // 消去後もなお可視領域を超えて積まれていたら詰み。
    if (this.board.stackHeight() > VISIBLE_H) {
      this.gameOver();
      return;
    }

    this.canHoldNow = true;
    this.spawn(this.rng.next());
  }

  /** 埋まった層を消し、得点・レベル・アイテムに反映する。ロック時とアイテム使用後の両方から呼ぶ。 */
  private resolveClears(): number[] {
    const cleared = this.board.clearFullLayers();
    if (cleared.length === 0) return cleared;

    const gained = scoreForClear(cleared.length, this._level);
    this._score += gained;
    this._totalLayers += cleared.length;
    this.events.push({ type: 'clear', layers: cleared, gained });
    this.grantItems(cleared.length);

    const nextLevel = levelForLayers(this._totalLayers) + this.startLevel - 1;
    if (nextLevel !== this._level) {
      this._level = nextLevel;
      this.events.push({ type: 'levelup', level: nextLevel });
    }
    return cleared;
  }

  private spawn(id: PieceId): void {
    const def = PIECES[id];
    const cells = def.cells.map((c) => [...c] as Vec3);

    // ピース全体が可視領域の一番上にちょうど収まる高さに出す。
    // ここより上（スポーンバッファ）は回転と上方向キックのための余白で、通常は使わない。
    let maxY = -Infinity;
    for (const [, y] of cells) maxY = Math.max(maxY, y);

    const origin: Vec3 = [
      Math.floor((W - def.box) / 2),
      VISIBLE_H - 1 - maxY,
      Math.floor((D - def.box) / 2),
    ];

    this.active = { def, cells, origin };
    this.fallTimer = 0;
    this.lockTimer = 0;
    this.lockResets = 0;
    this.grounded = false;

    if (!this.board.canPlace(toWorld(cells, origin))) {
      this.gameOver();
      return;
    }
    this.events.push({ type: 'spawn', id });
  }

  private gameOver(): void {
    this._phase = 'gameover';
    this.active = null;
    this.events.push({ type: 'gameover' });
  }
}
