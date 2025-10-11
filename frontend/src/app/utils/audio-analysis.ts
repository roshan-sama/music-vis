import { PitchData } from '../interfaces/pitch-analysis-data';
import * as THREE from 'three';

export const updateVisualization = (
  timeIndex: number,
  pitchAnalysisData: PitchData[],
  beatPulseStrength: number,
  sphere: THREE.Mesh
): void => {
  if (timeIndex < pitchAnalysisData.length) {
    const currentData = pitchAnalysisData[timeIndex];

    if (
      currentData.dominant_pitches &&
      currentData.dominant_pitches.length > 0
    ) {
      const dominantStrength = currentData.dominant_pitches[0].strength;
      const hue = dominantStrength * 360;
      const saturation = 70;
      const lightness = 50 + dominantStrength * 30;

      const material = sphere.material as THREE.MeshPhongMaterial;
      material.color.setHSL(hue / 360, saturation / 100, lightness / 100);
    }

    const baseScale = 1;
    const pulseScale = baseScale + beatPulseStrength * 0.3;
    sphere.scale.setScalar(pulseScale);
  }
};
