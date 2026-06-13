export default function AuthLoading() {
  return (
    <div className="card-panel mx-auto w-full max-w-md animate-pulse p-8">
      <div className="h-8 w-56 rounded-lg bg-[var(--color-border)]" />
      <div className="mt-3 h-4 w-40 rounded bg-[var(--color-border)]" />
      <div className="mt-8 space-y-4">
        <div className="h-10 rounded-lg bg-[var(--color-border)]" />
        <div className="h-10 rounded-lg bg-[var(--color-border)]" />
        <div className="h-10 rounded-lg bg-[var(--color-border)]" />
      </div>
    </div>
  );
}
