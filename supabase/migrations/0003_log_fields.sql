-- Align log table columns with the fields the app actually reads/writes
-- (discovered during the Firestore->Supabase port): glucose readings carry a
-- `source` (manual/cgm) and free-text `notes`; meals carry `notes`; symptom
-- events carry the glucose reading value at the time they were logged.

alter table glucose_readings rename column note to notes;
alter table glucose_readings add column if not exists source text;

alter table meal_logs rename column note to notes;

alter table symptom_events add column if not exists glucose_at_time numeric;
