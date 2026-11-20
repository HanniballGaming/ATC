#!/usr/bin/env python3
"""Erstelle einen kleinen, ausschließlich echten OSM-Augsburg-GeoJSON-Datensatz.

Wird in der Windows-Buildpipeline ausgeführt. Es werden ausschließlich unveränderte
OSM-Ways und Nodes in GeoJSON transformiert. Es gibt *keinen* synthetischen Fallback.
Bei Ausfall der Kartendienste kann die App später realen OSM-Daten online laden.
"""
from __future__ import annotations
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.parse import urlencode
from urllib.error import URLError
from xml.etree import ElementTree as ET
import json
import sys
import time

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "public" / "openworld" / "data"
# Jede Kachel enthält ausschließlich echte OSM-Ways und -Nodes.
TILES = [
    ("suedwest", 48.364, 10.888, 48.3705, 10.8985),
    ("suedost", 48.364, 10.8985, 48.3705, 10.909),
    ("nordwest", 48.3705, 10.888, 48.377, 10.8985),
    ("nordost", 48.3705, 10.8985, 48.377, 10.909),
]
USER_AGENT = "FUNKSPRUCH-OpenStreetMap-Build/0.26 (+https://github.com/HanniballGaming/ATC)"
MAX_RESPONSE_BYTES = 20_000_000


def overpass_query(south: float, west: float, north: float, east: float) -> str:
    return (
        "[out:json][timeout:25];("
        f'way["highway"]["area"!="yes"]({south},{west},{north},{east});'
        f'way["building"]({south},{west},{north},{east});'
        ");out body;>;out skel qt;"
    )

def get_bytes(url: str, *, data: bytes | None = None, timeout: int = 29) -> bytes:
    headers = {"User-Agent": USER_AGENT, "Accept": "application/json, application/xml;q=0.9"}
    if data is not None:
        headers["Content-Type"] = "application/x-www-form-urlencoded;charset=UTF-8"
    req = Request(url, data=data, headers=headers)
    with urlopen(req, timeout=timeout) as response:
        payload = response.read(MAX_RESPONSE_BYTES + 1)
        if len(payload) > MAX_RESPONSE_BYTES:
            raise ValueError("OSM-Datenantwort zu groß")
        return payload


def osm_elements(elements: list[dict]) -> list[dict]:
    nodes = {}
    for element in elements:
        if element.get("type") == "node":
            try:
                lat, lon = float(element["lat"]), float(element["lon"])
                if -90 <= lat <= 90 and -180 <= lon <= 180:
                    nodes[int(element["id"])] = [lon, lat]
            except (TypeError, ValueError, KeyError):
                continue
    features = []
    for item in elements:
        if item.get("type") != "way" or not isinstance(item.get("nodes"), list):
            continue
        tags = item.get("tags") or {}
        building = bool(tags.get("building") and tags["building"] != "no")
        highway = bool(tags.get("highway") and not building and tags.get("area") != "yes")
        if not building and not highway:
            continue
        coords = [nodes.get(int(node_id)) for node_id in item["nodes"]]
        if any(coordinate is None for coordinate in coords):
            continue
        if building:
            if len(coords) < 3:
                continue
            if coords[0] != coords[-1]:
                coords.append(coords[0])
            if len(coords) < 4:
                continue
        elif len(coords) < 2:
            continue
        features.append({
            "type": "Feature",
            "id": f'way/{int(item["id"])}',
            "properties": {**tags, "osm_id": int(item["id"])},
            "geometry": {
                "type": "Polygon" if building else "LineString",
                "coordinates": [coords] if building else coords,
            },
        })
    return features


def parse_osm_xml(payload: bytes) -> list[dict]:
    root = ET.fromstring(payload)
    elements = []
    for child in root:
        if child.tag == "node":
            elements.append({"type": "node", "id": child.get("id"),
                             "lat": child.get("lat"), "lon": child.get("lon")})
        elif child.tag == "way":
            elements.append({
                "type": "way", "id": child.get("id"),
                "nodes": [int(nd.get("ref")) for nd in child.findall("nd") if nd.get("ref")],
                "tags": {tag.get("k"): tag.get("v") for tag in child.findall("tag") if tag.get("k")},
            })
    return elements


def valid(features: list[dict]) -> bool:
    roads = sum(bool(feature["properties"].get("highway")) for feature in features)
    buildings = sum(bool(feature["properties"].get("building")) for feature in features)
    print(f"Reale OSM-Daten: {roads} Straßen-Ways, {buildings} Gebäudegrundrisse")
    return roads >= 8 and buildings >= 8 and len(features) <= 50000


def fetch_tile(tile: tuple) -> bool:
    name, south, west, north, east = tile
    out = OUT_DIR / f"augsburg-{name}.geojson"
    requests = [
        ("https://ovp.dresel.systems/api/interpreter", "json"),
        ("https://overpass.private.coffee/api/interpreter", "json"),
        ("https://api.openstreetmap.org/api/0.6/map?bbox="
         + ",".join(str(v) for v in (west, south, east, north)), "xml"),
    ]
    for url, kind in requests:
        print(f"Reale Augsburg-Kachel {name}: {url}", flush=True)
        try:
            if kind == "json":
                payload = get_bytes(url, data=urlencode({"data": overpass_query(south, west, north, east)}).encode(), timeout=27)
                elements = json.loads(payload).get("elements", [])
            else:
                elements = parse_osm_xml(get_bytes(url, timeout=27))
            features = osm_elements(elements)
            if not valid(features):
                raise ValueError("Zu wenige Straßen oder Gebäude für OSM-Kachel")
            data = {
                "type": "FeatureCollection",
                "features": features,
                "metadata": {
                    "source": "OpenStreetMap",
                    "real": True,
                    "license": "ODbL 1.0",
                    "attribution": "© OpenStreetMap-Mitwirkende",
                    "source_url": url,
                    "retrievedAt": datetime.now(timezone.utc).isoformat(),
                    "bbox": [west, south, east, north],
                    "tile": name,
                },
            }
            OUT_DIR.mkdir(parents=True, exist_ok=True)
            out.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
            print(f"Authentische OSM-Kachel {name} gespeichert: {out.stat().st_size} Bytes", flush=True)
            return True
        except Exception as exc:
            print(f"OSM-Kachel {name}: {type(exc).__name__}: {exc}", file=sys.stderr, flush=True)
    print(f"OSM-Kachel {name} fehlt – kein fiktiver Ersatz.", file=sys.stderr, flush=True)
    return False


def main() -> int:
    completed = 0
    for tile in TILES:
        if fetch_tile(tile):
            completed += 1
        time.sleep(0.4)
    print(f"Echte Augsburg-Kacheln: {completed}/{len(TILES)}", flush=True)
    # Fehlende reale Kacheln können bei Spielstart nachgeladen werden.
    return 0

if __name__ == "__main__":
    sys.exit(main())
