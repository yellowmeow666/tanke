import { describe, expect, it } from 'vitest';
import { createGame, ENEMY_FIRE_COOLDOWN_MIN, step, type GameState } from '../../src/game/index';
import { makeLevel, snapshot, tankById } from './helpers';

const SEED = 1;

function arena() {
  const rows = Array.from({ length: 8 }, () => '........');
  return makeLevel(rows, {
    player: { col: 7, row: 7, dir: 'up' },
    enemies: [{ col: 3, row: 3, dir: 'right', behavior: 'random' }],
  });
}

/** 记录某辆敌人「从没有自己的子弹」变成「有」的 tick，也就是开火的那一步。 */
function fireTicks(seed: number, limit = 500): number[] {
  let state = createGame({ seed, level: arena() });
  const ticks: number[] = [];
  let hadBullet = false;
  for (let i = 0; i < limit && ticks.length < 2; i++) {
    state = step(state);
    const hasBullet = state.bullets.some((bullet) => bullet.ownerId === 'enemy-1');
    if (hasBullet && !hadBullet) ticks.push(state.tick);
    hadBullet = hasBullet;
  }
  return ticks;
}

describe('规则6 敌人自己会动，并且由 seed 决定', () => {
  it('规则6：random 敌人会移动、会转向，也会射出子弹', () => {
    const started = createGame({ seed: SEED, level: arena() });
    const origin = tankById(started, 'enemy-1');
    let state = started;
    const directions = new Set<string>([origin.dir]);
    let fired = false;

    for (let i = 0; i < 400; i++) {
      state = step(state);
      const enemy = tankById(state, 'enemy-1');
      directions.add(enemy.dir);
      if (state.bullets.some((bullet) => bullet.ownerId === 'enemy-1')) fired = true;
    }

    const enemy = tankById(state, 'enemy-1');
    expect(enemy.x !== origin.x || enemy.y !== origin.y).toBe(true);
    expect(directions.size).toBeGreaterThan(1);
    expect(fired).toBe(true);
  });

  it('规则6：被挡住时会换方向，不会一直卡在原地', () => {
    const rows = Array.from({ length: 5 }, () => '.....');
    const started = createGame({
      seed: 5,
      level: makeLevel(rows, {
        player: { col: 4, row: 4, dir: 'up' },
        enemies: [{ col: 0, row: 0, dir: 'left' }],
      }),
    });
    const moved = playBlocked(started, 120);
    const enemy = tankById(moved, 'enemy-1');
    expect(enemy.dir).not.toBe('left');
    expect(enemy.x !== 0 || enemy.y !== 0).toBe(true);
  });

  it('规则6：同一个 seed 每一步 JSON 都相同，不同 seed 则不同', () => {
    const steps = 180;
    let left = createGame({ seed: 42, level: arena() });
    let right = createGame({ seed: 42, level: arena() });
    let other = createGame({ seed: 43, level: arena() });
    expect(snapshot(left)).toBe(snapshot(right));

    for (let i = 0; i < steps; i++) {
      left = step(left);
      right = step(right);
      other = step(other);
      expect(snapshot(left)).toBe(snapshot(right));
    }
    expect(snapshot(left)).not.toBe(snapshot(other));
  });

  it('规则6：step 不修改传入的 state', () => {
    const state = createGame({ seed: SEED, level: arena() });
    const before = snapshot(state);
    step(state, { move: 'left', fire: true });
    expect(snapshot(state)).toBe(before);
  });

  it('规则6：同一辆敌人连续两次开火的间隔不小于冷却下限', () => {
    const ticks = fireTicks(SEED);
    expect(ticks.length).toBeGreaterThanOrEqual(2);
    const first = ticks[0];
    const second = ticks[1];
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    if (first === undefined || second === undefined) return;
    // 源码在开火成功后把 fireCooldown 设进 [MIN, MAX]，之后每步减 1。
    // 两次开火的 tick 差就是这次抽到的冷却，至少是 MIN，并且必须大于 0。
    const gap = second - first;
    expect(gap).toBeGreaterThan(0);
    expect(gap).toBeGreaterThanOrEqual(ENEMY_FIRE_COOLDOWN_MIN);
  });
});

function playBlocked(state: GameState, steps: number): GameState {
  let current = state;
  for (let i = 0; i < steps; i++) current = step(current);
  return current;
}
