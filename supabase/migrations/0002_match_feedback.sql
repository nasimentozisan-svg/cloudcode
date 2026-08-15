-- 試合フィードバック機能: match_folders / match_videos

create type team_category as enum ('top', 'u18');

create table match_folders (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  team_category team_category not null,
  opponent text not null,
  created_at timestamptz not null default now()
);

create table match_videos (
  id uuid primary key default gen_random_uuid(),
  match_folder_id uuid not null references match_folders(id) on delete cascade,
  r2_key text not null,
  sort_order integer not null,
  created_at timestamptz not null default now()
);

create index match_videos_folder_idx on match_videos (match_folder_id, sort_order);

alter table match_folders enable row level security;
alter table match_videos enable row level security;

-- コーチは自分のチームのフォルダ・動画を管理可能
create policy "coach can manage own team match folders" on match_folders
  for all using (
    exists (
      select 1 from teams
      where teams.id = match_folders.team_id
      and teams.owner_user_id = auth.uid()
    )
  );

create policy "coach can manage own team match videos" on match_videos
  for all using (
    exists (
      select 1 from match_folders
      join teams on teams.id = match_folders.team_id
      where match_folders.id = match_videos.match_folder_id
      and teams.owner_user_id = auth.uid()
    )
  );

-- 選手（匿名）は閲覧のみ
create policy "anon can select match folders" on match_folders
  for select to anon using (true);

create policy "anon can select match videos" on match_videos
  for select to anon using (true);
