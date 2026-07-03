'use client';

/**
 * Before/after compare (US1.7, T052). Press-and-hold "peek at the negative"
 * and a toggleable before/after divider, both wired to engine.setCompareMode.
 */
import { useTranslations } from 'next-intl';
import { IconButton } from '@/ui/primitives';
import { CompareIcon } from '@/ui/icons';
import { useCompare } from '@/ui/useCompare';
import type { Engine } from '@/engine';

export function Compare({ engine }: { engine: Engine }) {
  const t = useTranslations('compare');
  const c = useCompare(engine);

  return (
    <div className="flex items-center gap-2">
      <IconButton
        label={t('hold')}
        {...c.holdHandlers}
        active={false}
        title={t('hold')}
      >
        <CompareIcon />
      </IconButton>
      <button
        onPointerDown={() => c.enableDivider(!c.dividerActive)}
        aria-pressed={c.dividerActive}
        className={[
          'rounded-[var(--radius-control)] px-2.5 py-1.5 text-xs',
          c.dividerActive ? 'bg-surface-3 text-safelight' : 'text-ink-mute',
        ].join(' ')}
      >
        ½
      </button>
      {c.dividerActive && (
        <input
          type="range"
          min={0}
          max={1}
          step={0.005}
          value={c.divider}
          onChange={(e) => c.moveDivider(Number(e.target.value))}
          aria-label={t('before') + ' / ' + t('after')}
          className="h-1 w-28 accent-[var(--color-safelight)]"
        />
      )}
    </div>
  );
}
