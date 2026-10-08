import { describe, expect, it } from 'vitest';
import { HeldKeys, directionFromCode, shouldPreventScroll } from './keyboard';

describe('方向键映射', () => {
  it('方向键和 WASD 都映射到四个正方向', () => {
    expect(directionFromCode('ArrowUp')).toBe('up');
    expect(directionFromCode('ArrowDown')).toBe('down');
    expect(directionFromCode('ArrowLeft')).toBe('left');
    expect(directionFromCode('ArrowRight')).toBe('right');
    expect(directionFromCode('KeyW')).toBe('up');
    expect(directionFromCode('KeyA')).toBe('left');
    expect(directionFromCode('KeyS')).toBe('down');
    expect(directionFromCode('KeyD')).toBe('right');
    expect(directionFromCode('KeyQ')).toBeNull();
    expect(directionFromCode('Space')).toBeNull();
  });

  it('只拦截会滚动页面的方向键和空格', () => {
    expect(shouldPreventScroll('ArrowUp')).toBe(true);
    expect(shouldPreventScroll('Space')).toBe(true);
    expect(shouldPreventScroll('KeyW')).toBe(false);
    expect(shouldPreventScroll('Enter')).toBe(false);
  });
});

describe('多键优先级', () => {
  it('同时按住多个方向时取最后按下的那个', () => {
    const held = new HeldKeys();
    held.press('ArrowLeft');
    held.press('KeyW');
    held.press('ArrowRight');
    expect(held.toInput()).toEqual({ move: 'right', fire: false });
  });

  it('松开最后按下的键后，退回仍按着的上一个方向', () => {
    const held = new HeldKeys();
    held.press('ArrowUp');
    held.press('KeyD');
    held.release('KeyD');
    expect(held.toInput().move).toBe('up');
  });

  it('两个键对应同一方向时，松开后一个仍保持该方向', () => {
    const held = new HeldKeys();
    held.press('ArrowUp');
    held.press('KeyW');
    expect(held.toInput().move).toBe('up');
    held.release('KeyW');
    expect(held.toInput().move).toBe('up');
    held.release('ArrowUp');
    expect(held.toInput().move).toBeNull();
  });

  it('键盘连发不改变当前方向，也不会在松开后残留', () => {
    const held = new HeldKeys();
    held.press('ArrowLeft');
    held.press('ArrowLeft', true);
    held.press('ArrowDown');
    held.press('ArrowDown', true);
    expect(held.toInput().move).toBe('down');
    held.release('ArrowDown');
    expect(held.toInput().move).toBe('left');
  });

  it('空格射击与方向互相独立', () => {
    const held = new HeldKeys();
    held.press('Space');
    expect(held.toInput()).toEqual({ move: null, fire: true });
    held.press('KeyA');
    expect(held.toInput()).toEqual({ move: 'left', fire: true });
    held.release('Space');
    expect(held.toInput()).toEqual({ move: 'left', fire: false });
  });

  it('失焦清空后不再移动或射击', () => {
    const held = new HeldKeys();
    held.press('ArrowRight');
    held.press('Space');
    held.clear();
    expect(held.toInput()).toEqual({ move: null, fire: false });
  });
});
