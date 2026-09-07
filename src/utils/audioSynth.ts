/**
 * Web Audio API synthesizer emulating MediaTek MRE / Nokia S30+ sound chip
 */

class AudioSynthesizer {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;

  private init() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.ctx = new AudioContextClass();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public playTone(freq: number, durationMs: number = 100, waveType: OscillatorType = 'square', volume: number = 0.2) {
    if (this.isMuted) return;
    try {
      this.init();
      if (!this.ctx) return;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = waveType;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

      gain.gain.setValueAtTime(volume, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + durationMs / 1000);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + durationMs / 1000);
    } catch (e) {
      console.warn('Audio playTone error:', e);
    }
  }

  // Pre-configured retro sound effects
  public playSoundEffect(name: 'click' | 'jump' | 'coin' | 'hit' | 'gameover' | 'powerup') {
    if (this.isMuted) return;
    switch (name) {
      case 'click':
        this.playTone(800, 30, 'square', 0.1);
        break;
      case 'jump':
        this.playSweep(150, 600, 120, 'square');
        break;
      case 'coin':
        this.playTone(987.77, 80, 'square', 0.25); // B5
        setTimeout(() => this.playTone(1318.51, 150, 'square', 0.25), 80); // E6
        break;
      case 'hit':
        this.playTone(120, 150, 'sawtooth', 0.3);
        break;
      case 'gameover':
        this.playSweep(400, 100, 300, 'sawtooth');
        break;
      case 'powerup':
        this.playSweep(300, 900, 200, 'triangle');
        break;
    }
  }

  private playSweep(startFreq: number, endFreq: number, durationMs: number, waveType: OscillatorType = 'square') {
    if (this.isMuted) return;
    try {
      this.init();
      if (!this.ctx) return;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = waveType;
      osc.frequency.setValueAtTime(startFreq, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(Math.max(10, endFreq), this.ctx.currentTime + durationMs / 1000);

      gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + durationMs / 1000);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + durationMs / 1000);
    } catch (e) {
      console.warn('Audio sweep error:', e);
    }
  }
}

export const soundManager = new AudioSynthesizer();
