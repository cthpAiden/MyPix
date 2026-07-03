'use client';

/**
 * Recipes module (US1.6, T049). Save/apply/rename/delete named recipes and
 * export/import a shareable MYPIX1 code.
 */
import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { PresetIcon } from '@/ui/icons';
import { Button, Surface } from '@/ui/primitives';
import { useEditState } from '@/ui/useEngine';
import {
  deletePreset,
  exportPresetCode,
  importPresetCode,
  listPresets,
  savePreset,
} from '@/persistence/presets';
import { PresetCodeError } from '@/persistence/presetCode';
import type { Preset } from '@/persistence/types';
import type { ToolContext, ToolModule } from '@/ui/toolModule';

function PresetsPanel({ ctx }: { ctx: ToolContext }) {
  const t = useTranslations('tools.presets');
  const tErr = useTranslations('errors');
  const state = useEditState(ctx.engine);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');

  const refresh = useCallback(() => listPresets().then(setPresets), []);
  useEffect(() => {
    refresh();
  }, [refresh]);

  const onSave = async () => {
    await savePreset(name, state.operations);
    setName('');
    refresh();
  };

  const onApply = (p: Preset) => {
    ctx.engine.dispatch({ kind: 'preset/apply', operations: p.operations });
    setMessage(t('applied'));
  };

  const onDelete = async (id: string) => {
    await deletePreset(id);
    refresh();
  };

  const onShare = async (p: Preset) => {
    const shareCode = await exportPresetCode(p);
    try {
      await navigator.clipboard.writeText(shareCode);
      setMessage(t('codeCopied'));
    } catch {
      setCode(shareCode);
    }
  };

  const onImport = async () => {
    try {
      await importPresetCode(code);
      setCode('');
      setMessage('');
      refresh();
    } catch (e) {
      void (e instanceof PresetCodeError ? e.code : 'invalid-code');
      setMessage(tErr('generic'));
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('namePlaceholder')}
          className="min-w-0 flex-1 rounded-[var(--radius-control)] bg-surface-1 px-3 py-2.5 text-sm text-ink outline-none placeholder:text-ink-faint"
        />
        <Button variant="primary" onPointerDown={onSave} disabled={state.operations.length === 0}>
          {t('save')}
        </Button>
      </div>

      {message && <p className="text-xs text-safelight">{message}</p>}

      {presets.length === 0 ? (
        <p className="py-4 text-sm text-ink-mute">{t('empty')}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {presets.map((p) => (
            <Surface key={p.id} level={2} className="flex items-center gap-2 px-3 py-2">
              <span className="min-w-0 flex-1 truncate text-sm text-ink">{p.name}</span>
              <Button onPointerDown={() => onApply(p)}>{t('apply')}</Button>
              <Button onPointerDown={() => onShare(p)}>{t('shareCode')}</Button>
              <Button variant="danger" onPointerDown={() => onDelete(p.id)}>
                {t('delete')}
              </Button>
            </Surface>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="MYPIX1.…"
          className="min-w-0 flex-1 rounded-[var(--radius-control)] bg-surface-1 px-3 py-2.5 font-mono text-xs text-ink outline-none placeholder:text-ink-faint"
        />
        <Button onPointerDown={onImport} disabled={!code.startsWith('MYPIX1.')}>
          {t('importCode')}
        </Button>
      </div>
    </div>
  );
}

export const presetsModule: ToolModule = {
  id: 'presets',
  titleKey: 'toolbar.presets',
  phase: 1,
  Icon: PresetIcon,
  Panel: PresetsPanel,
};
