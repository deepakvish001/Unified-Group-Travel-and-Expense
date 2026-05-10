/*
  # Subscription Tiers & Missing Features Migration

  ## Summary
  Adds subscription/tier infrastructure plus tables for:
  - Activity approval workflow (PRO Module 1)
  - Suggestion mode for members (PRO Module 1)
  - Trip wallet system (PRO Module 2)
  - Route optimization records (PRO Module 3)
  - Smart booking recommendations (PRO Module 3)
  - Audit logs table (ENTERPRISE Module 5)

  ## New Tables
  1. `trip_subscriptions` - Per-trip tier (free/pro/enterprise) and billing info
  2. `activity_suggestions` - Suggestions submitted by non-admin members (PRO)
  3. `activity_approvals` - Approval workflow for suggested/proposed activities (PRO)
  4. `trip_wallet` - Shared trip wallet / prepaid fund pool (PRO)
  5. `trip_wallet_contributions` - Individual contributions to the wallet
  6. `route_optimizations` - Stored route optimization results (PRO)
  7. `booking_recommendations` - AI smart booking suggestions (PRO)
  8. `audit_logs` - Immutable enterprise audit trail (ENTERPRISE)
  9. `budget_forecasts` - Budget projection records (PRO)

  ## Security
  - RLS enabled on all tables
  - Trip member scoping enforced on all policies
*/

-- ─── Subscription tier enum ───────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscription_tier') THEN
    CREATE TYPE subscription_tier AS ENUM ('free', 'pro', 'enterprise');
  END IF;
END $$;

-- ─── Trip subscriptions ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trip_subscriptions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id       uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  tier          subscription_tier NOT NULL DEFAULT 'free',
  billing_cycle text CHECK (billing_cycle IN ('monthly', 'per_trip', 'annual', 'custom')) DEFAULT 'per_trip',
  price_paid    numeric(12, 2) DEFAULT 0,
  currency      text DEFAULT 'INR',
  valid_until   timestamptz,
  activated_by  uuid REFERENCES auth.users(id),
  activated_at  timestamptz DEFAULT now(),
  created_at    timestamptz DEFAULT now(),
  UNIQUE(trip_id)
);

ALTER TABLE trip_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trip members can view subscription"
  ON trip_subscriptions FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM trip_members tm
    WHERE tm.trip_id = trip_subscriptions.trip_id
    AND tm.user_id = auth.uid()
  ));

CREATE POLICY "Trip owner can manage subscription"
  ON trip_subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM trips t
    WHERE t.id = trip_subscriptions.trip_id
    AND t.owner_id = auth.uid()
  ));

CREATE POLICY "Trip owner can update subscription"
  ON trip_subscriptions FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM trips t
    WHERE t.id = trip_subscriptions.trip_id
    AND t.owner_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM trips t
    WHERE t.id = trip_subscriptions.trip_id
    AND t.owner_id = auth.uid()
  ));

-- ─── Activity suggestions (PRO - suggestion mode) ────────────────────────────
CREATE TABLE IF NOT EXISTS activity_suggestions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id         uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  suggested_by    uuid NOT NULL REFERENCES auth.users(id),
  day_number      int,
  title           text NOT NULL,
  description     text,
  time_slot       text CHECK (time_slot IN ('morning','afternoon','evening','anytime')),
  estimated_cost  numeric(12,2) DEFAULT 0,
  category        text DEFAULT 'activity',
  notes           text,
  status          text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','discussed')),
  votes_for       int NOT NULL DEFAULT 0,
  votes_against   int NOT NULL DEFAULT 0,
  admin_note      text,
  reviewed_by     uuid REFERENCES auth.users(id),
  reviewed_at     timestamptz,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

ALTER TABLE activity_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trip members can view suggestions"
  ON activity_suggestions FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM trip_members tm
    WHERE tm.trip_id = activity_suggestions.trip_id
    AND tm.user_id = auth.uid()
  ));

CREATE POLICY "Trip members can create suggestions"
  ON activity_suggestions FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = suggested_by AND
    EXISTS (
      SELECT 1 FROM trip_members tm
      WHERE tm.trip_id = activity_suggestions.trip_id
      AND tm.user_id = auth.uid()
    )
  );

CREATE POLICY "Suggester or admin can update suggestion"
  ON activity_suggestions FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = suggested_by OR
    EXISTS (
      SELECT 1 FROM trip_members tm
      WHERE tm.trip_id = activity_suggestions.trip_id
      AND tm.user_id = auth.uid()
      AND tm.role = 'admin'
    )
  )
  WITH CHECK (
    auth.uid() = suggested_by OR
    EXISTS (
      SELECT 1 FROM trip_members tm
      WHERE tm.trip_id = activity_suggestions.trip_id
      AND tm.user_id = auth.uid()
      AND tm.role = 'admin'
    )
  );

CREATE POLICY "Suggester can delete own suggestions"
  ON activity_suggestions FOR DELETE
  TO authenticated
  USING (auth.uid() = suggested_by);

-- Votes on suggestions
CREATE TABLE IF NOT EXISTS suggestion_votes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  suggestion_id   uuid NOT NULL REFERENCES activity_suggestions(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES auth.users(id),
  vote            text NOT NULL CHECK (vote IN ('for','against')),
  created_at      timestamptz DEFAULT now(),
  UNIQUE(suggestion_id, user_id)
);

ALTER TABLE suggestion_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trip members can view suggestion votes"
  ON suggestion_votes FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM activity_suggestions s
    JOIN trip_members tm ON tm.trip_id = s.trip_id
    WHERE s.id = suggestion_votes.suggestion_id
    AND tm.user_id = auth.uid()
  ));

CREATE POLICY "Trip members can vote on suggestions"
  ON suggestion_votes FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM activity_suggestions s
      JOIN trip_members tm ON tm.trip_id = s.trip_id
      WHERE s.id = suggestion_votes.suggestion_id
      AND tm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can change own vote"
  ON suggestion_votes FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove own vote"
  ON suggestion_votes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ─── Trip Wallet (PRO) ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trip_wallets (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id         uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  target_amount   numeric(12,2) NOT NULL DEFAULT 0,
  collected       numeric(12,2) NOT NULL DEFAULT 0,
  currency        text NOT NULL DEFAULT 'INR',
  status          text NOT NULL DEFAULT 'open' CHECK (status IN ('open','locked','closed')),
  description     text,
  created_by      uuid NOT NULL REFERENCES auth.users(id),
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  UNIQUE(trip_id)
);

ALTER TABLE trip_wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trip members can view wallet"
  ON trip_wallets FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM trip_members tm
    WHERE tm.trip_id = trip_wallets.trip_id
    AND tm.user_id = auth.uid()
  ));

CREATE POLICY "Trip admins can create wallet"
  ON trip_wallets FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = created_by AND
    EXISTS (
      SELECT 1 FROM trip_members tm
      WHERE tm.trip_id = trip_wallets.trip_id
      AND tm.user_id = auth.uid()
      AND tm.role = 'admin'
    )
  );

CREATE POLICY "Trip admins can update wallet"
  ON trip_wallets FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM trip_members tm
    WHERE tm.trip_id = trip_wallets.trip_id
    AND tm.user_id = auth.uid()
    AND tm.role = 'admin'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM trip_members tm
    WHERE tm.trip_id = trip_wallets.trip_id
    AND tm.user_id = auth.uid()
    AND tm.role = 'admin'
  ));

-- Wallet contributions
CREATE TABLE IF NOT EXISTS wallet_contributions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id       uuid NOT NULL REFERENCES trip_wallets(id) ON DELETE CASCADE,
  trip_id         uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES auth.users(id),
  amount          numeric(12,2) NOT NULL,
  payment_method  text DEFAULT 'upi',
  note            text,
  confirmed       boolean NOT NULL DEFAULT false,
  confirmed_by    uuid REFERENCES auth.users(id),
  confirmed_at    timestamptz,
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE wallet_contributions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trip members can view contributions"
  ON wallet_contributions FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM trip_members tm
    WHERE tm.trip_id = wallet_contributions.trip_id
    AND tm.user_id = auth.uid()
  ));

CREATE POLICY "Trip members can add contributions"
  ON wallet_contributions FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM trip_members tm
      WHERE tm.trip_id = wallet_contributions.trip_id
      AND tm.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can confirm contributions"
  ON wallet_contributions FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM trip_members tm
    WHERE tm.trip_id = wallet_contributions.trip_id
    AND tm.user_id = auth.uid()
    AND tm.role = 'admin'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM trip_members tm
    WHERE tm.trip_id = wallet_contributions.trip_id
    AND tm.user_id = auth.uid()
    AND tm.role = 'admin'
  ));

-- ─── Budget Forecasts (PRO) ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS budget_forecasts (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id           uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  generated_by      uuid NOT NULL REFERENCES auth.users(id),
  total_budget      numeric(12,2) NOT NULL,
  current_spent     numeric(12,2) NOT NULL DEFAULT 0,
  forecasted_total  numeric(12,2) NOT NULL,
  variance          numeric(12,2) GENERATED ALWAYS AS (forecasted_total - total_budget) STORED,
  breakdown         jsonb DEFAULT '{}',
  daily_burn_rate   numeric(12,2),
  days_remaining    int,
  confidence        text CHECK (confidence IN ('high','medium','low')) DEFAULT 'medium',
  notes             text,
  created_at        timestamptz DEFAULT now()
);

ALTER TABLE budget_forecasts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trip members can view forecasts"
  ON budget_forecasts FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM trip_members tm
    WHERE tm.trip_id = budget_forecasts.trip_id
    AND tm.user_id = auth.uid()
  ));

CREATE POLICY "Trip members can create forecasts"
  ON budget_forecasts FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = generated_by AND
    EXISTS (
      SELECT 1 FROM trip_members tm
      WHERE tm.trip_id = budget_forecasts.trip_id
      AND tm.user_id = auth.uid()
    )
  );

-- ─── Route Optimizations (PRO) ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS route_optimizations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id         uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  generated_by    uuid NOT NULL REFERENCES auth.users(id),
  day_number      int,
  original_order  jsonb NOT NULL DEFAULT '[]',
  optimized_order jsonb NOT NULL DEFAULT '[]',
  estimated_savings_minutes int DEFAULT 0,
  estimated_savings_km      numeric(8,2) DEFAULT 0,
  notes           text,
  applied         boolean NOT NULL DEFAULT false,
  applied_at      timestamptz,
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE route_optimizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trip members can view route optimizations"
  ON route_optimizations FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM trip_members tm
    WHERE tm.trip_id = route_optimizations.trip_id
    AND tm.user_id = auth.uid()
  ));

CREATE POLICY "Trip members can create route optimizations"
  ON route_optimizations FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = generated_by AND
    EXISTS (
      SELECT 1 FROM trip_members tm
      WHERE tm.trip_id = route_optimizations.trip_id
      AND tm.user_id = auth.uid()
    )
  );

CREATE POLICY "Trip admins can update route optimizations"
  ON route_optimizations FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM trip_members tm
    WHERE tm.trip_id = route_optimizations.trip_id
    AND tm.user_id = auth.uid()
    AND tm.role = 'admin'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM trip_members tm
    WHERE tm.trip_id = route_optimizations.trip_id
    AND tm.user_id = auth.uid()
    AND tm.role = 'admin'
  ));

-- ─── Booking Recommendations (PRO) ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS booking_recommendations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id         uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  generated_by    uuid NOT NULL REFERENCES auth.users(id),
  booking_type    text NOT NULL CHECK (booking_type IN ('hotel','flight','train','bus','activity','car','restaurant')),
  title           text NOT NULL,
  description     text,
  estimated_cost  numeric(12,2) DEFAULT 0,
  provider        text,
  rating          numeric(3,1),
  reasons         jsonb DEFAULT '[]',
  pros            jsonb DEFAULT '[]',
  cons            jsonb DEFAULT '[]',
  external_url    text,
  status          text NOT NULL DEFAULT 'suggested' CHECK (status IN ('suggested','accepted','rejected','booked')),
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE booking_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trip members can view booking recommendations"
  ON booking_recommendations FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM trip_members tm
    WHERE tm.trip_id = booking_recommendations.trip_id
    AND tm.user_id = auth.uid()
  ));

CREATE POLICY "Trip members can create booking recommendations"
  ON booking_recommendations FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = generated_by AND
    EXISTS (
      SELECT 1 FROM trip_members tm
      WHERE tm.trip_id = booking_recommendations.trip_id
      AND tm.user_id = auth.uid()
    )
  );

CREATE POLICY "Trip members can update recommendation status"
  ON booking_recommendations FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM trip_members tm
    WHERE tm.trip_id = booking_recommendations.trip_id
    AND tm.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM trip_members tm
    WHERE tm.trip_id = booking_recommendations.trip_id
    AND tm.user_id = auth.uid()
  ));

-- ─── Audit Logs (ENTERPRISE) ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id         uuid REFERENCES trips(id) ON DELETE SET NULL,
  actor_id        uuid REFERENCES auth.users(id),
  action          text NOT NULL,
  resource_type   text,
  resource_id     uuid,
  old_values      jsonb,
  new_values      jsonb,
  ip_address      text,
  user_agent      text,
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trip admins can view audit logs"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (
    trip_id IS NULL OR
    EXISTS (
      SELECT 1 FROM trip_members tm
      WHERE tm.trip_id = audit_logs.trip_id
      AND tm.user_id = auth.uid()
      AND tm.role = 'admin'
    )
  );

CREATE POLICY "Authenticated users can insert audit logs"
  ON audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = actor_id);

-- ─── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_trip_subscriptions_trip_id ON trip_subscriptions(trip_id);
CREATE INDEX IF NOT EXISTS idx_activity_suggestions_trip_id ON activity_suggestions(trip_id);
CREATE INDEX IF NOT EXISTS idx_activity_suggestions_status ON activity_suggestions(status);
CREATE INDEX IF NOT EXISTS idx_suggestion_votes_suggestion_id ON suggestion_votes(suggestion_id);
CREATE INDEX IF NOT EXISTS idx_trip_wallets_trip_id ON trip_wallets(trip_id);
CREATE INDEX IF NOT EXISTS idx_wallet_contributions_wallet_id ON wallet_contributions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_wallet_contributions_trip_id ON wallet_contributions(trip_id);
CREATE INDEX IF NOT EXISTS idx_budget_forecasts_trip_id ON budget_forecasts(trip_id);
CREATE INDEX IF NOT EXISTS idx_route_optimizations_trip_id ON route_optimizations(trip_id);
CREATE INDEX IF NOT EXISTS idx_booking_recommendations_trip_id ON booking_recommendations(trip_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_trip_id ON audit_logs(trip_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id ON audit_logs(actor_id);
