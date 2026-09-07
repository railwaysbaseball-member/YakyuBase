# Railsways → Next.js / Supabase  
移行プロジェクト 引き継ぎ資料（完全版）

---

## 1. プロジェクト概要

Railsways の以下の機能を Next.js + Supabase で完全再現する：

- 打席結果管理（plate_results）
- 打撃成績集計（AVG / OBP / SLG / OPS / 得点圏 / RC27）
- 投手成績集計（ERA / WHIP / 奪三振率 / QS率）
- 守備成績集計（刺殺 / 補殺 / 失策 / 美技 / 珍技）
- サポート成績（参加・采配・控え・スコア・審判・撮影・見学・応援）
- 年度別パラメータ管理（POINT計算）
- 試合情報管理（games）
- 道具管理（team_tools）
- スケジュール管理（team_schedule）
- 出欠管理（schedule_attendance）

Railsways の個人成績ページを Next.js で完全再現することが最終ゴール。

---

## 2. Supabase テーブル構造（既存＋追加）

### 2-1. 既存テーブル（正）

#### players

```sql
create table public.players (
  id text not null default gen_random_uuid (),
  name text not null,
  number integer null,
  position text null,
  created_at timestamp with time zone null default now(),
  constraint players_pkey primary key (id)
);
```

#### games

```sql
create table public.games (
  id text not null default gen_random_uuid (),
  date date not null,
  start_time time without time zone null,
  end_time time without time zone null,
  league text null,
  stadium text null,
  description text null,
  created_at timestamp with time zone null default now(),
  opponent text null,
  scoreboard jsonb null,
  constraint games_pkey primary key (id)
);
```

#### game_pitching_stats

```sql
create table public.game_pitching_stats (
  id uuid not null default gen_random_uuid (),
  game_id text null,
  player_id text null,
  innings numeric null,
  er integer null,
  runs integer null,
  batters_faced integer null,
  strikeouts integer null,
  walks integer null,
  hbp integer null,
  hits_allowed integer null,
  hr_allowed integer null,
  pitches integer null,
  wp integer null,
  balk integer null,
  decision text null,
  created_at timestamp with time zone null default now(),
  constraint game_pitching_stats_pkey primary key (id),
  constraint game_pitching_stats_game_id_fkey foreign KEY (game_id) references games (id),
  constraint game_pitching_stats_player_id_fkey foreign KEY (player_id) references players (id)
);
```

#### game_batting_stats

```sql
create table public.game_batting_stats (
  id uuid not null default gen_random_uuid (),
  game_id text null,
  player_id text null,
  order_no integer null,
  position text null,
  plate_results jsonb null,
  plate_appearances integer null,
  at_bats integer null,
  hits integer null,
  runs integer null,
  rbi integer null,
  steals integer null,
  created_at timestamp with time zone null default now(),
  constraint game_batting_stats_pkey primary key (id),
  constraint game_batting_stats_game_id_fkey foreign KEY (game_id) references games (id),
  constraint game_batting_stats_player_id_fkey foreign KEY (player_id) references players (id)
);
```

---

### 2-2. 追加テーブル（既存構造に完全準拠）

#### game_fielding_stats

```sql
create table public.game_fielding_stats (
  id text not null default gen_random_uuid (),
  game_id text not null references public.games(id),
  player_id text not null references public.players(id),
  putout integer null default 0,
  assist integer null default 0,
  error integer null default 0,
  beauty integer null default 0,
  rare_play integer null default 0,
  created_at timestamptz null default now(),
  constraint game_fielding_stats_pkey primary key (id)
);
```

#### season_parameters

```sql
create table public.season_parameters (
  id text not null default gen_random_uuid (),
  season integer not null,
  games integer null,
  qs numeric null,
  batter_point numeric null,
  pitcher_point numeric null,
  inning_count integer null,
  required_pa integer null,
  required_ip numeric null,
  earned_runs integer null,
  strike_escape integer null,
  opponent_error integer null,
  interference integer null,
  fielder_choice integer null,
  walk integer null,
  hbp integer null,
  sac_bunt integer null,
  sac_fly integer null,
  infield_hit integer null,
  single integer null,
  double integer null,
  triple integer null,
  homerun integer null,
  steal integer null,
  run integer null,
  rbi integer null,
  plate_appearance integer null,
  advancing_hit integer null,
  picked_off integer null,
  caught_stealing integer null,
  beauty integer null,
  rare_play integer null,
  putout integer null,
  assist integer null,
  error integer null,
  win integer null,
  out integer null,
  strikeout integer null,
  walk_allowed integer null,
  hbp_allowed integer null,
  earned_run_allowed integer null,
  created_at timestamptz null default now(),
  constraint season_parameters_pkey primary key (id)
);
```

#### team_tools

```sql
create table public.team_tools (
  id text not null default gen_random_uuid (),
  tool_name text not null,
  description text null,
  image_url text null,
  owner_player_id text null references public.players(id),
  created_at timestamptz null default now(),
  constraint team_tools_pkey primary key (id)
);
```

#### team_schedule

```sql
create table public.team_schedule (
  id text not null default gen_random_uuid (),
  date date not null,
  start_time time null,
  end_time time null,
  title text not null,
  opponent text null,
  place text null,
  status text null,
  deadline date null,
  umpire text null,
  created_at timestamptz null default now(),
  constraint team_schedule_pkey primary key (id)
);
```

#### schedule_attendance

```sql
create table public.schedule_attendance (
  id text not null default gen_random_uuid (),
  schedule_id text not null references public.team_schedule(id),
  player_id text not null references public.players(id),
  attendance text null check (attendance in ('出席','欠席','未定')),
  created_at timestamptz null default now(),
  constraint schedule_attendance_pkey primary key (id)
);
```

#### support_stats

```sql
create table public.support_stats (
  id text not null default gen_random_uuid (),
  game_id text not null references public.games(id),
  player_id text not null references public.players(id),
  participate integer null default 0,
  manage integer null default 0,
  bench integer null default 0,
  score integer null default 0,
  umpire integer null default 0,
  camera integer null default 0,
  watch integer null default 0,
  cheer integer null default 0,
  created_at timestamptz null default now(),
  constraint support_stats_pkey primary key (id)
);
```

---

## 3. Next.js 型定義（src/types）

### plateResult.ts

```ts
export type PlateResult = {
  inning: number;
  inning_half: "表" | "裏";

  result: string;
  run: boolean;
  steal: number;
  out: boolean;
  rbi: number;

  pitcher_hand: "右" | "左" | "不明";
  direction: string;
  contact_type: "ゴロ" | "フライ" | "ライナー" | "不明";

  runners_on: number[];
  advancing_hit: boolean;
  winning_rbi: boolean;

  caught_stealing: boolean;
  picked_off: boolean;
  fielding_error: boolean;
  double_play: boolean;
  sacrifice: boolean;
  bunt: boolean;
  pinch_hitter: boolean;
  pinch_runner: boolean;

  pitch_count: number;
  pitch_result: string;

  score_before: number;
  score_after: number;
};
```

### batting.ts

```ts
import type { PlateResult } from "./plateResult";

export type BattingStats = {
  id: string;
  game_id: string;
  player_id: string;

  order_no: number | null;
  position: string | null;

  plate_results: PlateResult[];

  plate_appearances: number;
  at_bats: number;
  hits: number;
  runs: number;
  rbi: number;
  steals: number;

  created_at: string;
};
```

### pitching.ts

```ts
export type PitchingStats = {
  id: string;
  game_id: string;
  player_id: string;

  innings: number | null;
  er: number | null;
  runs: number | null;
  batters_faced: number | null;
  strikeouts: number | null;
  walks: number | null;
  hbp: number | null;
  hits_allowed: number | null;
  hr_allowed: number | null;
  pitches: number | null;
  wp: number | null;
  balk: number | null;
  decision: string | null;

  created_at: string;
};
```

### fielding.ts

```ts
export type FieldingStats = {
  id: string;
  game_id: string;
  player_id: string;

  putout: number;
  assist: number;
  error: number;
  beauty: number;
  rare_play: number;

  created_at: string;
};
```

### schedule.ts

```ts
export type TeamSchedule = {
  id: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  title: string;
  opponent: string | null;
  place: string | null;
  status: string | null;
  deadline: string | null;
  umpire: string | null;
  created_at: string;
};

export type Attendance = {
  id: string;
  schedule_id: string;
  player_id: string;
  attendance: "出席" | "欠席" | "未定";
  created_at: string;
};
```

### tools.ts

```ts
export type TeamTool = {
  id: string;
  tool_name: string;
  description: string | null;
  image_url: string | null;
  owner_player_id: string | null;
  created_at: string;
};
```

---

## 4. 打撃成績集計ロジック（TS）

```ts
import type { PlateResult } from "@/types/plateResult";

export type CalculatedBatting = {
  pa: number;
  ab: number;
  hits: number;
  singles: number;
  doubles: number;
  triples: number;
  homeruns: number;

  runs: number;
  rbi: number;
  steals: number;
  strikeouts: number;
  walks: number;
  hbp: number;
  sac: number;
  advancing_hits: number;

  avg: number;
  obp: number;
  slg: number;
  ops: number;

  risp_ab: number;
  risp_hits: number;
  risp_avg: number;

  rc27: number;
};

export function calcBatting(results: PlateResult[]): CalculatedBatting {
  let pa = results.length;
  let ab = 0;
  let hits = 0;
  let singles = 0;
  let doubles = 0;
  let triples = 0;
  let homeruns = 0;

  let runs = 0;
  let rbi = 0;
  let steals = 0;
  let strikeouts = 0;
  let walks = 0;
  let hbp = 0;
  let sac = 0;
  let advancing_hits = 0;

  let risp_ab = 0;
  let risp_hits = 0;

  for (const pr of results) {
    if (pr.run) runs++;
    rbi += pr.rbi;
    steals += pr.steal;
    if (pr.advancing_hit) advancing_hits++;

    const risp = pr.runners_on.includes(2) || pr.runners_on.includes(3);
    const res = pr.result;

    if (res.includes("四球")) {
      walks++;
      if (risp) risp_ab++;
      continue;
    }
    if (res.includes("死球")) {
      hbp++;
      if (risp) risp_ab++;
      continue;
    }
    if (res.includes("犠打") || res.includes("犠飛")) {
      sac++;
      continue;
    }
    if (res.includes("三振")) {
      strikeouts++;
      ab++;
      if (risp) risp_ab++;
      continue;
    }

    if (res.includes("安")) {
      hits++;
      ab++;

      if (res.includes("左安") || res.includes("中安") || res.includes("右安") || res.includes("内野安")) {
        singles++;
      }
      if (res.includes("二")) doubles++;
      if (res.includes("三")) triples++;
      if (res.includes("本")) homeruns++;

      if (risp) {
        risp_ab++;
        risp_hits++;
      }

      continue;
    }

    ab++;
    if (risp) risp_ab++;
  }

  const avg = ab > 0 ? hits / ab : 0;
  const obp = (hits + walks + hbp) / (ab + walks + hbp + sac || 1);
  const slg = (singles + doubles * 2 + triples * 3 + homeruns * 4) / (ab || 1);
  const ops = obp + slg;
  const risp_avg = risp_ab > 0 ? risp_hits / risp_ab : 0;
  const rc = (hits + walks) * (singles + doubles * 2 + triples * 3 + homeruns) / (ab + walks || 1);
  const rc27 = rc * 27 / (ab || 1);

  return {
    pa,
    ab,
    hits,
    singles,
    doubles,
    triples,
    homeruns,
    runs,
    rbi,
    steals,
    strikeouts,
    walks,
    hbp,
    sac,
    advancing_hits,
    avg,
    obp,
    slg,
    ops,
    risp_ab,
    risp_hits,
    risp_avg,
    rc27,
  };
}
```

---

## 5. 実装ロードマップ

1. 型定義（完了）
2. Supabase DDL（完了）
3. 打撃成績集計ロジック（完了）
4. 投手成績集計ロジック
5. 守備成績集計ロジック
6. 個人成績ページ（Railsways の UI を再現）
7. スケジュール管理 UI
8. 道具管理 UI

---

# END
