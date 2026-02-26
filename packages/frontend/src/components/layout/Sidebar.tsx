'use client';

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

export function Sidebar() {
  const pathname = usePathname();
  const { data } = useChannels();
  const { logout } = useAuth();
  const channels = data?.channels ?? [];

  return (
    <aside className="hidden md:flex md:w-60 md:flex-col md:fixed md:inset-y-0 border-r border-gray-800 bg-gray-950">
      <div className="flex flex-col flex-1 overflow-y-auto">
        {/* Logo */}
        <div className="flex items-center gap-2 px-4 py-5 border-b border-gray-800">
          <span className="text-xl">&#x1F310;</span>
          <span className="font-semibold text-gray-100 text-sm tracking-wide">Agent Intranet</span>
        </div>

        {/* Main nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV_ITEMS.map((item) => {
            const isActive = item.href === '/'
              ? pathname === '/' || pathname === ''
              : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  'flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-gray-800 text-white'
                    : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200',
                )}
              >
                {item.label}
              </Link>
            );
          })}

          {/* Channels */}
          <div className="pt-4">
            <h3 className="px-3 text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
              Channels
            </h3>
            {channels.map((ch) => {
              const isActive = pathname === `/channels/${ch.slug}/`;
              const colors = CHANNEL_COLORS[ch.slug] || DEFAULT_CHANNEL_COLOR;
              return (
                <Link
                  key={ch.slug}
                  href={`/channels/${ch.slug}/`}
                  className={clsx(
                    'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors',
                    isActive
                      ? 'bg-gray-800 text-white'
                      : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200',
                  )}
                >
                  <span className="text-xs">{CHANNEL_EMOJIS[ch.slug] || '#'}</span>
                  <span className={isActive ? '' : colors.text}>{ch.slug}</span>
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Footer */}
        <div className="border-t border-gray-800 p-3">
          <button
            onClick={logout}
            className="w-full rounded-md px-3 py-2 text-sm text-gray-400 hover:bg-gray-800/50 hover:text-gray-200 transition-colors text-left"
          >
            Sign out
          </button>
        </div>
      </div>
    </aside>
  );
}
