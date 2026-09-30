alter table students add column father_name text;
alter table students add column mother_name text;
alter table students add column category text;
alter table students add column pincode text;
alter table students add column email_verified boolean not null default false;

create table student_documents (
  id serial primary key,
  student_id integer not null references students(id),
  category text not null,
  title text not null,
  file_name text not null,
  mime_type text not null,
  file_data bytea not null,
  status text not null default 'verified',
  uploaded_at timestamptz not null default now()
);
create index student_documents_student_idx on student_documents(student_id);

create table profile_edit_requests (
  id serial primary key,
  student_id integer not null references students(id),
  payload jsonb not null,
  document_ids integer[] not null default '{}',
  status text not null default 'pending',
  submitted_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by integer,
  remarks text
);
create index profile_edit_requests_student_idx on profile_edit_requests(student_id);

create table password_change_log (
  id serial primary key,
  user_id integer not null references users(id),
  changed_at timestamptz not null default now(),
  note text
);
create index password_change_log_user_idx on password_change_log(user_id);

create table leave_applications (
  id serial primary key,
  applicant_user_id integer not null references users(id),
  applicant_role text not null,
  leave_type text not null,
  from_date text not null,
  to_date text not null,
  reason text not null,
  status text not null default 'pending',
  applied_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by integer,
  remarks text
);
create index leave_applications_user_idx on leave_applications(applicant_user_id);

create table exam_form_windows (
  id serial primary key,
  name text not null,
  semester integer not null,
  opens_at text not null,
  closes_at text not null,
  published boolean not null default true
);

create table exam_form_submissions (
  id serial primary key,
  window_id integer not null references exam_form_windows(id),
  student_id integer not null references students(id),
  submitted_at timestamptz not null default now(),
  course_ids jsonb not null
);
create unique index exam_form_submissions_unique_idx on exam_form_submissions(window_id, student_id);

create table exam_review_applications (
  id serial primary key,
  student_id integer not null references students(id),
  exam_id integer not null references exams(id),
  course_id integer not null references courses(id),
  kind text not null,
  fee_amount double precision not null,
  status text not null default 'submitted',
  applied_at timestamptz not null default now(),
  decided_at timestamptz,
  remarks text,
  parent_application_id integer references exam_review_applications(id)
);
create index exam_review_applications_student_idx on exam_review_applications(student_id);

-- Grant the new permissions to the default roles that should already have
-- them. Safe to re-run: skips any (role, permission) pair that already
-- exists.
insert into role_permissions (role_id, permission_key)
select r.id, p.key
from roles r
cross join (values
  ('student', 'profile.update.request'),
  ('student', 'documents.locker.manage'),
  ('student', 'leave.apply'),
  ('student', 'exam.form.fill'),
  ('student', 'exam.review.apply'),
  ('faculty', 'leave.manage'),
  ('hod', 'leave.manage'),
  ('hr_officer', 'leave.manage'),
  ('admission_officer', 'profile.update.review'),
  ('examination_officer', 'exam.form.manage'),
  ('examination_officer', 'exam.review.manage'),
  ('administrator', 'profile.update.request'),
  ('administrator', 'profile.update.review'),
  ('administrator', 'documents.locker.manage'),
  ('administrator', 'leave.apply'),
  ('administrator', 'leave.manage'),
  ('administrator', 'exam.form.fill'),
  ('administrator', 'exam.form.manage'),
  ('administrator', 'exam.review.apply'),
  ('administrator', 'exam.review.manage')
) as p(role_key, key)
where r.key = p.role_key
on conflict (role_id, permission_key) do nothing;
