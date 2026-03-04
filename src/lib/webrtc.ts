import { supabase } from "@/integrations/supabase/client";

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

export type CallState = "idle" | "calling" | "ringing" | "connected" | "ended";

const CALL_TIMEOUT_MS = 45_000; // 45 seconds ring timeout

export interface CallSignal {
  type: "call-offer" | "call-answer" | "ice-candidate" | "call-end" | "call-reject";
  senderId: string;
  senderName: string;
  conversationId: string;
  mode: "audio" | "video";
  payload?: unknown;
}

type EventCallback = (signal: CallSignal) => void;

export class WebRTCManager {
  private pc: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private channel: ReturnType<typeof supabase.channel> | null = null;
  private conversationId: string;
  private userId: string;
  private userName: string;
  private mode: "audio" | "video" = "audio";
  private onRemoteStream: ((stream: MediaStream) => void) | null = null;
  private onCallStateChange: ((state: CallState) => void) | null = null;
  private onIncomingCall: EventCallback | null = null;
  private iceCandidateBuffer: RTCIceCandidateInit[] = [];
  private _state: CallState = "idle";
  private ringTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(
    conversationId: string,
    userId: string,
    userName: string
  ) {
    this.conversationId = conversationId;
    this.userId = userId;
    this.userName = userName;
  }

  get state() {
    return this._state;
  }

  private setState(s: CallState) {
    this._state = s;
    this.onCallStateChange?.(s);
  }

  // ── Event handlers ──────────────────────────────────────────────
  setOnRemoteStream(cb: (stream: MediaStream) => void) {
    this.onRemoteStream = cb;
  }
  setOnCallStateChange(cb: (state: CallState) => void) {
    this.onCallStateChange = cb;
  }
  setOnIncomingCall(cb: EventCallback) {
    this.onIncomingCall = cb;
  }

  // ── Subscribe to signaling channel ──────────────────────────────
  subscribe() {
    const channelName = `call-${this.conversationId}`;
    this.channel = supabase.channel(channelName, {
      config: { broadcast: { self: false } },
    });

    this.channel
      .on("broadcast", { event: "call-signal" }, ({ payload }) => {
        const signal = payload as CallSignal;
        if (signal.senderId === this.userId) return;
        this.handleSignal(signal);
      })
      .subscribe();
  }

  unsubscribe() {
    if (this.channel) {
      supabase.removeChannel(this.channel);
      this.channel = null;
    }
  }

  private async handleSignal(signal: CallSignal) {
    switch (signal.type) {
      case "call-offer":
        this.onIncomingCall?.(signal);
        break;
      case "call-answer":
        await this.handleAnswer(signal.payload as RTCSessionDescriptionInit);
        break;
      case "ice-candidate":
        await this.handleIceCandidate(signal.payload as RTCIceCandidateInit);
        break;
      case "call-end":
      case "call-reject":
        this.cleanup();
        this.setState("ended");
        break;
    }
  }

  private broadcast(signal: Omit<CallSignal, "senderId" | "senderName" | "conversationId">) {
    this.channel?.send({
      type: "broadcast",
      event: "call-signal",
      payload: {
        ...signal,
        senderId: this.userId,
        senderName: this.userName,
        conversationId: this.conversationId,
      },
    });
  }

  // ── Initiate call ───────────────────────────────────────────────
  async startCall(mode: "audio" | "video") {
    this.mode = mode;
    this.setState("calling");

    await this.setupMedia(mode);
    this.createPeerConnection();

    // Add local tracks
    this.localStream?.getTracks().forEach((track) => {
      this.pc!.addTrack(track, this.localStream!);
    });

    // Create and send offer
    const offer = await this.pc!.createOffer();
    await this.pc!.setLocalDescription(offer);

    this.broadcast({
      type: "call-offer",
      mode,
      payload: offer,
    });

    // Set state to ringing (waiting for remote answer)
    this.setState("ringing");

    // Auto-end call if not answered within timeout
    this.ringTimeout = setTimeout(() => {
      if (this._state === "ringing" || this._state === "calling") {
        this.endCall();
      }
    }, CALL_TIMEOUT_MS);
  }

  // ── Answer incoming call ────────────────────────────────────────
  async answerCall(offer: RTCSessionDescriptionInit, mode: "audio" | "video") {
    this.mode = mode;
    this.setState("connected");

    await this.setupMedia(mode);
    this.createPeerConnection();

    // Add local tracks
    this.localStream?.getTracks().forEach((track) => {
      this.pc!.addTrack(track, this.localStream!);
    });

    await this.pc!.setRemoteDescription(new RTCSessionDescription(offer));

    // Process buffered candidates
    for (const candidate of this.iceCandidateBuffer) {
      await this.pc!.addIceCandidate(new RTCIceCandidate(candidate));
    }
    this.iceCandidateBuffer = [];

    const answer = await this.pc!.createAnswer();
    await this.pc!.setLocalDescription(answer);

    this.broadcast({
      type: "call-answer",
      mode,
      payload: answer,
    });
  }

  rejectCall() {
    this.broadcast({ type: "call-reject", mode: this.mode });
    this.cleanup();
    this.setState("idle");
  }

  endCall() {
    this.broadcast({ type: "call-end", mode: this.mode });
    this.cleanup();
    this.setState("ended");
  }

  // ── Media controls ──────────────────────────────────────────────
  toggleMute(): boolean {
    const audioTrack = this.localStream?.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      return !audioTrack.enabled; // true = muted
    }
    return false;
  }

  toggleCamera(): boolean {
    const videoTrack = this.localStream?.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      return !videoTrack.enabled; // true = camera off
    }
    return false;
  }

  getLocalStream() {
    return this.localStream;
  }

  getRemoteStream() {
    return this.remoteStream;
  }

  // ── Internal ────────────────────────────────────────────────────
  private async setupMedia(mode: "audio" | "video") {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: mode === "video",
      });
    } catch (err) {
      console.error("Failed to get media:", err);
      throw err;
    }
  }

  private createPeerConnection() {
    this.pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.broadcast({
          type: "ice-candidate",
          mode: this.mode,
          payload: event.candidate.toJSON(),
        });
      }
    };

    this.pc.ontrack = (event) => {
      this.remoteStream = event.streams[0];
      this.onRemoteStream?.(event.streams[0]);
    };

    this.pc.onconnectionstatechange = () => {
      if (this.pc?.connectionState === "connected") {
        this.setState("connected");
      } else if (
        this.pc?.connectionState === "disconnected" ||
        this.pc?.connectionState === "failed"
      ) {
        this.cleanup();
        this.setState("ended");
      }
    };
  }

  private async handleAnswer(answer: RTCSessionDescriptionInit) {
    if (!this.pc) return;
    // Clear ring timeout — call was answered
    if (this.ringTimeout) {
      clearTimeout(this.ringTimeout);
      this.ringTimeout = null;
    }
    await this.pc.setRemoteDescription(new RTCSessionDescription(answer));
    this.setState("connected");

    // Process buffered candidates
    for (const candidate of this.iceCandidateBuffer) {
      await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
    }
    this.iceCandidateBuffer = [];
  }

  private async handleIceCandidate(candidate: RTCIceCandidateInit) {
    if (!this.pc || !this.pc.remoteDescription) {
      this.iceCandidateBuffer.push(candidate);
      return;
    }
    try {
      await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      console.error("Error adding ICE candidate:", err);
    }
  }

  cleanup() {
    if (this.ringTimeout) {
      clearTimeout(this.ringTimeout);
      this.ringTimeout = null;
    }
    this.localStream?.getTracks().forEach((t) => t.stop());
    this.remoteStream?.getTracks().forEach((t) => t.stop());
    this.pc?.close();
    this.localStream = null;
    this.remoteStream = null;
    this.pc = null;
    this.iceCandidateBuffer = [];
  }

  destroy() {
    this.cleanup();
    this.unsubscribe();
  }
}
