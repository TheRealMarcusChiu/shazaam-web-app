import os
import matplotlib.pyplot as plt

# for loading and visualizing audio files
import librosa
import librosa.display

# to play audio
import IPython.display as ipd


audio_fpath = "./audio/"
audio_clips = os.listdir(audio_fpath)
print("No. of .wav files in audio folder = ",len(audio_clips))

# x, sr = librosa.load(audio_fpath+audio_clips[0], sr=None, offset=15.0, duration=0.01)
x, sr = librosa.load(audio_fpath+audio_clips[0], sr=None)

print(type(x), type(sr))
print(x.shape, sr)

# Plot #1
plt.figure(figsize=(14, 5))
librosa.display.waveshow(x, sr=sr)

# X = librosa.stft(x)
# Xdb = librosa.amplitude_to_db(abs(X))
#
# # Plot #2
# # plt.figure(figsize=(14, 5))
# # librosa.display.specshow(Xdb, sr=sr, x_axis='time', y_axis='hz')
# # plt.colorbar()
#
#
# plt.figure(figsize=(14, 5))
# librosa.display.specshow(Xdb, sr=sr, x_axis='time', y_axis='log')
# plt.colorbar()

plt.show()
