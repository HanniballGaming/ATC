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
OUT = ROOT / "public" / "openworld" / "data" / "augsburg.geojson"
# Koordinaten des realen Augsburger Innenstadt-Ausschnitts.
SOUTH, WEST, NORTH, EAST = 48.3675, 10.8945, 48.3740, 10.9050
BBOX = (SOUTH, WEST, NORTH, EAST)
USER_AGENT = "FUNSPRUCH-OpenStreetMap-Build/0.24 (+https://github.com/HanniballGaming/ATC)"
MAX_RESPONSE_BYTES = 20_000_000
OVERPASS_QUERY = (
    "[out:json][timeout:25];("
    f'way["highway"]["area"!="yes"]({SOUTH},{WEST},{NORTH},{EAST});'
    f'way["building"]({SOUTH},{WEST},{NORTH},{EAST});'
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


def main() -> int:
    requests = [
        ("https://overpass.private.coffee/api/interpreter", "json"),
        ("https://ovp.dresel.systems/api/interpreter", "json"),
        ("https://overpass-api.de/api/interpreter", "json"),
        ("https://api.openstreetmap.org/api/0.6/map?bbox="
         + ",".join(str(value) for value in (WEST, SOUTH, EAST, NORTH)), "xml"),
    ]
    for url, kind in requests:
        print("Lade echten Augsburger OpenStreetMap-Ausschnitt von", url, flush=True)
        try:
            if kind == "json":
                payload = get_bytes(url, data=urlencode({"data": OVERPASS_QUERY}).encode())
                elements = json.loads(payload).get("elements", [])
            else:
                elements = parse_osm_xml(get_bytes(url))
            features = osm_elements(elements)
            if not valid(features):
                raise ValueError("Kartenausschnitt unvollständig")
            result = {
                "type": "FeatureCollection",
                "features": features,
                "metadata": {
                    "source": "OpenStreetMap",
                    "real": True,
                    "license": "ODbL 1.0",
                    "attribution": "© OpenStreetMap-Mitwirkende",
                    "source_url": url,
                    "retrievedAt": datetime.now(timezone.utc).isoformat(),
                    "bbox": [WEST, SOUTH, EAST, NORTH],
                },
            }
            OUT.parent.mkdir(parents=True, exist_ok=True)
            OUT.write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
            print(f"Echter Offline-Kartenausschnitt bereitgestellt: {OUT} ({OUT.stat().st_size:,} Bytes)")
            return 0
        except (Exception,) as exc:
            print(f"OSM-Endpunkt nicht erreichbar: {type(exc).__name__}: {exc}", file=sys.stderr, flush=True)
    print("Warnung: Kein echter OSM-Datensatz abrufbar. Die App erfindet keine Stadt und benötigt beim ersten Start Internet.", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
