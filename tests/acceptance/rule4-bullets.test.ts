import { describe, expect, it } from 'vitest';
import { createGame, step } from '../../src/game/index';
import { makeLevel, runSteps, runUntil, tankById } from './helpers';

const SEED = 1;

describe('规则4 子弹命中', () => {
  it('规则4：子弹打中砖墙时打掉那一格，子弹消失', () => {
    const rows = ['.....', '..#..', '.....', '.....', '.....'];
    const started = createGame({
      seed: SEED,
      level: makeLevel(rows, {
        player: { col: 2, row: 4, dir: 'up' },
        enemies: [{ col: 0, row: 0, dir: 'down', behavior: 'still' }],
      }),
    });
    const bricksBefore = started.tiles.flat().filter((tile) => tile === 'brick').length;

    const fired = step(started, { fire: true });
    expect(fired.bullets.some((bullet) => bullet.ownerId === 'player')).toBe(true);

    const landed = runUntil(fired, (state) => state.bullets.length === 0, 80);
    expect(landed.bullets).toHaveLength(0);
    expect(landed.tiles[1]?.[2]).toBe('empty');
    expect(landed.tiles.flat().filter((tile) => tile === 'brick')).toHaveLength(bricksBefore - 1);
  });

  it('规则4：一发子弹只打掉一格墙', () => {
    // 同一列两格砖叠在一起。子弹先碰到近的那格就消失，远的那格还在。
    const rows = ['.....', '..#..', '..#..', '.....', '.....'];
    const started = createGame({
      seed: SEED,
      level: makeLevel(rows, {
        player: { col: 2, row: 4, dir: 'up' },
        enemies: [{ col: 0, row: 0, dir: 'down', behavior: 'still' }],
      }),
    });

    const landed = runUntil(step(started, { fire: true }), (state) => state.bullets.length === 0, 80);
    expect(landed.tiles[2]?.[2]).toBe('empty');
    expect(landed.tiles[1]?.[2]).toBe('brick');
    expect(landed.tiles.flat().filter((tile) => tile === 'brick')).toHaveLength(1);
  });

  it('规则4：子弹打中敌方坦克时将其击毁，子弹消失', () => {
    const rows = Array.from({ length: 5 }, () => '.....');
    const started = createGame({
      seed: SEED,
      level: makeLevel(rows, {
        player: { col: 2, row: 4, dir: 'up' },
        enemies: [{ col: 2, row: 0, dir: 'down', behavior: 'still' }],
      }),
    });

    const landed = runUntil(step(started, { fire: true }), (state) => state.bullets.length === 0, 80);
    const enemy = tankById(landed, 'enemy-1');
    expect(enemy.alive).toBe(false);
    expect(landed.tanks.some((tank) => tank.id === 'enemy-1')).toBe(true);
    expect(landed.bullets).toHaveLength(0);
    expect(tankById(landed, 'player').alive).toBe(true);
  });

  it('规则4：子弹飞出地图边界后消失', () => {
    const rows = Array.from({ length: 5 }, () => '.....');
    const started = createGame({
      seed: SEED,
      level: makeLevel(rows, {
        player: { col: 0, row: 2, dir: 'left' },
        enemies: [{ col: 4, row: 0, dir: 'down', behavior: 'still' }],
      }),
    });
    const bricksBefore = started.tiles.flat().join('');

    const fired = step(started, { fire: true });
    const gone = runUntil(fired, (state) => state.bullets.length === 0, 30);
    expect(gone.bullets).toHaveLength(0);
    expect(gone.tiles.flat().join('')).toBe(bricksBefore);
    expect(tankById(gone, 'player').alive).toBe(true);
    expect(tankById(gone, 'enemy-1').alive).toBe(true);
  });

  it('规则4：两发子弹相撞时两发都消失', () => {
    const rows = Array.from({ length: 5 }, () => '.....');
    const started = createGame({
      seed: SEED,
      level: makeLevel(rows, {
        player: { col: 2, row: 4, dir: 'up' },
        enemies: [{ col: 2, row: 0, dir: 'down', behavior: 'shoot' }],
      }),
    });

    const fired = step(started, { fire: true });
    expect(fired.bullets).toHaveLength(2);
    const ids = fired.bullets.map((bullet) => bullet.id);

    const cleared = runUntil(fired, (state) => !state.bullets.some((bullet) => ids.includes(bullet.id)), 80);
    expect(cleared.bullets.some((bullet) => ids.includes(bullet.id))).toBe(false);
    expect(tankById(cleared, 'player').alive).toBe(true);
    expect(tankById(cleared, 'enemy-1').alive).toBe(true);
    expect(cleared.status).toBe('playing');
  });

  it('规则4：敌方子弹打到敌方坦克时子弹消失，坦克不受伤', () => {
    const rows = Array.from({ length: 5 }, () => '.....');
    const started = createGame({
      seed: SEED,
      level: makeLevel(rows, {
        player: { col: 4, row: 4, dir: 'up' },
        enemies: [
          { col: 0, row: 0, dir: 'right', behavior: 'shoot' },
          { col: 3, row: 0, dir: 'left', behavior: 'still' },
        ],
      }),
    });

    const fired = step(started);
    expect(fired.bullets).toHaveLength(1);
    const bulletId = fired.bullets[0]?.id;

    const landed = runUntil(
      fired,
      (state) => state.bullets.length === 0 || state.bullets[0]?.id !== bulletId,
      80,
    );
    expect(tankById(landed, 'enemy-2').alive).toBe(true);
    expect(tankById(landed, 'enemy-1').alive).toBe(true);
    expect(landed.enemiesLeft).toBe(2);
    expect(landed.bullets.some((bullet) => bullet.id === bulletId)).toBe(false);
    expect(landed.status).toBe('playing');
  });

  it('规则4：玩家的子弹不会打中自己，刚开火和追着子弹走都不会', () => {
    const rows = Array.from({ length: 8 }, () => '........');
    const started = createGame({
      seed: SEED,
      level: makeLevel(rows, {
        player: { col: 3, row: 6, dir: 'up' },
        enemies: [{ col: 7, row: 0, dir: 'down', behavior: 'still' }],
      }),
    });

    // 炮口子弹在头几个像素会和自己的车体重叠；这一步如果误伤，玩家会直接死。
    const first = step(started, { fire: true, move: 'up' });
    expect(tankById(first, 'player').alive).toBe(true);
    expect(first.bullets.some((bullet) => bullet.ownerId === 'player')).toBe(true);

    const chasing = runSteps(first, 20, { move: 'up' });
    expect(tankById(chasing, 'player').alive).toBe(true);
    expect(chasing.status).toBe('playing');
  });

  it('规则4：敌人的子弹不会打中自己，刚开火和向前开都不会', () => {
    const rows = Array.from({ length: 6 }, () => '......');
    const shootLevel = makeLevel(rows, {
      player: { col: 5, row: 5, dir: 'up' },
      enemies: [{ col: 2, row: 2, dir: 'down', behavior: 'shoot' }],
    });
    const first = step(createGame({ seed: SEED, level: shootLevel }));
    expect(first.bullets.some((bullet) => bullet.ownerId === 'enemy-1')).toBe(true);
    expect(tankById(first, 'enemy-1').alive).toBe(true);

    // random 敌人会朝当前方向开过去，子弹比车快，但车一直跟在自己的弹道上。
    const rowsWide = Array.from({ length: 8 }, () => '........');
    let state = createGame({
      seed: SEED,
      level: makeLevel(rowsWide, {
        player: { col: 7, row: 7, dir: 'up' },
        enemies: [{ col: 1, row: 3, dir: 'right', behavior: 'random' }],
      }),
    });
    const start = tankById(state, 'enemy-1');
    let fired = false;
    for (let i = 0; i < 400; i++) {
      state = step(state);
      if (state.bullets.some((bullet) => bullet.ownerId === 'enemy-1')) fired = true;
    }
    const enemy = tankById(state, 'enemy-1');
    expect(fired).toBe(true);
    expect(enemy.x !== start.x || enemy.y !== start.y).toBe(true);
    expect(enemy.alive).toBe(true);
  });
});
