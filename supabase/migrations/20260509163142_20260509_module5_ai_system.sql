/*
  # Module 5: AI Recommendation & Assistance System

  1. New Tables
    - `ai_recommendations` - Stores all AI-generated content (itineraries, budget, activities, etc.)
    - `ai_activity_log` - Transparent log of all AI actions per trip
    - `budget_optimizations` - Individual cost-saving suggestions
    - `travel_insights` - Contextual tips: weather, cultural, seasonal, etc.
    - `smart_reminders` - Scheduled reminders for bookings, tasks, settlements

  2. Changes to Existing
    - Extend `ai_suggestions` type enum if needed (already exists)

  3. Security
    - RLS enabled on all tables
    - Trip members can read/write their trip's AI data
    - Only owners/admins can dismiss suggestions
*/

-- AI Recommendations (core AI output storage)
CREATE TABLE IF NOT EXISTS ai_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  recommendation_type text NOT NULL CHECK (recommendation_type IN (
    'itinerary','budget_optimization','activity_suggestion',
    'hotel_suggestion','transport_suggestion','itinerary_analysis',
    'decision_analysis','travel_insight'
  )),
  input_context jsonb NOT NULL DEFAULT '{}'::jsonb,
  generated_content jsonb NOT NULL DEFAULT '{}'::jsonb,
  ai_model text NOT NULL DEFAULT 'groq',
  status text NOT NULL DEFAULT 'generated' CHECK (status IN ('generated','accepted','dismissed','partially_applied')),
  feedback_rating int CHECK (feedback_rating BETWEEN 1 AND 5),
  feedback_comment text,
  applied_changes jsonb NOT NULL DEFAULT '[]'::jsonb,
  generation_count int NOT NULL DEFAULT 1,
  expires_at timestamptz DEFAULT (now() + interval '90 days'),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE ai_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trip members can view recommendations"
  ON ai_recommendations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM trip_members
      WHERE trip_members.trip_id = ai_recommendations.trip_id
        AND trip_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Trip members can insert recommendations"
  ON ai_recommendations FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = requested_by AND
    EXISTS (
      SELECT 1 FROM trip_members
      WHERE trip_members.trip_id = ai_recommendations.trip_id
        AND trip_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Requester can update their recommendation"
  ON ai_recommendations FOR UPDATE
  TO authenticated
  USING (auth.uid() = requested_by)
  WITH CHECK (auth.uid() = requested_by);

-- AI Activity Log (transparency trail)
CREATE TABLE IF NOT EXISTS ai_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  recommendation_id uuid REFERENCES ai_recommendations(id) ON DELETE SET NULL,
  action text NOT NULL,
  summary text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  performed_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE ai_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trip members can view AI log"
  ON ai_activity_log FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM trip_members
      WHERE trip_members.trip_id = ai_activity_log.trip_id
        AND trip_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Trip members can insert AI log"
  ON ai_activity_log FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM trip_members
      WHERE trip_members.trip_id = ai_activity_log.trip_id
        AND trip_members.user_id = auth.uid()
    )
  );

-- Budget Optimizations
CREATE TABLE IF NOT EXISTS budget_optimizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  recommendation_id uuid REFERENCES ai_recommendations(id) ON DELETE SET NULL,
  optimization_type text NOT NULL CHECK (optimization_type IN ('accommodation','transport','food','activity','shopping','other')),
  category text NOT NULL DEFAULT '',
  current_option_name text NOT NULL DEFAULT '',
  current_option_cost numeric NOT NULL DEFAULT 0,
  suggested_option_name text NOT NULL DEFAULT '',
  suggested_option_cost numeric NOT NULL DEFAULT 0,
  savings numeric NOT NULL DEFAULT 0,
  reason text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'suggested' CHECK (status IN ('suggested','applied','dismissed')),
  applied_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE budget_optimizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trip members can view optimizations"
  ON budget_optimizations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM trip_members
      WHERE trip_members.trip_id = budget_optimizations.trip_id
        AND trip_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Trip members can insert optimizations"
  ON budget_optimizations FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM trip_members
      WHERE trip_members.trip_id = budget_optimizations.trip_id
        AND trip_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Trip members can update optimizations"
  ON budget_optimizations FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM trip_members
      WHERE trip_members.trip_id = budget_optimizations.trip_id
        AND trip_members.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM trip_members
      WHERE trip_members.trip_id = budget_optimizations.trip_id
        AND trip_members.user_id = auth.uid()
    )
  );

-- Travel Insights
CREATE TABLE IF NOT EXISTS travel_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  insight_type text NOT NULL CHECK (insight_type IN (
    'weather','local_events','cost_saving','safety','cultural','timing','budget_trend','group_tips','seasonal'
  )),
  title text NOT NULL,
  content text NOT NULL,
  relevance text NOT NULL DEFAULT 'medium' CHECK (relevance IN ('high','medium','low')),
  actionable boolean NOT NULL DEFAULT false,
  action_label text,
  expires_at timestamptz DEFAULT (now() + interval '7 days'),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE travel_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trip members can view insights"
  ON travel_insights FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM trip_members
      WHERE trip_members.trip_id = travel_insights.trip_id
        AND trip_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Trip members can insert insights"
  ON travel_insights FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM trip_members
      WHERE trip_members.trip_id = travel_insights.trip_id
        AND trip_members.user_id = auth.uid()
    )
  );

-- Smart Reminders
CREATE TABLE IF NOT EXISTS smart_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reminder_type text NOT NULL CHECK (reminder_type IN (
    'booking_deadline','departure','expense_settlement','task_due','pre_activity','document','pre_trip_checklist'
  )),
  title text NOT NULL,
  body text NOT NULL,
  related_entity_type text,
  related_entity_id uuid,
  scheduled_for timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','acknowledged','snoozed','done')),
  snoozed_until timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE smart_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own reminders"
  ON smart_reminders FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own reminders"
  ON smart_reminders FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own reminders"
  ON smart_reminders FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ai_recommendations_trip ON ai_recommendations(trip_id);
CREATE INDEX IF NOT EXISTS idx_ai_activity_log_trip ON ai_activity_log(trip_id);
CREATE INDEX IF NOT EXISTS idx_budget_optimizations_trip ON budget_optimizations(trip_id);
CREATE INDEX IF NOT EXISTS idx_travel_insights_trip ON travel_insights(trip_id);
CREATE INDEX IF NOT EXISTS idx_smart_reminders_user ON smart_reminders(user_id);
