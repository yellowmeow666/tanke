import {
  BULLET_SIZE,
  TANK_SIZE,
  TILE_SIZE,
  type Direction,
  type GameState,
  type Side,
} from '../game';

const GROUND = '#24281f';
const BRICK_MORTAR = '#6e3018';
const BRICK = '#d06a3a';
const BOUNDARY = '#8d949c';
const PLAYER = '#f0c014';
const ENEMY = '#d64545';
const PLAYER_BULLET = '#fff1a8';
const ENEMY_BULLET = '#ffd0d0';
const TRACK = '#1a1a1a';
const BARREL = '#2a2418';

export interface PixelRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function tankColor(side: Side): string {
  return side === 'player' ? PLAYER : ENEMY;
}

export function bulletColor(side: Side): string {
  return side === 'player' ? PLAYER_BULLET : ENEMY_BULLET;
}

/**
 * 炮管矩形，坐标相对坦克左上角。
 * 炮管伸到坦克外沿，用来表示朝向。
 */
export function barrelRect(dir: Direction, size: number): PixelRect {
  const thickness = Math.max(4, Math.round(size * 0.18));
  const length = Math.round(size * 0.62);
  const cross = Math.round((size - thickness) / 2);
  switch (dir) {
    case 'up':
      return { x: cross, y: 0, w: thickness, h: length };
    case 'down':
      return { x: cross, y: size - length, w: thickness, h: length };
    case 'left':
      return { x: 0, y: cross, w: length, h: thickness };
    case 'right':
      return { x: size - length, y: cross, w: length, h: thickness };
  }
}

/** 只读 GameState，把当前局面画到画布上。不推进规则。 */
export function drawGame(ctx: CanvasRenderingContext2D, state: GameState): void {
  const width = state.cols * TILE_SIZE;
  const height = state.rows * TILE_SIZE;
  // 改画布尺寸会清空位图，尺寸没变时不要重置。
  if (ctx.canvas.width !== width) ctx.canvas.width = width;
  if (ctx.canvas.height !== height) ctx.canvas.height = height;
  ctx.imageSmoothingEnabled = false;

  ctx.fillStyle = GROUND;
  ctx.fillRect(0, 0, width, height);

  for (let row = 0; row < state.rows; row += 1) {
    const line = state.tiles[row];
    if (!line) continue;
    for (let col = 0; col < state.cols; col += 1) {
      if (line[col] !== 'brick') continue;
      drawBrick(ctx, col * TILE_SIZE, row * TILE_SIZE);
    }
  }

  drawBoundary(ctx, width, height);

  for (const tank of state.tanks) {
    // 被击毁的坦克仍留在数组里，画面上跳过。
    if (!tank.alive) continue;
    drawTank(ctx, tank.x, tank.y, tank.dir, tank.side);
  }

  for (const bullet of state.bullets) {
    ctx.fillStyle = bulletColor(bullet.side);
    ctx.fillRect(bullet.x, bullet.y, BULLET_SIZE, BULLET_SIZE);
  }
}

function drawBrick(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = BRICK_MORTAR;
  ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
  ctx.fillStyle = BRICK;
  const half = TILE_SIZE / 2;
  const gap = 2;
  const size = half - gap;
  ctx.fillRect(x + 1, y + 1, size, size);
  ctx.fillRect(x + half + 1, y + 1, size, size);
  ctx.fillRect(x + 1, y + half + 1, size, size);
  ctx.fillRect(x + half + 1, y + half + 1, size, size);
}

/** 地图外就是边界，在画布四边描一圈钢边。 */
function drawBoundary(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  ctx.strokeStyle = BOUNDARY;
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, width - 4, height - 4);
}

function drawTank(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  dir: Direction,
  side: Side,
): void {
  const size = TANK_SIZE;
  const track = 5;
  ctx.fillStyle = TRACK;
  // 履带放在行进方向的两侧，和炮管一起表明朝向。
  if (dir === 'up' || dir === 'down') {
    ctx.fillRect(x, y, track, size);
    ctx.fillRect(x + size - track, y, track, size);
  } else {
    ctx.fillRect(x, y, size, track);
    ctx.fillRect(x, y + size - track, size, track);
  }

  const barrel = barrelRect(dir, size);
  ctx.fillStyle = BARREL;
  ctx.fillRect(x + barrel.x, y + barrel.y, barrel.w, barrel.h);

  ctx.fillStyle = tankColor(side);
  const pad = 8;
  ctx.fillRect(x + pad, y + pad, size - pad * 2, size - pad * 2);
}
