'use client';

import { useAuth } from './AuthProvider';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { LoadingSkeleton } from './shared/LoadingSkeleton';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { token, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !token) {
      router.replace('/login/');
    }
  }, [token, isLoading, router]);

  if (isLoading) return <LoadingSkeleton />;
  if (!token) return null;
  return <>{children}</>;
}
