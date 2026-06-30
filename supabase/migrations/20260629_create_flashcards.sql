create table if not exists flashcards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,

  question text not null,
  answer text not null,

  ease_factor decimal default 2.5,
  repetitions integer default 0,
  interval_days integer default 1,

  next_review timestamptz default now(),

  created_at timestamptz default now()
);

alter table flashcards enable row level security;

create policy "Users can view their own flashcards"
on flashcards for select
using (auth.uid() = user_id);

create policy "Users can create their own flashcards"
on flashcards for insert
with check (auth.uid() = user_id);

create policy "Users can update their own flashcards"
on flashcards for update
using (auth.uid() = user_id);

create policy "Users can delete their own flashcards"
on flashcards for delete
using (auth.uid() = user_id);

create index if not exists idx_flashcards_user_id
on flashcards(user_id);