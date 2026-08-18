import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { makePuzzle, type CutStyleId } from '../cut';
import { BASE, cachedAspect, fitScale, probeAspect, toAbsolute, zStep } from '../shared';

export interface PuzzleBoardProps {
  /** 图片地址。带透明通道也没问题 —— 光照与切口会按 alpha 遮罩 */
  src: string;
  /** 列数，默认 2 */
  cols?: number;
  /** 行数，默认 2 */
  rows?: number;
  /** 榫头朝向的种子；同样的入参永远切出同样的拼图 */
  seed?: number;
  /** 榫头样式，见 CUT_STYLES */
  cut?: CutStyleId;
  /** 榫头整体缩放，1 为原始大小；超出安全区间会被收敛 */
  tenonScale?: number;
  /** 四片朝外散开的距离（基准坐标系下的 px，会跟着缩放） */
  spread?: number;
  /** 散开时的抬升幅度，营造前后层次 */
  lift?: number;
  /**
   * contain = 容器保持外部给定的形状，图按比例居中留白（网格里行高整齐）
   * exact   = 容器跟着图片比例走（单张展示时不浪费空间）
   */
  fit?: 'contain' | 'exact';
  /**
   * 只在滚进视口附近时才渲染拼片（提前 200px 预热）。
   * 一页放很多副拼图时开着它 —— 每片都带多层 drop-shadow 滤镜，全量渲染很吃力。
   */
  lazy?: boolean;
  /** 无障碍描述 */
  alt?: string;
  className?: string;
  style?: CSSProperties;
}

/**
 * 读图片的真实宽高比。拿到之前先按 1:1 占位（缓存命中时直接就是正确值，不会闪）。
 * 这样使用方不需要预先声明每张图的尺寸。
 */
function useImageAspect(src: string) {
  // 存成 { src, aspect } 而不是裸 aspect：src 变化时能在渲染阶段直接判定过期，
  // 不必在 effect 里同步 setState（那会多一轮级联渲染）
  const [probed, setProbed] = useState<{ src: string; aspect: number } | null>(null);
  const aspect = probed?.src === src ? probed.aspect : (cachedAspect(src) ?? 1);

  useEffect(() => probeAspect(src, (a) => setProbed({ src, aspect: a })), [src]);

  return aspect;
}

/**
 * 监听容器尺寸，算出把 baseW × baseH 的坐标系装进去所需的缩放比。
 * 取两个方向的较小值 —— 容器形状与图片不一致时按比例居中留白；
 * 容器本就是图片比例时两个比值相等，等价于按宽度贴合。
 */
function useFitScale(baseW: number, baseH: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [k, setK] = useState(0);

  // useLayoutEffect：在浏览器绘制之前就量好并落定缩放比。用 useEffect 的话首帧会
  // 先画出未缩放的基准尺寸，下一帧才收进容器 —— 刷新时能看见明显的「先大后小」。
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = (width: number, height: number) => {
      if (width > 0 && height > 0) setK(fitScale(width, height, baseW, baseH));
    };
    const box = el.getBoundingClientRect();
    fit(box.width, box.height);
    const ro = new ResizeObserver(([entry]) => {
      if (entry) fit(entry.contentRect.width, entry.contentRect.height);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [baseW, baseH]);

  return { ref, k };
}

/** 滚进视口附近才算「可见」，用于 lazy 渲染 */
function useInView(ref: React.RefObject<HTMLDivElement | null>, enabled: boolean) {
  const [seen, setSeen] = useState(!enabled);
  useEffect(() => {
    if (!enabled) return;
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setSeen(true);
          io.disconnect(); // 一次性：露过面就不再收回
        }
      },
      { rootMargin: '200px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [enabled, ref]);
  return seen;
}

/**
 * 把一张图切成 cols × rows 榫卯拼图，每片用 CSS 渲染成伪 3D。
 *
 * 组件不依赖任何动画库。想加 3D 视角，在外面套一层带 rotateX / rotateY 的容器
 * （父级给 perspective、该层给 transform-style: preserve-3d）即可。
 */
export function PuzzleBoard({
  src,
  cols = 2,
  rows = 2,
  seed = 0,
  cut = 'mushroom',
  tenonScale = 1,
  spread = 0,
  lift = 0,
  fit = 'contain',
  lazy = false,
  alt,
  className,
  style,
}: PuzzleBoardProps) {
  const imgUrl = useMemo(() => toAbsolute(src), [src]);
  const aspect = useImageAspect(imgUrl);
  // 宽固定为 BASE，高随比例 —— 竖图、横图都不会被压扁
  const boardH = Math.round(BASE / aspect);
  const { ref, k } = useFitScale(BASE, boardH);
  const inView = useInView(ref, lazy);
  const puzzle = useMemo(
    () => makePuzzle(BASE, boardH, { cols, rows, seed, style: cut, tenonScale }),
    [boardH, cols, rows, seed, cut, tenonScale],
  );

  return (
    <div
      ref={ref}
      className={className ? `mp-slot ${className}` : 'mp-slot'}
      style={
        {
          '--mp-spread-base': `${spread}px`,
          ...(fit === 'exact' ? { aspectRatio: aspect } : null),
          ...style,
        } as CSSProperties
      }
      role="img"
      aria-label={alt}
    >
      {inView && (
      <div
        className="mp-board"
        style={{
          width: BASE,
          height: boardH,
          marginLeft: -BASE / 2,
          marginTop: -boardH / 2,
          transform: `scale(${k})`,
          // 量到尺寸之前不显示，避免闪一下未缩放的基准尺寸
          visibility: k === 0 ? 'hidden' : undefined,
        }}
      >
        {puzzle.pieces.map((p, i) => (
          <div
            key={p.key}
            className={`mp-piece mp-piece--${p.key}`}
            style={
              {
                '--mp-ox': p.ox,
                '--mp-oy': p.oy,
                '--mp-z-base': `${lift * zStep(i)}px`,
                // 顶面、光照层、切口线都要按图片 alpha 遮罩，所以挂在父级共用
                '--mp-img': `url("${imgUrl}")`,
              } as CSSProperties
            }
          >
            <div className="mp-piece__face" style={{ clipPath: `path("${p.d}")` }} />
            <svg
              className="mp-piece__seam"
              viewBox={`0 0 ${BASE} ${boardH}`}
              style={{ clipPath: `path("${p.d}")` }}
              aria-hidden
            >
              <path className="mp-seam mp-seam--hi" d={p.d} transform="translate(0 2)" />
              <path className="mp-seam mp-seam--lo" d={p.d} />
            </svg>
          </div>
        ))}
      </div>
      )}
    </div>
  );
}

export { BASE as PUZZLE_BASE };
