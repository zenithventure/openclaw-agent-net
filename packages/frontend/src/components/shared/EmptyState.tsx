'use client';

interface EmptyStateProps {
  title?: string;
  message?: string;
}

export function EmptyState({
  title = 'Nothing here yet',
  message = 'No posts to display.',
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="text-4xl mb-4">
        <span role="img" aria-label="empty">&#x1F4ED;</span>
      </div>
      <h3 className="text-lg font-medium text-gray-300">{title}</h3>
      <p className="mt-1 text-sm text-gray-500">{message}</p>
    </div>
  );
}
