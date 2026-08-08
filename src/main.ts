import { Game } from './core/game';
import { PIECE_LABELS } from './core/pieces';
import { nextUnlock, unlockedAtLevel } from './core/progression';
import { resolveRotation, screenToWorld } from './core/view';
import { InputController, type InputHandlers } from './input/controller';
import { Compass, DIR_LABELS } from './render/compass';
import { GameView } from './render/gameView';
import { CamelView } from './render/camelView';
import { GhostView } from './render/ghostView';
import { PreviewPanel, type SlotRect } from './render/previewPanel';
import { Stage } from './render/stage';

const app = document.getElementById('app') as HTMLDivElement;
const stats = document.getElementById('stats') as HTMLDivElement;

const stage = new Stage(app);
const view = new GameView();
const ghost = new GhostView();
stage.scene.add(view.group, ghost.group);

const preview = new PreviewPanel();
const slotElements = ['slot-hold', 'slot-next0', 'slot-next1', 'slot-next2'].map(
  (id) => document.getElementById(id) as HTMLDivElement,
);
let slotRects: SlotRect[] = [];

/** レイアウトが変わったときだけ計測する。毎フレーム読むと強制同期レイアウトが起きる。 */
function measureSlots(): void {
  slotRects = slotElements.map((element) => {
    const rect = element.getBoundingClientRect();
    return { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
  });
}
measureSlots();
window.addEventListener('resize', measureSlots);

const holdSlot = slotElements[0].parentElement as HTMLDivElement;

const camel = new CamelView();
const gameOverEl = document.getElementById('gameover') as HTMLDivElement;
const camelBox = document.getElementById('camel-box') as HTMLDivElement;
let camelRect: SlotRect = { x: 0, y: 0, width: 0, height: 0 };
let gameOverShown = false;

/** display:none のあいだは矩形が取れないので、表示に切り替えた直後に測る。 */
function measureCamel(): void {
  const rect = camelBox.getBoundingClientRect();
  camelRect = { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
}

function syncGameOverOverlay(): void {
  const isOver = game.phase === 'gameover';
  if (isOver === gameOverShown) return;
  gameOverShown = isOver;
  gameOverEl.classList.toggle('show', isOver);
  document.body.classList.toggle('over', isOver);
  if (isOver) measureCamel();
}

window.addEventListener('resize', () => {
  if (gameOverShown) measureCamel();
});

const compass = new Compass();
document.body.appendChild(compass.element);

let game = new Game();
let paused = false;
let notice = '';
let noticeTimer = 0;

function showNotice(text: string, durationMs: number): void {
  notice = text;
  noticeTimer = durationMs;
}

const handlers: InputHandlers = {
  move(right, away) {
    if (paused) return;
    const [dx, dz] = screenToWorld(stage.rig.viewDir, right, away);
    game.move(dx, dz);
  },
  rotate(kind, turn) {
    if (paused) return;
    const resolved = resolveRotation(kind, turn, stage.rig.viewDir);
    game.rotate(resolved.axis, resolved.turn);
  },
  // 視点回転・ポーズ・リスタートはポーズ中でも効かせる。
  turnCamera(delta) {
    stage.rig.turn(delta);
  },
  setSoftDrop(on) {
    game.setSoftDrop(on && !paused);
  },
  hardDrop() {
    if (!paused) game.hardDrop();
  },
  hold() {
    if (paused) return;
    // 効かなかった理由を出さないと「壊れている」と受け取られる。
    if (!game.hold() && game.phase === 'falling') {
      showNotice('ホールドはピースを置くまで1回だけ', 1800);
    }
  },
  useItem() {
    if (paused) return;
    if (!game.useItem() && game.phase === 'falling') {
      showNotice(game.items === 0 ? 'アイテムがありません' : '消せるブロックがありません', 1800);
    }
  },
  togglePause() {
    if (game.phase === 'falling') paused = !paused;
  },
  restart() {
    game = new Game();
    paused = false;
    notice = '';
    noticeTimer = 0;
  },
};

const input = new InputController(handlers);
input.attach();

function row(label: string, value: string | number): string {
  return `<div class="row"><span>${label}</span><span class="value">${value}</span></div>`;
}

const label = (id: string | null): string =>
  id ? (PIECE_LABELS[id as keyof typeof PIECE_LABELS] ?? id) : '-';

function updateStats(dt: number): void {
  for (const event of game.drainEvents()) {
    if (event.type === 'clear') {
      showNotice(`${event.layers.length} レイヤー消去 +${event.gained}`, 2500);
    } else if (event.type === 'levelup') {
      const unlocked = unlockedAtLevel(event.level);
      if (unlocked.length > 0) {
        showNotice(`新しいピース: ${unlocked.map(label).join(' / ')}`, 5000);
      }
    } else if (event.type === 'item-used') {
      showNotice(`${label(event.id)} のブロックを ${event.removed} 個消去`, 2500);
    }
  }

  noticeTimer = Math.max(0, noticeTimer - dt);
  if (noticeTimer === 0) notice = '';

  // 次に使えるようになるまで HOLD の枠を沈ませる。
  holdSlot.classList.toggle('locked', !game.canHold);

  const upcoming = nextUnlock(game.level);
  // ゲームオーバーは左側の大きな表示が担当するので、ここには出さない。
  const banner = paused
    ? '<div class="banner">PAUSED — P で再開</div>'
    : notice
      ? `<div class="banner">${notice}</div>`
      : '';

  stats.innerHTML = [
    row('SCORE', game.score),
    row('LEVEL', game.level),
    row('LAYERS', game.totalLayers),
    row('ITEM', `${'◆'.repeat(game.items)}${'◇'.repeat(Math.max(0, 3 - game.items))} ${game.items}`),
    '<hr>',
    row('NOW', label(game.activeId)),
    '<hr>',
    row('VIEW', DIR_LABELS[stage.rig.viewDir]),
    upcoming ? row('解禁', `Lv${upcoming.level} ${upcoming.ids.map(label).join('/')}`) : '',
    banner,
  ].join('');
}

let previous = performance.now();

stage.renderer.setAnimationLoop((now: number) => {
  // タブ復帰直後に一気に進んでしまわないよう上限をかける。
  const dt = Math.min(now - previous, 100);
  previous = now;

  input.update(dt);
  if (!paused) game.tick(dt);
  stage.rig.update(dt);

  view.sync(game);
  ghost.sync(game);
  compass.update(stage.rig.angleDeg, stage.rig.viewDir);
  updateStats(dt);
  syncGameOverOverlay();
  stage.render();

  // シザーで重ねる描画はメインシーンのあと。順序を変えると消える。
  const upcoming = game.nextQueue(3);
  preview.render(stage.renderer, game.held, slotRects[0]);
  for (let i = 0; i < 3; i++) {
    preview.render(stage.renderer, upcoming[i] ?? null, slotRects[i + 1]);
  }
  if (gameOverShown) camel.render(stage.renderer, camelRect);
});
