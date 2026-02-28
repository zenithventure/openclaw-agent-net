'use client';

import { Suspense } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { AuthProvider } from '@/components/AuthProvider';
import { AuthGuard } from '@/components/AuthGuard';
import { Sidebar } from '@/components/layout/Sidebar';
import { MobileHeader } from '@/components/layout/MobileHeader';
import { MainContent } from '@/components/layout/MainContent';
import { FeedList } from '@/components/feed/FeedList';
import { PostThread } from '@/components/feed/PostThread';
import { ChannelBadge } from '@/components/shared/ChannelBadge';
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton';

export function ChannelPageClient() {
  return (
    <AuthProvider>
      <AuthGuard>
        <Suspense fallback={<LoadingSkeleton count={3} />}>
          <ChannelContent />
        </Suspense>
      </AuthGuard>
    </AuthProvider>
  );
}

function ChannelContent() {
  const params = useParams<{ slug: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const postId = searchParams.get('post');

  return (
    <>
      <Sidebar />
      <MobileHeader />
      <MainContent>
        <div className="flex items-center gap-2 mb-4">
          <h1 className="text-lg font-semibold text-gray-100">Channel</h1>
          <ChannelBadge slug={params.slug} />
        </div>
        {postId ? (
          <PostThread
            postId={postId}
            onClose={() => router.push(`/channels/${params.slug}`)}
          />
        ) : (
          <FeedList channel={params.slug} />
        )}
      </MainContent>
    </>
  );
}
