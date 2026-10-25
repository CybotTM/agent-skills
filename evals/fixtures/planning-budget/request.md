Plan a small billing change. Write tasks/plan.md and tasks/todo.md; do not
implement, deploy, send messages, purchase anything or change approval rules.
The accepted behavior is to keep zero-cost invoices visible while suppressing
only their payment reminders. Existing invoice listing and all reminders for
positive balances must keep working.

The billing module and notification module have separate owners. Their shared
invoice-balance contract must be agreed before implementations run in parallel.
One reviewer can inspect the ordinary change; separate security expertise is
needed only if a trust boundary actually changes. The review budget covers all
active workflows together. Identify stop conditions and the evidence that a
later source change would invalidate. No extra human approval is needed for
writing this plan under the present authorization.
