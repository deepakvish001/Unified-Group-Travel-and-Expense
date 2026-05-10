/*
  # Add media support to chat messages

  ## Summary
  Adds a media_urls column to the messages table to support
  image and video sharing in the group chat.

  ## Changes
  - Add `media_urls` text[] column to messages table (nullable)
  - Default empty array

  ## Security
  - No RLS changes needed (existing policies cover this)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'media_urls'
  ) THEN
    ALTER TABLE messages ADD COLUMN media_urls text[] DEFAULT '{}';
  END IF;
END $$;
