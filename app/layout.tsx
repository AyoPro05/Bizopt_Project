import type { Metadata } from "next";
import { DM_Sans, Fraunces } from "next/font/google";
import { cookies } from "next/headers";
import "@/styles/globals.css";
import { APP_NAME, APP_TAGLINE, THEME_COOKIE } from "@/lib/constants";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
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
    <html lang="en" className={htmlClass}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
