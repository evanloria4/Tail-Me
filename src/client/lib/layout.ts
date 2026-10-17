// Pages with a side column (feed, profiles).
//   phones/tablets: one column (the feed hides its side column)
//   lg (1024px+):   content + an 18rem side column, side by side
//   xl (1280px+):   content centered on the screen, side column to its right,
//                   with an empty column on the left balancing it
// Put the main content in `xl:col-start-2`.

export const PAGE_GRID =
  'mx-auto max-w-2xl lg:grid lg:max-w-5xl lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-x-6 xl:max-w-none xl:grid-cols-[1fr_minmax(0,42rem)_1fr]';

export const SIDE_COLUMN =
  'side-column lg:col-start-2 xl:col-start-3 xl:w-72 xl:max-w-full';
