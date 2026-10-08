import { STEP_SECONDS, createGame, step, type GameState, type GameStatus, type LevelSpec } from './game';
import { attachKeyboard, HeldKeys } from './input/keyboard';
import { drawGame } from './render/draw';
import { levelFromQuery, randomSeed, seedFromQuery, type SeedChoice } from './query';

/** 固定步长：每步 1/60 秒，和 step() 的约定一致。 */
const STEP_MS = STEP_SECONDS * 1000;
/**
 * 一帧最多补多少步。
 * 切到后台再回来时 rAF 会带来很大的时间差，超出的部分直接丢掉，避免一帧把整局快进完。
 */
const MAX_STEPS_PER_FRAME = 5;

const STATUS_HINT: Record<GameStatus, string> = {
  playing: '进行中',
  won: '胜利！',
  lost: '失败',
};

const canvas = requireElement('#board', HTMLCanvasElement);
const enemiesEl = requireElement('[data-testid="enemies-left"]', HTMLElement);
const statusEl = requireElement('[data-testid="game-status"]', HTMLElement);
const hintEl = requireElement('#status-hint', HTMLElement);
const seedEl = requireElement('#seed-value', HTMLElement);
const restartButton = requireElement('[data-testid="restart"]', HTMLButtonElement);
const context = canvas.getContext('2d');
if (!context) throw new Error('无法创建 Canvas 2D 上下文');
const ctx: CanvasRenderingContext2D = context;

const params = new URLSearchParams(window.location.search);
/** 重新开始时保留同一张地图：网址里的 level 只在进页面时解析一次。 */
const level: LevelSpec | undefined = levelFromQuery(params.get('level'));
let seedChoice: SeedChoice = seedFromQuery(params.get('seed'));

const held = new HeldKeys();
attachKeyboard(window, held);

let state = createMatch(seedChoice.seed);
let accumulator = 0;
let lastTime = performance.now();

syncHud();
drawGame(ctx, state);

restartButton.addEventListener('click', () => {
  restart();
});

window.addEventListener('keydown', (event) => {
  // 胜负之后才响应回车。按钮获得焦点时交给 click，避免同一次回车开两局。
  if (event.key !== 'Enter' || state.status === 'playing') return;
  if (event.target === restartButton) return;
  event.preventDefault();
  restart();
});

requestAnimationFrame(frame);

function frame(now: number): void {
  const delta = Math.max(0, now - lastTime);
  lastTime = now;
  stepFrame(delta);
  drawGame(ctx, state);
  syncHud();
  requestAnimationFrame(frame);
}

/** 对局进行中才推进；结束后停在最后一帧。 */
function stepFrame(delta: number): void {
  if (state.status !== 'playing') {
    accumulator = 0;
    return;
  }

  accumulator += delta;
  let steps = 0;
  while (accumulator >= STEP_MS && steps < MAX_STEPS_PER_FRAME && state.status === 'playing') {
    state = step(state, held.toInput());
    accumulator -= STEP_MS;
    steps += 1;
  }
  if (steps === MAX_STEPS_PER_FRAME && accumulator >= STEP_MS) accumulator = 0;
}

function restart(): void {
  // 网址锁定了种子就复用；否则每局换一个新的随机种子。地图保持不变。
  if (!seedChoice.fromUrl) seedChoice = { seed: randomSeed(), fromUrl: false };
  state = createMatch(seedChoice.seed);
  accumulator = 0;
  syncHud();
  drawGame(ctx, state);
}

function createMatch(seed: number): GameState {
  // 不认识的 level 不传，createGame 使用默认地图。
  if (level === undefined) return createGame({ seed });
  return createGame({ seed, level });
}

function syncHud(): void {
  enemiesEl.textContent = `剩余敌人：${state.enemiesLeft}`;
  statusEl.textContent = state.status;
  hintEl.textContent = STATUS_HINT[state.status];
  seedEl.textContent = String(state.seed);
  restartButton.hidden = state.status === 'playing';
}

function requireElement<T extends Element>(selector: string, kind: new () => T): T {
  const element = document.querySelector(selector);
  if (!(element instanceof kind)) throw new Error(`页面缺少元素 ${selector}`);
  return element;
}
