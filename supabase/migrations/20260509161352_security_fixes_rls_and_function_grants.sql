/*
  # Security hardening: function grants and missing RLS policies

  1. Function access control
    - Revoke EXECUTE on helper SECURITY DEFINER functions from PUBLIC and anon
    - Keep EXECUTE for authenticated (required for RLS policies that call these helpers)
    - accept_trip_invite: restrict to authenticated only
  2. RLS policies added for legacy group-based tables that had RLS enabled
     but no policies (previously fully inaccessible / unused from UI):
     groups, group_members, group_invites, tasks, polls, poll_options,
     poll_votes, traveler_vault, activity_logs, dispute_comments
  3. Security model
    - All group tables: only members of a group can read/write its rows
    - Group creators and members manage their own data
    - Dispute comments: only trip members of the related expense can view/post
*/

-- 1. Lock down SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.is_trip_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_trip_owner(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.accept_trip_invite(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_trip_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_trip_owner(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_trip_invite(text) TO authenticated;

-- 2. Helper: inline EXISTS check for group membership
--    (implemented via direct EXISTS in each policy to avoid new SECURITY DEFINER)

-- ============ groups ============
DROP POLICY IF EXISTS "Members view groups" ON public.groups;
DROP POLICY IF EXISTS "Users create groups" ON public.groups;
DROP POLICY IF EXISTS "Creator updates group" ON public.groups;
DROP POLICY IF EXISTS "Creator deletes group" ON public.groups;

CREATE POLICY "Members view groups" ON public.groups FOR SELECT TO authenticated
USING (
  created_by = auth.uid()
  OR EXISTS (SELECT 1 FROM public.group_members gm WHERE gm.group_id = groups.id AND gm.user_id = auth.uid())
);
CREATE POLICY "Users create groups" ON public.groups FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid());
CREATE POLICY "Creator updates group" ON public.groups FOR UPDATE TO authenticated
USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());
CREATE POLICY "Creator deletes group" ON public.groups FOR DELETE TO authenticated
USING (created_by = auth.uid());

-- ============ group_members ============
DROP POLICY IF EXISTS "Members view group_members" ON public.group_members;
DROP POLICY IF EXISTS "Creator adds member" ON public.group_members;
DROP POLICY IF EXISTS "Creator updates member" ON public.group_members;
DROP POLICY IF EXISTS "Creator or self removes" ON public.group_members;

CREATE POLICY "Members view group_members" ON public.group_members FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.groups g WHERE g.id = group_members.group_id AND g.created_by = auth.uid())
  OR EXISTS (SELECT 1 FROM public.group_members gm WHERE gm.group_id = group_members.group_id AND gm.user_id = auth.uid())
);
CREATE POLICY "Creator adds member" ON public.group_members FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.groups g WHERE g.id = group_members.group_id AND g.created_by = auth.uid())
);
CREATE POLICY "Creator updates member" ON public.group_members FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.groups g WHERE g.id = group_members.group_id AND g.created_by = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.groups g WHERE g.id = group_members.group_id AND g.created_by = auth.uid()));
CREATE POLICY "Creator or self removes" ON public.group_members FOR DELETE TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.groups g WHERE g.id = group_members.group_id AND g.created_by = auth.uid())
);

-- ============ group_invites ============
DROP POLICY IF EXISTS "Members view invites" ON public.group_invites;
DROP POLICY IF EXISTS "Creator makes invites" ON public.group_invites;
DROP POLICY IF EXISTS "Creator deletes invites" ON public.group_invites;

CREATE POLICY "Members view invites" ON public.group_invites FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.group_members gm WHERE gm.group_id = group_invites.group_id AND gm.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.groups g WHERE g.id = group_invites.group_id AND g.created_by = auth.uid())
);
CREATE POLICY "Creator makes invites" ON public.group_invites FOR INSERT TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND EXISTS (SELECT 1 FROM public.group_members gm WHERE gm.group_id = group_invites.group_id AND gm.user_id = auth.uid())
);
CREATE POLICY "Creator deletes invites" ON public.group_invites FOR DELETE TO authenticated
USING (
  created_by = auth.uid()
  OR EXISTS (SELECT 1 FROM public.groups g WHERE g.id = group_invites.group_id AND g.created_by = auth.uid())
);

-- ============ tasks ============
DROP POLICY IF EXISTS "Members view tasks" ON public.tasks;
DROP POLICY IF EXISTS "Members create tasks" ON public.tasks;
DROP POLICY IF EXISTS "Members update tasks" ON public.tasks;
DROP POLICY IF EXISTS "Members delete tasks" ON public.tasks;

CREATE POLICY "Members view tasks" ON public.tasks FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.group_members gm WHERE gm.group_id = tasks.group_id AND gm.user_id = auth.uid()));
CREATE POLICY "Members create tasks" ON public.tasks FOR INSERT TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND EXISTS (SELECT 1 FROM public.group_members gm WHERE gm.group_id = tasks.group_id AND gm.user_id = auth.uid())
);
CREATE POLICY "Members update tasks" ON public.tasks FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.group_members gm WHERE gm.group_id = tasks.group_id AND gm.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.group_members gm WHERE gm.group_id = tasks.group_id AND gm.user_id = auth.uid()));
CREATE POLICY "Members delete tasks" ON public.tasks FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.group_members gm WHERE gm.group_id = tasks.group_id AND gm.user_id = auth.uid()));

-- ============ polls ============
DROP POLICY IF EXISTS "Members view polls" ON public.polls;
DROP POLICY IF EXISTS "Members create polls" ON public.polls;
DROP POLICY IF EXISTS "Creator updates poll" ON public.polls;
DROP POLICY IF EXISTS "Creator deletes poll" ON public.polls;

CREATE POLICY "Members view polls" ON public.polls FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.group_members gm WHERE gm.group_id = polls.group_id AND gm.user_id = auth.uid()));
CREATE POLICY "Members create polls" ON public.polls FOR INSERT TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND EXISTS (SELECT 1 FROM public.group_members gm WHERE gm.group_id = polls.group_id AND gm.user_id = auth.uid())
);
CREATE POLICY "Creator updates poll" ON public.polls FOR UPDATE TO authenticated
USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());
CREATE POLICY "Creator deletes poll" ON public.polls FOR DELETE TO authenticated
USING (created_by = auth.uid());

-- ============ poll_options ============
DROP POLICY IF EXISTS "Members view poll_options" ON public.poll_options;
DROP POLICY IF EXISTS "Members create poll_options" ON public.poll_options;
DROP POLICY IF EXISTS "Creator deletes poll_options" ON public.poll_options;

CREATE POLICY "Members view poll_options" ON public.poll_options FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.polls p JOIN public.group_members gm ON gm.group_id = p.group_id
  WHERE p.id = poll_options.poll_id AND gm.user_id = auth.uid()
));
CREATE POLICY "Members create poll_options" ON public.poll_options FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.polls p JOIN public.group_members gm ON gm.group_id = p.group_id
  WHERE p.id = poll_options.poll_id AND gm.user_id = auth.uid()
));
CREATE POLICY "Creator deletes poll_options" ON public.poll_options FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.polls p WHERE p.id = poll_options.poll_id AND p.created_by = auth.uid()));

-- ============ poll_votes ============
DROP POLICY IF EXISTS "Members view poll_votes" ON public.poll_votes;
DROP POLICY IF EXISTS "Self casts poll_votes" ON public.poll_votes;
DROP POLICY IF EXISTS "Self removes poll_votes" ON public.poll_votes;

CREATE POLICY "Members view poll_votes" ON public.poll_votes FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.poll_options o JOIN public.polls p ON p.id = o.poll_id
  JOIN public.group_members gm ON gm.group_id = p.group_id
  WHERE o.id = poll_votes.option_id AND gm.user_id = auth.uid()
));
CREATE POLICY "Self casts poll_votes" ON public.poll_votes FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.poll_options o JOIN public.polls p ON p.id = o.poll_id
    JOIN public.group_members gm ON gm.group_id = p.group_id
    WHERE o.id = poll_votes.option_id AND gm.user_id = auth.uid()
  )
);
CREATE POLICY "Self removes poll_votes" ON public.poll_votes FOR DELETE TO authenticated
USING (user_id = auth.uid());

-- ============ traveler_vault ============
DROP POLICY IF EXISTS "Members view vault" ON public.traveler_vault;
DROP POLICY IF EXISTS "Self writes vault" ON public.traveler_vault;
DROP POLICY IF EXISTS "Self updates vault" ON public.traveler_vault;
DROP POLICY IF EXISTS "Self deletes vault" ON public.traveler_vault;

CREATE POLICY "Members view vault" ON public.traveler_vault FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.group_members gm WHERE gm.group_id = traveler_vault.group_id AND gm.user_id = auth.uid())
);
CREATE POLICY "Self writes vault" ON public.traveler_vault FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (SELECT 1 FROM public.group_members gm WHERE gm.group_id = traveler_vault.group_id AND gm.user_id = auth.uid())
);
CREATE POLICY "Self updates vault" ON public.traveler_vault FOR UPDATE TO authenticated
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Self deletes vault" ON public.traveler_vault FOR DELETE TO authenticated
USING (user_id = auth.uid());

-- ============ activity_logs ============
DROP POLICY IF EXISTS "Members view activity" ON public.activity_logs;
DROP POLICY IF EXISTS "Members write activity" ON public.activity_logs;

CREATE POLICY "Members view activity" ON public.activity_logs FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.group_members gm WHERE gm.group_id = activity_logs.group_id AND gm.user_id = auth.uid()));
CREATE POLICY "Members write activity" ON public.activity_logs FOR INSERT TO authenticated
WITH CHECK (
  actor_id = auth.uid()
  AND EXISTS (SELECT 1 FROM public.group_members gm WHERE gm.group_id = activity_logs.group_id AND gm.user_id = auth.uid())
);

-- ============ dispute_comments ============
DROP POLICY IF EXISTS "Trip members view dispute_comments" ON public.dispute_comments;
DROP POLICY IF EXISTS "Trip members post dispute_comments" ON public.dispute_comments;
DROP POLICY IF EXISTS "Author deletes dispute_comment" ON public.dispute_comments;

CREATE POLICY "Trip members view dispute_comments" ON public.dispute_comments FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.expense_disputes d
  JOIN public.expenses e ON e.id = d.expense_id
  WHERE d.id = dispute_comments.dispute_id
    AND (
      (e.trip_id IS NOT NULL AND public.is_trip_member(e.trip_id, auth.uid()))
      OR e.created_by = auth.uid()
      OR e.paid_by = auth.uid()
    )
));
CREATE POLICY "Trip members post dispute_comments" ON public.dispute_comments FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.expense_disputes d
    JOIN public.expenses e ON e.id = d.expense_id
    WHERE d.id = dispute_comments.dispute_id
      AND (
        (e.trip_id IS NOT NULL AND public.is_trip_member(e.trip_id, auth.uid()))
        OR e.created_by = auth.uid()
        OR e.paid_by = auth.uid()
      )
  )
);
CREATE POLICY "Author deletes dispute_comment" ON public.dispute_comments FOR DELETE TO authenticated
USING (user_id = auth.uid());
