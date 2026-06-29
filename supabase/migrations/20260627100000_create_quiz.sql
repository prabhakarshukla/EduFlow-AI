-- Create quiz_attempts table
create table if not exists quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  topic text not null,
  score integer not null,
  total_questions integer not null,
  percentage numeric(5,2) not null,
  created_at timestamptz default now()
);

-- Create quiz_answers table
create table if not exists quiz_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid references quiz_attempts(id) on delete cascade,
  question text not null,
  user_answer text,
  correct_answer text,
  is_correct boolean not null,
  created_at timestamptz default now()
);

-- Enable Row Level Security (RLS)
alter table quiz_attempts enable row level security;
alter table quiz_answers enable row level security;

-- ==========================
-- quiz_attempts policies
-- ==========================

create policy "Users can view their own quiz attempts"
  on quiz_attempts
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert their own quiz attempts"
  on quiz_attempts
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update their own quiz attempts"
  on quiz_attempts
  for update
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can delete their own quiz attempts"
  on quiz_attempts
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- ==========================
-- quiz_answers policies
-- ==========================

create policy "Users can view their own quiz answers"
  on quiz_answers
  for select
  to authenticated
  using (
    exists (
      select 1
      from quiz_attempts
      where quiz_attempts.id = quiz_answers.attempt_id
      and quiz_attempts.user_id = auth.uid()
    )
  );

create policy "Users can insert their own quiz answers"
  on quiz_answers
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from quiz_attempts
      where quiz_attempts.id = quiz_answers.attempt_id
      and quiz_attempts.user_id = auth.uid()
    )
  );

create policy "Users can update their own quiz answers"
  on quiz_answers
  for update
  to authenticated
  using (
    exists (
      select 1
      from quiz_attempts
      where quiz_attempts.id = quiz_answers.attempt_id
      and quiz_attempts.user_id = auth.uid()
    )
  );

create policy "Users can delete their own quiz answers"
  on quiz_answers
  for delete
  to authenticated
  using (
    exists (
      select 1
      from quiz_attempts
      where quiz_attempts.id = quiz_answers.attempt_id
      and quiz_attempts.user_id = auth.uid()
    )
  );S