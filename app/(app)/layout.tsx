import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { Providers } from "@/app/providers";
import { Sidebar } from "@/components/shell/sidebar";
import { SectionErrorBoundary } from "@/components/errors/section-error-boundary";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { getUserTheme } from "@/lib/theme";
import type { ThemeSetting } from "@/components/theme/theme-provider";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  let initialTheme: ThemeSetting = "system";
  if (session.user?.id) {
    const mode = await getUserTheme(session.user.id);
    initialTheme = mode as ThemeSetting;
  }

  return (
    <Providers>
      <ThemeProvider initialTheme={initialTheme}>
        {/* Skip to main content link for keyboard navigation */}
        <a
          href="#main-content"
          className="absolute -top-10 left-0 z-50 bg-[var(--color-accent)] text-white px-4 py-2 rounded focus:top-0 transition-all"
        >
          Skip to main content
        </a>

        <div className="surface-page flex min-h-screen">
          <Sidebar />
          <main
            id="main-content"
            className="flex-1 overflow-auto focus-visible:outline-none"
          >
            <div className="mx-auto max-w-6xl px-6 py-8 md:px-8">
              <SectionErrorBoundary>{children}</SectionErrorBoundary>
            </div>
          </main>
        </div>
      </ThemeProvider>
    </Providers>
  );
}
