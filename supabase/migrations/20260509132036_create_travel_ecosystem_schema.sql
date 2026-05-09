/*
  # Group Travel & Expense Ecosystem Schema
  Creates tables and RLS for collaborative group travel platform.
*/

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text DEFAULT '',
  avatar_url text DEFAULT '',
  email text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS trips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  destination text DEFAULT '',
  description text DEFAULT '',
  start_date date,
  end_date date,
  budget numeric DEFAULT 0,
  currency text DEFAULT 'USD',
  cover_url text DEFAULT '',
  status text DEFAULT 'planning',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS trip_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role text DEFAULT 'member',
  joined_at timestamptz DEFAULT now(),
  UNIQUE(trip_id, user_id)
);

CREATE TABLE IF NOT EXISTS itinerary_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  day_number int DEFAULT 1,
  start_time text DEFAULT '',
  title text DEFAULT '',
  location text DEFAULT '',
  notes text DEFAULT '',
  category text DEFAULT 'activity',
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  position int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  type text DEFAULT 'activity',
  title text DEFAULT '',
  provider text DEFAULT '',
  location text DEFAULT '',
  image_url text DEFAULT '',
  cost numeric DEFAULT 0,
  currency text DEFAULT 'USD',
  booking_date date,
  details jsonb DEFAULT '{}'::jsonb,
  status text DEFAULT 'confirmed',
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  paid_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  title text DEFAULT '',
  category text DEFAULT 'other',
  amount numeric DEFAULT 0,
  currency text DEFAULT 'USD',
  split_type text DEFAULT 'equal',
  expense_date date DEFAULT CURRENT_DATE,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS expense_splits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id uuid NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount numeric DEFAULT 0,
  settled boolean DEFAULT false
);

CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  type text DEFAULT 'tip',
  content text DEFAULT '',
  accepted boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE itinerary_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read all profiles" ON profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users insert own profile" ON profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users update own profile" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE POLICY "Members view trips" ON trips FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR EXISTS (SELECT 1 FROM trip_members WHERE trip_members.trip_id = trips.id AND trip_members.user_id = auth.uid()));
CREATE POLICY "Users create trips" ON trips FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Owners update trips" ON trips FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Owners delete trips" ON trips FOR DELETE TO authenticated USING (owner_id = auth.uid());

CREATE POLICY "Members view membership" ON trip_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM trips WHERE trips.id = trip_members.trip_id AND trips.owner_id = auth.uid()));
CREATE POLICY "Owners add members" ON trip_members FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM trips WHERE trips.id = trip_members.trip_id AND trips.owner_id = auth.uid()) OR user_id = auth.uid());
CREATE POLICY "Owners update members" ON trip_members FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM trips WHERE trips.id = trip_members.trip_id AND trips.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM trips WHERE trips.id = trip_members.trip_id AND trips.owner_id = auth.uid()));
CREATE POLICY "Owners remove members" ON trip_members FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM trips WHERE trips.id = trip_members.trip_id AND trips.owner_id = auth.uid()) OR user_id = auth.uid());

CREATE POLICY "Members view itinerary" ON itinerary_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM trips WHERE trips.id = itinerary_items.trip_id AND (trips.owner_id = auth.uid() OR EXISTS (SELECT 1 FROM trip_members WHERE trip_members.trip_id = trips.id AND trip_members.user_id = auth.uid()))));
CREATE POLICY "Members add itinerary" ON itinerary_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM trips WHERE trips.id = itinerary_items.trip_id AND (trips.owner_id = auth.uid() OR EXISTS (SELECT 1 FROM trip_members WHERE trip_members.trip_id = trips.id AND trip_members.user_id = auth.uid()))));
CREATE POLICY "Members update itinerary" ON itinerary_items FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM trips WHERE trips.id = itinerary_items.trip_id AND (trips.owner_id = auth.uid() OR EXISTS (SELECT 1 FROM trip_members WHERE trip_members.trip_id = trips.id AND trip_members.user_id = auth.uid()))))
  WITH CHECK (EXISTS (SELECT 1 FROM trips WHERE trips.id = itinerary_items.trip_id AND (trips.owner_id = auth.uid() OR EXISTS (SELECT 1 FROM trip_members WHERE trip_members.trip_id = trips.id AND trip_members.user_id = auth.uid()))));
CREATE POLICY "Members delete itinerary" ON itinerary_items FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM trips WHERE trips.id = itinerary_items.trip_id AND (trips.owner_id = auth.uid() OR EXISTS (SELECT 1 FROM trip_members WHERE trip_members.trip_id = trips.id AND trip_members.user_id = auth.uid()))));

CREATE POLICY "Members view bookings" ON bookings FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM trips WHERE trips.id = bookings.trip_id AND (trips.owner_id = auth.uid() OR EXISTS (SELECT 1 FROM trip_members WHERE trip_members.trip_id = trips.id AND trip_members.user_id = auth.uid()))));
CREATE POLICY "Members add bookings" ON bookings FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM trips WHERE trips.id = bookings.trip_id AND (trips.owner_id = auth.uid() OR EXISTS (SELECT 1 FROM trip_members WHERE trip_members.trip_id = trips.id AND trip_members.user_id = auth.uid()))));
CREATE POLICY "Members update bookings" ON bookings FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM trips WHERE trips.id = bookings.trip_id AND (trips.owner_id = auth.uid() OR EXISTS (SELECT 1 FROM trip_members WHERE trip_members.trip_id = trips.id AND trip_members.user_id = auth.uid()))))
  WITH CHECK (EXISTS (SELECT 1 FROM trips WHERE trips.id = bookings.trip_id AND (trips.owner_id = auth.uid() OR EXISTS (SELECT 1 FROM trip_members WHERE trip_members.trip_id = trips.id AND trip_members.user_id = auth.uid()))));
CREATE POLICY "Members delete bookings" ON bookings FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM trips WHERE trips.id = bookings.trip_id AND (trips.owner_id = auth.uid() OR EXISTS (SELECT 1 FROM trip_members WHERE trip_members.trip_id = trips.id AND trip_members.user_id = auth.uid()))));

CREATE POLICY "Members view expenses" ON expenses FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM trips WHERE trips.id = expenses.trip_id AND (trips.owner_id = auth.uid() OR EXISTS (SELECT 1 FROM trip_members WHERE trip_members.trip_id = trips.id AND trip_members.user_id = auth.uid()))));
CREATE POLICY "Members add expenses" ON expenses FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM trips WHERE trips.id = expenses.trip_id AND (trips.owner_id = auth.uid() OR EXISTS (SELECT 1 FROM trip_members WHERE trip_members.trip_id = trips.id AND trip_members.user_id = auth.uid()))));
CREATE POLICY "Members update expenses" ON expenses FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM trips WHERE trips.id = expenses.trip_id AND (trips.owner_id = auth.uid() OR EXISTS (SELECT 1 FROM trip_members WHERE trip_members.trip_id = trips.id AND trip_members.user_id = auth.uid()))))
  WITH CHECK (EXISTS (SELECT 1 FROM trips WHERE trips.id = expenses.trip_id AND (trips.owner_id = auth.uid() OR EXISTS (SELECT 1 FROM trip_members WHERE trip_members.trip_id = trips.id AND trip_members.user_id = auth.uid()))));
CREATE POLICY "Members delete expenses" ON expenses FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM trips WHERE trips.id = expenses.trip_id AND (trips.owner_id = auth.uid() OR EXISTS (SELECT 1 FROM trip_members WHERE trip_members.trip_id = trips.id AND trip_members.user_id = auth.uid()))));

CREATE POLICY "Members view splits" ON expense_splits FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM expenses JOIN trips ON trips.id = expenses.trip_id WHERE expenses.id = expense_splits.expense_id AND (trips.owner_id = auth.uid() OR EXISTS (SELECT 1 FROM trip_members WHERE trip_members.trip_id = trips.id AND trip_members.user_id = auth.uid()))));
CREATE POLICY "Members add splits" ON expense_splits FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM expenses JOIN trips ON trips.id = expenses.trip_id WHERE expenses.id = expense_splits.expense_id AND (trips.owner_id = auth.uid() OR EXISTS (SELECT 1 FROM trip_members WHERE trip_members.trip_id = trips.id AND trip_members.user_id = auth.uid()))));
CREATE POLICY "Members update splits" ON expense_splits FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM expenses JOIN trips ON trips.id = expenses.trip_id WHERE expenses.id = expense_splits.expense_id AND (trips.owner_id = auth.uid() OR EXISTS (SELECT 1 FROM trip_members WHERE trip_members.trip_id = trips.id AND trip_members.user_id = auth.uid()))))
  WITH CHECK (EXISTS (SELECT 1 FROM expenses JOIN trips ON trips.id = expenses.trip_id WHERE expenses.id = expense_splits.expense_id AND (trips.owner_id = auth.uid() OR EXISTS (SELECT 1 FROM trip_members WHERE trip_members.trip_id = trips.id AND trip_members.user_id = auth.uid()))));
CREATE POLICY "Members delete splits" ON expense_splits FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM expenses JOIN trips ON trips.id = expenses.trip_id WHERE expenses.id = expense_splits.expense_id AND (trips.owner_id = auth.uid() OR EXISTS (SELECT 1 FROM trip_members WHERE trip_members.trip_id = trips.id AND trip_members.user_id = auth.uid()))));

CREATE POLICY "Members view messages" ON messages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM trips WHERE trips.id = messages.trip_id AND (trips.owner_id = auth.uid() OR EXISTS (SELECT 1 FROM trip_members WHERE trip_members.trip_id = trips.id AND trip_members.user_id = auth.uid()))));
CREATE POLICY "Members post messages" ON messages FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM trips WHERE trips.id = messages.trip_id AND (trips.owner_id = auth.uid() OR EXISTS (SELECT 1 FROM trip_members WHERE trip_members.trip_id = trips.id AND trip_members.user_id = auth.uid()))));
CREATE POLICY "Users delete own messages" ON messages FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Members view suggestions" ON ai_suggestions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM trips WHERE trips.id = ai_suggestions.trip_id AND (trips.owner_id = auth.uid() OR EXISTS (SELECT 1 FROM trip_members WHERE trip_members.trip_id = trips.id AND trip_members.user_id = auth.uid()))));
CREATE POLICY "Members add suggestions" ON ai_suggestions FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM trips WHERE trips.id = ai_suggestions.trip_id AND (trips.owner_id = auth.uid() OR EXISTS (SELECT 1 FROM trip_members WHERE trip_members.trip_id = trips.id AND trip_members.user_id = auth.uid()))));
CREATE POLICY "Members update suggestions" ON ai_suggestions FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM trips WHERE trips.id = ai_suggestions.trip_id AND (trips.owner_id = auth.uid() OR EXISTS (SELECT 1 FROM trip_members WHERE trip_members.trip_id = trips.id AND trip_members.user_id = auth.uid()))))
  WITH CHECK (EXISTS (SELECT 1 FROM trips WHERE trips.id = ai_suggestions.trip_id AND (trips.owner_id = auth.uid() OR EXISTS (SELECT 1 FROM trip_members WHERE trip_members.trip_id = trips.id AND trip_members.user_id = auth.uid()))));
CREATE POLICY "Members delete suggestions" ON ai_suggestions FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM trips WHERE trips.id = ai_suggestions.trip_id AND (trips.owner_id = auth.uid() OR EXISTS (SELECT 1 FROM trip_members WHERE trip_members.trip_id = trips.id AND trip_members.user_id = auth.uid()))));

CREATE INDEX IF NOT EXISTS idx_trip_members_trip ON trip_members(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_members_user ON trip_members(user_id);
CREATE INDEX IF NOT EXISTS idx_itinerary_trip ON itinerary_items(trip_id);
CREATE INDEX IF NOT EXISTS idx_bookings_trip ON bookings(trip_id);
CREATE INDEX IF NOT EXISTS idx_expenses_trip ON expenses(trip_id);
CREATE INDEX IF NOT EXISTS idx_splits_expense ON expense_splits(expense_id);
CREATE INDEX IF NOT EXISTS idx_messages_trip ON messages(trip_id);
