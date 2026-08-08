import * as THREE from 'three';
import { PIECES } from '../core/pieces';
import type { SlotRect } from './previewPanel';
import { BlockField } from './blockField';

/**
 * ゲームオーバー画面のラクダ。ドット絵をゲーム中と同じ立方体で組み立てる。
 *
 * 1文字が1色。8種のピースの色をそのまま使い、テトリミノを積んで作ったように見せる。
 *
 *   i=I(水) o=O(黄) l=L(橙) t=T(紫) s=S(緑) r=右ねじ(赤) w=左ねじ(白) b=三又(青) x=目
 *
 * 同じ色は2〜4マスの塊で置くこと。1マスずつばらすと模様がノイズに見える。
 * ラクダは左を向いている。口は左端に突き出す（右に出すと顔に見えない）。
 * 行は上から順。編集するときは全行の長さを揃えること（コンストラクタで検証する）。
 */
const CAMEL_ART = [
  '.oox...............',
  'oooo....rr...tt....',
  '..ll...rrrr.tttt...',
  '..ll..iirriittssss.',
  '..llbbbbiiiiooooss.',
  '...llwwwwrroooosss.',
  '...bbbbttttwwwwii..',
  '...ss.ii...rr.tt...',
  '...ss.ii...rr.tt...',
  '...ll.bb...ww.oo...',
  '...ll.bb...ww.oo...',
  '..lll.bbb.www.ooo..',
] as const;

/** 縦方向の表示範囲（ワールド単位の半分）。ドット絵の高さ12が収まる値。 */
const HALF_EXTENT = 7.5;

export class CamelView {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(
    -HALF_EXTENT,
    HALF_EXTENT,
    HALF_EXTENT,
    -HALF_EXTENT,
    0.1,
    100,
  );
  private readonly field: BlockField;

  constructor() {
    const width = CAMEL_ART[0].length;
    const height = CAMEL_ART.length;
    for (const [index, row] of CAMEL_ART.entries()) {
      if (row.length !== width) {
        throw new Error(`camel art: 行 ${index} の長さが ${row.length}（${width} であるべき）`);
      }
    }

    const palette: Record<string, THREE.Color> = {
      i: new THREE.Color(PIECES.I.color),
      o: new THREE.Color(PIECES.O.color),
      l: new THREE.Color(PIECES.L.color),
      t: new THREE.Color(PIECES.T.color),
      s: new THREE.Color(PIECES.S.color),
      r: new THREE.Color(PIECES.SCREW_R.color),
      w: new THREE.Color(PIECES.SCREW_L.color),
      b: new THREE.Color(PIECES.TRIPOD.color),
      x: new THREE.Color(0x3b2a17),
    };

    const cells: { x: number; y: number; char: string }[] = [];
    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        const char = CAMEL_ART[row][col];
        if (char === '.') continue;
        if (!palette[char]) throw new Error(`camel art: 未知の文字 '${char}'`);
        cells.push({
          // 原点まわりに中央寄せする。BlockField がセル中心へ +0.5 するぶんも引く。
          x: col - (width - 1) / 2 - 0.5,
          y: height - 1 - row - (height - 1) / 2 - 0.5,
          char,
        });
      }
    }

    this.field = new BlockField(cells.length, { size: 0.88 });
    this.field.begin();
    for (const cell of cells) {
      this.field.add(cell.x, cell.y, -0.5, palette[cell.char]);
    }
    this.field.end();

    // ほぼ正面から。少しだけ振って上面と側面を見せ、立方体だと分かるようにする。
    this.camera.position.set(1.6, 1.3, 10);
    this.camera.lookAt(0, 0, 0);

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const key = new THREE.DirectionalLight(0xffffff, 0.95);
    key.position.set(4, 8, 10);
    this.scene.add(key);
    this.scene.add(this.field.group);
  }

  /** メインシーンを描いたあとに呼ぶこと（renderer.autoClear は false 前提）。 */
  render(renderer: THREE.WebGLRenderer, rect: SlotRect): void {
    if (rect.width <= 0 || rect.height <= 0) return;

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

  dispose(): void {
    this.field.dispose();
  }
}
