export default function MarketingLoading() {
  return (
    <div className="space-y-10 px-6 py-16">
      <div className="mx-auto max-w-6xl animate-pulse">
        <div className="h-6 w-40 rounded bg-[var(--color-border)]" />
        <div className="mt-4 h-12 w-2/3 rounded bg-[var(--color-border)]" />
        <div className="mt-4 h-5 w-1/2 rounded bg-[var(--color-border)]" />
        <div className="mt-8 h-12 w-52 rounded-lg bg-[var(--color-border)]" />
      </div>
      <div className="mx-auto grid max-w-6xl gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, idx) => (
          <div key={idx} className="card-panel h-44 animate-pulse" />
        ))}
      </div>
    </div>
  );
}
