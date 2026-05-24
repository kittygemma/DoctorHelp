-- Clinics table
create table clinics (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text unique not null,
  stripe_customer_id text,
  stripe_subscription_id text,
  subscription_status text not null default 'active',
  plan text not null default 'starter',
  created_at timestamptz default now()
);

-- Doctors table (links auth users to clinics)
create table doctors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  clinic_id uuid references clinics(id) not null,
  name text not null,
  created_at timestamptz default now()
);

-- Add clinic_id to sessions
alter table sessions add column clinic_id uuid references clinics(id);

-- RLS for new tables
alter table clinics enable row level security;
alter table doctors enable row level security;

create policy "Allow all access to clinics" on clinics for all using (true) with check (true);
create policy "Allow all access to doctors" on doctors for all using (true) with check (true);
