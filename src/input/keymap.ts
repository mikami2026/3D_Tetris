export type Action =
  | 'move-left'
  | 'move-right'
  | 'move-away'
  | 'move-toward'
  | 'rot-yaw-ccw'
  | 'rot-yaw-cw'
  | 'rot-pitch-fwd'
  | 'rot-pitch-back'
  | 'rot-roll-ccw'
  | 'rot-roll-cw'
  | 'camera-left'
  | 'camera-right'
  | 'soft-drop'
  | 'hard-drop'
  | 'hold'
  | 'use-item'
  | 'pause'
  | 'restart';

/**
 * KeyboardEvent.code で引く。key ではなく code を使うのは、
 * キーボードレイアウトが変わっても物理配置が保たれるようにするため。
 */
export const KEY_ACTIONS: Readonly<Record<string, Action>> = {
  ArrowLeft: 'move-left',
  ArrowRight: 'move-right',
  ArrowUp: 'move-away',
  ArrowDown: 'move-toward',

  KeyA: 'rot-yaw-ccw',
  KeyD: 'rot-yaw-cw',
  KeyW: 'rot-pitch-fwd',
  KeyS: 'rot-pitch-back',
  KeyZ: 'rot-roll-ccw',
  KeyX: 'rot-roll-cw',

  KeyQ: 'camera-left',
  KeyE: 'camera-right',

  // Shift は使わない。Windows は Shift を5回押すと「固定キー」のダイアログが出るため、
  // 連打・長押しが前提のソフトドロップには使えない。
  // Ctrl も不可（Ctrl+W がブラウザのタブを閉じてしまい、W はピッチ回転に使っている）。
  Slash: 'soft-drop',
  Space: 'hard-drop',
  Tab: 'hold',
  KeyB: 'use-item', // ボム
  KeyP: 'pause',
  KeyR: 'restart',
};

/** 押しっぱなしで連射する（DAS/ARR の対象になる）アクション。 */
export const REPEATABLE: ReadonlySet<Action> = new Set<Action>([
  'move-left',
  'move-right',
  'move-away',
  'move-toward',
]);
