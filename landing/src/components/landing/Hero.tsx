import { ArrowDown } from "lucide-react";
import { portalLoginHref } from "@/lib/portal";

export function Hero() {
  return (
    <section
      aria-labelledby="hero-heading"
      className="relative flex min-h-screen flex-col overflow-hidden bg-paper text-ink"
    >
      <div className="border-b border-hairline">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-6">
          <div className="flex items-baseline gap-3">
            <span className="font-display text-xl tracking-tight">VERTICA</span>
            <span className="label-xs hidden text-mute sm:inline">
              Volumetric cadastral intelligence
            </span>
          </div>
          <a
            href={portalLoginHref()}
            className="label-xs rounded-sm bg-ink px-4 py-2.5 text-paper transition-colors hover:bg-signal-deep focus-visible:ring-2 focus-visible:ring-signal focus-visible:outline-none"
          >
            Log in
          </a>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-7xl flex-1 items-center px-5 py-16 sm:py-20">
        <div>
          <p className="label-xs text-signal-deep">ULPIN · 3D cadastre · India</p>
          <h1
            id="hero-heading"
            className="mt-6 max-w-4xl overflow-visible font-display text-5xl leading-[1.06] text-ink sm:text-7xl lg:text-8xl"
          >
            From raw survey data to a legal 3D digital twin.
          </h1>
          <p className="mt-7 max-w-xl text-base leading-relaxed text-mute sm:text-lg">
            VERTICA turns drone, LiDAR and GIS captures into validated volumetric parcels — every
            floor, unit, air right and underground corridor carrying its own ULPIN identity.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-6">
            <a
              href="#ingestion"
              className="label-xs inline-flex items-center gap-2 rounded-sm bg-signal px-6 py-3.5 text-primary-foreground transition-colors hover:bg-signal-deep focus-visible:ring-2 focus-visible:ring-signal focus-visible:outline-none"
            >
              See the pipeline <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
            <span className="label-xs text-mute">Scroll · 6 stages</span>
          </div>
        </div>
      </div>

      <div className="border-t border-hairline">
        <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-6 px-5 pb-16 pt-6 sm:grid-cols-2 sm:gap-x-10 sm:gap-y-7 lg:grid-cols-4 lg:gap-8">
          {[
            ["Demo city", "Intel City"],
            ["Pincode", "600001"],
            ["Hierarchy", "parcel → unit"],
            ["Registry", "frozen · auditable"],
          ].map(([k, v]) => (
            <div key={k}>
              <p className="label-xs text-mute">{k}</p>
              <p className="mt-2 font-mono text-xs text-ink">{v}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
