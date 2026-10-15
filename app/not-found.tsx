import Link from "next/link";
import { ErrorFallback } from "@/components/errors/error-fallback";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="surface-page flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-xl">
        <ErrorFallback
          title="Page not found"
          description="That route does not exist. You can return home and continue working."
          showHomeLink={false}
        />
        <div className="mt-4 flex justify-center gap-3">
          <Link href="/home">
            <Button size="sm">Go to Home</Button>
          </Link>
          <Link href="/">
            <Button size="sm" variant="secondary">
              Back to Landing
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
