import * as THREE from 'three';

const MATRIX = new THREE.Matrix4();

export interface BlockFieldOptions {
  /** 立方体の一辺。1 未満にして隣接ブロックの間に隙間を作る。 */
  size?: number;
  opacity?: number;
  /** 背面描画による暗い縁取り。3Dでセルの境界を読むために効く。 */
  outline?: boolean;
  emissive?: number;
}

/**
 * ブロックの塊をひとつの InstancedMesh で描く。
 *
 * 毎フレーム begin() → add() を必要な数だけ → end() と呼ぶ即時モード。
 * Mesh を個別に生成／破棄しないので、消去アニメで GC が跳ねない。
 */
export class BlockField {
  readonly group = new THREE.Group();

  private readonly fill: THREE.InstancedMesh;
  private readonly outline: THREE.InstancedMesh | null;
  private readonly capacity: number;
  private count = 0;

  constructor(capacity: number, options: BlockFieldOptions = {}) {
    this.capacity = capacity;
    const size = options.size ?? 0.86;
    const opacity = options.opacity ?? 1;

    const material = new THREE.MeshStandardMaterial({
      roughness: 0.45,
      metalness: 0.05,
      emissive: new THREE.Color(options.emissive ?? 0x000000),
      emissiveIntensity: options.emissive === undefined ? 0 : 1,
      transparent: opacity < 1,
      opacity,
      depthWrite: opacity >= 1,
    });

    this.fill = new THREE.InstancedMesh(
      new THREE.BoxGeometry(size, size, size),
      material,
      capacity,
    );
    this.fill.instanceColor = new THREE.InstancedBufferAttribute(
      new Float32Array(capacity * 3),
      3,
    );
    this.fill.frustumCulled = false;
    this.fill.count = 0;
    this.group.add(this.fill);

    if (options.outline ?? opacity >= 1) {
      const shellSize = size + 0.1;
      this.outline = new THREE.InstancedMesh(
        new THREE.BoxGeometry(shellSize, shellSize, shellSize),
        new THREE.MeshBasicMaterial({ color: 0x05070d, side: THREE.BackSide }),
        capacity,
      );
      this.outline.frustumCulled = false;
      this.outline.count = 0;
      this.group.add(this.outline);
    } else {
      this.outline = null;
    }
  }

  begin(): void {
    this.count = 0;
  }

  /** セル座標を渡す。セルの中心にブロックを置く。 */
  add(x: number, y: number, z: number, color: THREE.Color): void {
    if (this.count >= this.capacity) return;
    MATRIX.makeTranslation(x + 0.5, y + 0.5, z + 0.5);
    this.fill.setMatrixAt(this.count, MATRIX);
    this.fill.setColorAt(this.count, color);
    this.outline?.setMatrixAt(this.count, MATRIX);
    this.count++;
  }

  end(): void {
    this.fill.count = this.count;
    this.fill.instanceMatrix.needsUpdate = true;
    if (this.fill.instanceColor) this.fill.instanceColor.needsUpdate = true;
    if (this.outline) {
      this.outline.count = this.count;
      this.outline.instanceMatrix.needsUpdate = true;
    }
  }

  dispose(): void {
    this.fill.geometry.dispose();
    (this.fill.material as THREE.Material).dispose();
    this.outline?.geometry.dispose();
    if (this.outline) (this.outline.material as THREE.Material).dispose();
  }
}
