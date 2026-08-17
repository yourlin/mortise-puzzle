# mortise-puzzle · 榫卯拼图

把任意一张图切成**任意网格的榫卯拼图**，每片用纯 CSS 渲染成伪 3D —— 不用 canvas、
不用 WebGL，拼片始终是可交互的 DOM 元素。

[English](./README.md) | **简体中文**

### ▶ [在线 Demo](https://yourlin.github.io/mortise-puzzle/)

[![mortise-puzzle demo](https://raw.githubusercontent.com/yourlin/mortise-puzzle/main/docs/screenshot.jpg)](https://yourlin.github.io/mortise-puzzle/)

*上图是 demo 的「混搭」模式 —— 每张图各用一种榫卯。* 拖动散开滑块、切换八种榫卯与
网格尺寸、**把自己的图片拖进页面**立刻切开，点开任意一张后移动鼠标还能转 3D 视角。

## 特性

- **天生严丝合缝**：相邻两片共享同一条切割曲线 —— 一片正向遍历得到凸榫，另一片
  反向遍历得到凹卯 —— 用的是同一组浮点数，不会有亚像素缝隙或重叠，有面积守恒
  测试兜底。
- **任意网格尺寸**：2×2、3×3、6×4、乃至单片都行 —— 每条内部边的榫头朝向都由
  一个 seed 确定性派生。
- **八种榫卯**：蘑菇榫、燕尾榫、直榫、球榫、楔钉榫、锁孔榫、双榫、波纹。加一种
  只需写一组归一化坐标。
- **纯 CSS 伪 3D**：`clip-path` 裁形，链式 `drop-shadow` 挤出侧壁与落影。拼片
  仍是能 hover、能聚焦、能动画的 DOM 节点。
- **任意尺寸与比例**：横图、竖图、极端长条都不会把榫头拉变形；显示尺寸自适应容器。
- **懒渲染**：打开 `lazy`，拼片只在滚进视口附近时才渲染，一页放很多副也不卡。
- **尊重透明通道**：光照与切口按图片自身的 alpha 遮罩，带透明背景的 PNG 不会被
  糊上一层底色。
- **React 与 Vue 两套渲染层**：属性、类名、样式表完全一致。也可以两个都不用，
  自己拿算法渲染 —— 它与框架无关。
- **小而无依赖**：打包约 25 kB；算法入口零依赖、不碰 DOM。

## 安装

```bash
npm i mortise-puzzle
```

渲染层依赖的框架都是可选 peer 依赖，用哪个装哪个：`mortise-puzzle/react` 需要
`react >= 18`，`mortise-puzzle/vue` 需要 `vue >= 3.3`。只用算法入口的话两者都不需要。

## 用法

### React

```tsx
import { PuzzleBoard } from 'mortise-puzzle/react';
import 'mortise-puzzle/styles.css';

export default function Example() {
  return <PuzzleBoard src="/photo.png" cols={3} rows={3} seed={5} cut="dovetail" spread={12} />;
}
```

| 属性 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `src` | `string` | — | 图片地址，带透明通道也没问题 |
| `cols` / `rows` | `number` | `2` | 网格尺寸，`3 × 3` 就是九片 |
| `seed` | `number` | `0` | 派生每条内部边的榫头朝向；同样的入参永远切出同样的拼图 |
| `cut` | `CutStyleId` | `'mushroom'` | 榫卯样式，见下表 |
| `spread` | `number` | `0` | 拼片朝外散开的距离，会跟着缩放 |
| `lift` | `number` | `0` | 散开时的抬升幅度，制造前后层次 |
| `fit` | `'contain' \| 'exact'` | `'contain'` | `contain` 在容器给定的形状内按比例居中留白；`exact` 让容器跟着图片比例走 |
| `lazy` | `boolean` | `false` | 只在滚进视口 200px 范围内时才渲染拼片 |
| `alt` | `string` | — | 无障碍描述 |
| `className` / `style` | | | 合并到根元素上 |

组件不依赖任何动画库。想加 3D 视角，在外面套一层自己的旋转容器即可 —— 父级给
`perspective`，该层给 `transform-style: preserve-3d`。demo 里就是用
[motion](https://motion.dev) 这么做的：

```tsx
<div style={{ perspective: 1100 }}>
  <motion.div style={{ rotateX, rotateY, transformStyle: 'preserve-3d' }}>
    <PuzzleBoard src="/photo.png" fit="exact" />
  </motion.div>
</div>
```

悬停时让拼片散开，不必动 state：

```css
.card:hover .mp-slot { --mp-spread-hover: 13px; }
```

散开会让拼片探出容器 —— 单独看没问题，但会压住下面的东西。想把拼图始终关在格子里，
按 `spread` 给容器等比内缩即可：board 会相应缩小补偿，于是拼图整体尺寸不变，
拼片是朝内部散开的：

```tsx
import { PuzzleBoard, PUZZLE_BASE } from 'mortise-puzzle/react';

<PuzzleBoard src="/photo.png" spread={spread} style={{ padding: `${(spread / PUZZLE_BASE) * 100}%` }} />;
```

### Vue 3

```vue
<script setup lang="ts">
import { PuzzleBoard } from 'mortise-puzzle/vue';
import 'mortise-puzzle/styles.css';
</script>

<template>
  <PuzzleBoard src="/photo.png" :cols="3" :rows="3" :seed="5" cut="dovetail" :spread="12" />
</template>
```

属性、类名、样式表与 React 版完全一致。组件是用渲染函数写的、不是 SFC，所以
**不需要任何额外的构建插件** —— 在普通 `.ts` 文件里用也一样：

```ts
import { createApp, h } from 'vue';
import { PuzzleBoard } from 'mortise-puzzle/vue';
import 'mortise-puzzle/styles.css';

createApp({
  render: () => h(PuzzleBoard, { src: '/photo.png', cols: 3, rows: 3, cut: 'keyhole' }),
}).mount('#app');
```

想加 3D 视角，套法也一样 —— 父级给 `perspective`，中间加一层负责旋转：

```vue
<script setup lang="ts">
import { ref } from 'vue';
import { PuzzleBoard } from 'mortise-puzzle/vue';

const rx = ref(0);
const ry = ref(0);
function tilt(e: PointerEvent) {
  const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
  ry.value = ((e.clientX - r.left) / r.width - 0.5) * 36;
  rx.value = -((e.clientY - r.top) / r.height - 0.5) * 26;
}
</script>

<template>
  <div style="perspective: 1100px" @pointermove="tilt" @pointerleave="rx = 0; ry = 0">
    <div
      :style="{
        transformStyle: 'preserve-3d',
        transform: `rotateX(${rx}deg) rotateY(${ry}deg)`,
        transition: 'transform .2s',
      }"
    >
      <PuzzleBoard src="/photo.png" fit="exact" :spread="10" :lift="16" />
    </div>
  </div>
</template>
```

### 只要算法

```ts
import { makePuzzle } from 'mortise-puzzle';

const { pieces } = makePuzzle(800, 600, { cols: 4, rows: 3, seed: 5, style: 'dovetail' });

pieces[0].d;   // 闭合 SVG path，可直接喂给 clip-path: path(...) 或 <path d>
pieces[0].key; // 'r0c0' —— 稳定标识，可直接当 React key
pieces[0].row; // 0
pieces[0].col; // 0
pieces[0].ox;  // -1..1 —— 朝外的方向，做炸开动画时用得上
```

```ts
makePuzzle(width: number, height?: number, options?: {
  cols?: number;      // 默认 2
  rows?: number;      // 默认 2
  seed?: number;      // 默认 0
  style?: CutStyleId; // 默认 'mushroom'
}): Puzzle
```

`height` 缺省时跟 `width` 一致。零依赖、不碰 DOM，所以在 Node 里也能用 ——
生成 SVG 文件或做服务端裁图都可以。

## 榫卯样式

| id | 名称 | 特征 |
|---|---|---|
| `mushroom` | 蘑菇榫 | 经典拼图的圆头细颈，咬合最紧 |
| `dovetail` | 燕尾榫 | 木工抗拉第一，梯形斜肩 |
| `square` | 直榫 | 直角肩的方头，最朴素的一凸一凹 |
| `round` | 球榫 | 细颈托圆球，转角最柔和 |
| `wedge` | 楔钉榫 | 箭头形倒钩，棱角分明 |
| `keyhole` | 锁孔榫 | 窄口锁住近乎闭合的大圆，最难拔开 |
| `twin` | 双榫 | 一凸一凹并排，互相扣住 |
| `wave` | 波纹 | 不设榫头，整条边是双向弧 |

### 加自己的样式

一条切割线用**沿边归一化坐标**描述：`t` 沿边 0→1，`u` 为法线（正值 = 榫头凸出的
那一侧）。这样描述与它在图上的位置、长度、朝向都无关 —— 所以新样式只是一串命令，
反向遍历与咬合逻辑完全不用动：

```ts
dovetail: {
  zh: '燕尾榫',
  en: 'Dovetail',
  hint: '木工抗拉第一，梯形斜肩',
  edge: [['L', 0.42, 0], ['L', 0.355, 0.19], ['L', 0.645, 0.19], ['L', 0.58, 0], ['L', 1, 0]],
}
```

要求：从隐含的 `(0, 0)` 出发、以 `(1, 0)` 收尾、不自交。`'L'` 是直线，`'C'` 是
三次贝塞尔（`c1x c1y c2x c2y x y`）。

## 样式定制

外观全部走 CSS 变量，覆盖即可（值为默认）：

```css
.mp-slot {
  --mp-fill: transparent;   /* 拼片底色，垫在图片透明区下面 */
  --mp-zoom: 100%;          /* 图片缩放，设 122% 之类可把透明留白裁到片外 */
  --mp-wall-1: #CFAF89;     /* 侧壁：贴近顶面 */
  --mp-wall-2: #A17952;
  --mp-wall-3: #7E5C3A;     /* 侧壁：最深处 */
  --mp-shadow: 0 6px 9px rgba(74, 48, 22, .34);
  --mp-seam-hi: rgba(255, 252, 243, .5);  /* 切口的受光内壁 */
  --mp-seam-lo: rgba(86, 54, 24, .55);    /* 切口的轮廓暗线 */
  --mp-gloss: .26;          /* 顶面主光强度 */
  --mp-ambient: .22;        /* 底部环境暗角强度 */
  --mp-perspective: 1100px;
  --mp-duration: .52s;
}
```

## Demo

在线地址：**https://yourlin.github.io/mortise-puzzle/**

demo 切的是一组羊毛毡风格的小场景，纯粹作为演示素材用 AI 生成，**不随 npm 包发布**。
每张各用一种榫头朝向（`seed`）；点「混搭」可以让每张用不同的榫卯样式，一屏看完八种。

把自己的图片拖到页面上，它会插到网格最前面 —— 图片只留在你的浏览器里，不会上传。

界面支持中英文（默认英文），切换按钮在右上角。

深链接：`?lang=zh`、`?cut=dovetail`（或 `mix`）、`?grid=3x3`、`?open=8`、`?spread=16`。

本地运行：

```bash
git clone https://github.com/yourlin/mortise-puzzle.git
cd mortise-puzzle
npm install
npm run dev
```

`demo/` 通过包名引用本地源码（Vite alias），所以它同时是一份「怎么用这个包」的
完整示例。

| 命令 | 作用 |
|---|---|
| `npm run dev` | demo 开发服务器 |
| `npm run build:lib` | 构建 npm 包 → `dist/` |
| `npm run build:demo` | 构建 demo 站点 → `dist-demo/` |
| `npm run check` | lint + 类型检查 + 测试 |
| `npm run test` | 几何测试套件（vitest） |
| `npm run lint` | ESLint |

推送到 `main` 会由 GitHub Actions 自动把 demo 部署到 Pages。

## 实现原理

**为什么一定能咬合**：内部切割边按顶点网格组织 —— `vEdge[r][c]` 自上而下、
`hEdge[r][c]` 自左而右。每条内部边都恰好被两片共享：一片正向遍历得到凸榫，另一片
反向遍历同一条曲线得到配对的凹卯。同一组浮点数，几何上完全重合，网格多大都一样。

`npm run test` 对每种榫卯都验证五种宽高比、八种网格尺寸与多个 seed：路径闭合、
不越出图片边界、各片面积之和精确等于宽 × 高、共享曲线逐点重合。

**厚度从哪来**：`clip-path: path()` 裁出榫卯外形之后，链式 `drop-shadow` 沿这个
alpha 形状逐层向下挤出 —— 每个阴影作用于前一个滤镜的结果，偏移因此累加成实心侧壁，
最后一层作为落影。切口则是同一条 path 描边两次：受光内壁 + 轮廓暗线。

**四个值得记下的坑**（源码注释里都标了）：

1. 榫头**高度**必须用一个全局基准（单元格较短的那条边）缩放，只有沿边方向才按边长
   本身缩放。否则图片不是正方形时，横竖两条切割线长度不同，榫头会一大一小、被拉成
   椭圆。
2. 光照层和切口描边需要按图片自身 alpha 做 `mask-image` 遮罩。少了这步，它们会画
   在透明区上，看着就像凭空多出一块背景色。
3. 量容器要用 `useLayoutEffect` 而不是 `useEffect` —— 后者在绘制之后才跑，首帧会
   先画出未缩放的基准尺寸，加载时能看见明显的「先大后小」。
4. 图片地址要先转成绝对 URL 再放进 CSS 自定义属性。Chrome 解析自定义属性里的相对
   `url()` 时，基准是**引用它的样式表**，打包后样式表在 `/assets/` 下，
   `img/a.png` 就会 404，拼片直接消失。这个 bug 只在生产构建里复现 —— dev server
   把 CSS 内联注入，所以一直是正常的。

## License

MIT © MasterLin
