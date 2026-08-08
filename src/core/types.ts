/** 3D整数座標。セル座標にもボックス内座標にも使う。 */
export type Vec3 = [number, number, number];

/** ピースの種類。3Dでは鏡像を回転で作れるため S/Z と J/L は同一視され、全8種になる。 */
export type PieceId = 'I' | 'O' | 'L' | 'T' | 'S' | 'TRIPOD' | 'SCREW_R' | 'SCREW_L';

export const PIECE_IDS: readonly PieceId[] = [
  'I',
  'O',
  'L',
  'T',
  'S',
  'TRIPOD',
  'SCREW_R',
  'SCREW_L',
] as const;

/** ピースIDは盤面に 1..8 の数値として格納する（0 は空セル）。 */
export const PIECE_CODE: Record<PieceId, number> = {
  I: 1,
  O: 2,
  L: 3,
  T: 4,
  S: 5,
  TRIPOD: 6,
  SCREW_R: 7,
  SCREW_L: 8,
};

export const CODE_TO_PIECE: Record<number, PieceId> = Object.fromEntries(
  PIECE_IDS.map((id) => [PIECE_CODE[id], id]),
);

/** カメラの向き。0=North, 1=East, 2=South, 3=West（時計回り）。 */
export type ViewDir = 0 | 1 | 2 | 3;

/** ワールドの回転軸。 */
export type WorldAxis = 'x' | 'y' | 'z';

/** プレイヤーから見た回転の種類。実際のワールド軸は ViewDir によって決まる。 */
export type RotAxis = 'yaw' | 'pitch' | 'roll';

/** +1 = 正方向（右ねじ）、-1 = 逆方向。 */
export type Turn = 1 | -1;
