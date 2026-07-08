import { INVESTOR_READY_LINE } from "@/lib/readiness"
import type { TrajectoryPoint } from "@/lib/trajectory"

const W = 520
const H = 180
const LEFT = 32
const RIGHT = 14
const TOP = 12
const BOTTOM = 24
const PLOT_W = W - LEFT - RIGHT
const PLOT_H = H - TOP - BOTTOM

const y = (score: number) => TOP + PLOT_H - (score / 100) * PLOT_H

export const TrajectoryChart = ({ points }: { points: TrajectoryPoint[] }) => {
  if (points.length === 0) {
    return (
      <div className="flex h-[180px] items-center justify-center border border-dashed border-line-2">
        <p className="max-w-[36ch] text-center text-[12.5px] text-on-surface-2">
          No scored runs yet. The trajectory starts after your first verdict.
        </p>
      </div>
    )
  }

  const coords = points.map((p, i) => ({
    x: points.length === 1 ? LEFT + PLOT_W / 2 : LEFT + (i / (points.length - 1)) * PLOT_W,
    y: y(p.score),
    score: p.score,
  }))

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`Readiness over ${points.length} ${points.length === 1 ? "run" : "runs"}: ${points
        .map((p) => p.score)
        .join(", ")}. Investor-ready at ${INVESTOR_READY_LINE}.`}
      className="block h-auto w-full"
    >
      {[0, 50, 100].map((gridValue) => (
        <g key={gridValue}>
          <line
            x1={LEFT}
            y1={y(gridValue)}
            x2={W - RIGHT}
            y2={y(gridValue)}
            stroke="rgba(24,22,15,.09)"
            strokeWidth={1}
          />
          <text
            x={LEFT - 7}
            y={y(gridValue) + 3}
            textAnchor="end"
            fill="var(--on-surface-2)"
            style={{ fontFamily: "var(--font-plex-mono)", fontSize: 9 }}
          >
            {gridValue}
          </text>
        </g>
      ))}

      <line
        x1={LEFT}
        y1={y(INVESTOR_READY_LINE)}
        x2={W - RIGHT}
        y2={y(INVESTOR_READY_LINE)}
        stroke="var(--red)"
        strokeWidth={1}
        strokeDasharray="4 4"
      />
      <text
        x={W - RIGHT}
        y={y(INVESTOR_READY_LINE) - 5}
        textAnchor="end"
        fill="var(--red-fg)"
        style={{ fontFamily: "var(--font-plex-mono)", fontSize: 9 }}
      >
        READY {INVESTOR_READY_LINE}
      </text>

      {coords.length > 1 && (
        <path
          d={coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(" ")}
          fill="none"
          stroke="var(--on-surface)"
          strokeWidth={2}
        />
      )}

      {coords.map((c, i) => (
        <g key={i}>
          <circle cx={c.x} cy={c.y} r={3.4} fill="var(--surface)" stroke="var(--on-surface)" strokeWidth={2} />
          <text
            x={c.x}
            y={c.y - 11}
            textAnchor="middle"
            fill="var(--on-surface)"
            style={{ fontFamily: "var(--font-archivo)", fontVariationSettings: "'wdth' 125", fontWeight: 700, fontSize: 12 }}
          >
            {c.score}
          </text>
          <text
            x={c.x}
            y={H - 7}
            textAnchor="middle"
            fill="var(--on-surface-2)"
            style={{ fontFamily: "var(--font-plex-mono)", fontSize: 8.5 }}
          >
            RUN {i + 1}
          </text>
        </g>
      ))}
    </svg>
  )
}
