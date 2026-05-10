create policy "teachers_insert_students"
on public.students for insert
to authenticated
with check (true);

create policy "teachers_update_authorized_students"
on public.students for update
to authenticated
using (
  public.is_admin()
  or exists (
    select 1
    from public.enrollments e
    where e.student_id = students.id
      and public.can_access_class(e.class_id)
  )
)
with check (
  public.is_admin()
  or exists (
    select 1
    from public.enrollments e
    where e.student_id = students.id
      and public.can_access_class(e.class_id)
  )
);

create policy "teachers_insert_authorized_enrollments"
on public.enrollments for insert
to authenticated
with check (public.can_access_class(class_id));

create policy "teachers_update_authorized_enrollments"
on public.enrollments for update
to authenticated
using (public.can_access_class(class_id))
with check (public.can_access_class(class_id));
