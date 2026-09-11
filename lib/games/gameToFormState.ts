import type { PlateResult } from "@/types/plateResult";
import type { BatterDraft, GameFormPayload, PitcherDraft, PlateResultDraft } from "@/lib/games/buildGameRows";

type GameRow = {
  date: string;
  start_time: string | null;
  end_time: string | null;
  league: string | null;
  stadium: string | null;
  opponent: string;
  scoreboard: {
    innings: { team: (number | null)[]; opponent: (number | null)[] };
  };
};

type BattingStatsRow = {
  player_id: string;
  order_no: number | null;
  position: string | null;
  plate_results: PlateResult[] | null;
};

type PitchingStatsRow = {
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
  is_starter: boolean;
};

export type GameFormInitialData = Omit<GameFormPayload, never>;

function cellToStr(v: number | null): string {
  return v === null ? "" : String(v);
}

function plateResultToDraft(pr: PlateResult): PlateResultDraft {
  return {
    inning: String(pr.inning),
    result: pr.result,
    run: !!pr.run,
    rbi: String(pr.rbi ?? 0),
    steal: String(pr.steal ?? 0),
    risp: !!pr.risp,
    advancingHit: !!pr.advancing_hit,
    caughtStealing: !!pr.caught_stealing,
    pickedOff: !!pr.picked_off,
    doublePlay: !!pr.double_play,
  };
}

function splitInnings(innings: number | null): { inningsWhole: string; inningsOuts: string } {
  const n = innings ?? 0;
  const whole = Math.trunc(n);
  const outs = Math.round((n - whole) * 10);
  return { inningsWhole: String(whole), inningsOuts: String(outs) };
}

export function gameToFormState(
  game: GameRow,
  battingRows: BattingStatsRow[],
  pitchingRows: PitchingStatsRow[]
): GameFormInitialData {
  const batters: BatterDraft[] = [...battingRows]
    .sort((a, b) => (a.order_no ?? 0) - (b.order_no ?? 0))
    .map((b) => ({
      player: { mode: "existing", playerId: b.player_id, newName: "" },
      orderNo: b.order_no != null ? String(b.order_no) : "",
      position: b.position ?? "",
      plateResults: (b.plate_results ?? []).map(plateResultToDraft),
    }));

  const pitchers: PitcherDraft[] = pitchingRows.map((p) => ({
    player: { mode: "existing", playerId: p.player_id, newName: "" },
    isStarter: p.is_starter,
    ...splitInnings(p.innings),
    er: String(p.er ?? 0),
    runs: String(p.runs ?? 0),
    battersFaced: String(p.batters_faced ?? 0),
    strikeouts: String(p.strikeouts ?? 0),
    walks: String(p.walks ?? 0),
    hbp: String(p.hbp ?? 0),
    hitsAllowed: String(p.hits_allowed ?? 0),
    hrAllowed: String(p.hr_allowed ?? 0),
    pitches: String(p.pitches ?? 0),
    wp: String(p.wp ?? 0),
    balk: String(p.balk ?? 0),
    decision: (p.decision ?? "") as PitcherDraft["decision"],
  }));

  return {
    date: game.date,
    startTime: game.start_time ? game.start_time.slice(0, 5) : "",
    endTime: game.end_time ? game.end_time.slice(0, 5) : "",
    league: game.league ?? "",
    stadium: game.stadium ?? "",
    opponent: game.opponent,
    inningsTeam: game.scoreboard.innings.team.map(cellToStr),
    inningsOpponent: game.scoreboard.innings.opponent.map(cellToStr),
    batters,
    pitchers,
  };
}
