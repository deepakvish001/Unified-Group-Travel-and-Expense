/*
  # MODULE 1: Base tables for group travel coordination
*/

-- Extended user profiles
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text DEFAULT '',
  email text DEFAULT '',
  phone_number text DEFAULT '',
  date_of_birth date,
  gender text DEFAULT '',
  profile_picture_url text DEFAULT '',
  emergency_contact_name text DEFAULT '',
  emergency_contact_number text DEFAULT '',
  preferred_seat_type text DEFAULT '',
  food_preference text DEFAULT '',
  travel_style_preferences text DEFAULT '',
  id_verification_status text DEFAULT 'unverified',
  masked_id text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own profile" ON user_profiles;
CREATE POLICY "Users view own profile" ON user_profiles FOR SELECT TO authenticated USING (id = auth.uid());
DROP POLICY IF EXISTS "Users update own profile" ON user_profiles;
CREATE POLICY "Users update own profile" ON user_profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
DROP POLICY IF EXISTS "Users insert own profile" ON user_profiles;
CREATE POLICY "Users insert own profile" ON user_profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
DROP POLICY IF EXISTS "All users can view profiles" ON user_profiles;
CREATE POLICY "All users can view profiles" ON user_profiles FOR SELECT TO authenticated USING (true);

-- Groups table
CREATE TABLE IF NOT EXISTS groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT '',
  description text DEFAULT '',
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  total_estimated_cost numeric DEFAULT 0,
  expected_members int DEFAULT 0,
  cost_per_person numeric GENERATED ALWAYS AS (CASE WHEN expected_members > 0 THEN total_estimated_cost / expected_members ELSE 0 END) STORED,
  currency text DEFAULT 'INR',
  status text DEFAULT 'planning',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE groups ENABLE ROW LEVEL SECURITY;

-- Group memberships
CREATE TABLE IF NOT EXISTS group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text DEFAULT 'member',
  responsibility text DEFAULT NULL,
  balance numeric DEFAULT 0,
  settlement_pending numeric DEFAULT 0,
  joined_at timestamptz DEFAULT now(),
  UNIQUE(group_id, user_id)
);

ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;

-- Group invites
CREATE TABLE IF NOT EXISTS group_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  invite_code text UNIQUE NOT NULL,
  invite_link_token text UNIQUE NOT NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '24 hours'),
  max_joins int DEFAULT 5,
  current_joins int DEFAULT 0
);

ALTER TABLE group_invites ENABLE ROW LEVEL SECURITY;

-- Extend expenses table with required columns
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'expenses' AND column_name = 'group_id') THEN
    ALTER TABLE expenses ADD COLUMN group_id uuid REFERENCES groups(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'expenses' AND column_name = 'expense_type') THEN
    ALTER TABLE expenses ADD COLUMN expense_type text DEFAULT 'group';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'expenses' AND column_name = 'status') THEN
    ALTER TABLE expenses ADD COLUMN status text DEFAULT 'normal';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'expenses' AND column_name = 'updated_at') THEN
    ALTER TABLE expenses ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;
END $$;

-- Expense disputes
CREATE TABLE IF NOT EXISTS expense_disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id uuid NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  raised_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text NOT NULL DEFAULT '',
  status text DEFAULT 'open',
  created_at timestamptz DEFAULT now(),
  resolved_at timestamptz
);

ALTER TABLE expense_disputes ENABLE ROW LEVEL SECURITY;

-- Dispute comments
CREATE TABLE IF NOT EXISTS dispute_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id uuid NOT NULL REFERENCES expense_disputes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  comment text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE dispute_comments ENABLE ROW LEVEL SECURITY;

-- Tasks
CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  assigned_to uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  deadline timestamptz,
  status text DEFAULT 'pending',
  reminder_enabled boolean DEFAULT false,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- Polls
CREATE TABLE IF NOT EXISTS polls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  question text NOT NULL DEFAULT '',
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz,
  is_closed boolean DEFAULT false
);

ALTER TABLE polls ENABLE ROW LEVEL SECURITY;

-- Poll options
CREATE TABLE IF NOT EXISTS poll_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id uuid NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  option_text text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE poll_options ENABLE ROW LEVEL SECURITY;

-- Poll votes
CREATE TABLE IF NOT EXISTS poll_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  option_id uuid NOT NULL REFERENCES poll_options(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(option_id, user_id)
);

ALTER TABLE poll_votes ENABLE ROW LEVEL SECURITY;

-- Activity logs (immutable audit trail)
CREATE TABLE IF NOT EXISTS activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  related_entity_type text,
  related_entity_id uuid,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- Traveler vault
CREATE TABLE IF NOT EXISTS traveler_vault (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  phone_number text,
  food_preference text,
  seat_preference text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(group_id, user_id)
);

ALTER TABLE traveler_vault ENABLE ROW LEVEL SECURITY;

-- Settlements
CREATE TABLE IF NOT EXISTS settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  from_user uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  to_user uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  settled_at timestamptz
);

ALTER TABLE settlements ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_group_members_user ON group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_group_members_group ON group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_expenses_group ON expenses(group_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_group ON activity_logs(group_id);
CREATE INDEX IF NOT EXISTS idx_tasks_group ON tasks(group_id);
CREATE INDEX IF NOT EXISTS idx_polls_group ON polls(group_id);
CREATE INDEX IF NOT EXISTS idx_traveler_vault_group ON traveler_vault(group_id);
