'use client';

/**
 * Multi-face picker (US2.1, T065). Shown only when more than one face is
 * detected; selecting one points the landmark-dependent tools at it (FR-203).
 */
import { useTranslations } from 'next-intl';
import { Chip } from '@/ui/primitives';
import type { Engine } from '@/engine';
import type { DetectedLandmarkSet } from '@/vision/types';

export function FaceSelect({
  engine,
  landmarks,
}: {
  engine: Engine;
  landmarks: DetectedLandmarkSet;
}) {
  const t = useTranslations('tools.face');
  if (landmarks.faces.length <= 1) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {landmarks.faces.map((_, i) => (
        <Chip
          key={i}
          active={i === landmarks.selectedFaceIndex}
          onClick={() => engine.selectFace(i)}
        >
          {t('faceN', { n: i + 1 })}
        </Chip>
      ))}
    </div>
  );
}
