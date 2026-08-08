import * as THREE from 'three';
import { D, VISIBLE_H, W } from '../core/board';
import type { ViewDir } from '../core/types';

/** 視点回転にかける時間。瞬間切り替えだとどちらに回ったか分からず方向感覚を失う。 */
export const TURN_DURATION_MS = 250;

/** ピット全体（高さ12）が縦にちょうど収まる距離。 */
const RADIUS = 18;
const HEIGHT = 14;

const easeInOutCubic = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;

/**
 * カメラを4方向に90°ずつ回す。盤面（ワールド）は絶対に回さない。
 *
 * ViewDir と方位角の対応は core/view.ts のテーブルと一致させること：
 *   dir 0 → カメラは +Z 側、1 → +X 側、2 → -Z 側、3 → -X 側。
 */
export class CameraRig {
  readonly camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200);
  readonly target = new THREE.Vector3(W / 2, VISIBLE_H / 2, D / 2);

  /** 回転の累計。4で割った余りが ViewDir。 */
  private turns = 0;
  private fromAngle = 0;
  private toAngle = 0;
  private currentAngle = 0;
  private elapsed = TURN_DURATION_MS;

  constructor() {
    this.apply();
  }

  /** 補間の終着点。入力のマッピングは押した瞬間に切り替えたいのでこちらを使う。 */
  get viewDir(): ViewDir {
    return ((((this.turns % 4) + 4) % 4) as ViewDir);
  }

  /** 補間中の連続的な角度（度）。コンパスの表示をカメラに追従させるのに使う。 */
  get angleDeg(): number {
    return this.currentAngle;
  }

  get isTurning(): boolean {
    return this.elapsed < TURN_DURATION_MS;
  }

  turn(delta: 1 | -1): void {
    // 補間の途中で押されても、今いる角度から繋ぎ直すのでカクつかない。
    this.fromAngle = this.currentAngle;
    this.turns += delta;
    this.toAngle = this.turns * 90;
    this.elapsed = 0;
  }

  update(dtMs: number): void {
    if (this.elapsed < TURN_DURATION_MS) {
      this.elapsed = Math.min(this.elapsed + dtMs, TURN_DURATION_MS);
      const t = easeInOutCubic(this.elapsed / TURN_DURATION_MS);
      this.currentAngle = this.fromAngle + (this.toAngle - this.fromAngle) * t;
    } else {
      this.currentAngle = this.toAngle;
    }
    this.apply();
  }

  private apply(): void {
    const angle = THREE.MathUtils.degToRad(this.currentAngle);
    this.camera.position.set(
      this.target.x + Math.sin(angle) * RADIUS,
      HEIGHT,
      this.target.z + Math.cos(angle) * RADIUS,
    );
    this.camera.lookAt(this.target);
  }

  setAspect(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }
}
