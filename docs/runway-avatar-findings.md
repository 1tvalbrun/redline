# Runway avatar SDK findings

These are findings from building a live-panel product on Runway's GWM
avatars. Each one is backed by something you can check yourself: a line in the
SDK source, or a workaround in this repo. I've included versions and line
numbers so anything here is easy to look up.

Versions under test:
- `@runwayml/avatars-react` 0.15.0 (paths are `dist/index.js`)
- `@runwayml/sdk` 3.21.0
- `livekit-client` 2.18.9 (transitive, via `@livekit/components-react`)

---

## 1. The connect-credentials cache is module-level and is never invalidated

`AvatarProvider` resolves connect credentials through an internal `useQuery`
backed by a module-level `Map`. Once a key resolves to success or error, that
entry is returned on every later mount without re-fetching, and no code path
ever removes it. The key includes `connectUrl`, so two mounts with the same
`avatarId` and `connectUrl` share one entry for the life of the page.

Evidence, `dist/index.js` verbatim:

```js
// L34: the cache is a module-level Map
var cache = /* @__PURE__ */ new Map();

// L60-62: a resolved entry short-circuits, so the fetch never re-runs
const entry = cache.get(queryKey);
if (entry && entry.state.status !== "idle") {
  return;
}

// L145: the key includes connectUrl
const queryKey = `credentials:${avatarId}:${sessionId}:${sessionKey}:${connectUrl}:${baseUrl}`;
```

`grep -c "cache.delete\|cache.clear" dist/index.js` returns `0`. The map only
grows.

Consequence in practice: in a single-page app, leaving the room and
re-entering, or remounting the provider to retry, reuses the previous Runway
session's credentials instead of minting a new session. If that session is
gone, the avatar never appears and retry cannot recover.

Workaround shipped (commit `ce8d422`, `src/components/simulation/room/RoomShell.tsx`):
a per-mount and per-retry nonce in `connectUrl`, so the cache key changes and
each entry mints a fresh session. The route ignores the query string.

```tsx
const [mountNonce] = useState(() => Date.now())                          // L82
connectUrl={`/api/avatar/connect?fresh=${mountNonce}-${connectAttempt}`} // L225
```

Scope: this is the client cache in 0.15.0 only. The server API is not
implicated; `realtimeSessions.create` mints sessions correctly. "Never
invalidated" means within a page's lifetime; a full reload starts a fresh
module and a fresh map.

---

## 2. The avatar status reports "ended" before a connect has started

Avatar status is derived from the LiveKit `ConnectionState`. A room begins in
`Disconnected`, and the SDK maps `Disconnected`, plus the `default` case, to
`"ended"`. There is no separate idle or pre-connect status at this layer.

Evidence, `dist/index.js` L201-213 verbatim:

```js
function mapConnectionState(connectionState) {
  switch (connectionState) {
    case ConnectionState.Connecting:   return "connecting";
    case ConnectionState.Connected:    return "active";
    case ConnectionState.Reconnecting: return "connecting";
    case ConnectionState.Disconnected: return "ended";
    default:                           return "ended";
  }
}
```

Consequence in practice: a fresh room reports `"ended"` before it connects,
so code that treats `"ended"` as terminal can act on a room that has not
finished connecting. If that action unmounts the provider, the connect is
cancelled rather than completed, and `livekit-client` 2.18.9 surfaces a
cancelled connect as a client-originated error (`dist/livekit-client.esm.mjs`
L29087):

```js
connectFuture?.reject?.(ConnectionError.cancelled('Client initiated disconnect'));
```

Workaround shipped (commit `ce8d422`, `RoomShell.tsx` L150): treat `"ended"` as
a failure only after the attempt has been seen reporting `connecting` or
`waiting` first, which separates "closed before it connected" from a real
drop.

```tsx
: attemptStarted && avatarStatus === "ended"
```

Scope: the status mapping is a Runway SDK fact. The disconnect rejection is a
LiveKit fact, cited above. The claim is only that no status distinguishes
pre-connect from ended.

---

## 3. `useTranscription` omits the timing fields the LiveKit segment carries

LiveKit's `TranscriptionSegment` carries per-segment timing. The
`useTranscription` callback in 0.15.0 passes through only `id`, `text`,
`final`, `participantIdentity`, and `channel`. None of the timing fields
appear anywhere in the compiled SDK.

Evidence.

LiveKit segment type, `livekit-client` 2.18.9
(`dist/ts4.2/room/types.d.ts` L70) verbatim:

```ts
export interface TranscriptionSegment {
    id: string;
    text: string;
    language: string;
    startTime: number;
    endTime: number;
    final: boolean;
    firstReceivedTime: number;
    lastReceivedTime: number;
}
```

What `useTranscription` passes to its callback, `avatars-react`
`dist/index.js` L1234-1240 verbatim:

```js
handlerRef.current({
  id: segment.id,
  text: segment.text,
  final: segment.final,
  participantIdentity: identity,
  channel: "native"
});
```

`grep -c "startTime\|endTime\|firstReceivedTime\|lastReceivedTime"
dist/index.js` returns `0`.

Consequence in practice: to order a transcript, there is no timing on the
segment to sort by.

Workaround shipped (commit `487765c`,
`src/components/simulation/room/TranscriptBridge.tsx` L41): stamp each turn
with the wall-clock time of the first delta seen for its id, and sort on that.

```tsx
const spokenAt = firstSeenAt.current.get(entry.id) ?? Date.now()
```

Scope: this is about the hook's public callback shape only. The raw LiveKit
layer clearly carries timing, as the segment type shows. Arrival-time
stamping approximates speech onset and is adequate for ordering
non-overlapping turns.
