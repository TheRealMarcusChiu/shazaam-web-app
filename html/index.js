// ======== Utility ========
const sleep = ms => new Promise(r => setTimeout(r, ms));
function hann(N) {
    const w = new Float32Array(N);
    for (let n=0; n<N; n++) {
        w[n] = 0.5 * (1 - Math.cos(2 * Math.PI * n / (N-1)));
    }
    return w;
}
function nextPow2(v) {
    return 1 << Math.ceil(Math.log2(v));
}

// Simple in-place Radix-2 Cooley–Tukey Discrete FFT for real input (separate re,im)
function fft(re, im) {
    const N = re.length;
    // bit-reverse
    let j=0;
    for (let i=0; i<N; i++) {
        if (i < j) {
            const tr=re[i];
            re[i]=re[j];
            re[j]=tr;
            const ti=im[i];
            im[i]=im[j];
            im[j]=ti;
        }
        let m = N>>1;
        while (m >= 1 && j >= m) {
            j -= m;
            m >>= 1;
        }
        j += m;
    }
    for (let size = 2; size <= N; size <<= 1) {
        const half = size >> 1;
        const tableStep = Math.PI * 2 / size;
        for (let i = 0; i < N; i += size) {
            for (let k = 0; k < half; k++) {
                const angle = tableStep * k;
                const wr = Math.cos(angle);
                const wi = -Math.sin(angle);
                const j = i + k;
                const l = j+half;
                const tr = wr*re[l] - wi*im[l];
                const ti = wr*im[l] + wi*re[l];
                const ur = re[j]
                const ui = im[j];
                re[l] = ur - tr;
                im[l] = ui - ti;
                re[j] = ur + tr;
                im[j] = ui + ti;
            }
        }
    }
}

// Downsample by integer factor using simple decimation (good enough for demo)
function downsample(signal, srcRate, tgtRate) {
    if (srcRate > tgtRate) {
        const factor = Math.floor(srcRate / tgtRate);
        const out = new Float32Array(Math.floor(signal.length / factor));
        for (let i = 0; i < out.length; i++) {
            out[i] = signal[i * factor];
        }
        return { data: out, rate: tgtRate };
    } else {
        return { data: signal, rate: srcRate };
    }
}

// ======== Spectrogram & Peaks ========
const FP_CFG = {
    targetRate: 11025,
    frameSize: 2048,
    hopSize: 1024, // usually frameSize / 2
    peaksPerFrame: 5,
    minMagDB: -60,
    pairFanOut: 5,
    pairMinDT: 1,  // frames
    pairMaxDT: 30, // frames (~1.4s)
};

const HANN = hann(FP_CFG.frameSize);

function stft(signal, sampleRate) {
    const { frameSize, hopSize } = FP_CFG;
    const frameSizeHalf = frameSize / 2;

    const nFrames = 1 + Math.floor((signal.length - frameSize) / hopSize);
    const spec = new Array(nFrames);

    for (let t = 0; t < nFrames; t++) {

        const re = new Float32Array(frameSize);
        const im = new Float32Array(frameSize);

        const idx = t * hopSize

        // Hann window is used before FFT to reduce spectral leakage by
        // tapering the edges of the signal chunk smoothly to zero
        for (let n = 0; n < frameSize; n++) {
            re[n] = (signal[idx+n] || 0) * HANN[n];
        }

        fft(re, im);

        const mags = new Float32Array(frameSizeHalf);
        for (let k = 0; k < mags.length; k++) {
            const mag = Math.hypot(re[k], im[k]) / frameSizeHalf;
            // convert mag to decibels bc human hearing is logarithmic
            // dB = 20 * log10(magnitude)
            mags[k] = 20 * Math.log10(mag + 1e-12);
        }

        spec[t] = mags;
    }

    return { spec, nFrames, bins: frameSizeHalf, sampleRate };
}

function pickPeaks(S) {
    const peaksByFrame = [];
    const spec = S.spec;
    for (let t = 0; t < spec.length; t++) {
        const row = spec[t];
        const peaks = [];
        for (let k = 1; k < row.length - 1; k++) {
            if (row[k] > FP_CFG.minMagDB && row[k] > row[k-1] && row[k] > row[k+1]) {
                peaks.push({k, db: row[k]});
            }
        }
        peaks.sort((a,b) => b.db - a.db);
        peaksByFrame.push(peaks.slice(0, FP_CFG.peaksPerFrame).map(p => p.k));
    }
    return peaksByFrame; // array of arrays of bin indices
}

// Create Shazam-like constellation hashes
function makeHashes(peaksByFrame) {
    const hashes = []; // {h, t}
    for (let t = 0; t < peaksByFrame.length; t++) {
        const anchors = peaksByFrame[t];
        if (!anchors || anchors.length===0) {
            console.log("no peaks found");
            continue;
        }
        let pairsMade = 0;
        for (let dt = FP_CFG.pairMinDT; dt <= FP_CFG.pairMaxDT && pairsMade < FP_CFG.pairFanOut; dt++) {
            const cand = peaksByFrame[t + dt];
            if (!cand) break;
            for (let a = 0; a < anchors.length && pairsMade < FP_CFG.pairFanOut; a++) {
                for (let b = 0; b < cand.length && pairsMade < FP_CFG.pairFanOut; b++) {
                    const f1 = anchors[a];
                    const f2 = cand[b];
                    const h = `${f1}|${f2}|${dt}`; // already quantized by bin index
                    hashes.push({h, t});
                    pairsMade++;
                }
            }
        }
    }
    return hashes; // array of {h,t}
}

// ======== Fingerprinting Pipeline ========
async function decodeFileToMono(file) {
    const arr = await file.arrayBuffer();
    const ac = new (window.AudioContext||window.webkitAudioContext)();
    const buf = await ac.decodeAudioData(arr);
    const ch = buf.numberOfChannels > 1 ? averageChannels(buf) : buf.getChannelData(0);
    return { data: ch, rate: buf.sampleRate };
}

function averageChannels(buf) {
    const len = buf.length;
    const out = new Float32Array(len);
    const C = buf.numberOfChannels;

    for (let c=0; c<C; c++) {
        const d = buf.getChannelData(c);
        for (let i=0; i<len; i++)
            out[i] += d[i];
    }

    for (let i=0; i<len; i++)
        out[i] /= C;

    return out;
}

function fingerprintFromSignal(signal, rate) {
    // Downsample
    const {data: ds, rate: r} = downsample(signal, rate, FP_CFG.targetRate);
    // STFT
    const S = stft(ds, r);
    // Peaks → Hashes
    const peaks = pickPeaks(S);
    const hashes = makeHashes(peaks);
    return {hashes, peaks, S};
}

// ======== Reference Library (in-memory) ========
const DB = { // simple in-memory structures
  tracks: [], // {id, name}
  hashTable: new Map(), // hash -> array of {trackId, t}
};

function addToDB(trackId, hashes){
  hashes.forEach(({h,t}) => {
    if (!DB.hashTable.has(h)) DB.hashTable.set(h, []);
    DB.hashTable.get(h).push({trackId, t});
  });
}

function bestMatch(queryHashes) {
    const counts = new Map(); // key: `${trackId}|${offset}` -> votes
    for (const {h, t: tq} of queryHashes) {
        const bucket = DB.hashTable.get(h);
        if (!bucket) continue;
        for (const {trackId, t: tr} of bucket) {
            const off = tr - tq;
            const key = `${trackId}|${off}`;
            counts.set(key, (counts.get(key) || 0) + 1);
        }
    }
    let best = null;
    let maxVotes = 0;
    for (const [key,v] of counts) {
        if (v > maxVotes) {
            maxVotes = v;
            best = key;
        }
    }
    if (!best) return null;
    const [trackId, off] = best.split('|').map(Number);
    return { trackId, offset: off, votes: maxVotes };
}

// ======== UI: Reference Loading ========
const refFilesEl = document.getElementById('refFiles');
const refListEl = document.getElementById('refList');
const statusEl = document.getElementById('status');
const resultEl = document.getElementById('result');
const specCanvas = document.getElementById('spec');

let filesMe = null;

refFilesEl.addEventListener('change', async (e) => {
    const files = [...e.target.files];
    filesMe = files;
    for (const file of files) {
        const id = DB.tracks.length;
        DB.tracks.push({id, name: file.name});
        addRefRow(file.name, '… fingerprinting');
        await sleep(5);
        try {
            const {data, rate} = await decodeFileToMono(file);
            const fp = fingerprintFromSignal(data, rate);
            addToDB(id, fp.hashes);
            updateRefRow(file.name, `${fp.hashes.length} hashes`);
        } catch(err) {
            console.error(err);
            updateRefRow(file.name, 'failed to decode', true);
        }
    }
});

function addRefRow(name, right){
  const n = document.createElement('div'); n.textContent = name; refListEl.appendChild(n);
  const r = document.createElement('div'); r.textContent = right; r.dataset.rightFor = name; r.className='muted'; refListEl.appendChild(r);
}
function updateRefRow(name, text, isErr=false){
  const el = [...refListEl.children].find(x=>x.dataset && x.dataset.rightFor===name);
  if (el){ el.textContent = text; el.className = isErr? 'muted' : 'ok'; }
}

// ======== Recording (capture raw PCM via ScriptProcessor) ========
const recordBtn = document.getElementById('recordBtn');
let recState = { collecting: false, data:[] };

recordBtn.addEventListener('click', async () => {
    if (recState.collecting) return;
    try {
        const DURATION_SEC = 6;
        statusEl.textContent = 'Mic permission…';
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const ac = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 48000 });
        const src = ac.createMediaStreamSource(stream);
        const proc = ac.createScriptProcessor(4096, 1, 1);
        recState = { collecting: true, data: [] };
        src.connect(proc);
        proc.connect(ac.destination);
        statusEl.textContent = 'Listening…';
        const started = performance.now();
        proc.onaudioprocess = (e) => {
            if (!recState.collecting) return;
            const input = e.inputBuffer.getChannelData(0);
            recState.data.push(new Float32Array(input));
            if ((performance.now() - started) > (DURATION_SEC * 1000)) {
                recState.collecting = false;
                proc.disconnect();
                src.disconnect();
                stream.getTracks().forEach(t => t.stop());
                const merged = flattenFloat32(recState.data);
                processQuery(merged, ac.sampleRate);
            }
        };
    } catch(err) {
        console.error(err);
        statusEl.textContent = 'Mic error: ' + err.message;
    }
});

function flattenFloat32(chunks){
  let len=0; for(const c of chunks) len+=c.length;
  const out=new Float32Array(len); let off=0; for(const c of chunks){ out.set(c,off); off+=c.length; }
  return out;
}

// ======== Query processing & draw ========
function drawSpectrogram(S){
  const ctx = specCanvas.getContext('2d');
  const W = specCanvas.width, H = specCanvas.height;
  ctx.clearRect(0,0,W,H);
  const nT = S.spec.length; const nF = S.spec[0]?.length||1;
  for (let t=0;t<nT;t++) {
    for (let k=0;k<nF;k++) {
      const db = S.spec[t][k];
      const v = (db - (-90)) / (0 - (-90)); // map -90..0 dB to 0..1
      const y = Math.floor((1 - k/nF) * (H-1));
      const x = Math.floor(t * (W-1) / Math.max(1,nT-1));
      ctx.fillStyle = `hsl(${220 - 220*v}, 90%, ${20+60*v}%)`;
      ctx.fillRect(x,y,1,1);
    }
  }
}

async function processQuery(signal, rate) {
    statusEl.textContent = 'Processing query…';
    const fp = fingerprintFromSignal(signal, rate);
    drawSpectrogram(fp.S);
    if (DB.tracks.length === 0 || DB.hashTable.size === 0) {
        resultEl.textContent = 'No reference library loaded. Add some tracks first.';
        statusEl.textContent = 'Idle';
        return;
    }
    const match = bestMatch(fp.hashes);
    if (!match) {
        resultEl.textContent = 'No match found.';
        statusEl.textContent='Idle';
        return;
    }
    const track = DB.tracks[match.trackId];
    const conf = match.votes;
    resultEl.innerHTML = `<b>Match:</b> ${track.name} <span class="muted">(votes ${conf})</span>`;
    statusEl.textContent = 'Done';
}