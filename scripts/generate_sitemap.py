#!/usr/bin/env python3
import csv
import io
import json
import os
import re
import unicodedata
import urllib.request
from datetime import date
from pathlib import Path
from xml.sax.saxutils import escape

SHEET_ID = "1vnIouZJf1iCYqDfFF6A4gDkfEk-hsSVEhLtPXcFDcB0"
SHEET_NAME = "Places"
BASE_URL = os.environ.get("BASE_URL", "https://atlanta-public-guide.atlanta-guide.workers.dev").rstrip("/")
REGISTRY_PATH = Path("slug-registry.json")
SITEMAP_PATH = Path("sitemap.xml")


def slugify(value: str) -> str:
    value = unicodedata.normalize("NFKD", value or "").encode("ascii", "ignore").decode("ascii")
    value = value.lower().replace("&", " and ")
    return re.sub(r"[^a-z0-9]+", "-", value).strip("-")


def load_rows():
    url = f"https://docs.google.com/spreadsheets/d/{SHEET_ID}/gviz/tq?tqx=out:csv&headers=1&sheet={SHEET_NAME}"
    req = urllib.request.Request(url, headers={"User-Agent": "AtlantaLocalSitemap/1.0"})
    with urllib.request.urlopen(req, timeout=30) as response:
        body = response.read().decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(body))
    rows = list(reader)
    required = {"Place ID", "Place", "City", "Place Status"}
    if not rows or not required.issubset(set(reader.fieldnames or [])):
        raise RuntimeError("Places feed is empty or missing required columns")
    return rows


def load_registry():
    if not REGISTRY_PATH.exists():
        return {}
    try:
        data = json.loads(REGISTRY_PATH.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def is_active(row):
    return (row.get("Place Status") or "").strip().lower() in ("", "active")


def main():
    rows = load_rows()
    registry = load_registry()
    active_places = []
    cities = set()

    for row in rows:
        place = (row.get("Place") or "").strip()
        city = (row.get("City") or "").strip()
        place_id = (row.get("Place ID") or "").strip()
        if not place or not city or not is_active(row):
            continue

        sheet_slug = slugify((row.get("URL Slug") or "").strip())
        existing_slug = slugify(registry.get(place_id, "")) if place_id else ""
        stable_slug = sheet_slug or existing_slug or slugify(f"{place}-{city}")
        if not stable_slug:
            continue

        if place_id:
            registry[place_id] = stable_slug
        active_places.append(stable_slug)
        cities.add(city)

    REGISTRY_PATH.write_text(json.dumps(registry, indent=2, sort_keys=True) + "\n", encoding="utf-8")

    paths = ["/", "/search", "/moving", "/picks", "/about", "/disclaimer"]
    paths += [f"/cities/{slugify(city)}" for city in sorted(cities)]
    paths += [f"/places/{slug}" for slug in sorted(set(active_places))]

    today = date.today().isoformat()
    lines = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for path in paths:
        lines.append("  <url>")
        lines.append(f"    <loc>{escape(BASE_URL + path)}</loc>")
        lines.append(f"    <lastmod>{today}</lastmod>")
        lines.append("  </url>")
    lines.append("</urlset>")
    SITEMAP_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"Generated sitemap with {len(paths)} URLs and {len(registry)} stable slugs")


if __name__ == "__main__":
    main()
