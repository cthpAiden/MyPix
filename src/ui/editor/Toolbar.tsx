'use client';

/** Tool switcher shown in the ToolSheet header (T028). */
import { useTranslations } from 'next-intl';
import { haptic } from '@/ui/feedback';
import type { ToolModule } from '@/ui/toolModule';

export function Toolbar({
  modules,
  activeId,
  onSelect,
}: {
  modules: ToolModule[];
  activeId: string;
  onSelect: (id: string) => void;
}) {
  const t = useTranslations();
  return (
    <div className="flex gap-1 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {modules.map((m) => {
        const active = m.id === activeId;
        return (
          <button
            key={m.id}
            onPointerDown={() => {
              haptic();
              onSelect(m.id);
            }}
            aria-pressed={active}
            className={[
              'flex min-w-16 flex-col items-center gap-1 rounded-[var(--radius-control)] px-2.5 py-2 text-[11px] transition-colors',
              active ? 'text-safelight' : 'text-ink-mute hover:text-ink',
            ].join(' ')}
          >
            <m.Icon className="h-5 w-5" />
            <span className="whitespace-nowrap">{t(m.titleKey)}</span>
          </button>
        );
      })}
    </div>
  );
}
