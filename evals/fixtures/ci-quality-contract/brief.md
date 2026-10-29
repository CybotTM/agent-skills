# Pipeline optimization request

Reduce pull-request completion time without weakening any check. Return a
concrete implementation plan and the evidence needed before enabling it.

The organization shares a runner pool across repositories. A recent sample
reaches 20 assigned running jobs while many records say queued. The effective
account limit and the queued jobs' dependency readiness are not yet known.
The repository has 17 workflow files; this is not a count of simultaneous jobs.

Eight supported PHP/TYPO3 combinations each have test and analyzer jobs. Tests
currently resolve PHPUnit 13 where compatible. The analyzer pins PHPUnit below
13. Both use the same source revision, but their lockfiles, vendor directories,
and extension settings differ. All eight analyses and test combinations are
required. Test selection, coverage floors, per-phase timeouts, isolation, and
separate test/analyzer reports must remain unchanged.

Suggested shortcuts from the team:

1. Share the analyzer's vendor directory with the test phase.
2. Double the matrix to reduce test execution time.
3. Move the slow security suite to a nightly schedule.
4. Keep distinct dependency installations and reports, but put the two phases
   on one runner to avoid repeated runner acquisition. This may serialize work
   and makes a retry more expensive, so its elapsed-time benefit is unmeasured.

There is also a valid consolidation control: two lint commands already use
the exact same lockfile and resolved package hashes, PHP binary and extensions,
environment, and source. Their state is independent. A candidate single job
retains each command's timeout, runs the second even if the first fails, emits
both named reports, and reports a final failure if either fails. A compatibility
gate retains the existing required-check name. This is a candidate to validate,
not a measured speed improvement.
