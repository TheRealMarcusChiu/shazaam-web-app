import os
import librosa.display
import numpy as np
import matplotlib.pyplot as plt
from scipy.signal import spectrogram


audio_fpath = "./audio/"
audio_clips = os.listdir(audio_fpath)

# x, sr = librosa.load(audio_fpath + audio_clips[0], sr=None, offset=15.0, duration=0.01)
audio = audio_fpath + audio_clips[0]
print(audio)
x, sr = librosa.load(audio, offset=15.0, duration=5.0)

# Compute the spectrogram
f, t_spec, Sxx = spectrogram(x, sr)

# Find the max values across each time frame
max_values = np.max(Sxx, axis=0)
max_frequencies = f[np.argmax(Sxx, axis=0)]  # Frequencies corresponding to max values

# Plot the spectrogram
plt.figure(figsize=(10, 6))

# Plot the spectrogram using a log scale for the color intensity
plt.pcolormesh(t_spec, f, 10 * np.log10(Sxx), shading='auto')
plt.ylabel('Frequency [Hz]')
plt.xlabel('Time [s]')
plt.title('Spectrogram with Maximum Values Across Time Frames')

# Highlight the maximum values (the max frequency across each time frame)
plt.scatter(t_spec, max_frequencies, color='red', label='Max Value Frequency')

# Adding color bar and legend
plt.colorbar(label='Intensity [dB]')
plt.legend()

# Show the plot
plt.show()
