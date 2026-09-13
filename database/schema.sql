PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS cities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  state TEXT NOT NULL DEFAULT 'GA',
  summary TEXT,
  hero_image_url TEXT,
  hero_image_credit TEXT,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS places (
  place_id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  city_id INTEGER NOT NULL,
  area TEXT,
  category TEXT,
  source_category TEXT,
  price TEXT,
  vibe TEXT,
  tags TEXT,
  address TEXT,
  website_url TEXT,
  parking TEXT,
  reservations TEXT,
  patio TEXT,
  kid_friendly TEXT,
  dog_friendly TEXT,
  dress_level TEXT,
  hours TEXT,
  pricing_details TEXT,
  public_summary TEXT,
  why_go TEXT,
  featured INTEGER NOT NULL DEFAULT 0 CHECK (featured IN (0,1)),
  last_verified TEXT,
  status TEXT NOT NULL DEFAULT 'Active',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (city_id) REFERENCES cities(id) ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS place_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  place_id TEXT NOT NULL,
  image_url TEXT NOT NULL,
  alt_text TEXT,
  credit TEXT,
  position INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(place_id, position),
  FOREIGN KEY (place_id) REFERENCES places(place_id) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_places_city_id ON places(city_id);
CREATE INDEX IF NOT EXISTS idx_places_category ON places(category);
CREATE INDEX IF NOT EXISTS idx_places_status ON places(status);
CREATE INDEX IF NOT EXISTS idx_places_featured ON places(featured);
CREATE INDEX IF NOT EXISTS idx_places_name ON places(name);
CREATE INDEX IF NOT EXISTS idx_images_place_id ON place_images(place_id);
