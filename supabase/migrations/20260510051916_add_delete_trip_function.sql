/*
  # Add delete_trip cascade function

  ## Summary
  Creates a secure server-side function that deletes a trip and all
  its related data in the correct order, respecting foreign key
  dependencies. Only the trip owner can delete their trip.

  ## Changes
  - New function: `delete_trip(p_trip_id uuid)`
  - Deletes related records in dependency order before deleting the trip
  - Uses SECURITY DEFINER so the function runs as the database owner
  - Checks ownership before allowing deletion

  ## Security
  - Only the trip owner (owner_id = auth.uid()) can delete
  - Returns false if not owner or trip not found
*/

CREATE OR REPLACE FUNCTION delete_trip(p_trip_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_owner_id uuid;
BEGIN
  SELECT owner_id INTO v_owner_id FROM trips WHERE id = p_trip_id;
  IF v_owner_id IS NULL OR v_owner_id != auth.uid() THEN
    RETURN false;
  END IF;

  DELETE FROM message_reactions WHERE message_id IN (SELECT id FROM messages WHERE trip_id = p_trip_id);
  DELETE FROM messages WHERE trip_id = p_trip_id;
  DELETE FROM itinerary_votes WHERE item_id IN (SELECT id FROM itinerary_items WHERE trip_id = p_trip_id);
  DELETE FROM itinerary_items WHERE trip_id = p_trip_id;
  DELETE FROM booking_activity_logs WHERE trip_id = p_trip_id;
  DELETE FROM booking_participants WHERE booking_id IN (SELECT id FROM bookings WHERE trip_id = p_trip_id);
  DELETE FROM booking_votes WHERE booking_id IN (SELECT id FROM bookings WHERE trip_id = p_trip_id);
  DELETE FROM booking_recommendations WHERE booking_id IN (SELECT id FROM bookings WHERE trip_id = p_trip_id);
  DELETE FROM bookings WHERE trip_id = p_trip_id;
  DELETE FROM expense_disputes WHERE expense_id IN (SELECT id FROM expenses WHERE trip_id = p_trip_id);
  DELETE FROM expense_splits WHERE expense_id IN (SELECT id FROM expenses WHERE trip_id = p_trip_id);
  DELETE FROM expenses WHERE trip_id = p_trip_id;
  DELETE FROM settlements WHERE trip_id = p_trip_id;
  DELETE FROM service_reservations WHERE trip_id = p_trip_id;
  DELETE FROM trip_poll_votes WHERE option_id IN (SELECT id FROM trip_poll_options WHERE poll_id IN (SELECT id FROM trip_polls WHERE trip_id = p_trip_id));
  DELETE FROM trip_poll_options WHERE poll_id IN (SELECT id FROM trip_polls WHERE trip_id = p_trip_id);
  DELETE FROM trip_polls WHERE trip_id = p_trip_id;
  DELETE FROM trip_tasks WHERE trip_id = p_trip_id;
  DELETE FROM trip_alerts WHERE trip_id = p_trip_id;
  DELETE FROM trip_activity_logs WHERE trip_id = p_trip_id;
  DELETE FROM trip_invites WHERE trip_id = p_trip_id;
  DELETE FROM trip_presence WHERE trip_id = p_trip_id;
  DELETE FROM trip_subscriptions WHERE trip_id = p_trip_id;
  DELETE FROM trip_wallets WHERE trip_id = p_trip_id;
  DELETE FROM trip_members WHERE trip_id = p_trip_id;
  DELETE FROM notifications WHERE trip_id = p_trip_id;
  DELETE FROM trips WHERE id = p_trip_id;

  RETURN true;
END;
$$;
