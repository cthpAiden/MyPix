import { createNavigation } from 'next-intl/navigation';
import { routing } from './routing';

/** Locale-aware navigation helpers (used by the visible EN/VI toggle). */
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
