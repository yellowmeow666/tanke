import {
  BULLET_SIZE,
  BULLET_SPEED,
  ENEMY_FIRE_COOLDOWN_MAX,
  ENEMY_FIRE_COOLDOWN_MIN,
  ENEMY_FIRST_FIRE_MAX,
  ENEMY_FIRST_FIRE_MIN,
  ENEMY_SPEED,
  ENEMY_TURN_MAX,
  ENEMY_TURN_MIN,
  PLAYER_SPEED,
  TANK_SIZE,
  TILE_SIZE,
} from './constants';
import { DEFAULT_LEVEL } from './level';
import { nextRandom } from './rng';
import type {
  Bullet,
  CreateGameOptions,
  Direction,
  GameState,
  Input,
  LevelSpec,
  SpawnSpec,
  Tank,
  TileKind,
} from './types';

const DIRECTIONS: readonly Direction[] = ['up', 'down', 'left', 'right'];

const DELTA: Record<Direction, readonly [number, number]> = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
};

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

// ---------------------------------------------------------------------------
// 创建对局
// ---------------------------------------------------------------------------

export function createGame(options: CreateGameOptions): GameState {
  const { seed } = options;
  if (typeof seed !== 'number' || !Number.isFinite(seed)) {
    throw new Error('seed must be a finite number');
  }
  const level = options.level ?? DEFAULT_LEVEL;
  const tiles = parseRows(level);
  const rows = tiles.length;
  const cols = tiles[0]?.length ?? 0;

  const state: GameState = {
    tick: 0,
    status: 'playing',
    cols,
    rows,
    tiles,
    tanks: [],
    bullets: [],
    enemiesLeft: 0,
    seed: seed >>> 0,
    rngState: seed >>> 0,
    nextBulletId: 1,
  };

  checkSpawn(state, level.player, 'player');
  state.tanks.push(makeTank('player', 'player', level.player, null));

  level.enemies.forEach((spec, i) => {
    checkSpawn(state, spec, `enemies[${i}]`);
    const behavior = spec.behavior ?? 'random';
    const tank = makeTank(`enemy-${i + 1}`, 'enemy', spec, behavior);
    if (behavior === 'random') {
      tank.fireCooldown = randInt(state, ENEMY_FIRST_FIRE_MIN, ENEMY_FIRST_FIRE_MAX);
      tank.turnTimer = randInt(state, ENEMY_TURN_MIN, ENEMY_TURN_MAX);
    }
    state.tanks.push(tank);
  });

  for (let i = 0; i < state.tanks.length; i++) {
    for (let j = i + 1; j < state.tanks.length; j++) {
      const a = state.tanks[i];
      const b = state.tanks[j];
      if (a && b && overlaps(tankRect(a), tankRect(b))) {
        throw new Error(`tanks ${a.id} and ${b.id} spawn on the same tile`);
      }
    }
  }

  updateStatus(state);
  return state;
}

function parseRows(level: LevelSpec): TileKind[][] {
  if (level.rows.length === 0) throw new Error('level.rows must not be empty');
  const width = level.rows[0]?.length ?? 0;
  if (width === 0) throw new Error('level rows must not be empty strings');
  return level.rows.map((line, r) => {
    if (line.length !== width) throw new Error(`level row ${r} has length ${line.length}, expected ${width}`);
    return Array.from(line, (ch, c): TileKind => {
      if (ch === '.') return 'empty';
      if (ch === '#') return 'brick';
      throw new Error(`unknown tile '${ch}' at row ${r}, col ${c}`);
    });
  });
}

function checkSpawn(state: GameState, spec: SpawnSpec, name: string): void {
  const { col, row, dir } = spec;
  if (!Number.isInteger(col) || !Number.isInteger(row) || col < 0 || row < 0 || col >= state.cols || row >= state.rows) {
    throw new Error(`${name} spawn (${col}, ${row}) is outside the map`);
  }
  if (state.tiles[row]?.[col] !== 'empty') throw new Error(`${name} spawn (${col}, ${row}) is on a brick`);
  if (!DIRECTIONS.includes(dir)) throw new Error(`${name} has invalid dir '${String(dir)}'`);
}

function makeTank(id: string, side: Tank['side'], spec: SpawnSpec, behavior: Tank['behavior']): Tank {
  return {
    id,
    side,
    x: spec.col * TILE_SIZE,
    y: spec.row * TILE_SIZE,
    dir: spec.dir,
    alive: true,
    behavior,
    fireCooldown: 0,
    turnTimer: 0,
  };
}

// ---------------------------------------------------------------------------
// 推进一步（1/60 秒）。不修改传入的 state，返回新对象。
// ---------------------------------------------------------------------------

export function step(prev: GameState, input: Input = {}): GameState {
  const s = cloneState(prev);
  if (s.status !== 'playing') return s;
  s.tick += 1;

  const player = s.tanks.find((t) => t.side === 'player');
  if (player?.alive) {
    if (input.move) moveTank(s, player, input.move, PLAYER_SPEED);
    if (input.fire) tryFire(s, player);
  }

  for (const tank of s.tanks) {
    if (tank.side === 'enemy' && tank.alive) runEnemy(s, tank);
  }

  for (let i = 0; i < BULLET_SPEED; i++) advanceBullets(s);

  updateStatus(s);
  return s;
}

function updateStatus(s: GameState): void {
  s.enemiesLeft = s.tanks.filter((t) => t.side === 'enemy' && t.alive).length;
  const player = s.tanks.find((t) => t.side === 'player');
  if (!player?.alive) s.status = 'lost';
  else if (s.enemiesLeft === 0) s.status = 'won';
}

// ---------------------------------------------------------------------------
// 敌人行为
// ---------------------------------------------------------------------------

function runEnemy(s: GameState, tank: Tank): void {
  switch (tank.behavior) {
    case 'still':
      return;
    case 'shoot':
      tryFire(s, tank);
      return;
    case 'random':
    default: {
      tank.turnTimer -= 1;
      if (tank.turnTimer <= 0) turnRandomly(s, tank, false);
      const moved = moveTank(s, tank, tank.dir, ENEMY_SPEED);
      if (moved === 0) turnRandomly(s, tank, true);

      tank.fireCooldown -= 1;
      if (tank.fireCooldown <= 0 && tryFire(s, tank)) {
        tank.fireCooldown = randInt(s, ENEMY_FIRE_COOLDOWN_MIN, ENEMY_FIRE_COOLDOWN_MAX);
      }
    }
  }
}

function turnRandomly(s: GameState, tank: Tank, excludeCurrent: boolean): void {
  const options = excludeCurrent ? DIRECTIONS.filter((d) => d !== tank.dir) : DIRECTIONS;
  const dir = options[randInt(s, 0, options.length - 1)] ?? tank.dir;
  turnTank(s, tank, dir);
  tank.turnTimer = randInt(s, ENEMY_TURN_MIN, ENEMY_TURN_MAX);
}

// ---------------------------------------------------------------------------
// 坦克移动
// ---------------------------------------------------------------------------

function isVertical(dir: Direction): boolean {
  return dir === 'up' || dir === 'down';
}

/** 转向；转到垂直方向时，把另一轴对齐到最近的格子，方便钻进一格宽的通道。 */
function turnTank(s: GameState, tank: Tank, dir: Direction): void {
  if (tank.dir === dir) return;
  if (isVertical(tank.dir) !== isVertical(dir)) {
    if (isVertical(dir)) {
      const x = Math.round(tank.x / TILE_SIZE) * TILE_SIZE;
      if (canPlaceTank(s, tank, x, tank.y)) tank.x = x;
    } else {
      const y = Math.round(tank.y / TILE_SIZE) * TILE_SIZE;
      if (canPlaceTank(s, tank, tank.x, y)) tank.y = y;
    }
  }
  tank.dir = dir;
}

/** 朝 dir 转向并移动最多 speed 像素，返回实际移动的像素数。 */
function moveTank(s: GameState, tank: Tank, dir: Direction, speed: number): number {
  turnTank(s, tank, dir);
  const [dx, dy] = DELTA[dir];
  let moved = 0;
  for (let i = 0; i < speed; i++) {
    const nx = tank.x + dx;
    const ny = tank.y + dy;
    if (!canPlaceTank(s, tank, nx, ny)) break;
    tank.x = nx;
    tank.y = ny;
    moved += 1;
  }
  return moved;
}

function canPlaceTank(s: GameState, tank: Tank, x: number, y: number): boolean {
  const rect: Rect = { x, y, w: TANK_SIZE, h: TANK_SIZE };
  if (!insideMap(s, rect)) return false;
  if (brickTilesUnder(s, rect).length > 0) return false;
  return !s.tanks.some((o) => o !== tank && o.alive && overlaps(rect, tankRect(o)));
}

// ---------------------------------------------------------------------------
// 子弹
// ---------------------------------------------------------------------------

/** 场上没有自己的子弹时开火，返回是否开火成功。 */
function tryFire(s: GameState, tank: Tank): boolean {
  if (s.bullets.some((b) => b.ownerId === tank.id)) return false;
  const cx = tank.x + TANK_SIZE / 2;
  const cy = tank.y + TANK_SIZE / 2;
  const half = BULLET_SIZE / 2;
  // 子弹中心放在炮口（坦克前沿中点）。
  let bx = cx - half;
  let by = cy - half;
  if (tank.dir === 'up') by = tank.y - half;
  else if (tank.dir === 'down') by = tank.y + TANK_SIZE - half;
  else if (tank.dir === 'left') bx = tank.x - half;
  else bx = tank.x + TANK_SIZE - half;

  const bullet: Bullet = { id: s.nextBulletId, ownerId: tank.id, side: tank.side, x: bx, y: by, dir: tank.dir };
  s.nextBulletId += 1;
  s.bullets.push(bullet);
  return true;
}

/** 所有子弹前进 1 像素并结算碰撞。每步调用 BULLET_SPEED 次，避免高速穿透。 */
function advanceBullets(s: GameState): void {
  for (const b of s.bullets) {
    const [dx, dy] = DELTA[b.dir];
    b.x += dx;
    b.y += dy;
  }

  const removed = new Set<number>();

  // 子弹互相碰撞：两发都消失。
  for (let i = 0; i < s.bullets.length; i++) {
    for (let j = i + 1; j < s.bullets.length; j++) {
      const a = s.bullets[i];
      const b = s.bullets[j];
      if (a && b && overlaps(bulletRect(a), bulletRect(b))) {
        removed.add(a.id);
        removed.add(b.id);
      }
    }
  }

  for (const b of s.bullets) {
    if (removed.has(b.id)) continue;
    const rect = bulletRect(b);

    if (!insideMap(s, rect)) {
      removed.add(b.id);
      continue;
    }

    const bricks = brickTilesUnder(s, rect);
    if (bricks.length > 0) {
      // 只打掉一格：优先子弹中心所在的那格。
      const cc = Math.floor((b.x + BULLET_SIZE / 2) / TILE_SIZE);
      const cr = Math.floor((b.y + BULLET_SIZE / 2) / TILE_SIZE);
      const target = bricks.find(([c, r]) => c === cc && r === cr) ?? bricks[0];
      if (target) setTile(s, target[0], target[1], 'empty');
      removed.add(b.id);
      continue;
    }

    const hit = s.tanks.find((t) => t.alive && t.id !== b.ownerId && overlaps(rect, tankRect(t)));
    if (hit) {
      removed.add(b.id);
      // 敌方子弹打到敌方坦克：子弹消失，不造成伤害。
      if (!(b.side === 'enemy' && hit.side === 'enemy')) hit.alive = false;
    }
  }

  if (removed.size > 0) s.bullets = s.bullets.filter((b) => !removed.has(b.id));
}

// ---------------------------------------------------------------------------
// 工具函数
// ---------------------------------------------------------------------------

function tankRect(t: Tank): Rect {
  return { x: t.x, y: t.y, w: TANK_SIZE, h: TANK_SIZE };
}

function bulletRect(b: Bullet): Rect {
  return { x: b.x, y: b.y, w: BULLET_SIZE, h: BULLET_SIZE };
}

function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function insideMap(s: GameState, r: Rect): boolean {
  return r.x >= 0 && r.y >= 0 && r.x + r.w <= s.cols * TILE_SIZE && r.y + r.h <= s.rows * TILE_SIZE;
}

/** 返回与矩形重叠的砖墙格 [col, row]。矩形须在地图内。 */
function brickTilesUnder(s: GameState, r: Rect): [number, number][] {
  const out: [number, number][] = [];
  const c0 = Math.floor(r.x / TILE_SIZE);
  const c1 = Math.floor((r.x + r.w - 1) / TILE_SIZE);
  const r0 = Math.floor(r.y / TILE_SIZE);
  const r1 = Math.floor((r.y + r.h - 1) / TILE_SIZE);
  for (let row = r0; row <= r1; row++) {
    for (let col = c0; col <= c1; col++) {
      if (s.tiles[row]?.[col] === 'brick') out.push([col, row]);
    }
  }
  return out;
}

function setTile(s: GameState, col: number, row: number, kind: TileKind): void {
  const line = s.tiles[row];
  if (line && col >= 0 && col < line.length) line[col] = kind;
}

function rand(s: GameState): number {
  const [value, next] = nextRandom(s.rngState);
  s.rngState = next;
  return value;
}

/** [min, max] 闭区间随机整数。 */
function randInt(s: GameState, min: number, max: number): number {
  return min + Math.floor(rand(s) * (max - min + 1));
}

function cloneState(s: GameState): GameState {
  return {
    ...s,
    tiles: s.tiles.map((line) => [...line]),
    tanks: s.tanks.map((t) => ({ ...t })),
    bullets: s.bullets.map((b) => ({ ...b })),
  };
}
