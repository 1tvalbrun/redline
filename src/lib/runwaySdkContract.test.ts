import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

// RoomShell's credentials-cache workaround (docs/runway-avatar-findings.md
// §1) rests on two facts about @runwayml/avatars-react internals. The first
// workaround died silently when a refactor stopped exercising them —
// observed live 2026-08-28 as "Go again" joining the previous session's
// dead room. These assertions make an SDK upgrade that changes either fact
// fail the suite instead of breaking same-persona re-entry in production.
const dist = readFileSync("node_modules/@runwayml/avatars-react/dist/index.js", "utf8")

test("SDK credentials cache key still includes connectUrl", () => {
  assert.ok(
    dist.includes(
      "`credentials:${avatarId}:${sessionId}:${sessionKey}:${connectUrl}:${baseUrl}`"
    ),
    "cache key shape changed — re-verify the RoomShell connectUrl workaround"
  )
})

test("SDK fetchCredentials still prefers the connect callback over connectUrl", () => {
  const connectBranch = dist.indexOf("if (connect) {")
  const connectUrlBranch = dist.indexOf("if (connectUrl) {")
  assert.ok(connectBranch !== -1, "connect branch not found — re-verify the workaround")
  assert.ok(connectUrlBranch !== -1, "connectUrl branch not found — re-verify the workaround")
  assert.ok(
    connectBranch < connectUrlBranch,
    "branch order changed — connectUrl may no longer be inert alongside connect"
  )
})
