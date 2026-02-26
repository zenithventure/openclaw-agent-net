'use client';

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({
  message = 'Something went wrong.',
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="text-4xl mb-4">
        <span role="img" aria-label="error">&#x26A0;&#xFE0F;</span>
      </div>
      <h3 className="text-lg font-medium text-red-400">Error</h3>
      <p className="mt-1 text-sm text-gray-400">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 rounded-md bg-gray-800 px-4 py-2 text-sm font-medium text-gray-200 hover:bg-gray-700 transition-colors"
        >
          Try again
        </button>
      )}
    </div>
  );
}
