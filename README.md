# 坦克大战

单机坦克大战，在本地浏览器里游玩。

范围只到这一局游戏本身：不做联机、不做账号、不做关卡编辑器，也不对外发布。

## 技术栈

- 前端：Vite + TypeScript + Canvas 2D
- 无后端，也不使用游戏引擎
- 单元测试：Vitest
- 代码检查：ESLint
- 端到端测试：Playwright，只在本地运行
- 持续集成：GitHub Actions 跑 `lint`、`test`、`build`

## 玩法

- 方向键或 WASD 四向移动，空格射击
- 地图为 13×13 格，其中有可以打掉的砖墙
- 开局有 4 辆敌方坦克，它们会自己移动并射击
- 每辆坦克同时最多只有一发子弹在场上
- 子弹相撞时互相抵消
- 敌方子弹不会伤害其他敌方坦克
- 玩家只有一条命
- 击毁全部敌人即胜利；玩家被击中即失败
- 页面上会显示剩余敌人数量
- 胜负之后，按回车，或点击「重新开始」，开始新的一局

## 本地运行

需要 Node.js 20。

```bash
npm ci
npm run dev
```

然后在浏览器打开 [http://localhost:5173](http://localhost:5173)。

### 网址参数

- `?seed=<数字>`：用同一个随机种子复现某一局
- `?level=e2e-win`、`?level=e2e-lose`：测试专用的小地图，日常游玩不用

## 测试

```bash
npm run lint
npm test
npm run build
```

Playwright 不进入 CI。本地跑端到端测试前，先安装 Chromium：

```bash
npx playwright install chromium
npm run test:e2e
```

## 目录结构

```text
src/game/              纯 TypeScript 游戏逻辑
src/render/            Canvas 画面
src/input/             键盘与页面操作
src/main.ts            入口
index.html             页面
tests/acceptance/      验收测试
tests/e2e/             Playwright 端到端测试
.github/workflows/     CI（lint、test、build）
```
