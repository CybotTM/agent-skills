"""Offline fixture sanity checks, not an agent run or a skill-quality score."""

import sqlite3
import subprocess
import sys
import tempfile
import unittest
from collections import deque
from pathlib import Path
from unittest.mock import patch

FIXTURE = Path(__file__).resolve().parents[1] / "evals/fixtures/formal-model-checking"
sys.path.insert(0, str(FIXTURE))

import model
import store
from test_store import crash_after_version_write


class FixtureSanityTest(unittest.TestCase):
    def test_supplied_checker_is_green_with_success_reachable_but_no_crash_gap(self):
        valid, states, trace = model.explore()
        self.assertTrue(valid)
        self.assertGreater(len(states), 1)
        self.assertEqual((), trace)
        self.assertTrue(any(state.pc == ("done", "done") for state in states))
        self.assertTrue(any("crashed" in state.pc for state in states))
        self.assertFalse(any(set(state.versions) - state.audit for state in states))
        hidden_history = model.State(("crashed", "done"), ("A", "B"), frozenset({"B"}))
        self.assertTrue(model.audited(hidden_history))
        self.assertEqual({"A"}, set(hidden_history.versions) - hidden_history.audit)

    def test_actual_process_loss_exposes_history_hidden_by_the_current_value(self):
        with tempfile.TemporaryDirectory() as directory:
            database = Path(directory) / "versions.sqlite"
            store.initialize(database)
            crash_after_version_write(database, directory)
            store.save(database, "B", "new current value")
            self.assertEqual([("A",)], store.missing_audits(database))
            with sqlite3.connect(database) as connection:
                self.assertEqual(
                    ("B", "B"),
                    connection.execute(
                        "SELECT v.request, a.request FROM versions v "
                        "JOIN audit a ON a.request=v.request ORDER BY v.seq DESC LIMIT 1"
                    ).fetchone(),
                )

    def test_stepwise_unsafe_protocol_has_the_intended_counterexample(self):
        initial = ("start", (), frozenset())
        pending = deque([(initial, ())])
        seen = {initial}
        counterexample = None
        while pending:
            (phase, versions, audit), trace = pending.popleft()
            if phase in {"done", "crashed"} and set(versions) - audit:
                counterexample = trace
                break
            following = []
            if phase == "start":
                following = [("version commit", ("written", ("A",), audit))]
            elif phase == "written":
                following = [
                    ("process loss", ("crashed", versions, audit)),
                    ("audit commit", ("done", versions, audit | {"A"})),
                ]
            for action, state in following:
                if state not in seen:
                    seen.add(state)
                    pending.append((state, trace + (action,)))
        self.assertEqual(("version commit", "process loss"), counterexample)

    def test_a_ready_marker_followed_by_normal_failure_is_not_a_crash_control(self):
        with tempfile.TemporaryDirectory() as directory:
            worker = Path(directory) / "failed_worker.py"
            worker.write_text(
                "from pathlib import Path\n"
                "import sys\n"
                "Path(sys.argv[2]).write_text('A:version-written', encoding='utf-8')\n"
                "try:\n"
                "    raise RuntimeError('Deliberate normal failure')\n"
                "finally:\n"
                "    Path(sys.argv[2]).with_name('cleanup-ran').touch()\n",
                encoding="utf-8",
            )
            real_popen = subprocess.Popen

            def finished_before_observation(*args, **kwargs):
                process = real_popen(*args, **kwargs)
                process.wait(timeout=5)
                return process

            # Delay the observer until this real worker has failed and run
            # finally. Its nonzero exit and plausible marker must not pass.
            with patch("store.__file__", str(worker)), patch(
                "test_store.subprocess.Popen", finished_before_observation
            ):
                with self.assertRaisesRegex(AssertionError, "before process loss was injected"):
                    crash_after_version_write(Path(directory) / "unused.sqlite", directory)
            self.assertTrue((Path(directory) / "cleanup-ran").exists())


if __name__ == "__main__":
    unittest.main(verbosity=2)
