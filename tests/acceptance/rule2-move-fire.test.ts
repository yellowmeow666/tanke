import { describe, expect, it } from 'vitest';
import { createGame, PLAYER_SPEED, step, type Direction } from '../../src/game/index';
import { makeLevel, runUntil, tankById } from './helpers';

const SEED = 1;

function openLevel() {
  const rows = Array.from({ length: 7 }, () => '.......');
  return makeLevel(rows, {
    player: { col: 3, row: 3, dir: 'up' },
    enemies: [{ col: 6, row: 0, dir: 'down', behavior: 'still' }],
  });
}

describe('规则2 移动与射击', () => {
  it('规则2：四个方向每步只沿一个轴移动，距离是玩家速度', () => {
    const origin = createGame({ seed: SEED, level: openLevel() });
    const start = tankById(origin, 'player');
    const cases: { dir: Direction; x: number; y: number }[] = [
      { dir: 'up', x: start.x, y: start.y - PLAYER_SPEED },
      { dir: 'down', x: start.x, y: start.y + PLAYER_SPEED },
      { dir: 'left', x: start.x - PLAYER_SPEED, y: start.y },
      { dir: 'right', x: start.x + PLAYER_SPEED, y: start.y },
    ];

    for (const expected of cases) {
      const moved = step(origin, { move: expected.dir });
      const player = tankById(moved, 'player');
      expect(player.dir).toBe(expected.dir);
      expect(player.x).toBe(expected.x);
      expect(player.y).toBe(expected.y);
      // 斜向输入不存在：这一步另一轴必须原样不动。
      const dx = player.x - start.x;
      const dy = player.y - start.y;
      expect(dx === 0 || dy === 0).toBe(true);
      expect(Math.abs(dx + dy)).toBe(PLAYER_SPEED);
    }
  });

  it('规则2：按住同一个方向时，每一步仍然只改变该轴', () => {
    let state = createGame({ seed: SEED, level: openLevel() });
    let previous = tankById(state, 'player');

    for (let i = 0; i < 6; i++) {
      state = step(state, { move: 'right' });
      const player = tankById(state, 'player');
      expect(player.y).toBe(previous.y);
      expect(player.x - previous.x).toBe(PLAYER_SPEED);
      expect(player.dir).toBe('right');
      previous = player;
    }
  });

  it('规则2：连续开火时玩家最多一发子弹，子弹消失后才能再射', () => {
    const rows = Array.from({ length: 9 }, () => '.........');
    const started = createGame({
      seed: SEED,
      level: makeLevel(rows, {
        player: { col: 4, row: 8, dir: 'up' },
        enemies: [{ col: 0, row: 0, dir: 'down', behavior: 'still' }],
      }),
    });

    let state = step(started, { fire: true });
    const first = state.bullets.find((bullet) => bullet.ownerId === 'player');
    expect(first).toBeDefined();

    for (let i = 0; i < 8; i++) {
      state = step(state, { fire: true });
      const owned = state.bullets.filter((bullet) => bullet.ownerId === 'player');
      expect(owned).toHaveLength(1);
      expect(owned[0]?.id).toBe(first?.id);
    }

    const spent = runUntil(state, (current) => !current.bullets.some((bullet) => bullet.ownerId === 'player'), 80);
    expect(spent.bullets.some((bullet) => bullet.ownerId === 'player')).toBe(false);

    const again = step(spent, { fire: true });
    const second = again.bullets.filter((bullet) => bullet.ownerId === 'player');
    expect(second).toHaveLength(1);
    expect(second[0]?.id).not.toBe(first?.id);
  });

  it('规则2：shoot 敌人自己没有子弹时才开火，场上最多一发', () => {
    const rows = Array.from({ length: 8 }, () => '........');
    let state = createGame({
      seed: SEED,
      level: makeLevel(rows, {
        player: { col: 0, row: 7, dir: 'up' },
        enemies: [{ col: 3, row: 0, dir: 'down', behavior: 'shoot' }],
      }),
    });

    state = step(state);
    expect(state.bullets.filter((bullet) => bullet.ownerId === 'enemy-1')).toHaveLength(1);

    for (let i = 0; i < 19; i++) {
      state = step(state);
      const owned = state.bullets.filter((bullet) => bullet.ownerId === 'enemy-1');
      expect(owned.length).toBeLessThanOrEqual(1);
    }
  });
});
