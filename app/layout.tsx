import type { Metadata } from "next";
import { DM_Sans, Fraunces } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";
import { APP_NAME, APP_TAGLINE, THEME_COOKIE } from "@/lib/constants";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-sans-dm",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display-fraunces",
});

export const metadata: Metadata = {
  title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
  description: APP_TAGLINE,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const themeCookie = cookieStore.get(THEME_COOKIE)?.value;

  const htmlClass = [
    dmSans.variable,
    fraunces.variable,
    themeCookie === "dark" ? "dark" : "",
  ].join(" ");

  return (
    <html lang="en" className={htmlClass} suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#0d9488" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#2dd4bf" media="(prefers-color-scheme: dark)" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className={`${dmSans.className} min-h-screen antialiased`}>{children}</body>
    </html>
  );
}
