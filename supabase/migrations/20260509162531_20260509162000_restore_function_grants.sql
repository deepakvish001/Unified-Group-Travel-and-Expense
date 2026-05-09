/*
  # Restore EXECUTE Grants on Helper Functions

  The helper functions `is_trip_member` and `is_trip_owner` are called from
  RLS policies and need EXECUTE permission for authenticated users.
  The function `accept_trip_invite` is called via RPC by authenticated users.

  Since all three are now SECURITY INVOKER (not DEFINER), granting EXECUTE
  to authenticated is safe - the functions run with the caller's permissions
  and their own internal logic/RLS policies enforce security.
*/

GRANT EXECUTE ON FUNCTION public.is_trip_member(p_trip_id uuid, p_user_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_trip_owner(p_trip_id uuid, p_user_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_trip_invite(p_token text) TO authenticated;
