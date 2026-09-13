#!/usr/bin/env python3
"""Generate database/seed.sql from the current public-safe Google Sheet.

Only website-safe columns are imported. Internal/client columns are intentionally ignored.
Run from the repository root:
  python scripts/generate_d1_seed.py
"""

from __future__ import annotations

import csv
import io
import json
import re
import unicodedata
import urllib.parse
import urllib.request
from pathlib import Path

SPREADSHEET_ID = "1vnIouZJf1iCYqDfFF6A4gDkfEk-hsSVEhLtPXcFDcB0"
SHEET = "Places"
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "database" / "seed.sql"
REGISTRY = ROOT / "slug-registry.json"
CITY_IMAGES = ROOT / "city-images.json"


def clean(value: object) -> str:
    return str(value or "").strip()


def slugify(value: str) -> str:
    value = unicodedata.normalize("NFKD", clean(value)).encode("ascii", "ignore").decode("ascii").lower()
    value = value.replace("&", " and ")
    value = re.sub(r"[^a-z0-9]+", "-", value).strip("-")
    return value


def truthy(value: str) -> int:
    return 1 if clean(value).lower() in {"1", "true", "yes", "featured"} else 0


def sql(value: object) -> str:
    if value is None:
        return "NULL"
    text = clean(value)
    if not text:
        return "NULL"
    return "'" + text.replace("'", "''") + "'"


def fetch_rows() -> list[dict[str, str]]:
    query = urllib.parse.urlencode({"tqx": "out:csv", "headers": "1", "sheet": SHEET})
    url = f"https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/gviz/tq?{query}"
    req = urllib.request.Request(url, headers={"User-Agent": "AtlantaLocalD1Migration/1.0"})
    with urllib.request.urlopen(req, timeout=30) as response:
        body = response.read().decode("utf-8-sig")
    return list(csv.DictReader(io.StringIO(body)))


def load_json(path: Path) -> dict:
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def main() -> None:
    rows = fetch_rows()
    slug_registry = load_json(REGISTRY)
    city_images = load_json(CITY_IMAGES)

    active = []
    for row in rows:
        name, city = clean(row.get("Place")), clean(row.get("City"))
        status = clean(row.get("Place Status")) or "Active"
        if not name or not city or status.lower() != "active":
            continue
        place_id = clean(row.get("Place ID"))
        if not place_id:
            continue
        slug = clean(row.get("URL Slug")) or clean(slug_registry.get(place_id)) or slugify(f"{name}-{city}")
        row["__slug"] = slug
        active.append(row)

    cities = sorted({clean(r.get("City")) for r in active}, key=str.casefold)
    city_id = {name: i + 1 for i, name in enumerate(cities)}

    statements = [
        "DELETE FROM place_images;",
        "DELETE FROM places;",
        "DELETE FROM cities;",
    ]

    for city in cities:
        meta = city_images.get(city, {}) if isinstance(city_images, dict) else {}
        statements.append(
            "INSERT INTO cities (id,name,slug,state,summary,hero_image_url,hero_image_credit,active) VALUES "
            f"({city_id[city]},{sql(city)},{sql(slugify(city))},'GA',{sql(meta.get('summary'))},{sql(meta.get('url'))},{sql(meta.get('credit'))},1);"
        )

    for row in active:
        pid = clean(row.get("Place ID"))
        city = clean(row.get("City"))
        category = clean(row.get("Public Category (Auto)")) or clean(row.get("Category")) or "Other"
        columns = [
            "place_id","slug","name","city_id","area","category","source_category","price","vibe","tags","address","website_url",
            "parking","reservations","patio","kid_friendly","dog_friendly","dress_level","hours","pricing_details","public_summary","why_go",
            "featured","last_verified","status"
        ]
        values = [
            sql(pid), sql(row["__slug"]), sql(row.get("Place")), str(city_id[city]), sql(row.get("Area / Neighborhood")), sql(category),
            sql(row.get("Category")), sql(row.get("Price")), sql(row.get("Vibe / Good For")), sql(row.get("Tags / Best For")), sql(row.get("Address")),
            sql(row.get("Website / Source")), sql(row.get("Parking")), sql(row.get("Reservations?")), sql(row.get("Patio?")), sql(row.get("Kid Friendly?")),
            sql(row.get("Dog Friendly?")), sql(row.get("Dress Level")), sql(row.get("Hours / Schedule")), sql(row.get("Pricing Details")),
            sql(row.get("Public Summary")), sql(row.get("Why Go")), str(truthy(row.get("Featured", ""))), sql(row.get("Last Verified")), "'Active'"
        ]
        statements.append(f"INSERT INTO places ({','.join(columns)}) VALUES ({','.join(values)});")

        image_urls = [
            clean(row.get("Hero Image URL")),
            clean(row.get("Gallery Image 2 URL")),
            clean(row.get("Gallery Image 3 URL")),
            clean(row.get("Gallery Image 4 URL")),
        ]
        credit = clean(row.get("Image Credit"))
        for position, url in enumerate([u for u in image_urls if u], start=1):
            alt = f"{clean(row.get('Place'))} in {city}"
            statements.append(
                "INSERT INTO place_images (place_id,image_url,alt_text,credit,position) VALUES "
                f"({sql(pid)},{sql(url)},{sql(alt)},{sql(credit)},{position});"
            )

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text("\n".join(statements) + "\n", encoding="utf-8")
    print(f"Generated {OUT} with {len(active)} active places across {len(cities)} cities.")


if __name__ == "__main__":
    main()
