"""Local SQLite version writer; the checkpoint lets tests observe a write."""

import sqlite3
import sys
import time
from pathlib import Path


def initialize(database):
    with sqlite3.connect(database) as connection:
        connection.executescript(
            "CREATE TABLE versions (seq INTEGER PRIMARY KEY, request TEXT UNIQUE, value TEXT);"
            "CREATE TABLE audit (request TEXT PRIMARY KEY);"
        )


def save(database, request, value, checkpoint=lambda: None):
    connection = sqlite3.connect(database, isolation_level=None)
    try:
        connection.execute(
            "INSERT INTO versions(request, value) VALUES (?, ?)", (request, value)
        )
        checkpoint()
        connection.execute("INSERT INTO audit(request) VALUES (?)", (request,))
    finally:
        connection.close()


def missing_audits(database):
    with sqlite3.connect(database) as connection:
        return connection.execute(
            "SELECT v.request FROM versions v LEFT JOIN audit a ON a.request=v.request "
            "WHERE a.request IS NULL ORDER BY v.seq"
        ).fetchall()


def worker(database, marker):
    def checkpoint():
        ready = Path(marker).with_suffix(".tmp")
        ready.write_text("A:version-written", encoding="utf-8")
        ready.replace(marker)
        while True:
            time.sleep(0.01)

    save(database, "A", "first value", checkpoint)


if __name__ == "__main__":
    worker(*sys.argv[1:])
