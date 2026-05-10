/*
  # Reservations & Nearby Services Tables

  ## Summary
  Adds tables for managing nearby services discovery, reservations,
  and user preferences for the Reservations feature.

  ## New Tables
  1. `nearby_services` - Cache of discovered services
  2. `service_reservations` - User reservations for services
  3. `saved_services` - User's favorite/saved services
  4. `service_search_history` - Recent service searches

  ## Security
  - RLS enabled on all tables
  - Trip member scoping enforced
*/

-- ─── Service Categories Enum ────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'service_category') THEN
    CREATE TYPE service_category AS ENUM ('car_rental', 'restaurant', 'hotel', 'cafe', 'attraction', 'emergency', 'fuel_station', 'other');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'reservation_status') THEN
    CREATE TYPE reservation_status AS ENUM ('pending', 'confirmed', 'completed', 'cancelled');
  END IF;
END $$;

-- ─── Nearby Services Cache ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS nearby_services (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id         uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  discovered_by   uuid NOT NULL REFERENCES auth.users(id),
  category        service_category NOT NULL,
  name            text NOT NULL,
  description     text,
  address         text,
  latitude        numeric(10, 8),
  longitude       numeric(11, 8),
  distance_km     numeric(6, 2),
  rating          numeric(3, 1),
  review_count    int DEFAULT 0,
  image_url       text,
  website         text,
  phone           text,
  opening_hours   jsonb DEFAULT '{}',
  price_level     int CHECK (price_level >= 1 AND price_level <= 4),
  estimated_cost  numeric(12, 2),
  availability    boolean DEFAULT true,
  google_place_id text UNIQUE,
  metadata        jsonb DEFAULT '{}',
  discovered_at   timestamptz DEFAULT now(),
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE nearby_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trip members can view discovered services"
  ON nearby_services FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM trip_members tm
    WHERE tm.trip_id = nearby_services.trip_id
    AND tm.user_id = auth.uid()
  ));

CREATE POLICY "Trip members can add discovered services"
  ON nearby_services FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = discovered_by AND
    EXISTS (
      SELECT 1 FROM trip_members tm
      WHERE tm.trip_id = nearby_services.trip_id
      AND tm.user_id = auth.uid()
    )
  );

-- ─── Service Reservations ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS service_reservations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id         uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  service_id      uuid NOT NULL REFERENCES nearby_services(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES auth.users(id),
  category        service_category NOT NULL,
  reservation_type text NOT NULL,
  status          reservation_status NOT NULL DEFAULT 'pending',
  start_date      timestamptz,
  end_date        timestamptz,
  pickup_location text,
  dropoff_location text,
  notes           text,
  estimated_cost  numeric(12, 2),
  total_cost      numeric(12, 2),
  confirmation_number text,
  external_booking_url text,
  created_by      uuid NOT NULL REFERENCES auth.users(id),
  confirmed_at    timestamptz,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

ALTER TABLE service_reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trip members can view trip reservations"
  ON service_reservations FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM trip_members tm
    WHERE tm.trip_id = service_reservations.trip_id
    AND tm.user_id = auth.uid()
  ));

CREATE POLICY "Trip members can create reservations"
  ON service_reservations FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM trip_members tm
      WHERE tm.trip_id = service_reservations.trip_id
      AND tm.user_id = auth.uid()
    )
  );

CREATE POLICY "Reservation creator can update own reservation"
  ON service_reservations FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Reservation creator can delete own reservation"
  ON service_reservations FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ─── Saved Services ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS saved_services (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id         uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  service_id      uuid NOT NULL REFERENCES nearby_services(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES auth.users(id),
  saved_at        timestamptz DEFAULT now(),
  UNIQUE(trip_id, service_id, user_id)
);

ALTER TABLE saved_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own saved services"
  ON saved_services FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can save services"
  ON saved_services FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM trip_members tm
      WHERE tm.trip_id = saved_services.trip_id
      AND tm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can unsave services"
  ON saved_services FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ─── Search History ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS service_search_history (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id         uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES auth.users(id),
  category        service_category,
  search_query    text,
  latitude        numeric(10, 8),
  longitude       numeric(11, 8),
  results_count   int DEFAULT 0,
  searched_at     timestamptz DEFAULT now()
);

ALTER TABLE service_search_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own search history"
  ON service_search_history FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can record searches"
  ON service_search_history FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- ─── Indexes ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_nearby_services_trip_id ON nearby_services(trip_id);
CREATE INDEX IF NOT EXISTS idx_nearby_services_category ON nearby_services(category);
CREATE INDEX IF NOT EXISTS idx_nearby_services_rating ON nearby_services(rating DESC);
CREATE INDEX IF NOT EXISTS idx_service_reservations_trip_id ON service_reservations(trip_id);
CREATE INDEX IF NOT EXISTS idx_service_reservations_user_id ON service_reservations(user_id);
CREATE INDEX IF NOT EXISTS idx_service_reservations_status ON service_reservations(status);
CREATE INDEX IF NOT EXISTS idx_saved_services_trip_id ON saved_services(trip_id);
CREATE INDEX IF NOT EXISTS idx_saved_services_user_id ON saved_services(user_id);
CREATE INDEX IF NOT EXISTS idx_search_history_trip_id ON service_search_history(trip_id);
CREATE INDEX IF NOT EXISTS idx_search_history_user_id ON service_search_history(user_id);
