"""Finite audit design check. Run with python3 model.py."""

from collections import deque
from dataclasses import dataclass, replace


@dataclass(frozen=True)
class State:
    pc: tuple[str, str] = ("start", "start")
    versions: tuple[str, ...] = ()
    audit: frozenset[str] = frozenset()


def successors(state):
    for actor, phase in enumerate(state.pc):
        if phase != "start":
            continue
        request = ("A", "B")[actor]
        pc = list(state.pc)
        pc[actor] = "done"
        yield f"{request}: save", State(
            tuple(pc), state.versions + (request,), state.audit | {request}
        )
        pc[actor] = "crashed"
        yield f"{request}: crash", replace(state, pc=tuple(pc))


def audited(state):
    return not state.versions or state.versions[-1] in state.audit


def explore():
    initial = State()
    pending = deque([(initial, ())])
    seen = {initial}
    while pending:
        state, trace = pending.popleft()
        if not audited(state):
            return False, seen, trace
        for action, following in successors(state):
            if following not in seen:
                seen.add(following)
                pending.append((following, trace + (action,)))
    return True, seen, ()


if __name__ == "__main__":
    valid, states, trace = explore()
    print(f"{'PASS' if valid else 'AUDIT VIOLATION'}: {len(states)} states")
    for action in trace:
        print(action)
    raise SystemExit(0 if valid else 2)
