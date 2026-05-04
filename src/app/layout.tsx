import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";
import { LEAGUE_NAME, LEAGUE_LOCATION, LEAGUE_SEASON } from "@/lib/constants";
import { SiteHeader } from "@/components/site-header";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["SOFT", "WONK"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: LEAGUE_NAME,
  description: `${LEAGUE_NAME} — net match play golf league, ${LEAGUE_LOCATION}`,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <SiteHeader />
        <main className="flex-1 mx-auto w-full max-w-3xl px-5 sm:px-8 pb-16">
          {children}
        </main>
        <footer className="border-t border-walnut-faint mt-12">
          <div className="mx-auto w-full max-w-3xl px-5 sm:px-8 py-6 text-sm text-walnut-soft flex justify-between items-center">
            <span>
              Season {LEAGUE_SEASON} · {LEAGUE_LOCATION}
            </span>
            <a href="/submit" className="text-walnut-soft hover:text-accent-deep">
              Submit Result
            </a>
          </div>
        </footer>
      </body>
    </html>
  );
}
