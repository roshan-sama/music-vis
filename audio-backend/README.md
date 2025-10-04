# Prerequisites
- Docker installed, ability to build and run docker containers

# Working directory
Ensure you're in the this directory, it should contain the Dockerfile and data/ folder. Place the video or audio file in the data/ directory (a file called 'place-input-files-here' should guide you)

# Build the Docker image:
`docker build -t audio-analyzer .`

# Run the container with mounted directory:
`docker run -it --rm -v $(pwd)/data:/app/data audio-analyzer bash`
Note: the --rm flag means the container is stopped after exiting it. Don't do any important work you don't want to lose outside the mounted folder

# Extract audio
If you have a .mp4 file instead of an .mp3, you will need to extract the audio from it:

``` bash
ffmpeg -i "$INPUT_FILE" \
    -vn \
    -acodec libmp3lame \
    -q:a 2 \
    -y \
    "$OUTPUT_FILE"
```

E.g. `ffmpeg -i dance_video.mp4 -vn -acodec libmp3lame -q:a 2 -y`

# Run analysis
`python /app/audio_analysis_json.py "$INPUT_FILE"`

E.g. `python /app/audio_analysis_json.py dance_video.mp3`
