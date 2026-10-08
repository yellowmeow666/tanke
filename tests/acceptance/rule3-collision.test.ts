import { describe, expect, it } from 'vitest';
import { createGame, step, TANK_SIZE, TILE_SIZE } from '../../src/game/index';
import { aliveEnemies, insideMap, makeLevel, overlapsBrick, rectsOverlap, runSteps, tankById } from './helpers';

const SEED = 1;

describe('规则3 坦克不能穿墙、穿车、出界', () => {
  it('规则3：长时间往砖墙上开，会停在墙前面', () => {
    const rows = ['.......', '.......', '..#....', '.......', '.......', '.......'];
    const started = createGame({
      seed: SEED,
      level: makeLevel(rows, {
        player: { col: 2, row: 5, dir: 'up' },
        enemies: [{ col: 6, row: 0, dir: 'down', behavior: 'still' }],
      }),
    });

    const stopped = runSteps(started, 80, { move: 'up' });
    const player = tankById(stopped, 'player');
    // 砖在第 2 行，坦克只能停在第 3 行的格子线上。
    expect(player.y).toBe(3 * TILE_SIZE);
    expect(player.x).toBe(2 * TILE_SIZE);
    expect(player.alive).toBe(true);
  });

  it('规则3：长时间往另一辆坦克上开，会停在它前面', () => {
    const rows = Array.from({ length: 6 }, () => '.......');
    const started = createGame({
      seed: SEED,
      level: makeLevel(rows, {
        player: { col: 2, row: 5, dir: 'up' },
        enemies: [{ col: 2, row: 1, dir: 'down', behavior: 'still' }],
      }),
    });

    const stopped = runSteps(started, 80, { move: 'up' });
    const player = tankById(stopped, 'player');
    // 敌人占着第 1 行，玩家顶到第 2 行就过不去。
    expect(player.y).toBe(2 * TILE_SIZE);
    expect(player.x).toBe(2 * TILE_SIZE);
    expect(tankById(stopped, 'enemy-1').alive).toBe(true);
  });

  it('规则3：长时间往地图外开，会停在边界内侧', () => {
    const rows = Array.from({ length: 5 }, () => '.....');
    const started = createGame({
      seed: SEED,
      level: makeLevel(rows, {
        player: { col: 0, row: 4, dir: 'up' },
        enemies: [{ col: 4, row: 0, dir: 'down', behavior: 'still' }],
      }),
    });

    const againstLeft = runSteps(started, 40, { move: 'left' });
    expect(tankById(againstLeft, 'player').x).toBe(0);
    expect(tankById(againstLeft, 'player').y).toBe(4 * TILE_SIZE);

    const againstBottom = runSteps(started, 40, { move: 'down' });
    expect(tankById(againstBottom, 'player').y).toBe(4 * TILE_SIZE);
    expect(tankById(againstBottom, 'player').x).toBe(0);

    // 再往外推一步，坐标仍然不变。
    const stillLeft = step(againstLeft, { move: 'left' });
    expect(tankById(stillLeft, 'player').x).toBe(0);
  });

  it('规则3：random 敌人用固定 seed 跑很多步，不出界、不压砖、互不重叠', () => {
    let state = createGame({ seed: 1 });
    for (let i = 0; i < 900; i++) {
      state = step(state);
      const alive = [tankById(state, 'player'), ...aliveEnemies(state)].filter((tank) => tank.alive);
      for (const tank of alive) {
        expect(insideMap(state, tank), `${tank.id} 在第 ${state.tick} 步出界`).toBe(true);
        expect(overlapsBrick(state, tank), `${tank.id} 在第 ${state.tick} 步压到砖`).toBe(false);
      }
      for (let a = 0; a < alive.length; a++) {
        for (let b = a + 1; b < alive.length; b++) {
          const left = alive[a];
          const right = alive[b];
          if (!left || !right) continue;
          const hit = rectsOverlap(left.x, left.y, TANK_SIZE, TANK_SIZE, right.x, right.y, TANK_SIZE, TANK_SIZE);
          expect(hit, `${left.id} 与 ${right.id} 在第 ${state.tick} 步重叠`).toBe(false);
        }
      }
    }
  });
});
