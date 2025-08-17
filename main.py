import matplotlib.pyplot as plt
import numpy as np

# Generate a sample signal (e.g., a chirp signal)
sample_rate = 44100  # Sample rate in Hz
duration = 5  # Duration in seconds
time = np.linspace(0, duration, int(sample_rate * duration), endpoint=False)
frequencies = np.linspace(100, 1000, len(time))  # Frequency sweep from 100Hz to 1000Hz
signal = np.sin(2 * np.pi * frequencies * time)

# Plot the spectrogram
plt.figure(figsize=(10, 6))
plt.specgram(signal, Fs=sample_rate, NFFT=512, noverlap=256, cmap='viridis')
plt.title('Spectrogram of Chirp Signal')
plt.xlabel('Time (s)')
plt.ylabel('Frequency (Hz)')
plt.colorbar(label='Intensity (dB)')
plt.show()
