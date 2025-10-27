"""Routing helpers for delivery management."""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime
from math import asin, cos, radians, sin, sqrt
from typing import Dict, Iterable, List, Optional, Tuple
from urllib.error import URLError
from urllib.parse import urlencode
from urllib.request import urlopen



def haversine_distance(origin: Tuple[float, float], destination: Tuple[float, float]) -> float:
    """Return the distance in kilometers between two latitude/longitude pairs."""

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
    """Simple greedy route ordering by nearest neighbor (fallback when API unavailable)."""

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


def optimize_route_with_google(
    api_key: Optional[str],
    start: Tuple[float, float],
    clients: List[Dict],
) -> Tuple[List[Dict], Optional[Dict]]:
    """Return ordered clients and optional route metadata using Google Directions.

    When the API key is missing or the request fails, fall back to the
    :func:`nearest_neighbor_route` implementation.
    """

    if not api_key:
        return nearest_neighbor_route(start, clients), None

    waypoints: List[str] = []
    coordinate_clients: List[Tuple[str, Dict]] = []
    for client in clients:
        if client.get("latitude") is None or client.get("longitude") is None:
            continue
        location = f"{client['latitude']},{client['longitude']}"
        waypoints.append(location)
        coordinate_clients.append((location, client))

    if not waypoints:
        return [], None

    # Use Directions API with optimize:true to reorder waypoints automatically.
    origin = f"{start[0]},{start[1]}"
    destination = waypoints[-1]
    payload = {
        "origin": origin,
        "destination": destination,
        "key": api_key,
        "mode": "driving",
        "waypoints": "optimize:true|" + "|".join(waypoints[:-1]) if len(waypoints) > 1 else None,
        "language": "pt-BR",
    }
    # Remove None values to keep the querystring clean.
    query = {key: value for key, value in payload.items() if value is not None}

    try:
        with urlopen(
            "https://maps.googleapis.com/maps/api/directions/json?" + urlencode(query, doseq=True),
            timeout=10,
        ) as response:
            raw = response.read().decode("utf-8")
    except (URLError, TimeoutError):
        return nearest_neighbor_route(start, clients), None

    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return nearest_neighbor_route(start, clients), None
    if data.get("status") != "OK":
        return nearest_neighbor_route(start, clients), None

    route = data["routes"][0]
    waypoint_order = route.get("waypoint_order", [])
    ordered_clients: List[Dict] = []

    # When there is only one waypoint we keep the original ordering.
    if len(coordinate_clients) == 1:
        ordered_clients = [coordinate_clients[0][1]]
    else:
        ordered_clients = [coordinate_clients[index][1] for index in waypoint_order]
        ordered_clients.append(coordinate_clients[-1][1])

    metadata = {
        "polyline": route.get("overview_polyline", {}).get("points"),
        "legs": route.get("legs", []),
        "warnings": route.get("warnings", []),
        "summary": route.get("summary"),
    }
    return ordered_clients, metadata


@dataclass
class VisitDetectionResult:
    delivery_id: int
    client_id: int
    stay_seconds: int
    detected_at: datetime


def detect_visit_events(
    positions: Iterable[Dict],
    deliveries: Iterable[Dict],
    threshold_meters: float = 80.0,
    min_duration: int = 90,
) -> List[VisitDetectionResult]:
    """Return deliveries where the driver stayed within range for long enough."""

    by_delivery: List[VisitDetectionResult] = []
    trajectory: List[Tuple[datetime, float, float]] = []
    for position in positions:
        try:
            timestamp = datetime.fromisoformat(position["timestamp"])
        except (KeyError, ValueError):
            continue
        trajectory.append((timestamp, float(position["latitude"]), float(position["longitude"])))

    if not trajectory:
        return by_delivery

    for delivery in deliveries:
        client_lat = delivery.get("latitude")
        client_lon = delivery.get("longitude")
        if client_lat is None or client_lon is None:
            continue
        delivery_identifier = delivery.get("delivery_id") or delivery.get("id")
        client_identifier = delivery.get("client_id") or delivery.get("id")
        if delivery_identifier is None or client_identifier is None:
            continue

        inside_window: Optional[Tuple[datetime, datetime]] = None
        for timestamp, lat, lon in trajectory:
            distance = haversine_distance((lat, lon), (float(client_lat), float(client_lon))) * 1000
            if distance <= threshold_meters:
                if inside_window is None:
                    inside_window = (timestamp, timestamp)
                else:
                    inside_window = (inside_window[0], timestamp)
            elif inside_window is not None:
                start, end = inside_window
                if (end - start).total_seconds() >= min_duration:
                    by_delivery.append(
                        VisitDetectionResult(
                            delivery_id=int(delivery_identifier),
                            client_id=int(client_identifier),
                            stay_seconds=int((end - start).total_seconds()),
                            detected_at=end,
                        )
                    )
                    break
                inside_window = None
        if inside_window is not None:
            start, end = inside_window
            if (end - start).total_seconds() >= min_duration:
                by_delivery.append(
                    VisitDetectionResult(
                        delivery_id=int(delivery_identifier),
                        client_id=int(client_identifier),
                        stay_seconds=int((end - start).total_seconds()),
                        detected_at=end,
                    )
                )

    return by_delivery
