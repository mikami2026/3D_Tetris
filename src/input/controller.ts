import type { RotAxis, Turn } from '../core/types';
import { KEY_ACTIONS, type Action } from './keymap';

/** 長押しが連射に切り替わるまでの待ち時間。 */
export const DAS_MS = 170;
/** 連射の間隔。 */
export const ARR_MS = 33;

export interface InputHandlers {
  /** 画面基準の移動。right / away はそれぞれ -1, 0, +1。 */
  move(right: number, away: number): void;
  rotate(kind: RotAxis, turn: Turn): void;
  turnCamera(delta: 1 | -1): void;
  setSoftDrop(on: boolean): void;
  hardDrop(): void;
  hold(): void;
  useItem(): void;
  togglePause(): void;
  restart(): void;
}

/**
 * 1軸ぶんの長押し連射。左右を同時に押した場合は「後から押した方」が勝つ
 * （テトリスの標準的な挙動で、素早い切り返しがしやすい）。
 */
export class AxisRepeater {
  private stack: number[] = [];
  private timer = 0;
  private charged = false;

  get value(): number {
    return this.stack.length > 0 ? this.stack[this.stack.length - 1] : 0;
  }

  /** 即座に1回発火すべきなら true。OSのキーリピートによる重複は false。 */
  press(direction: 1 | -1): boolean {
    if (this.stack.includes(direction)) return false;
    this.stack.push(direction);
    this.timer = 0;
    this.charged = false;
    return true;
  }

  /** 逆方向が残っていてアクティブが入れ替わった場合、その方向を返す。 */
  release(direction: 1 | -1): number {
    const index = this.stack.indexOf(direction);
    if (index < 0) return 0;
    const wasActive = index === this.stack.length - 1;
    this.stack.splice(index, 1);
    this.timer = 0;
    this.charged = false;
    return wasActive ? this.value : 0;
  }

  clear(): void {
    this.stack.length = 0;
    this.timer = 0;
    this.charged = false;
  }

  update(dtMs: number, fire: (direction: number) => void): void {
    if (this.value === 0) return;
    this.timer += dtMs;

    if (!this.charged) {
      if (this.timer < DAS_MS) return;
      this.timer -= DAS_MS;
      this.charged = true;
      fire(this.value);
    }
    while (this.timer >= ARR_MS) {
      this.timer -= ARR_MS;
      fire(this.value);
    }
  }
}

const ROTATIONS: Partial<Record<Action, [RotAxis, Turn]>> = {
  'rot-yaw-cw': ['yaw', 1],
  'rot-yaw-ccw': ['yaw', -1],
  'rot-pitch-fwd': ['pitch', 1],
  'rot-pitch-back': ['pitch', -1],
  'rot-roll-cw': ['roll', 1],
  'rot-roll-ccw': ['roll', -1],
};

/**
 * キーボードを抽象アクションに変換し、DAS/ARR を管理する。
 * 視点に応じたワールド座標への変換は handlers 側の責任。
 */
export class InputController {
  private readonly horizontal = new AxisRepeater();
  private readonly depth = new AxisRepeater();

  constructor(private readonly handlers: InputHandlers) {}

  attach(): void {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
  }

  detach(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
  }

  update(dtMs: number): void {
    this.horizontal.update(dtMs, (v) => this.handlers.move(v, 0));
    this.depth.update(dtMs, (v) => this.handlers.move(0, v));
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    const action = KEY_ACTIONS[event.code];
    if (!action) return;
    // 矢印とスペースのスクロール、Tab のフォーカス移動を止める。
    event.preventDefault();

    switch (action) {
      case 'move-left':
        if (this.horizontal.press(-1)) this.handlers.move(-1, 0);
        return;
      case 'move-right':
        if (this.horizontal.press(1)) this.handlers.move(1, 0);
        return;
      case 'move-away':
        if (this.depth.press(1)) this.handlers.move(0, 1);
        return;
      case 'move-toward':
        if (this.depth.press(-1)) this.handlers.move(0, -1);
        return;
      case 'camera-left':
        if (!event.repeat) this.handlers.turnCamera(-1);
        return;
      case 'camera-right':
        if (!event.repeat) this.handlers.turnCamera(1);
        return;
      case 'soft-drop':
        this.handlers.setSoftDrop(true);
        return;
      case 'hard-drop':
        if (!event.repeat) this.handlers.hardDrop();
        return;
      case 'hold':
        if (!event.repeat) this.handlers.hold();
        return;
      case 'use-item':
        if (!event.repeat) this.handlers.useItem();
        return;
      case 'pause':
        if (!event.repeat) this.handlers.togglePause();
        return;
      case 'restart':
        if (!event.repeat) this.handlers.restart();
        return;
      default: {
        const rotation = ROTATIONS[action];
        if (rotation && !event.repeat) this.handlers.rotate(rotation[0], rotation[1]);
      }
    }
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    const action = KEY_ACTIONS[event.code];
    if (!action) return;

    switch (action) {
      case 'move-left':
        this.fireFallback(this.horizontal.release(-1), 'horizontal');
        return;
      case 'move-right':
        this.fireFallback(this.horizontal.release(1), 'horizontal');
        return;
      case 'move-away':
        this.fireFallback(this.depth.release(1), 'depth');
        return;
      case 'move-toward':
        this.fireFallback(this.depth.release(-1), 'depth');
        return;
      case 'soft-drop':
        this.handlers.setSoftDrop(false);
        return;
      default:
        return;
    }
  };

  /** 押していた方を離して逆方向が残っていたら、そちらへ即座に切り返す。 */
  private fireFallback(direction: number, axis: 'horizontal' | 'depth'): void {
    if (direction === 0) return;
    if (axis === 'horizontal') this.handlers.move(direction, 0);
    else this.handlers.move(0, direction);
  }

  /** ウィンドウのフォーカスが外れたらキーが押しっぱなしのまま残らないようにする。 */
  private readonly onBlur = (): void => {
    this.horizontal.clear();
    this.depth.clear();
    this.handlers.setSoftDrop(false);
  };
}
