import * as THREE from 'three';
import type { Game } from '../core/game';
import { PIECES } from '../core/pieces';
import type { Vec3 } from '../core/types';
import { BlockField } from './blockField';

const GHOST_SIZE = 0.86;

/** 立方体の8隅（符号）。index = (yビット<<2) | (zビット<<1) | xビット */
const CORNERS: readonly Vec3[] = [
  [-1, -1, -1],
  [1, -1, -1],
  [-1, -1, 1],
  [1, -1, 1],
  [-1, 1, -1],
  [1, 1, -1],
  [-1, 1, 1],
  [1, 1, 1],
];

const CUBE_EDGES: readonly [number, number][] = [
  [0, 1], [1, 3], [3, 2], [2, 0], // 下面
  [4, 5], [5, 7], [7, 6], [6, 4], // 上面
  [0, 4], [1, 5], [2, 6], [3, 7], // 縦
];

/** 落下ピースは常に4セルなので、必要な頂点数は上限が決まっている。 */
const MAX_CELLS = 4;
const GHOST_EDGE_VERTS = MAX_CELLS * CUBE_EDGES.length * 2;
const PILLAR_VERTS = MAX_CELLS * 2;

function makeDynamicLines(
  vertexCount: number,
  material: THREE.LineBasicMaterial,
): THREE.LineSegments {
  const geometry = new THREE.BufferGeometry();
  const attribute = new THREE.BufferAttribute(new Float32Array(vertexCount * 3), 3);
  attribute.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('position', attribute);
  geometry.setDrawRange(0, 0);

  const lines = new THREE.LineSegments(geometry, material);
  lines.frustumCulled = false;
  return lines;
}

/**
 * 奥行きを読むための補助表示。3Dテトリスで一番重要な部分で、
 * これが無いと「どこに落ちるか分からない理不尽なゲーム」になる。
 *
 *   1. ゴーストピース … 着地位置に半透明のピース＋輪郭線
 *   2. 柱ライン       … 現在ピースの各列から床まで伸びる縦線
 *   3. 床ハイライト   … 落下先の列にあたる床のマス
 */
export class GhostView {
  readonly group = new THREE.Group();

  private readonly fill = new BlockField(MAX_CELLS, {
    size: GHOST_SIZE,
    opacity: 0.15,
    outline: false,
  });

  private readonly edgeMaterial = new THREE.LineBasicMaterial({
    transparent: true,
    opacity: 0.75,
  });
  private readonly pillarMaterial = new THREE.LineBasicMaterial({
    transparent: true,
    opacity: 0.3,
  });
  // 床は積みブロックの下に埋もれるので、深度テストを切って常に見えるようにする。
  // 「今どの列にいるか」は3Dで最も判断しづらく、隠れてしまうと役に立たない。
  private readonly footprintMaterial = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
    depthTest: false,
  });

  private readonly edges = makeDynamicLines(GHOST_EDGE_VERTS, this.edgeMaterial);
  private readonly pillars = makeDynamicLines(PILLAR_VERTS, this.pillarMaterial);
  private readonly footprint: THREE.InstancedMesh;

  private readonly color = new THREE.Color();
  private readonly matrix = new THREE.Matrix4();

  constructor() {
    const plane = new THREE.PlaneGeometry(0.92, 0.92);
    plane.rotateX(-Math.PI / 2); // 回転を焼き込んでおけばインスタンス行列は平行移動だけで済む
    this.footprint = new THREE.InstancedMesh(plane, this.footprintMaterial, MAX_CELLS);
    this.footprint.frustumCulled = false;
    this.footprint.renderOrder = 2; // 深度テストを切っている以上、描画順は明示しておく
    this.footprint.count = 0;

    this.group.add(this.fill.group, this.edges, this.pillars, this.footprint);
  }

  sync(game: Game): void {
    const active = game.activeCells();
    const ghost = game.ghostCells();
    const id = game.activeId;

    if (!active || !ghost || !id) {
      this.hide();
      return;
    }

    this.color.set(PIECES[id].color);
    this.edgeMaterial.color.copy(this.color);
    this.pillarMaterial.color.copy(this.color);
    this.footprintMaterial.color.copy(this.color);

    // 接地済みでゴーストが本体と重なっているときは、二重描画で濁るので出さない。
    const landed = ghost[0][1] === active[0][1];
    this.syncGhost(landed ? [] : ghost);
    this.syncPillars(active);
    this.syncFootprint(ghost);
  }

  private hide(): void {
    this.fill.begin();
    this.fill.end();
    this.edges.geometry.setDrawRange(0, 0);
    this.pillars.geometry.setDrawRange(0, 0);
    this.footprint.count = 0;
  }

  private syncGhost(cells: Vec3[]): void {
    this.fill.begin();
    for (const [x, y, z] of cells) this.fill.add(x, y, z, this.color);
    this.fill.end();

    const position = this.edges.geometry.getAttribute('position') as THREE.BufferAttribute;
    const array = position.array as Float32Array;
    const half = GHOST_SIZE / 2;
    let index = 0;

    for (const [x, y, z] of cells) {
      for (const [a, b] of CUBE_EDGES) {
        for (const corner of [CORNERS[a], CORNERS[b]]) {
          array[index++] = x + 0.5 + corner[0] * half;
          array[index++] = y + 0.5 + corner[1] * half;
          array[index++] = z + 0.5 + corner[2] * half;
        }
      }
    }
    position.needsUpdate = true;
    this.edges.geometry.setDrawRange(0, index / 3);
  }

  /** 各列について、ピースの一番下のセルから床まで縦線を引く。 */
  private syncPillars(cells: Vec3[]): void {
    const lowest = new Map<string, Vec3>();
    for (const cell of cells) {
      const key = `${cell[0]},${cell[2]}`;
      const current = lowest.get(key);
      if (!current || cell[1] < current[1]) lowest.set(key, cell);
    }

    const position = this.pillars.geometry.getAttribute('position') as THREE.BufferAttribute;
    const array = position.array as Float32Array;
    let index = 0;

    for (const [x, y, z] of lowest.values()) {
      array[index++] = x + 0.5;
      array[index++] = y + 0.5;
      array[index++] = z + 0.5;
      array[index++] = x + 0.5;
      array[index++] = 0;
      array[index++] = z + 0.5;
    }
    position.needsUpdate = true;
    this.pillars.geometry.setDrawRange(0, index / 3);
  }

  /** 落下先の列にあたる床のマスを塗る。真上から見た位置関係の手がかりになる。 */
  private syncFootprint(cells: Vec3[]): void {
    const columns = new Set<string>();
    let count = 0;

    for (const [x, , z] of cells) {
      const key = `${x},${z}`;
      if (columns.has(key)) continue;
      columns.add(key);

      this.matrix.makeTranslation(x + 0.5, 0.02, z + 0.5);
      this.footprint.setMatrixAt(count, this.matrix);
      count++;
    }

    this.footprint.count = count;
    this.footprint.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    this.fill.dispose();
    this.edges.geometry.dispose();
    this.pillars.geometry.dispose();
    this.footprint.geometry.dispose();
    this.edgeMaterial.dispose();
    this.pillarMaterial.dispose();
    this.footprintMaterial.dispose();
  }
}
