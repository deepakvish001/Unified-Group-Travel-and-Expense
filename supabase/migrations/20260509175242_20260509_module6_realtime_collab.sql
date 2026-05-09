/*
  # Module 6: Real-Time Collaboration & Communication System

  1. New / Extended Tables
    - `notifications` already exists — extend with priority, type, category, action_url
    - `user_presence` — per-trip presence tracking (status, current_view, typing)
    - `message_reactions` — emoji reactions on chat messages
    - `message_pins` — pinned messages per trip

  2. Changes to Existing
    - Add columns to `notifications`: priority, category, action_url, related_entity_type, related_entity_id, snoozed_until
    - Add columns to `messages`: reply_to, is_pinned, mentions

  3. Security
    - RLS on all new tables
*/

-- Extend notifications table safely
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='priority') THEN
    ALTER TABLE notifications ADD COLUMN priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('critical','important','normal'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='category') THEN
    ALTER TABLE notifications ADD COLUMN category text NOT NULL DEFAULT 'general' CHECK (category IN ('financial','booking','itinerary','task','poll','general'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='action_url') THEN
    ALTER TABLE notifications ADD COLUMN action_url text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='related_entity_type') THEN
    ALTER TABLE notifications ADD COLUMN related_entity_type text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='related_entity_id') THEN
    ALTER TABLE notifications ADD COLUMN related_entity_id uuid;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='snoozed_until') THEN
    ALTER TABLE notifications ADD COLUMN snoozed_until timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='created_by') THEN
    ALTER TABLE notifications ADD COLUMN created_by uuid REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Extend messages table safely
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='messages' AND column_name='reply_to') THEN
    ALTER TABLE messages ADD COLUMN reply_to uuid REFERENCES messages(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='messages' AND column_name='is_pinned') THEN
    ALTER TABLE messages ADD COLUMN is_pinned boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='messages' AND column_name='mentions') THEN
    ALTER TABLE messages ADD COLUMN mentions uuid[] NOT NULL DEFAULT '{}';
  END IF;
END $$;

-- User presence per trip
CREATE TABLE IF NOT EXISTS user_presence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'online' CHECK (status IN ('online','active','away','dnd','in_activity')),
  current_view text NOT NULL DEFAULT 'trip',
  is_typing boolean NOT NULL DEFAULT false,
  last_seen timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(trip_id, user_id)
);

ALTER TABLE user_presence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trip members can view presence"
  ON user_presence FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM trip_members WHERE trip_members.trip_id = user_presence.trip_id AND trip_members.user_id = auth.uid())
  );

CREATE POLICY "Users can upsert own presence"
  ON user_presence FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own presence"
  ON user_presence FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Message reactions
CREATE TABLE IF NOT EXISTS message_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(message_id, user_id, emoji)
);

ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trip members can view reactions"
  ON message_reactions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM messages m
      JOIN trip_members tm ON tm.trip_id = m.trip_id
      WHERE m.id = message_reactions.message_id AND tm.user_id = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can insert reactions"
  ON message_reactions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own reactions"
  ON message_reactions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Notification settings per user per trip
CREATE TABLE IF NOT EXISTS notification_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  trip_id uuid REFERENCES trips(id) ON DELETE CASCADE,
  category text NOT NULL DEFAULT 'all',
  enabled boolean NOT NULL DEFAULT true,
  delivery_method text NOT NULL DEFAULT 'in_app' CHECK (delivery_method IN ('in_app','email','all')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, trip_id, category)
);

ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own settings"
  ON notification_settings FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own settings"
  ON notification_settings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own settings"
  ON notification_settings FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Helper: notify all trip members (except actor)
CREATE OR REPLACE FUNCTION notify_trip_members(
  p_trip_id uuid,
  p_actor_id uuid,
  p_title text,
  p_body text,
  p_category text DEFAULT 'general',
  p_priority text DEFAULT 'normal',
  p_related_entity_type text DEFAULT NULL,
  p_related_entity_id uuid DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO notifications(user_id, trip_id, type, title, body, category, priority, related_entity_type, related_entity_id, read, created_by)
  SELECT
    tm.user_id,
    p_trip_id,
    p_category,
    p_title,
    p_body,
    p_category,
    p_priority,
    p_related_entity_type,
    p_related_entity_id,
    false,
    p_actor_id
  FROM trip_members tm
  WHERE tm.trip_id = p_trip_id
    AND tm.user_id != p_actor_id;
END;
$$;

GRANT EXECUTE ON FUNCTION notify_trip_members TO authenticated;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_presence_trip ON user_presence(trip_id);
CREATE INDEX IF NOT EXISTS idx_message_reactions_msg ON message_reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_notifications_category ON notifications(user_id, category, read);
