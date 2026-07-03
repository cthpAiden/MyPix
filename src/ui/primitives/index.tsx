'use client';

/**
 * Darkroom design-system primitives (T023, research R15). Bespoke — no
 * component library. Layered surfaces, a single amber safelight accent for
 * active state, off-white type, ledger (tabular) numerals for readouts.
 */
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { haptic } from '@/ui/feedback';

function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

export function Surface({
  level = 1,
  className,
  children,
}: {
  level?: 1 | 2 | 3;
  className?: string;
  children: ReactNode;
}) {
  const bg = level === 3 ? 'bg-surface-3' : level === 2 ? 'bg-surface-2' : 'bg-surface-1';
  return <div className={cx(bg, 'rounded-[var(--radius-panel)]', className)}>{children}</div>;
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'danger';
  active?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'ghost', active = false, className, onPointerDown, children, ...rest },
  ref,
) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] px-4 py-2.5 text-sm font-medium transition-colors select-none touch-manipulation disabled:opacity-40';
  const styles =
    variant === 'primary'
      ? 'bg-safelight text-stage hover:bg-safelight/90'
      : variant === 'danger'
        ? 'text-danger hover:bg-surface-3'
        : active
          ? 'bg-surface-3 text-safelight'
          : 'text-ink-soft hover:bg-surface-2 hover:text-ink';
  return (
    <button
      ref={ref}
      className={cx(base, styles, className)}
      onPointerDown={(e) => {
        haptic();
        onPointerDown?.(e);
      }}
      {...rest}
    >
      {children}
    </button>
  );
});

export function IconButton({
  label,
  active,
  className,
  children,
  ...rest
}: ButtonProps & { label: string }) {
  return (
    <Button
      aria-label={label}
      active={active}
      className={cx('h-11 w-11 !px-0', className)}
      {...rest}
    >
      {children}
    </Button>
  );
}

/** Ledger-style value readout with tabular numerals. */
export function Readout({
  value,
  label,
  large = false,
}: {
  value: string | number;
  label?: string;
  large?: boolean;
}) {
  return (
    <div className="flex flex-col items-center leading-none">
      {label && (
        <span className="text-[11px] uppercase tracking-widest text-ink-mute">{label}</span>
      )}
      <span
        className={cx(
          'tnum text-ink',
          large ? 'text-5xl font-semibold' : 'text-base font-medium',
        )}
      >
        {value}
      </span>
    </div>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div className={cx('flex gap-1 rounded-[var(--radius-control)] bg-surface-1 p-1', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          onPointerDown={() => {
            haptic();
            onChange(o.value);
          }}
          className={cx(
            'flex-1 rounded-[10px] px-3 py-2 text-sm transition-colors select-none',
            value === o.value ? 'bg-surface-3 text-safelight' : 'text-ink-mute hover:text-ink',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Labelled 0…100 range slider with a tabular readout (Phase 2 tools). */
export function Slider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="flex justify-between text-[11px] uppercase tracking-wide text-ink-mute">
        <span>{label}</span>
        <span className="tnum text-ink-soft">{Math.round(value * 100)}</span>
      </span>
      <input
        type="range"
        min={0}
        max={100}
        value={Math.round(value * 100)}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        className="w-full accent-safelight"
      />
    </label>
  );
}

export function Chip({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick?: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onPointerDown={() => {
        haptic();
        onClick?.();
      }}
      className={cx(
        'whitespace-nowrap rounded-full border px-3.5 py-2 text-sm transition-colors select-none',
        active
          ? 'border-safelight text-safelight'
          : 'border-hairline text-ink-mute hover:text-ink',
      )}
    >
      {children}
    </button>
  );
}
