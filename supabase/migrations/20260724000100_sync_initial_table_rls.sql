-- Enable Row Level Security (RLS) on initial schema tables

alter table profiles enable row level security;
alter table study_tasks enable row level security;
alter table notes enable row level security;
alter table mood_entries enable row level security;
alter table productivity_sessions enable row level security;
alter table streaks enable row level security;

-- ==========================
-- profiles policies
-- ==========================

create policy "Users can view their own profiles"
  on profiles
  for select
  to authenticated
  using (auth.uid() = id);

create policy "Users can insert their own profiles"
  on profiles
  for insert
  to authenticated
  with check (auth.uid() = id);

create policy "Users can update their own profiles"
  on profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Users can delete their own profiles"
  on profiles
  for delete
  to authenticated
  using (auth.uid() = id);

-- ==========================
-- study_tasks policies
-- ==========================

create policy "Users can view their own study tasks"
  on study_tasks
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert their own study tasks"
  on study_tasks
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update their own study tasks"
  on study_tasks
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own study tasks"
  on study_tasks
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- ==========================
-- notes policies
-- ==========================

create policy "Users can view their own notes"
  on notes
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert their own notes"
  on notes
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update their own notes"
  on notes
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own notes"
  on notes
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- ==========================
-- mood_entries policies
-- ==========================

create policy "Users can view their own mood entries"
  on mood_entries
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert their own mood entries"
  on mood_entries
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update their own mood entries"
  on mood_entries
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own mood entries"
  on mood_entries
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- ==========================
-- productivity_sessions policies
-- ==========================

create policy "Users can view their own productivity sessions"
  on productivity_sessions
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert their own productivity sessions"
  on productivity_sessions
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update their own productivity sessions"
  on productivity_sessions
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own productivity sessions"
  on productivity_sessions
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- ==========================
-- streaks policies
-- ==========================

create policy "Users can view their own streaks"
  on streaks
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert their own streaks"
  on streaks
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update their own streaks"
  on streaks
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own streaks"
  on streaks
  for delete
  to authenticated
  using (auth.uid() = user_id);
