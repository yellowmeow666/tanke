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

const EMPTY_13: readonly string[] = Array.from({ length: 13 }, () => '.............');

/**
 * 只给测试（尤其是端到端冒烟测试）用的固定地图，按名字取。
 * - `e2e-win`：1 辆不动不开火的敌人正对玩家，玩家按一次空格就赢；
 * - `e2e-lose`：1 辆原地开火的敌人正对玩家，开局约 1.5 秒后玩家被击毁。
 */
export const TEST_LEVELS = {
  'e2e-win': {
    rows: EMPTY_13,
    player: { col: 6, row: 12, dir: 'up' },
    enemies: [{ col: 6, row: 0, dir: 'down', behavior: 'still' }],
  },
  'e2e-lose': {
    rows: EMPTY_13,
    player: { col: 6, row: 12, dir: 'up' },
    enemies: [{ col: 6, row: 0, dir: 'down', behavior: 'shoot' }],
  },
} as const satisfies Record<string, LevelSpec>;

export type TestLevelName = keyof typeof TEST_LEVELS;
