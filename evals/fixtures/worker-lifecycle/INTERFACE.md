# Simulated worker interface

This is a planning fixture, not access to live workers. Write `tasks/plan.md`
and `tasks/todo.md`; do not dispatch real work or modify the fixture files.

- `inspect(worker)` returns current status and assignment.
- `message(worker, text)` delivers information only. It never starts an idle
  or completed worker, and a delivery receipt is not execution evidence.
- `dispatch(worker, task)` starts a completed or idle worker on a new task.
  Calling it for a running worker queues another assignment rather than editing
  the current assignment.
- `wait(worker)` obtains progress or the current assignment's result.

The plan must name the worker, observed status and assignment, next permitted
operation, and the evidence needed before claiming that the new task ran.
Recheck status at execution time; the supplied records are planning snapshots.
