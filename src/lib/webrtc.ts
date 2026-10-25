// WebRTC with the media server: WHIP to publish, WHEP to watch. Each is one POST with our
// offer; the answer comes back in the response.

export const STREAM_URL = process.env.NEXT_PUBLIC_STREAM_URL ?? "https://stream.filipcederquist.com";

export type Session = { pc: RTCPeerConnection; stop: () => void };

/** Offer, wait for our network addresses so they all go in the one offer, POST, apply the answer.
 *  `stop` ends the session on the server too, so the other side learns at once instead of
 *  after a timeout. */
async function negotiate(pc: RTCPeerConnection, url: string, headers: Record<string, string> = {}): Promise<Session> {
  await pc.setLocalDescription(await pc.createOffer());
  await new Promise<void>((done) => {
    if (pc.iceGatheringState === "complete") return done();
    pc.onicegatheringstatechange = () => pc.iceGatheringState === "complete" && done();
    setTimeout(done, 2000);
  });
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/sdp", ...headers },
    body: pc.localDescription!.sdp,
  });
  if (!res.ok) throw new Error(`${res.status} ${(await res.text()).trim()}`);
  await pc.setRemoteDescription({ type: "answer", sdp: await res.text() });
  const session = res.headers.get("Location");
  return {
    pc,
    stop: () => {
      if (session) fetch(new URL(session, url), { method: "DELETE" }).catch(() => {});
      pc.close();
    },
  };
}

/** Publish one video and one audio track to `path`. */
export async function whip(path: string, stream: MediaStream, token: string, maxBitrate: number) {
  const pc = new RTCPeerConnection();
  const video = pc.addTransceiver(stream.getVideoTracks()[0], {
    direction: "sendonly",
    sendEncodings: [{ maxBitrate }],
  });
  // H.264 is what the viewers and the recorder decode everywhere
  const codecs = RTCRtpReceiver.getCapabilities("video")?.codecs ?? [];
  video.setCodecPreferences(codecs.filter((c) => c.mimeType === "video/H264"));
  stream.getAudioTracks().forEach((t) => pc.addTransceiver(t, { direction: "sendonly" }));
  try {
    return await negotiate(pc, `${STREAM_URL}/${path}/whip`, { Authorization: `Bearer ${token}` });
  } catch (e) {
    pc.close();
    throw new Error(`The media server refused the stream (${e instanceof Error ? e.message : e})`);
  }
}

/** Watch `path`; `onStream` gets the incoming stream once its tracks arrive. */
export async function whep(path: string, onStream: (s: MediaStream) => void) {
  const pc = new RTCPeerConnection();
  pc.addTransceiver("video", { direction: "recvonly" });
  pc.addTransceiver("audio", { direction: "recvonly" });
  const stream = new MediaStream();
  pc.ontrack = (e) => {
    stream.addTrack(e.track);
    onStream(stream);
  };
  try {
    return await negotiate(pc, `${STREAM_URL}/${path}/whep`);
  } catch (e) {
    pc.close();
    throw e;
  }
}
