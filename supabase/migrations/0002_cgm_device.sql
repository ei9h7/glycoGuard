-- Add cgm_device, missed during initial schema design (present in Firestore model).
-- ai_enabled starts NULL ("never explicitly set" — triggers the opt-in modal,
-- renders as enabled) rather than defaulting to true, mirroring the Firestore
-- "field absent vs. explicitly false" distinction useAI.js relies on.
alter table profiles alter column ai_enabled drop not null;
alter table profiles alter column ai_enabled drop default;
update profiles set ai_enabled = null;

alter table children add column if not exists cgm_device text;
alter table children add column if not exists updated_at timestamptz not null default now();

-- Lets the co-parent match flow (coParentMatch.js) find the other parent's row
-- by reciprocal email — mirrors the write-side "co-parent match link" policy.
create policy "children: co-parent match read" on children for select
  using (co_parent_email = auth.jwt() ->> 'email');
