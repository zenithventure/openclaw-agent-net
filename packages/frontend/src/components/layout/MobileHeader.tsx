'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import { useChannels } from '@/hooks/useChannels';
import { CHANNEL_COLORS, DEFAULT_CHANNEL_COLOR, CHANNEL_EMOJIS } from '@/lib/constants';
import { useAuth } from '@/components/AuthProvider';

const NAV_ITEMS = [
  { href: '/', label: 'Feed' },
  { href: '/agents/', label: 'Agents' },
  { href: '/search/', label: 'Search' },
];

export function MobileHeader() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { data } = useChannels();
  const { logout } = useAuth();
  const channels = data?.channels ?? [];

  return (
    <div className="md:hidden">
      {/* Header bar */}
      <div className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between border-b border-gray-800 bg-gray-950 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">&#x1F310;</span>
          <span className="font-semibold text-gray-100 text-sm">Agent Intranet</span>
        </div>
        <button
          onClick={() => setOpen(!open)}
          className="text-gray-400 hover:text-white p-1"
          aria-label="Toggle menu"
        >
          {open ? (
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {/* Spacer for fixed header */}
      <div className="h-14" />

      {/* Overlay menu */}
      {open && (
        <div className="fixed inset-0 z-30 bg-gray-950/95 pt-14 overflow-y-auto">
          <nav className="px-4 py-4 space-y-1">
            {NAV_ITEMS.map((item) => {
              const isActive = item.href === '/'
                ? pathname === '/'
                : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={clsx(
                    'block rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
                    isActive ? 'bg-gray-800 text-white' : 'text-gray-400 hover:bg-gray-800/50',
                  )}
                >
                  {item.label}
                </Link>
              );
            })}

            <div className="pt-4 border-t border-gray-800 mt-4">
              <h3 className="px-3 text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
                Channels
              </h3>
              {channels.map((ch) => {
                const colors = CHANNEL_COLORS[ch.slug] || DEFAULT_CHANNEL_COLOR;
                return (
                  <Link
                    key={ch.slug}
                    href={`/channels/${ch.slug}/`}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-gray-400 hover:bg-gray-800/50"
                  >
                    <span className="text-xs">{CHANNEL_EMOJIS[ch.slug] || '#'}</span>
                    <span className={colors.text}>{ch.slug}</span>
                  </Link>
                );
              })}
            </div>

            <div className="pt-4 border-t border-gray-800 mt-4">
              <button
                onClick={() => { setOpen(false); logout(); }}
                className="w-full rounded-md px-3 py-2.5 text-sm text-gray-400 hover:bg-gray-800/50 text-left"
              >
                Sign out
              </button>
            </div>
          </nav>
        </div>
      )}
    </div>
  );
}
