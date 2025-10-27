"""SQLite helpers for the bakery delivery application."""

from __future__ import annotations

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

CREATE TABLE IF NOT EXISTS delivery_visits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    delivery_id INTEGER,
    client_id INTEGER,
    detected_at TEXT DEFAULT (datetime('now')),
    confirmed_at TEXT,
    stay_seconds INTEGER,
    quantity INTEGER,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'detected',
    FOREIGN KEY (delivery_id) REFERENCES deliveries(id),
    FOREIGN KEY (client_id) REFERENCES clients(id)
);
"""

IDEAL_SUPERMARKETS = (
    {
        "name": "Supermercado Ideal - Centro",
        "phone": "(11) 1111-1111",
        "address": "Av. Paulista, 1000 - Bela Vista, São Paulo - SP",
        "latitude": -23.564003,
        "longitude": -46.652267,
        "notes": "Entrega diária de pães frescos",
    },
    {
        "name": "Supermercado Ideal - Jardim",
        "phone": "(11) 2222-2222",
        "address": "R. Haddock Lobo, 595 - Cerqueira César, São Paulo - SP",
        "latitude": -23.560383,
        "longitude": -46.661712,
        "notes": "Preferência por entregas antes das 9h",
    },
    {
        "name": "Supermercado Ideal - Norte",
        "phone": "(11) 3333-3333",
        "address": "Av. Cruzeiro do Sul, 3000 - Santana, São Paulo - SP",
        "latitude": -23.500855,
        "longitude": -46.624439,
        "notes": "Estacionar na doca 2",
    },
    {
        "name": "Supermercado Ideal - Sul",
        "phone": "(11) 4444-4444",
        "address": "Av. Interlagos, 2555 - Interlagos, São Paulo - SP",
        "latitude": -23.678547,
        "longitude": -46.689316,
        "notes": "Conferir estoque com gerente Carlos",
    },
    {
        "name": "Supermercado Ideal - Leste",
        "phone": "(11) 5555-5555",
        "address": "Av. Aricanduva, 5000 - Jardim Santa Terezinha, São Paulo - SP",
        "latitude": -23.560942,
        "longitude": -46.504947,
        "notes": "Entrega às segundas, quartas e sextas",
    },
)


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def initialize() -> None:
    conn = get_connection()
    try:
        conn.executescript(SCHEMA)
        ensure_delivery_tracking_columns(conn)
        ensure_client_coordinate_columns(conn)
        seed_initial_clients(conn)
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


def ensure_client_coordinate_columns(conn: sqlite3.Connection) -> None:
    columns = {
        row["name"]
        for row in conn.execute("PRAGMA table_info(clients)")
    }
    if "latitude" not in columns:
        conn.execute("ALTER TABLE clients ADD COLUMN latitude REAL")
    if "longitude" not in columns:
        conn.execute("ALTER TABLE clients ADD COLUMN longitude REAL")


def ensure_delivery_tracking_columns(conn: sqlite3.Connection) -> None:
    columns = {
        row["name"]
        for row in conn.execute("PRAGMA table_info(deliveries)")
    }
    if "arrived_at" not in columns:
        conn.execute("ALTER TABLE deliveries ADD COLUMN arrived_at TEXT")
    if "departed_at" not in columns:
        conn.execute("ALTER TABLE deliveries ADD COLUMN departed_at TEXT")
    if "stay_seconds" not in columns:
        conn.execute("ALTER TABLE deliveries ADD COLUMN stay_seconds INTEGER")


def seed_initial_clients(conn: sqlite3.Connection) -> None:
    for client in IDEAL_SUPERMARKETS:
        exists = conn.execute(
            "SELECT 1 FROM clients WHERE name = ?",
            (client["name"],),
        ).fetchone()
        if exists:
            continue
        conn.execute(
            """
            INSERT INTO clients (name, phone, address, latitude, longitude, notes)
            VALUES (:name, :phone, :address, :latitude, :longitude, :notes)
            """,
            client,
        )
