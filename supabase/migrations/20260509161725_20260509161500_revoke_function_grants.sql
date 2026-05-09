/*
  # Revoke EXECUTE Grants on Helper Functions

  Revoke public/anon/authenticated EXECUTE grants on helper functions.
  These functions should only be called from RLS policies and internal code,
  never exposed via REST API.
*/

REVOKE EXECUTE ON FUNCTION public.accept_trip_invite(p_token text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.accept_trip_invite(p_token text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.accept_trip_invite(p_token text) FROM public;

REVOKE EXECUTE ON FUNCTION public.is_trip_member(p_trip_id uuid, p_user_id uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_trip_member(p_trip_id uuid, p_user_id uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.is_trip_member(p_trip_id uuid, p_user_id uuid) FROM public;

REVOKE EXECUTE ON FUNCTION public.is_trip_owner(p_trip_id uuid, p_user_id uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_trip_owner(p_trip_id uuid, p_user_id uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.is_trip_owner(p_trip_id uuid, p_user_id uuid) FROM public;
