/**
 * mulberry32：输入当前内部状态，返回 [0,1) 的随机数和新状态。
 * 纯函数，状态存在 GameState 里，保证同一个 seed 结果完全一致。
 */
export function nextRandom(state: number): [value: number, nextState: number] {
  const next = (state + 0x6d2b79f5) >>> 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return [value, next];
}
