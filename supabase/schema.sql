-- Patients table
create table patients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  dob date not null,
  gender text,
  medical_history jsonb default '{}',
  created_at timestamptz default now(),
  unique(name, dob)
);

-- Sessions table
create table sessions (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid references patients(id) not null,
  status text not null default 'active' check (status in ('active', 'waiting', 'completed')),
  urgency integer check (urgency between 1 and 5),
  summary text,
  diagnosis jsonb default '[]',
  arrived_at timestamptz default now(),
  completed_at timestamptz
);

-- Messages table
create table messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) not null,
  role text not null check (role in ('patient', 'assistant')),
  content text not null,
  created_at timestamptz default now()
);

-- Enable realtime on sessions table so the dashboard updates live
alter publication supabase_realtime add table sessions;

-- Index for sorting dashboard by urgency then arrival
create index idx_sessions_triage on sessions (urgency asc nulls last, arrived_at asc);

-- Index for looking up messages by session
create index idx_messages_session on messages (session_id, created_at asc);

-- Enable row-level security (required by Supabase, using permissive policies for hackathon)
alter table patients enable row level security;
alter table sessions enable row level security;
alter table messages enable row level security;

create policy "Allow all access to patients" on patients for all using (true) with check (true);
create policy "Allow all access to sessions" on sessions for all using (true) with check (true);
create policy "Allow all access to messages" on messages for all using (true) with check (true);
