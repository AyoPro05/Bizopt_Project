import { Providers } from "@/app/providers";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <div className="surface-page flex min-h-screen items-center justify-center px-6">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </Providers>
  );
}
