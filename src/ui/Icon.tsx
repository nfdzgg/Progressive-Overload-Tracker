import type { ReactNode } from 'react';

// Line icons on a 24px grid, 1.5px stroke, colored with currentColor.
const PATHS = {
  today: (
    <>
      <path d="M3 9.5v5M21 9.5v5M6 6.5v11M18 6.5v11M6 12h12" />
      <rect x="5" y="6.5" width="2.5" height="11" rx="1" />
      <rect x="16.5" y="6.5" width="2.5" height="11" rx="1" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.75" y="5" width="16.5" height="15" rx="2" />
      <path d="M3.75 9.5h16.5M8 3v4M16 3v4" />
    </>
  ),
  progress: <path d="M4 19.5h16M5 15.5l4.5-4.5 3.5 3.5L19 8.5M15 8.5h4v4" />,
  settings: (
    <>
      <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
      <circle cx="15" cy="7" r="2" />
      <circle cx="9" cy="17" r="2" />
    </>
  ),
  notes: (
    <>
      <path d="M6.5 3.75h7.5l4 4v11.5a1 1 0 0 1-1 1H6.5a1 1 0 0 1-1-1V4.75a1 1 0 0 1 1-1Z" />
      <path d="M13.75 3.75v4.25H18M8.5 12.5h7M8.5 16h5" />
    </>
  ),
  more: (
    <>
      <circle cx="5.5" cy="12" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="18.5" cy="12" r="1" />
    </>
  ),
  close: <path d="M6 6l12 12M18 6L6 18" />,
  back: <path d="M14.5 5.5L8 12l6.5 6.5" />,
  chevronLeft: <path d="M14.5 5.5L8 12l6.5 6.5" />,
  chevronRight: <path d="M9.5 5.5L16 12l-6.5 6.5" />,
  chevronDown: <path d="M5.5 9.5L12 16l6.5-6.5" />,
  chevronUp: <path d="M5.5 14.5L12 8l6.5 6.5" />,
  plus: <path d="M12 5v14M5 12h14" />,
  arrowUp: <path d="M12 19V5M6 11l6-6 6 6" />,
  arrowDown: <path d="M12 5v14M6 13l6 6 6-6" />,
  trash: (
    <>
      <path d="M4.5 7h15M9.5 7V4.75h5V7M6.5 7l.75 12.25a1 1 0 0 0 1 .95h7.5a1 1 0 0 0 1-.95L17.5 7" />
      <path d="M10 11v5.5M14 11v5.5" />
    </>
  ),
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  edit: (
    <>
      <path d="M15.5 4.5l4 4L9 19H5v-4L15.5 4.5Z" />
      <path d="M13 7l4 4" />
    </>
  ),
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof PATHS;

export const ICON_NAMES = Object.keys(PATHS) as IconName[];

export interface IconProps {
  name: IconName;
  /** `card` is 20px (icons in cards), `tab` is 24px (tab bar). */
  size?: 'card' | 'tab';
  className?: string;
}

export function Icon({ name, size = 'card', className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size === 'tab' ? 24 : 20}
      height={size === 'tab' ? 24 : 20}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
      data-icon={name}
    >
      {PATHS[name]}
    </svg>
  );
}
