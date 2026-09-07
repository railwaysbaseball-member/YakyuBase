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
