export type notes =
  | 'C'
  | 'C#'
  | 'D'
  | 'D#'
  | 'E'
  | 'F'
  | 'F#'
  | 'G'
  | 'G#'
  | 'A'
  | 'A#'
  | 'B';

export interface PitchData {
  time: number;
  dominant_pitches: Array<{ pitch: string; strength: number }>;
  all_pitches: { [key in notes]: number };
}
