import { describe, expect, it } from 'vitest';
import { createGame, step, type GameState, type Input } from '../../src/game/index';
import { makeLevel, runSteps, runUntil, snapshot, tankById } from './helpers';

const SEED = 1;

describe('规则5 胜负', () => {
  it('规则5：玩家被敌方子弹打中就失败，没有第二条命', () => {
    const rows = Array.from({ length: 5 }, () => '.....');
    const started = createGame({
      seed: SEED,
      level: makeLevel(rows, {
        player: { col: 2, row: 4, dir: 'up' },
        enemies: [{ col: 2, row: 0, dir: 'down', behavior: 'shoot' }],
      }),
    });

    const lost = runUntil(started, (state) => state.status !== 'playing', 200);
    expect(lost.status).toBe('lost');
    expect(tankById(lost, 'player').alive).toBe(false);
    expect(tankById(lost, 'enemy-1').alive).toBe(true);
    expect(lost.enemiesLeft).toBe(1);
    // 失败后坦克还在数组里，只是活不了。
    expect(lost.tanks.some((tank) => tank.id === 'player')).toBe(true);
  });

  it('规则5：敌方坦克全部被击毁才胜利', () => {
    const rows = Array.from({ length: 5 }, () => '.....');
    let state = createGame({
      seed: SEED,
      level: makeLevel(rows, {
        player: { col: 2, row: 4, dir: 'up' },
        enemies: [
          { col: 2, row: 0, dir: 'down', behavior: 'still' },
          { col: 0, row: 0, dir: 'down', behavior: 'still' },
        ],
      }),
    });

    state = runUntil(step(state, { fire: true }), (current) => current.bullets.length === 0, 80);
    expect(tankById(state, 'enemy-1').alive).toBe(false);
    expect(tankById(state, 'enemy-2').alive).toBe(true);
    expect(state.enemiesLeft).toBe(1);
    expect(state.status).toBe('playing');

    state = runUntil(state, (current) => tankById(current, 'player').x === 0, 80, { move: 'left' });
    state = step(state, { move: 'up' });
    state = runUntil(step(state, { fire: true }), (current) => current.status !== 'playing', 120);
    expect(tankById(state, 'enemy-2').alive).toBe(false);
    expect(state.enemiesLeft).toBe(0);
    expect(state.status).toBe('won');
    expect(tankById(state, 'player').alive).toBe(true);
  });

  it('规则5：场上没有敌人时，开局就是胜利', () => {
    const rows = Array.from({ length: 3 }, () => '...');
    const state = createGame({
      seed: SEED,
      level: makeLevel(rows, { enemies: [] }),
    });
    expect(state.status).toBe('won');
    expect(state.enemiesLeft).toBe(0);
    expect(state.tick).toBe(0);
  });

  it('规则5：胜负确定之后再 step，状态不变，tick 也不增加', () => {
    const rows = Array.from({ length: 5 }, () => '.....');
    const lostStart = createGame({
      seed: SEED,
      level: makeLevel(rows, {
        player: { col: 2, row: 4, dir: 'up' },
        enemies: [{ col: 2, row: 0, dir: 'down', behavior: 'shoot' }],
      }),
    });
    const lost = runUntil(lostStart, (state) => state.status === 'lost', 200);
    const lostLater = runSteps(lost, 8, { move: 'left', fire: true });
    expect(snapshot(lostLater)).toBe(snapshot(lost));
    expect(lostLater.tick).toBe(lost.tick);

    const won = createGame({ seed: SEED, level: makeLevel(rows, { enemies: [] }) });
    const wonLater = runSteps(won, 5, { move: 'right', fire: true });
    expect(snapshot(wonLater)).toBe(snapshot(won));
    expect(wonLater.tick).toBe(0);
  });

  it('规则5：玩家和最后一辆敌人在同一步被击毁时判负', () => {
    // 几何（敌人在 (0,0) 朝下，玩家在 (16,32) 朝上，同一帧双方开火）：
    // 子弹横向错开 16 像素，两条弹道不相交，所以不会对撞抵消；
    // 但 4 像素宽的子弹仍然打得到对方 32 像素的车体。
    // 纵向刚好贴住：子弹各走 1 像素后，同一子步里同时命中。
    //
    // 玩家速度是 2，出生点又在格子上，要停在 x=16 还保持朝上，
    // 转向时会被吸回最近的格子。这里用一辆往左开的 random 敌人挡住这次吸附，
    // 并在转向的同一帧用事先射出的子弹打掉它，场上就只剩最后那辆 shoot 敌人。
    // seed 2 让这辆挡板在第 66 步之前不转向、也不开火。
    const fatal = playMutualKill();
    const before = fatal.before;
    const after = fatal.after;

    expect(before.tick).toBe(72);
    expect(before.status).toBe('playing');
    expect(before.enemiesLeft).toBe(1);
    expect(tankById(before, 'player').alive).toBe(true);
    expect(tankById(before, 'enemy-1').alive).toBe(true);
    expect(tankById(before, 'enemy-2').alive).toBe(false);
    expect(before.bullets.some((bullet) => bullet.ownerId === 'enemy-1')).toBe(false);

    expect(after.tick).toBe(73);
    expect(tankById(after, 'player').alive).toBe(false);
    expect(tankById(after, 'enemy-1').alive).toBe(false);
    expect(after.enemiesLeft).toBe(0);
    // 两人同一步死：敌人清零也不能判胜。
    expect(after.status).toBe('lost');
  });
});

/**
 * 把双杀场景推进到「致命一步」的前一帧和这一帧。
 * 地图 8×10。shoot 敌人在左上角朝下；挡板从第 4 列朝左开。
 * 前 9 步玩家停在安全列，等第一发敌弹飞过自己的高度。
 */
function playMutualKill(): { before: GameState; after: GameState } {
  const rows = Array.from({ length: 10 }, () => '........');
  let state = createGame({
    seed: 2,
    level: makeLevel(rows, {
      player: { col: 1, row: 1, dir: 'left' },
      enemies: [
        { col: 0, row: 0, dir: 'down', behavior: 'shoot' },
        { col: 4, row: 1, dir: 'left', behavior: 'random' },
      ],
    }),
  });

  const blocker = tankById(state, 'enemy-2');
  expect(blocker.fireCooldown).toBeGreaterThanOrEqual(67);
  expect(blocker.turnTimer).toBeGreaterThanOrEqual(67);

  for (let n = 1; n <= 66; n++) state = step(state, inputAt(n));

  const parked = tankById(state, 'player');
  expect(parked).toMatchObject({ x: 16, y: 32, dir: 'up', alive: true });
  expect(tankById(state, 'enemy-2').alive).toBe(false);
  expect(tankById(state, 'enemy-1').alive).toBe(true);

  // 第一发敌弹还在往地图底部飞。它消失的下一帧，敌人会立刻再开一枪。
  state = runSteps(state, 6);
  const before = state;
  const after = step(before, { fire: true });
  return { before, after };
}

/** 第 n 步（从 1 计）的玩家输入。空对象表示这一帧只让敌人自己动。 */
function inputAt(stepNumber: number): Input {
  if (stepNumber >= 10 && stepNumber <= 25) return { move: 'left' };
  if (stepNumber >= 26 && stepNumber <= 29) return { move: 'right' };
  if (stepNumber === 61) return { fire: true };
  if (stepNumber >= 62 && stepNumber <= 65) return { move: 'right' };
  if (stepNumber === 66) return { move: 'up' };
  return {};
}
