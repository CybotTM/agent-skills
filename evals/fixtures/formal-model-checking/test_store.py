import os
import signal
import sqlite3
import subprocess
import sys
import tempfile
import time
import unittest
from pathlib import Path

import store


def crash_after_version_write(database, directory):
    marker = Path(directory) / "checkpoint"
    with subprocess.Popen(
        [sys.executable, str(Path(store.__file__)), str(database), str(marker)],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.PIPE,
        text=True,
    ) as process:
        try:
            deadline = time.monotonic() + 5
            while not marker.exists():
                if process.poll() is not None or time.monotonic() >= deadline:
                    raise AssertionError("Worker never reached the version-written checkpoint")
                time.sleep(0.01)
            if marker.read_text(encoding="utf-8") != "A:version-written":
                raise AssertionError("Worker checkpoint had unexpected contents")
            if process.poll() is not None:
                raise AssertionError("Worker exited before process loss was injected")
            process.kill()
            process.wait(timeout=5)
            if os.name == "posix" and process.returncode != -signal.SIGKILL:
                raise AssertionError("The worker did not exit through the injected SIGKILL")
            if process.returncode == 0:
                raise AssertionError("The worker completed instead of being killed")
        finally:
            if process.poll() is None:
                process.kill()
                process.wait(timeout=5)


class VersionAuditTest(unittest.TestCase):
    def test_successful_save_has_an_audit(self):
        with tempfile.TemporaryDirectory() as directory:
            database = Path(directory) / "versions.sqlite"
            store.initialize(database)
            store.save(database, "A", "first value")
            self.assertEqual([], store.missing_audits(database))

    def test_worker_loss_cannot_leave_unaudited_history_after_another_save(self):
        with tempfile.TemporaryDirectory() as directory:
            database = Path(directory) / "versions.sqlite"
            store.initialize(database)
            crash_after_version_write(database, directory)
            store.save(database, "B", "new current value")
            with sqlite3.connect(database) as connection:
                self.assertEqual(
                    ("B", "B"),
                    connection.execute(
                        "SELECT v.request, a.request FROM versions v "
                        "LEFT JOIN audit a ON a.request=v.request ORDER BY v.seq DESC LIMIT 1"
                    ).fetchone(),
                )
            self.assertEqual([], store.missing_audits(database))


if __name__ == "__main__":
    unittest.main()
