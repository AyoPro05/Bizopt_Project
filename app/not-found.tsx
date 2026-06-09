import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="mb-6">
          <h1 className="text-8xl font-black text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-purple-500 mb-4">
            404
          </h1>
          <p className="text-xl font-semibold text-slate-100 mb-2">
            Page not found
          </p>
          <p className="text-slate-400 mb-6">
            The page you&apos;re looking for doesn&apos;t exist or has been moved.
          </p>
        </div>

        <div className="space-y-3">
          <Link
            href="/home"
            className="w-full block px-6 py-3 bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-semibold rounded-lg hover:shadow-lg hover:shadow-teal-500/50 transition-all"
          >
            Go to Home
          </Link>
          <Link
            href="/"
            className="w-full block px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-lg transition-colors"
          >
            Back to Landing
          </Link>
        </div>
      </div>
    </div>
  );
}
