create extension if not exists pgcrypto;

create type public.app_role as enum ('admin', 'professor');
create type public.enrollment_status as enum ('active', 'transferred', 'evaded');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role public.app_role not null default 'professor',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  school_year integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint classes_school_year_check check (school_year between 2000 and 2100),
  constraint classes_name_year_unique unique (name, school_year)
);

create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.class_subjects (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint class_subjects_unique unique (class_id, subject_id)
);

create table public.students (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  registration_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete restrict,
  class_id uuid not null references public.classes(id) on delete restrict,
  school_year integer not null,
  entry_term integer not null default 1,
  exit_term integer,
  status public.enrollment_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint enrollments_school_year_check check (school_year between 2000 and 2100),
  constraint enrollments_entry_term_check check (entry_term between 1 and 4),
  constraint enrollments_exit_term_check check (exit_term is null or exit_term between 1 and 4),
  constraint enrollments_exit_status_check check (
    (status = 'active' and exit_term is null)
    or (status in ('transferred', 'evaded') and exit_term is not null)
  ),
  constraint enrollments_unique unique (student_id, class_id, school_year)
);

create table public.teacher_assignments (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  class_subject_id uuid not null references public.class_subjects(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint teacher_assignments_unique unique (teacher_id, class_subject_id)
);

create table public.term_settings (
  id uuid primary key default gen_random_uuid(),
  class_subject_id uuid not null references public.class_subjects(id) on delete cascade,
  term integer not null,
  planned_lessons integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint term_settings_term_check check (term between 1 and 4),
  constraint term_settings_planned_lessons_check check (planned_lessons > 0),
  constraint term_settings_unique unique (class_subject_id, term)
);

create table public.term_records (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.enrollments(id) on delete cascade,
  class_subject_id uuid not null references public.class_subjects(id) on delete cascade,
  term integer not null,
  grade numeric(4,2),
  absences integer not null default 0,
  observation text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint term_records_term_check check (term between 1 and 4),
  constraint term_records_grade_check check (grade is null or (grade >= 0 and grade <= 10)),
  constraint term_records_absences_check check (absences >= 0),
  constraint term_records_unique unique (enrollment_id, class_subject_id, term)
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  table_name text not null,
  row_id uuid,
  created_at timestamptz not null default now()
);

create index enrollments_class_id_idx on public.enrollments(class_id);
create index enrollments_student_id_idx on public.enrollments(student_id);
create index teacher_assignments_teacher_id_idx on public.teacher_assignments(teacher_id);
create index term_records_enrollment_id_idx on public.term_records(enrollment_id);
create index term_records_class_subject_id_idx on public.term_records(class_subject_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger classes_set_updated_at
before update on public.classes
for each row execute function public.set_updated_at();

create trigger subjects_set_updated_at
before update on public.subjects
for each row execute function public.set_updated_at();

create trigger students_set_updated_at
before update on public.students
for each row execute function public.set_updated_at();

create trigger enrollments_set_updated_at
before update on public.enrollments
for each row execute function public.set_updated_at();

create trigger term_settings_set_updated_at
before update on public.term_settings
for each row execute function public.set_updated_at();

create trigger term_records_set_updated_at
before update on public.term_records
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email)
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;

create or replace function public.can_access_class_subject(target_class_subject_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin()
    or exists (
      select 1
      from public.teacher_assignments ta
      where ta.teacher_id = auth.uid()
        and ta.class_subject_id = target_class_subject_id
    );
$$;

create or replace function public.can_access_class(target_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin()
    or exists (
      select 1
      from public.teacher_assignments ta
      join public.class_subjects cs on cs.id = ta.class_subject_id
      where ta.teacher_id = auth.uid()
        and cs.class_id = target_class_id
    );
$$;

alter table public.profiles enable row level security;
alter table public.classes enable row level security;
alter table public.subjects enable row level security;
alter table public.class_subjects enable row level security;
alter table public.students enable row level security;
alter table public.enrollments enable row level security;
alter table public.teacher_assignments enable row level security;
alter table public.term_settings enable row level security;
alter table public.term_records enable row level security;
alter table public.audit_logs enable row level security;

create policy "profiles_select_own_or_admin"
on public.profiles for select
to authenticated
using (id = auth.uid() or public.is_admin());

create policy "admin_manage_profiles"
on public.profiles for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "classes_select_authorized"
on public.classes for select
to authenticated
using (public.can_access_class(id));

create policy "admin_manage_classes"
on public.classes for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "subjects_select_authenticated"
on public.subjects for select
to authenticated
using (true);

create policy "admin_manage_subjects"
on public.subjects for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "class_subjects_select_authorized"
on public.class_subjects for select
to authenticated
using (public.can_access_class_subject(id));

create policy "admin_manage_class_subjects"
on public.class_subjects for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "students_select_authorized"
on public.students for select
to authenticated
using (
  public.is_admin()
  or exists (
    select 1
    from public.enrollments e
    where e.student_id = students.id
      and public.can_access_class(e.class_id)
  )
);

create policy "admin_manage_students"
on public.students for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "enrollments_select_authorized"
on public.enrollments for select
to authenticated
using (public.can_access_class(class_id));

create policy "admin_manage_enrollments"
on public.enrollments for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "teacher_assignments_select_own_or_admin"
on public.teacher_assignments for select
to authenticated
using (teacher_id = auth.uid() or public.is_admin());

create policy "admin_manage_teacher_assignments"
on public.teacher_assignments for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "term_settings_select_authorized"
on public.term_settings for select
to authenticated
using (public.can_access_class_subject(class_subject_id));

create policy "term_settings_manage_authorized"
on public.term_settings for all
to authenticated
using (public.can_access_class_subject(class_subject_id))
with check (public.can_access_class_subject(class_subject_id));

create policy "term_records_select_authorized"
on public.term_records for select
to authenticated
using (public.can_access_class_subject(class_subject_id));

create policy "term_records_manage_authorized"
on public.term_records for all
to authenticated
using (public.can_access_class_subject(class_subject_id))
with check (public.can_access_class_subject(class_subject_id));

create policy "audit_logs_select_admin"
on public.audit_logs for select
to authenticated
using (public.is_admin());

create policy "audit_logs_insert_authenticated"
on public.audit_logs for insert
to authenticated
with check (actor_id = auth.uid());
