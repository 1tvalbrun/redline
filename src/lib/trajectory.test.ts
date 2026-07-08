import test from "node:test"
import assert from "node:assert/strict"
import { deriveTrajectory } from "./trajectory.ts"

test("zero runs yields an empty trajectory", () => {
  assert.deepEqual(deriveTrajectory([]), [])
})

test("a single scored run yields a single point", () => {
  assert.deepEqual(deriveTrajectory([{ at: 100, score: 41 }]), [{ at: 100, score: 41 }])
})

test("unscored runs are excluded, not plotted", () => {
  const points = deriveTrajectory([
    { at: 100, score: 41 },
    { at: 200, score: null },
    { at: 300, score: 62 },
  ])
  assert.deepEqual(points, [
    { at: 100, score: 41 },
    { at: 300, score: 62 },
  ])
})

test("points are ordered chronologically regardless of input order", () => {
  const points = deriveTrajectory([
    { at: 300, score: 62 },
    { at: 100, score: 41 },
    { at: 200, score: 55 },
  ])
  assert.deepEqual(
    points.map((p) => p.score),
    [41, 55, 62]
  )
})

test("non-finite scores are treated as unscored", () => {
  assert.deepEqual(deriveTrajectory([{ at: 100, score: NaN }]), [])
})
