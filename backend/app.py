import json
import os
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Tuple
from urllib.parse import parse_qs, urlparse

if __package__ in (None, ""):
    from database import execute, fetch_all, fetch_one, initialize
    from routes_logic import detect_visit_events, nearest_neighbor_route, optimize_route_with_google
else:
    from .database import execute, fetch_all, fetch_one, initialize
    from .routes_logic import detect_visit_events, nearest_neighbor_route, optimize_route_with_google

FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend"
DEFAULT_START = (-23.55052, -46.633308)  # São Paulo como ponto inicial padrão
GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY")
STATUS_LABELS = {
    "pending": "Pendente",
    "arrived": "Parada detectada",
    "completed": "Concluída",
}


class RequestHandler(BaseHTTPRequestHandler):
    server_version = "BakeryDelivery/1.0"

    def log_message(self, format: str, *args) -> None:  # noqa: D401
        """Silencia logs padrão do servidor HTTP."""
        return

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
        latitude = self._normalize_coordinate(payload.get("latitude"))
        longitude = self._normalize_coordinate(payload.get("longitude"))
        execute(
            "UPDATE clients SET name = ?, phone = ?, address = ?, latitude = ?, longitude = ?, notes = ? WHERE id = ?",
            (
                payload.get("name"),
                payload.get("phone"),
                payload.get("address"),
                latitude,
                longitude,
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
            query = (
                "SELECT deliveries.*, clients.name as client_name "
                "FROM deliveries JOIN clients ON clients.id = deliveries.client_id"
            )
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
        elif parsed.path == "/api/config":
            config = {"google_maps_api_key": GOOGLE_MAPS_API_KEY}
            self._set_headers(200)
            self.wfile.write(json.dumps(config).encode())
        elif parsed.path == "/api/driver/location":
            positions = fetch_all(
                "SELECT * FROM driver_positions ORDER BY timestamp DESC LIMIT 20"
            )
            payload = {
                "positions": positions,
                "progress": self._build_progress_payload(),
            }
            self._set_headers(200)
            self.wfile.write(json.dumps(payload).encode())
        else:
            self._set_headers(404)
            self.wfile.write(json.dumps({"error": "Endpoint não encontrado"}).encode())

    def _normalize_coordinate(self, value: Optional[float]) -> Optional[float]:
        if value in (None, ""):
            return None
        try:
            return float(value)
        except (TypeError, ValueError):
            return None

    def create_client(self, payload: Dict) -> None:
        latitude = self._normalize_coordinate(payload.get("latitude"))
        longitude = self._normalize_coordinate(payload.get("longitude"))
        client_id = execute(
            "INSERT INTO clients (name, phone, address, latitude, longitude, notes) VALUES (?, ?, ?, ?, ?, ?)",
            (
                payload.get("name"),
                payload.get("phone"),
                payload.get("address"),
                latitude,
                longitude,
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
            "SELECT deliveries.*, clients.name as client_name FROM deliveries "
            "JOIN clients ON clients.id = deliveries.client_id WHERE deliveries.id = ?",
            (delivery_id,),
        )
        self._set_headers(201)
        self.wfile.write(json.dumps(delivery).encode())

    def complete_delivery(self, path: str, payload: Dict) -> None:
        delivery_id = path.split("/")[-2]
        quantity = payload.get("quantity")
        notes = payload.get("notes")
        execute(
            "UPDATE deliveries SET status = 'completed', quantity = COALESCE(?, quantity), "
            "notes = COALESCE(?, notes), completed_at = datetime('now'), "
            "departed_at = COALESCE(departed_at, datetime('now')) WHERE id = ?",
            (quantity, notes, delivery_id),
        )
        execute(
            "UPDATE delivery_visits SET status = 'confirmed', confirmed_at = datetime('now'), "
            "quantity = COALESCE(?, quantity), notes = COALESCE(?, notes) "
            "WHERE delivery_id = ? AND status IN ('detected', 'awaiting_confirmation')",
            (quantity, notes, delivery_id),
        )
        delivery = fetch_one(
            "SELECT deliveries.*, clients.name as client_name FROM deliveries "
            "JOIN clients ON clients.id = deliveries.client_id WHERE deliveries.id = ?",
            (delivery_id,),
        )
        response = {
            "delivery": delivery,
            "progress": self._build_progress_payload(),
        }
        self._set_headers(200)
        self.wfile.write(json.dumps(response).encode())

    def record_location(self, payload: Dict) -> None:
        latitude = self._normalize_coordinate(payload.get("latitude"))
        longitude = self._normalize_coordinate(payload.get("longitude"))
        if latitude is None or longitude is None:
            self._set_headers(400)
            self.wfile.write(json.dumps({"error": "latitude e longitude são obrigatórios"}).encode())
            return
        execute(
            "INSERT INTO driver_positions (latitude, longitude) VALUES (?, ?)",
            (latitude, longitude),
        )
        pending_confirmations = self._detect_and_register_visits()
        response = {
            "status": "ok",
            "pending_confirmations": pending_confirmations,
            "progress": self._build_progress_payload(),
            "last_position": {"latitude": latitude, "longitude": longitude},
        }
        self._set_headers(201)
        self.wfile.write(json.dumps(response).encode())

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

        ordered, directions = optimize_route_with_google(
            GOOGLE_MAPS_API_KEY,
            (start_lat, start_lon),
            with_coordinates,
        )

        if not ordered and with_coordinates:
            ordered = nearest_neighbor_route((start_lat, start_lon), with_coordinates)
            directions = None

        self._apply_status_labels(ordered)
        self._apply_status_labels(missing_coordinates)

        progress_reference: List[Dict] = list(ordered) if ordered else list(clients)
        progress = self._build_progress_payload(progress_reference)

        response = {
            "start": {"latitude": start_lat, "longitude": start_lon},
            "ordered": ordered,
            "skipped": missing_coordinates,
            "directions": directions,
            "progress": progress,
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

    def _fetch_route_candidates(self, date: Optional[str], client_ids: Iterable[int]) -> List[Dict]:
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
            delivery_map = {delivery["client_id"]: delivery for delivery in deliveries}

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
            "clients.name as client_name "
            "FROM deliveries JOIN clients ON deliveries.client_id = clients.id "
            "WHERE deliveries.status != 'completed'"
        )
        params: Tuple = ()
        if date:
            query += " AND deliveries.scheduled_date = ?"
            params = (date,)
        query += " ORDER BY deliveries.scheduled_date ASC, deliveries.id ASC"
        results = fetch_all(query, params)
        if results:
            for client in results:
                client.setdefault("client_id", client.get("client_id") or client.get("id"))
                client.setdefault("client_name", client.get("client_name") or client.get("name"))
            return results

        clients = fetch_all("SELECT * FROM clients ORDER BY name")
        enriched: List[Dict] = []
        for client in clients:
            entry = dict(client)
            entry.setdefault("client_id", entry.get("id"))
            entry.update(
                {
                    "delivery_id": None,
                    "status": "pending",
                    "scheduled_date": date,
                    "client_name": client.get("name"),
                }
            )
            enriched.append(entry)
        return enriched

    def build_metrics_summary(self) -> Dict:
        total_clients = fetch_one("SELECT COUNT(*) as total FROM clients", ())["total"]
        total_deliveries = fetch_one("SELECT COUNT(*) as total FROM deliveries", ())["total"]
        completed_today = fetch_one(
            "SELECT COUNT(*) as total FROM deliveries WHERE status = 'completed' AND date(completed_at) = date('now')",
            (),
        )["total"]
        totals_by_day = fetch_all(
            "SELECT scheduled_date as day, SUM(COALESCE(quantity, 0)) as breads "
            "FROM deliveries WHERE status = 'completed' "
            "GROUP BY scheduled_date ORDER BY scheduled_date DESC LIMIT 14"
        )
        top_clients = fetch_all(
            "SELECT clients.name, COUNT(deliveries.id) as deliveries "
            "FROM deliveries JOIN clients ON clients.id = deliveries.client_id "
            "GROUP BY clients.name ORDER BY deliveries DESC LIMIT 5"
        )
        return {
            "totals": {
                "clients": total_clients,
                "deliveries": total_deliveries,
                "completed_today": completed_today,
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


    def _client_identifier(self, client: Dict) -> Optional[int]:
        value = client.get("client_id") or client.get("id")
        try:
            return int(value) if value is not None else None
        except (TypeError, ValueError):
            return None

    def _apply_status_labels(self, clients: Iterable[Dict]) -> None:
        for client in clients:
            status = client.get("status") or "pending"
            label = STATUS_LABELS.get(status, status.title())
            client["status"] = status
            client["status_label"] = label

    def _get_recent_positions(self) -> List[Dict]:
        return fetch_all(
            "SELECT * FROM driver_positions WHERE timestamp >= datetime('now', '-20 minutes') ORDER BY timestamp ASC"
        )

    def _get_active_deliveries(self) -> List[Dict]:
        return fetch_all(
            "SELECT deliveries.*, clients.latitude, clients.longitude, clients.name as client_name "
            "FROM deliveries JOIN clients ON deliveries.client_id = clients.id "
            "WHERE deliveries.status != 'completed' "
            "ORDER BY deliveries.scheduled_date ASC, deliveries.id ASC",
        )

    def _fetch_pending_confirmations(self) -> List[Dict]:
        return fetch_all(
            "SELECT delivery_visits.*, clients.name as client_name "
            "FROM delivery_visits JOIN clients ON clients.id = delivery_visits.client_id "
            "WHERE delivery_visits.status = 'awaiting_confirmation' "
            "ORDER BY delivery_visits.detected_at ASC",
        )

    def _detect_and_register_visits(self) -> List[Dict]:
        positions = self._get_recent_positions()
        deliveries = self._get_active_deliveries()
        if not positions or not deliveries:
            return self._fetch_pending_confirmations()
        detections = detect_visit_events(positions, deliveries)
        if not detections:
            return self._fetch_pending_confirmations()

        deliveries_by_id = {
            int(delivery["id"]): delivery for delivery in deliveries if delivery.get("id") is not None
        }
        for detection in detections:
            delivery = deliveries_by_id.get(detection.delivery_id)
            if not delivery:
                continue
            if delivery.get("status") == "completed":
                continue
            detected_at = detection.detected_at.isoformat(timespec="seconds")
            existing_visit = fetch_one(
                "SELECT * FROM delivery_visits WHERE delivery_id = ? AND status IN ('detected','awaiting_confirmation') "
                "ORDER BY detected_at DESC LIMIT 1",
                (detection.delivery_id,),
            )
            if existing_visit:
                execute(
                    "UPDATE delivery_visits SET stay_seconds = ?, detected_at = ? WHERE id = ?",
                    (detection.stay_seconds, detected_at, existing_visit["id"]),
                )
                visit_id = existing_visit["id"]
            else:
                visit_id = execute(
                    "INSERT INTO delivery_visits (delivery_id, client_id, stay_seconds, status, detected_at) "
                    "VALUES (?, ?, ?, 'awaiting_confirmation', ?)",
                    (
                        detection.delivery_id,
                        detection.client_id,
                        detection.stay_seconds,
                        detected_at,
                    ),
                )
            execute(
                "UPDATE delivery_visits SET status = 'awaiting_confirmation' WHERE id = ?",
                (visit_id,),
            )
            execute(
                "UPDATE deliveries SET status = 'arrived', arrived_at = COALESCE(arrived_at, ?), "
                "stay_seconds = COALESCE(?, stay_seconds) WHERE id = ? AND status != 'completed'",
                (detected_at, detection.stay_seconds, detection.delivery_id),
            )
        return self._fetch_pending_confirmations()

    def _build_progress_payload(self, ordered: Optional[List[Dict]] = None) -> Optional[Dict]:
        candidates: List[Dict]
        if ordered:
            seen_ids = {
                cid
                for cid in (
                    self._client_identifier(client)
                    for client in ordered
                )
                if cid is not None
            }
            extra = [
                delivery
                for delivery in self._get_active_deliveries()
                if self._client_identifier(delivery) not in seen_ids
            ]
            candidates = list(ordered) + extra
        else:
            candidates = self._get_active_deliveries()

        if not candidates:
            pending_visits = self._fetch_pending_confirmations()
            message = (
                "Visitas aguardando confirmação." if pending_visits else "Cadastre entregas para iniciar a rota."
            )
            return {
                "message": message,
                "stops": [],
                "next_client_id": None,
            }

        self._apply_status_labels(candidates)

        stops: List[Dict] = []
        next_client_id: Optional[int] = None
        for client in candidates:
            client_id = self._client_identifier(client)
            if client_id is None:
                continue
            status = client.get("status") or "pending"
            label = client.get("status_label") or STATUS_LABELS.get(status, status.title())
            stops.append(
                {
                    "client_id": client_id,
                    "client_name": client.get("client_name") or client.get("name"),
                    "status": status,
                    "status_label": label,
                    "quantity": client.get("quantity"),
                    "arrived_at": client.get("arrived_at"),
                    "completed_at": client.get("completed_at"),
                }
            )
            if next_client_id is None and status != "completed":
                next_client_id = client_id

        if next_client_id is None:
            message = "Todas as entregas desta rota foram concluídas."
        else:
            next_client = next(
                (stop for stop in stops if stop["client_id"] == next_client_id),
                None,
            )
            client_name = next_client.get("client_name") if next_client else "cliente"
            message = f"Próxima parada: {client_name}."

        return {
            "message": message,
            "stops": stops,
            "next_client_id": next_client_id,
        }


def _resolve_port(default: int) -> int:
    """Return the port informed by the PORT environment variable if present."""

    env_port = os.environ.get("PORT")
    if not env_port:
        return default

    try:
        return int(env_port)
    except ValueError:
        return default


def run(host: str = "0.0.0.0", port: int = 8000) -> None:
    resolved_port = _resolve_port(port)
    initialize()
    server = ThreadingHTTPServer((host, resolved_port), RequestHandler)
    print(f"Servidor iniciado em http://{host}:{resolved_port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("Encerrando servidor...")
    finally:
        server.server_close()


if __name__ == "__main__":
    run()
