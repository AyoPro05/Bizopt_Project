import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { Providers } from "@/app/providers";
import { Sidebar } from "@/components/layout/sidebar";
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
        <div className="flex min-h-screen bg-[var(--color-surface)]">
          <Sidebar />
          <main className="flex-1 overflow-auto">
            <div className="mx-auto max-w-6xl px-6 py-8 md:px-8">{children}</div>
          </main>
        </div>
      </ThemeProvider>
    </Providers>
  );
}
