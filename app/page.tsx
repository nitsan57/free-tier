export default function HomePage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-bold tracking-tight">
        Google Photos Cleaner
      </h1>
      <p className="mt-4 text-gray-600">
        Find and bulk-delete screenshots and spam photos from your Google Photos
        library. Sign in with Google to get started.
      </p>

      <div className="mt-8 rounded-lg border border-dashed border-gray-300 p-6 text-sm text-gray-500">
        Scaffold foundation. Auth, detection, and billing modules are wired up
        under <code>app/</code> and <code>lib/</code>.
      </div>

      <a
        href="/api/auth/login"
        className="mt-8 inline-block rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white"
      >
        Sign in with Google
      </a>
    </main>
  );
}
