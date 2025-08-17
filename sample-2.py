import os
import librosa.display
import matplotlib.pyplot as plt
import numpy as np


audio_fpath = "./audio/"
audio_clips = os.listdir(audio_fpath)

# x, sr = librosa.load(audio_fpath + audio_clips[0], sr=None, offset=15.0, duration=0.01)
audio = audio_fpath + audio_clips[0]
print(audio)
x, sr = librosa.load(audio, offset=15.0, duration=5.0)
# x is the audio time series
# sr is the sample rate

# Compute the Short-Time Fourier Transform (STFT)
# D = librosa.stft(x, n_fft=32768, hop_length=2048)
D = librosa.stft(x)

D = np.abs(D)

# Convert amplitude to decibels (log scale)
log_D = librosa.amplitude_to_db(D, ref=np.max)

log_D_transpose = np.transpose(log_D)

np.argmax(log_D_transpose[0])
np.max(log_D_transpose[0])

# Plot the log spectrogram
plt.figure(figsize=(14, 5))
librosa.display.specshow(log_D, sr=sr, x_axis='time', y_axis='log')
plt.colorbar()
plt.show()
