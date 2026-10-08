import type { LevelSpec } from './types';

/** 默认地图：13×13，玩家在底部中间，顶部 4 辆敌人。 */
export const DEFAULT_LEVEL: LevelSpec = {
  rows: [
    '.............',
    '.............',
    '.#.#.#.#.#.#.',
    '.#.#.#.#.#.#.',
    '.#.#.....#.#.',
    '......#......',
    '##.##...##.##',
    '......#......',
    '.#.#.#.#.#.#.',
    '.#.#.....#.#.',
    '.#.#.###.#.#.',
    '.............',
    '.............',
  ],
  player: { col: 6, row: 12, dir: 'up' },
  enemies: [
    { col: 0, row: 0, dir: 'down' },
    { col: 4, row: 0, dir: 'down' },
    { col: 8, row: 0, dir: 'down' },
    { col: 12, row: 0, dir: 'down' },
  ],
};
