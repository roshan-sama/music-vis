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

## Holistic, just 2D points:

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

## Mirror video 3D extraction

`python3 EasyMocap/apps/preprocess/extract_keypoints.py /app/data/ --mode yolo-hrnet`

Make sure to copy body models. If the data isn't in this repo, in data/bodymodels you'll have to create an account and download the data: from https://smpl.is.tue.mpg.de
`cp /app/data/bodymodels/ /app/EasyMocap/data/bodymodels/ -r`

The body mesh files are named like this:

```
./SMPL_python_v.1.1.0/smpl/models/basicmodel_neutral_lbs_10_207_0_v1.1.0.pkl
./SMPL_python_v.1.1.0/smpl/models/basicmodel_m_lbs_10_207_0_v1.1.0.pkl
./SMPL_python_v.1.1.0/smpl/models/basicmodel_f_lbs_10_207_0_v1.1.0.pkl
```

Change the fps parameter to what your video uses
`cd EasyMocap; python3 apps/demo/mocap.py /app/data/ --work mirror --fps 30 --vis_scale 0.5`
