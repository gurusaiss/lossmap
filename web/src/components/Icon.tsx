import type { SVGProps } from 'react';

// Small hand-rolled line icons (no icon font/library): consistent 1.75px stroke, 24px viewBox, inherits text colour.
// Replaces ad-hoc emoji (➕ ▦ ← ⬆ ✓) whose glyph shape and weight vary by OS/browser and look inconsistent next to Inter.
const base: SVGProps<SVGSVGElement> = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.75, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };
const cn = (className?: string) => `inline-block shrink-0 align-[-0.125em] ${className ?? 'size-5'}`;

export const PlusIcon = ({ className }: { className?: string }) => (
  <svg {...base} className={cn(className)}><path d="M12 5v14M5 12h14" /></svg>
);
export const ScanIcon = ({ className }: { className?: string }) => (
  <svg {...base} className={cn(className)}>
    <path d="M4 8V6a2 2 0 0 1 2-2h2M4 16v2a2 2 0 0 0 2 2h2M20 8V6a2 2 0 0 0-2-2h-2M20 16v2a2 2 0 0 1-2 2h-2" />
    <path d="M4 12h16" />
  </svg>
);
export const ArrowLeftIcon = ({ className }: { className?: string }) => (
  <svg {...base} className={cn(className)}><path d="M19 12H5M11 18l-6-6 6-6" /></svg>
);
export const ArrowUpIcon = ({ className }: { className?: string }) => (
  <svg {...base} className={cn(className)}><path d="M12 19V5M5 12l7-7 7 7" /></svg>
);
export const CheckIcon = ({ className }: { className?: string }) => (
  <svg {...base} className={cn(className)}><path d="M20 6 9 17l-5-5" /></svg>
);
export const CameraIcon = ({ className }: { className?: string }) => (
  <svg {...base} className={cn(className)}>
    <path d="M4 8a2 2 0 0 1 2-2h1.5l1-1.5h7l1 1.5H18a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
    <circle cx="12" cy="13" r="3.25" />
  </svg>
);
