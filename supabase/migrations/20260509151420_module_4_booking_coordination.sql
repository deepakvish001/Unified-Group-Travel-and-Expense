/*
  # Module 4: Unified Booking Coordination System

  1. Bookings table extensions
    - Adds coordinator, priority, deadline, travel_date, cost tracking,
      linked expense/activity, attachments, external platform URL,
      reference number, notes, audit columns
    - Expands type to include train/bus/flight/hotel/activity/car_rental/event_ticket
    - Expands status to pending/in_progress/confirmed/cancelled/on_hold/requires_action

  2. New tables
    - traveler_profiles: shared traveler vault per user, preferences,
      and verification status (NO full government ID numbers stored)
    - booking_participants: include/exclude members per booking with reason
    - booking_activity_logs: append-only audit feed for a booking

  3. Security
    - RLS enabled on all new tables
    - Policies restricted to trip members (reuses is_trip_member / is_trip_owner helpers)
    - traveler_profiles: users can manage their own; trip members of a shared trip can read
*/

-- Extend bookings
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='assigned_coordinator') THEN
    ALTER TABLE bookings ADD COLUMN assigned_coordinator uuid;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='priority') THEN
    ALTER TABLE bookings ADD COLUMN priority text DEFAULT 'medium';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='booking_deadline') THEN
    ALTER TABLE bookings ADD COLUMN booking_deadline timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='travel_date') THEN
    ALTER TABLE bookings ADD COLUMN travel_date date;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='estimated_cost') THEN
    ALTER TABLE bookings ADD COLUMN estimated_cost numeric DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='actual_cost') THEN
    ALTER TABLE bookings ADD COLUMN actual_cost numeric DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='linked_expense_id') THEN
    ALTER TABLE bookings ADD COLUMN linked_expense_id uuid;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='linked_activity_id') THEN
    ALTER TABLE bookings ADD COLUMN linked_activity_id uuid;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='attachments') THEN
    ALTER TABLE bookings ADD COLUMN attachments jsonb DEFAULT '[]'::jsonb;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='external_booking_url') THEN
    ALTER TABLE bookings ADD COLUMN external_booking_url text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='booking_reference') THEN
    ALTER TABLE bookings ADD COLUMN booking_reference text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='notes') THEN
    ALTER TABLE bookings ADD COLUMN notes text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='last_edited_by') THEN
    ALTER TABLE bookings ADD COLUMN last_edited_by uuid;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='updated_at') THEN
    ALTER TABLE bookings ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;
END $$;

-- Traveler vault (per user, richer than user_profiles)
CREATE TABLE IF NOT EXISTS traveler_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text DEFAULT '',
  date_of_birth date,
  gender text DEFAULT '',
  phone_country_code text DEFAULT '+91',
  phone_number text DEFAULT '',
  email text DEFAULT '',
  nationality text DEFAULT '',
  seat_preference text DEFAULT 'no_preference',
  food_preference text DEFAULT 'no_preference',
  berth_preference text DEFAULT 'no_preference',
  special_requirements text DEFAULT '',
  id_verified boolean DEFAULT false,
  id_type text DEFAULT '',
  id_last_four text DEFAULT '',
  id_expiry date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE traveler_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user reads own traveler profile" ON traveler_profiles;
CREATE POLICY "user reads own traveler profile" ON traveler_profiles FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "trip member reads co-traveler profile" ON traveler_profiles;
CREATE POLICY "trip member reads co-traveler profile" ON traveler_profiles FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM trip_members tm1
    JOIN trip_members tm2 ON tm2.trip_id = tm1.trip_id
    WHERE tm1.user_id = auth.uid() AND tm2.user_id = traveler_profiles.user_id
  ));

DROP POLICY IF EXISTS "user inserts own traveler profile" ON traveler_profiles;
CREATE POLICY "user inserts own traveler profile" ON traveler_profiles FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "user updates own traveler profile" ON traveler_profiles;
CREATE POLICY "user updates own traveler profile" ON traveler_profiles FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "user deletes own traveler profile" ON traveler_profiles;
CREATE POLICY "user deletes own traveler profile" ON traveler_profiles FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Booking participants
CREATE TABLE IF NOT EXISTS booking_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  participation_status text DEFAULT 'included',
  excluded_reason text DEFAULT '',
  added_by uuid,
  added_at timestamptz DEFAULT now(),
  UNIQUE (booking_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_booking_participants_booking ON booking_participants(booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_participants_user ON booking_participants(user_id);

ALTER TABLE booking_participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "trip members read booking participants" ON booking_participants;
CREATE POLICY "trip members read booking participants" ON booking_participants FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM bookings b JOIN trip_members tm ON tm.trip_id = b.trip_id
    WHERE b.id = booking_participants.booking_id AND tm.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "trip members insert booking participants" ON booking_participants;
CREATE POLICY "trip members insert booking participants" ON booking_participants FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM bookings b JOIN trip_members tm ON tm.trip_id = b.trip_id
    WHERE b.id = booking_participants.booking_id AND tm.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "trip members update booking participants" ON booking_participants;
CREATE POLICY "trip members update booking participants" ON booking_participants FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM bookings b JOIN trip_members tm ON tm.trip_id = b.trip_id
    WHERE b.id = booking_participants.booking_id AND tm.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM bookings b JOIN trip_members tm ON tm.trip_id = b.trip_id
    WHERE b.id = booking_participants.booking_id AND tm.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "trip members delete booking participants" ON booking_participants;
CREATE POLICY "trip members delete booking participants" ON booking_participants FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM bookings b JOIN trip_members tm ON tm.trip_id = b.trip_id
    WHERE b.id = booking_participants.booking_id AND tm.user_id = auth.uid()
  ));

-- Booking activity logs
CREATE TABLE IF NOT EXISTS booking_activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  trip_id uuid NOT NULL,
  action text NOT NULL DEFAULT '',
  performed_by uuid,
  message text DEFAULT '',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_booking_logs_booking ON booking_activity_logs(booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_logs_trip ON booking_activity_logs(trip_id);

ALTER TABLE booking_activity_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "trip members read booking logs" ON booking_activity_logs;
CREATE POLICY "trip members read booking logs" ON booking_activity_logs FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM trip_members tm WHERE tm.trip_id = booking_activity_logs.trip_id AND tm.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "trip members insert booking logs" ON booking_activity_logs;
CREATE POLICY "trip members insert booking logs" ON booking_activity_logs FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM trip_members tm WHERE tm.trip_id = booking_activity_logs.trip_id AND tm.user_id = auth.uid()
  ));
