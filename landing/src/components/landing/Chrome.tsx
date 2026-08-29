import { Link } from "@tanstack/react-router";
import { forwardRef, useEffect, useState } from "react";
import { portalLoginHref } from "@/lib/portal";

export function Header() {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const onScroll = () => setShown(window.scrollY > 420);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 border-b border-hairline bg-paper/90 backdrop-blur transition-opacity duration-300 ${
        shown ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3">
        <Link to="/" className="group flex items-baseline gap-3">
          <span className="font-display text-lg tracking-tight text-ink">VERTICA</span>
          <span className="label-xs hidden text-mute sm:inline">
            Volumetric cadastral intelligence
          </span>
        </Link>
        <a
          href={portalLoginHref()}
          className="label-xs rounded-sm bg-ink px-4 py-2.5 text-paper transition-colors hover:bg-signal-deep focus-visible:ring-2 focus-visible:ring-signal focus-visible:outline-none"
        >
          Log in
        </a>
      </div>
    </header>
  );
}

export const Footer = forwardRef<HTMLElement>(function Footer(_, ref) {
  return (
    <footer ref={ref} className="bg-ink text-paper">
      <div className="mx-auto max-w-7xl px-5 py-20 sm:py-28">
        <p className="label-xs text-signal">Enter the portal</p>
        <h2 className="mt-5 max-w-3xl font-display text-4xl leading-[1.05] sm:text-6xl">
          The registry is open. Choose your door.
        </h2>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <a
            href={portalLoginHref("citizen")}
            className="label-xs inline-flex items-center justify-center rounded-sm bg-signal px-7 py-4 text-paper transition-colors hover:bg-signal-deep focus-visible:ring-2 focus-visible:ring-paper focus-visible:outline-none"
          >
            Citizen portal
          </a>
          <a
            href={portalLoginHref("admin")}
            className="label-xs inline-flex items-center justify-center rounded-sm border border-paper/30 px-7 py-4 text-paper transition-colors hover:border-signal hover:text-signal focus-visible:ring-2 focus-visible:ring-paper focus-visible:outline-none"
          >
            Operator portal
          </a>
        </div>

        <div className="mt-20 flex flex-col gap-3 border-t border-paper/15 pt-8 text-sm text-paper/60 sm:flex-row sm:items-center sm:justify-between">
          <p>Ministry of Rural Development · Department of Land Resources</p>
          <p className="font-mono text-xs tracking-wider">Demo city: Intel City · PIN 600001</p>
        </div>
      </div>
    </footer>
  );
});
