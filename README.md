# Red Goblin

A talking formant speech synthesizer that runs entirely in the browser, plus a free library and HTTP API built on the same engine. No dependencies, no build step: the web versions are **single HTML files** that generate speech from scratch with DSP code.

The voice is deliberately robotic and gravelly, like an old-school game goblin.

[Русская версия: README-RU.md](README-RU.md)

## Repository structure

```
.
├── red-goblin-ru.html     Russian speech, Russian interface
├── red-goblin-eng.HTML    English speech, English interface
├── api/
│   ├── goblin.js          Library: Russian + English engines (Node.js and browser)
│   ├── server.js          Free HTTP API server (Node.js, no dependencies)
│   └── package.json
├── README.md
└── README-RU.md
```

The `api/` folder is independent of the HTML files. You can use either part without the other.

## Web version

Open `red-goblin-ru.html` (Russian speech) or `red-goblin-eng.HTML` (English speech) in a modern browser (Chrome, Edge, Firefox, Safari, including mobile). Type text, press **Speak**.

### Features

- Pure formant synthesis (simplified Klatt model): glottal source, three tunable formant resonators plus fixed upper formants, and a normalized noise resonator for fricatives and bursts.
- Built-in text-to-phoneme conversion, no external TTS data.
- Eight live controls: speed, pitch, intonation, throat size, 8-bit rasp, volume, hiss, plosive strength.
- Long texts are split into chunks, synthesized one by one and played immediately.
- Question intonation: a trailing `?` raises the pitch at the end.
- Download the result as a 16-bit WAV (packed in a ZIP when the host restricts file types).

### Controls

| Control | API parameter | Range | Default | Effect |
|---|---|---|---|---|
| Speed | `speed` | 0.6 – 1.6 | 0.8 | Speaking rate |
| Pitch, Hz | `pitch` | 70 – 220 | 105 | Base voice pitch |
| Intonation | `accent` | 0 – 1 | 0.5 | Stress accents and gradual pitch fall across the phrase |
| Throat size | `fm` | 0.8 – 1.35 | 1 | Scales all formants: lower is a bigger throat, higher is a smaller one |
| 8-bit rasp | `crush` | 0 – 1 | 0.1 | Bit depth and sample-hold reduction for a crunchy sound |
| Volume | `vol` | 0.8 – 3 | 1.5 | Output gain (soft-clipped) |
| Hiss | `hiss` | 0 – 1.5 | 0.5 | Strength of s / sh / f style noise |
| Plosives | `burst` | 0 – 1 | 0.6 | Strength of p / t / k bursts |

### Manual pronunciation

**Russian.** Put `+` before a stressed vowel: `прив+ет`. Unmarked words use a built-in dictionary of common words, otherwise a rule-based guess.

**English.** Write raw phonemes in curly braces, ARPAbet style, with `1` marking stress:

```
{hh ax l ow1}
```

Vowels: `aa ae ah ao eh er ih iy uh uw ax` and diphthongs `ay ey ow aw oy`.
Consonants: `p b t d k g m n ng l r w y f v th dh s z sh zh hh ch jh`.

Both versions read digits as words and pause on punctuation.

## API (`api/`)

### HTTP server

Requires Node.js 16 or newer. No `npm install` needed.

```bash
cd api
node server.js            # listens on port 3000 (override with PORT)
```

| Request | Description |
|---|---|
| `GET /speak?text=Hello&lang=en` | Returns `audio/wav` |
| `POST /speak` with JSON `{"text":"Привет","lang":"ru","pitch":90}` | Returns `audio/wav` |
| `GET /health` | `{"ok":true}` |
| `GET /` | Short description of the API and its parameters |

Parameters: `text` (required), `lang` (`en` or `ru`, default `en`), plus any of `speed`, `pitch`, `accent`, `fm`, `crush`, `vol`, `hiss`, `burst` from the table above. Out-of-range values are clamped.

Examples:

```bash
curl -o hello.wav "http://localhost:3000/speak?text=Hello%20goblin&lang=en&pitch=90"

curl -o privet.wav -X POST http://localhost:3000/speak \
  -H "Content-Type: application/json" \
  -d '{"text":"Привет, я гоблин красный","lang":"ru"}'
```

```js
// browser
const res = await fetch('https://YOUR-HOST/speak?text=Hello&lang=en');
new Audio(URL.createObjectURL(await res.blob())).play();
```

Errors are returned as JSON `{"error": "..."}` with the status codes `400` (bad input), `413` (text too long), `422` (nothing pronounceable), `429` (rate limited).

Server settings (environment variables):

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | 3000 | Port to listen on |
| `MAX_CHARS` | 500 | Maximum text length per request |
| `RATE_LIMIT` | 30 | Requests per IP per minute |
| `TRUST_PROXY` | off | Set to `1` behind a reverse proxy or CDN so limits use the real client IP from `X-Forwarded-For` |

CORS is enabled for all origins, and successful responses are cacheable for an hour.

### Library

`api/goblin.js` works in Node.js (CommonJS) and in the browser (global `Goblin`):

```js
const Goblin = require('./goblin.js');

const samples = Goblin.synthesize('Hello, I am the red goblin', { lang: 'en', pitch: 90 });
// Float32Array, mono, 22050 Hz, values -1..1

const wav = Goblin.toWav(samples);   // Uint8Array with a 16-bit WAV file
require('fs').writeFileSync('goblin.wav', wav);
```

```html
<script src="goblin.js"></script>
<script>
  const s = Goblin.synthesize('Привет', { lang: 'ru' });
  const ctx = new AudioContext();
  const buf = ctx.createBuffer(1, s.length, Goblin.sampleRate);
  buf.copyToChannel(s, 0);
  const src = ctx.createBufferSource();
  src.buffer = buf; src.connect(ctx.destination); src.start();
</script>
```

Also exported: `Goblin.sampleRate`, `Goblin.languages`, `Goblin.defaults`, `Goblin.ranges`.

### Hosting for free

The server is a plain Node.js process, so it runs on any host that can start `node server.js`, such as Render, Fly.io or your own VPS. Free tiers have their own limits and change over time, so check the host's current terms. Keep `MAX_CHARS` and `RATE_LIMIT` conservative on a free plan.

## How it works

1. **Text to phonemes.** A dictionary of common words handles irregular pronunciation and stress. Everything else goes through rules: Russian vowel reduction, voicing assimilation, final devoicing and soft consonants; English letter-to-sound rules covering silent e, digraphs, `-ed` / `-es` endings, soft c and g, and r-colored vowels.
2. **Phonemes to control segments.** Each phoneme becomes one or more segments with target formants, voicing, aspiration and noise levels, duration and transition time. Diphthongs and stop consonants are multi-segment.
3. **Synthesis.** Sample by sample at 22.05 kHz: a glottal pulse source, cascaded resonators, and parallel noise. Then a low-pass filter, a gentle compressor so quiet consonants stay audible, and the optional 8-bit crush.

## Limitations

- It is a rule-based formant synth, not a neural TTS. Rare words, names and foreign words can be mispronounced. Add the word to the dictionary table (`DICT` for Russian, `D` for English) or use manual pronunciation.
- English spelling is irregular, so the English engine relies more on its dictionary than the Russian one does.
- In the Russian engine Latin letters are read by a rough transliteration. The English engine reads only a-z.

## Customizing

- **Phoneme tables, dictionaries and rules** live at the top of each engine: in the HTML files and in `api/goblin.js` (`makeRu`, `makeEn`).
- **Web defaults** are the `value` attributes of the sliders in the HTML. **API defaults** are in `RANGES` in `api/goblin.js`.
- The HTML files and `api/goblin.js` contain separate copies of the engine. If you change pronunciation rules, update both.

## Browser notes

In the web version audio starts only after a user gesture (pressing **Speak**), as browsers require. It uses the Web Audio API.
