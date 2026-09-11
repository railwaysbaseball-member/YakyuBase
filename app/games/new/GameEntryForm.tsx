"use client";

import { useActionState, useState } from "react";

import { createGame } from "@/lib/games/createGame";
import { updateGame } from "@/lib/games/updateGame";
import type {
  BatterDraft,
  PitcherDraft,
  PlateResultDraft,
  PlayerRef,
} from "@/lib/games/buildGameRows";
import type { GameFormInitialData } from "@/lib/games/gameToFormState";
import { POSITION_OPTIONS, PLATE_RESULT_OPTIONS } from "@/lib/games/plateResultVocabulary";
import PlayerPicker from "./PlayerPicker";
import PlateResultRow from "./PlateResultRow";

type PlayerOption = { id: string; name: string; number: number | null };

type BatterState = BatterDraft & { key: string };
type PitcherState = PitcherDraft & { key: string };

const inputClass =
  "rounded-md border border-border-subtle bg-transparent px-3 py-2 text-sm outline-none focus:border-team-red";
const smallInputClass =
  "rounded-md border border-border-subtle bg-transparent px-2 py-1 text-sm outline-none focus:border-team-red";
const primaryButtonClass =
  "rounded-md bg-team-red px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-team-red-bright disabled:opacity-50";
const secondaryButtonClass =
  "rounded-md border border-border-subtle px-3 py-1.5 text-sm font-medium text-foreground/70 hover:bg-surface-muted";

let keySeq = 0;
function nextKey(): string {
  keySeq += 1;
  return `k${keySeq}`;
}

function emptyPlayerRef(): PlayerRef {
  return { mode: "existing", playerId: "", newName: "" };
}

function emptyPlateResult(): PlateResultDraft {
  return {
    inning: "",
    result: "",
    run: false,
    rbi: "0",
    steal: "0",
    risp: false,
    advancingHit: false,
    caughtStealing: false,
    pickedOff: false,
    doublePlay: false,
  };
}

function emptyBatter(orderNo: number): BatterState {
  return {
    key: nextKey(),
    player: emptyPlayerRef(),
    orderNo: String(orderNo),
    position: "",
    plateResults: [emptyPlateResult()],
  };
}

function emptyPitcher(isStarter: boolean): PitcherState {
  return {
    key: nextKey(),
    player: emptyPlayerRef(),
    isStarter,
    inningsWhole: "0",
    inningsOuts: "0",
    er: "0",
    runs: "0",
    battersFaced: "0",
    strikeouts: "0",
    walks: "0",
    hbp: "0",
    hitsAllowed: "0",
    hrAllowed: "0",
    pitches: "0",
    wp: "0",
    balk: "0",
    decision: "",
  };
}

function todayStr(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export default function GameEntryForm({
  players,
  opponentOptions,
  stadiumOptions,
  mode = "create",
  gameId,
  initialData,
}: {
  players: PlayerOption[];
  opponentOptions: string[];
  stadiumOptions: string[];
  mode?: "create" | "edit";
  gameId?: string;
  initialData?: GameFormInitialData;
}) {
  const boundAction = mode === "edit" ? updateGame.bind(null, gameId!) : createGame;
  const [state, action, pending] = useActionState(boundAction, undefined);

  const [date, setDate] = useState(initialData?.date ?? todayStr());
  const [startTime, setStartTime] = useState(initialData?.startTime ?? "");
  const [endTime, setEndTime] = useState(initialData?.endTime ?? "");
  const [league, setLeague] = useState(initialData?.league ?? "");
  const [stadium, setStadium] = useState(initialData?.stadium ?? "");
  const [opponent, setOpponent] = useState(initialData?.opponent ?? "");
  const [inningsTeam, setInningsTeam] = useState<string[]>(
    initialData?.inningsTeam ?? Array(7).fill("")
  );
  const [inningsOpponent, setInningsOpponent] = useState<string[]>(
    initialData?.inningsOpponent ?? Array(7).fill("")
  );
  // 自チームが先攻（表）か後攻（裏）かで、実際の得点経過（表→裏の順）に合わせて
  // 行の表示順を切り替える。scoreboard自体は team/opponent の名前付き配列のままなので
  // DB保存側の変更は不要（表示・入力しやすさのためだけの並び替え）。編集時にどちらが
  // 表だったかは保存していないため常に表からで表示する（見た目の初期並びだけの話）。
  const [teamBatsFirst, setTeamBatsFirst] = useState(true);
  const [batters, setBatters] = useState<BatterState[]>(
    initialData ? initialData.batters.map((b) => ({ ...b, key: nextKey() })) : [emptyBatter(1)]
  );
  const [pitchers, setPitchers] = useState<PitcherState[]>(
    initialData ? initialData.pitchers.map((p) => ({ ...p, key: nextKey() })) : [emptyPitcher(true)]
  );

  function setInningCount(n: number) {
    const count = Math.max(1, n);
    setInningsTeam((prev) => Array.from({ length: count }, (_, i) => prev[i] ?? ""));
    setInningsOpponent((prev) => Array.from({ length: count }, (_, i) => prev[i] ?? ""));
  }

  function updateBatter(key: string, patch: Partial<BatterState>) {
    setBatters((prev) => prev.map((b) => (b.key === key ? { ...b, ...patch } : b)));
  }

  function updatePitcher(key: string, patch: Partial<PitcherState>) {
    setPitchers((prev) =>
      prev.map((p) => {
        if (p.key !== key) return p;
        return { ...p, ...patch };
      })
    );
  }

  function setStarter(key: string) {
    setPitchers((prev) => prev.map((p) => ({ ...p, isStarter: p.key === key })));
  }

  const payload = {
    date,
    startTime,
    endTime,
    league,
    stadium,
    opponent,
    inningsTeam,
    inningsOpponent,
    // key はReactのリスト管理専用（サーバー側では無視される）なので剥がさず送ってよい
    batters,
    pitchers,
  };

  return (
    <form action={action} className="flex flex-col gap-8">
      <input type="hidden" name="payload" value={JSON.stringify(payload)} />

      <datalist id="plate-result-options">
        {PLATE_RESULT_OPTIONS.map((r) => (
          <option key={r} value={r} />
        ))}
      </datalist>
      <datalist id="position-options">
        {POSITION_OPTIONS.map((p) => (
          <option key={p} value={p} />
        ))}
      </datalist>
      <datalist id="opponent-options">
        {opponentOptions.map((o) => (
          <option key={o} value={o} />
        ))}
      </datalist>
      <datalist id="stadium-options">
        {stadiumOptions.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>

      {/* 試合メタ情報 */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">試合情報</h2>
        <div className="flex flex-wrap gap-3">
          <label className="flex flex-col gap-1 text-sm">
            日付
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} required />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            開始時刻
            <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            終了時刻
            <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            対戦相手
            <input
              type="text"
              list="opponent-options"
              value={opponent}
              onChange={(e) => setOpponent(e.target.value)}
              className={inputClass}
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            球場
            <input type="text" list="stadium-options" value={stadium} onChange={(e) => setStadium(e.target.value)} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            種別・リーグ
            <input type="text" value={league} onChange={(e) => setLeague(e.target.value)} className={inputClass} />
          </label>
        </div>
      </section>

      {/* スコアボード */}
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-semibold">スコアボード</h2>
          <label className="flex items-center gap-1 text-xs text-foreground/60">
            イニング数
            <input
              type="number"
              min={1}
              value={inningsTeam.length}
              onChange={(e) => setInningCount(Number(e.target.value) || 1)}
              className={`${smallInputClass} w-14`}
            />
          </label>
          <div className="flex items-center gap-2 text-xs text-foreground/60">
            自チーム
            <label className="flex items-center gap-1">
              <input
                type="radio"
                name="teamBatsFirst"
                checked={teamBatsFirst}
                onChange={() => setTeamBatsFirst(true)}
              />
              表（先攻）
            </label>
            <label className="flex items-center gap-1">
              <input
                type="radio"
                name="teamBatsFirst"
                checked={!teamBatsFirst}
                onChange={() => setTeamBatsFirst(false)}
              />
              裏（後攻）
            </label>
          </div>
        </div>
        <div className="overflow-x-auto rounded-xl border border-border-subtle bg-surface">
          <table className="w-full min-w-max text-center text-sm">
            <thead className="bg-surface-muted">
              <tr>
                <th className="px-2 py-1 text-left font-medium text-foreground/50"></th>
                {inningsTeam.map((_, i) => (
                  <th key={i} className="px-1 py-1 font-medium text-foreground/50">
                    {i + 1}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(teamBatsFirst ? ["team", "opponent"] : ["opponent", "team"]).map((side) =>
                side === "team" ? (
                  <tr key="team" className="border-t border-border-subtle">
                    <td className="px-2 py-1 text-left font-semibold text-team-red">自チーム</td>
                    {inningsTeam.map((v, i) => (
                      <td key={i} className="px-1 py-1">
                        <input
                          type="number"
                          value={v}
                          onChange={(e) => {
                            const next = [...inningsTeam];
                            next[i] = e.target.value;
                            setInningsTeam(next);
                          }}
                          className={`${smallInputClass} w-12 text-center`}
                        />
                      </td>
                    ))}
                  </tr>
                ) : (
                  <tr key="opponent" className="border-t border-border-subtle">
                    <td className="px-2 py-1 text-left font-semibold">相手</td>
                    {inningsOpponent.map((v, i) => (
                      <td key={i} className="px-1 py-1">
                        <input
                          type="number"
                          value={v}
                          onChange={(e) => {
                            const next = [...inningsOpponent];
                            next[i] = e.target.value;
                            setInningsOpponent(next);
                          }}
                          className={`${smallInputClass} w-12 text-center`}
                        />
                      </td>
                    ))}
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* 打者成績 */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">打者成績</h2>
        <div className="flex flex-col gap-3">
          {batters.map((b) => (
            <div key={b.key} className="flex flex-col gap-2 rounded-xl border border-border-subtle bg-surface p-3">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="number"
                  placeholder="打順"
                  value={b.orderNo}
                  onChange={(e) => updateBatter(b.key, { orderNo: e.target.value })}
                  className={`${smallInputClass} w-14`}
                />
                <PlayerPicker
                  players={players}
                  value={b.player}
                  onChange={(next) => updateBatter(b.key, { player: next })}
                />
                <input
                  type="text"
                  list="position-options"
                  placeholder="守備"
                  value={b.position}
                  onChange={(e) => updateBatter(b.key, { position: e.target.value })}
                  className={`${smallInputClass} w-20`}
                />
                <button
                  type="button"
                  onClick={() => setBatters((prev) => prev.filter((x) => x.key !== b.key))}
                  className="ml-auto text-xs text-loss underline"
                >
                  打者を削除
                </button>
              </div>

              <div className="flex flex-col gap-1.5 pl-2">
                {b.plateResults.map((pr, i) => (
                  <PlateResultRow
                    key={i}
                    value={pr}
                    onChange={(next) => {
                      const results = [...b.plateResults];
                      results[i] = next;
                      updateBatter(b.key, { plateResults: results });
                    }}
                    onRemove={() =>
                      updateBatter(b.key, {
                        plateResults: b.plateResults.filter((_, idx) => idx !== i),
                      })
                    }
                  />
                ))}
                <button
                  type="button"
                  onClick={() =>
                    updateBatter(b.key, { plateResults: [...b.plateResults, emptyPlateResult()] })
                  }
                  className={`${secondaryButtonClass} w-fit`}
                >
                  ＋ 打席を追加
                </button>
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setBatters((prev) => [...prev, emptyBatter(prev.length + 1)])}
          className={`${secondaryButtonClass} w-fit`}
        >
          ＋ 打者を追加
        </button>
      </section>

      {/* 投手成績 */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">投手成績</h2>
        <div className="flex flex-col gap-3">
          {pitchers.map((p) => (
            <div key={p.key} className="flex flex-wrap items-center gap-2 rounded-xl border border-border-subtle bg-surface p-3">
              <label className="flex items-center gap-1 text-xs">
                <input type="radio" name="starter" checked={p.isStarter} onChange={() => setStarter(p.key)} />
                先発
              </label>
              <PlayerPicker
                players={players}
                value={p.player}
                onChange={(next) => updatePitcher(p.key, { player: next })}
              />

              <label className="flex items-center gap-1 text-xs">
                投球回
                <select
                  value={p.inningsWhole}
                  onChange={(e) => updatePitcher(p.key, { inningsWhole: e.target.value })}
                  className={smallInputClass}
                >
                  {Array.from({ length: 10 }, (_, n) => String(n)).map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
                回
                <select
                  value={p.inningsOuts}
                  onChange={(e) => updatePitcher(p.key, { inningsOuts: e.target.value })}
                  className={smallInputClass}
                >
                  {["0", "1", "2"].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
                アウト
              </label>

              {(
                [
                  ["er", "自責点"],
                  ["runs", "失点"],
                  ["battersFaced", "打者数"],
                  ["strikeouts", "奪三振"],
                  ["walks", "四球"],
                  ["hbp", "死球"],
                  ["hitsAllowed", "被安打"],
                  ["hrAllowed", "被本塁打"],
                  ["pitches", "投球数"],
                  ["wp", "暴投"],
                  ["balk", "ボーク"],
                ] as const
              ).map(([field, label]) => (
                <label key={field} className="flex items-center gap-1 text-xs">
                  {label}
                  <input
                    type="number"
                    min={0}
                    value={p[field]}
                    onChange={(e) => updatePitcher(p.key, { [field]: e.target.value } as Partial<PitcherState>)}
                    className={`${smallInputClass} w-14`}
                  />
                </label>
              ))}

              <label className="flex items-center gap-1 text-xs">
                勝敗
                <select
                  value={p.decision}
                  onChange={(e) => updatePitcher(p.key, { decision: e.target.value as PitcherState["decision"] })}
                  className={smallInputClass}
                >
                  <option value="">-</option>
                  <option value="W">勝</option>
                  <option value="L">負</option>
                  <option value="S">S</option>
                  <option value="H">H</option>
                </select>
              </label>

              <button
                type="button"
                onClick={() => setPitchers((prev) => prev.filter((x) => x.key !== p.key))}
                className="ml-auto text-xs text-loss underline"
              >
                削除
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setPitchers((prev) => [...prev, emptyPitcher(false)])}
          className={`${secondaryButtonClass} w-fit`}
        >
          ＋ 投手を追加
        </button>
      </section>

      {state?.error && <p className="text-sm text-loss">{state.error}</p>}

      <button type="submit" disabled={pending} className={`${primaryButtonClass} w-fit`}>
        {pending
          ? mode === "edit"
            ? "保存中..."
            : "登録中..."
          : mode === "edit"
            ? "変更を保存"
            : "試合を登録"}
      </button>
    </form>
  );
}
