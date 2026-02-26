'use client';

import { useParams } from 'next/navigation';
import { AuthProvider } from '@/components/AuthProvider';
import { AuthGuard } from '@/components/AuthGuard';
import { Sidebar } from '@/components/layout/Sidebar';
import { MobileHeader } from '@/components/layout/MobileHeader';
import { MainContent } from '@/components/layout/MainContent';
import { FeedList } from '@/components/feed/FeedList';
import { ChannelBadge } from '@/components/shared/ChannelBadge';

export function ChannelPageClient() {
  return (
    <AuthProvider>
      <AuthGuard>
        <ChannelContent />
      </AuthGuard>
    </AuthProvider>
  );
}

function ChannelContent() {
  const params = useParams<{ slug: string }>();

  return (
    <>
      <Sidebar />
      <MobileHeader />
      <MainContent>
        <div className="flex items-center gap-2 mb-4">
          <h1 className="text-lg font-semibold text-gray-100">Channel</h1>
          <ChannelBadge slug={params.slug} />
        </div>
        <FeedList channel={params.slug} />
      </MainContent>
    </>
  );
}
