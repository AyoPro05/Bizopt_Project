import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { Providers } from "@/app/providers";
import { AccountProvider } from "@/components/account/account-provider";
import { Sidebar } from "@/components/shell/sidebar";
import { MobileSidebar } from "@/components/shell/mobile-sidebar";
import { MobileNavProvider } from "@/components/shell/mobile-nav-context";
import { SectionErrorBoundary } from "@/components/errors/section-error-boundary";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { getUserTheme } from "@/lib/theme";
import type { ThemeSetting } from "@/components/theme/theme-provider";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  let initialTheme: ThemeSetting = "system";
  if (session.user?.id) {
    const mode = await getUserTheme(session.user.id);
    initialTheme = mode as ThemeSetting;
  }

  return (
    <Providers>
      <ThemeProvider initialTheme={initialTheme}>
        <AccountProvider>
        <MobileNavProvider>
          {/* Skip to main content link for keyboard navigation */}
          <a
            href="#main-content"
            className="absolute -top-10 left-0 z-50 bg-[var(--color-accent)] text-white px-4 py-2 rounded focus:top-0 transition-all"
          >
            Skip to main content
          </a>

          <div className="surface-page flex min-h-dvh min-w-0">
            <Sidebar />
            <MobileSidebar />
            <main
              id="main-content"
              tabIndex={-1}
              className="min-w-0 flex-1 focus-visible:outline-none"
            >
              <div className="mx-auto min-w-0 max-w-6xl px-4 py-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] sm:px-6 md:px-8 md:py-8">
                <SectionErrorBoundary>{children}</SectionErrorBoundary>
              </div>
            </main>
          </div>
        </MobileNavProvider>
        </AccountProvider>
      </ThemeProvider>
    </Providers>
  );
}
