/** Minimal bespoke line icons (Darkroom). Stroke = currentColor. */
import type { SVGProps } from 'react';

type P = { className?: string } & SVGProps<SVGSVGElement>;
function base(props: P) {
  return {
    width: 22,
    height: 22,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.7,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    ...props,
  };
}

export const AdjustIcon = (p: P) => (
  <svg {...base(p)}>
    <line x1="4" y1="7" x2="20" y2="7" />
    <circle cx="9" cy="7" r="2.2" />
    <line x1="4" y1="17" x2="20" y2="17" />
    <circle cx="15" cy="17" r="2.2" />
  </svg>
);

export const CropIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M7 2v15h15" />
    <path d="M2 7h15v15" />
  </svg>
);

export const FilterIcon = (p: P) => (
  <svg {...base(p)}>
    <circle cx="9" cy="9" r="5" />
    <circle cx="15" cy="15" r="5" />
  </svg>
);

export const CurvesIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 20 C 10 20 8 4 20 4" />
    <line x1="4" y1="20" x2="4" y2="4" />
    <line x1="4" y1="20" x2="20" y2="20" />
  </svg>
);

export const ColorIcon = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 3.5 A8.5 8.5 0 0 1 12 20.5" fill="currentColor" stroke="none" opacity="0.25" />
  </svg>
);

export const WhiteBalanceIcon = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="4" />
    <line x1="12" y1="2" x2="12" y2="5" />
    <line x1="12" y1="19" x2="12" y2="22" />
    <line x1="2" y1="12" x2="5" y2="12" />
    <line x1="19" y1="12" x2="22" y2="12" />
  </svg>
);

export const FinishingIcon = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="4.5" opacity="0.5" />
  </svg>
);

export const PresetIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 5h16" />
    <path d="M4 12h16" />
    <path d="M4 19h10" />
    <circle cx="18" cy="19" r="2" fill="currentColor" stroke="none" />
  </svg>
);

export const UndoIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M9 7 4 12l5 5" />
    <path d="M4 12h11a5 5 0 0 1 0 10h-3" />
  </svg>
);

export const RedoIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M15 7l5 5-5 5" />
    <path d="M20 12H9a5 5 0 0 0 0 10h3" />
  </svg>
);

export const CompareIcon = (p: P) => (
  <svg {...base(p)}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <line x1="12" y1="4" x2="12" y2="20" />
  </svg>
);

export const ExportIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 15V3" />
    <path d="M8 7l4-4 4 4" />
    <path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" />
  </svg>
);

export const ShareIcon = (p: P) => (
  <svg {...base(p)}>
    <circle cx="6" cy="12" r="2.5" />
    <circle cx="18" cy="6" r="2.5" />
    <circle cx="18" cy="18" r="2.5" />
    <line x1="8.2" y1="10.8" x2="15.8" y2="7.2" />
    <line x1="8.2" y1="13.2" x2="15.8" y2="16.8" />
  </svg>
);

export const DownloadIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 3v12" />
    <path d="M8 11l4 4 4-4" />
    <path d="M4 19h16" />
  </svg>
);

export const CloseIcon = (p: P) => (
  <svg {...base(p)}>
    <line x1="6" y1="6" x2="18" y2="18" />
    <line x1="18" y1="6" x2="6" y2="18" />
  </svg>
);

export const CheckIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M5 13l4 4L19 7" />
  </svg>
);

export const PlusIcon = (p: P) => (
  <svg {...base(p)}>
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

export const ImportIcon = (p: P) => (
  <svg {...base(p)}>
    <rect x="3" y="6" width="18" height="14" rx="2.5" />
    <path d="M3 16l4.5-4.5a2 2 0 0 1 2.8 0L15 16" />
    <path d="M14 14l1.7-1.7a2 2 0 0 1 2.8 0L21 15" />
    <circle cx="8.5" cy="10" r="1.3" fill="currentColor" stroke="none" />
    <path d="M12 2v3M10.5 3.5 12 5l1.5-1.5" />
  </svg>
);
