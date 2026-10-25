# Wallet change

Review the change from before.py to after.py without editing either file.

A withdrawal is allowed when the amount is positive and no greater than the
balance. Only the account owner may withdraw. The basic account fee is one unit;
the premium fee is zero. Report regressions separately from issues already
present before this change. Runtime and test claims require actual execution.

The change is a proposed boundary-check cleanup. The supplied files are the
reviewed snapshots; compute their content hashes if you need immutable IDs.
