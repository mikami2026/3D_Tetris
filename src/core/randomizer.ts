import type { PieceId } from './types';
import { PIECE_IDS } from './types';

/** 補充後に最低限確保しておくキューの長さ。NEXT 表示ぶんより余裕を持たせる。 */
const MIN_QUEUE = 4;

/** 小さくて偏りの少ないシード可能PRNG。テストで出現順を固定するために使う。 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 1セットぶんをシャッフルして順に排出する（バッグ方式）。
 * 同じピースが連続しすぎることも、いつまでも来ないこともなくなる。
 *
 * バッグの中身はレベルによって変わるので、補充のたびに pool を問い合わせる。
 * すでにキューに入っているぶんはそのまま消化されるため、解禁は数手かけて緩やかに反映される。
 */
export class BagRandomizer {
  private queue: PieceId[] = [];
  private readonly rand: () => number;

  constructor(
    seed: number = Date.now(),
    private readonly pool: () => readonly PieceId[] = () => PIECE_IDS,
  ) {
    this.rand = mulberry32(seed);
    this.refill();
  }

  private refill(): void {
    const bag: PieceId[] = [...this.pool()];
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(this.rand() * (i + 1));
      const tmp = bag[i];
      bag[i] = bag[j];
      bag[j] = tmp;
    }
    this.queue.push(...bag);
  }

  next(): PieceId {
    const piece = this.queue.shift() as PieceId;
    if (this.queue.length < MIN_QUEUE) this.refill();
    return piece;
  }

  peek(count: number): PieceId[] {
    while (this.queue.length < count) this.refill();
    return this.queue.slice(0, count);
  }
}
