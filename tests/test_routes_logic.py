import unittest

from backend.routes_logic import haversine_distance, nearest_neighbor_route


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


if __name__ == "__main__":
    unittest.main()
