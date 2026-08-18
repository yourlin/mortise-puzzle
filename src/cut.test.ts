import { describe, expect, it } from 'vitest';
import { CUT_STYLE_IDS, CUT_STYLES, makePuzzle, type Puzzle } from './cut';

const SAMPLES = 400;

/** 把 path 离散成折线，三次贝塞尔按 SAMPLES 段采样 */
function polyline(d: string): [number, number][] {
  const pts: [number, number][] = [];
  let cur: [number, number] = [0, 0];
  for (const tok of d.match(/[MLCZ][^MLCZ]*/g) ?? []) {
    const v = tok.slice(1).trim().split(/[\s,]+/).filter(Boolean).map(Number);
    if (tok[0] === 'M' || tok[0] === 'L') {
      cur = [v[0]!, v[1]!];
      pts.push(cur);
    } else if (tok[0] === 'C') {
      const [x1, y1, x2, y2, x, y] = v as number[];
      const p0 = cur;
      for (let i = 1; i <= SAMPLES; i++) {
        const t = i / SAMPLES;
        const m = 1 - t;
        pts.push([
          m ** 3 * p0[0] + 3 * m * m * t * x1! + 3 * m * t * t * x2! + t ** 3 * x!,
          m ** 3 * p0[1] + 3 * m * m * t * y1! + 3 * m * t * t * y2! + t ** 3 * y!,
        ]);
      }
      cur = [x!, y!];
    }
  }
  return pts;
}

/** 鞋带公式求多边形面积 */
const area = (p: [number, number][]) =>
  Math.abs(
    p.reduce((acc, [x, y], i) => {
      const [nx, ny] = p[(i + 1) % p.length]!;
      return acc + (x * ny - nx * y);
    }, 0) / 2,
  );

const closed = (p: [number, number][]) => {
  const a = p[0]!;
  const b = p[p.length - 1]!;
  return Math.hypot(a[0] - b[0], a[1] - b[1]) < 0.01;
};

const inBounds = (p: [number, number][], w: number, h: number) =>
  p.every(([x, y]) => x >= -0.5 && x <= w + 0.5 && y >= -0.5 && y <= h + 0.5);

/** 面积守恒是最强的单一断言：缝隙会让总和偏小，重叠会让它偏大 */
function expectAreaConserved(pz: Puzzle) {
  const total = pz.pieces.reduce((sum, pc) => sum + area(polyline(pc.d)), 0);
  expect(total / (pz.width * pz.height)).toBeCloseTo(1, 6);
}

/** 覆盖正方形、横图、竖图、极端长条 */
const SHAPES: [number, number][] = [
  [400, 400],
  [520, 300],
  [300, 520],
  [640, 200],
  [200, 640],
];

const GRIDS: [number, number][] = [
  [2, 2],
  [1, 1],
  [3, 1],
  [1, 4],
  [3, 3],
  [4, 2],
  [2, 5],
  [6, 6],
];

describe('makePuzzle', () => {
  it('默认切 2×2', () => {
    const pz = makePuzzle(400);
    expect(pz.pieces).toHaveLength(4);
    expect(pz.cols).toBe(2);
    expect(pz.rows).toBe(2);
    expect(pz.width).toBe(400);
    expect(pz.height).toBe(400); // height 缺省时跟宽一致
  });

  it('片数与网格一致，key / row / col 唯一且对应', () => {
    for (const [cols, rows] of GRIDS) {
      const pz = makePuzzle(400, 300, { cols, rows });
      expect(pz.pieces).toHaveLength(cols * rows);
      const keys = new Set(pz.pieces.map((p) => p.key));
      expect(keys.size).toBe(cols * rows);
      for (const p of pz.pieces) expect(p.key).toBe(`r${p.row}c${p.col}`);
    }
  });

  it('同样的入参切出同样的拼图（确定性）', () => {
    const a = makePuzzle(400, 260, { cols: 4, rows: 3, seed: 9, style: 'wedge' });
    const b = makePuzzle(400, 260, { cols: 4, rows: 3, seed: 9, style: 'wedge' });
    expect(a.pieces.map((p) => p.d)).toEqual(b.pieces.map((p) => p.d));
  });

  it('不同 seed 切出不同的榫头朝向', () => {
    // 整副拼图的指纹。单看某一片是不够的：2×2 里左上片只挨着 2 条内部边，
    // 所以它自己只有 4 种形状，得把四片合起来看
    const fingerprint = (seed: number) =>
      makePuzzle(400, 400, { seed }).pieces.map((p) => p.d).join('|');
    const all = new Set(Array.from({ length: 16 }, (_, seed) => fingerprint(seed)));
    // 2×2 有 4 条内部边、每条两种朝向 —— 16 个 seed 正好一一对应 16 种切法
    expect(all.size).toBe(16);
  });

  it('炸开方向落在 -1..1，四角为 ±1', () => {
    const pz = makePuzzle(400, 400, { cols: 3, rows: 3 });
    for (const p of pz.pieces) {
      expect(p.ox).toBeGreaterThanOrEqual(-1);
      expect(p.ox).toBeLessThanOrEqual(1);
      expect(p.oy).toBeGreaterThanOrEqual(-1);
      expect(p.oy).toBeLessThanOrEqual(1);
    }
    expect(pz.pieces.find((p) => p.key === 'r0c0')).toMatchObject({ ox: -1, oy: -1 });
    expect(pz.pieces.find((p) => p.key === 'r1c1')).toMatchObject({ ox: 0, oy: 0 });
    expect(pz.pieces.find((p) => p.key === 'r2c2')).toMatchObject({ ox: 1, oy: 1 });
  });

  it('单片（1×1）就是整张图，四边都是直边', () => {
    const pz = makePuzzle(300, 200, { cols: 1, rows: 1 });
    expect(pz.pieces).toHaveLength(1);
    expect(pz.pieces[0]!.d).not.toContain('C'); // 没有榫头曲线
    expectAreaConserved(pz);
  });

  it('tenonScale 默认 1，并回报实际生效值', () => {
    expect(makePuzzle(400).tenonScale).toBe(1);
    expect(makePuzzle(400, 400, { tenonScale: 0.6 }).tenonScale).toBe(0.6);
  });

  it('tenonScale 越界被收敛，上限按样式轮廓宽度自适应', () => {
    expect(makePuzzle(400, 400, { tenonScale: 0.01 }).tenonScale).toBe(0.2);
    // 双榫的轮廓铺得最宽（t 从 0.2 起），能放大的余量因此最小
    const twin = makePuzzle(400, 400, { style: 'twin', tenonScale: 9 }).tenonScale;
    const mushroom = makePuzzle(400, 400, { style: 'mushroom', tenonScale: 9 }).tenonScale;
    expect(twin).toBeLessThan(mushroom);
    expect(twin).toBeGreaterThan(1);
  });

  it('缩放确实改变了榫头形状', () => {
    const small = makePuzzle(400, 400, { tenonScale: 0.5 }).pieces[0]!.d;
    const large = makePuzzle(400, 400, { tenonScale: 1.5 }).pieces[0]!.d;
    expect(small).not.toBe(large);
  });

  it('异常网格参数被收敛到至少 1', () => {
    expect(makePuzzle(400, 400, { cols: 0, rows: -3 }).pieces).toHaveLength(1);
    expect(makePuzzle(400, 400, { cols: 2.7, rows: 3.9 }).pieces).toHaveLength(6); // 向下取整
  });
});

describe.each(CUT_STYLE_IDS)('榫卯样式 %s', (style) => {
  it(`${CUT_STYLES[style].zh}：各种宽高比下路径闭合、不越界、面积守恒`, () => {
    for (const [w, h] of SHAPES) {
      for (let seed = 0; seed < 16; seed++) {
        const pz = makePuzzle(w, h, { seed, style });
        for (const pc of pz.pieces) {
          const pts = polyline(pc.d);
          expect(closed(pts), `${style} ${w}×${h} seed${seed} ${pc.key} 未闭合`).toBe(true);
          expect(inBounds(pts, w, h), `${style} ${w}×${h} seed${seed} ${pc.key} 越界`).toBe(true);
        }
        expectAreaConserved(pz);
      }
    }
  });

  it(`${CUT_STYLES[style].zh}：各种网格尺寸下面积守恒`, () => {
    for (const [cols, rows] of GRIDS) {
      for (const seed of [0, 7, 12345]) {
        const pz = makePuzzle(480, 360, { cols, rows, seed, style });
        expect(pz.pieces).toHaveLength(cols * rows);
        for (const pc of pz.pieces) {
          expect(closed(polyline(pc.d))).toBe(true);
          expect(inBounds(polyline(pc.d), 480, 360)).toBe(true);
        }
        expectAreaConserved(pz);
      }
    }
  });

  it(`${CUT_STYLES[style].zh}：各种榫头缩放下都不越界、面积守恒`, () => {
    // 榫头放大到极端值时最容易把控制点推出图片边界 —— 波纹与双榫都曾在这里翻车
    for (const tenonScale of [0.2, 0.5, 1, 1.5, 2, 9]) {
      for (const [cols, rows] of [[2, 2], [3, 3], [6, 4]] as [number, number][]) {
        for (const [w, h] of [[400, 400], [200, 640]] as [number, number][]) {
          const pz = makePuzzle(w, h, { cols, rows, seed: 5, style, tenonScale });
          for (const pc of pz.pieces) {
            const pts = polyline(pc.d);
            expect(closed(pts)).toBe(true);
            expect(
              inBounds(pts, w, h),
              `${style} scale=${tenonScale} ${cols}×${rows} ${w}×${h} ${pc.key} 越界`,
            ).toBe(true);
          }
          expectAreaConserved(pz);
        }
      }
    }
  });

  it(`${CUT_STYLES[style].zh}：相邻两片共享的曲线逐点重合`, () => {
    const pz = makePuzzle(400, 400, { seed: 5, style });
    const a = polyline(pz.pieces.find((p) => p.key === 'r0c0')!.d);
    const b = polyline(pz.pieces.find((p) => p.key === 'r0c1')!.d);
    const overlap = a.filter((p) => b.some((q) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 0.02)).length;
    const curveSegs = CUT_STYLES[style].edge.filter((c) => c[0] === 'C').length;
    // 曲线型榫卯应有整段重合；纯直线型（燕尾/直榫/楔钉）只在顶点处重合
    expect(overlap).toBeGreaterThanOrEqual(Math.max(curveSegs * SAMPLES, 2));
  });
});
