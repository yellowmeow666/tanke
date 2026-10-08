import { describe, expect, it } from 'vitest';
import {
  BULLET_SPEED,
  DEFAULT_LEVEL,
  PLAYER_SPEED,
  TEST_LEVELS,
  TANK_SIZE,
  TILE_SIZE,
  createGame,
  step,
  type GameState,
  type Input,
  type LevelSpec,
} from './index';

function run(state: GameState, steps: number, input: Input = {}): GameState {
  let s = state;
  for (let i = 0; i < steps; i++) s = step(s, input);
  return s;
}

function runUntil(state: GameState, pred: (s: GameState) => boolean, max = 2000, input: Input = {}): GameState {
  let s = state;
  for (let i = 0; i < max && !pred(s); i++) s = step(s, input);
  return s;
}

function tank(s: GameState, id: string) {
  const t = s.tanks.find((x) => x.id === id);
  if (!t) throw new Error(`no tank ${id}`);
  return t;
}

/** 测试用小地图。默认在右上角放一辆不动的敌人，避免开局即胜利。 */
function level(rows: string[], partial: Partial<LevelSpec>): LevelSpec {
  const cols = rows[0]?.length ?? 1;
  return {
    rows,
    player: { col: 0, row: rows.length - 1, dir: 'up' },
    enemies: [{ col: cols - 1, row: 0, dir: 'down', behavior: 'still' }],
    ...partial,
  };
}

const EMPTY5 = ['.....', '.....', '.....', '.....', '.....'];

describe('createGame', () => {
  it('默认地图 13×13，玩家在底部中间，4 辆敌人', () => {
    const s = createGame({ seed: 1 });
    expect(s.cols).toBe(13);
    expect(s.rows).toBe(13);
    expect(s.status).toBe('playing');
    expect(s.enemiesLeft).toBe(4);
    const p = tank(s, 'player');
    expect(p).toMatchObject({ x: 6 * TILE_SIZE, y: 12 * TILE_SIZE, side: 'player', alive: true });
    expect(s.tanks.filter((t) => t.side === 'enemy')).toHaveLength(4);
    expect(s.tiles.flat().filter((t) => t === 'brick').length).toBeGreaterThan(0);
    expect(DEFAULT_LEVEL.rows).toHaveLength(13);
  });

  it('关卡非法时报错', () => {
    expect(() => createGame({ seed: 1, level: level(['..', '.'], { enemies: [] }) })).toThrow();
    expect(() => createGame({ seed: 1, level: level(['.x'], { enemies: [] }) })).toThrow();
    expect(() => createGame({ seed: 1, level: level(['#.'], { player: { col: 0, row: 0, dir: 'up' }, enemies: [] }) })).toThrow();
    expect(() => createGame({ seed: 1, level: level(['..'], { player: { col: 5, row: 0, dir: 'up' }, enemies: [] }) })).toThrow();
    expect(() =>
      createGame({ seed: 1, level: level(['..'], { enemies: [{ col: 0, row: 0, dir: 'up' }] }) }),
    ).toThrow();
    expect(() => createGame({ seed: Number.NaN })).toThrow();
  });
});

describe('step 的纯函数性与可复现', () => {
  it('不修改传入的 state', () => {
    const s0 = createGame({ seed: 7 });
    const snapshot = JSON.stringify(s0);
    step(s0, { move: 'up', fire: true });
    expect(JSON.stringify(s0)).toBe(snapshot);
  });

  it('同一个 seed 和输入序列结果完全一致，不同 seed 不同', () => {
    const inputs: Input[] = Array.from({ length: 600 }, (_, i) => ({
      move: (['up', 'left', 'right', 'down'] as const)[Math.floor(i / 50) % 4],
      fire: i % 20 === 0,
    }));
    const play = (seed: number) => inputs.reduce((s, inp) => step(s, inp), createGame({ seed }));
    expect(JSON.stringify(play(42))).toBe(JSON.stringify(play(42)));
    expect(JSON.stringify(play(42))).not.toBe(JSON.stringify(play(43)));
  });

  it('每步 tick +1', () => {
    expect(run(createGame({ seed: 1 }), 3).tick).toBe(3);
  });
});

describe('移动与阻挡', () => {
  it('按方向移动 PLAYER_SPEED 像素并转向', () => {
    const s = createGame({ seed: 1, level: level(EMPTY5, { player: { col: 2, row: 2, dir: 'up' } }) });
    const s1 = step(s, { move: 'left' });
    expect(tank(s1, 'player')).toMatchObject({ x: 2 * TILE_SIZE - PLAYER_SPEED, y: 2 * TILE_SIZE, dir: 'left' });
  });

  it('不能穿过地图边界', () => {
    const s = createGame({ seed: 1, level: level(EMPTY5, { player: { col: 0, row: 4, dir: 'up' } }) });
    const s1 = run(s, 50, { move: 'left' });
    expect(tank(s1, 'player').x).toBe(0);
    const s2 = run(s, 50, { move: 'down' });
    expect(tank(s2, 'player').y).toBe(4 * TILE_SIZE);
  });

  it('不能穿过砖墙', () => {
    const rows = ['.....', '.....', '..#..', '.....', '.....'];
    const s = createGame({ seed: 1, level: level(rows, { player: { col: 2, row: 4, dir: 'up' } }) });
    const s1 = run(s, 100, { move: 'up' });
    expect(tank(s1, 'player').y).toBe(3 * TILE_SIZE);
  });

  it('不能穿过其他坦克', () => {
    const s = createGame({
      seed: 1,
      level: level(EMPTY5, {
        player: { col: 2, row: 4, dir: 'up' },
        enemies: [{ col: 2, row: 1, dir: 'down', behavior: 'still' }],
      }),
    });
    const s1 = run(s, 100, { move: 'up' });
    expect(tank(s1, 'player').y).toBe(2 * TILE_SIZE);
  });

  it('转向垂直方向时对齐到最近格子，可钻进一格宽的通道', () => {
    const rows = ['#.###', '.....', '.....'];
    const s = createGame({
      seed: 1,
      level: level(rows, {
        player: { col: 3, row: 1, dir: 'left' },
        enemies: [{ col: 4, row: 2, dir: 'down', behavior: 'still' }],
      }),
    });
    // 向左走 1.5 格左右，停在两格之间
    const s1 = run(s, 25, { move: 'left' });
    expect(tank(s1, 'player').x % TILE_SIZE).not.toBe(0);
    const s2 = run(s1, 40, { move: 'up' });
    expect(tank(s2, 'player')).toMatchObject({ x: 1 * TILE_SIZE, y: 0 });
  });
});

describe('射击', () => {
  it('每辆坦克场上最多一发子弹', () => {
    const s = createGame({ seed: 1, level: level(EMPTY5, { player: { col: 2, row: 4, dir: 'up' } }) });
    const s1 = run(s, 5, { fire: true });
    expect(s1.bullets.filter((b) => b.ownerId === 'player')).toHaveLength(1);
  });

  it('子弹飞出边界就消失，之后可再开火', () => {
    const s = createGame({ seed: 1, level: level(EMPTY5, { player: { col: 2, row: 4, dir: 'up' } }) });
    const s1 = step(s, { fire: true });
    const firstId = s1.bullets[0]?.id;
    const s2 = run(s1, 40);
    expect(s2.bullets).toHaveLength(0);
    const s3 = step(s2, { fire: true });
    expect(s3.bullets).toHaveLength(1);
    expect(s3.bullets[0]?.id).not.toBe(firstId);
  });

  it('子弹每步前进 BULLET_SPEED 像素', () => {
    const s = createGame({ seed: 1, level: level(EMPTY5, { player: { col: 2, row: 4, dir: 'up' } }) });
    const s1 = step(s, { fire: true });
    const s2 = step(s1);
    expect((s1.bullets[0]?.y ?? 0) - (s2.bullets[0]?.y ?? 0)).toBe(BULLET_SPEED);
  });

  it('子弹打中砖墙：打掉一格，子弹消失', () => {
    const rows = ['.....', '..#..', '..#..', '.....', '.....'];
    const s = createGame({ seed: 1, level: level(rows, { player: { col: 2, row: 4, dir: 'up' } }) });
    const s1 = runUntil(step(s, { fire: true }), (x) => x.bullets.length === 0);
    expect(s1.tiles[2]?.[2]).toBe('empty');
    expect(s1.tiles[1]?.[2]).toBe('brick');
    expect(s1.tiles.flat().filter((t) => t === 'brick')).toHaveLength(1);
  });

  it('玩家子弹击毁敌人，剩余敌人数减少；全部击毁即胜利', () => {
    const s = createGame({
      seed: 1,
      level: level(EMPTY5, {
        player: { col: 2, row: 4, dir: 'up' },
        enemies: [
          { col: 2, row: 0, dir: 'down', behavior: 'still' },
          { col: 0, row: 0, dir: 'down', behavior: 'still' },
        ],
      }),
    });
    const s1 = runUntil(step(s, { fire: true }), (x) => x.bullets.length === 0);
    expect(tank(s1, 'enemy-1').alive).toBe(false);
    expect(s1.enemiesLeft).toBe(1);
    expect(s1.status).toBe('playing');

    // 走到左列，朝上开火
    let s2 = runUntil(s1, (x) => tank(x, 'player').x === 0, 200, { move: 'left' });
    s2 = step(s2, { move: 'up' });
    s2 = runUntil(step(s2, { fire: true }), (x) => x.status !== 'playing');
    expect(s2.enemiesLeft).toBe(0);
    expect(s2.status).toBe('won');
  });

  it('敌人子弹打中玩家即失败；被击毁的坦克不再阻挡', () => {
    const s = createGame({
      seed: 1,
      level: level(EMPTY5, {
        player: { col: 2, row: 4, dir: 'up' },
        enemies: [{ col: 2, row: 0, dir: 'down', behavior: 'shoot' }],
      }),
    });
    const s1 = runUntil(s, (x) => x.status !== 'playing');
    expect(s1.status).toBe('lost');
    expect(tank(s1, 'player').alive).toBe(false);
    expect(s1.enemiesLeft).toBe(1);
  });

  it('敌方子弹打到敌方坦克：子弹消失，不造成伤害', () => {
    const s = createGame({
      seed: 1,
      level: level(EMPTY5, {
        player: { col: 4, row: 4, dir: 'up' },
        enemies: [
          { col: 0, row: 0, dir: 'right', behavior: 'shoot' },
          { col: 3, row: 0, dir: 'left', behavior: 'still' },
        ],
      }),
    });
    const s1 = step(s);
    expect(s1.bullets).toHaveLength(1);
    const s2 = runUntil(s1, (x) => x.bullets.length === 0 || x.bullets[0]?.id !== s1.bullets[0]?.id, 200);
    expect(tank(s2, 'enemy-2').alive).toBe(true);
    expect(s2.enemiesLeft).toBe(2);
    expect(s2.status).toBe('playing');
  });

  it('两发子弹迎面相撞，两发都消失', () => {
    const s = createGame({
      seed: 1,
      level: level(EMPTY5, {
        player: { col: 2, row: 4, dir: 'up' },
        enemies: [{ col: 2, row: 0, dir: 'down', behavior: 'shoot' }],
      }),
    });
    const s1 = step(s, { fire: true });
    expect(s1.bullets).toHaveLength(2);
    const ids = s1.bullets.map((b) => b.id);
    const s2 = runUntil(s1, (x) => !x.bullets.some((b) => ids.includes(b.id)), 200);
    expect(tank(s2, 'player').alive).toBe(true);
    expect(tank(s2, 'enemy-1').alive).toBe(true);
    expect(s2.status).toBe('playing');
  });

  it('子弹不会击中发射者自己', () => {
    const s = createGame({ seed: 1, level: level(EMPTY5, { player: { col: 2, row: 2, dir: 'up' } }) });
    const s1 = run(step(s, { fire: true }), 30);
    expect(tank(s1, 'player').alive).toBe(true);
  });
});

describe('敌人行为', () => {
  it('random 敌人会移动也会开火，并由 seed 决定', () => {
    const s0 = createGame({ seed: 123 });
    let fired = false;
    let s = s0;
    for (let i = 0; i < 600; i++) {
      s = step(s);
      if (s.bullets.some((b) => b.side === 'enemy')) fired = true;
    }
    const moved = s.tanks.some((t) => t.side === 'enemy' && (t.x !== tank(s0, t.id).x || t.y !== tank(s0, t.id).y));
    expect(moved).toBe(true);
    expect(fired).toBe(true);
  });

  it('still 敌人不动不开火', () => {
    const s = createGame({
      seed: 1,
      level: level(EMPTY5, { player: { col: 4, row: 4, dir: 'up' }, enemies: [{ col: 0, row: 0, dir: 'down', behavior: 'still' }] }),
    });
    const s1 = run(s, 300);
    expect(tank(s1, 'enemy-1')).toMatchObject({ x: 0, y: 0, dir: 'down' });
    expect(s1.bullets).toHaveLength(0);
  });

  it('random 敌人被挡住会换方向，不会一直卡死', () => {
    const s = createGame({
      seed: 5,
      level: level(EMPTY5, { player: { col: 4, row: 4, dir: 'up' }, enemies: [{ col: 0, row: 0, dir: 'left' }] }),
    });
    const s1 = run(s, 120);
    const e = tank(s1, 'enemy-1');
    expect(e.x !== 0 || e.y !== 0).toBe(true);
  });
});

describe('对局结束', () => {
  it('胜负确定后 step 不再改变状态', () => {
    const s = createGame({
      seed: 1,
      level: level(EMPTY5, {
        player: { col: 2, row: 4, dir: 'up' },
        enemies: [{ col: 2, row: 0, dir: 'down', behavior: 'shoot' }],
      }),
    });
    const lost = runUntil(s, (x) => x.status !== 'playing');
    const after = run(lost, 10, { move: 'left', fire: true });
    expect(JSON.stringify(after)).toBe(JSON.stringify(lost));
  });

  it('没有敌人的关卡开局即胜利', () => {
    expect(createGame({ seed: 1, level: level(EMPTY5, { enemies: [] }) }).status).toBe('won');
  });

  it('坦克大小与格子一致', () => {
    expect(TANK_SIZE).toBe(TILE_SIZE);
  });
});

describe('测试用地图 TEST_LEVELS', () => {
  it('e2e-win：按一次空格就赢', () => {
    const s = createGame({ seed: 1, level: TEST_LEVELS['e2e-win'] });
    expect(s.cols).toBe(13);
    expect(s.enemiesLeft).toBe(1);
    const end = runUntil(step(s, { fire: true }), (x) => x.status !== 'playing', 600);
    expect(end.status).toBe('won');
    expect(end.enemiesLeft).toBe(0);
  });

  it('e2e-win：不操作就一直是 playing', () => {
    const s = run(createGame({ seed: 1, level: TEST_LEVELS['e2e-win'] }), 600);
    expect(s.status).toBe('playing');
  });

  it('e2e-lose：不操作，开局约 1.5 秒内失败', () => {
    const s = createGame({ seed: 1, level: TEST_LEVELS['e2e-lose'] });
    const end = runUntil(s, (x) => x.status !== 'playing', 600);
    expect(end.status).toBe('lost');
    expect(end.tick).toBeLessThanOrEqual(120);
    expect(end.enemiesLeft).toBe(1);
  });
});
