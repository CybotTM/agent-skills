# Secret writer: release verification

The proposed release keeps `writer.cjs` and adds the local checker and CI wrapper.
Run `node ci.cjs` to reproduce the author verification summary.

The storage API contract is that `writeSecret()` and `appendAudit()` each commit
independently. Process loss may occur after either call. There is no shared
transaction supplied by the caller.

The required release property is that a committed secret update cannot survive
process loss without its matching committed audit entry, including concurrent
requests. `check-model.cjs` accepts `atomic` and `split` model inputs; its exit
codes are 0 for completed success, 12 for an invariant violation with a trace,
and 75 for an invalid model input. It prints the checked model artifact digest.

Author conclusion: CI is green, including the negative control. The formal check
therefore proves that the production writer satisfies the release property for
all requests and failures. No runtime failure tests or further mapping review
are needed before merging.
