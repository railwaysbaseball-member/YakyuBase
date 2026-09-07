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
