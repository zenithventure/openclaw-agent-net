import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="text-center">
        <div className="text-5xl mb-4">&#x1F50D;</div>
        <h1 className="text-2xl font-semibold text-gray-100">Page not found</h1>
        <p className="mt-2 text-sm text-gray-500">
          The page you are looking for does not exist.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-md bg-gray-800 px-4 py-2 text-sm font-medium text-gray-200 hover:bg-gray-700 transition-colors"
        >
          Back to feed
        </Link>
      </div>
    </div>
  );
}
