import json
import os
from datetime import datetime, timedelta
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Tuple
from urllib.parse import parse_qs, urlparse

from database import execute, fetch_all, fetch_one, initialize
from routes_logic import nearest_neighbor_route, haversine_distance

FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend"
DEFAULT_START = (-23.55052, -46.633308)  # São Paulo como ponto inicial padrão

STOP_TIME_THRESHOLD_SECONDS = 120
STOP_DISTANCE_THRESHOLD_KM = 0.05
STOP_CLIENT_RADIUS_KM = 0.25
STOP_DUPLICATE_WINDOW_MINUTES = 20


class RequestHandler(BaseHTTPRequestHandler):
    server_version = "BakeryDelivery/1.0"

    def log_message(self, format: str, *args) -> None:
        return  # silencia logs padrão

    def _set_headers(self, status: int = 200, content_type: str = "application/json") -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_OPTIONS(self) -> None:  # noqa: N802
        self._set_headers()

    def do_GET(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        if parsed.path.startswith("/api/"):
            self.handle_api_get(parsed)
        else:
            self.serve_static(parsed.path)

    def do_POST(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length) if length else b"{}"
        payload = json.loads(body.decode("utf-8")) if body else {}

        if parsed.path == "/api/clients":
            self.create_client(payload)
        elif parsed.path == "/api/deliveries":
            self.create_delivery(payload)
        elif parsed.path.endswith("/complete"):
            self.complete_delivery(parsed.path, payload)
        elif parsed.path == "/api/driver/location":
            self.record_location(payload)
        elif parsed.path == "/api/routes":
            self.generate_route(payload)
        elif parsed.path.startswith("/api/driver/stops/") and parsed.path.endswith("/ack"):
            self.acknowledge_stop(parsed.path, payload)
        else:
            self._set_headers(404)
            self.wfile.write(json.dumps({"error": "Endpoint não encontrado"}).encode())

    def do_PUT(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        if not parsed.path.startswith("/api/clients/"):
            self._set_headers(404)
            self.wfile.write(json.dumps({"error": "Endpoint não encontrado"}).encode())
            return

        client_id = parsed.path.split("/")[-1]
        length = int(self.headers.get("Content-Length", 0))
        payload = json.loads(self.rfile.read(length) or b"{}")
        execute(
            "UPDATE clients SET name = ?, phone = ?, address = ?, latitude = ?, longitude = ?, notes = ? WHERE id = ?",
            (
                payload.get("name"),
                payload.get("phone"),
                payload.get("address"),
                payload.get("latitude"),
                payload.get("longitude"),
                payload.get("notes"),
                client_id,
            ),
        )
        self._set_headers(200)
        self.wfile.write(json.dumps({"status": "ok"}).encode())

    def do_DELETE(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        if not parsed.path.startswith("/api/clients/"):
            self._set_headers(404)
            self.wfile.write(json.dumps({"error": "Endpoint não encontrado"}).encode())
            return
        client_id = parsed.path.split("/")[-1]
        execute("DELETE FROM clients WHERE id = ?", (client_id,))
        self._set_headers(200)
        self.wfile.write(json.dumps({"status": "ok"}).encode())

    # API handlers
    def handle_api_get(self, parsed) -> None:
        if parsed.path == "/api/clients":
            clients = fetch_all("SELECT * FROM clients ORDER BY name")
            self._set_headers(200)
            self.wfile.write(json.dumps(clients).encode())
        elif parsed.path == "/api/deliveries":
            params = parse_qs(parsed.query)
            date = params.get("date", [None])[0]
            query = "SELECT deliveries.*, clients.name as client_name FROM deliveries JOIN clients ON clients.id = deliveries.client_id"
            args: Tuple = ()
            if date:
                query += " WHERE scheduled_date = ?"
                args = (date,)
            query += " ORDER BY scheduled_date DESC, id DESC"
            deliveries = fetch_all(query, args)
            self._set_headers(200)
            self.wfile.write(json.dumps(deliveries).encode())
        elif parsed.path == "/api/metrics/summary":
            summary = self.build_metrics_summary()
            self._set_headers(200)
            self.wfile.write(json.dumps(summary).encode())
        elif parsed.path == "/api/driver/location":
            positions = fetch_all(
                "SELECT * FROM driver_positions ORDER BY timestamp DESC LIMIT 20"
            )
            self._set_headers(200)
            self.wfile.write(json.dumps(positions).encode())
        elif parsed.path == "/api/driver/stops":
            params = parse_qs(parsed.query)
            status = params.get("status", ["pending"])[0]
            since = params.get("since", [None])[0]
            events = self.list_stop_events(status=status, since=since)
            self._set_headers(200)
            self.wfile.write(json.dumps({"events": events}).encode())
        else:
            self._set_headers(404)
            self.wfile.write(json.dumps({"error": "Endpoint não encontrado"}).encode())

    def create_client(self, payload: Dict) -> None:
        client_id = execute(
            "INSERT INTO clients (name, phone, address, latitude, longitude, notes) VALUES (?, ?, ?, ?, ?, ?)",
            (
                payload.get("name"),
                payload.get("phone"),
                payload.get("address"),
                payload.get("latitude"),
                payload.get("longitude"),
                payload.get("notes"),
            ),
        )
        client = fetch_one("SELECT * FROM clients WHERE id = ?", (client_id,))
        self._set_headers(201)
        self.wfile.write(json.dumps(client).encode())

    def create_delivery(self, payload: Dict) -> None:
        client_id = payload.get("client_id")
        date = payload.get("scheduled_date")
        quantity = payload.get("quantity")
        notes = payload.get("notes")
        if not client_id or not date:
            self._set_headers(400)
            self.wfile.write(json.dumps({"error": "client_id e scheduled_date são obrigatórios"}).encode())
            return
        delivery_id = execute(
            "INSERT INTO deliveries (client_id, scheduled_date, quantity, notes) VALUES (?, ?, ?, ?)",
            (client_id, date, quantity, notes),
        )
        delivery = fetch_one(
            "SELECT deliveries.*, clients.name as client_name FROM deliveries JOIN clients ON clients.id = deliveries.client_id WHERE deliveries.id = ?",
            (delivery_id,),
        )
        self._set_headers(201)
        self.wfile.write(json.dumps(delivery).encode())

    def complete_delivery(self, path: str, payload: Dict) -> None:
        delivery_id = path.split("/")[-2]
        quantity = payload.get("quantity")
        notes = payload.get("notes")
        execute(
            "UPDATE deliveries SET status = 'completed', quantity = COALESCE(?, quantity), notes = COALESCE(?, notes), completed_at = datetime('now') WHERE id = ?",
            (quantity, notes, delivery_id),
        )
        delivery = fetch_one(
            "SELECT deliveries.*, clients.name as client_name FROM deliveries JOIN clients ON clients.id = deliveries.client_id WHERE deliveries.id = ?",
            (delivery_id,),
        )
        self._set_headers(200)
        self.wfile.write(json.dumps(delivery).encode())

    def record_location(self, payload: Dict) -> None:
        latitude_raw = payload.get("latitude")
        longitude_raw = payload.get("longitude")
        try:
            latitude = float(latitude_raw)
            longitude = float(longitude_raw)
        except (TypeError, ValueError):
            self._set_headers(400)
            self.wfile.write(
                json.dumps({"error": "latitude e longitude devem ser numéricos"}).encode()
            )
            return

        position_id = execute(
            "INSERT INTO driver_positions (latitude, longitude) VALUES (?, ?)",
            (latitude, longitude),
        )
        event = self._evaluate_stop_event(position_id, latitude, longitude)

        response: Dict[str, object] = {"status": "ok"}
        if event:
            response["stop_event"] = event
        self._set_headers(201)
        self.wfile.write(json.dumps(response).encode())

    def _evaluate_stop_event(
        self, position_id: int, latitude: float, longitude: float
    ) -> Optional[Dict]:
        current = fetch_one(
            "SELECT id, timestamp, latitude, longitude FROM driver_positions WHERE id = ?",
            (position_id,),
        )
        previous = fetch_one(
            "SELECT id, timestamp, latitude, longitude FROM driver_positions WHERE id < ? ORDER BY id DESC LIMIT 1",
            (position_id,),
        )
        if not current or not previous:
            return None

        try:
            current_time = datetime.fromisoformat(str(current["timestamp"]))
            previous_time = datetime.fromisoformat(str(previous["timestamp"]))
        except (TypeError, ValueError):
            return None

        elapsed_seconds = (current_time - previous_time).total_seconds()
        if elapsed_seconds < STOP_TIME_THRESHOLD_SECONDS:
            return None

        distance_since_last = haversine_distance(
            (float(previous["latitude"]), float(previous["longitude"])),
            (latitude, longitude),
        )
        if distance_since_last > STOP_DISTANCE_THRESHOLD_KM:
            return None

        clients = fetch_all(
            "SELECT id, name, latitude, longitude, address FROM clients WHERE latitude IS NOT NULL AND longitude IS NOT NULL"
        )
        if not clients:
            return None

        nearest_client: Optional[Dict] = None
        nearest_distance_km: Optional[float] = None
        for client in clients:
            client_lat = float(client["latitude"])
            client_lon = float(client["longitude"])
            distance_km = haversine_distance(
                (latitude, longitude), (client_lat, client_lon)
            )
            if nearest_distance_km is None or distance_km < nearest_distance_km:
                nearest_distance_km = distance_km
                nearest_client = client

        if nearest_client is None or nearest_distance_km is None:
            return None

        if nearest_distance_km > STOP_CLIENT_RADIUS_KM:
            return None

        duplicate = fetch_one(
            "SELECT id FROM stop_events WHERE acknowledged_at IS NULL AND client_id = ? AND triggered_at >= datetime('now', ?) LIMIT 1",
            (nearest_client["id"], f"-{STOP_DUPLICATE_WINDOW_MINUTES} minutes"),
        )
        if duplicate:
            return None

        distance_m = nearest_distance_km * 1000
        event_id = execute(
            "INSERT INTO stop_events (position_id, client_id, distance_m) VALUES (?, ?, ?)",
            (position_id, nearest_client["id"], distance_m),
        )
        event = self._serialize_stop_event(event_id)
        if event is not None:
            event["duration_seconds"] = int(elapsed_seconds)
        return event

    def _serialize_stop_event(self, event_id: int) -> Optional[Dict]:
        event = fetch_one(
            "SELECT stop_events.*, clients.name AS client_name, clients.address AS client_address, "
            "driver_positions.latitude AS position_latitude, driver_positions.longitude AS position_longitude, "
            "driver_positions.timestamp AS position_timestamp "
            "FROM stop_events "
            "JOIN driver_positions ON driver_positions.id = stop_events.position_id "
            "LEFT JOIN clients ON clients.id = stop_events.client_id "
            "WHERE stop_events.id = ?",
            (event_id,),
        )
        if not event:
            return None
        return self._augment_stop_event(event)

    def _augment_stop_event(self, event: Dict) -> Dict:
        if event.get("distance_m") is not None:
            event["distance_m"] = float(event["distance_m"])
        position_timestamp = event.get("position_timestamp")
        if position_timestamp:
            try:
                position_time = datetime.fromisoformat(str(position_timestamp))
            except ValueError:
                position_time = None
            if position_time:
                previous = fetch_one(
                    "SELECT timestamp FROM driver_positions WHERE id < ? ORDER BY id DESC LIMIT 1",
                    (event["position_id"],),
                )
                if previous and previous.get("timestamp"):
                    try:
                        previous_time = datetime.fromisoformat(str(previous["timestamp"]))
                        event["duration_seconds"] = int(
                            (position_time - previous_time).total_seconds()
                        )
                    except ValueError:
                        event["duration_seconds"] = None
        return event

    def list_stop_events(self, status: str = "pending", since: Optional[str] = None) -> List[Dict]:
        conditions: List[str] = []
        params: List[object] = []
        if status == "pending":
            conditions.append("stop_events.acknowledged_at IS NULL")
        elif status == "acknowledged":
            conditions.append("stop_events.acknowledged_at IS NOT NULL")
        if since:
            conditions.append("stop_events.triggered_at >= ?")
            params.append(since)
        where_clause = ""
        if conditions:
            where_clause = " WHERE " + " AND ".join(conditions)
        query = (
            "SELECT stop_events.*, clients.name AS client_name, clients.address AS client_address, "
            "driver_positions.latitude AS position_latitude, driver_positions.longitude AS position_longitude, "
            "driver_positions.timestamp AS position_timestamp "
            "FROM stop_events "
            "JOIN driver_positions ON driver_positions.id = stop_events.position_id "
            "LEFT JOIN clients ON clients.id = stop_events.client_id"
            f"{where_clause} "
            "ORDER BY stop_events.triggered_at DESC LIMIT 100"
        )
        events = fetch_all(query, tuple(params))
        return [self._augment_stop_event(event) for event in events]

    def acknowledge_stop(self, path: str, payload: Dict) -> None:
        parts = [segment for segment in path.split("/") if segment]
        if len(parts) < 5:
            self._set_headers(400)
            self.wfile.write(json.dumps({"error": "Rota inválida"}).encode())
            return
        event_id = parts[-2]
        event = self._serialize_stop_event(int(event_id))
        if event is None:
            self._set_headers(404)
            self.wfile.write(json.dumps({"error": "Evento não encontrado"}).encode())
            return
        if event.get("acknowledged_at"):
            self._set_headers(409)
            self.wfile.write(json.dumps({"error": "Evento já confirmado"}).encode())
            return

        delivered = bool(payload.get("delivered"))
        quantity_value: Optional[int] = None
        if "quantity" in payload and payload.get("quantity") is not None:
            try:
                quantity_value = int(payload.get("quantity"))
            except (TypeError, ValueError):
                quantity_value = None
        notes = payload.get("notes")

        execute(
            "UPDATE stop_events SET acknowledged_at = datetime('now'), delivered = ?, delivered_quantity = ?, notes = ? WHERE id = ?",
            (1 if delivered else 0, quantity_value, notes, event_id),
        )

        updated = self._serialize_stop_event(int(event_id))
        if delivered and updated and updated.get("client_id"):
            self._ensure_delivery_record(updated, quantity_value, notes)
            updated = self._serialize_stop_event(int(event_id))

        self._set_headers(200)
        self.wfile.write(json.dumps({"event": updated}).encode())

    def _ensure_delivery_record(
        self, event: Dict, quantity: Optional[int], notes: Optional[str]
    ) -> None:
        client_id = event.get("client_id")
        if not client_id:
            return
        pending_delivery = fetch_one(
            "SELECT id FROM deliveries WHERE client_id = ? AND status != 'completed' AND date(scheduled_date) = date('now') ORDER BY scheduled_date ASC LIMIT 1",
            (client_id,),
        )
        if pending_delivery:
            execute(
                "UPDATE deliveries SET status = 'completed', quantity = COALESCE(?, quantity), "
                "notes = CASE WHEN ? IS NOT NULL THEN ? ELSE notes END, completed_at = datetime('now') WHERE id = ?",
                (quantity, notes, notes, pending_delivery["id"]),
            )
            return
        execute(
            "INSERT INTO deliveries (client_id, scheduled_date, status, quantity, notes, completed_at) VALUES (?, date('now'), 'completed', ?, ?, datetime('now'))",
            (client_id, quantity, notes),
        )

    def generate_route(self, payload: Dict) -> None:
        start_lat = self._parse_float(payload.get("start_latitude"), DEFAULT_START[0])
        start_lon = self._parse_float(payload.get("start_longitude"), DEFAULT_START[1])
        date = payload.get("date")
        client_ids = payload.get("client_ids") or []

        try:
            client_ids_iterable: Iterable[int] = tuple(int(cid) for cid in client_ids)
        except (TypeError, ValueError):
            client_ids_iterable = ()

        clients = self._fetch_route_candidates(date, client_ids_iterable)

        with_coordinates = [
            client
            for client in clients
            if client.get("latitude") is not None and client.get("longitude") is not None
        ]
        missing_coordinates = [
            client
            for client in clients
            if client.get("latitude") is None or client.get("longitude") is None
        ]

        ordered = nearest_neighbor_route((start_lat, start_lon), with_coordinates)

        response = {
            "start": {"latitude": start_lat, "longitude": start_lon},
            "ordered": ordered,
            "skipped": missing_coordinates,
        }

        self._set_headers(200)
        self.wfile.write(json.dumps(response).encode())

    def _parse_float(self, value, default: float) -> float:
        if value in (None, "", []):
            return float(default)
        try:
            return float(value)
        except (TypeError, ValueError):
            return float(default)

    def _fetch_route_candidates(self, date: str, client_ids: Iterable[int]) -> List[Dict]:
        client_ids_tuple = tuple(client_ids)
        if client_ids_tuple:
            placeholders = ",".join(["?"] * len(client_ids_tuple))
            clients = fetch_all(
                f"SELECT * FROM clients WHERE id IN ({placeholders}) ORDER BY name",
                client_ids_tuple,
            )
            deliveries_params: Tuple = client_ids_tuple
            deliveries_query = (
                "SELECT deliveries.*, clients.name as client_name FROM deliveries "
                "JOIN clients ON clients.id = deliveries.client_id "
                f"WHERE deliveries.client_id IN ({placeholders}) AND deliveries.status != 'completed'"
            )
            if date:
                deliveries_query += " AND deliveries.scheduled_date = ?"
                deliveries_params = client_ids_tuple + (date,)
            deliveries = fetch_all(deliveries_query, deliveries_params)
            delivery_map = {}
            for delivery in deliveries:
                delivery_map.setdefault(delivery["client_id"], delivery)

            enriched: List[Dict] = []
            for client in clients:
                entry = dict(client)
                delivery = delivery_map.get(client["id"])
                if delivery:
                    entry.update(
                        {
                            "delivery_id": delivery["id"],
                            "status": delivery["status"],
                            "scheduled_date": delivery["scheduled_date"],
                            "client_name": delivery["client_name"],
                        }
                    )
                else:
                    entry.update(
                        {
                            "delivery_id": None,
                            "status": "pending",
                            "scheduled_date": date,
                            "client_name": client["name"],
                        }
                    )
                entry.setdefault("client_id", entry.get("id"))
                enriched.append(entry)
            return enriched

        query = (
            "SELECT clients.*, deliveries.id as delivery_id, deliveries.status, deliveries.scheduled_date, "
            "clients.name as client_name FROM deliveries JOIN clients ON deliveries.client_id = clients.id "
            "WHERE deliveries.status != 'completed'"
        )
        params: Tuple = ()
        if date:
            query += " AND deliveries.scheduled_date = ?"
            params = (date,)
        query += " ORDER BY deliveries.scheduled_date ASC, deliveries.id ASC"
        results = fetch_all(query, params)
        for client in results:
            client.setdefault("client_id", client.get("id"))
        return results

    def build_metrics_summary(self) -> Dict:
        total_clients = fetch_one("SELECT COUNT(*) as total FROM clients", ())["total"]
        total_deliveries = fetch_one("SELECT COUNT(*) as total FROM deliveries", ())["total"]
        completed_today = fetch_one(
            "SELECT COUNT(*) as total FROM deliveries WHERE status = 'completed' AND date(completed_at) = date('now')",
            (),
        )["total"]
        pending_stops = fetch_one(
            "SELECT COUNT(*) as total FROM stop_events WHERE acknowledged_at IS NULL",
            (),
        )["total"]
        stops_today = fetch_one(
            "SELECT COUNT(*) as total FROM stop_events WHERE date(triggered_at) = date('now')",
            (),
        )["total"]
        confirmed_from_stops = fetch_one(
            "SELECT COUNT(*) as total FROM stop_events WHERE delivered = 1 AND date(acknowledged_at) = date('now')",
            (),
        )["total"]
        totals_by_day = fetch_all(
            "SELECT scheduled_date as day, SUM(COALESCE(quantity, 0)) as breads FROM deliveries WHERE status = 'completed' GROUP BY scheduled_date ORDER BY scheduled_date DESC LIMIT 14"
        )
        top_clients = fetch_all(
            "SELECT clients.name, COUNT(deliveries.id) as deliveries FROM deliveries JOIN clients ON clients.id = deliveries.client_id GROUP BY clients.name ORDER BY deliveries DESC LIMIT 5"
        )
        return {
            "totals": {
                "clients": total_clients,
                "deliveries": total_deliveries,
                "completed_today": completed_today,
            },
            "stops": {
                "pending": pending_stops,
                "triggered_today": stops_today,
                "delivered_today": confirmed_from_stops,
            },
            "breads_by_day": totals_by_day,
            "top_clients": top_clients,
        }

    def serve_static(self, path: str) -> None:
        if path == "/":
            file_path = FRONTEND_DIR / "index.html"
        else:
            file_path = (FRONTEND_DIR / path.lstrip("/ ")).resolve()
            try:
                file_path.relative_to(FRONTEND_DIR)
            except ValueError:
                self._set_headers(403)
                self.wfile.write(b"Forbidden")
                return
        if not file_path.exists():
            self._set_headers(404)
            self.wfile.write(b"Not found")
            return
        content_type = "text/plain"
        if file_path.suffix == ".html":
            content_type = "text/html; charset=utf-8"
        elif file_path.suffix == ".js":
            content_type = "application/javascript"
        elif file_path.suffix == ".css":
            content_type = "text/css"
        elif file_path.suffix == ".json":
            content_type = "application/json"
        elif file_path.suffix == ".png":
            content_type = "image/png"
        elif file_path.suffix == ".svg":
            content_type = "image/svg+xml"
        self._set_headers(200, content_type)
        with file_path.open("rb") as f:
            self.wfile.write(f.read())


def run(host: str = "0.0.0.0", port: int = 8000) -> None:
    initialize()
    server = ThreadingHTTPServer((host, port), RequestHandler)
    print(f"Servidor iniciado em http://{host}:{port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("Encerrando servidor...")
    finally:
        server.server_close()


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8000"))
    host = os.environ.get("HOST", "0.0.0.0")
    run(host=host, port=port)
