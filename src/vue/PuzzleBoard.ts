import {
  computed,
  defineComponent,
  h,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
  type PropType,
} from 'vue';
import { makePuzzle, type CutStyleId } from '../cut';
import { BASE, cachedAspect, fitScale, probeAspect, toAbsolute, zStep } from '../shared';

/**
 * 把一张图切成 cols × rows 榫卯拼图，每片用 CSS 渲染成伪 3D。
 *
 * 用渲染函数写成，不含 SFC —— 使用方不需要任何额外的构建插件。
 * 组件不依赖动画库；想加 3D 视角，在外面套一层带 rotateX / rotateY 的容器即可
 * （父级给 perspective、该层给 transform-style: preserve-3d）。
 *
 * 记得引入样式：import 'mortise-puzzle/styles.css'
 */
export const PuzzleBoard = defineComponent({
  name: 'PuzzleBoard',
  props: {
    /** 图片地址。带透明通道也没问题 —— 光照与切口会按 alpha 遮罩 */
    src: { type: String, required: true },
    /** 列数 */
    cols: { type: Number, default: 2 },
    /** 行数 */
    rows: { type: Number, default: 2 },
    /** 榫头朝向的种子；同样的入参永远切出同样的拼图 */
    seed: { type: Number, default: 0 },
    /** 榫头样式，见 CUT_STYLES */
    cut: { type: String as PropType<CutStyleId>, default: 'mushroom' },
    /** 拼片朝外散开的距离（基准坐标系下的 px，会跟着缩放） */
    spread: { type: Number, default: 0 },
    /** 散开时的抬升幅度，营造前后层次 */
    lift: { type: Number, default: 0 },
    /**
     * contain = 容器保持外部给定的形状，图按比例居中留白
     * exact   = 容器跟着图片比例走
     */
    fit: { type: String as PropType<'contain' | 'exact'>, default: 'contain' },
    /** 只在滚进视口附近（提前 200px）时才渲染拼片 */
    lazy: { type: Boolean, default: false },
    /** 无障碍描述 */
    alt: { type: String, default: undefined },
  },
  setup(props) {
    const root = ref<HTMLElement | null>(null);
    const imgUrl = computed(() => toAbsolute(props.src));
    const aspect = ref(cachedAspect(imgUrl.value) ?? 1);
    const scale = ref(0);
    const seen = ref(!props.lazy);

    const boardH = computed(() => Math.round(BASE / aspect.value));
    const puzzle = computed(() =>
      makePuzzle(BASE, boardH.value, {
        cols: props.cols,
        rows: props.rows,
        seed: props.seed,
        style: props.cut,
      }),
    );

    let cancelProbe: (() => void) | null = null;
    let ro: ResizeObserver | null = null;
    let io: IntersectionObserver | null = null;

    const measure = () => {
      const el = root.value;
      if (!el) return;
      const { width, height } = el.getBoundingClientRect();
      if (width > 0 && height > 0) scale.value = fitScale(width, height, BASE, boardH.value);
    };

    // 换图时重新探测比例；缓存命中就直接用，不会闪
    watch(
      imgUrl,
      (url) => {
        cancelProbe?.();
        const known = cachedAspect(url);
        if (known) {
          aspect.value = known;
          return;
        }
        cancelProbe = probeAspect(url, (a) => {
          aspect.value = a;
        });
      },
      { immediate: true },
    );

    // 高度随比例变化后要重新贴合
    watch(boardH, measure);

    onMounted(() => {
      measure();
      ro = new ResizeObserver(measure);
      if (root.value) ro.observe(root.value);

      if (props.lazy && root.value) {
        io = new IntersectionObserver(
          (entries) => {
            if (entries.some((e) => e.isIntersecting)) {
              seen.value = true;
              io?.disconnect(); // 一次性：露过面就不再收回
              io = null;
            }
          },
          { rootMargin: '200px' },
        );
        io.observe(root.value);
      }
    });

    onBeforeUnmount(() => {
      cancelProbe?.();
      ro?.disconnect();
      io?.disconnect();
    });

    return () =>
      h(
        'div',
        {
          ref: root,
          class: 'mp-slot',
          role: 'img',
          'aria-label': props.alt,
          style: {
            '--mp-spread-base': `${props.spread}px`,
            ...(props.fit === 'exact' ? { aspectRatio: String(aspect.value) } : null),
          },
        },
        seen.value
          ? [
              h(
                'div',
                {
                  class: 'mp-board',
                  style: {
                    width: `${BASE}px`,
                    height: `${boardH.value}px`,
                    marginLeft: `${-BASE / 2}px`,
                    marginTop: `${-boardH.value / 2}px`,
                    transform: `scale(${scale.value})`,
                    // 量到尺寸之前不显示，避免闪一下未缩放的基准尺寸
                    visibility: scale.value === 0 ? 'hidden' : undefined,
                  },
                },
                puzzle.value.pieces.map((p, i) =>
                  h(
                    'div',
                    {
                      key: p.key,
                      class: `mp-piece mp-piece--${p.key}`,
                      style: {
                        '--mp-ox': String(p.ox),
                        '--mp-oy': String(p.oy),
                        '--mp-z-base': `${props.lift * zStep(i)}px`,
                        // 顶面、光照层、切口线都要按图片 alpha 遮罩，所以挂在父级共用
                        '--mp-img': `url("${imgUrl.value}")`,
                      },
                    },
                    [
                      h('div', {
                        class: 'mp-piece__face',
                        style: { clipPath: `path("${p.d}")` },
                      }),
                      h(
                        'svg',
                        {
                          class: 'mp-piece__seam',
                          viewBox: `0 0 ${BASE} ${boardH.value}`,
                          style: { clipPath: `path("${p.d}")` },
                          'aria-hidden': 'true',
                        },
                        [
                          h('path', {
                            class: 'mp-seam mp-seam--hi',
                            d: p.d,
                            transform: 'translate(0 2)',
                          }),
                          h('path', { class: 'mp-seam mp-seam--lo', d: p.d }),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ]
          : [],
      );
  },
});
