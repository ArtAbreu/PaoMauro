import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Dict, Iterable, List, Tuple
from urllib.parse import parse_qs, urlparse

from database import execute, fetch_all, fetch_one, initialize
from routes_logic import nearest_neighbor_route

FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend"
DEFAULT_START = (-23.55052, -46.633308)  # São Paulo como ponto inicial padrão


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
        latitude = payload.get("latitude")
        longitude = payload.get("longitude")
        if latitude is None or longitude is None:
            self._set_headers(400)
            self.wfile.write(json.dumps({"error": "latitude e longitude são obrigatórios"}).encode())
            return
        execute(
            "INSERT INTO driver_positions (latitude, longitude) VALUES (?, ?)",
            (latitude, longitude),
        )
        self._set_headers(201)
        self.wfile.write(json.dumps({"status": "ok"}).encode())

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
    run()
