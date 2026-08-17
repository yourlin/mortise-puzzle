# mortise-puzzle

Cut any image into a **mortise-and-tenon jigsaw** of any grid size, and render every
piece as pseudo-3D with pure CSS — no canvas, no WebGL, the pieces stay real DOM
elements.

**English** | [简体中文](./README.zh-CN.md)

### ▶ [Live demo](https://yourlin.github.io/mortise-puzzle/)

Drag the spread slider, switch between seven tenon shapes and grid sizes, **drop your
own image onto the page** to cut it instantly, then click any tile and move the mouse
to tilt it in 3D.

## Features

- **Interlocking by construction.** Adjacent pieces share the exact same cut
  curve — one traverses it forward (tenon), the other backward (mortise) — from
  the very same floats. No sub-pixel seams, no overlaps, proven by an
  area-conservation test suite.
- **Any grid size.** 2×2, 3×3, 6×4, a single piece — the tenon direction of every
  internal edge is derived deterministically from one seed.
- **Eight tenon styles.** Mushroom, dovetail, square, ball, wedge, keyhole, twin and
  wave. Adding one more is a single array of normalized coordinates.
- **Pure-CSS pseudo-3D.** `clip-path` carves the shape, chained `drop-shadow`
  extrudes the side walls and drop shadow. Pieces remain hoverable, focusable,
  animatable DOM nodes.
- **Any size, any aspect ratio.** Landscape, portrait, even extreme strips —
  tenons never get stretched. Display size adapts to the container.
- **Lazy rendering.** Opt into `lazy` and pieces render only once they scroll near
  the viewport, so a page full of puzzles stays smooth.
- **Alpha-aware.** Lighting and seam strokes are masked by the image's own alpha,
  so a transparent PNG doesn't get a background color smeared onto it.
- **React and Vue renderers.** Same props, same class names, same stylesheet. Or skip
  both and drive the algorithm yourself — it's framework-agnostic.
- **Tiny and dependency-free.** ~25 kB packed; the algorithm entry has zero
  dependencies and never touches the DOM.

## Install

```bash
npm i mortise-puzzle
```

The renderers' frameworks are optional peer dependencies — install only what you use:
`react >= 18` for `mortise-puzzle/react`, `vue >= 3.3` for `mortise-puzzle/vue`. The
algorithm entry needs neither.

## Usage

### React

```tsx
import { PuzzleBoard } from 'mortise-puzzle/react';
import 'mortise-puzzle/styles.css';

export default function Example() {
  return <PuzzleBoard src="/photo.png" cols={3} rows={3} seed={5} cut="dovetail" spread={12} />;
}
```

| Prop | Type | Default | Description |
|---|---|---|---|
| `src` | `string` | — | Image URL. Transparency is fine. |
| `cols` / `rows` | `number` | `2` | Grid size. `3 × 3` gives nine pieces. |
| `seed` | `number` | `0` | Seeds the tenon direction of every internal edge; same inputs always cut the same puzzle. |
| `cut` | `CutStyleId` | `'mushroom'` | Tenon style, see the table below. |
| `spread` | `number` | `0` | How far the pieces drift outward; scales with the board. |
| `lift` | `number` | `0` | Z-offset applied while spread, for depth layering. |
| `fit` | `'contain' \| 'exact'` | `'contain'` | `contain` centers the image inside whatever shape the container has; `exact` makes the container follow the image's aspect ratio. |
| `lazy` | `boolean` | `false` | Render the pieces only once they scroll within 200 px of the viewport. |
| `alt` | `string` | — | Accessible description. |
| `className` / `style` | | | Merged onto the root element. |

The component pulls in no animation library. To add a 3D viewing angle, wrap it in
your own rotating container — give the parent a `perspective` and that layer
`transform-style: preserve-3d`. The demo does exactly this with
[motion](https://motion.dev):

```tsx
<div style={{ perspective: 1100 }}>
  <motion.div style={{ rotateX, rotateY, transformStyle: 'preserve-3d' }}>
    <PuzzleBoard src="/photo.png" fit="exact" />
  </motion.div>
</div>
```

To spread the pieces on hover, no state needed:

```css
.card:hover .mp-slot { --mp-spread-hover: 13px; }
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

Same props as the React version, same class names, same stylesheet. The component is
written with a render function rather than an SFC, so **you don't need any extra build
plugin** — importing it from a plain `.ts` file works too:

```ts
import { createApp, h } from 'vue';
import { PuzzleBoard } from 'mortise-puzzle/vue';
import 'mortise-puzzle/styles.css';

createApp({
  render: () => h(PuzzleBoard, { src: '/photo.png', cols: 3, rows: 3, cut: 'keyhole' }),
}).mount('#app');
```

For a 3D viewing angle, wrap it the same way — a parent with `perspective`, and a
layer you rotate:

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

### Algorithm only

```ts
import { makePuzzle } from 'mortise-puzzle';

const { pieces } = makePuzzle(800, 600, { cols: 4, rows: 3, seed: 5, style: 'dovetail' });

pieces[0].d;          // closed SVG path — feed it to clip-path: path(...) or <path d>
pieces[0].key;        // 'r0c0' — stable id, usable as a React key
pieces[0].row;        // 0
pieces[0].col;        // 0
pieces[0].ox;         // -1..1 — outward direction, handy for explode animations
```

```ts
makePuzzle(width: number, height?: number, options?: {
  cols?: number;      // default 2
  rows?: number;      // default 2
  seed?: number;      // default 0
  style?: CutStyleId; // default 'mushroom'
}): Puzzle
```

`height` defaults to `width`. Zero dependencies and no DOM access, so it also works
in Node — for generating SVG files or slicing images server-side.

## Cut styles

| id | Name | Character |
|---|---|---|
| `mushroom` | 蘑菇榫 | Classic jigsaw: round head, narrow neck. Grips hardest. |
| `dovetail` | 燕尾榫 | The woodworker's tension joint. Trapezoid shoulders. |
| `square` | 直榫 | Right-angled shoulders, the plainest tab and slot. |
| `round` | 球榫 | A ball on a thin neck; softest corners. |
| `wedge` | 楔钉榫 | Arrowhead with barbs. Sharp and angular. |
| `keyhole` | 锁孔榫 | A nearly closed circle held by a very narrow neck. Hardest to pull apart. |
| `twin` | 双榫 | One tab and one slot side by side; pieces hook each other. |
| `wave` | 波纹 | No tenon at all — the whole edge is a double arc. |

### Adding your own

A cut line is described in *normalized edge coordinates*: `t` runs 0→1 along the
edge, `u` is the normal (positive = the side the tenon sticks out). That makes the
description independent of where the line sits, how long it is, and which way it
faces — so a new style is just a command list, and the reverse-traversal
interlocking logic keeps working untouched:

```ts
dovetail: {
  zh: '燕尾榫',
  en: 'Dovetail',
  hint: "The woodworker's tension joint",
  edge: [['L', 0.42, 0], ['L', 0.355, 0.19], ['L', 0.645, 0.19], ['L', 0.58, 0], ['L', 1, 0]],
}
```

Requirements: start from the implicit `(0, 0)`, end at `(1, 0)`, don't
self-intersect. `'L'` is a line, `'C'` a cubic bézier (`c1x c1y c2x c2y x y`).

## Theming

Everything visual is a CSS variable — override any of them (defaults shown):

```css
.mp-slot {
  --mp-fill: transparent;   /* piece backdrop, fills the image's transparent area */
  --mp-zoom: 100%;          /* image scale; e.g. 122% crops transparent padding away */
  --mp-wall-1: #CFAF89;     /* side wall, closest to the top face */
  --mp-wall-2: #A17952;
  --mp-wall-3: #7E5C3A;     /* side wall, deepest */
  --mp-shadow: 0 6px 9px rgba(74, 48, 22, .34);
  --mp-seam-hi: rgba(255, 252, 243, .5);  /* lit inner wall of the cut */
  --mp-seam-lo: rgba(86, 54, 24, .55);    /* dark outline of the cut */
  --mp-gloss: .26;          /* top-face key light */
  --mp-ambient: .22;        /* bottom ambient occlusion */
  --mp-perspective: 1100px;
  --mp-duration: .52s;
}
```

## Demo

Online: **https://yourlin.github.io/mortise-puzzle/**

The demo cuts a set of felted miniature scenes, AI-generated purely as sample material
and **not shipped with the npm package**. Each one uses a different tenon direction
(`seed`); "混搭" (mix) gives each a different tenon style so you can see all eight at
once. Dropping your own image onto the page adds it to the front of the grid — it never
leaves your browser.

The UI is bilingual (English by default) — the toggle sits in the top-right corner.

Deep links: `?lang=zh`, `?cut=dovetail` (or `mix`), `?grid=3x3`, `?open=8`, `?spread=16`.

Run it locally:

```bash
git clone https://github.com/yourlin/mortise-puzzle.git
cd mortise-puzzle
npm install
npm run dev
```

`demo/` imports the library by package name (via a Vite alias), so it doubles as a
worked example of consuming the package.

| Script | What it does |
|---|---|
| `npm run dev` | Demo dev server |
| `npm run build:lib` | Build the npm package → `dist/` |
| `npm run build:demo` | Build the demo site → `dist-demo/` |
| `npm run check` | Lint + type-check + tests |
| `npm run test` | Geometry test suite (vitest) |
| `npm run lint` | ESLint |

Pushing to `main` deploys the demo to GitHub Pages via Actions.

## How it works

**Why it always interlocks.** Internal cut edges are organized on a vertex grid:
`vEdge[r][c]` runs top-to-bottom, `hEdge[r][c]` left-to-right. Every internal edge is
shared by exactly two pieces — one walks it forward and gets a tenon, the other walks
the identical curve backward and gets the matching mortise. Same floats, so the
geometry coincides exactly, at any grid size. `npm run test` validates every style against five aspect ratios, eight grid sizes and
many seeds: paths closed, nothing outside the image bounds, the piece areas summing
to exactly width × height, and the shared curve overlapping point-by-point.

**Where the thickness comes from.** After `clip-path: path()` carves the tenon
outline, chained `drop-shadow` filters extrude that alpha shape downward layer by
layer — each shadow applies to the previous filter's result, so the offsets stack
into a solid side wall, with the last one as the cast shadow. The cut itself is the
same path stroked twice: a lit inner wall plus a dark outline.

**Four traps worth knowing** (all flagged in the source comments):

1. Tenon *height* must scale by one global reference (the shorter side of a cell),
   while only the along-edge axis scales by the edge's own length. Otherwise a
   non-square image gives the vertical and horizontal cut lines different lengths,
   and the tenons come out different sizes, squashed into ellipses.
2. The lighting layer and the seam strokes need an `mask-image` of the image's own
   alpha. Without it they paint over the transparent regions and look exactly like
   a background color that appeared out of nowhere.
3. Measure the container in `useLayoutEffect`, not `useEffect` — the latter runs
   after paint, so the first frame shows the unscaled base size and everything
   visibly snaps into place on load.
4. Image URLs must be resolved to absolute before going into a CSS custom property.
   Chrome resolves a relative `url()` inside a custom property against *the
   stylesheet that references it* — after bundling that's `/assets/`, so
   `img/a.png` 404s and the pieces vanish entirely. It only reproduces in a
   production build, since dev servers inject CSS inline.

## License

MIT © yourlin
