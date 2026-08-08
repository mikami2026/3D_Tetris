import * as THREE from 'three';
import { D, H, W, cellIndex } from '../core/board';
import type { Game } from '../core/game';
import { PIECES } from '../core/pieces';
import { CODE_TO_PIECE, PIECE_CODE } from '../core/types';
import { BlockField } from './blockField';

const COLORS = new Map<number, THREE.Color>();

function colorForCode(code: number): THREE.Color {
  let color = COLORS.get(code);
  if (!color) {
    color = new THREE.Color(PIECES[CODE_TO_PIECE[code]].color);
    COLORS.set(code, color);
  }
  return color;
}

/**
 * Game の状態を毎フレーム読んで描画に反映する。
 * 依存は一方通行で、描画側が Game を書き換えることはない。
 */
export class GameView {
  readonly group = new THREE.Group();

  private readonly locked = new BlockField(W * D * H);
  private readonly active = new BlockField(4, { emissive: 0x1a1a1a });

  constructor() {
    this.group.add(this.locked.group, this.active.group);
  }

  sync(game: Game): void {
    this.locked.begin();
    for (let y = 0; y < H; y++) {
      for (let z = 0; z < D; z++) {
        for (let x = 0; x < W; x++) {
          const code = game.board.cells[cellIndex(x, y, z)];
          if (code !== 0) this.locked.add(x, y, z, colorForCode(code));
        }
      }
    }
    this.locked.end();

    this.active.begin();
    const cells = game.activeCells();
    const id = game.activeId;
    if (cells && id) {
      const color = colorForCode(PIECE_CODE[id]);
      for (const [x, y, z] of cells) this.active.add(x, y, z, color);
    }
    this.active.end();
  }

  dispose(): void {
    this.locked.dispose();
    this.active.dispose();
  }
}
