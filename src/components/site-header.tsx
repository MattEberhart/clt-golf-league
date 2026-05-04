import Link from "next/link";
import { LEAGUE_NAME } from "@/lib/constants";
import { FlagPin } from "./flag-pin";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/schedule", label: "Schedule" },
  { href: "/standings", label: "Standings" },
  { href: "/teams", label: "Teams" },
  { href: "/results", label: "Results" },
];

export function SiteHeader() {
  return (
    <header className="border-b border-walnut-faint">
      <div className="mx-auto w-full max-w-3xl px-5 sm:px-8 py-5 flex items-center gap-4">
        <Link href="/" className="flex items-center gap-3 no-underline hover:no-underline">
          <FlagPin className="w-7 h-7 text-accent" />
          <span className="font-display text-xl text-walnut">{LEAGUE_NAME}</span>
        </Link>
        <nav className="ml-auto flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="text-walnut-soft hover:text-accent-deep no-underline hover:underline"
            >
              {n.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
