import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";
import { LEAGUE_NAME, LEAGUE_LOCATION } from "@/lib/constants";
import { getCurrentSeason } from "@/lib/queries";
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

// The footer reads the current season from the database, so nothing under this
// layout can be prerendered at build time — including the built-in 404 page,
// which would otherwise need a reachable database during `next build`.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: LEAGUE_NAME,
  description: `${LEAGUE_NAME} — net match play golf league, ${LEAGUE_LOCATION}`,
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const season = await getCurrentSeason();

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
              Season {season.year} · {LEAGUE_LOCATION}
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
