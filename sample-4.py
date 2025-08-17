import os
import librosa.display
import numpy as np
import matplotlib.pyplot as plt
from scipy.signal import spectrogram


audio_fpath = "./audio/"
audio_clips = os.listdir(audio_fpath)

audio = audio_fpath + audio_clips[0]
print(audio)
x, sr = librosa.load(audio, offset=15.0, duration=5.0)

# Compute the spectrogram
f, t, Sxx = spectrogram(x, sr)

# Convert the spectrogram to dB (logarithmic scale) by using log10
f = 10 * np.log10(f + 1e-10)
f[0] = 0
Sxx = 10 * np.log10(Sxx + 1e-10)  # Adding a small epsilon to avoid log(0)

# Find the max values across each time frame
max_values = np.max(Sxx, axis=0)
max_frequencies = f[np.argmax(Sxx, axis=0)]  # Frequencies corresponding to max values

# Plot the spectrogram in logarithmic scale (dB)
plt.figure(figsize=(10, 6))

# Plot the spectrogram using the dB scale
plt.pcolormesh(t, f, Sxx, shading='auto')

# Adding labels and title
plt.ylabel('Frequency [Hz]')
plt.xlabel('Time [s]')
plt.title('Spectrogram with Maximum Values Across Time Frames (Log Scale)')

# Highlight the maximum values (the max frequency across each time frame)
plt.scatter(t, max_frequencies, color='red', label='Max Value Frequency', zorder=5)

# Adding a color bar with dB label
plt.colorbar(label='Intensity [dB]')
plt.legend()

# Show the plot
plt.show()
