import type { SVGProps } from 'react';

type NavIconProps = SVGProps<SVGSVGElement>;

/** Party room layout: host seat above a guest seat row. */
export function PartyRoomIcon({ className, ...props }: NavIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
      {...props}
    >
      <rect x="3.5" y="3" width="17" height="18" rx="5" />
      <circle cx="12" cy="8" r="2.2" fill="currentColor" stroke="none" />
      <circle cx="7.2" cy="14.8" r="1.5" />
      <circle cx="11" cy="15.8" r="1.5" />
      <circle cx="15" cy="15.8" r="1.5" />
      <circle cx="18.8" cy="14.8" r="1.5" />
      <path d="M6.2 17.8h11.6" />
      <path d="M8.2 17.8v1.4M12 17.8v1.4M15.8 17.8v1.4" />
      <path d="M12 10.2v2.2" strokeWidth="1.5" />
    </svg>
  );
}
