/*
  # Add invites, notifications, and votes
  1. New tables
    - trip_invites: shareable invite tokens per trip
    - notifications: per-user notification feed
    - itinerary_votes: up/down votes on itinerary items
    - booking_votes: up/down votes on bookings
  2. Security: RLS enabled on all new tables
*/

CREATE TABLE IF NOT EXISTS trip_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  token text UNIQUE NOT NULL,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '30 days'),
  uses int DEFAULT 0,
  max_uses int DEFAULT 50
);

ALTER TABLE trip_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view invites" ON trip_invites FOR SELECT TO authenticated
  USING (is_trip_member(trip_id, auth.uid()));
CREATE POLICY "Owners create invites" ON trip_invites FOR INSERT TO authenticated
  WITH CHECK (is_trip_owner(trip_id, auth.uid()));
CREATE POLICY "Owners delete invites" ON trip_invites FOR DELETE TO authenticated
  USING (is_trip_owner(trip_id, auth.uid()));

-- Separate public lookup function to allow unauthenticated/non-member users to resolve an invite token
CREATE OR REPLACE FUNCTION accept_trip_invite(p_token text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite trip_invites%ROWTYPE;
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;
  SELECT * INTO v_invite FROM trip_invites WHERE token = p_token;
  IF NOT FOUND THEN RAISE EXCEPTION 'invalid invite'; END IF;
  IF v_invite.expires_at < now() THEN RAISE EXCEPTION 'expired'; END IF;
  IF v_invite.uses >= v_invite.max_uses THEN RAISE EXCEPTION 'max uses reached'; END IF;
  INSERT INTO trip_members (trip_id, user_id, role)
    VALUES (v_invite.trip_id, v_user, 'member')
    ON CONFLICT (trip_id, user_id) DO NOTHING;
  UPDATE trip_invites SET uses = uses + 1 WHERE id = v_invite.id;
  RETURN v_invite.trip_id;
END;
$$;

GRANT EXECUTE ON FUNCTION accept_trip_invite(text) TO authenticated;

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  trip_id uuid REFERENCES trips(id) ON DELETE CASCADE,
  type text DEFAULT 'info',
  title text DEFAULT '',
  body text DEFAULT '',
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own notifications" ON notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "Users create own notifications" ON notifications FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR (trip_id IS NOT NULL AND is_trip_member(trip_id, auth.uid())));
CREATE POLICY "Users update own notifications" ON notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users delete own notifications" ON notifications FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS itinerary_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES itinerary_items(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  value int NOT NULL DEFAULT 1,
  created_at timestamptz DEFAULT now(),
  UNIQUE(item_id, user_id)
);

ALTER TABLE itinerary_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view votes" ON itinerary_votes FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM itinerary_items WHERE itinerary_items.id = itinerary_votes.item_id AND is_trip_member(itinerary_items.trip_id, auth.uid())));
CREATE POLICY "Users cast own votes" ON itinerary_votes FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM itinerary_items WHERE itinerary_items.id = itinerary_votes.item_id AND is_trip_member(itinerary_items.trip_id, auth.uid())));
CREATE POLICY "Users update own votes" ON itinerary_votes FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users delete own votes" ON itinerary_votes FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS booking_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  value int NOT NULL DEFAULT 1,
  created_at timestamptz DEFAULT now(),
  UNIQUE(booking_id, user_id)
);

ALTER TABLE booking_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view booking votes" ON booking_votes FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM bookings WHERE bookings.id = booking_votes.booking_id AND is_trip_member(bookings.trip_id, auth.uid())));
CREATE POLICY "Users cast own booking votes" ON booking_votes FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM bookings WHERE bookings.id = booking_votes.booking_id AND is_trip_member(bookings.trip_id, auth.uid())));
CREATE POLICY "Users update own booking votes" ON booking_votes FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users delete own booking votes" ON booking_votes FOR DELETE TO authenticated
  USING (user_id = auth.uid());

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'expense_splits' AND column_name = 'settled_at') THEN
    ALTER TABLE expense_splits ADD COLUMN settled_at timestamptz;
  END IF;
END $$;
