import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="text-center max-w-md">
        <p className="text-6xl font-bold text-gray-700">404</p>
        <h1 className="mt-3 text-xl font-semibold text-white">Page not found</h1>
        <p className="mt-2 text-sm text-gray-400">
          That route doesn’t exist in CommandPost. Check the address or head back to the dashboard.
        </p>
        <Link
          href="/"
          className="inline-block mt-6 px-4 py-2 rounded-lg bg-blue-600 text-sm font-medium text-white hover:bg-blue-500 transition-colors"
        >
          ← Back to Dashboard
        </Link>
      </div>
    </main>
  );
}
