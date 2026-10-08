/** 四个移动 / 朝向方向，不支持斜向。 */
export type Direction = 'up' | 'down' | 'left' | 'right';

/** 阵营。 */
export type Side = 'player' | 'enemy';

/** 对局状态，与页面上 data-testid="game-status" 的取值一致。 */
export type GameStatus = 'playing' | 'won' | 'lost';

/** 地图格子类型。 */
export type TileKind = 'empty' | 'brick';

/**
 * 敌人行为：
 * - `random`：默认，自己移动和射击，全部由 seed 决定；
 * - `still`：原地不动、不开火（测试用）；
 * - `shoot`：原地不动，场上没有自己的子弹时立即朝当前朝向开火（测试用）。
 */
export type EnemyBehavior = 'random' | 'still' | 'shoot';

/** 出生点，用格子坐标表示。 */
export interface SpawnSpec {
  col: number;
  row: number;
  dir: Direction;
}

export interface EnemySpawnSpec extends SpawnSpec {
  /** 不填为 `random`。 */
  behavior?: EnemyBehavior;
}

/**
 * 关卡定义。`rows` 每行一个字符串，所有行等长：
 * `.` 空地，`#` 砖墙。地图宽高由 `rows` 推出，地图外即边界。
 */
export interface LevelSpec {
  rows: readonly string[];
  player: SpawnSpec;
  enemies: readonly EnemySpawnSpec[];
}

export interface Tank {
  /** 玩家固定为 `player`，敌人依次为 `enemy-1`、`enemy-2`…… */
  id: string;
  side: Side;
  /** 左上角像素坐标。坦克大小为 TANK_SIZE × TANK_SIZE。 */
  x: number;
  y: number;
  dir: Direction;
  alive: boolean;
  /** 玩家为 null。 */
  behavior: EnemyBehavior | null;
  /** 距离下次允许开火还剩多少步（仅 random 敌人使用）。 */
  fireCooldown: number;
  /** 距离下次主动换方向还剩多少步（仅 random 敌人使用）。 */
  turnTimer: number;
}

export interface Bullet {
  id: number;
  /** 发射者的坦克 id。 */
  ownerId: string;
  side: Side;
  /** 左上角像素坐标。子弹大小为 BULLET_SIZE × BULLET_SIZE。 */
  x: number;
  y: number;
  dir: Direction;
}

export interface GameState {
  /** 已推进的步数，每步 1/60 秒。 */
  tick: number;
  status: GameStatus;
  /** 地图列数、行数（格）。 */
  cols: number;
  rows: number;
  /** tiles[row][col] */
  tiles: TileKind[][];
  /** 所有坦克，第一个总是玩家；被击毁的坦克保留，alive 为 false。 */
  tanks: Tank[];
  /** 场上的子弹。 */
  bullets: Bullet[];
  /** 剩余存活的敌人数。 */
  enemiesLeft: number;
  /** 开局传入的 seed（已转成 32 位无符号整数）。 */
  seed: number;
  /** 随机数发生器的内部状态，渲染层不用关心。 */
  rngState: number;
  nextBulletId: number;
}

/** 单步输入。不传 move 表示不移动；fire 为 true 表示这一步尝试开火。 */
export interface Input {
  move?: Direction | null;
  fire?: boolean;
}

export interface CreateGameOptions {
  seed: number;
  /** 不传则用 DEFAULT_LEVEL。 */
  level?: LevelSpec;
}
