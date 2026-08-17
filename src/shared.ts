/**
 * 渲染层共用的内部工具（React / Vue 各自的组件都用它，不属于公共 API）。
 */

/**
 * 路径生成用的基准宽度。显示尺寸靠 scale 贴合容器，所以一副路径能用在任何尺寸上；
 * 高度按图片真实比例算出来，于是任意宽高比的图都不会被拉伸。
 */
export const BASE = 400;

/**
 * 每片的 Z 轴错落系数，让「炸开」时有前后层次。
 * 从索引派生的确定性伪随机 —— 任意网格尺寸都够用，且同一片每次都一样。
 */
export const zStep = (i: number) => ((Math.imul(i + 1, 2654435761) >>> 8) % 1000) / 1000;

/**
 * 图片地址要经过 CSS 自定义属性（--mp-img）传给 background-image 和 mask-image，
 * 而 Chrome 解析自定义属性里的相对 url() 时，基准是**引用它的样式表**而不是文档 ——
 * 打包后样式表在 /assets/ 下，'img/a.png' 就成了 '/assets/img/a.png'（404），
 * 于是拼片彻底不可见。先转成绝对地址，绕开这个坑。
 */
export function toAbsolute(src: string): string {
  if (typeof document === 'undefined') return src; // SSR
  try {
    return new URL(src, document.baseURI).href;
  } catch {
    return src;
  }
}

/** 同一张图只探测一次，避免多张各自触发一次二次布局 */
const aspectCache = new Map<string, number>();

export const cachedAspect = (src: string) => aspectCache.get(src);

/**
 * 异步读图片的真实宽高比。返回取消函数 —— 组件卸载或换图时调用，
 * 避免迟到的 onload 写进已经过期的状态。
 */
export function probeAspect(src: string, onDone: (aspect: number) => void): () => void {
  if (aspectCache.has(src)) return () => {};
  let alive = true;
  const img = new Image();
  img.onload = () => {
    if (!img.naturalWidth || !img.naturalHeight) return;
    const a = img.naturalWidth / img.naturalHeight;
    aspectCache.set(src, a);
    if (alive) onDone(a);
  };
  img.src = src;
  return () => {
    alive = false;
  };
}

/** 把 baseW × baseH 装进容器所需的缩放比：两个方向取较小值 */
export const fitScale = (width: number, height: number, baseW: number, baseH: number) =>
  Math.min(width / baseW, height / baseH);
