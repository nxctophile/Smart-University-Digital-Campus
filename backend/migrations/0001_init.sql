-- Canonical Campus Data Model (Postgres). Mirrors the original Drizzle/SQLite
-- schema at lib/db/schema.ts in the Next.js app, table for table.

create table universities (
  id serial primary key,
  name text not null,
  code text not null,
  city text not null,
  state text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table departments (
  id serial primary key,
  university_id integer not null references universities(id),
  name text not null,
  code text not null,
  head_of_dept_faculty_id integer
);

create table programmes (
  id serial primary key,
  department_id integer not null references departments(id),
  name text not null,
  code text not null,
  degree_level text not null,
  duration_semesters integer not null
);

create table courses (
  id serial primary key,
  programme_id integer not null references programmes(id),
  code text not null,
  name text not null,
  credits integer not null,
  semester integer not null
);

create table faculty (
  id serial primary key,
  university_id integer not null references universities(id),
  department_id integer not null references departments(id),
  employee_id text not null,
  first_name text not null,
  last_name text not null,
  email text not null,
  phone text not null,
  designation text not null,
  source_system text,
  source_table text,
  source_id text,
  last_synced_at text
);

create table sections (
  id serial primary key,
  course_id integer not null references courses(id),
  faculty_id integer references faculty(id),
  name text not null,
  academic_year text not null
);

create table students (
  id serial primary key,
  university_id integer not null references universities(id),
  department_id integer not null references departments(id),
  programme_id integer not null references programmes(id),
  roll_number text not null,
  first_name text not null,
  last_name text not null,
  email text not null,
  phone text not null,
  dob text not null,
  gender text not null,
  admission_year integer not null,
  current_semester integer not null,
  status text not null default 'active',
  address text,
  guardian_name text,
  guardian_phone text,
  avatar_color text,
  source_system text,
  source_table text,
  source_id text,
  last_synced_at text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index students_roll_number_idx on students(roll_number);
create index students_department_idx on students(department_id);

create table parents (
  id serial primary key,
  student_id integer not null references students(id),
  first_name text not null,
  last_name text not null,
  email text not null,
  phone text not null,
  relation text not null
);

create table employees (
  id serial primary key,
  university_id integer not null references universities(id),
  department_id integer not null references departments(id),
  employee_code text not null,
  first_name text not null,
  last_name text not null,
  email text not null,
  phone text not null,
  designation text not null
);

create table users (
  id serial primary key,
  name text not null,
  email text not null,
  role text not null,
  student_id integer references students(id),
  faculty_id integer references faculty(id),
  parent_id integer references parents(id),
  employee_id integer references employees(id)
);

create table roles (
  id serial primary key,
  key text not null,
  name text not null,
  description text,
  category text not null,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index roles_key_idx on roles(key);

create table role_permissions (
  id serial primary key,
  role_id integer not null references roles(id) on delete cascade,
  permission_key text not null
);
create unique index role_permissions_unique_idx on role_permissions(role_id, permission_key);

create table user_roles (
  id serial primary key,
  user_id integer not null references users(id) on delete cascade,
  role_id integer not null references roles(id) on delete cascade,
  scope text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index user_roles_user_idx on user_roles(user_id);

create table audit_logs (
  id serial primary key,
  user_id integer,
  user_name text not null,
  user_role text not null,
  action text not null,
  resource text,
  result text not null,
  metadata text,
  created_at timestamptz not null default now()
);
create index audit_logs_created_idx on audit_logs(created_at);
create index audit_logs_user_idx on audit_logs(user_id);

create table legacy_role_mappings (
  id serial primary key,
  legacy_role text not null,
  mapped_role_key text not null,
  notes text
);
create unique index legacy_role_mappings_legacy_idx on legacy_role_mappings(legacy_role);

create table attendance (
  id serial primary key,
  student_id integer not null references students(id),
  course_id integer not null references courses(id),
  date text not null,
  status text not null,
  marked_by text,
  source_system text,
  source_table text,
  source_id text,
  last_synced_at text
);
create index attendance_student_idx on attendance(student_id);
create index attendance_course_idx on attendance(course_id);

create table timetable_slots (
  id serial primary key,
  section_id integer not null references sections(id),
  course_id integer not null references courses(id),
  faculty_id integer references faculty(id),
  day_of_week integer not null,
  start_time text not null,
  end_time text not null,
  room text not null,
  programme_id integer not null references programmes(id),
  semester integer not null
);

create table exams (
  id serial primary key,
  course_id integer not null references courses(id),
  programme_id integer not null references programmes(id),
  name text not null,
  exam_type text not null,
  date text not null,
  start_time text not null,
  duration_minutes integer not null,
  max_marks integer not null,
  semester integer not null
);

create table exam_results (
  id serial primary key,
  exam_id integer not null references exams(id),
  student_id integer not null references students(id),
  marks_obtained double precision not null,
  graded boolean not null default true
);
create index exam_results_student_idx on exam_results(student_id);

create table fees (
  id serial primary key,
  student_id integer not null references students(id),
  academic_year text not null,
  semester integer not null,
  fee_type text not null,
  amount double precision not null,
  amount_paid double precision not null default 0,
  due_date text not null,
  status text not null,
  source_system text,
  source_table text,
  source_id text,
  last_synced_at text
);
create index fees_student_idx on fees(student_id);

create table payments (
  id serial primary key,
  fee_id integer not null references fees(id),
  student_id integer not null references students(id),
  amount double precision not null,
  method text not null,
  transaction_ref text not null,
  status text not null default 'paid',
  razorpay_order_id text,
  razorpay_payment_id text,
  razorpay_signature text,
  paid_at text not null
);

create table documents (
  id serial primary key,
  student_id integer not null references students(id),
  type text not null,
  title text not null,
  issued_at text not null,
  status text not null default 'available'
);

create table certificates (
  id serial primary key,
  student_id integer not null references students(id),
  type text not null,
  status text not null default 'requested',
  requested_at text not null,
  issued_at text,
  verification_code text,
  purpose text,
  requested_via text default 'web'
);

create table hostels (
  id serial primary key,
  university_id integer not null references universities(id),
  name text not null,
  block text not null,
  warden text not null
);

create table rooms (
  id serial primary key,
  hostel_id integer not null references hostels(id),
  room_number text not null,
  capacity integer not null
);

create table room_assignments (
  id serial primary key,
  room_id integer not null references rooms(id),
  student_id integer not null references students(id),
  assigned_at text not null,
  status text not null default 'active'
);

create table transport_routes (
  id serial primary key,
  university_id integer not null references universities(id),
  name text not null,
  code text not null,
  vehicle_number text not null,
  driver_name text not null,
  capacity integer not null
);

create table transport_stops (
  id serial primary key,
  route_id integer not null references transport_routes(id),
  name text not null,
  sequence integer not null,
  arrival_time text not null
);

create table transport_assignments (
  id serial primary key,
  student_id integer not null references students(id),
  route_id integer not null references transport_routes(id),
  stop_id integer not null references transport_stops(id)
);

create table helpdesk_tickets (
  id serial primary key,
  ticket_number text not null,
  student_id integer references students(id),
  category text not null,
  subject text not null,
  description text not null,
  status text not null default 'open',
  priority text not null default 'medium',
  created_via text not null default 'web',
  assigned_to text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index helpdesk_student_idx on helpdesk_tickets(student_id);

create table ticket_messages (
  id serial primary key,
  ticket_id integer not null references helpdesk_tickets(id),
  sender text not null,
  message text not null,
  created_at timestamptz not null default now()
);

create table notifications (
  id serial primary key,
  university_id integer not null references universities(id),
  audience_role text,
  student_id integer references students(id),
  title text not null,
  message text not null,
  category text not null,
  created_at timestamptz not null default now(),
  read_at text
);

create table books (
  id serial primary key,
  isbn text not null,
  title text not null,
  author text not null,
  category text not null,
  publisher text,
  total_copies integer not null,
  available_copies integer not null,
  shelf_location text
);

create table book_loans (
  id serial primary key,
  book_id integer not null references books(id),
  student_id integer not null references students(id),
  borrowed_at text not null,
  due_at text not null,
  returned_at text,
  status text not null default 'active',
  fine_amount double precision not null default 0,
  fine_paid boolean not null default false
);
create index book_loans_student_idx on book_loans(student_id);

create table scholarships (
  id serial primary key,
  name text not null,
  provider text not null,
  amount double precision not null,
  eligibility text not null,
  min_attendance double precision,
  max_family_income double precision,
  department_code text,
  deadline text not null,
  seats_available integer not null
);

create table scholarship_applications (
  id serial primary key,
  scholarship_id integer not null references scholarships(id),
  student_id integer not null references students(id),
  status text not null default 'submitted',
  applied_at text not null,
  decided_at text,
  remarks text,
  documents_submitted boolean not null default true
);
create index scholarship_applications_student_idx on scholarship_applications(student_id);

create table import_jobs (
  id serial primary key,
  file_name text not null,
  source_format text not null,
  target_entity text not null,
  status text not null default 'mapped',
  column_mapping text not null,
  row_count integer not null default 0,
  imported_count integer not null default 0,
  created_at timestamptz not null default now()
);
