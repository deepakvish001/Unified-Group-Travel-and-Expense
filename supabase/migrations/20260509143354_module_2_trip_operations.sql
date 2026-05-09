/*
  # MODULE 2: Trip Operations & Planning System

  ## Summary
  Extends Module 1 by linking trips to groups and adding rich operational planning entities.

  ## Changes
  1. trips: adds `group_id`, `category` columns
  2. itinerary_items: adds `status`, `priority`, `assigned_to`, `estimated_cost`, `actual_cost`, `end_time`, `duration_minutes`, `last_edited_by`
  3. New tables:
     - `trip_tasks` (Kanban: Todo / In Progress / Completed)
     - `trip_polls`, `trip_poll_options`, `trip_poll_votes`
     - `trip_activity_logs` (operational audit for trips)
     - `trip_presence` (live collaborative presence)
  4. RLS enabled on all new tables. Access scoped to trip members via helper `is_trip_member`.
*/

-- 1. Extend trips table
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trips' AND column_name = 'group_id') THEN
    ALTER TABLE trips ADD COLUMN group_id uuid REFERENCES groups(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trips' AND column_name = 'category') THEN
    ALTER TABLE trips ADD COLUMN category text DEFAULT 'friends';
  END IF;
END $$;

-- 2. Extend itinerary_items table
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'itinerary_items' AND column_name = 'status') THEN
    ALTER TABLE itinerary_items ADD COLUMN status text DEFAULT 'planned';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'itinerary_items' AND column_name = 'priority') THEN
    ALTER TABLE itinerary_items ADD COLUMN priority text DEFAULT 'medium';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'itinerary_items' AND column_name = 'assigned_to') THEN
    ALTER TABLE itinerary_items ADD COLUMN assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'itinerary_items' AND column_name = 'estimated_cost') THEN
    ALTER TABLE itinerary_items ADD COLUMN estimated_cost numeric DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'itinerary_items' AND column_name = 'actual_cost') THEN
    ALTER TABLE itinerary_items ADD COLUMN actual_cost numeric DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'itinerary_items' AND column_name = 'end_time') THEN
    ALTER TABLE itinerary_items ADD COLUMN end_time text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'itinerary_items' AND column_name = 'duration_minutes') THEN
    ALTER TABLE itinerary_items ADD COLUMN duration_minutes int DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'itinerary_items' AND column_name = 'last_edited_by') THEN
    ALTER TABLE itinerary_items ADD COLUMN last_edited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'itinerary_items' AND column_name = 'updated_at') THEN
    ALTER TABLE itinerary_items ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;
END $$;

-- 3. Trip tasks (Kanban)
CREATE TABLE IF NOT EXISTS trip_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  description text DEFAULT '',
  status text DEFAULT 'todo',
  priority text DEFAULT 'medium',
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  deadline timestamptz,
  linked_activity_id uuid REFERENCES itinerary_items(id) ON DELETE SET NULL,
  position int DEFAULT 0,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE trip_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Trip members view tasks" ON trip_tasks;
CREATE POLICY "Trip members view tasks" ON trip_tasks FOR SELECT TO authenticated
USING (is_trip_member(trip_id, auth.uid()));

DROP POLICY IF EXISTS "Trip members create tasks" ON trip_tasks;
CREATE POLICY "Trip members create tasks" ON trip_tasks FOR INSERT TO authenticated
WITH CHECK (is_trip_member(trip_id, auth.uid()) AND created_by = auth.uid());

DROP POLICY IF EXISTS "Trip members update tasks" ON trip_tasks;
CREATE POLICY "Trip members update tasks" ON trip_tasks FOR UPDATE TO authenticated
USING (is_trip_member(trip_id, auth.uid()))
WITH CHECK (is_trip_member(trip_id, auth.uid()));

DROP POLICY IF EXISTS "Trip members delete tasks" ON trip_tasks;
CREATE POLICY "Trip members delete tasks" ON trip_tasks FOR DELETE TO authenticated
USING (is_trip_member(trip_id, auth.uid()));

-- 4. Trip polls
CREATE TABLE IF NOT EXISTS trip_polls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  question text NOT NULL DEFAULT '',
  category text DEFAULT 'general',
  is_anonymous boolean DEFAULT false,
  allow_multiple boolean DEFAULT false,
  expires_at timestamptz,
  is_closed boolean DEFAULT false,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE trip_polls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Trip members view polls" ON trip_polls;
CREATE POLICY "Trip members view polls" ON trip_polls FOR SELECT TO authenticated
USING (is_trip_member(trip_id, auth.uid()));
DROP POLICY IF EXISTS "Trip members create polls" ON trip_polls;
CREATE POLICY "Trip members create polls" ON trip_polls FOR INSERT TO authenticated
WITH CHECK (is_trip_member(trip_id, auth.uid()) AND created_by = auth.uid());
DROP POLICY IF EXISTS "Poll creator updates polls" ON trip_polls;
CREATE POLICY "Poll creator updates polls" ON trip_polls FOR UPDATE TO authenticated
USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());
DROP POLICY IF EXISTS "Poll creator deletes polls" ON trip_polls;
CREATE POLICY "Poll creator deletes polls" ON trip_polls FOR DELETE TO authenticated
USING (created_by = auth.uid());

CREATE TABLE IF NOT EXISTS trip_poll_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id uuid NOT NULL REFERENCES trip_polls(id) ON DELETE CASCADE,
  option_text text NOT NULL DEFAULT '',
  position int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE trip_poll_options ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "View options if view poll" ON trip_poll_options;
CREATE POLICY "View options if view poll" ON trip_poll_options FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM trip_polls p WHERE p.id = poll_id AND is_trip_member(p.trip_id, auth.uid())));
DROP POLICY IF EXISTS "Create options if own poll" ON trip_poll_options;
CREATE POLICY "Create options if own poll" ON trip_poll_options FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM trip_polls p WHERE p.id = poll_id AND p.created_by = auth.uid()));
DROP POLICY IF EXISTS "Delete options if own poll" ON trip_poll_options;
CREATE POLICY "Delete options if own poll" ON trip_poll_options FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM trip_polls p WHERE p.id = poll_id AND p.created_by = auth.uid()));

CREATE TABLE IF NOT EXISTS trip_poll_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  option_id uuid NOT NULL REFERENCES trip_poll_options(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(option_id, user_id)
);

ALTER TABLE trip_poll_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "View votes if trip member" ON trip_poll_votes;
CREATE POLICY "View votes if trip member" ON trip_poll_votes FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM trip_poll_options o JOIN trip_polls p ON p.id = o.poll_id WHERE o.id = option_id AND is_trip_member(p.trip_id, auth.uid())));
DROP POLICY IF EXISTS "Create own vote" ON trip_poll_votes;
CREATE POLICY "Create own vote" ON trip_poll_votes FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM trip_poll_options o JOIN trip_polls p ON p.id = o.poll_id WHERE o.id = option_id AND is_trip_member(p.trip_id, auth.uid())));
DROP POLICY IF EXISTS "Delete own vote" ON trip_poll_votes;
CREATE POLICY "Delete own vote" ON trip_poll_votes FOR DELETE TO authenticated
USING (user_id = auth.uid());

-- 5. Trip activity logs (operational)
CREATE TABLE IF NOT EXISTS trip_activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  related_entity_type text,
  related_entity_id uuid,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE trip_activity_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Trip members view logs" ON trip_activity_logs;
CREATE POLICY "Trip members view logs" ON trip_activity_logs FOR SELECT TO authenticated
USING (is_trip_member(trip_id, auth.uid()));
DROP POLICY IF EXISTS "Trip members create logs" ON trip_activity_logs;
CREATE POLICY "Trip members create logs" ON trip_activity_logs FOR INSERT TO authenticated
WITH CHECK (is_trip_member(trip_id, auth.uid()) AND actor_id = auth.uid());

-- 6. Trip presence (live collaboration)
CREATE TABLE IF NOT EXISTS trip_presence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  current_view text DEFAULT '',
  last_seen timestamptz DEFAULT now(),
  UNIQUE(trip_id, user_id)
);

ALTER TABLE trip_presence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Trip members view presence" ON trip_presence;
CREATE POLICY "Trip members view presence" ON trip_presence FOR SELECT TO authenticated
USING (is_trip_member(trip_id, auth.uid()));
DROP POLICY IF EXISTS "Users upsert own presence" ON trip_presence;
CREATE POLICY "Users upsert own presence" ON trip_presence FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND is_trip_member(trip_id, auth.uid()));
DROP POLICY IF EXISTS "Users update own presence" ON trip_presence;
CREATE POLICY "Users update own presence" ON trip_presence FOR UPDATE TO authenticated
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Users delete own presence" ON trip_presence;
CREATE POLICY "Users delete own presence" ON trip_presence FOR DELETE TO authenticated
USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_trip_tasks_trip ON trip_tasks(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_polls_trip ON trip_polls(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_activity_logs_trip ON trip_activity_logs(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_presence_trip ON trip_presence(trip_id);
CREATE INDEX IF NOT EXISTS idx_trips_group ON trips(group_id);
