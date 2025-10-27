import backend.database as database


def test_initialize_ensures_coordinate_columns(tmp_path, monkeypatch):
    db_path = tmp_path / "delivery.db"
    monkeypatch.setattr(database, "DB_PATH", db_path)

    database.initialize()

    conn = database.get_connection()
    try:
        columns = {row["name"] for row in conn.execute("PRAGMA table_info(clients)")}
    finally:
        conn.close()

    assert {"latitude", "longitude"}.issubset(columns)

    seeded_clients = database.fetch_all("SELECT latitude, longitude FROM clients")
    assert seeded_clients, "Esperava clientes iniciais para o seed"
    assert any(
        client["latitude"] is not None and client["longitude"] is not None
        for client in seeded_clients
    )


def test_initialize_creates_tracking_tables(tmp_path, monkeypatch):
    db_path = tmp_path / "tracking.db"
    monkeypatch.setattr(database, "DB_PATH", db_path)

    database.initialize()

    conn = database.get_connection()
    try:
        delivery_columns = {row["name"] for row in conn.execute("PRAGMA table_info(deliveries)")}
        visit_columns = {row["name"] for row in conn.execute("PRAGMA table_info(delivery_visits)")}
    finally:
        conn.close()

    assert {"arrived_at", "departed_at", "stay_seconds"}.issubset(delivery_columns)
    assert {"client_id", "detected_at", "status"}.issubset(visit_columns)
