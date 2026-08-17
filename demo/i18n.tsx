import { useCallback, useEffect, useState } from 'react';

export type Lang = 'en' | 'zh';

/** 默认英文 —— 包是给国际使用者看的 */
const DEFAULT_LANG: Lang = 'en';
const STORE_KEY = 'mortise-puzzle:lang';

export interface Strings {
  title: string;
  subtitle: string;
  ledeA: React.ReactNode;
  ledeB: React.ReactNode;
  cutStyle: string;
  gridSize: string;
  spread: string;
  spreadAria: string;
  mix: string;
  mixHint: string;
  pickImage: string;
  changeImage: string;
  explodeAll: string;
  collapseAll: string;
  gallery: string;
  dropHere: string;
  yourImage: string;
  /** footer：N 种榫卯 · 每副 c × r = 几片 */
  foot: (styles: number, cols: number, rows: number) => string;
  /** 灯箱 */
  explodeN: (n: number) => string;
  collapse: string;
  lbHint: string;
  lbNo: (no: number) => string;
  langToggle: string;
}

const EN: Strings = {
  title: 'Mortise & Tenon',
  subtitle: 'mortise-puzzle · cut any image into a jigsaw',
  ledeA: (
    <>
      A handful of felted scenes, each cut with <b>its own tenon directions</b>. Every cut line
      grows a tenon, and adjacent pieces share the identical curve (one forward, one reversed)
      — so they go back together <b>perfectly flush</b>. Each piece is carved by{' '}
      <code>clip-path</code> and extruded into pseudo-3D by chained <code>drop-shadow</code>.
    </>
  ),
  ledeB: (
    <>
      <b>Drop any image onto this page</b> to cut it instantly — landscape or portrait, the
      tenons never get stretched.
    </>
  ),
  cutStyle: 'Tenon style',
  gridSize: 'Grid size',
  spread: 'Spread',
  spreadAria: 'Spread distance',
  mix: 'Mix',
  mixHint: 'A different tenon style for every image',
  pickImage: 'Drop / pick image',
  changeImage: 'Change image',
  explodeAll: 'Explode all',
  collapseAll: 'Collapse all',
  gallery: 'Full images →',
  dropHere: 'Drop to cut it into a jigsaw',
  yourImage: 'Your image',
  foot: (styles, cols, rows) =>
    `${styles} tenon styles · ${cols} × ${rows} = ${cols * rows} pieces each`,
  explodeN: (n) => `Take apart (${n})`,
  collapse: 'Put back',
  lbHint: 'Move mouse to tilt · Space to take apart · ← → to switch · Esc to close',
  lbNo: (no) => `No. ${String(no).padStart(2, '0')}`,
  langToggle: '中文',
};

const ZH: Strings = {
  title: '榫卯拼图',
  subtitle: 'mortise-puzzle · 把任意图片切成拼图',
  ledeA: (
    <>
      一组羊毛毡小场景，各按<b>一种独立切法</b>裁开。切割线中央长出榫头，相邻两片共享
      同一条曲线（一正一反），所以拼回去<b>严丝合缝</b>。每一片都是 <code>clip-path</code>{' '}
      裁形、靠链式 <code>drop-shadow</code> 挤出侧壁的伪 3D。
    </>
  ),
  ledeB: (
    <>
      <b>把任意图片拖进这个页面</b>，立刻切给你看 —— 横图竖图都不会被拉变形。
    </>
  ),
  cutStyle: '榫卯样式',
  gridSize: '网格尺寸',
  spread: '整体散开',
  spreadAria: '整体散开距离',
  mix: '混搭',
  mixHint: '每张图各用一种榫卯',
  pickImage: '拖入 / 选图',
  changeImage: '换一张图',
  explodeAll: '全部拆开',
  collapseAll: '全部合拢',
  gallery: '整图画廊 →',
  dropHere: '松手即可切成榫卯拼图',
  yourImage: '你的图片',
  foot: (styles, cols, rows) => `${styles} 种榫卯 · 每副 ${cols} × ${rows} = ${cols * rows} 片`,
  explodeN: (n) => `拆开 ${n} 片`,
  collapse: '合拢',
  lbHint: '移动鼠标转视角 · 空格拆合 · ← → 换图 · Esc 关闭',
  lbNo: (no) => `第 ${String(no).padStart(2, '0')} 条`,
  langToggle: 'EN',
};

const TABLE: Record<Lang, Strings> = { en: EN, zh: ZH };

const readInitial = (): Lang => {
  const fromUrl = new URLSearchParams(window.location.search).get('lang');
  if (fromUrl === 'en' || fromUrl === 'zh') return fromUrl;
  const saved = localStorage.getItem(STORE_KEY);
  return saved === 'en' || saved === 'zh' ? saved : DEFAULT_LANG;
};

/**
 * 语言状态。优先级：?lang= > localStorage > 默认英文。
 * 同时把语言同步到 <html lang> 和 data-lang（CSS 靠它切字体）。
 */
export function useLang() {
  const [lang, setLangState] = useState<Lang>(readInitial);

  useEffect(() => {
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
    document.documentElement.dataset.lang = lang;
    localStorage.setItem(STORE_KEY, lang);
  }, [lang]);

  const setLang = useCallback((next: Lang) => setLangState(next), []);
  const toggle = useCallback(() => setLangState((l) => (l === 'en' ? 'zh' : 'en')), []);

  return { lang, setLang, toggle, t: TABLE[lang] };
}

/** 条目的主 / 次标题：当前语言当主，另一种语言当副标题，信息不丢 */
export const primary = (lang: Lang, zh: string, en: string) => (lang === 'zh' ? zh : en);
export const secondary = (lang: Lang, zh: string, en: string) => (lang === 'zh' ? en : zh);
