---
name: formal-model-checking
description: Builds and checks small finite-state specifications of concurrency, persistence, retries and failures. Use when asked for model checking, TLA+/TLC, or systematic analysis of a specific invariant across interleavings, crashes or recovery. Connects counterexamples to implementation tests without claiming a whole-program proof.
---

# Formal Model Checking

## Overview

Use a small executable model to test a precise design claim. Keep its result
separate from evidence that the implementation follows that design. Choose a
formalism appropriate to the question; TLA+/TLC is useful for state transitions,
concurrency and failures, but is not mandatory for every correctness task.

## When to Use

Use for an explicit model-checking request or a concrete guarantee that needs
systematic exploration of orderings or failures. For ordinary bug fixes and
unit tests, use `test-driven-development`; for reviewing existing evidence,
use `code-review-and-quality`. Do not introduce a formal model for every change.

## Scope the claim

Name the operation, property, initial states and environment assumptions.
Distinguish safety (something bad never happens) from liveness (something good
eventually happens). A safety result for a bounded model does not establish
correctness outside that domain, or liveness, termination, fairness or eventual
delivery. Exhausting a finite state graph covers its modeled execution lengths;
a depth-limited search covers only the explored lengths.

Record process/value bounds, platform and checker version. Do not turn a
successful check into a whole-application or source/binary equivalence claim.
For external proof claims, inspect the exact theorem and its trusted components;
a proof of error freedom or behavior agreement need not imply termination.

## Model the actual boundary

Separate pending state from committed state. Include failures and process loss
at each meaningful persistence boundary, and include competing actors when
ordering affects the property. A thrown exception is not process termination:
a crash executes no catch/finally code.

Keep historical committed operations observable when the claim covers every
mutation. Checking only the latest secret or record can hide an earlier
unaudited change once it is overwritten or deleted. Abstract data only when the
abstraction preserves the property; do not make success atomic in the model
without finding the real implementation boundary that justifies that step.

When implementation exists, map model actions to its concrete boundaries; for
database operations, these may include connection identities, transaction
owners, savepoints, isolation and lock lifetime. A savepoint release is not an
outer commit. Include relationship tables and anchors if they are part of the
claim. External files, network sinks and events do not participate in a normal
database transaction. Post-commit publication is not reliable eventual delivery.

Do not silently expand a local-adapter result to custom adapters, unrelated
writers, metadata hooks, counters or all application paths.

## Execute positive and negative controls

Run the intended model, keeping its configuration and result. A valid
counterexample is a useful result and may complete a bug-finding assignment;
do not hide it by weakening the property. For a positive claim, require a
complete successful search, not merely parsing, a zero exit status or a partial
log. A timeout or missing tool leaves the check incomplete.

For a positive claim, run a known-bad variant and require a violation of the
intended invariant plus a real counterexample trace. Arbitrary nonzero exit
codes, syntax errors and wrong invariants are failed controls. Verify that
successful operations and the
important failure/concurrency paths are reachable: an unreachable success can
make the desired safety rule vacuously true. State constraints must not prune
the very behavior under investigation.

## Connect the result to runtime evidence

When implementation verification or repair is in scope, translate useful
counterexamples into regression tests against the real implementation.
Establish a failing baseline or deliberately broken variant, then verify the
correction. Test actual database state and effects, not just
mocked begin/commit calls. Use a separate process and a verified barrier for a
process-loss claim; a bootstrap error must not count as a successful crash test.
Coordinate concurrent requests with observable barriers and bounded waits.

Check secondary interactions exposed by the new boundary. Examples include
locks released before the final commit, audit IDs consumed by rolled-back
inserts, stale compensation overwriting another request, and external effects
emitted before commit. Validate any proposed repair against the existing
security contract; avoiding false alarms must not conceal actual tampering.

## Report and maintain

Report separately: checked model property and bounds; implementation tests and
input revision; assumptions and excluded paths; incomplete checks and residual
risks. A refinement proof would be a separate artifact; tests do not supply one.
For a maintained implementation, keep the model-to-code mapping with the
project and integrate checker reruns when the modeled boundary changes.
For design-only work, state that runtime conformance remains unverified.
Review the model's specification itself, not only the tool's green result.
Reuse a relevant tested protocol; do not impose
a global lock, transaction coordinator or outbox without the task requiring it.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "The checker was green, so the application is proven." | The result covers the specified model and bounds; implementation conformance needs separate evidence. |
| "The broken version exited nonzero, so the control passed." | Require a trace violating the intended property; a syntax error or timeout tests nothing about that property. |
| "No successful operation means no unaudited success." | Show success and the relevant failure paths are reachable to exclude a vacuous result. |

## Red Flags

Success made atomic without a matching runtime boundary; crashes modeled as
exceptions; only the latest record checked; success excluded by a state
constraint; a parser error accepted as a counterexample; a model result reported
as proof of the application.

## Verification

- Record the property, bounds, assumptions, checker version and input revision.
- Retain the discovered counterexample, or the complete positive result with a validated negative control; include reachability evidence.
- Map model actions to implementation boundaries where code exists; report runtime checks separately or explicitly leave conformance unverified.
- State excluded paths and incomplete checks; do not claim a refinement proof from tests.
