import { motion, useTransform, type MotionValue } from "motion/react";
import aerial from "@/assets/aerial_city.jpg.asset.json";
import underground from "@/assets/underground.jpg.asset.json";
import twin from "@/assets/twin.jpg.asset.json";

type P = { p: MotionValue<number>; still: boolean };

const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

/* ---------------- shared craft primitives ---------------- */

/** Isometric projection: world (x, y, z) -> svg (x, y). */
function iso(x: number, y: number, z = 0): [number, number] {
  return [(x - y) * 0.866, (x + y) * 0.5 - z];
}
function pts(list: Array<[number, number]>) {
  return list.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
}

/**
 * Axonometric box. Base polygon is static; the extruded shell scales in y
 * from the base so growth reads as real height.
 */
function IsoBox({
  x,
  y,
  w,
  d,
  h,
  floors = 0,
  grow,
  still,
  fill = "var(--signal-soft)",
  fillOpacity = 1,

  label,
}: {
  x: number;
  y: number;
  w: number;
  d: number;
  h: number;
  floors?: number;
  grow?: MotionValue<number>;
  still: boolean;
  fill?: string;
  fillOpacity?: number;
  label?: string;
}) {
  const a = iso(x, y);
  const b = iso(x + w, y);
  const c = iso(x + w, y + d);
  const e = iso(x, y + d);
  const at = iso(x, y, h);
  const bt = iso(x + w, y, h);
  const ct = iso(x + w, y + d, h);
  const et = iso(x, y, h);
  void et;
  const dt = iso(x, y + d, h);

  return (
    <g>
      {/* contact shadow */}
      <polygon
        points={pts([a, b, c, e])}
        fill="var(--ink)"
        opacity={0.12}
        transform="translate(2.5 2)"
      />
      <polygon points={pts([a, b, c, e])} fill="var(--paper-dim)" stroke="var(--hairline)" />
      <motion.g
        {...(still || !grow
          ? {}
          : { style: { scaleY: grow, transformBox: "fill-box", transformOrigin: "50% 100%" } })}
      >
        {/* left face (shaded) */}
        <polygon
          points={pts([a, e, dt, at])}
          fill={fill}
          fillOpacity={fillOpacity * 0.95}
          stroke="var(--signal-deep)"
          strokeWidth={0.6}
        />
        {/* right face */}
        <polygon
          points={pts([e, c, ct, dt])}
          fill={fill}
          fillOpacity={fillOpacity * 0.7}
          stroke="var(--signal-deep)"
          strokeWidth={0.6}
        />
        {/* roof */}
        <polygon
          points={pts([at, bt, ct, dt])}
          fill="var(--paper)"
          fillOpacity={1}
          stroke="var(--signal-deep)"
          strokeWidth={0.7}
        />
        {/* floor slabs — every other level so tall masses stay calm, not hatched */}
        {Array.from({ length: floors }).map((_, f) => {
          if (floors > 6 && f % 2 === 1) return null;
          const z = ((f + 1) / (floors + 1)) * h;
          return (
            <polyline
              key={f}
              points={pts([iso(x, y, z), iso(x, y + d, z), iso(x + w, y + d, z)])}
              fill="none"
              stroke="var(--signal-deep)"
              strokeOpacity={0.22}
              strokeWidth={0.3}
            />
          );
        })}

      </motion.g>
      {label ? (
        <g>
          <line
            x1={bt[0]}
            y1={bt[1]}
            x2={bt[0] + 6}
            y2={bt[1] - 3}
            stroke="var(--signal)"
            strokeWidth={0.4}
            strokeOpacity={0.7}
          />
          <text
            x={bt[0] + 7.5}
            y={bt[1] - 3}
            fill="var(--signal-deep)"
            fontSize={4.2}
            fontFamily="var(--font-mono)"
            letterSpacing="0.06em"
            stroke="var(--paper)"
            strokeWidth={1.6}
            paintOrder="stroke"
          >
            {label}
          </text>
        </g>
      ) : null}

    </g>
  );
}

function Grain() {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.05] mix-blend-multiply"
    >
      <filter id="v-grain">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={3} stitchTiles="stitch" />
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <rect width="100%" height="100%" filter="url(#v-grain)" />
    </svg>
  );
}

/** Canvas: paper ground, hairline border, grid with parallax, sweep on handoff. */
function Canvas({
  p,
  still,
  children,
  caption,
  meta,
}: P & { children: React.ReactNode; caption?: string; meta?: string }) {
  const gridY = useTransform(p, [0, 1], [10, -10]);
  const sweep = useTransform(p, [0.0, 0.1], ["-30%", "130%"]);
  const sweepO = useTransform(p, [0, 0.04, 0.1], [0, 0.9, 0]);
  return (
    <div
      className="relative min-h-[62vh] w-full overflow-hidden rounded-[20px] border border-hairline bg-paper md:h-full md:min-h-0"
      style={{ boxShadow: "0 24px 60px -32px color-mix(in oklab, var(--ink) 40%, transparent)" }}
    >
      {/* dot + line grid ground */}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-y-6 inset-x-0 opacity-[0.06]"
        style={{
          backgroundImage:
            "radial-gradient(var(--ink) 0.8px, transparent 0.9px), linear-gradient(to right, var(--ink) 0.5px, transparent 0.5px)",
          backgroundSize: "18px 18px, 72px 72px",
          ...(still ? {} : { y: gridY }),
        }}
      />

      {/* inner paper vignette */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 90% at 30% 10%, transparent 40%, color-mix(in oklab, var(--paper-dim) 70%, transparent) 100%)",
        }}
      />
      {children}
      <Grain />
      {/* handoff sweep */}
      {still ? null : (
        <motion.div
          aria-hidden="true"
          style={{ x: sweep, opacity: sweepO }}
          className="pointer-events-none absolute inset-y-0 w-[14%]"
        >
          <div className="h-full w-px bg-signal" />
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(90deg, color-mix(in oklab, var(--signal) 18%, transparent), transparent)",
            }}
          />
        </motion.div>
      )}
      {meta ? (
        <div className="pointer-events-none absolute top-4 left-5 z-20">
          <span className="label-xs text-signal-deep">{meta}</span>
        </div>
      ) : null}
      {caption ? (
        <div className="pointer-events-none absolute bottom-4 left-5 z-20 flex items-center gap-2 rounded-full border border-hairline bg-paper/90 px-3 py-1">
          <span className="h-1 w-1 rounded-full bg-signal" />
          <span className="label-xs text-mute">{caption}</span>
        </div>
      ) : null}
      {/* corner ticks */}
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full text-hairline"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        {[12, 24, 36, 64, 76, 88].map((v) => (
          <line
            key={v}
            x1={v}
            x2={v}
            y1={0}
            y2={1.2}
            stroke="currentColor"
            strokeWidth={0.15}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
    </div>
  );
}

/* ---------------- 01 · Data ingestion ---------------- */

const SOURCES = [
  { k: "Drone", n: "412 tiles", from: [-70, -40], rot: -8 },
  { k: "LiDAR", n: "8.4M pts", from: [70, -50], rot: 7 },
  { k: "GIS", n: "31 layers", from: [-80, 10], rot: 5 },
  { k: "Floor plans", n: "196 PDFs", from: [80, 20], rot: -6 },
  { k: "GNSS", n: "24 CORS", from: [-60, 60], rot: 9 },
  { k: "DEM/DSM", n: "1m grid", from: [65, 70], rot: -9 },
];

export function IngestionVisual({ p, still }: P) {
  return (
    <Canvas p={p} still={still} meta="collector · auto-classified" caption="Mixed survey package">
      <img
        src={aerial.url}
        alt="Aerial orthophoto of the survey area"
        loading="lazy"
        width={1280}
        height={1280}
        className="absolute inset-0 h-full w-full object-cover opacity-[0.08] grayscale"
      />
      <div className="absolute inset-0 grid grid-cols-2 content-center gap-3 px-6 py-16 sm:grid-cols-3 sm:gap-4 sm:px-8">
        {SOURCES.map((s, i) => {
          const start = 0.06 + i * 0.085;
          const opacity = useTransform(p, [start, start + 0.1], [0, 1]);
          const x = useTransform(p, [start, start + 0.22], [s.from[0]!, 0]);
          const y = useTransform(p, [start, start + 0.22], [s.from[1]!, 0]);
          const rotate = useTransform(p, [start, start + 0.24], [s.rot, 0]);
          const tick = useTransform(p, [start + 0.18, start + 0.24, start + 0.32], [0, 1, 0]);
          return (
            <motion.div
              key={s.k}
              className="relative rounded-lg border border-hairline bg-paper px-3 py-3"
              style={{
                boxShadow:
                  "0 10px 22px -14px color-mix(in oklab, var(--ink) 45%, transparent)",
                ...(still ? {} : { opacity, x, y, rotate }),
              }}
            >

              <p className="label-xs text-signal-deep">{s.k}</p>
              <p className="mt-1 font-mono text-[11px] text-mute">{s.n}</p>
              {/* per-tile micro-glyph */}
              <svg viewBox="0 0 60 22" className="mt-2 h-5 w-full" aria-hidden="true">
                {i === 1 || i === 4
                  ? Array.from({ length: 26 }).map((_, d) => (
                      <circle
                        key={d}
                        cx={2 + (d % 13) * 4.5}
                        cy={d < 13 ? 6 : 15}
                        r={0.9}
                        fill="var(--signal)"
                        opacity={0.35 + ((d * 7) % 5) / 8}
                        style={
                          still
                            ? undefined
                            : {
                                animation: `pulse ${2 + (d % 4) * 0.6}s ${EASE} ${d * 0.07}s infinite`,
                              }
                        }
                      />
                    ))
                  : i === 2
                    ? (
                        <>
                          <polygon
                            points="4,16 18,4 34,8 30,18"
                            fill="var(--signal-soft)"
                            stroke="var(--signal-deep)"
                            strokeWidth={0.7}
                          />
                          <polygon
                            points="36,14 52,10 56,19 40,20"
                            fill="none"
                            stroke="var(--signal-deep)"
                            strokeWidth={0.7}
                          />
                        </>
                      )
                    : i === 5
                      ? [4, 8, 12, 16].map((o) => (
                          <path
                            key={o}
                            d={`M2,${o + 2} C14,${o - 3} 30,${o + 6} 58,${o}`}
                            fill="none"
                            stroke="var(--signal-deep)"
                            strokeOpacity={0.5}
                            strokeWidth={0.6}
                          />
                        ))
                      : (
                          <>
                            <rect
                              x={3}
                              y={3}
                              width={54}
                              height={16}
                              fill="none"
                              stroke="var(--hairline)"
                            />
                            <line x1={30} x2={30} y1={0} y2={22} stroke="var(--signal)" strokeWidth={0.6} />
                            <line x1={0} x2={60} y1={11} y2={11} stroke="var(--signal)" strokeWidth={0.6} />
                          </>
                        )}
              </svg>
              {still ? null : (
                <motion.span
                  style={{ opacity: tick }}
                  className="absolute -top-1 -left-1 h-2 w-2 border-t border-l border-signal"
                />
              )}
            </motion.div>
          );
        })}
      </div>
      <div className="absolute inset-x-6 bottom-14">
        <motion.div
          {...(still ? {} : { style: { scaleX: useTransform(p, [0.1, 0.95], [0, 1]) } })}
          className="h-px origin-left bg-signal"
        />
        <div className="mt-2 flex justify-between">
          <span className="font-mono text-[10px] text-mute">geo-ref · CORS locked</span>
          <span className="font-mono text-[10px] text-mute">Σ 6 sources</span>
        </div>
      </div>
    </Canvas>
  );
}

/* ---------------- 02 · Polygons ---------------- */

const POLYS = [
  "M60,70 L190,58 L200,150 L150,158 L148,120 L66,128 Z",
  "M230,64 L330,60 L336,140 L232,148 Z",
  "M70,180 L180,172 L188,262 L78,270 Z",
  "M220,178 L340,170 L346,268 L226,276 Z",
];
const AREAS = ["1 284 m²", "812 m²", "946 m²", "1 130 m²"];

export function PolygonVisual({ p, still }: P) {
  const imgOpacity = useTransform(p, [0.05, 0.35], [0.55, 0.16]);
  const draw = useTransform(p, [0.15, 0.7], [0, 1]);
  const dots = useTransform(p, [0.5, 0.85], [0, 1]);
  const scanY = useTransform(p, [0.12, 0.72], ["-4%", "104%"]);
  const scanO = useTransform(p, [0.1, 0.2, 0.68, 0.78], [0, 1, 1, 0]);
  return (
    <Canvas p={p} still={still} meta="contour extraction" caption="Verified footprints · OpenCV + operator">
      <motion.img
        src={aerial.url}
        alt="Orthophoto before footprint extraction"
        loading="lazy"
        width={1280}
        height={1280}
        {...(still ? { style: { opacity: 0.16 } } : { style: { opacity: imgOpacity } })}
        className="absolute inset-0 h-full w-full object-cover grayscale"
      />
      {still ? null : (
        <motion.div
          aria-hidden="true"
          style={{ y: scanY, opacity: scanO }}
          className="absolute inset-x-0 h-16"
        >
          <div
            className="h-full w-full"
            style={{
              background:
                "linear-gradient(180deg, transparent, color-mix(in oklab, var(--signal) 14%, transparent))",
            }}
          />
          <div className="h-px w-full bg-signal" />
        </motion.div>
      )}
      <svg viewBox="0 0 400 300" className="absolute inset-0 h-full w-full" aria-hidden="true">
        {POLYS.map((d, i) => (
          <motion.path
            key={d}
            d={d}
            fill="var(--signal-soft)"
            fillOpacity={0.55}
            stroke="var(--signal)"
            strokeWidth={1.4}
            strokeLinejoin="round"
            {...(still ? {} : { style: { pathLength: draw } })}
            {...(still ? {} : { initial: { pathLength: 0 } })}
          />
        ))}
        {POLYS.map((d, i) => {
          const nums = d
            .replace(/[MLZ]/g, " ")
            .trim()
            .split(/\s+/)
            .map((pair) => pair.split(",").map(Number));
          const cx = nums.reduce((s, n) => s + (n[0] ?? 0), 0) / nums.length;
          const cy = nums.reduce((s, n) => s + (n[1] ?? 0), 0) / nums.length;
          return (
            <motion.text
              key={`a-${i}`}
              x={cx}
              y={cy}
              textAnchor="middle"
              fill="var(--signal-deep)"
              fontSize="7"
              fontFamily="var(--font-mono)"
              {...(still ? {} : { style: { opacity: dots } })}
            >
              {AREAS[i]}
            </motion.text>
          );
        })}
        {POLYS.flatMap((d, pi) =>
          d
            .replace(/[MLZ]/g, " ")
            .trim()
            .split(/\s+/)
            .map((pair, vi) => {
              const [x, y] = pair.split(",").map(Number);
              if (x === undefined || y === undefined || Number.isNaN(x)) return null;
              return (
                <motion.g key={`${pi}-${vi}`} {...(still ? {} : { style: { opacity: dots } })}>
                  <rect
                    x={x - 2.6}
                    y={y - 2.6}
                    width={5.2}
                    height={5.2}
                    fill="var(--signal)"
                    stroke="var(--paper)"
                    strokeWidth={0.8}
                  />
                  <text
                    x={x + 5}
                    y={y - 4}
                    fill="var(--signal-deep)"
                    fontSize="6"
                    fontFamily="var(--font-mono)"
                  >
                    P{vi + 1}
                  </text>
                </motion.g>
              );
            }),
        )}
      </svg>
    </Canvas>
  );
}

/* ---------------- 03 · 3D reconstruction ---------------- */

const TOWERS = [
  { x: 0, y: 0, w: 22, d: 22, h: 34, floors: 4, label: "12.4 m · 4F" },
  { x: 26, y: 0, w: 20, d: 22, h: 58, floors: 8, label: "24.8 m · 8F" },
  { x: 0, y: 26, w: 22, d: 20, h: 92, floors: 13, label: "44.1 m · 14F" },
  { x: 26, y: 26, w: 20, d: 20, h: 44, floors: 6, label: "18.2 m · 6F" },
];

export function ReconstructionVisual({ p, still }: P) {
  const camera = useTransform(p, [0, 1], [-4, 4]);
  const cut = useTransform(p, [0.6, 0.95], [0, 1]);
  return (
    <Canvas p={p} still={still} meta="extrusion · LiDAR + DSM" caption="Floor-segmented massing">
      <motion.svg
        viewBox="-80 -72 172 136"
        className="absolute inset-0 h-full w-full"
        aria-hidden="true"
        {...(still ? {} : { style: { x: camera } })}
      >
        {TOWERS.map((t, i) => {
          const start = 0.12 + i * 0.1;
          const grow = useTransform(p, [start, start + 0.3], [0.02, 1]);
          return (
            <IsoBox
              key={i}
              {...t}
              grow={grow}
              still={still}
              label={t.label}
            />
          );
        })}
        {/* section cut plane */}
        <motion.g {...(still ? {} : { style: { opacity: cut } })}>
          <polygon
            points={pts([iso(-6, -6, 96), iso(52, -6, 96), iso(52, 52, 96), iso(-6, 52, 96)])}
            fill="var(--signal)"
            fillOpacity={0.08}
            stroke="var(--signal)"
            strokeWidth={0.5}
            strokeDasharray="2 2"
          />
          <text
            x={iso(-6, -6, 96)[0] - 4}
            y={iso(-6, -6, 96)[1] - 3}
            textAnchor="end"

            fill="var(--signal-deep)"
            fontSize={4}
            fontFamily="var(--font-mono)"
            stroke="var(--paper)"
            strokeWidth={1.6}
            paintOrder="stroke"
          >
            section cut
          </text>

        </motion.g>
      </motion.svg>
      <div className="absolute top-11 left-5 font-mono text-[10px] text-mute">Δh = DSM − DEM</div>
    </Canvas>
  );
}

/* ---------------- 04 · 3D cadastral ---------------- */

const UNITS = [
  { z: 0, name: "U01 · L10", area: "84 m²" },
  { z: 22, name: "U02 · L11", area: "84 m²" },
  { z: 44, name: "U03 · L12", area: "96 m²" },
];

export function CadastralVisual({ p, still }: P) {
  const air = useTransform(p, [0.04, 0.32], [0, 1]);
  const sub = useTransform(p, [0.45, 0.8], [0, 1]);
  const subY = useTransform(p, [0.45, 0.8], [-14, 0]);
  const ticks = useTransform(p, [0.62, 0.9], [0, 1]);
  return (
    <Canvas p={p} still={still} meta="parcel → body → floor → unit" caption="Topology validated">
      <svg viewBox="-86 -95 180 178" className="absolute inset-0 h-full w-full" aria-hidden="true">
        {/* air-rights prism */}
        <motion.g {...(still ? {} : { style: { opacity: air } })}>
          <polygon
            points={pts([iso(0, 0, 96), iso(24, 0, 96), iso(24, 24, 96), iso(0, 24, 96)])}
            fill="var(--signal-soft)"
            fillOpacity={0.8}
            stroke="var(--signal)"
            strokeDasharray="2.5 2"
            strokeWidth={0.6}
          />
          <polygon
            points={pts([iso(0, 24, 96), iso(24, 24, 96), iso(24, 24, 74), iso(0, 24, 74)])}
            fill="var(--signal-soft)"
            fillOpacity={0.45}
            stroke="var(--signal)"
            strokeDasharray="2.5 2"
            strokeWidth={0.5}
          />
          <text
            x={3}
            y={-38}
            textAnchor="start"
            fill="var(--signal-deep)"
            fontSize={4.2}
            fontFamily="var(--font-mono)"
            stroke="var(--paper)"
            strokeWidth={2}
            paintOrder="stroke"
          >
            air rights · +96 m
          </text>
        </motion.g>

        {/* exploded unit volumes */}
        {UNITS.map((u, i) => {
          const shift = useTransform(p, [0.12, 0.7], [-u.z, -u.z - 13 * i]);
          const o = useTransform(p, [0.06 + i * 0.06, 0.24 + i * 0.06], [0, 1]);
          return (
            <motion.g
              key={u.name}
              {...(still
                ? { style: { y: -u.z - 13 * i } }
                : { style: { y: shift, opacity: o } })}
            >
              <IsoBox
                x={0}
                y={0}
                w={24}
                d={24}
                h={18}
                floors={1}
                still
                label={`${u.name} · ${u.area}`}
              />
            </motion.g>
          );
        })}



        {/* subsurface layer */}
        <motion.g
          {...(still ? { style: { opacity: 1 } } : { style: { opacity: sub, y: subY } })}
        >
          <polygon
            points={pts([iso(0, 0, -26), iso(24, 0, -26), iso(24, 24, -26), iso(0, 24, -26)])}
            fill="var(--paper-dim)"
            stroke="var(--hairline)"
          />
          {[
            { c: "var(--amber)", o: 4, t: "power" },
            { c: "var(--signal)", o: 11, t: "water" },
            { c: "var(--mute)", o: 18, t: "sewer" },
          ].map((cnd, ci) => (
            <g key={cnd.t}>
              <line
                x1={iso(0, cnd.o, -26)[0]}
                y1={iso(0, cnd.o, -26)[1]}
                x2={iso(24, cnd.o, -26)[0]}
                y2={iso(24, cnd.o, -26)[1]}
                stroke={cnd.c}
                strokeWidth={1.2}
                strokeLinecap="round"
              />
              <line
                x1={iso(24, cnd.o, -26)[0]}
                y1={iso(24, cnd.o, -26)[1]}
                x2={iso(24, cnd.o, -26)[0] + 6}
                y2={iso(24, 18, -26)[1] + 4 + ci * 5.4}
                stroke={cnd.c}
                strokeOpacity={0.5}
                strokeWidth={0.35}
              />
              <text
                x={iso(24, cnd.o, -26)[0] + 7.4}
                y={iso(24, 18, -26)[1] + 5.2 + ci * 5.4}
                fill={cnd.c}
                fontSize={3.8}
                fontFamily="var(--font-mono)"
                stroke="var(--paper)"
                strokeWidth={1.4}
                paintOrder="stroke"
              >
                {cnd.t}
              </text>
            </g>
          ))}
        </motion.g>

        {/* topology OK ticks */}
        <motion.g {...(still ? {} : { style: { opacity: ticks } })}>
          {[iso(0, 0, 6), iso(0, 0, 26), iso(0, 0, 46)].map(([x, y], i) => (
            <g key={i} transform={`translate(${x - 30} ${y})`}>
              <circle
                r={2.6}
                cx={0}
                cy={0}
                fill="var(--paper)"
                stroke="var(--ok)"
                strokeWidth={0.6}
              />
              <path d="M-1.2,0 L-0.2,1 L1.3,-1.1" fill="none" stroke="var(--ok)" strokeWidth={0.7} />
              <text
                x={-4.5}
                y={1.3}
                textAnchor="end"
                fill="var(--ok)"
                fontSize={3.6}
                fontFamily="var(--font-mono)"
                stroke="var(--paper)"
                strokeWidth={1.4}
                paintOrder="stroke"
              >
                topology ok
              </text>
            </g>
          ))}
        </motion.g>
      </svg>



      <motion.div
        {...(still ? { style: { opacity: 1 } } : { style: { opacity: sub } })}
        className="absolute inset-x-5 bottom-14 h-[18%] overflow-hidden rounded-lg border border-hairline"
      >
        <img
          src={underground.url}
          alt="Underground utility corridors blueprint"
          loading="lazy"
          width={1280}
          height={960}
          className="h-full w-full object-cover opacity-30 grayscale"
        />
        <div className="absolute inset-x-3 bottom-1.5 flex gap-4">
          <span className="font-mono text-[10px] text-ink/70">basement −2</span>
          <span className="font-mono text-[10px] text-ink/70">parking 46</span>
          <span className="font-mono text-[10px] text-ink/70">conduits 3</span>
        </div>
      </motion.div>
    </Canvas>
  );
}

/* ---------------- 05 · ULPIN ---------------- */

const ULPIN = "3D-IND-600001-B03-L12-U02";

export function UlpinVisual({ p, still }: P) {
  const gateFill = useTransform(p, [0.04, 0.2], [0, 1]);
  const passed = useTransform(p, [0.2, 0.26], [0, 1]);
  const chars = useTransform(p, [0.28, 0.66], [0, ULPIN.length]);
  const shown = useTransform(chars, (c) => ULPIN.slice(0, Math.round(c)));
  const frost = useTransform(p, [0.7, 0.95], [0, 1]);
  const border = useTransform(p, [0.72, 0.95], [1, 2.5]);
  return (
    <Canvas p={p} still={still} meta="validation gate" caption="Registry freeze · immutable">
      <div className="absolute inset-0 flex flex-col justify-center gap-6 px-6 sm:px-10">
        {/* gate bar */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="label-xs text-mute">topology · geometry · identity</span>
            <motion.span
              {...(still ? {} : { style: { opacity: passed } })}
              className="label-xs text-ok"
            >
              passed
            </motion.span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-paper-dim">
            <motion.div
              {...(still ? { style: { scaleX: 1 } } : { style: { scaleX: gateFill } })}
              className="h-full w-full origin-left bg-signal"
            />
          </div>
        </div>

        <motion.div
          {...(still
            ? { style: { borderWidth: 2.5 } }
            : { style: { borderWidth: border } })}
          className="relative overflow-hidden rounded-2xl border border-signal bg-signal-soft/60 px-5 py-6"
        >
          <p className="label-xs text-signal-deep">Unique land parcel identification number</p>
          <p className="mt-3 font-mono text-lg break-all text-ink sm:text-2xl">
            {still ? ULPIN : <motion.span>{shown}</motion.span>}
            <span className="ml-0.5 inline-block h-5 w-2 translate-y-0.5 bg-signal" />
          </p>
          {/* frost sheen */}
          <motion.div
            aria-hidden="true"
            {...(still ? { style: { opacity: 0.5 } } : { style: { opacity: frost } })}
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "linear-gradient(115deg, color-mix(in oklab, var(--paper) 65%, transparent), transparent 45%, color-mix(in oklab, var(--signal-soft) 80%, transparent))",
            }}
          />
        </motion.div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            ["pincode", "600001"],
            ["body", "B03"],
            ["floor", "L12"],
            ["unit", "U02"],
          ].map(([k, v], i) => {
            const o = useTransform(p, [0.5 + i * 0.05, 0.62 + i * 0.05], [0, 1]);
            const x = useTransform(p, [0.5 + i * 0.05, 0.62 + i * 0.05], [14, 0]);
            return (
              <motion.div
                key={k}
                {...(still ? {} : { style: { opacity: o, x } })}
                className="rounded-lg border border-hairline bg-paper px-3 py-2"
              >
                <p className="label-xs text-mute">{k}</p>
                <p className="font-mono text-sm text-signal-deep">{v}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </Canvas>
  );
}

/* ---------------- 06 · Digital twin ---------------- */

const CITY = [
  { x: 0, y: 0, w: 16, d: 16, h: 26, floors: 3 },
  { x: 20, y: 0, w: 14, d: 16, h: 48, floors: 6 },
  { x: 38, y: 0, w: 16, d: 16, h: 18, floors: 2 },
  { x: 0, y: 20, w: 16, d: 14, h: 62, floors: 9 },
  { x: 20, y: 20, w: 14, d: 14, h: 34, floors: 4, hero: true },
  { x: 38, y: 20, w: 16, d: 14, h: 88, floors: 13 },
  { x: 0, y: 38, w: 16, d: 16, h: 30, floors: 4 },
  { x: 20, y: 38, w: 14, d: 16, h: 20, floors: 2 },
  { x: 38, y: 38, w: 16, d: 16, h: 52, floors: 7 },
  // painter's order: far (small x+y) first so nearer masses overlap correctly
].sort((a, b) => a.x + a.y - (b.x + b.y));


export function TwinVisual({ p, still }: P) {
  const orbit = useTransform(p, [0, 1], [-6, 6]);
  const lift = useTransform(p, [0.72, 1], [0, -10]);
  const imgO = useTransform(p, [0.05, 0.4], [0.14, 0.05]);
  const pulse = useTransform(p, [0.3, 1], [0, -40]);
  const highlight = useTransform(p, [0.5, 0.66, 0.8], [0, 1, 0.35]);
  return (
    <Canvas p={p} still={still} meta="Intel City · twin viewer" caption="Roam · floors · interiors · underground">
      <motion.img
        src={twin.url}
        alt="Assembled 3D digital twin of Intel City"
        loading="lazy"
        width={1600}
        height={1000}
        {...(still ? { style: { opacity: 0.07 } } : { style: { opacity: imgO } })}
        className="absolute inset-0 h-full w-full object-cover grayscale"
      />
      <motion.svg
        viewBox="-70 -80 140 150"
        className="absolute inset-0 h-full w-full"
        aria-hidden="true"
        {...(still ? {} : { style: { x: orbit, y: lift } })}
      >
        {/* underground conduits */}
        {[6, 26, 46].map((o) => (
          <g key={o}>
            <line
              x1={iso(-4, o, -14)[0]}
              y1={iso(-4, o, -14)[1]}
              x2={iso(58, o, -14)[0]}
              y2={iso(58, o, -14)[1]}
              stroke="var(--signal)"
              strokeOpacity={0.3}
              strokeWidth={0.9}
            />
            <motion.line
              x1={iso(-4, o, -14)[0]}
              y1={iso(-4, o, -14)[1]}
              x2={iso(58, o, -14)[0]}
              y2={iso(58, o, -14)[1]}
              stroke="var(--signal)"
              strokeWidth={1.1}
              strokeDasharray="6 54"
              {...(still ? {} : { style: { strokeDashoffset: pulse } })}
            />
          </g>
        ))}
        {CITY.map((b, i) => {
          const start = 0.04 + i * 0.045;
          const grow = useTransform(p, [start, start + 0.2], [0.05, 1]);
          const isHero = "hero" in b && b.hero === true;
          return (
            <g key={i} opacity={0.8 + 0.2 * ((b.x + b.y) / 76)}>
              <IsoBox x={b.x} y={b.y} w={b.w} d={b.d} h={b.h} floors={b.floors} grow={grow} still={still} />
              {isHero ? (

                <motion.polygon
                  points={pts([
                    iso(b.x - 2, b.y - 2),
                    iso(b.x + b.w + 2, b.y - 2),
                    iso(b.x + b.w + 2, b.y + b.d + 2),
                    iso(b.x - 2, b.y + b.d + 2),
                  ])}
                  fill="none"
                  stroke="var(--signal)"
                  strokeWidth={0.8}
                  strokeDasharray="3 2"
                  {...(still ? {} : { style: { opacity: highlight } })}
                />
              ) : null}
            </g>
          );
        })}
        <motion.text
          x={-62}
          y={66}
          textAnchor="start"

          fill="var(--signal-deep)"
          fontSize={4.2}
          fontFamily="var(--font-mono)"
          stroke="var(--paper)"
          strokeWidth={1.5}
          paintOrder="stroke"
          {...(still ? {} : { style: { opacity: highlight } })}
        >

          citizen view · 1 unit
        </motion.text>
      </motion.svg>
      <div className="absolute top-11 left-5 font-mono text-[10px] text-mute">PIN 600001</div>
    </Canvas>
  );
}

export const VISUALS = [
  IngestionVisual,
  PolygonVisual,
  ReconstructionVisual,
  CadastralVisual,
  UlpinVisual,
  TwinVisual,
];
