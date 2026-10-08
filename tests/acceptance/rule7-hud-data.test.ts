import { describe, expect, it } from 'vitest';
import { createGame, step, type GameStatus } from '../../src/game/index';
import { aliveEnemies, makeLevel, tankById } from './helpers';

const SEED = 1;
const STATUSES: readonly GameStatus[] = ['playing', 'won', 'lost'];

describe('规则7 界面用的逻辑数据', () => {
  it('规则7：enemiesLeft 等于存活敌人数，击毁一辆就减一', () => {
    const rows = Array.from({ length: 5 }, () => '.....');
    let state = createGame({
      seed: SEED,
      level: makeLevel(rows, {
        player: { col: 2, row: 4, dir: 'up' },
        enemies: [
          { col: 2, row: 0, dir: 'down', behavior: 'still' },
          { col: 0, row: 0, dir: 'left', behavior: 'still' },
        ],
      }),
    });
    expect(state.enemiesLeft).toBe(aliveEnemies(state).length);
    expect(state.enemiesLeft).toBe(2);

    state = step(state, { fire: true });
    while (state.bullets.length > 0 && state.tick < 80) {
      expect(state.enemiesLeft).toBe(aliveEnemies(state).length);
      expect(STATUSES).toContain(state.status);
      state = step(state);
    }
    expect(tankById(state, 'enemy-1').alive).toBe(false);
    expect(tankById(state, 'enemy-2').alive).toBe(true);
    expect(state.enemiesLeft).toBe(1);
    expect(state.enemiesLeft).toBe(aliveEnemies(state).length);

    // 默认地图开局也对得上，不依赖上面的小地图。
    const standard = createGame({ seed: SEED });
    expect(standard.enemiesLeft).toBe(4);
    expect(standard.enemiesLeft).toBe(aliveEnemies(standard).length);
  });

  it('规则7：status 在整局里只会是 playing、won 或 lost', () => {
    let state = createGame({ seed: SEED });
    const seen = new Set<GameStatus>();
    for (let i = 0; i < 300; i++) {
      expect(STATUSES).toContain(state.status);
      seen.add(state.status);
      state = step(state);
    }
    expect(seen.has('playing')).toBe(true);

    const rows = Array.from({ length: 4 }, () => '....');
    const won = createGame({ seed: SEED, level: makeLevel(rows, { enemies: [] }) });
    expect(won.status).toBe('won');
    expect(STATUSES).toContain(won.status);

    let lost = createGame({
      seed: SEED,
      level: makeLevel(rows, {
        player: { col: 1, row: 3, dir: 'up' },
        enemies: [{ col: 1, row: 0, dir: 'down', behavior: 'shoot' }],
      }),
    });
    for (let i = 0; i < 80 && lost.status === 'playing'; i++) lost = step(lost);
    expect(lost.status).toBe('lost');
    expect(STATUSES).toContain(lost.status);
  });
});
