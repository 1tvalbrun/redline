# Engineering standards

How this codebase is written and reviewed. The frontend section is the working
standard for all UI and TypeScript. The data section states the principles this
project holds and calls out how they land on Convex, the database it uses.

---

## Frontend

High quality means the least code that fully solves the problem, including the
cases that aren't the happy path, and nothing the problem doesn't yet demand.
When in doubt, write the obvious version, not the clever one.

The one rule that governs all others: don't over-engineer or force anything.
Speculative flexibility, config for needs that don't exist, and premature
optimization are all defects, not diligence. If you're forcing a pattern to fit,
stop and reconsider.

### Principles

- **Least code that fully works.** Solve the real problem with the smallest clear
  implementation: fewer lines, fewer abstractions, fewer dependencies, but never
  by cutting real cases. Concise is not the same as terse; favor readable over
  compact.
- **Declarative over imperative.** Describe the desired result and let the
  framework reconcile it; don't hand-orchestrate steps or poke the DOM. Render
  from state.
- **One source of truth; derive, don't duplicate.** Compute values during render
  from existing state or props instead of storing copies you then have to keep in
  sync. Duplicated state is the most common bug source on the frontend.
- **Handle every state, not just success.** Real UI has loading, empty, error,
  and edge inputs: zero items, very long strings, slow or failed network,
  unauthorized, offline. Account for them explicitly.
- **Name for the next reader.** A name should reveal what a thing is or does
  without a comment. Assume the next person or agent has none of your context.
- **Comments earn their place or they go.** A comment is warranted only when it
  says what the code cannot: a reason, a non-obvious constraint, a workaround and
  the bug behind it. If it restates what the code already shows, delete it. Prefer
  a better name or a smaller function over a comment that excuses confusing code.
- **Abstract on the third repetition, not the first.** Reuse once a real pattern
  has emerged; don't build generic, configurable machinery for a single caller.
- **Make invalid states unrepresentable.** Model data so bad combinations can't be
  constructed; avoid `any`; type the boundaries (props, API responses, function
  signatures).

### React effects

Effects synchronize with external systems: network, the DOM, subscriptions,
timers, non-React widgets. They are not for reacting to React's own data. Most
`useEffect` bugs come from using one where you didn't need it. Before writing one:

- Transforming data for rendering? Compute it during render. No effect.
- Caching an expensive calculation? `useMemo`. No effect.
- Resetting all state when a prop changes? Pass a `key` to the component instead.
- Adjusting some state when a prop changes? Compute during render, or accept the
  value as-is.
- Responding to a user action? Put the logic in the event handler, where the
  action happened, not in an effect that watches for the side effect.
- Fetching data? Acceptable, but handle race conditions (ignore stale responses on
  cleanup) and prefer a query or framework loader where one exists.

An effect whose body only reads and writes React state, with no external system
involved, is almost always a mistake. See
[react.dev/learn/you-might-not-need-an-effect](https://react.dev/learn/you-might-not-need-an-effect).

### Tests

A test earns its place only if a realistic regression in the code it covers would
make it fail.

- Does it assert observable behavior or a contract, not an implementation detail
  that can change while the behavior stays correct?
- Would it actually fail if the logic broke, or does it pass no matter what
  (over-mocked, asserting only that a mock was called, snapshotting trivia)?
- Does it cover the cases that break in practice (edge inputs, error and empty
  paths, boundaries) rather than re-testing the happy path twice?

A green suite that wouldn't catch a regression is worse than no suite; it buys
false confidence.

### Accessibility

- **Semantic HTML first.** `<button>` for actions, `<a>` for navigation, real
  `<label>`, headings, and lists. Native elements give keyboard and screen-reader
  behavior for free.
- **Label every control** and associate it (`htmlFor`/`id`). Images get meaningful
  `alt`, or empty `alt=""` if purely decorative.
- **Keyboard operable.** Everything usable without a mouse, with a visible focus
  indicator and a logical tab order. Move focus deliberately when opening modals or
  changing routes.
- **ARIA only to fill real gaps** native HTML can't cover. A wrong role is worse
  than none.
- **Never rely on color alone** to convey meaning, and meet WCAG AA contrast.

### Before you finish

- Did I write more code, abstraction, or config than the problem requires? Cut it.
- Are loading, empty, and error states all handled, or only the happy path?
- Does any state duplicate something I could derive during render?
- Does every `useEffect` synchronize with an external system, or did one sneak in
  for React-only data?
- Does every test I added fail when the behavior it covers breaks?
- Does every comment say something the code can't?
- Can a keyboard-only user complete this? Are controls labeled and contrast
  sufficient?
- Would the next reader understand this without me explaining it?

---

## Data and backend

A secure database and an efficient one are the same discipline seen from two
sides: both come from moving the least data, to the fewest parties, through the
narrowest path that fully answers the request. The one rule: never trust the
client, and never make the database do work you can avoid. The client can lie
about who it is and how much it will ask for, so authorization and validation
live on the server. The database is the most expensive place to be wasteful, so
the row you don't scan and the request you don't make are the cheapest and safest
ones.

This project runs on Convex, where every read and write goes through a function,
so the function is the security boundary. The principles below are stated
generally, and the Convex specifics are called out at the end.

### Principles

- **Least privilege.** Every function, key, and access path gets the narrowest
  reach that still works. Privileges are added when a real need appears, never
  granted broadly up front. Over-broad access is the blast radius of every future
  mistake.
- **Authorize at the data layer.** The check that decides who may touch a record
  belongs on the only path to that record (here, the server function), so it holds
  no matter which caller hits it. App-layer checks are a convenience for the UI,
  not a security boundary.
- **Fail closed.** Default to deny. An unguarded function, an unmatched condition,
  or an error mid-request must return no data, never "allow because nothing said
  no."
- **One source of truth for authorization.** The logic that answers "can this
  caller touch this record?" lives in one helper that every path reuses. Auth
  rules copied across functions drift, and the stalest copy is the vulnerability.
- **Never build queries from strings.** All input reaches the database through a
  typed query builder and validated arguments, never concatenated into a query
  expression.
- **Validate at the boundary.** Every argument is validated for type, shape, and
  range before it touches storage, and the schema enforces what the code might
  forget.
- **Read only what you need.** Fetch the shape the screen renders and no deeper;
  filter and paginate on the server, not in the client. Over-fetching is a cost
  line, a latency source, and an exposure of fields the caller was never meant to
  see all at once.
- **Index for the queries you actually run.** Every selective filter or sort that
  runs at scale needs a matching index; every index you can't tie to a real query
  is write cost and storage you pay for forever.
- **Make invalid states unrepresentable.** Model the schema so the bad row can't
  be inserted and the orphaned reference can't exist. A constraint the schema
  enforces is worth more than a check the code is supposed to remember.
- **Treat secrets as radioactive.** A privileged key lives only in server
  environments, never in a client bundle, a repo, or a log. Separate keys by scope
  so one leak doesn't compromise everything, and rotate them.

### Before exposing any read or write

- **Is this callable directly, bypassing the UI?** Assume yes. Every check the UI
  "guarantees" must also exist on the server. Design as if the client is an
  attacker holding a valid session.
- **Is the resource scoped by the authenticated identity, never a client-passed
  one?** Derive the caller from the session on the server and filter by it. An id
  taken from request arguments is an invitation to read someone else's data.
- **Should this operation even be public?** Sensitive writes, admin actions, and
  internal jobs should not be client-callable at all. Expose the minimum surface;
  keep everything else internal.
- **What happens on unauthorized access, and on error?** Both must return nothing
  and leak nothing, including through distinct error messages. Fail closed,
  quietly.

A read or write whose only "authorization" is that the correct client is supposed
to call it is unprotected. If you can't point to the server-side check that stops
the wrong caller, it isn't there.

### Query efficiency and cost

- **Does it hit an index, or scan the table?** Any selective filter or sort that
  runs at scale must be index-backed. An unindexed filter reads every row to
  return a few, the single most common source of both slow queries and surprise
  cost.
- **Is it fetching only the columns and rows it uses?** No "load all then filter in
  memory." Push every filter and limit into the query so the database returns the
  final shape.
- **Is it paginated?** Any list that can grow is paginated. Unbounded reads are a
  latency cliff waiting for your data to grow into them.
- **Is it an N+1?** One query in a loop is N+1 in disguise. Fetch the set in one
  round trip rather than per-item requests.
- **Is the same expensive result recomputed?** Cache what you measured as hot, not
  speculatively, and have an invalidation story.
- **Are writes amplifying?** Every index adds write cost. An index earns its keep
  on reads or it's pure overhead on every write.

### Schema and integrity

- **Enforce shape at the schema, not just in code.** Required fields, references,
  and unions or enums turn whole classes of bad data into impossible writes.
  Application validation is the friendly first check; the schema is the guarantee.
- **Validate every argument at the boundary** for type, range, and format before
  it is used. Reject early and specifically.
- **Migrations are checked in and reviewed,** never applied to a live deployment by
  hand.
- **Model to derive, not duplicate.** Denormalize only for a measured read pattern
  that demands it, and when you do, own the sync explicitly. Duplicated data that
  drifts is a correctness bug that also costs storage.

### On Convex specifically

- There is no direct client table access. Every read and write goes through a
  function, so the function is the security boundary. There is no row-level
  security to lean on; ownership is enforced in code, centralized in one helper
  rather than re-checked ad hoc.
- Public `query`, `mutation`, and `action` are client-callable. `internalQuery`,
  `internalMutation`, and `internalAction` are not. Keep sensitive and privileged
  operations internal and call them from other server functions or crons.
- Validate every argument with validators (`v.string()`, `v.id(...)`). When there
  is an authenticated user, derive it from `ctx.auth.getUserIdentity()`; never
  trust an id passed in as an argument for authorization.
- `.filter()` on a query scans every document. Define indexes in the schema
  (`.index("by_field", ["field"])`) and query with `.withIndex()` for anything
  selective; use `.paginate()` for lists. This is the biggest lever on both Convex
  latency and metered read cost.
- Actions can't touch the database directly and aren't transactional. Do reads and
  writes in queries and mutations via `runQuery` and `runMutation`, and keep
  external API calls, with their secrets, in actions.

### Before you finish

- Can this read or write be called directly, bypassing the UI, and is there a
  server-side check that stops the wrong caller?
- Is every resource scoped by the authenticated identity, never a client-supplied
  id?
- Does anything fail open: an unguarded function, an error path that returns data?
- Does every scaled query hit an index instead of scanning?
- Am I selecting only needed columns, paginating growable lists, and avoiding N+1?
- Did I add any index, denormalized copy, or permission the workload doesn't need?
  Cut it.
- Is every secret server-only, scoped, and absent from client code, repos, and
  logs?
- Does the schema itself enforce the invariants, not just the app code?
- Is every argument validated before it reaches a query?

---

## Review protocol

When the task is to review code against these standards rather than write it:

- **Advise first; don't rewrite.** Flag what you find and explain it. Don't change
  code until asked.
- **Nothing to flag is a valid outcome.** If the code meets the standards, say so
  plainly and stop. Don't manufacture issues to look thorough; a false flag wastes
  more time than it saves.
- **Weight by blast radius.** A security hole that exposes data outranks an
  inefficiency that costs money. Say which is which so the reader can triage.
- **Attach a confidence score to every flag,** your real estimate that the change
  would improve quality. Only raise items you're at least 80% confident in; drop
  anything below that line rather than listing it as a maybe.
