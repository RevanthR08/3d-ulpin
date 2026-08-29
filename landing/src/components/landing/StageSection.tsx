import { useEffect, useRef, type ComponentType } from "react";
import { motion, useScroll, useReducedMotion, useTransform, type MotionValue } from "motion/react";
import type { Stage } from "./stages";

type Props = {
  stage: Stage;
  Visual: ComponentType<{ p: MotionValue<number>; still: boolean }>;
  onActive: () => void;
};

export function StageSection({ stage, Visual, onActive }: Props) {
  const ref = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const visualOpacity = useTransform(
    scrollYProgress,
    [0, 0.12, 0.84, 1],
    [0.35, 1, 1, 0.35],
  );

  useEffect(() => {
    const section = ref.current;
    if (!section) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) onActive();
      },
      { rootMargin: "-44% 0px -44% 0px", threshold: 0 },
    );
    observer.observe(section);
    return () => observer.disconnect();
  }, [onActive]);

  return (
    <section
      id={stage.id}
      ref={ref}
      aria-labelledby={`${stage.id}-heading`}
      className="relative min-h-[132vh] border-t border-hairline bg-paper md:min-h-[164vh]"
    >
      <div className="mx-auto grid min-h-[132vh] max-w-7xl grid-cols-1 gap-10 px-5 py-16 md:min-h-[164vh] md:grid-cols-[minmax(0,0.44fr)_minmax(0,0.56fr)] md:items-center md:gap-16 md:py-24 xl:grid-cols-[10rem_3rem_minmax(0,0.44fr)_minmax(0,0.56fr)] xl:gap-0 xl:py-24">
        <div className="hidden xl:block" aria-hidden="true" />
        <div className="hidden xl:block" aria-hidden="true" />

        {/* Copy stays in the shared grid while the visual pins beside it. */}
        <div className="order-2 min-w-0 self-center pr-0 md:order-2 md:pr-10 xl:pr-20">
          <motion.div
            {...(reduced ? {} : { initial: { opacity: 0, y: 16 } })}
            {...(reduced ? {} : { whileInView: { opacity: 1, y: 0 } })}
            viewport={{ once: true, amount: 0.25 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          >
            <p className="label-xs text-signal-deep">
              {stage.index} · {stage.name}
            </p>
            <h2
              id={`${stage.id}-heading`}
              className="mt-4 max-w-lg font-display text-3xl leading-[1.08] text-ink sm:text-4xl"
            >
              {stage.headline}
            </h2>
            {stage.copy.map((c) => (
              <p key={c} className="mt-5 max-w-md text-[15px] leading-relaxed text-mute">
                {c}
              </p>
            ))}
            <ul className="mt-8 flex flex-wrap gap-2">
              {stage.chips.map((chip) => (
                <li
                  key={chip}
                  className="label-xs rounded-xs border border-hairline bg-paper-dim px-2.5 py-1.5 text-ink"
                >
                  {chip}
                </li>
              ))}
            </ul>
          </motion.div>
        </div>

        {/* Visual is pinned and its opacity is scrubbed with this stage. */}
        <div className="order-1 min-w-0 md:sticky md:top-[14vh] md:order-3 md:ml-10 md:h-[72vh] md:self-start xl:ml-16">
          <motion.div
            {...(reduced ? {} : { style: { opacity: visualOpacity } })}
            className="h-full w-full"
          >
            <Visual p={scrollYProgress} still={!!reduced} />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
