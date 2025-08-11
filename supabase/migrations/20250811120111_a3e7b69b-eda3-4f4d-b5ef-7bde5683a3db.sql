-- Create mapping between doctors and patients
create table if not exists public.doctor_patients (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null,
  patient_id uuid not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (doctor_id, patient_id)
);

alter table public.doctor_patients enable row level security;

-- RLS policies for doctor_patients
create policy if not exists "Doctors can view their patient mappings"
  on public.doctor_patients
  for select
  using (auth.uid() = doctor_id);

create policy if not exists "Doctors can manage their patient mappings"
  on public.doctor_patients
  for insert
  with check (auth.uid() = doctor_id);

create policy if not exists "Doctors can update their patient mappings"
  on public.doctor_patients
  for update
  using (auth.uid() = doctor_id);

create policy if not exists "Doctors can delete their patient mappings"
  on public.doctor_patients
  for delete
  using (auth.uid() = doctor_id);

create policy if not exists "Patients can view their doctor mappings"
  on public.doctor_patients
  for select
  using (auth.uid() = patient_id);

-- Indexes for performance
create index if not exists idx_doctor_patients_doctor on public.doctor_patients(doctor_id);
create index if not exists idx_doctor_patients_patient on public.doctor_patients(patient_id);
create index if not exists idx_doctor_patients_status on public.doctor_patients(status);

-- updated_at trigger
create trigger if not exists update_doctor_patients_updated_at
before update on public.doctor_patients
for each row execute function public.update_updated_at_column();


-- Appointments table
create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null,
  patient_id uuid not null,
  start_time timestamptz not null,
  end_time timestamptz,
  status text not null default 'scheduled',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.appointments enable row level security;

-- Validation trigger to ensure end_time >= start_time when provided
create or replace function public.validate_appointment_time()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if NEW.end_time is not null and NEW.end_time < NEW.start_time then
    raise exception 'end_time cannot be before start_time';
  end if;
  return NEW;
end;
$$;

create trigger if not exists validate_appointment_time_trigger
before insert or update on public.appointments
for each row execute function public.validate_appointment_time();

-- RLS policies for appointments
create policy if not exists "Doctors can view their appointments"
  on public.appointments
  for select
  using (auth.uid() = doctor_id);

create policy if not exists "Doctors can create appointments"
  on public.appointments
  for insert
  with check (auth.uid() = doctor_id);

create policy if not exists "Doctors can update their appointments"
  on public.appointments
  for update
  using (auth.uid() = doctor_id);

create policy if not exists "Doctors can delete their appointments"
  on public.appointments
  for delete
  using (auth.uid() = doctor_id);

create policy if not exists "Patients can view their appointments"
  on public.appointments
  for select
  using (auth.uid() = patient_id);

-- Indexes
create index if not exists idx_appointments_doctor on public.appointments(doctor_id);
create index if not exists idx_appointments_patient on public.appointments(patient_id);
create index if not exists idx_appointments_start_time on public.appointments(start_time);
create index if not exists idx_appointments_status on public.appointments(status);

-- updated_at trigger
create trigger if not exists update_appointments_updated_at
before update on public.appointments
for each row execute function public.update_updated_at_column();


-- Health alerts table
create table if not exists public.health_alerts (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null,
  patient_id uuid not null,
  alert_type text not null,
  message text not null,
  severity text not null default 'info',
  resolved boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.health_alerts enable row level security;

-- RLS policies for health alerts
create policy if not exists "Doctors can view their alerts"
  on public.health_alerts
  for select
  using (auth.uid() = doctor_id);

create policy if not exists "Doctors can create alerts"
  on public.health_alerts
  for insert
  with check (auth.uid() = doctor_id);

create policy if not exists "Doctors can update their alerts"
  on public.health_alerts
  for update
  using (auth.uid() = doctor_id);

create policy if not exists "Doctors can delete their alerts"
  on public.health_alerts
  for delete
  using (auth.uid() = doctor_id);

create policy if not exists "Patients can view alerts about themselves"
  on public.health_alerts
  for select
  using (auth.uid() = patient_id);

-- Indexes
create index if not exists idx_health_alerts_doctor on public.health_alerts(doctor_id);
create index if not exists idx_health_alerts_patient on public.health_alerts(patient_id);
create index if not exists idx_health_alerts_severity on public.health_alerts(severity);
create index if not exists idx_health_alerts_resolved on public.health_alerts(resolved);

-- updated_at trigger
create trigger if not exists update_health_alerts_updated_at
before update on public.health_alerts
for each row execute function public.update_updated_at_column();


-- Allow doctors to view basic profiles of their mapped patients for UI display
create policy if not exists "Doctors can view profiles of mapped patients"
  on public.profiles
  for select
  using (
    exists (
      select 1 from public.doctor_patients dp
      where dp.doctor_id = auth.uid() and dp.patient_id = profiles.user_id
    )
    or auth.uid() = user_id
  );