export interface PitchData {
  time: number;
  dominant_pitches: Array<{ pitch: string; strength: number }>;
}
