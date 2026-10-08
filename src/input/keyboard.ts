import type { Direction, Input } from '../game';

/** 方向键和 WASD。用 code，避免大小写和输入法影响。 */
const DIRECTION_BY_CODE: Readonly<Record<string, Direction>> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  KeyW: 'up',
  KeyA: 'left',
  KeyS: 'down',
  KeyD: 'right',
};

export function directionFromCode(code: string): Direction | null {
  return DIRECTION_BY_CODE[code] ?? null;
}

export function isFireCode(code: string): boolean {
  return code === 'Space';
}

/** 方向键和空格会滚动页面，需要拦住。WASD 本身不滚动。 */
export function shouldPreventScroll(code: string): boolean {
  return code === 'Space' || code.startsWith('Arrow');
}

/**
 * 当前按住的键。
 * 方向只保留一个：多个方向键同时按住时，取最后按下、且还没松开的那个。
 * 不会把两个方向合成斜向。
 */
export class HeldKeys {
  /** 仍按住的方向键 code，按下顺序排列，最后一项是当前方向。 */
  private directionCodes: string[] = [];
  private fireHeld = false;

  /** repeat 为 true 时是键盘连发，不改变“最后按下”的顺序。 */
  press(code: string, repeat = false): void {
    if (repeat) return;
    if (isFireCode(code)) {
      this.fireHeld = true;
      return;
    }
    if (!directionFromCode(code)) return;
    // 已经按住的键不会再次入队，避免一次松开剩下一串重复记录。
    if (this.directionCodes.includes(code)) return;
    this.directionCodes.push(code);
  }

  release(code: string): void {
    if (isFireCode(code)) {
      this.fireHeld = false;
      return;
    }
    this.directionCodes = this.directionCodes.filter((item) => item !== code);
  }

  /** 窗口失焦时清空，避免切回来后按键卡住。 */
  clear(): void {
    this.directionCodes = [];
    this.fireHeld = false;
  }

  toInput(): Input {
    const last = this.directionCodes[this.directionCodes.length - 1];
    const move = last ? directionFromCode(last) : null;
    return { move: move ?? null, fire: this.fireHeld };
  }
}

/** 监听键盘和失焦。返回解除监听的函数。 */
export function attachKeyboard(target: Window, held: HeldKeys): () => void {
  const onKeyDown = (event: KeyboardEvent) => {
    if (shouldPreventScroll(event.code)) event.preventDefault();
    held.press(event.code, event.repeat);
  };
  const onKeyUp = (event: KeyboardEvent) => {
    held.release(event.code);
  };
  const onBlur = () => {
    held.clear();
  };

  target.addEventListener('keydown', onKeyDown);
  target.addEventListener('keyup', onKeyUp);
  target.addEventListener('blur', onBlur);
  return () => {
    target.removeEventListener('keydown', onKeyDown);
    target.removeEventListener('keyup', onKeyUp);
    target.removeEventListener('blur', onBlur);
  };
}
