from math import radians, cos, sin, asin, sqrt
from typing import Dict, List, Tuple


def haversine_distance(origin: Tuple[float, float], destination: Tuple[float, float]) -> float:
    lat1, lon1 = origin
    lat2, lon2 = destination
    lon1, lat1, lon2, lat2 = map(radians, [lon1, lat1, lon2, lat2])
    dlon = lon2 - lon1
    dlat = lat2 - lat1
    a = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlon / 2) ** 2
    c = 2 * asin(sqrt(a))
    radius_km = 6371
    return radius_km * c


def nearest_neighbor_route(start: Tuple[float, float], clients: List[Dict]) -> List[Dict]:
    remaining = [
        client
        for client in clients
        if client.get("latitude") is not None and client.get("longitude") is not None
    ]
    ordered: List[Dict] = []
    current = start
    while remaining:
        nearest = min(
            remaining,
            key=lambda client: haversine_distance(
                current,
                (float(client.get("latitude")), float(client.get("longitude"))),
            ),
        )
        ordered.append(nearest)
        current = (float(nearest.get("latitude")), float(nearest.get("longitude")))
        remaining.remove(nearest)
    return ordered
