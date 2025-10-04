#!/usr/bin/env python3
"""
Audio analysis script that outputs clean JSON for web visualization
"""

import librosa
import numpy as np
import json
import sys
from pathlib import Path

def analyze_audio_to_json(audio_file_path, output_file=None):
    """
    Analyze audio file and return results as JSON-serializable dict
    """
    print(f"Analyzing: {audio_file_path}")
    
    # Load audio file
    y, sr = librosa.load(audio_file_path, sr=22050)
    duration = len(y) / sr
    
    print(f"Loaded: {duration:.1f} seconds, {sr} Hz")
    
    # Onset detection (drum hits, note starts)
    print("Detecting onsets...")
    onset_frames = librosa.onset.onset_detect(y=y, sr=sr, units='time')
    onsets = [float(t) for t in onset_frames]  # Convert to regular floats
    
    # Beat tracking
    print("Analyzing rhythm...")
    tempo_array, beat_frames = librosa.beat.beat_track(y=y, sr=sr)
    tempo = float(tempo_array) if hasattr(tempo_array, '__iter__') else float(tempo_array)
    beat_times = librosa.frames_to_time(beat_frames, sr=sr)
    beats = [float(t) for t in beat_times]
    
    # Spectral features over time
    print("Extracting spectral features...")
    
    # Split into segments for analysis (every 0.5 seconds)
    hop_length = 512
    frame_rate = sr / hop_length
    segment_length = int(0.5 * frame_rate)  # 0.5 second segments
    
    spectral_features = []
    
    # Get spectral centroids, rolloff, zero crossing rate
    spectral_centroids = librosa.feature.spectral_centroid(y=y, sr=sr, hop_length=hop_length)[0]
    spectral_rolloff = librosa.feature.spectral_rolloff(y=y, sr=sr, hop_length=hop_length)[0]
    zero_crossing_rate = librosa.feature.zero_crossing_rate(y, hop_length=hop_length)[0]
    rms_energy = librosa.feature.rms(y=y, hop_length=hop_length)[0]
    
    # Sample every 0.5 seconds for manageable data size
    time_points = np.arange(0, len(spectral_centroids), segment_length)
    
    for i in time_points:
        if i < len(spectral_centroids):
            time_sec = float(i * hop_length / sr)
            spectral_features.append({
                "time": time_sec,
                "spectral_centroid": float(spectral_centroids[i]),
                "spectral_rolloff": float(spectral_rolloff[i]),
                "zero_crossing_rate": float(zero_crossing_rate[i]),
                "rms_energy": float(rms_energy[i])
            })
    
    # Chromagram for pitch analysis
    print("Analyzing pitch content...")
    chroma = librosa.feature.chroma_stft(y=y, sr=sr, hop_length=hop_length)
    
    # Average chroma over time segments
    pitch_analysis = []
    note_names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
    
    for i in range(0, chroma.shape[1], segment_length):
        if i < chroma.shape[1]:
            time_sec = float(i * hop_length / sr)
            chroma_segment = np.mean(chroma[:, i:i+segment_length], axis=1)
            
            # Find dominant pitch classes
            pitch_strengths = {}
            for j, note in enumerate(note_names):
                pitch_strengths[note] = float(chroma_segment[j])
            
            # Get top 3 strongest pitch classes
            top_pitches = sorted(pitch_strengths.items(), key=lambda x: x[1], reverse=True)[:3]
            
            pitch_analysis.append({
                "time": time_sec,
                "dominant_pitches": [{"note": note, "strength": strength} for note, strength in top_pitches],
                "all_pitches": pitch_strengths
            })
    
    # Package everything into JSON structure
    analysis_result = {
        "metadata": {
            "filename": Path(audio_file_path).name,
            "duration": float(duration),
            "sample_rate": int(sr),
            "tempo": tempo,
            "total_onsets": len(onsets),
            "total_beats": len(beats)
        },
        "temporal_features": {
            "onsets": onsets,
            "beats": beats,
            "spectral_features": spectral_features
        },
        "pitch_analysis": pitch_analysis,
        "analysis_summary": {
            "avg_spectral_centroid": float(np.mean(spectral_centroids)),
            "avg_rms_energy": float(np.mean(rms_energy)),
            "onset_density": len(onsets) / duration,  # onsets per second
            "beat_consistency": float(np.std(np.diff(beats))) if len(beats) > 1 else 0.0
        }
    }
    
    # Save to file if specified
    if output_file:
        with open(output_file, 'w') as f:
            json.dump(analysis_result, f, indent=2)
        print(f"Results saved to: {output_file}")
    
    return analysis_result

def simple_instrument_detection(audio_file_path):
    """
    Basic instrument detection using spectral characteristics
    """
    print("Attempting basic instrument detection...")
    
    y, sr = librosa.load(audio_file_path, sr=22050)
    
    # Get MFCC features (good for distinguishing instruments)
    mfccs = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
    
    # Simple heuristic-based detection
    instruments_detected = []
    
    # Analyze different frequency bands
    stft = librosa.stft(y)
    magnitude = np.abs(stft)
    
    # Low frequencies (potential bass/drums)
    low_freq_energy = np.mean(magnitude[:50, :])  # Roughly 0-1kHz
    mid_freq_energy = np.mean(magnitude[50:200, :])  # Roughly 1-4kHz  
    high_freq_energy = np.mean(magnitude[200:, :])  # Above 4kHz
    
    total_energy = low_freq_energy + mid_freq_energy + high_freq_energy
    
    # Simple classification based on energy distribution
    instruments = {
        "drums_percussion": {
            "confidence": float(low_freq_energy / total_energy),
            "characteristics": "High low-frequency energy"
        },
        "melodic_instruments": {
            "confidence": float(mid_freq_energy / total_energy),
            "characteristics": "High mid-frequency energy"
        },
        "cymbals_hi_freq": {
            "confidence": float(high_freq_energy / total_energy),
            "characteristics": "High-frequency content"
        }
    }
    
    return instruments

if __name__ == "__main__":
    # Get audio file from command line or use default
    if len(sys.argv) < 2:
        print("Usage: python audio_analysis_json.py <audio_file.mp3> [output.json]")
        sys.exit(1)
    
    audio_file = sys.argv[1]
    output_file = sys.argv[2] if len(sys.argv) > 2 else "analysis_results.json"
    
    if not Path(audio_file).exists():
        print(f"File not found: {audio_file}")
        sys.exit(1)
    
    try:
        # Main analysis
        results = analyze_audio_to_json(audio_file, output_file)
        
        # Basic instrument detection
        instruments = simple_instrument_detection(audio_file)
        
        # Print summary
        print(f"\n=== ANALYSIS COMPLETE ===")
        print(f"Duration: {results['metadata']['duration']:.1f}s")
        print(f"Tempo: {results['metadata']['tempo']:.1f} BPM")
        print(f"Found {results['metadata']['total_onsets']} onsets")
        print(f"Found {results['metadata']['total_beats']} beats")
        
        print(f"\nInstrument detection (basic):")
        for instrument, data in instruments.items():
            print(f"  {instrument}: {data['confidence']:.2%} confidence")
        
        print(f"\nJSON data saved to: analysis_results.json")
        print(f"Use this file for your HTML/JS visualization!")
        
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()