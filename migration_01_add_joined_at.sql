-- Migration: Add joined_at to room_members
-- Date: 2026-10-09
-- Description: The application queries room_members.joined_at in getMembers, but it was missing from the initial schema.

ALTER TABLE room_members 
ADD COLUMN IF NOT EXISTS joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
