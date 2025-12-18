-- GeoCRM Intelligence — Calendar (simple, PostgREST-friendly)
-- Execute in Supabase SQL Editor.

-- 1) Calendar configuration (one row per user)
create table if not exists public.calendar_configs (
  user_id uuid primary key references public.users(id) on delete cascade,
  timezone text not null default 'America/Sao_Paulo',
  working_days int[] not null default array[1,2,3,4,5],
  windows jsonb not null default '[{"start":"09:00","end":"18:00"}]'::jsonb,
  slot_minutes int not null default 30,
  buffer_minutes int not null default 0,
  blocks jsonb not null default '[]'::jsonb, -- [{date:"YYYY-MM-DD", allDay:true}|{date,start,end,reason}]
  auto_email_confirm boolean not null default false,
  auto_email_reminders boolean not null default false,
  auto_whatsapp boolean not null default false,
  whatsapp_number text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2) Appointments
create table if not exists public.calendar_appointments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  lead_id bigint references public.leads(id) on delete set null,
  status text not null default 'confirmed' check (status in ('confirmed','pending','canceled')),
  start_at timestamptz not null,
  duration_minutes int not null default 30,
  channel text not null default 'Google Meet' check (channel in ('Google Meet','Zoom','WhatsApp','Telefone')),
  meeting_link text,
  lead_name text not null,
  lead_email text,
  lead_phone text,
  lead_company text,
  lead_notes text,
  email_jobs jsonb not null default '[]'::jsonb, -- scheduler job ids (optional)
  google_event_id text, -- optional
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists calendar_appointments_user_start_idx
  on public.calendar_appointments (user_id, start_at);

create index if not exists calendar_appointments_lead_idx
  on public.calendar_appointments (user_id, lead_id);

-- 3) (Optional) Google integration state (minimal)
create table if not exists public.calendar_integrations (
  user_id uuid not null references public.users(id) on delete cascade,
  provider text not null check (provider in ('google')),
  connected boolean not null default false,
  scopes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, provider)
);

