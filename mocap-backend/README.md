# Prerequisites

- Docker installed, ability to build and run docker containers

# Working directory

Ensure you're in the this directory, it should contain the Dockerfile and data/ folder. Place the video file in a folder called videos/ within this data/ directory (a file called 'place-video-files-here' should guide you)

# Build dockerfile

`docker build -t easymocap .`

# Run dockerfile, mounting data directory

`docker run -it --rm -v $(pwd)/data:/app/data easymocap bash`
Note: the --rm flag means the container is stopped after exiting it. Don't do any important work you don't want to lose outside the mounted folder

# Image extraction

Ensure that the video to analyze is placed in data/videos. E.g. mocap-backend/data/videos/dance-video.mp4
Then, run this command within docker
`python EasyMocap/apps/preprocess/extract_image.py /app/data`

Confirm that you working directory in the docker container is /app. The command line and output should look something like this:

```bash
root@d5dacab8ce18:/app# python EasyMocap/apps/preprocess/extract_image.py /app/data
ffmpeg -i /app/data/videos/dance-video.mp4  -q:v 1 -start_number 0 /app/data/images/dance-video/%06d.jpg -loglevel quiet
```

You should see the output "ffmpeg -i ..." above invoked by your command, followed by the creation of an images/ folder in data/ that contains one image per frame of your video.

# Keypoint extraction

`python EasyMocap/apps/preprocess/extract_keypoints.py /app/data --mode mp-holistic`

Output might looks something like this

```bash
root@d5dacab8ce18:/app# python EasyMocap/apps/preprocess/extract_keypoints.py /app/data --mode mp-holistic
Downloading model to /usr/local/lib/python3.11/site-packages/mediapipe/modules/pose_landmark/pose_landmark_heavy.tflite
INFO: Created TensorFlow Lite XNNPACK delegate for CPU.
dance-video:   0%| | 0/467 [00:00<?, ?it/s]/usr/local/lib/python3.11/site-packages/google/protobuf/symbol_database.py:55: UserWarning: SymbolDatabase.GetPrototype() is deprecated. Please use message_factory.GetMessageClass() instead. SymbolDatabase.GetPrototype() will be removed soon.
  warnings.warn('SymbolDatabase.GetPrototype() is deprecated. Please '
dance-video: 100%|█| 467/467 [00:26<00:00,
```

# Screen recording using ffmpeg

`ffmpeg -f x11grab -s "1920x1080" -i :0.0 -f pulse -i alsa_output.pci-0000_00_1b.0.analog-stereo.monitor output.mkv`

alsa_output.pci-0000_00_1b.0.analog-stereo.monitor might be different, and the type of audio might not be pulse either, so you may need to google this
