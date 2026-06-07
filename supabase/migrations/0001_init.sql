-- GlycoGuard — Supabase (Postgres) schema + Row Level Security
--
-- Mirrors the Firestore data model (users/{uid}/children/{childId}/...) as a
-- relational schema. One child per user is supported today (matches current
-- app behaviour); the schema allows more without migration later.
--
-- Run this in the Supabase SQL editor (or via `supabase db push`).

-- ── Extensions ────────────────────────────────────────────────────────────────
create extension if not exists "pgcrypto";

-- ── Profiles (mirrors users/{uid}) ────────────────────────────────────────────
-- Supabase Auth owns auth.users; we keep app-specific prefs in a 1:1 profile row.
create table if not exists profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  display_name    text,
  unit_preference text not null default 'mmol' check (unit_preference in ('mmol', 'mgdl')),
  ai_enabled      boolean not null default true,
  created_at      timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "profiles: owner read"   on profiles for select using (auth.uid() = id);
create policy "profiles: owner insert" on profiles for insert with check (auth.uid() = id);
create policy "profiles: owner update" on profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id and unit_preference in ('mmol', 'mgdl'));
-- no delete policy: profiles are immutable-by-removal, matches Firestore rules

-- ── Children (mirrors users/{uid}/children/{childId}) ─────────────────────────
create table if not exists children (
  id                 uuid primary key default gen_random_uuid(),
  owner_id           uuid not null references auth.users(id) on delete cascade,
  name               text not null check (char_length(name) between 1 and 100),
  dob                date,
  diagnosis          text,
  glucose_target_min numeric not null default 4.0 check (glucose_target_min >= 1.0),
  glucose_target_max numeric not null default 8.0 check (glucose_target_max <= 15.0),
  meal_interval_minutes integer not null default 120,

  -- Co-parent linking (cross-user; mirrors coParent* fields on the child doc)
  co_parent_email     text,
  co_parent_uid       uuid references auth.users(id),
  co_parent_child_id  uuid references children(id),
  co_parent_status    text check (co_parent_status in ('pending', 'connected')),

  -- Mutual sharing consent, per category — jsonb mirrors the Firestore map
  sharing            jsonb not null default '{"glucose": false, "meals": false, "symptoms": false, "documents": false, "patterns": false, "aiHistory": false}',

  created_at         timestamptz not null default now(),

  constraint valid_glucose_targets check (glucose_target_min < glucose_target_max)
);

alter table children enable row level security;

-- A user can read their own child, OR a connected co-parent's child when both
-- sides have mutually consented for at least one category (fine-grained category
-- checks happen at the data-table level — this just gates visibility of the row).
create policy "children: owner read" on children for select
  using (owner_id = auth.uid());

create policy "children: co-parent read" on children for select
  using (
    co_parent_status = 'connected'
    and co_parent_uid = auth.uid()
  );

create policy "children: owner insert" on children for insert
  with check (owner_id = auth.uid());

-- Owners can update their own child's profile fields; co-parent linking fields
-- are governed by the separate policy below (matches isCoParentMatchWrite).
create policy "children: owner update" on children for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- Permits the cross-user write coParentMatch makes when linking two parents:
-- the requester's email must match the stored co_parent_email on the target row,
-- and the row must transition to 'connected' naming the requester as co-parent.
create policy "children: co-parent match link" on children for update
  using (co_parent_email = auth.jwt() ->> 'email')
  with check (
    co_parent_email = auth.jwt() ->> 'email'
    and co_parent_status = 'connected'
    and co_parent_uid = auth.uid()
  );

create policy "children: owner delete" on children for delete
  using (owner_id = auth.uid());

-- ── Helper: mutual sharing consent between owner & connected co-parent ────────
-- Mirrors coParentCanRead() in firestore.rules. SECURITY DEFINER so it can read
-- both sides' rows regardless of the caller's row-level visibility.
create or replace function co_parent_can_read(child_row children, category text)
returns boolean
language sql stable security definer set search_path = public as $$
  select
    child_row.co_parent_status = 'connected'
    and child_row.co_parent_uid = auth.uid()
    and coalesce((child_row.sharing ->> category)::boolean, false)
    and exists (
      select 1 from children cp
      where cp.id = child_row.co_parent_child_id
        and cp.owner_id = auth.uid()
        and coalesce((cp.sharing ->> category)::boolean, false)
    );
$$;

-- ── Generic policy template for immutable per-child log tables ────────────────
-- glucose_readings, meal_logs, symptom_events: owner full read/insert, no
-- update/delete (immutable, matches `update: false` in Firestore rules);
-- co-parent read gated by co_parent_can_read() for the matching category.

create table if not exists glucose_readings (
  id          uuid primary key default gen_random_uuid(),
  child_id    uuid not null references children(id) on delete cascade,
  value       numeric not null,
  note        text,
  logged_by   uuid not null references auth.users(id),
  "timestamp" timestamptz not null default now()
);
alter table glucose_readings enable row level security;

create table if not exists meal_logs (
  id              uuid primary key default gen_random_uuid(),
  child_id        uuid not null references children(id) on delete cascade,
  description_text text not null,
  carbs_estimate  numeric,
  note            text,
  logged_by       uuid not null references auth.users(id),
  "timestamp"     timestamptz not null default now()
);
alter table meal_logs enable row level security;

create table if not exists symptom_events (
  id                  uuid primary key default gen_random_uuid(),
  child_id            uuid not null references children(id) on delete cascade,
  quick_tap_symptoms  text[] not null default '{}',
  observation_text    text,
  logged_by           uuid not null references auth.users(id),
  "timestamp"         timestamptz not null default now()
);
alter table symptom_events enable row level security;

-- Owner read/insert + co-parent read, per table (category names match `sharing` keys)
do $$
declare
  t record;
begin
  for t in select * from (values
    ('glucose_readings', 'glucose'),
    ('meal_logs',        'meals'),
    ('symptom_events',   'symptoms')
  ) as x(table_name, category)
  loop
    execute format($f$
      create policy "%1$s: owner read" on %1$s for select
        using (exists (select 1 from children c where c.id = %1$s.child_id and c.owner_id = auth.uid()));
    $f$, t.table_name);

    execute format($f$
      create policy "%1$s: co-parent read" on %1$s for select
        using (exists (
          select 1 from children c
          where c.id = %1$s.child_id and co_parent_can_read(c, '%2$s')
        ));
    $f$, t.table_name, t.category);

    execute format($f$
      create policy "%1$s: owner insert" on %1$s for insert
        with check (
          logged_by = auth.uid()
          and exists (select 1 from children c where c.id = %1$s.child_id and c.owner_id = auth.uid())
        );
    $f$, t.table_name);
    -- No update/delete policies: rows are immutable once written, mirroring Firestore rules.
  end loop;
end $$;

-- ── Documents (lab PDFs / provider letters — text only, no binary storage) ────
create table if not exists documents (
  id              uuid primary key default gen_random_uuid(),
  child_id        uuid not null references children(id) on delete cascade,
  filename        text not null,
  type            text not null,
  extracted_text  text,
  chunk_count     integer not null default 0,
  logged_by       uuid not null references auth.users(id),
  created_at      timestamptz not null default now()
);
alter table documents enable row level security;

create policy "documents: owner read" on documents for select
  using (exists (select 1 from children c where c.id = documents.child_id and c.owner_id = auth.uid()));
create policy "documents: co-parent read" on documents for select
  using (exists (select 1 from children c where c.id = documents.child_id and co_parent_can_read(c, 'documents')));
create policy "documents: owner insert" on documents for insert
  with check (
    logged_by = auth.uid()
    and exists (select 1 from children c where c.id = documents.child_id and c.owner_id = auth.uid())
  );
create policy "documents: owner delete" on documents for delete
  using (exists (select 1 from children c where c.id = documents.child_id and c.owner_id = auth.uid()));

-- ── Preference notes ──────────────────────────────────────────────────────────
create table if not exists preference_notes (
  id          uuid primary key default gen_random_uuid(),
  child_id    uuid not null references children(id) on delete cascade,
  content     text not null,
  logged_by   uuid not null references auth.users(id),
  created_at  timestamptz not null default now()
);
alter table preference_notes enable row level security;

create policy "preference_notes: owner read" on preference_notes for select
  using (exists (select 1 from children c where c.id = preference_notes.child_id and c.owner_id = auth.uid()));
create policy "preference_notes: owner insert" on preference_notes for insert
  with check (
    logged_by = auth.uid()
    and exists (select 1 from children c where c.id = preference_notes.child_id and c.owner_id = auth.uid())
  );
create policy "preference_notes: owner delete" on preference_notes for delete
  using (exists (select 1 from children c where c.id = preference_notes.child_id and c.owner_id = auth.uid()));

-- ── Meal plan (one row per child per ISO week; days stored as jsonb) ──────────
create table if not exists meal_plans (
  child_id   uuid not null references children(id) on delete cascade,
  week_id    text not null,             -- e.g. '2026-W23', mirrors Firestore doc id
  days       jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (child_id, week_id)
);
alter table meal_plans enable row level security;

create policy "meal_plans: owner read/write" on meal_plans for all
  using (exists (select 1 from children c where c.id = meal_plans.child_id and c.owner_id = auth.uid()))
  with check (exists (select 1 from children c where c.id = meal_plans.child_id and c.owner_id = auth.uid()));

-- ── Pattern summaries (singleton-per-child, mirrors patternSummary/latest) ────
create table if not exists pattern_summaries (
  child_id      uuid primary key references children(id) on delete cascade,
  patterns      jsonb not null default '[]',
  generated_at  timestamptz not null default now()
);
alter table pattern_summaries enable row level security;

create policy "pattern_summaries: owner read/write" on pattern_summaries for all
  using (exists (select 1 from children c where c.id = pattern_summaries.child_id and c.owner_id = auth.uid()))
  with check (exists (select 1 from children c where c.id = pattern_summaries.child_id and c.owner_id = auth.uid()));

create policy "pattern_summaries: co-parent read" on pattern_summaries for select
  using (exists (select 1 from children c where c.id = pattern_summaries.child_id and co_parent_can_read(c, 'patterns')));

-- ── Realtime ──────────────────────────────────────────────────────────────────
-- Enable Postgres replication for tables the app subscribes to live (replaces
-- Firestore onSnapshot). Run once; safe to re-run.
alter publication supabase_realtime add table profiles, children, glucose_readings, meal_logs, symptom_events, documents, preference_notes, meal_plans, pattern_summaries;

-- ── Notes on what's intentionally NOT ported ──────────────────────────────────
-- 1. _rateLimits — Firestore's best-effort client-cooperative rate limiting has
--    no clean Postgres analogue without Edge Functions; recommend replacing with
--    a Supabase Edge Function + a `rate_limits` table + `pg_cron` reset job, or
--    skipping client-side limits entirely in favour of Postgres connection/role
--    quotas. Not required for a working migration — flagged for follow-up.
-- 2. Firebase Storage — the app never uploads file binaries (documents are
--    parsed client-side to text); nothing to migrate to Supabase Storage.
