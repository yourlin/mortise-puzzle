import { useCallback, useEffect, useState, type PointerEvent } from 'react';
import { AnimatePresence, motion, useSpring } from 'motion/react';
import { PuzzleBoard, PUZZLE_BASE } from 'mortise-puzzle/react';
import { CUT_STYLES, type CutStyleId } from 'mortise-puzzle';
import { primary, secondary as secondaryLabel, type Lang, type Strings } from './i18n.tsx';
export interface LightboxItem {
  no: number;
  zh: string;
  en: string;
  src: string;
}

interface Props {
  /** null = 关闭 */
  index: number | null;
  /** 网格里那一串（可能含拖进来的自定义图片） */
  items: readonly LightboxItem[];
  cols: number;
  rows: number;
  /** 网格越密，散开量要按单元格尺寸等比收 */
  cellScale: number;
  lang: Lang;
  t: Strings;
  /** 第 i 张图该用哪种榫卯（混搭模式下每张不同） */
  cutFor: (index: number) => CutStyleId;
  onClose: () => void;
  onStep: (delta: number) => void;
}

const OPEN_SPREAD = 44;
/** 默认就微微露缝，一眼看出是四片而不是一整张图 */
const REST_SPREAD = 6;

export function Lightbox({
  index,
  items,
  cols,
  rows,
  cellScale,
  lang,
  t,
  cutFor,
  onClose,
  onStep,
}: Props) {
  // 连着 index 一起存：换图时在渲染阶段就判定为过期、回到静置值，
  // 不用在 effect 里同步 setState
  const [held, setHeld] = useState<{ index: number | null; spread: number }>({
    index,
    spread: REST_SPREAD,
  });
  const spread = held.index === index ? held.spread : REST_SPREAD;
  const setSpread = useCallback(
    (next: number | ((s: number) => number)) =>
      setHeld((prev) => {
        const current = prev.index === index ? prev.spread : REST_SPREAD;
        return { index, spread: typeof next === 'function' ? next(current) : next };
      }),
    [index],
  );

  const rx = useSpring(0, { stiffness: 140, damping: 18 });
  const ry = useSpring(0, { stiffness: 140, damping: 18 });

  useEffect(() => {
    if (index === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') onStep(-1);
      if (e.key === 'ArrowRight') onStep(1);
      if (e.key === ' ') {
        e.preventDefault();
        setSpread((s) => (s > REST_SPREAD ? REST_SPREAD : OPEN_SPREAD));
      }
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [index, onClose, onStep, setSpread]);

  const lp = index === null ? null : items[index];

  const track = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    ry.set(((e.clientX - r.left) / r.width - 0.5) * 36);
    rx.set(-((e.clientY - r.top) / r.height - 0.5) * 26);
  };
  const reset = () => {
    rx.set(0);
    ry.set(0);
  };

  return (
    <AnimatePresence>
      {lp && (
        <motion.div
          className="lightbox"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.24 }}
          onClick={(e) => e.target === e.currentTarget && onClose()}
          role="dialog"
          aria-modal
          aria-label={primary(lang, lp.zh, lp.en)}
        >
          <motion.div
            className="lb-card"
            initial={{ y: 26, scale: 0.94, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 16, scale: 0.96, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 26 }}
          >
            <button className="btn btn--close" onClick={onClose} aria-label="关闭">
              ✕
            </button>
            <button className="btn btn--nav btn--prev" onClick={() => onStep(-1)} aria-label="上一张">
              ‹
            </button>
            <button className="btn btn--nav btn--next" onClick={() => onStep(1)} aria-label="下一张">
              ›
            </button>

            <div className="lb-stage" onPointerMove={track} onPointerLeave={reset}>
              {/* 库组件本身不依赖动画库，3D 视角靠外面这层 motion 提供 */}
              <motion.div className="lb-tilt" style={{ rotateX: rx, rotateY: ry }}>
                <PuzzleBoard
                  src={lp.src}
                  cols={cols}
                  rows={rows}
                  seed={index!}
                  cut={cutFor(index!)}
                  spread={spread * cellScale}
                  lift={spread * cellScale * 1.5}
                  style={{ padding: `${((spread * cellScale) / PUZZLE_BASE) * 100}%` }}
                  fit="exact"
                  alt={primary(lang, lp.zh, lp.en)}
                />
              </motion.div>
            </div>

            <div className="lb-meta">
              <span className="lb-no">{lp.no === 0 ? t.yourImage : t.lbNo(lp.no)}</span>
              <h2 className="lb-zh">{primary(lang, lp.zh, lp.en)}</h2>
              <p className="lb-en">{lp.no === 0 ? '' : secondaryLabel(lang, lp.zh, lp.en)}</p>
            </div>

            <div className="lb-controls">
              <button
                className="pill"
                onClick={() => setSpread((s) => (s > REST_SPREAD ? REST_SPREAD : OPEN_SPREAD))}
              >
                {spread > REST_SPREAD ? t.collapse : t.explodeN(cols * rows)}
              </button>
              <label className="slider">
                <span>{t.spread}</span>
                <input
                  type="range"
                  min={0}
                  max={70}
                  value={spread}
                  onChange={(e) => setSpread(Number(e.target.value))}
                  aria-label={t.spreadAria}
                />
              </label>
              <span className="seed">
                {primary(lang, CUT_STYLES[cutFor(index!)].zh, CUT_STYLES[cutFor(index!)].en)} ·{' '}
                {cols}×{rows} · seed {index}
              </span>
            </div>
            <p className="lb-hint">{t.lbHint}</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
