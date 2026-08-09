-- efktac 戦術動画共有アプリ 初期スキーマ

create extension if not exists "pgcrypto";

create type video_category as enum (
  'attack',
  'attack_to_defense',
  'defense',
  'defense_to_attack',
  'special'
);

create type video_status as enum ('uploading', 'ready');

create table teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table videos (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  title text not null,
  description text,
  category video_category not null,
  r2_key text not null,
  duration_sec integer,
  status video_status not null default 'uploading',
  created_at timestamptz not null default now()
);

create index videos_team_category_idx on videos (team_id, category);

create table view_logs (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references videos(id) on delete cascade,
  viewer_name text not null,
  viewed_at timestamptz not null default now()
);

create index view_logs_video_idx on view_logs (video_id);

alter table teams enable row level security;
alter table videos enable row level security;
alter table view_logs enable row level security;

-- コーチ（Authユーザー）は自分のチームのみ参照・更新可能
create policy "coach can select own team" on teams
  for select using (auth.uid() = owner_user_id);

create policy "coach can insert own team" on teams
  for insert with check (auth.uid() = owner_user_id);

create policy "coach can update own team" on teams
  for update using (auth.uid() = owner_user_id);

-- 選手側は匿名keyでチーム情報の読み取りのみ可能（招待コード照合はアプリ側で実施）
create policy "anon can select teams for invite lookup" on teams
  for select to anon using (true);

-- コーチは自分のチームの動画を追加・更新できる
create policy "coach can manage own team videos" on videos
  for all using (
    exists (
      select 1 from teams
      where teams.id = videos.team_id
      and teams.owner_user_id = auth.uid()
    )
  );

-- 選手（匿名）は ready な動画のみ閲覧可能
create policy "anon can select ready videos" on videos
  for select to anon using (status = 'ready');

-- 視聴ログは匿名でも追加可能、閲覧はコーチのみ
create policy "anon can insert view logs" on view_logs
  for insert to anon with check (true);

create policy "coach can select view logs of own team" on view_logs
  for select using (
    exists (
      select 1 from videos
      join teams on teams.id = videos.team_id
      where videos.id = view_logs.video_id
      and teams.owner_user_id = auth.uid()
    )
  );
