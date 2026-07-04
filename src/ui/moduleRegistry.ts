/**
 * Tool-module registry (T028). The editor shell registers these and renders
 * each module's Panel in the ToolSheet. Order defines the toolbar order.
 * (This file lives in ui/, so importing modules is allowed — only *modules*
 * may not import sibling modules; Constitution V.)
 */
import { adjustModule } from '@/modules/adjust';
import { cropModule } from '@/modules/crop';
import { curvesModule } from '@/modules/adjust/curves';
import { colorModule } from '@/modules/adjust/color';
import { whiteBalanceModule } from '@/modules/adjust/whiteBalance';
import { filtersModule } from '@/modules/filters';
import { finishingModule } from '@/modules/filters/finishing';
import { presetsModule } from '@/modules/presets';
import { faceModule } from '@/modules/face';
import { skinModule } from '@/modules/skin';
import { targetedModule } from '@/modules/face/targeted';
import { bodyModule } from '@/modules/body';
import { warpModule } from '@/modules/warp';
import { backgroundModule } from '@/modules/background';
import { makeupModule } from '@/modules/makeup';
import { textModule } from '@/modules/text';
import { stickersModule } from '@/modules/stickers';
import { framesModule } from '@/modules/frames';
import { retouchModule } from '@/modules/retouch';
import { blendModule } from '@/modules/blend';
import { drawModule } from '@/modules/draw';
import type { ToolModule } from './toolModule';

export const toolModules: ToolModule[] = [
  // Phase 1 — core adjustments
  adjustModule,
  cropModule,
  curvesModule,
  colorModule,
  whiteBalanceModule,
  filtersModule,
  finishingModule,
  presetsModule,
  // Phase 2 — face & body intelligence
  faceModule,
  skinModule,
  targetedModule,
  bodyModule,
  warpModule,
  backgroundModule,
  // Phase 3 — creative & makeup layer
  makeupModule,
  textModule,
  stickersModule,
  framesModule,
  retouchModule,
  blendModule,
  drawModule,
];
