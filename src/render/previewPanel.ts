import * as THREE from 'three';
import { PIECES } from '../core/pieces';
import type { PieceId } from '../core/types';
import { BlockField } from './blockField';

/** プレビューの表示範囲（縦方向の半分のサイズ、ワールド単位）。I ピース（長さ4）が収まる値。 */
const HALF_EXTENT = 2.8;

/** CSSピクセルの矩形（左上原点）。DOM の getBoundingClientRect と同じ座標系。 */
export interface SlotRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * NEXT / HOLD のピースを立体で見せる小窓。
 *
 * メインのレンダラにシザー矩形を切って描くので、盤面のブロックとまったく同じ
 * ジオメトリ・マテリアル・ライティングになる。名前（SCREW_R 等）だけでは
 * 形が想像できないため、初心者にはここが効く。
 */
export class PreviewPanel {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(
    -HALF_EXTENT,
    HALF_EXTENT,
    HALF_EXTENT,
    -HALF_EXTENT,
    0.1,
    100,
  );
  private readonly field = new BlockField(4, { size: 0.84 });
  private readonly color = new THREE.Color();

  constructor() {
    // 3軸すべてが見える角度。真横からだと立体ピースが平面に見えてしまう。
    this.camera.position.set(7, 5.5, 7);
    this.camera.lookAt(0, 0, 0);

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const key = new THREE.DirectionalLight(0xffffff, 0.9);
    key.position.set(5, 9, 6);
    this.scene.add(key);
    this.scene.add(this.field.group);
  }

  /**
   * 1スロットぶんを描く。メインのシーンを描いたあとに呼ぶこと。
   * renderer.autoClear は false にしておく必要がある。
   */
  render(renderer: THREE.WebGLRenderer, id: PieceId | null, rect: SlotRect): void {
    if (!id || rect.width <= 0 || rect.height <= 0) return;
    this.setPiece(id);

    // WebGL のシザーは左下原点。DOM は左上原点なので Y を反転する。
    // three は内部で pixelRatio を掛けるため、ここは CSS ピクセルのまま渡す。
    const flippedY = renderer.domElement.clientHeight - rect.y - rect.height;

    const aspect = rect.width / rect.height;
    this.camera.left = -HALF_EXTENT * aspect;
    this.camera.right = HALF_EXTENT * aspect;
    this.camera.updateProjectionMatrix();

    renderer.setViewport(rect.x, flippedY, rect.width, rect.height);
    renderer.setScissor(rect.x, flippedY, rect.width, rect.height);
    renderer.setScissorTest(true);
    renderer.clearDepth();
    renderer.render(this.scene, this.camera);
    renderer.setScissorTest(false);
  }

  private setPiece(id: PieceId): void {
    const def = PIECES[id];
    this.color.set(def.color);

    // ボックス内での位置のままだと窓の端に寄るので、原点まわりに中央寄せする。
    const center = [0, 1, 2].map((axis) => {
      const values = def.cells.map((cell) => cell[axis]);
      return (Math.min(...values) + Math.max(...values)) / 2;
    });

    this.field.begin();
    for (const [x, y, z] of def.cells) {
      // BlockField はセル中心へ +0.5 するので、その分を引いておく。
      this.field.add(x - center[0] - 0.5, y - center[1] - 0.5, z - center[2] - 0.5, this.color);
    }
    this.field.end();
  }

  dispose(): void {
    this.field.dispose();
  }
}
