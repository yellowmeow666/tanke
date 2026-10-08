import { describe, expect, it } from 'vitest';
import { BULLET_SIZE, TILE_SIZE, type Bullet, type GameState, type Tank, type TileKind } from '../game';
import { barrelRect, bulletColor, drawGame, tankColor } from './draw';

describe('坦克与子弹的颜色、朝向', () => {
  it('玩家和敌人的颜色不同', () => {
    expect(tankColor('player')).not.toBe(tankColor('enemy'));
    expect(bulletColor('player')).not.toBe(bulletColor('enemy'));
  });

  it('炮管贴着朝向的那一条边', () => {
    const size = 32;
    const up = barrelRect('up', size);
    const down = barrelRect('down', size);
    const left = barrelRect('left', size);
    const right = barrelRect('right', size);
    expect(up.y).toBe(0);
    expect(down.y + down.h).toBe(size);
    expect(left.x).toBe(0);
    expect(right.x + right.w).toBe(size);
    expect(up.w).toBeLessThan(up.h);
    expect(left.h).toBeLessThan(left.w);
  });
});

describe('drawGame', () => {
  it('按格子尺寸铺画布，画砖墙和边界，并跳过已被击毁的坦克', () => {
    const { ctx, fills, strokes } = mockContext();
    drawGame(ctx, sampleState());

    expect(ctx.canvas.width).toBe(2 * TILE_SIZE);
    expect(ctx.canvas.height).toBe(2 * TILE_SIZE);
    expect(strokes.count).toBe(1);
    // 砖墙整格先铺灰缝，彩色砖块缩在格子内部。
    expect(fills.some((rect) => rect.x === TILE_SIZE && rect.y === 0 && rect.w === TILE_SIZE)).toBe(true);
    expect(
      fills.some(
        (rect) => rect.style === '#d06a3a' && rect.x >= TILE_SIZE && rect.x < TILE_SIZE * 2 && rect.y < TILE_SIZE,
      ),
    ).toBe(true);
    expect(fills.some((rect) => rect.style === tankColor('player'))).toBe(true);
    expect(fills.some((rect) => rect.style === tankColor('enemy'))).toBe(false);
    expect(fills.some((rect) => rect.w === BULLET_SIZE && rect.h === BULLET_SIZE)).toBe(true);
  });
});

function sampleState(): GameState {
  const tiles: TileKind[][] = [
    ['empty', 'brick'],
    ['empty', 'empty'],
  ];
  const tanks: Tank[] = [
    tank({ id: 'player', side: 'player', x: 0, y: TILE_SIZE, dir: 'up', alive: true }),
    tank({ id: 'enemy-1', side: 'enemy', x: TILE_SIZE, y: 0, dir: 'left', alive: false }),
  ];
  const bullets: Bullet[] = [{ id: 1, ownerId: 'player', side: 'player', x: 4, y: 4, dir: 'up' }];
  return {
    tick: 0,
    status: 'playing',
    cols: 2,
    rows: 2,
    tiles,
    tanks,
    bullets,
    enemiesLeft: 0,
    seed: 1,
    rngState: 1,
    nextBulletId: 2,
  };
}

function tank(partial: Pick<Tank, 'id' | 'side' | 'x' | 'y' | 'dir' | 'alive'>): Tank {
  return {
    behavior: partial.side === 'player' ? null : 'still',
    fireCooldown: 0,
    turnTimer: 0,
    ...partial,
  };
}

function mockContext(): {
  ctx: CanvasRenderingContext2D;
  fills: Array<{ style: string; x: number; y: number; w: number; h: number }>;
  strokes: { count: number };
} {
  const fills: Array<{ style: string; x: number; y: number; w: number; h: number }> = [];
  const strokes = { count: 0 };
  const ctx = {
    canvas: { width: 0, height: 0 },
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    imageSmoothingEnabled: true,
    fillRect(x: number, y: number, w: number, h: number) {
      fills.push({ style: ctx.fillStyle, x, y, w, h });
    },
    strokeRect() {
      strokes.count += 1;
    },
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, fills, strokes };
}
