/*
  # MODULE 3: Collaborative Expense & Settlement Management

  ## Summary
  Extends existing expenses and settlements for comprehensive financial coordination.

  ## Changes
  1. expenses: add receipt_urls (jsonb), created_by, last_edited_by
  2. settlements: add trip_id, payment_method, marked_paid_by, confirmed_by, notes
  3. New table: trip_alerts (smart alerts for budget/duplicates/etc.)
  4. RLS on new columns/tables.
*/

-- 1. Extend expenses
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'expenses' AND column_name = 'receipt_urls') THEN
    ALTER TABLE expenses ADD COLUMN receipt_urls jsonb DEFAULT '[]'::jsonb;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'expenses' AND column_name = 'created_by') THEN
    ALTER TABLE expenses ADD COLUMN created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'expenses' AND column_name = 'last_edited_by') THEN
    ALTER TABLE expenses ADD COLUMN last_edited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 2. Extend settlements
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'settlements' AND column_name = 'trip_id') THEN
    ALTER TABLE settlements ADD COLUMN trip_id uuid REFERENCES trips(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'settlements' AND column_name = 'payment_method') THEN
    ALTER TABLE settlements ADD COLUMN payment_method text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'settlements' AND column_name = 'marked_paid_by') THEN
    ALTER TABLE settlements ADD COLUMN marked_paid_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'settlements' AND column_name = 'confirmed_by') THEN
    ALTER TABLE settlements ADD COLUMN confirmed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'settlements' AND column_name = 'notes') THEN
    ALTER TABLE settlements ADD COLUMN notes text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'settlements' AND column_name = 'marked_paid_at') THEN
    ALTER TABLE settlements ADD COLUMN marked_paid_at timestamptz;
  END IF;
END $$;

-- Ensure we can insert trip-only settlements (group_id may be null). Drop NOT NULL if present.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'settlements' AND column_name = 'group_id' AND is_nullable = 'NO') THEN
    ALTER TABLE settlements ALTER COLUMN group_id DROP NOT NULL;
  END IF;
END $$;

-- 3. Expense policies: ensure trip members can access trip-scoped expenses
DROP POLICY IF EXISTS "Trip members view trip expenses" ON expenses;
CREATE POLICY "Trip members view trip expenses" ON expenses FOR SELECT TO authenticated
USING (
  (trip_id IS NOT NULL AND is_trip_member(trip_id, auth.uid()))
  OR (expense_type = 'personal' AND created_by = auth.uid())
);

DROP POLICY IF EXISTS "Trip members create expenses" ON expenses;
CREATE POLICY "Trip members create expenses" ON expenses FOR INSERT TO authenticated
WITH CHECK (
  trip_id IS NULL OR is_trip_member(trip_id, auth.uid())
);

DROP POLICY IF EXISTS "Creator updates expense" ON expenses;
CREATE POLICY "Creator updates expense" ON expenses FOR UPDATE TO authenticated
USING (
  created_by = auth.uid() OR paid_by = auth.uid()
  OR (trip_id IS NOT NULL AND is_trip_owner(trip_id, auth.uid()))
)
WITH CHECK (
  created_by = auth.uid() OR paid_by = auth.uid()
  OR (trip_id IS NOT NULL AND is_trip_owner(trip_id, auth.uid()))
);

DROP POLICY IF EXISTS "Creator deletes expense" ON expenses;
CREATE POLICY "Creator deletes expense" ON expenses FOR DELETE TO authenticated
USING (
  created_by = auth.uid() OR paid_by = auth.uid()
  OR (trip_id IS NOT NULL AND is_trip_owner(trip_id, auth.uid()))
);

-- expense_splits policies: trip members access
DROP POLICY IF EXISTS "Trip members view splits" ON expense_splits;
CREATE POLICY "Trip members view splits" ON expense_splits FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM expenses e WHERE e.id = expense_id AND (
  (e.trip_id IS NOT NULL AND is_trip_member(e.trip_id, auth.uid()))
  OR (e.expense_type = 'personal' AND e.created_by = auth.uid())
)));

DROP POLICY IF EXISTS "Trip members insert splits" ON expense_splits;
CREATE POLICY "Trip members insert splits" ON expense_splits FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM expenses e WHERE e.id = expense_id AND (
  e.trip_id IS NULL OR is_trip_member(e.trip_id, auth.uid())
)));

DROP POLICY IF EXISTS "Trip members update splits" ON expense_splits;
CREATE POLICY "Trip members update splits" ON expense_splits FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM expenses e WHERE e.id = expense_id AND (
  e.trip_id IS NULL OR is_trip_member(e.trip_id, auth.uid())
)))
WITH CHECK (EXISTS (SELECT 1 FROM expenses e WHERE e.id = expense_id AND (
  e.trip_id IS NULL OR is_trip_member(e.trip_id, auth.uid())
)));

DROP POLICY IF EXISTS "Trip members delete splits" ON expense_splits;
CREATE POLICY "Trip members delete splits" ON expense_splits FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM expenses e WHERE e.id = expense_id AND (
  e.trip_id IS NULL OR is_trip_member(e.trip_id, auth.uid())
)));

-- 4. Settlements policies for trip-scoped
DROP POLICY IF EXISTS "Trip members view settlements" ON settlements;
CREATE POLICY "Trip members view settlements" ON settlements FOR SELECT TO authenticated
USING (trip_id IS NOT NULL AND is_trip_member(trip_id, auth.uid()));

DROP POLICY IF EXISTS "Trip members create settlements" ON settlements;
CREATE POLICY "Trip members create settlements" ON settlements FOR INSERT TO authenticated
WITH CHECK (trip_id IS NOT NULL AND is_trip_member(trip_id, auth.uid()));

DROP POLICY IF EXISTS "Participants update settlements" ON settlements;
CREATE POLICY "Participants update settlements" ON settlements FOR UPDATE TO authenticated
USING (from_user = auth.uid() OR to_user = auth.uid())
WITH CHECK (from_user = auth.uid() OR to_user = auth.uid());

DROP POLICY IF EXISTS "Participants delete settlements" ON settlements;
CREATE POLICY "Participants delete settlements" ON settlements FOR DELETE TO authenticated
USING (from_user = auth.uid() OR to_user = auth.uid());

-- 5. Trip alerts
CREATE TABLE IF NOT EXISTS trip_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  alert_type text NOT NULL DEFAULT '',
  severity text DEFAULT 'medium',
  message text NOT NULL DEFAULT '',
  related_entity_type text,
  related_entity_id uuid,
  acknowledged boolean DEFAULT false,
  acknowledged_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE trip_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Trip members view alerts" ON trip_alerts;
CREATE POLICY "Trip members view alerts" ON trip_alerts FOR SELECT TO authenticated
USING (is_trip_member(trip_id, auth.uid()));

DROP POLICY IF EXISTS "Trip members create alerts" ON trip_alerts;
CREATE POLICY "Trip members create alerts" ON trip_alerts FOR INSERT TO authenticated
WITH CHECK (is_trip_member(trip_id, auth.uid()));

DROP POLICY IF EXISTS "Trip members update alerts" ON trip_alerts;
CREATE POLICY "Trip members update alerts" ON trip_alerts FOR UPDATE TO authenticated
USING (is_trip_member(trip_id, auth.uid()))
WITH CHECK (is_trip_member(trip_id, auth.uid()));

DROP POLICY IF EXISTS "Trip members delete alerts" ON trip_alerts;
CREATE POLICY "Trip members delete alerts" ON trip_alerts FOR DELETE TO authenticated
USING (is_trip_member(trip_id, auth.uid()));

-- 6. Dispute policies for trip context (expense_disputes already has RLS; ensure select/insert)
DROP POLICY IF EXISTS "Trip members view disputes" ON expense_disputes;
CREATE POLICY "Trip members view disputes" ON expense_disputes FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM expenses e WHERE e.id = expense_id AND e.trip_id IS NOT NULL AND is_trip_member(e.trip_id, auth.uid())));

DROP POLICY IF EXISTS "Trip members create disputes" ON expense_disputes;
CREATE POLICY "Trip members create disputes" ON expense_disputes FOR INSERT TO authenticated
WITH CHECK (raised_by = auth.uid() AND EXISTS (SELECT 1 FROM expenses e WHERE e.id = expense_id AND e.trip_id IS NOT NULL AND is_trip_member(e.trip_id, auth.uid())));

DROP POLICY IF EXISTS "Raiser or owner resolves dispute" ON expense_disputes;
CREATE POLICY "Raiser or owner resolves dispute" ON expense_disputes FOR UPDATE TO authenticated
USING (raised_by = auth.uid() OR EXISTS (SELECT 1 FROM expenses e WHERE e.id = expense_id AND (e.created_by = auth.uid() OR (e.trip_id IS NOT NULL AND is_trip_owner(e.trip_id, auth.uid())))))
WITH CHECK (raised_by = auth.uid() OR EXISTS (SELECT 1 FROM expenses e WHERE e.id = expense_id AND (e.created_by = auth.uid() OR (e.trip_id IS NOT NULL AND is_trip_owner(e.trip_id, auth.uid())))));

CREATE INDEX IF NOT EXISTS idx_settlements_trip ON settlements(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_alerts_trip ON trip_alerts(trip_id);
CREATE INDEX IF NOT EXISTS idx_expenses_trip_status ON expenses(trip_id, status);
CREATE INDEX IF NOT EXISTS idx_expense_disputes_expense ON expense_disputes(expense_id);
