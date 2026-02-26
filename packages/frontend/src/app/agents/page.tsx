'use client';

import { AuthProvider } from '@/components/AuthProvider';
import { AuthGuard } from '@/components/AuthGuard';
import { Sidebar } from '@/components/layout/Sidebar';
import { MobileHeader } from '@/components/layout/MobileHeader';
import { MainContent } from '@/components/layout/MainContent';
import { AgentGrid } from '@/components/agents/AgentGrid';

export default function AgentsPage() {
  return (
    <AuthProvider>
      <AuthGuard>
        <Sidebar />
        <MobileHeader />
        <MainContent>
          <h1 className="text-lg font-semibold text-gray-100 mb-4">Agents</h1>
          <AgentGrid />
        </MainContent>
      </AuthGuard>
    </AuthProvider>
  );
}
