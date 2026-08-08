import { D, W } from '../core/board';
import type { ViewDir } from '../core/types';

const SVG_NS = 'http://www.w3.org/2000/svg';
const CELL = 11;

export const DIR_LABELS = ['North', 'East', 'South', 'West'] as const;

function el<K extends keyof SVGElementTagNameMap>(
  name: K,
  attrs: Record<string, string | number>,
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  return node;
}

/**
 * 視点インジケータ。フィールドを真上から見た 4×4 のマップがカメラに合わせて回り、
 * 手前（下辺）に立っている三角が常にプレイヤーの位置を表す。
 *
 * 原点コーナー（ワールド 0,0）に印を付けてあるので、視点を回しても
 * フィールドのどの角を見ているのかを見失わない。
 */
export class Compass {
  readonly element: HTMLDivElement;
  private readonly map: SVGGElement;
  private readonly label: HTMLDivElement;

  constructor() {
    this.element = document.createElement('div');
    this.element.className = 'compass';

    const svg = el('svg', { viewBox: '-32 -32 64 64', width: 96, height: 96 });
    this.map = el('g', {});

    const half = (W * CELL) / 2;
    const grid = el('rect', {
      x: -half,
      y: -half,
      width: W * CELL,
      height: D * CELL,
      fill: '#141926',
      stroke: '#4b5563',
      'stroke-width': 1,
    });
    this.map.appendChild(grid);

    for (let i = 1; i < W; i++) {
      const offset = -half + i * CELL;
      this.map.appendChild(
        el('line', { x1: offset, y1: -half, x2: offset, y2: half, stroke: '#2f3646' }),
      );
      this.map.appendChild(
        el('line', { x1: -half, y1: offset, x2: half, y2: offset, stroke: '#2f3646' }),
      );
    }

    // ワールド原点 (x=0, z=0) の角。回転しても位置関係を見失わないための基準。
    this.map.appendChild(
      el('circle', { cx: -half + CELL / 2, cy: -half + CELL / 2, r: 2.6, fill: '#facc15' }),
    );

    svg.appendChild(this.map);

    // プレイヤーの位置。これは回転しないので常に下辺にいる。
    svg.appendChild(el('polygon', { points: '0,20 -5,28 5,28', fill: '#22d3ee' }));

    this.element.appendChild(svg);

    this.label = document.createElement('div');
    this.label.className = 'compass-label';
    this.element.appendChild(this.label);

    this.update(0, 0);
  }

  /**
   * @param angleDeg カメラの連続角度。補間中も滑らかに追従させる。
   * @param dir 現在（または回転先）の視点。
   */
  update(angleDeg: number, dir: ViewDir): void {
    this.map.setAttribute('transform', `rotate(${angleDeg})`);
    this.label.textContent = DIR_LABELS[dir];
  }
}
