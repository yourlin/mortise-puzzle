/**
 * 榫卯拼图切割算法
 * ==================
 * 把 width × height 的矩形切成 cols × rows 片，输出每片一条闭合 SVG path，
 * 可直接喂给 CSS `clip-path: path(...)`。
 *
 * 几何要点 —— 内部切割边按「顶点网格」组织：
 *
 *          c0      c1      c2
 *       r0 ┌───────┬───────┐        vEdge[r][c]：竖直内部边，自上而下
 *          │ r0c0  │ r0c1  │          c ∈ 1..cols-1
 *       r1 ├───────┼───────┤        hEdge[r][c]：水平内部边，自左而右
 *          │ r1c0  │ r1c1  │          r ∈ 1..rows-1
 *       r2 └───────┴───────┘
 *
 *   每条内部边中央长出一个榫头，且被相邻两片共享：
 *     vEdge[r][c] 是 (c-1, r) 的右边（正向遍历，得到凸榫）
 *                 也是 (c,   r) 的左边（反向遍历，于是天然是凹卯）
 *   两片用的是同一组浮点数，所以拼回去必然严丝合缝，不会出现亚像素缝隙或重叠。
 *
 *   榫头朝向由 seed 逐位决定；边数超过 32 时用 seed 派生的哈希继续，
 *   所以任意网格尺寸都是确定性的 —— 同样的入参永远切出同样的拼图。
 */

export type Pt = readonly [number, number];

type Seg =
  | { readonly type: 'L'; readonly p: Pt }
  | { readonly type: 'C'; readonly c1: Pt; readonly c2: Pt; readonly p: Pt };

interface Edge {
  readonly start: Pt;
  readonly end: Pt;
  readonly segs: readonly Seg[];
}

export interface Piece {
  /** 稳定标识，形如 `r0c1`，可直接当 React key */
  readonly key: string;
  /** 行号，0 起 */
  readonly row: number;
  /** 列号，0 起 */
  readonly col: number;
  /** 闭合 SVG path，坐标系为 0..width / 0..height */
  readonly d: string;
  /** 朝外散开的方向，-1..1（居中的片接近 0），用于「炸开」动画 */
  readonly ox: number;
  readonly oy: number;
}

export interface Puzzle {
  readonly width: number;
  readonly height: number;
  readonly cols: number;
  readonly rows: number;
  readonly seed: number;
  readonly style: CutStyleId;
  readonly pieces: readonly Piece[];
}

/* ══════════════════════════════════════════════════════════════
   榫头样式表
   ══════════════════════════════════════════════════════════════
   一条切割线用「沿边归一化坐标」描述，与它在图上的位置、长度、朝向无关：
     t = 沿边前进方向，0（起点）→ 1（终点）
     u = 边的法线方向，正值 = 榫头凸出的那一侧
   所以换一种榫卯，只是换一组 (t, u) 命令；反向遍历、严丝合缝的逻辑通用。
   约束：命令序列必须从隐含的 (0,0) 出发、以 (1,0) 收尾，且不自交。            */

/** 沿边命令：直线 或 三次贝塞尔（坐标都是 (t, u)） */
export type EdgeCmd =
  | readonly ['L', number, number]
  | readonly ['C', number, number, number, number, number, number];

export interface CutStyle {
  readonly zh: string;
  readonly en: string;
  readonly hint: string;
  readonly edge: readonly EdgeCmd[];
}

/**
 * 蘑菇头榫的基准轮廓：t ∈ [0.36, 0.64]（中心 0.5、半宽 0.14），头部比颈口宽。
 * 抽成函数是为了能挪位置、缩尺寸、翻朝向 —— 双榫样式就是拿它拼出来的。
 */
function mushroom(center: number, half: number, dir: 1 | -1): EdgeCmd[] {
  const k = half / 0.14;
  const T = (t: number) => center + (t - 0.5) * k;
  const U = (u: number) => u * k * dir;
  return [
    ['L', T(0.36), 0],
    ['C', T(0.44), U(0), T(0.36), U(0.14), T(0.42), U(0.16)], // 左颈：先前冲再回收
    ['C', T(0.3), U(0.24), T(0.7), U(0.24), T(0.58), U(0.16)], // 头部：向两侧扩张
    ['C', T(0.64), U(0.14), T(0.56), U(0), T(0.64), U(0)], // 右颈：左颈的镜像
  ];
}

const r5 = (v: number) => Math.round(v * 1e5) / 1e5;

/**
 * 用三次贝塞尔逼近一段圆弧（每段不超过 90° 时误差可忽略）。
 * 角度按数学惯例：0 在右侧，逆时针为正；u 轴朝榫头凸出方向。
 */
function arc(cx: number, cy: number, r: number, from: number, to: number, segs = 4): EdgeCmd[] {
  const out: EdgeCmd[] = [];
  const step = (to - from) / segs;
  const k = (4 / 3) * Math.tan(step / 4); // 控制点臂长系数，step 为负时 k 也为负
  for (let i = 0; i < segs; i++) {
    const a = from + step * i;
    const b = a + step;
    const p0x = cx + r * Math.cos(a);
    const p0y = cy + r * Math.sin(a);
    const p3x = cx + r * Math.cos(b);
    const p3y = cy + r * Math.sin(b);
    out.push([
      'C',
      r5(p0x - k * r * Math.sin(a)),
      r5(p0y + k * r * Math.cos(a)),
      r5(p3x + k * r * Math.sin(b)),
      r5(p3y - k * r * Math.cos(b)),
      r5(p3x),
      r5(p3y),
    ]);
  }
  return out;
}

/**
 * 锁孔榫：一个近乎闭合的圆，通过极窄的颈口挂在边上（形似钥匙孔）。
 * 颈口宽度决定圆的开口角 —— 口越窄，扣上后越拔不出来。
 * @param center 榫头中心在边上的位置（0..1）
 * @param neck   颈口宽度（相对边长）
 * @param r      圆半径
 * @param cy     圆心到边的距离；取 r*cos(开口半角) 左右能让圆几乎贴住边
 */
function keyhole(center: number, neck: number, r: number, cy: number): EdgeCmd[] {
  const phi = Math.asin(Math.min(1, neck / 2 / r)); // 开口半角
  const bottom = -Math.PI / 2; // 圆的最低点朝着边线
  const left = bottom - phi;
  const right = bottom + phi;
  const A: [number, number] = [cx(center, r, left), cyOf(cy, r, left)];
  const B: [number, number] = [cx(center, r, right), cyOf(cy, r, right)];
  return [
    ['L', r5(A[0]), 0], // 走到颈口左侧
    ['L', r5(A[0]), r5(A[1])], // 顺着窄颈爬上圆
    // 从左端点绕行一整圈（避开底部开口）到右端点：跨度 -(2π - 2φ)
    ...arc(center, cy, r, left, right - 2 * Math.PI),
    ['L', r5(B[0]), 0], // 顺着窄颈回到边上
    ['L', 1, 0],
  ];
}
const cx = (center: number, r: number, a: number) => center + r * Math.cos(a);
const cyOf = (cy: number, r: number, a: number) => cy + r * Math.sin(a);

export const CUT_STYLES = {
  /** 经典拼图榫：圆头细颈，扣上就拔不出来 */
  mushroom: {
    zh: '蘑菇榫',
    en: 'Mushroom',
    hint: '经典拼图的圆头细颈，咬合最紧',
    edge: [...mushroom(0.5, 0.14, 1), ['L', 1, 0]],
  },
  /** 燕尾榫：木工里最经典的抗拉结构，梯形头宽颈窄 */
  dovetail: {
    zh: '燕尾榫',
    en: 'Dovetail',
    hint: '木工抗拉第一，梯形斜肩',
    edge: [
      ['L', 0.42, 0],
      ['L', 0.355, 0.19],
      ['L', 0.645, 0.19],
      ['L', 0.58, 0],
      ['L', 1, 0],
    ],
  },
  /** 直榫（方榫）：最朴素的一凸一凹，直角肩 */
  square: {
    zh: '直榫',
    en: 'Square',
    hint: '直角肩的方头，最朴素的一凸一凹',
    edge: [
      ['L', 0.4, 0],
      ['L', 0.4, 0.18],
      ['L', 0.6, 0.18],
      ['L', 0.6, 0],
      ['L', 1, 0],
    ],
  },
  /** 球榫：细颈托着一个近乎正圆的球头 */
  round: {
    zh: '球榫',
    en: 'Ball',
    hint: '细颈托圆球，转角最柔和',
    edge: [
      ['L', 0.4, 0],
      ['C', 0.46, 0.01, 0.34, 0.05, 0.36, 0.12],
      ['C', 0.3, 0.26, 0.7, 0.26, 0.64, 0.12],
      ['C', 0.66, 0.05, 0.54, 0.01, 0.6, 0],
      ['L', 1, 0],
    ],
  },
  /** 楔钉榫：箭头形，两侧倒钩往回勾住 */
  wedge: {
    zh: '楔钉榫',
    en: 'Wedge',
    hint: '箭头形倒钩，棱角分明',
    edge: [
      ['L', 0.44, 0],
      ['L', 0.34, 0.14],
      ['L', 0.5, 0.23],
      ['L', 0.66, 0.14],
      ['L', 0.56, 0],
      ['L', 1, 0],
    ],
  },
  /** 锁孔榫：极窄颈口 + 近乎闭合的大圆，扣上几乎拔不出来 */
  keyhole: {
    zh: '锁孔榫',
    en: 'Keyhole',
    hint: '窄口锁住近乎闭合的大圆，最难拔开',
    edge: keyhole(0.5, 0.07, 0.155, 0.165),
  },
  /** 双榫：一凸一凹并排，两片互相扣住对方 */
  twin: {
    zh: '双榫',
    en: 'Twin',
    hint: '一凸一凹并排，互相扣住',
    edge: [...mushroom(0.3, 0.1, 1), ...mushroom(0.7, 0.1, -1), ['L', 1, 0]],
  },
  /** 波纹：没有榫头，整条边是反向的双弧 */
  wave: {
    zh: '波纹',
    en: 'Wave',
    hint: '不设榫头，整条边是双向弧',
    edge: [
      ['C', 0.16, 0.1, 0.34, 0.1, 0.5, 0],
      ['C', 0.66, -0.1, 0.84, -0.1, 1, 0],
    ],
  },
} as const satisfies Record<string, CutStyle>;

export type CutStyleId = keyof typeof CUT_STYLES;

export const CUT_STYLE_IDS = Object.keys(CUT_STYLES) as CutStyleId[];

const UP: Pt = [0, -1];
const DOWN: Pt = [0, 1];
const LEFT: Pt = [-1, 0];
const RIGHT: Pt = [1, 0];

/**
 * 按某种样式构造一条切割边。
 * @param bulge 榫头凸出方向的单位向量，须垂直于 a→b
 * @param tabScale 法线方向（榫头高度）的基准长度。沿边方向用边长本身，法线方向
 *   却要用一个全局统一的基准 —— 否则图片不是正方形时，横竖两条切割线长度不同，
 *   榫头就会一大一小、被拉伸变形。
 */
function tabbed(a: Pt, b: Pt, bulge: Pt, style: CutStyle, tabScale: number): Edge {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const dir: Pt = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];

  // (t, u) → 绝对坐标
  const P = (t: number, u: number): Pt => [
    a[0] + dir[0] * len * t + bulge[0] * tabScale * u,
    a[1] + dir[1] * len * t + bulge[1] * tabScale * u,
  ];

  const segs: Seg[] = style.edge.map((cmd) =>
    cmd[0] === 'L'
      ? { type: 'L', p: P(cmd[1], cmd[2]) }
      : { type: 'C', c1: P(cmd[1], cmd[2]), c2: P(cmd[3], cmd[4]), p: P(cmd[5], cmd[6]) },
  );

  return { start: a, end: b, segs };
}

/** 一条没有榫头的直边（图片的外轮廓） */
function straight(a: Pt, b: Pt): Edge {
  return { start: a, end: b, segs: [{ type: 'L', p: b }] };
}

/**
 * 反向遍历一条边：端点互换、各段倒序、三次贝塞尔的两个控制点对调。
 * 数值原样搬运，因此正 / 反两条路径在几何上完全重合 —— 这是严丝合缝的保证。
 */
function reverse(edge: Edge): Edge {
  const pts: Pt[] = [edge.start, ...edge.segs.map((s) => s.p)];
  const segs: Seg[] = [];
  for (let i = edge.segs.length - 1; i >= 0; i--) {
    const s = edge.segs[i]!;
    segs.push(
      s.type === 'C'
        ? { type: 'C', c1: s.c2, c2: s.c1, p: pts[i]! }
        : { type: 'L', p: pts[i]! },
    );
  }
  return { start: edge.end, end: edge.start, segs };
}

const n = (v: number) => String(Math.round(v * 100) / 100);

/** 把若干条首尾相接的边序列化成一条闭合 path */
function toPath(edges: readonly Edge[]): string {
  let d = `M${n(edges[0]!.start[0])} ${n(edges[0]!.start[1])}`;
  for (const e of edges) {
    for (const s of e.segs) {
      d +=
        s.type === 'C'
          ? ` C${n(s.c1[0])} ${n(s.c1[1])} ${n(s.c2[0])} ${n(s.c2[1])} ${n(s.p[0])} ${n(s.p[1])}`
          : ` L${n(s.p[0])} ${n(s.p[1])}`;
    }
  }
  return `${d} Z`;
}

export interface PuzzleOptions {
  /** 列数，默认 2 */
  cols?: number;
  /** 行数，默认 2 */
  rows?: number;
  /** 榫头朝向的种子，同样的入参永远切出同样的拼图。默认 0 */
  seed?: number;
  /** 榫头样式，见 CUT_STYLES。默认 'mushroom' */
  style?: CutStyleId;
}

/**
 * 取第 i 条内部边的榫头朝向。
 * 前 31 条直接读 seed 的对应位（所以 2×2 的 16 个 seed 正好一一对应 16 种切法）；
 * 更密的网格边数会超出位宽，改用 seed 派生的整数哈希继续，保持确定性。
 */
function dirBit(seed: number, i: number): 0 | 1 {
  if (i < 31) return ((seed >>> i) & 1) as 0 | 1;
  return ((Math.imul(seed ^ (i * 0x9e3779b9), 0x45d9f3b) >>> 16) & 1) as 0 | 1;
}

/**
 * 切一副榫卯拼图。任意宽高比、任意网格尺寸都可以。
 *
 * @param width  图片宽（px）
 * @param height 图片高（px），默认与宽相同
 * @param options 网格尺寸、种子、榫头样式
 *
 * @example
 * makePuzzle(800, 600);                                    // 2×2
 * makePuzzle(800, 600, { cols: 4, rows: 3, seed: 7 });      // 4×3
 * makePuzzle(512, 512, { cols: 3, rows: 3, style: 'dovetail' });
 */
export function makePuzzle(width: number, height = width, options: PuzzleOptions = {}): Puzzle {
  const { cols = 2, rows = 2, seed = 0, style = 'mushroom' } = options;
  const w = width;
  const h = height;
  const nc = Math.max(1, Math.floor(cols));
  const nr = Math.max(1, Math.floor(rows));
  const cw = w / nc;
  const ch = h / nr;
  const cut = CUT_STYLES[style] ?? CUT_STYLES.mushroom;
  // 榫头高度的统一基准：单元格较短的那条边。沿边方向按各自边长缩放，法线方向
  // 统一用这个值，横竖榫头才会一样大、不被拉成椭圆。
  const tab = Math.min(cw, ch);

  const at = (c: number, r: number): Pt => [c * cw, r * ch];

  // 内部边：vEdge[r][c] 自上而下（c ∈ 1..nc-1），hEdge[r][c] 自左而右（r ∈ 1..nr-1）。
  // 编号连续递增，好让 seed 的每一位对应一条边。
  let edgeNo = 0;
  const vEdge = new Map<string, Edge>();
  const hEdge = new Map<string, Edge>();

  for (let r = 0; r < nr; r++) {
    for (let c = 1; c < nc; c++) {
      const bulge = dirBit(seed, edgeNo++) ? RIGHT : LEFT;
      vEdge.set(`${r}:${c}`, tabbed(at(c, r), at(c, r + 1), bulge, cut, tab));
    }
  }
  for (let r = 1; r < nr; r++) {
    for (let c = 0; c < nc; c++) {
      const bulge = dirBit(seed, edgeNo++) ? DOWN : UP;
      hEdge.set(`${r}:${c}`, tabbed(at(c, r), at(c + 1, r), bulge, cut, tab));
    }
  }

  const pieces: Piece[] = [];
  for (let r = 0; r < nr; r++) {
    for (let c = 0; c < nc; c++) {
      // 顺时针走一圈：上 → 右 → 下 → 左。外框是直边，内部边取共享的那一条 ——
      // 右 / 上用正向，左 / 下用反向，于是凸榫必然对上邻片的凹卯。
      const top = r === 0 ? straight(at(c, r), at(c + 1, r)) : hEdge.get(`${r}:${c}`)!;
      const right = c === nc - 1 ? straight(at(c + 1, r), at(c + 1, r + 1)) : vEdge.get(`${r}:${c + 1}`)!;
      const bottom =
        r === nr - 1
          ? straight(at(c + 1, r + 1), at(c, r + 1))
          : reverse(hEdge.get(`${r + 1}:${c}`)!);
      const left = c === 0 ? straight(at(c, r + 1), at(c, r)) : reverse(vEdge.get(`${r}:${c}`)!);

      pieces.push({
        key: `r${r}c${c}`,
        row: r,
        col: c,
        d: toPath([top, right, bottom, left]),
        // 单列 / 单行时没有「朝外」可言，给 0
        ox: nc === 1 ? 0 : (c / (nc - 1)) * 2 - 1,
        oy: nr === 1 ? 0 : (r / (nr - 1)) * 2 - 1,
      });
    }
  }

  return { width: w, height: h, cols: nc, rows: nr, seed, style, pieces };
}
