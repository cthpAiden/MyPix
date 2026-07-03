/**
 * Tool-module contract (contracts/engine.md). Each src/modules/<domain>/
 * exports a ToolModule the editor shell registers. A module's only side-effect
 * channel is engine.dispatch(); it never touches GL/Fabric/persistence and
 * never imports a sibling module (Constitution V, enforced by lint T005).
 */
import type { ComponentType, ReactNode } from 'react';
import type { Engine } from '@/engine';
import type { Locale } from '@/i18n/routing';

export type Availability = 'available' | { unavailable: string };

export interface ToolContext {
  engine: Engine;
  landmarks: null; // Phase 2 fills DetectedLandmarkSet
  locale: Locale;
}

export interface ToolModule {
  id: string;
  titleKey: string;
  phase: 1 | 2 | 3;
  Icon: ComponentType<{ className?: string }>;
  isAvailable?: (ctx: ToolContext) => Availability;
  Panel: (props: { ctx: ToolContext }) => ReactNode;
  requiredVision?: ('face' | 'pose' | 'segmentation')[];
}
