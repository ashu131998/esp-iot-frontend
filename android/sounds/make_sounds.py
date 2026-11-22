#!/usr/bin/env python3
"""
FloorBeat's alert sounds, made from scratch (no recording), built on the brand's heartbeat mark: a
"beat" is two quick pulses (lub-dub).

  machine_alarm  urgent: three double-beats climbing in pitch, played twice; a bright tone (odd
                 harmonics) in the 1.5-2.5 kHz band that carries over low machine noise; peak -1 dBFS.
  alert_chime    gentle: one soft double-beat on bell-like tones (B5 then E6) that fades; peak -8 dBFS.

Writes WAVs here, then encodes them to Opus in Ogg for the app (needs ffmpeg with libopus):
    python3 android/sounds/make_sounds.py
A changed sound needs new notification channel ids in app/src/main/res/values/strings.xml
(Android keeps the sound a channel was made with).
"""
import math
import os
import struct
import subprocess
import wave

RATE = 44100
HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, '..', 'app', 'src', 'main', 'res', 'raw')


def bright(freq, secs, attack=0.004, decay=0.11):
    """A pulse with a sharp start: the fundamental with its 3rd and 5th harmonics."""
    n = int(RATE * secs)
    out = []
    for i in range(n):
        t = i / RATE
        env = (min(1.0, t / attack) * math.exp(-t / decay)) if t > 0 else 0.0
        env *= min(1.0, (n - 1 - i) / (RATE * 0.004))   # no click at the end
        v = math.sin(2 * math.pi * freq * t) + 0.33 * math.sin(2 * math.pi * 3 * freq * t) + 0.2 * math.sin(2 * math.pi * 5 * freq * t)
        out.append(env * v / 1.53)
    return out


def bell(freq, secs, decay=0.28):
    """A soft bell: the fundamental and a quickly fading inharmonic partial."""
    n = int(RATE * secs)
    out = []
    for i in range(n):
        t = i / RATE
        env = min(1.0, t / 0.003) * math.exp(-t / decay)
        env *= min(1.0, (n - 1 - i) / (RATE * 0.01))
        v = math.sin(2 * math.pi * freq * t) + 0.25 * math.sin(2 * math.pi * 2.76 * freq * t) * math.exp(-t / 0.08)
        out.append(env * v / 1.25)
    return out


def mix_at(track, part, start_s):
    i0 = int(start_s * RATE)
    if len(track) < i0 + len(part):
        track.extend([0.0] * (i0 + len(part) - len(track)))
    for i, v in enumerate(part):
        track[i0 + i] += v


def save(name, samples, peak_db):
    peak = max(abs(v) for v in samples) or 1.0
    gain = (10 ** (peak_db / 20)) / peak
    path = os.path.join(HERE, f'{name}.wav')
    with wave.open(path, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(b''.join(struct.pack('<h', int(max(-1.0, min(1.0, v * gain)) * 32767)) for v in samples))
    ogg = os.path.join(RAW, f'{name}.ogg')
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', path, '-c:a', 'libopus', '-b:a', '64k', '-ar', '48000', ogg], check=True)
    os.remove(path)
    print(f'{name}: {len(samples) / RATE:.2f} s -> {os.path.relpath(ogg)}')


def main():
    alarm = []
    t = 0.0
    for _ in range(2):
        for low, high in [(1568, 1976), (1760, 2217), (1976, 2489)]:
            mix_at(alarm, bright(low, 0.11, decay=0.09), t)
            mix_at(alarm, bright(high, 0.17, decay=0.12), t + 0.15)
            t += 0.50
        t += 0.30
    alarm.extend([0.0] * int(RATE * 0.15))
    save('machine_alarm', alarm, -1.0)

    chime = []
    mix_at(chime, bell(988, 0.6), 0.0)
    mix_at(chime, bell(1319, 0.75, decay=0.32), 0.16)
    chime.extend([0.0] * int(RATE * 0.05))
    save('alert_chime', chime, -8.0)


if __name__ == '__main__':
    main()
