import {
  step,
  TANK_SIZE,
  TILE_SIZE,
  type GameState,
  type Input,
  type LevelSpec,
  type Tank,
} from '../../src/game/index';

/**
 * 验收测试用的小地图。
 * 默认在右上角放一辆 `still` 敌人，避免「没有敌人开局即胜利」干扰移动和射击。
 * `override` 会整段替换同名字段（例如换成 `shoot` 敌人或清空敌人数组）。
 */
export function makeLevel(rows: readonly string[], override: Partial<LevelSpec> = {}): LevelSpec {
  const width = rows[0]?.length ?? 1;
  const height = rows.length;
  const base: LevelSpec = {
    rows,
    player: { col: 0, row: Math.max(0, height - 1), dir: 'up' },
    enemies: [{ col: Math.max(0, width - 1), row: 0, dir: 'down', behavior: 'still' }],
  };
  return { ...base, ...override };
}

/** 重复调用 `step` 固定步数。输入可以是常量，也可以按「即将执行的第几步」现算。不读真实时间。 */
export function runSteps(
  state: GameState,
  steps: number,
  input: Input | ((stepIndex: number, state: GameState) => Input) = {},
): GameState {
  let current = state;
  for (let i = 0; i < steps; i++) {
    const resolved = typeof input === 'function' ? input(i, current) : input;
    current = step(current, resolved);
  }
  return current;
}

/** 推进到谓词成立或步数用尽。返回停下时的状态（谓词看的是「这一步之前」的状态）。 */
export function runUntil(
  state: GameState,
  predicate: (state: GameState) => boolean,
  maxSteps: number,
  input: Input | ((stepIndex: number, state: GameState) => Input) = {},
): GameState {
  let current = state;
  for (let i = 0; i < maxSteps && !predicate(current); i++) {
    const resolved = typeof input === 'function' ? input(i, current) : input;
    current = step(current, resolved);
  }
  return current;
}

/** 按 id 找坦克。找不到说明场景没摆对，直接失败。 */
export function tankById(state: GameState, id: string): Tank {
  const found = state.tanks.find((tank) => tank.id === id);
  if (!found) throw new Error(`找不到坦克 ${id}`);
  return found;
}

/** 还活着的敌方坦克，顺序与 `tanks` 数组一致。 */
export function aliveEnemies(state: GameState): Tank[] {
  return state.tanks.filter((tank) => tank.side === 'enemy' && tank.alive);
}

/** 轴对齐矩形是否相交。边缘相贴不算重叠，和引擎里的判定一致。 */
export function rectsOverlap(
  ax: number,
  ay: number,
  aw: number,
  ah: number,
  bx: number,
  by: number,
  bw: number,
  bh: number,
): boolean {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

/** 存活坦克的身体是否压到某一格砖。 */
export function overlapsBrick(state: GameState, tank: Tank): boolean {
  for (let row = 0; row < state.rows; row++) {
    const line = state.tiles[row];
    if (!line) continue;
    for (let col = 0; col < state.cols; col++) {
      if (line[col] !== 'brick') continue;
      const hit = rectsOverlap(
        tank.x,
        tank.y,
        TANK_SIZE,
        TANK_SIZE,
        col * TILE_SIZE,
        row * TILE_SIZE,
        TILE_SIZE,
        TILE_SIZE,
      );
      if (hit) return true;
    }
  }
  return false;
}

/** 坦克是否完整留在地图像素范围内。 */
export function insideMap(state: GameState, tank: Tank): boolean {
  const width = state.cols * TILE_SIZE;
  const height = state.rows * TILE_SIZE;
  return tank.x >= 0 && tank.y >= 0 && tank.x + TANK_SIZE <= width && tank.y + TANK_SIZE <= height;
}

/** 整棵状态树可以稳定序列化，用来比较「同一步是否完全一致」。 */
export function snapshot(state: GameState): string {
  return JSON.stringify(state);
}
