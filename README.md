# Red Goblin

A talking formant speech synthesizer that runs entirely in the browser. No dependencies, no build step, no network: each version is a **single HTML file** that generates speech from scratch with DSP code.

The voice is deliberately robotic and gravelly, like an old-school game goblin.

[Русская версия: README-RU.md](README-RU.md)

## Files

| File | Speech language | UI language |
|---|---|---|
| `red-goblin-ru.html` | Russian | Russian |
| `red-goblin-eng.HTML` | English | English |

Open either file in a modern browser (Chrome, Edge, Firefox, Safari, including mobile). Type text, press **Speak**.

## Features

- Pure formant synthesis (simplified Klatt model): glottal source, three tunable formant resonators plus fixed upper formants, and a normalized noise resonator for fricatives and bursts.
- Built-in text-to-phoneme conversion, no external TTS data.
- Eight live controls: speed, pitch, intonation, throat size, 8-bit rasp, volume, hiss, plosive strength.
- Long texts are split into chunks, synthesized one by one and played immediately.
- Question intonation: a trailing `?` raises the pitch at the end.
- Download the result as a 16-bit WAV (packed in a ZIP when the host restricts file types).

## Controls

| Control | Effect |
|---|---|
| Speed | Speaking rate |
| Pitch, Hz | Base voice pitch |
| Intonation | Stress accents and gradual pitch fall across the phrase |
| Throat size | Scales all formants: lower is a bigger throat, higher is a smaller one |
| 8-bit rasp | Bit depth and sample-hold reduction for a crunchy sound |
| Volume | Output gain (soft-clipped) |
| Hiss | Strength of s / sh / f style noise (Russian: с/ш/щ) |
| Plosives | Strength of p / t / k bursts (Russian: п/т/к) |

## Manual pronunciation

**Russian version.** Put `+` before a stressed vowel: `прив+ет`. Unmarked words use a built-in dictionary of common words, otherwise a rule-based guess.

**English version.** Write raw phonemes in curly braces, ARPAbet style, with `1` marking stress:

```
{hh ax l ow1}
```

Vowels: `aa ae ah ao eh er ih iy uh uw ax` and diphthongs `ay ey ow aw oy`.
Consonants: `p b t d k g m n ng l r w y f v th dh s z sh zh hh ch jh`.

Both versions understand digits (read as words) and punctuation pauses.

## How it works

1. **Text to phonemes.** A dictionary of common words handles irregular pronunciation and stress. Everything else goes through rules: Russian vowel reduction, voicing assimilation and final devoicing, soft consonants, and so on; English letter-to-sound rules covering silent e, digraphs, `-ed` / `-es` endings, soft c and g, and r-colored vowels.
2. **Phonemes to control segments.** Each phoneme becomes one or more segments with target formants, voicing, aspiration and noise levels, duration and transition time. Diphthongs and stop consonants are multi-segment.
3. **Synthesis.** Sample by sample at 22.05 kHz: a glottal pulse source, cascaded resonators, and parallel noise. Then a low-pass, a gentle compressor so quiet consonants stay audible, and the optional 8-bit crush.

## Limitations

- It is a rule-based formant synth, not a neural TTS. Rare words, names and foreign words can be mispronounced. Add the word to the `DICT`/`D` table in the source, or use manual pronunciation above.
- English spelling is irregular, so the English version relies more on its dictionary than the Russian one does.
- Only the Latin letters are mapped to Russian sounds in the Russian version (a rough transliteration), and only a-z are read in the English version.

## Customizing

Everything lives in one file. Useful places:

- **Phoneme tables** at the top of the script (formant frequencies, durations, noise parameters).
- **Dictionary** (`DICT` in the Russian file, `D` in the English file).
- **Rules** (`word2ph` in Russian, the `R` list and `rules()` in English).
- **Defaults** are the `value` attributes of the sliders in the HTML.

## Browser notes

Audio starts only after a user gesture (pressing **Speak**), as browsers require. Uses the Web Audio API.
