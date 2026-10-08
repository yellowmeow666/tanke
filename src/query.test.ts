import { describe, expect, it } from 'vitest';
import { TEST_LEVELS } from './game';
import { levelFromQuery, seedFromQuery } from './query';

describe('levelFromQuery', () => {
  it('把 e2e-win / e2e-lose 映射到导出的测试地图', () => {
    expect(levelFromQuery('e2e-win')).toBe(TEST_LEVELS['e2e-win']);
    expect(levelFromQuery('e2e-lose')).toBe(TEST_LEVELS['e2e-lose']);
  });

  it('没传或不认识时不指定地图', () => {
    expect(levelFromQuery(null)).toBeUndefined();
    expect(levelFromQuery('')).toBeUndefined();
    expect(levelFromQuery('default')).toBeUndefined();
  });
});

describe('seedFromQuery', () => {
  it('合法数字锁定为网址种子', () => {
    expect(seedFromQuery('42')).toEqual({ seed: 42, fromUrl: true });
    expect(seedFromQuery('  7 ')).toEqual({ seed: 7, fromUrl: true });
    expect(seedFromQuery('0')).toEqual({ seed: 0, fromUrl: true });
  });

  it('缺失或无法解析时改用随机种子', () => {
    const missing = seedFromQuery(null);
    const blank = seedFromQuery('  ');
    const text = seedFromQuery('abc');
    expect(missing.fromUrl).toBe(false);
    expect(blank.fromUrl).toBe(false);
    expect(text.fromUrl).toBe(false);
    for (const choice of [missing, blank, text]) {
      expect(Number.isInteger(choice.seed)).toBe(true);
      expect(choice.seed).toBeGreaterThanOrEqual(0);
      expect(choice.seed).toBeLessThan(0x1_0000_0000);
    }
  });
});
