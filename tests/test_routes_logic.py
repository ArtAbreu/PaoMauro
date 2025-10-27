import unittest
from datetime import datetime, timedelta

from backend.routes_logic import (
    detect_visit_events,
    haversine_distance,
    nearest_neighbor_route,
    optimize_route_with_google,
)


class HaversineDistanceTests(unittest.TestCase):
    def test_zero_distance_for_same_point(self):
        sao_paulo = (-23.55052, -46.633308)
        self.assertAlmostEqual(
            haversine_distance(sao_paulo, sao_paulo),
            0.0,
            places=6,
        )

    def test_distance_is_symmetric(self):
        origem = (-23.55052, -46.633308)
        destino = (-23.564003, -46.652267)
        forward = haversine_distance(origem, destino)
        backward = haversine_distance(destino, origem)
        self.assertAlmostEqual(forward, backward, places=6)


class NearestNeighborRouteTests(unittest.TestCase):
    def test_route_orders_clients_by_distance(self):
        start = (-23.55052, -46.633308)
        clients = [
            {"id": 1, "name": "Cliente A", "latitude": -23.56, "longitude": -46.65},
            {"id": 2, "name": "Cliente B", "latitude": -23.55, "longitude": -46.60},
            {"id": 3, "name": "Cliente C", "latitude": -23.58, "longitude": -46.70},
        ]

        ordered = nearest_neighbor_route(start, clients)
        ordered_ids = [client["id"] for client in ordered]

        # The route should begin with the closest client and include all clients once.
        self.assertEqual(sorted(ordered_ids), [1, 2, 3])

        closest_client = min(
            clients,
            key=lambda client: haversine_distance(
                start,
                (client["latitude"], client["longitude"]),
            ),
        )
        self.assertEqual(ordered_ids[0], closest_client["id"])
        self.assertEqual(len(set(ordered_ids)), len(clients))


class OptimizeRouteFallbackTests(unittest.TestCase):
    def test_falls_back_to_nearest_neighbor_when_api_key_missing(self):
        start = (-23.55052, -46.633308)
        clients = [
            {"id": 1, "name": "Cliente A", "latitude": -23.56, "longitude": -46.65},
            {"id": 2, "name": "Cliente B", "latitude": -23.55, "longitude": -46.60},
        ]

        ordered, metadata = optimize_route_with_google(None, start, clients)

        self.assertEqual(len(ordered), len(clients))
        self.assertIsNone(metadata)


class DetectVisitEventsTests(unittest.TestCase):
    def setUp(self):
        self.client = {
            "id": 99,
            "client_id": 99,
            "latitude": -23.5505,
            "longitude": -46.6333,
        }

    def test_detects_visit_after_minimum_duration(self):
        base = datetime(2024, 1, 1, 8, 0, 0)
        positions = []
        for offset in range(0, 120, 30):
            positions.append(
                {
                    "timestamp": (base + timedelta(seconds=offset)).isoformat(sep=" "),
                    "latitude": self.client["latitude"],
                    "longitude": self.client["longitude"],
                }
            )
        detections = detect_visit_events(positions, [self.client], threshold_meters=50, min_duration=90)
        self.assertEqual(len(detections), 1)
        self.assertEqual(detections[0].client_id, self.client["id"])

    def test_ignores_visit_when_duration_is_short(self):
        base = datetime(2024, 1, 1, 8, 0, 0)
        positions = []
        for offset in range(0, 60, 15):
            positions.append(
                {
                    "timestamp": (base + timedelta(seconds=offset)).isoformat(sep=" "),
                    "latitude": self.client["latitude"],
                    "longitude": self.client["longitude"],
                }
            )
        detections = detect_visit_events(positions, [self.client], threshold_meters=50, min_duration=90)
        self.assertFalse(detections)


if __name__ == "__main__":
    unittest.main()
