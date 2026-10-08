import { describe, expect, it } from 'vitest';
import { createGame, DEFAULT_LEVEL, TILE_SIZE } from '../../src/game/index';
import { runSteps, tankById } from './helpers';

/** 验收固定用 seed 1，不依赖时钟。 */
const SEED = 1;

describe('规则1 地图与兵力', () => {
  it('规则1：默认地图是 13×13 格、每格 32 像素，并且有砖墙', () => {
    const state = createGame({ seed: SEED });

    expect(TILE_SIZE).toBe(32);
    expect(state.cols).toBe(13);
    expect(state.rows).toBe(13);
    expect(DEFAULT_LEVEL.rows).toHaveLength(13);
    expect(DEFAULT_LEVEL.rows.every((line) => line.length === 13)).toBe(true);
    // 格子数组和关卡字符串一致，不多出一圈「边界砖」。
    expect(state.tiles).toHaveLength(13);
    expect(state.tiles.every((line) => line.length === 13)).toBe(true);
    expect(state.tiles.some((line) => line.some((tile) => tile === 'brick'))).toBe(true);
    // 外圈本身不是墙：最上面一行、最下面一行都有空地，出了这 13 格才是边界。
    expect(state.tiles[0]?.some((tile) => tile === 'empty')).toBe(true);
    expect(state.tiles[12]?.some((tile) => tile === 'empty')).toBe(true);
  });

  it('规则1：玩家出生在底部中间，也就是第 12 行第 6 列', () => {
    const state = createGame({ seed: SEED });
    const player = tankById(state, 'player');
    const col = player.x / TILE_SIZE;
    const row = player.y / TILE_SIZE;

    // 13 列下标 0..12，正中间是 6；13 行下标 0..12，最底一行是 12。
    expect(col).toBe(6);
    expect(row).toBe(12);
    expect(col).toBe(Math.floor(state.cols / 2));
    expect(row).toBe(state.rows - 1);
    expect(player).toMatchObject({
      id: 'player',
      side: 'player',
      dir: 'up',
      alive: true,
      x: 6 * TILE_SIZE,
      y: 12 * TILE_SIZE,
    });
    expect(DEFAULT_LEVEL.player).toEqual({ col: 6, row: 12, dir: 'up' });
  });

  it('规则1：开局 4 辆敌人，固定 seed 跑很多步也不会增援', () => {
    const started = createGame({ seed: SEED });
    const ids = started.tanks.filter((tank) => tank.side === 'enemy').map((tank) => tank.id);

    expect(ids).toEqual(['enemy-1', 'enemy-2', 'enemy-3', 'enemy-4']);
    expect(started.enemiesLeft).toBe(4);
    expect(started.tanks[0]?.id).toBe('player');

    // 不操作，让默认 seed 自己跑。被击毁的坦克仍留在数组里，所以总数只许不增。
    let state = started;
    for (let i = 0; i < 800; i++) {
      state = runSteps(state, 1);
      const enemies = state.tanks.filter((tank) => tank.side === 'enemy');
      expect(enemies.map((tank) => tank.id)).toEqual(ids);
    }
  });
});
