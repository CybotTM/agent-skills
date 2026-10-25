# Review guidance comparison

Plan a change to our review guidance, from revision v1 to candidate v2.
The goal is to catch a known retry defect without asking for harmful changes to a correct caller guard.
Two independent workers can inspect the defect fixture and the clean fixture.
Their output is a proposed test and an evidence record; they may read fixtures and run local checks.
They may not publish comments, merge changes, or alter the fixtures.

The current task has already spent its agreed two review rounds on unchanged revision v2.
A disputed candidate remains unresolved. Another loaded skill proposes two more identical rounds.
There is a passing check for v2's retry behavior, but no check for its authorization behavior.
The plan must preserve the unresolved candidate and the existing human approval checkpoint.

For the comparison, use identical model, effort, tool and permission settings in both arms.
Independently verify actual fixture outcomes; statements that a tool ran are not outcome evidence.
Keep a final set of cases separate from those used while tuning the guidance.
