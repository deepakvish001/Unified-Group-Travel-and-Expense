/*
  # Fix recursive RLS policies
  Replace cross-referencing policies with SECURITY DEFINER helper functions
  to eliminate infinite recursion between trips and trip_members.
*/

CREATE OR REPLACE FUNCTION is_trip_member(p_trip_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM trips WHERE id = p_trip_id AND owner_id = p_user_id
  ) OR EXISTS (
    SELECT 1 FROM trip_members WHERE trip_id = p_trip_id AND user_id = p_user_id
  );
$$;

CREATE OR REPLACE FUNCTION is_trip_owner(p_trip_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM trips WHERE id = p_trip_id AND owner_id = p_user_id);
$$;

DROP POLICY IF EXISTS "Members view trips" ON trips;
DROP POLICY IF EXISTS "Members view membership" ON trip_members;
DROP POLICY IF EXISTS "Owners add members" ON trip_members;
DROP POLICY IF EXISTS "Owners update members" ON trip_members;
DROP POLICY IF EXISTS "Owners remove members" ON trip_members;

DROP POLICY IF EXISTS "Members view itinerary" ON itinerary_items;
DROP POLICY IF EXISTS "Members add itinerary" ON itinerary_items;
DROP POLICY IF EXISTS "Members update itinerary" ON itinerary_items;
DROP POLICY IF EXISTS "Members delete itinerary" ON itinerary_items;

DROP POLICY IF EXISTS "Members view bookings" ON bookings;
DROP POLICY IF EXISTS "Members add bookings" ON bookings;
DROP POLICY IF EXISTS "Members update bookings" ON bookings;
DROP POLICY IF EXISTS "Members delete bookings" ON bookings;

DROP POLICY IF EXISTS "Members view expenses" ON expenses;
DROP POLICY IF EXISTS "Members add expenses" ON expenses;
DROP POLICY IF EXISTS "Members update expenses" ON expenses;
DROP POLICY IF EXISTS "Members delete expenses" ON expenses;

DROP POLICY IF EXISTS "Members view splits" ON expense_splits;
DROP POLICY IF EXISTS "Members add splits" ON expense_splits;
DROP POLICY IF EXISTS "Members update splits" ON expense_splits;
DROP POLICY IF EXISTS "Members delete splits" ON expense_splits;

DROP POLICY IF EXISTS "Members view messages" ON messages;
DROP POLICY IF EXISTS "Members post messages" ON messages;

DROP POLICY IF EXISTS "Members view suggestions" ON ai_suggestions;
DROP POLICY IF EXISTS "Members add suggestions" ON ai_suggestions;
DROP POLICY IF EXISTS "Members update suggestions" ON ai_suggestions;
DROP POLICY IF EXISTS "Members delete suggestions" ON ai_suggestions;

CREATE POLICY "Members view trips" ON trips FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR is_trip_member(id, auth.uid()));

CREATE POLICY "Members view membership" ON trip_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR is_trip_owner(trip_id, auth.uid()));
CREATE POLICY "Owners add members" ON trip_members FOR INSERT TO authenticated
  WITH CHECK (is_trip_owner(trip_id, auth.uid()) OR user_id = auth.uid());
CREATE POLICY "Owners update members" ON trip_members FOR UPDATE TO authenticated
  USING (is_trip_owner(trip_id, auth.uid()))
  WITH CHECK (is_trip_owner(trip_id, auth.uid()));
CREATE POLICY "Owners remove members" ON trip_members FOR DELETE TO authenticated
  USING (is_trip_owner(trip_id, auth.uid()) OR user_id = auth.uid());

CREATE POLICY "Members view itinerary" ON itinerary_items FOR SELECT TO authenticated
  USING (is_trip_member(trip_id, auth.uid()));
CREATE POLICY "Members add itinerary" ON itinerary_items FOR INSERT TO authenticated
  WITH CHECK (is_trip_member(trip_id, auth.uid()));
CREATE POLICY "Members update itinerary" ON itinerary_items FOR UPDATE TO authenticated
  USING (is_trip_member(trip_id, auth.uid())) WITH CHECK (is_trip_member(trip_id, auth.uid()));
CREATE POLICY "Members delete itinerary" ON itinerary_items FOR DELETE TO authenticated
  USING (is_trip_member(trip_id, auth.uid()));

CREATE POLICY "Members view bookings" ON bookings FOR SELECT TO authenticated
  USING (is_trip_member(trip_id, auth.uid()));
CREATE POLICY "Members add bookings" ON bookings FOR INSERT TO authenticated
  WITH CHECK (is_trip_member(trip_id, auth.uid()));
CREATE POLICY "Members update bookings" ON bookings FOR UPDATE TO authenticated
  USING (is_trip_member(trip_id, auth.uid())) WITH CHECK (is_trip_member(trip_id, auth.uid()));
CREATE POLICY "Members delete bookings" ON bookings FOR DELETE TO authenticated
  USING (is_trip_member(trip_id, auth.uid()));

CREATE POLICY "Members view expenses" ON expenses FOR SELECT TO authenticated
  USING (is_trip_member(trip_id, auth.uid()));
CREATE POLICY "Members add expenses" ON expenses FOR INSERT TO authenticated
  WITH CHECK (is_trip_member(trip_id, auth.uid()));
CREATE POLICY "Members update expenses" ON expenses FOR UPDATE TO authenticated
  USING (is_trip_member(trip_id, auth.uid())) WITH CHECK (is_trip_member(trip_id, auth.uid()));
CREATE POLICY "Members delete expenses" ON expenses FOR DELETE TO authenticated
  USING (is_trip_member(trip_id, auth.uid()));

CREATE POLICY "Members view splits" ON expense_splits FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM expenses WHERE expenses.id = expense_splits.expense_id AND is_trip_member(expenses.trip_id, auth.uid())));
CREATE POLICY "Members add splits" ON expense_splits FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM expenses WHERE expenses.id = expense_splits.expense_id AND is_trip_member(expenses.trip_id, auth.uid())));
CREATE POLICY "Members update splits" ON expense_splits FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM expenses WHERE expenses.id = expense_splits.expense_id AND is_trip_member(expenses.trip_id, auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM expenses WHERE expenses.id = expense_splits.expense_id AND is_trip_member(expenses.trip_id, auth.uid())));
CREATE POLICY "Members delete splits" ON expense_splits FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM expenses WHERE expenses.id = expense_splits.expense_id AND is_trip_member(expenses.trip_id, auth.uid())));

CREATE POLICY "Members view messages" ON messages FOR SELECT TO authenticated
  USING (is_trip_member(trip_id, auth.uid()));
CREATE POLICY "Members post messages" ON messages FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND is_trip_member(trip_id, auth.uid()));

CREATE POLICY "Members view suggestions" ON ai_suggestions FOR SELECT TO authenticated
  USING (is_trip_member(trip_id, auth.uid()));
CREATE POLICY "Members add suggestions" ON ai_suggestions FOR INSERT TO authenticated
  WITH CHECK (is_trip_member(trip_id, auth.uid()));
CREATE POLICY "Members update suggestions" ON ai_suggestions FOR UPDATE TO authenticated
  USING (is_trip_member(trip_id, auth.uid())) WITH CHECK (is_trip_member(trip_id, auth.uid()));
CREATE POLICY "Members delete suggestions" ON ai_suggestions FOR DELETE TO authenticated
  USING (is_trip_member(trip_id, auth.uid()));
