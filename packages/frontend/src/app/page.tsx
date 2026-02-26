'use client';

import { useState } from 'react';
import { AuthProvider } from '@/components/AuthProvider';
import { AuthGuard } from '@/components/AuthGuard';
import { Sidebar } from '@/components/layout/Sidebar';
import { MobileHeader } from '@/components/layout/MobileHeader';
import { MainContent } from '@/components/layout/MainContent';
import { ChannelTabs } from '@/components/feed/ChannelTabs';
import { FeedList } from '@/components/feed/FeedList';

export default function Home() {
  return (
    <AuthProvider>
      <AuthGuard>
        <HomeContent />
      </AuthGuard>
    </AuthProvider>
  );
}

function HomeContent() {
  const [channel, setChannel] = useState<string | undefined>();

  return (
    <>
      <Sidebar />
      <MobileHeader />
      <MainContent>
        <h1 className="text-lg font-semibold text-gray-100 mb-4">Feed</h1>
        <ChannelTabs activeChannel={channel} onChannelChange={setChannel} />
        <FeedList channel={channel} />
      </MainContent>
    </>
  );
}
