import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { Hero } from "@/components/landing/Hero";
import { Header, Footer } from "@/components/landing/Chrome";
import { Stepper } from "@/components/landing/Stepper";
import { StageSection } from "@/components/landing/StageSection";
import { STAGES } from "@/components/landing/stages";
import { VISUALS } from "@/components/landing/visuals";

const TITLE = "VERTICA — Volumetric cadastral intelligence for India's 3D land registry";
const DESC =
  "See how VERTICA turns drone, LiDAR and GIS survey data into validated 3D cadastral volumes with ULPIN identities and a navigable city digital twin.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  const [active, setActive] = useState(0);
  const scrollyRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLElement>(null);

  return (
    <>
      <Header />
      <main>
        <Hero />
        <div ref={scrollyRef}>
          <Stepper active={active} containerRef={scrollyRef} footerRef={footerRef} />
          {STAGES.map((stage, i) => {
            const Visual = VISUALS[i]!;
            return (
              <StageSection
                key={stage.id}
                stage={stage}
                Visual={Visual}
                onActive={() => setActive(i)}
              />
            );
          })}
        </div>
      </main>
      <Footer ref={footerRef} />
    </>
  );
}
