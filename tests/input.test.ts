import { describe, expect, it } from 'vitest';
import { ARR_MS, AxisRepeater, DAS_MS } from '../src/input/controller';
import { KEY_ACTIONS, REPEATABLE } from '../src/input/keymap';

describe('キーマップ', () => {
  it('設計書の操作表どおりに割り当てられている', () => {
    expect(KEY_ACTIONS.ArrowLeft).toBe('move-left');
    expect(KEY_ACTIONS.ArrowRight).toBe('move-right');
    expect(KEY_ACTIONS.ArrowUp).toBe('move-away');
    expect(KEY_ACTIONS.ArrowDown).toBe('move-toward');
    expect(KEY_ACTIONS.KeyQ).toBe('camera-left');
    expect(KEY_ACTIONS.KeyE).toBe('camera-right');
    expect(KEY_ACTIONS.Space).toBe('hard-drop');
  });

  it('OSの機能を誤爆させるキーを使っていない', () => {
    // Shift 5連打で Windows の「固定キー」ダイアログが出る。
    // Ctrl は Ctrl+W でタブが閉じる（W はピッチ回転に割り当てている）。
    // Alt はメニューにフォーカスが移る。いずれも preventDefault では止められない。
    for (const code of Object.keys(KEY_ACTIONS)) {
      expect(/^(Shift|Control|Alt|Meta)/.test(code), `${code} は使えない`).toBe(false);
    }
  });

  it('回転3種と視点回転でキーが衝突していない', () => {
    const codes = Object.keys(KEY_ACTIONS);
    expect(new Set(codes).size).toBe(codes.length);
    // ピース回転（A/D/W/S/Z/X）とカメラ回転（Q/E）は別のキー
    const pieceRotation = ['KeyA', 'KeyD', 'KeyW', 'KeyS', 'KeyZ', 'KeyX'];
    const cameraRotation = ['KeyQ', 'KeyE'];
    for (const code of pieceRotation) expect(KEY_ACTIONS[code].startsWith('rot-')).toBe(true);
    for (const code of cameraRotation) expect(KEY_ACTIONS[code].startsWith('camera-')).toBe(true);
  });

  it('連射対象は移動4方向だけ（回転やドロップは連射しない）', () => {
    expect([...REPEATABLE].sort()).toEqual([
      'move-away',
      'move-left',
      'move-right',
      'move-toward',
    ]);
  });
});

describe('AxisRepeater（長押しの連射）', () => {
  function collect(): { fired: number[]; fire: (v: number) => void } {
    const fired: number[] = [];
    return { fired, fire: (v) => fired.push(v) };
  }

  it('押した直後は1回だけ発火し、DAS までは連射しない', () => {
    const repeater = new AxisRepeater();
    expect(repeater.press(1)).toBe(true);

    const { fired, fire } = collect();
    repeater.update(DAS_MS - 1, fire);
    expect(fired).toEqual([]);
  });

  it('DAS を過ぎると ARR 間隔で連射する', () => {
    const repeater = new AxisRepeater();
    repeater.press(1);

    const { fired, fire } = collect();
    repeater.update(DAS_MS, fire);
    expect(fired).toEqual([1]); // DAS 到達で1回目

    repeater.update(ARR_MS * 3, fire);
    expect(fired).toEqual([1, 1, 1, 1]); // さらに3回
  });

  it('OSのキーリピートによる二重の press は無視される', () => {
    const repeater = new AxisRepeater();
    expect(repeater.press(-1)).toBe(true);
    expect(repeater.press(-1)).toBe(false);
  });

  it('左右同時押しは後から押した方が勝つ', () => {
    const repeater = new AxisRepeater();
    repeater.press(1);
    repeater.press(-1);
    expect(repeater.value).toBe(-1);
  });

  it('押していた方を離すと、残っている逆方向へ即座に切り返す', () => {
    const repeater = new AxisRepeater();
    repeater.press(1);
    repeater.press(-1);
    expect(repeater.release(-1)).toBe(1); // 右が残っているので右へ
    expect(repeater.value).toBe(1);
  });

  it('アクティブでない方を離しても切り返しは起きない', () => {
    const repeater = new AxisRepeater();
    repeater.press(1);
    repeater.press(-1);
    expect(repeater.release(1)).toBe(0);
    expect(repeater.value).toBe(-1);
  });

  it('切り返した直後は DAS が再充電される', () => {
    const repeater = new AxisRepeater();
    repeater.press(1);
    repeater.update(DAS_MS * 2, () => {});
    repeater.press(-1); // 切り返し

    const { fired, fire } = collect();
    repeater.update(DAS_MS - 1, fire);
    expect(fired).toEqual([]);
  });

  it('フォーカスを失って clear すると連射が止まる', () => {
    const repeater = new AxisRepeater();
    repeater.press(1);
    repeater.clear();

    const { fired, fire } = collect();
    repeater.update(DAS_MS * 5, fire);
    expect(fired).toEqual([]);
    expect(repeater.value).toBe(0);
  });
});
