import { useEffect, useState, type RefObject } from "react";
import { STAGES } from "./stages";

type Props = {
  active: number;
  containerRef: RefObject<HTMLDivElement | null>;
  footerRef: RefObject<HTMLElement | null>;
};

export function Stepper({ active, containerRef, footerRef }: Props) {
  const [inScrolly, setInScrolly] = useState(false);
  const [inFooter, setInFooter] = useState(false);

  // Show the tracker only while the scrollytelling container actually occupies
  // the middle of the viewport — not the instant its top edge grazes the fold
  // (which is why it used to flash over the hero) and not once the footer takes over.
  useEffect(() => {
    const scrolly = containerRef.current;
    if (!scrolly) return;

    const observer = new IntersectionObserver(
      ([entry]) => setInScrolly(Boolean(entry?.isIntersecting)),
      { threshold: 0, rootMargin: "-45% 0px -45% 0px" },
    );
    observer.observe(scrolly);
    return () => observer.disconnect();
  }, [containerRef]);

  useEffect(() => {
    const footer = footerRef.current;
    if (!footer) return;

    const observer = new IntersectionObserver(
      ([entry]) => setInFooter(Boolean(entry?.isIntersecting)),
      { threshold: 0 },
    );
    observer.observe(footer);
    return () => observer.disconnect();
  }, [footerRef]);

  const visible = inScrolly && !inFooter;

  const go = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <>
      {/* Mobile progress bar */}
      <div
        aria-hidden={!visible}
        className={`pointer-events-none fixed inset-x-0 top-0 z-40 transition-opacity duration-300 xl:hidden ${visible ? "opacity-100" : "opacity-0"}`}
      >
        <div className="h-0.5 w-full bg-hairline">
          <div
            className="h-full bg-signal transition-[width] duration-300"
            style={{ width: `${((active + 1) / STAGES.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Desktop stepper */}
      <nav
        aria-label="Pipeline stages"
        aria-hidden={!visible}
        className={`stepper-rail fixed top-1/2 z-40 hidden w-[12.5rem] -translate-y-1/2 transition-opacity duration-300 xl:block ${visible ? "opacity-100" : "pointer-events-none opacity-0"}`}
      >
        <ol className="w-full space-y-3 border-l border-hairline pl-4">
          {STAGES.map((s, i) => {
            const on = i === active;
            return (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    go(s.id);
                  }}
                  aria-current={on ? "step" : undefined}
                  className={`group flex w-full items-center gap-3 rounded-xs py-1 text-left focus-visible:ring-2 focus-visible:ring-signal focus-visible:outline-none ${
                    on ? "text-ink" : "text-mute hover:text-ink"
                  }`}
                >
                  <span
                    className={`h-px transition-all duration-300 ${
                      on ? "w-6 bg-signal" : "w-3 bg-hairline group-hover:w-5"
                    }`}
                  />
                  <span className="label-xs">{s.index}</span>
                  <span
                    className={`label-xs transition-opacity duration-300 ${on ? "opacity-100" : "opacity-60"}`}
                  >
                    {s.name}
                  </span>
                </a>
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
}
