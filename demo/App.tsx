import { useState, type CSSProperties } from 'react';
import { motion } from 'motion/react';
import { PuzzleBoard } from 'mortise-puzzle/react';
import { CUT_STYLES, CUT_STYLE_IDS, type CutStyleId } from 'mortise-puzzle';
import { Lightbox } from './Lightbox.tsx';
import { ITEMS, imgSrc } from './items.ts';
import { primary, secondary, useLang } from './i18n.tsx';

/** 网格里散开太多会压到邻格，所以上限比灯箱小 */
const GRID_SPREAD_MAX = 26;

/** 可选的网格尺寸 —— 展示 N×M 能力 */
const GRIDS = [
  { cols: 2, rows: 2, label: '2 × 2' },
  { cols: 3, rows: 3, label: '3 × 3' },
  { cols: 4, rows: 4, label: '4 × 4' },
  { cols: 6, rows: 4, label: '6 × 4' },
] as const;

/** 「混搭」不是一种榫卯，而是让 16 张各用一种 */
type CutChoice = CutStyleId | 'mix';

const qs = () => new URLSearchParams(window.location.search);

/** 支持 ?cut=dovetail&spread=16&open=3 深链接，方便分享某个状态 */
const initialSpread = () => {
  const v = Number(qs().get('spread'));
  return Number.isFinite(v) ? Math.min(Math.max(v, 0), GRID_SPREAD_MAX) : 0;
};
const initialCut = (): CutChoice => {
  const raw = qs().get('cut');
  if (raw === 'mix') return 'mix';
  return CUT_STYLE_IDS.includes(raw as CutStyleId) ? (raw as CutStyleId) : 'mushroom';
};
const initialGrid = () => {
  const raw = qs().get('grid');
  const hit = GRIDS.findIndex((g) => `${g.cols}x${g.rows}` === raw);
  return hit >= 0 ? hit : 0;
};
const initialOpen = () => {
  const raw = qs().get('open');
  if (raw === null) return null;
  const i = Number(raw);
  return Number.isInteger(i) && i >= 0 && i < ITEMS.length ? i : null;
};

/** 混搭模式下，第 i 张图用第 i 种榫卯 */
const cutFor = (choice: CutChoice, i: number): CutStyleId =>
  choice === 'mix' ? CUT_STYLE_IDS[i % CUT_STYLE_IDS.length]! : choice;

export default function App() {
  const { lang, toggle, t } = useLang();
  const [spread, setSpread] = useState(initialSpread);
  const [cut, setCut] = useState<CutChoice>(initialCut);
  const [gridIdx, setGridIdx] = useState(initialGrid);
  const [open, setOpen] = useState<number | null>(initialOpen);
  const grid = GRIDS[gridIdx]!;
  // 网格越密，单元格越小 —— 散开量得跟着收，否则 4×4 拆开就糊成一团
  const cellScale = 2 / Math.max(grid.cols, grid.rows);

  // 拖进来的自定义图片：证明「任意图片、任意比例」不是嘴上说的
  const [custom, setCustom] = useState<{ url: string; name: string } | null>(null);
  const [dropping, setDropping] = useState(false);

  const takeFile = (file: File | undefined | null) => {
    if (!file?.type.startsWith('image/')) return;
    setCustom((prev) => {
      if (prev) URL.revokeObjectURL(prev.url); // 换图时把上一张的 blob 放掉
      return { url: URL.createObjectURL(file), name: file.name };
    });
  };

  const items = custom
    ? [
        { no: 0, zh: custom.name, en: custom.name, src: custom.url },
        ...ITEMS.map((it) => ({ ...it, src: imgSrc(it) })),
      ]
    : ITEMS.map((it) => ({ ...it, src: imgSrc(it) }));

  const step = (d: number) =>
    setOpen((i) => (i === null ? i : (i + d + items.length) % items.length));

  return (
    <div
      className={`page${dropping ? ' page--dropping' : ''}`}
      style={{ '--drop-hint': `'${t.dropHere}'` } as CSSProperties}
      onDragOver={(e) => {
        e.preventDefault();
        setDropping(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDropping(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDropping(false);
        takeFile(e.dataTransfer.files[0]);
      }}
    >
      <main className="workbench">
        <button className="lang" onClick={toggle} aria-label="Switch language">
          {t.langToggle}
        </button>

        <header className="masthead">
          <h1>{t.title}</h1>
          <span className="masthead__en">{t.subtitle}</span>
        </header>

        <p className="lede">
          {t.ledeA}
          <br />
          {t.ledeB}
        </p>

        <div className="toolbar">
          <div className="toolbar__row">
            <span className="toolbar__label">{t.cutStyle}</span>
            <div className="cuts">
              {CUT_STYLE_IDS.map((id) => (
                <button
                  key={id}
                  className={`chip${cut === id ? ' chip--on' : ''}`}
                  onClick={() => setCut(id)}
                  title={CUT_STYLES[id].hint}
                  aria-pressed={cut === id}
                >
                  {lang === 'zh' ? CUT_STYLES[id].zh : CUT_STYLES[id].en}
                </button>
              ))}
              <button
                className={`chip chip--mix${cut === 'mix' ? ' chip--on' : ''}`}
                onClick={() => setCut('mix')}
                title={t.mixHint}
                aria-pressed={cut === 'mix'}
              >
                {t.mix}
              </button>
            </div>
          </div>

          <div className="toolbar__row">
            <span className="toolbar__label">{t.gridSize}</span>
            <div className="cuts">
              {GRIDS.map((g, i) => (
                <button
                  key={g.label}
                  className={`chip${gridIdx === i ? ' chip--on' : ''}`}
                  onClick={() => setGridIdx(i)}
                  aria-pressed={gridIdx === i}
                >
                  {g.label}
                </button>
              ))}
              <label className="chip chip--file">
                {custom ? t.changeImage : t.pickImage}
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => takeFile(e.target.files?.[0])}
                />
              </label>
            </div>
          </div>

          <div className="toolbar__row">
            <label className="slider">
              <span>{t.spread}</span>
              <input
                type="range"
                min={0}
                max={GRID_SPREAD_MAX}
                value={spread}
                onChange={(e) => setSpread(Number(e.target.value))}
                aria-label={t.spreadAria}
              />
              <em>{spread}</em>
            </label>
            <div className="toolbar__actions">
              <button className="pill" onClick={() => setSpread(spread > 0 ? 0 : 16)}>
                {spread > 0 ? t.collapseAll : t.explodeAll}
              </button>
              <a className="pill pill--ghost" href={`gallery.html?lang=${lang}`}>
                {t.gallery}
              </a>
            </div>
          </div>
        </div>

        <ul className="grid">
          {items.map((lp, i) => (
            <motion.li
              key={lp.src}
              className={`cell${lp.no === 0 ? ' cell--custom' : ''}`}
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(0.04 * i, 0.5), type: 'spring', stiffness: 220, damping: 24 }}
            >
              <button className="cell__hit" onClick={() => setOpen(i)}>
                <span className="cell__no">{lp.no === 0 ? '★' : lp.no}</span>
                <PuzzleBoard
                  src={lp.src}
                  cols={grid.cols}
                  rows={grid.rows}
                  seed={i}
                  cut={cutFor(cut, i)}
                  spread={spread * cellScale}
                  lift={spread * cellScale * 0.9}
                  lazy
                  alt={primary(lang, lp.zh, lp.en)}
                />
                <span className="cell__zh">{primary(lang, lp.zh, lp.en)}</span>
                <span className="cell__en">
                  {lp.no === 0 ? t.yourImage : secondary(lang, lp.zh, lp.en)}
                </span>
              </button>
            </motion.li>
          ))}
        </ul>

        <footer className="foot">
          <span>{t.foot(CUT_STYLE_IDS.length, grid.cols, grid.rows)}</span>
        </footer>
      </main>

      <Lightbox
        index={open}
        items={items}
        cols={grid.cols}
        rows={grid.rows}
        cellScale={cellScale}
        lang={lang}
        t={t}
        cutFor={(i) => cutFor(cut, i)}
        onClose={() => setOpen(null)}
        onStep={step}
      />
    </div>
  );
}
