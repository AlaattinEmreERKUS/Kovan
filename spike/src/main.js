const el = (id) => document.getElementById(id);
const logBox = el("log");
const video = el("preview");

let stream = null;
let audioCtx = null;
let rafId = null;
let pressed = 0;
let released = 0;

function log(line) {
  const t = new Date().toISOString().slice(11, 23);
  logBox.textContent += `${t}  ${line}\n`;
  logBox.scrollTop = logBox.scrollHeight;
}

function verdict(id, text, pass) {
  const node = el(id);
  node.textContent = text;
  node.className = `verdict ${pass ? "pass" : "fail"}`;
}

async function capture(kind) {
  stopStream();
  const wantAudio = el("with-audio").checked;
  try {
    if (kind === "screen") {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30 },
        audio: wantAudio,
        systemAudio: wantAudio ? "include" : "exclude",
        surfaceSwitching: "include",
      });
    } else {
      stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    }
    video.srcObject = stream;
    video.classList.add("on");
    el("stop").disabled = false;

    const track = stream.getVideoTracks()[0];
    const s = track.getSettings();
    log(
      `${kind} OK — label="${track.label}" ${s.width}x${s.height}@${s.frameRate ?? "?"}` +
        ` displaySurface=${s.displaySurface ?? "-"}`
    );
    if (kind === "screen") verdict("r1-verdict", "R1: GEÇTİ — görüntü akıyor", true);

    if (kind === "screen") measureAudio(wantAudio);
  } catch (err) {
    log(`${kind} HATA — ${err.name}: ${err.message}`);
    if (kind === "screen") verdict("r1-verdict", `R1: KALDI — ${err.name}`, false);
  }
}

// Ses track'inin VARLIGI yetmez, gercekten veri akiyor mu olculmeli.
function measureAudio(wanted) {
  const tracks = stream.getAudioTracks();
  if (!tracks.length) {
    log(`ses track'i YOK (istendi mi: ${wanted})`);
    verdict(
      "r3-verdict",
      wanted ? "Ses: KALDI — WebView2 sistem sesi vermedi" : "Ses: istenmedi",
      false
    );
    return;
  }
  const t = tracks[0];
  log(`ses track'i VAR — label="${t.label}" settings=${JSON.stringify(t.getSettings())}`);
  verdict("r3-verdict", "Ses: track geldi — seviye ölçülüyor, bir şey çal", true);

  audioCtx = new AudioContext();
  const analyser = audioCtx.createAnalyser();
  analyser.fftSize = 512;
  audioCtx.createMediaStreamSource(stream).connect(analyser);
  const buf = new Float32Array(analyser.fftSize);
  let peak = 0;
  const tick = () => {
    if (!audioCtx) return;
    analyser.getFloatTimeDomainData(buf);
    let sum = 0;
    for (const v of buf) sum += v * v;
    const rms = Math.sqrt(sum / buf.length);
    peak = Math.max(peak, rms);
    el("level").style.width = `${Math.min(100, rms * 400).toFixed(1)}%`;
    if (peak > 0.01) {
      verdict("r3-verdict", `Ses: GEÇTİ — gerçek ses akıyor (tepe RMS ${peak.toFixed(3)})`, true);
    }
    rafId = requestAnimationFrame(tick);
  };
  tick();
}

function stopStream() {
  if (rafId) cancelAnimationFrame(rafId);
  rafId = null;
  if (audioCtx) audioCtx.close();
  audioCtx = null;
  el("level").style.width = "0%";
  if (!stream) return;
  stream.getTracks().forEach((t) => t.stop());
  stream = null;
  video.srcObject = null;
  video.classList.remove("on");
  el("stop").disabled = true;
  log("akış durduruldu");
}

el("share").addEventListener("click", () => capture("screen"));
el("camera").addEventListener("click", () => capture("camera"));
el("stop").addEventListener("click", stopStream);

log(`getDisplayMedia var mı: ${typeof navigator.mediaDevices?.getDisplayMedia === "function"}`);
log(`UA: ${navigator.userAgent}`);

const tauri = window.__TAURI__;
if (!tauri?.event) {
  log("UYARI: window.__TAURI__.event yok, PTT olayları dinlenemiyor");
} else {
  tauri.event.listen("ptt", ({ payload }) => {
    if (payload === "Pressed") pressed++;
    if (payload === "Released") released++;
    el("c-press").textContent = pressed;
    el("c-release").textContent = released;
    log(`PTT F8 ${payload}`);
    if (pressed > 0 && released > 0) {
      verdict("r2-verdict", "R2: GEÇTİ — keyup tetikleniyor, push-to-talk yapılabilir", true);
    } else if (pressed > 0) {
      verdict("r2-verdict", "R2: yalnız Pressed geldi — bırakmayı bekliyorum", false);
    }
  });
  log("PTT dinleyicisi hazır. Pencereyi arka plana al, F8'e bas ve bırak.");
}
