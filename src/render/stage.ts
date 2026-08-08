import * as THREE from 'three';
import { D, VISIBLE_H, W } from '../core/board';
import { CameraRig } from './cameraRig';

export const BG_COLOR = 0x0b0d14;

/** 高さの目安線を入れる間隔。積み上がりの高さを目測するのに使う。 */
const GUIDE_INTERVAL = 4;

/**
 * レンダラ・シーン・ライト・ピットの枠組み。ゲームの状態は一切持たない。
 */
export class Stage {
  readonly scene = new THREE.Scene();
  readonly renderer: THREE.WebGLRenderer;
  readonly rig = new CameraRig();

  private readonly handleResize = () => this.resize();

  constructor(private readonly container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    // NEXT/HOLD のプレビューを重ねて描くので、クリアは自前で管理する。
    this.renderer.autoClear = false;
    container.appendChild(this.renderer.domElement);

    this.scene.background = new THREE.Color(BG_COLOR);
    // 奥のブロックをわずかに沈ませて奥行きの手がかりにする。
    this.scene.fog = new THREE.Fog(BG_COLOR, 16, 40);

    this.addLights();
    this.addPit();
    this.resize();

    window.addEventListener('resize', this.handleResize);
  }

  private addLights(): void {
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.55));

    const key = new THREE.DirectionalLight(0xffffff, 1.0);
    key.position.set(8, 20, 12);
    this.scene.add(key);

    // 反対側からの弱い寒色。面の向きが読めるようになる。
    const fill = new THREE.DirectionalLight(0x8ab4ff, 0.35);
    fill.position.set(-10, 6, -8);
    this.scene.add(fill);
  }

  private addPit(): void {
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(W, D),
      new THREE.MeshStandardMaterial({ color: 0x151a26, roughness: 0.9 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(W / 2, -0.01, D / 2);
    this.scene.add(floor);

    const grid = new THREE.GridHelper(W, W, 0x4b5563, 0x2f3646);
    grid.position.set(W / 2, 0.01, D / 2);
    this.scene.add(grid);

    const corners: [number, number][] = [
      [0, 0],
      [W, 0],
      [W, D],
      [0, D],
    ];

    // ピットの枠（底の四角・上端の四角・四隅の縦線）
    const frame: number[] = [];
    for (let i = 0; i < 4; i++) {
      const a = corners[i];
      const b = corners[(i + 1) % 4];
      frame.push(a[0], 0, a[1], b[0], 0, b[1]);
      frame.push(a[0], VISIBLE_H, a[1], b[0], VISIBLE_H, b[1]);
      frame.push(a[0], 0, a[1], a[0], VISIBLE_H, a[1]);
    }
    this.addLines(frame, 0x3b4557, 0.7);

    // 高さの目安線。細い縦シャフトでは積み上がりの高さが目測しづらいため。
    const guides: number[] = [];
    for (let y = GUIDE_INTERVAL; y < VISIBLE_H; y += GUIDE_INTERVAL) {
      for (let i = 0; i < 4; i++) {
        const a = corners[i];
        const b = corners[(i + 1) % 4];
        guides.push(a[0], y, a[1], b[0], y, b[1]);
      }
    }
    this.addLines(guides, 0x2a3242, 0.55);
  }

  private addLines(positions: number[], color: number, opacity: number): void {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    this.scene.add(
      new THREE.LineSegments(
        geometry,
        new THREE.LineBasicMaterial({ color, transparent: true, opacity }),
      ),
    );
  }

  private width = 0;
  private height = 0;

  private resize(): void {
    this.width = this.container.clientWidth || window.innerWidth;
    this.height = this.container.clientHeight || window.innerHeight;
    this.rig.setAspect(this.width / this.height);
    this.renderer.setSize(this.width, this.height);
  }

  render(): void {
    // 前フレームのプレビュー描画でビューポートが縮んだままなので毎回戻す。
    this.renderer.setScissorTest(false);
    this.renderer.setViewport(0, 0, this.width, this.height);
    this.renderer.clear();
    this.renderer.render(this.scene, this.rig.camera);
  }

  dispose(): void {
    window.removeEventListener('resize', this.handleResize);
    this.renderer.dispose();
  }
}
