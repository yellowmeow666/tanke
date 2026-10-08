import { expect, test, type Page } from '@playwright/test';

// 冒烟测试：只在本地运行（npm run test:e2e），不进 CI。
// 测试专用小地图由 src/game 的 TEST_LEVELS 提供，页面用 ?level= 加载：
// - e2e-win：1 辆 still 敌人正对玩家，按一次空格即可胜利。
// - e2e-lose：1 辆 shoot 敌人正对玩家，不操作约 1.5 秒后失败（这张图不要按空格）。

const status = (page: Page) => page.getByTestId('game-status');
const enemiesLeft = (page: Page) => page.getByTestId('enemies-left');
/**
 * 剩余敌人元素的文本带前缀（如「剩余敌人：4」），只断言末尾的数字：
 * 前面不能有其他数字，数字后面不能有别的内容。
 */
const enemyCount = (digits: string) => new RegExp(`^\\D*${digits}$`);
/**
 * 页面每个固定步长读取一次「当前按住的键」，keydown 和 keyup 落在同一帧里的瞬时按键不会被看到。
 * 按住约 100ms 再松开，模拟真人按一次空格。
 */
const pressFire = (page: Page) => page.keyboard.press('Space', { delay: 100 });

/** 取画布底部中间（玩家出生区域）附近 3×3 格的像素快照，用来判断玩家是否移动。 */
async function playerAreaSnapshot(page: Page): Promise<string> {
  return page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) throw new Error('页面上没有 canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas 没有 2d 上下文');
    const cell = canvas.width / 13;
    const data = ctx.getImageData(cell * 5, cell * 10, cell * 3, cell * 3).data;
    let hash = 0;
    for (let i = 0; i < data.length; i += 1) {
      // 开启 noUncheckedIndexedAccess 后，下标读取的类型是 number | undefined。
      const sample = data[i] ?? 0;
      hash = (hash * 31 + sample) | 0;
    }
    return String(hash);
  });
}

test.describe('默认地图', () => {
  test('开局：状态为 playing，剩余敌人为 4，有画布', async ({ page }) => {
    await page.goto('/?seed=1');
    await expect(status(page)).toHaveText('playing');
    await expect(enemiesLeft(page)).toHaveText(enemyCount('4'));
    await expect(page.locator('canvas')).toBeVisible();
  });

  test('移动和射击：按方向键、WASD 和空格后游戏仍在进行，页面无报错', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/?seed=1');
    await expect(status(page)).toHaveText('playing');
    await page.locator('canvas').click();
    for (const key of ['ArrowUp', 'ArrowLeft', 'ArrowRight', 'ArrowDown', 'w', 'a', 's', 'd']) {
      await page.keyboard.down(key);
      await page.waitForTimeout(80);
      await page.keyboard.up(key);
    }
    await pressFire(page);
    await page.waitForTimeout(200);
    await expect(enemiesLeft(page)).toHaveText(enemyCount('[0-4]'));
    await expect(status(page)).toHaveText('playing');
    expect(errors).toEqual([]);
  });
});

test.describe('测试小地图 e2e-win', () => {
  test('不操作时画面静止；按方向键后玩家移动', async ({ page }) => {
    await page.goto('/?level=e2e-win');
    await expect(status(page)).toHaveText('playing');
    await page.waitForTimeout(300);
    const before = await playerAreaSnapshot(page);
    await page.waitForTimeout(300);
    expect(await playerAreaSnapshot(page)).toBe(before);
    await page.keyboard.down('ArrowLeft');
    await page.waitForTimeout(300);
    await page.keyboard.up('ArrowLeft');
    expect(await playerAreaSnapshot(page)).not.toBe(before);
    await expect(status(page)).toHaveText('playing');
  });

  test('射击击毁敌人：剩余敌人从 1 变 0，进入 won；重新开始后回到 playing', async ({ page }) => {
    await page.goto('/?level=e2e-win');
    await expect(status(page)).toHaveText('playing');
    await expect(enemiesLeft(page)).toHaveText(enemyCount('1'));
    await pressFire(page);
    await expect(enemiesLeft(page)).toHaveText(enemyCount('0'), { timeout: 5000 });
    await expect(status(page)).toHaveText('won');
    await page.getByTestId('restart').click();
    await expect(status(page)).toHaveText('playing');
    await expect(enemiesLeft(page)).toHaveText(enemyCount('1'));
  });
});

test.describe('测试小地图 e2e-lose', () => {
  test('被敌方子弹击中进入 lost，结束后停住；按回车重新开始', async ({ page }) => {
    await page.goto('/?level=e2e-lose');
    await expect(status(page)).toHaveText('lost', { timeout: 5000 });
    await expect(enemiesLeft(page)).toHaveText(enemyCount('1'));
    // 结束后游戏停住：等一会儿状态和计数都不变
    await page.waitForTimeout(500);
    await expect(status(page)).toHaveText('lost');
    await page.keyboard.press('Enter');
    await expect(status(page)).toHaveText('playing');
    await expect(enemiesLeft(page)).toHaveText(enemyCount('1'));
    // 新的一局同样会输，说明重新开始用的是同一张图
    await expect(status(page)).toHaveText('lost', { timeout: 5000 });
  });

  test('点「重新开始」按钮也能开新的一局', async ({ page }) => {
    await page.goto('/?level=e2e-lose');
    await expect(status(page)).toHaveText('lost', { timeout: 5000 });
    await page.getByTestId('restart').click();
    await expect(status(page)).toHaveText('playing');
  });
});
