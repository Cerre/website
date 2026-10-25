// A stand-in for the screen, camera and mic, so the board works without any devices.
// The screen has text and website links that change every 10 s (material for OCR later);
// the camera shows motion and a frame counter, so a stall is easy to see; the mic is a
// quiet tone with a beep each second, so dropouts and audio sync are easy to hear.

import type { Mixer } from "./mixer";

const LINKS = [
  "https://github.com/bluenviron/mediamtx",
  "https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API",
  "https://gstreamer.freedesktop.org/documentation/",
  "https://tesseract-ocr.github.io/tessdoc/",
  "https://docs.python.org/3/library/asyncio.html",
  "https://filipcederquist.com/live",
  "https://nextjs.org/docs/app",
  "https://www.raspberrypi.com/documentation/",
];

const CODE = [
  "async def stream_token():",
  "    resp = await _control(\"POST\", \"/token\")",
  "    if resp.status_code != 200:",
  "        raise HTTPException(status_code=503)",
  "    return resp.json()",
  "",
  "const pc = new RTCPeerConnection();",
  "pc.addTransceiver(track, { direction: \"sendonly\" });",
  "await pc.setLocalDescription(await pc.createOffer());",
  "",
  "$ docker compose up -d --build",
  "$ curl -s localhost:8000/auth/me",
  "",
];

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return [c, c.getContext("2d")!] as const;
}

/** Start the test source on `mixer`; returns a function that stops it. */
export function startTestSource(mixer: Mixer) {
  const [screen, s] = canvas(1920, 1080);
  const [cam, c] = canvas(1280, 720);
  let frame = 0;
  const started = performance.now();

  const drawScreen = () => {
    const t = (performance.now() - started) / 1000;
    s.fillStyle = "#1e1e2e";
    s.fillRect(0, 0, 1920, 1080);

    s.fillStyle = "#cdd6f4";
    s.font = "bold 64px monospace";
    s.fillText(new Date().toLocaleTimeString("sv-SE"), 80, 120);
    s.font = "28px sans-serif";
    s.fillStyle = "#a6adc8";
    s.fillText("Test source: no camera, screen or mic in use", 80, 170);

    // Scrolling code, one line every half second
    s.font = "26px monospace";
    const first = Math.floor(t * 2);
    for (let i = 0; i < 18; i++) {
      s.fillStyle = "#a6e3a1";
      s.fillText(CODE[(first + i) % CODE.length], 80, 260 + i * 40);
    }

    // Three links, a new set every 10 s
    s.fillStyle = "#313244";
    s.fillRect(1060, 230, 780, 300);
    s.font = "bold 30px sans-serif";
    s.fillStyle = "#f9e2af";
    s.fillText("Links", 1090, 280);
    s.font = "26px sans-serif";
    s.fillStyle = "#89b4fa";
    const set = Math.floor(t / 10);
    for (let i = 0; i < 3; i++) s.fillText(LINKS[(set * 3 + i) % LINKS.length], 1090, 340 + i * 60);
  };

  const drawCam = () => {
    c.fillStyle = "#11111b";
    c.fillRect(0, 0, 1280, 720);
    const x = 640 + Math.sin(frame / 20) * 400;
    c.fillStyle = "#f38ba8";
    c.beginPath();
    c.arc(x, 360, 90, 0, 2 * Math.PI);
    c.fill();
    c.fillStyle = "#fff";
    c.font = "bold 72px monospace";
    c.fillText(`frame ${frame}`, 60, 110);
  };

  // A quiet tone, and a beep at the start of each second
  const ctx = mixer.audio;
  const out = ctx.createGain();
  const tone = ctx.createOscillator();
  const toneGain = ctx.createGain();
  tone.frequency.value = 220;
  toneGain.gain.value = 0.02;
  tone.connect(toneGain).connect(out);
  const beep = ctx.createOscillator();
  const beepGain = ctx.createGain();
  beep.frequency.value = 880;
  beepGain.gain.value = 0;
  beep.connect(beepGain).connect(out);
  tone.start();
  beep.start();
  let nextBeep = Math.ceil(ctx.currentTime);

  const stopFrames = mixer.onFrame(() => {
    frame++;
    drawScreen();
    drawCam();
    // Schedule the coming second's beep ahead of time, so it lands exactly
    while (nextBeep < ctx.currentTime + 1) {
      beepGain.gain.setValueAtTime(0.2, nextBeep);
      beepGain.gain.setValueAtTime(0, nextBeep + 0.08);
      nextBeep++;
    }
  });

  mixer.setSource("screen", screen);
  mixer.setSource("cam", cam);
  mixer.setMic(out);

  return () => {
    stopFrames();
    tone.stop();
    beep.stop();
    mixer.setSource("screen", null);
    mixer.setSource("cam", null);
    mixer.setMic(null);
  };
}
