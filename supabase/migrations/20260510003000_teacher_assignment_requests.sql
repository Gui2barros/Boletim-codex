create type public.assignment_request_status as enum ('pending', 'approved', 'rejected');

create table public.teacher_assignment_requests (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  class_subject_id uuid not null references public.class_subjects(id) on delete cascade,
  status public.assignment_request_status not null default 'pending',
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint teacher_assignment_requests_unique unique (teacher_id, class_subject_id)
);

alter table public.teacher_assignment_requests enable row level security;

create policy "classes_select_authenticated"
on public.classes for select
to authenticated
using (true);

create policy "class_subjects_select_authenticated"
on public.class_subjects for select
to authenticated
using (true);

create policy "assignment_requests_select_own_or_admin"
on public.teacher_assignment_requests for select
to authenticated
using (teacher_id = auth.uid() or public.is_admin());

create policy "assignment_requests_insert_own"
on public.teacher_assignment_requests for insert
to authenticated
with check (teacher_id = auth.uid() and status = 'pending');

create policy "assignment_requests_update_admin"
on public.teacher_assignment_requests for update
to authenticated
using (public.is_admin())
with check (public.is_admin());
