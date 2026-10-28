# Settings version audit

This local service retains every saved version. `versions` is append-only
history; the most recent row is the current value. Every committed version must
have its own matching `audit` row, even after another request replaces it.
The database is SQLite, using only the Python standard library.

The checked deployment claim covers two competing requests and abrupt worker
loss at any persistence boundary. It assumes SQLite transactions and ordinary
local storage work correctly. It does not promise availability, automatic
retries, external log delivery or correctness of other database writers.

Commands:

```sh
python3 model.py
python3 -m unittest -v
```

The existing model reports success. The process-loss regression currently
fails: it kills a separate worker only after that worker has inserted a
version, then makes another successful write and examines the retained history.
The checkpoint is an observation seam in the writer, not an audit mechanism.
Keep it usable for a deterministic test; an abrupt kill must not execute Python
cleanup code. The checkpoint is published by atomic rename. On POSIX the test
requires the injected `SIGKILL` exit status; other platforms require the worker
to be alive at injection and to exit unsuccessfully after `Popen.kill()`.

Keep the work small and reproducible without third-party tools. Changes to the
model, the local writer and its tests are in scope. Leave a short model-to-code
mapping, the commands and outcomes, and the limits of the conclusion.
