// AudioWorklet processor: converts mic Float32 frames to 16-bit PCM and posts
// ~100ms chunks to the main thread (AssemblyAI streaming accepts 50–1000ms per
// message). Runs at the AudioContext sample rate; the main thread tells
// AssemblyAI which rate that is.
const CHUNK_SECONDS = 0.1

class PcmRecorderProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this.samplesPerChunk = Math.round(sampleRate * CHUNK_SECONDS)
    this.chunk = new Int16Array(this.samplesPerChunk)
    this.offset = 0
  }

  process(inputs) {
    const channel = inputs[0]?.[0]
    if (!channel) return true

    for (let i = 0; i < channel.length; i++) {
      const sample = Math.max(-1, Math.min(1, channel[i]))
      this.chunk[this.offset++] = sample < 0 ? sample * 0x8000 : sample * 0x7fff
      if (this.offset === this.samplesPerChunk) {
        this.port.postMessage(this.chunk.buffer, [this.chunk.buffer])
        this.chunk = new Int16Array(this.samplesPerChunk)
        this.offset = 0
      }
    }
    return true
  }
}

registerProcessor("pcm-recorder", PcmRecorderProcessor)
