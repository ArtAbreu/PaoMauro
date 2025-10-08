import sqlite3
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional

DB_PATH = Path(__file__).resolve().parent / "delivery.db"

SCHEMA = """
CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT,
    address TEXT,
    latitude REAL,
    longitude REAL,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS deliveries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL,
    scheduled_date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    quantity INTEGER,
    notes TEXT,
    completed_at TEXT,
    FOREIGN KEY (client_id) REFERENCES clients(id)
);

CREATE TABLE IF NOT EXISTS driver_positions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT DEFAULT (datetime('now')),
    latitude REAL NOT NULL,
    longitude REAL NOT NULL
);
"""


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def initialize() -> None:
    conn = get_connection()
    try:
        conn.executescript(SCHEMA)
        conn.commit()
    finally:
        conn.close()


def fetch_all(query: str, params: Iterable[Any] = ()) -> List[Dict[str, Any]]:
    conn = get_connection()
    try:
        cur = conn.execute(query, tuple(params))
        rows = [dict(row) for row in cur.fetchall()]
        return rows
    finally:
        conn.close()


def fetch_one(query: str, params: Iterable[Any]) -> Optional[Dict[str, Any]]:
    conn = get_connection()
    try:
        cur = conn.execute(query, tuple(params))
        row = cur.fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def execute(query: str, params: Iterable[Any] = ()) -> int:
    conn = get_connection()
    try:
        cur = conn.execute(query, tuple(params))
        conn.commit()
        return cur.lastrowid
    finally:
        conn.close()
