import { TEST_LEVELS, type LevelSpec, type TestLevelName } from './game';

/** 开局用的种子，以及重新开始时要不要沿用网址里的种子。 */
export interface SeedChoice {
  seed: number;
  /** 网址带了合法 `?seed=` 时为 true，重新开始仍用这个种子。 */
  fromUrl: boolean;
}

/** 生成一个 32 位无符号整数种子，方便写进网址复现。 */
export function randomSeed(): number {
  const buffer = new Uint32Array(1);
  crypto.getRandomValues(buffer);
  const value = buffer[0];
  if (value === undefined) return Math.floor(Math.random() * 0x1_0000_0000);
  return value;
}

/**
 * 读取 `?seed=`。
 * 缺失、空白或不是有限数字时，现生成一个随机种子，重新开始也会再换新的。
 */
export function seedFromQuery(raw: string | null): SeedChoice {
  if (raw !== null && raw.trim() !== '') {
    const value = Number(raw);
    if (Number.isFinite(value)) return { seed: value, fromUrl: true };
  }
  return { seed: randomSeed(), fromUrl: false };
}

/**
 * 读取 `?level=`。
 * 只认识 `TEST_LEVELS` 里的名字；没传或不认识时返回 undefined，调用方不传 level，走默认地图。
 */
export function levelFromQuery(name: string | null): LevelSpec | undefined {
  if (name && Object.hasOwn(TEST_LEVELS, name)) {
    return TEST_LEVELS[name as TestLevelName];
  }
  return undefined;
}
