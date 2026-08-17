/**
 * mortise-puzzle —— 榫卯拼图切割算法
 *
 * 这个入口零依赖、不碰 DOM，可以在任何框架或 Node 里用。
 * React 组件在 'mortise-puzzle/react'，配套样式在 'mortise-puzzle/styles.css'。
 */
export { makePuzzle, CUT_STYLES, CUT_STYLE_IDS } from './cut';
export type { CutStyle, CutStyleId, EdgeCmd, Piece, Pt, Puzzle } from './cut';
