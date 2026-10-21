// Procedural Web Audio API sound and music synthesizer
// Hardened for Safari WebKit & Chrome with zero-deadlock, auto-cleanup, and latencyHint: 'playback'

class SoundManager {
  constructor() {
    this.ctx = null;
    this.available = true;
    this.soundEnabled = true;
    this.musicEnabled = true;
    this.bgmTimer = null;
    this.bgmStep = 0;
    this.isPlayingBGM = false;
    this.activeVoices = 0;
    this.MAX_VOICES = 8;

    // Load sound preference from localStorage
    try {
      const savedMusic = localStorage.getItem('tag_music_enabled');
      if (savedMusic !== null) {
        this.musicEnabled = savedMusic === 'true';
      }
      const savedSound = localStorage.getItem('tag_sound_enabled');
      if (savedSound !== null) {
        this.soundEnabled = savedSound === 'true';
      }
    } catch (e) {}
  }

  toggleSound() {
    this.soundEnabled = !this.soundEnabled;
    try {
      localStorage.setItem('tag_sound_enabled', this.soundEnabled);
    } catch (e) {}
    return this.soundEnabled;
  }

  init() {
    if (!this.available) return;
    try {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) {
          this.available = false;
          return;
        }
        // latencyHint: 'playback' strictly prevents WebKit from requesting AUVoiceIO / Microphone / TCC
        this.ctx = new AudioCtx({ latencyHint: 'playback' });
      }

      if (this.ctx && this.ctx.state === 'suspended') {
        const p = this.ctx.resume();
        if (p && typeof p.catch === 'function') {
          p.catch(() => {});
        }
      }
    } catch (e) {
      console.warn('[SoundManager] AudioContext init warning:', e);
      // Soft-disable audio without throwing or hanging
      this.available = false;
    }
  }

  toggleMusic() {
    try {
      this.init();
      this.musicEnabled = !this.musicEnabled;
      localStorage.setItem('tag_music_enabled', this.musicEnabled);
      if (this.musicEnabled) {
        this.startBGM();
      } else {
        this.stopBGM();
      }
    } catch (e) {}
    return this.musicEnabled;
  }

  getSafeTime() {
    if (!this.ctx) return 0.01;
    return Math.max(this.ctx.currentTime || 0, 0.01) + 0.005;
  }

  // Safe tone generator with automatic garbage collection and node disconnection
  playTone({ type = 'sine', freqStart, freqEnd, duration = 0.1, gainVal = 0.2 }) {
    if (!this.soundEnabled || !this.available) return;
    if (this.activeVoices >= this.MAX_VOICES) return;

    try {
      this.init();
      if (!this.ctx || this.ctx.state !== 'running') return;

      const ctx = this.ctx;
      const now = this.getSafeTime();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      this.activeVoices++;

      osc.type = type;
      osc.frequency.setValueAtTime(freqStart, now);
      if (freqEnd && freqEnd !== freqStart) {
        osc.frequency.linearRampToValueAtTime(freqEnd, now + duration);
      }

      gain.gain.setValueAtTime(gainVal, now);
      gain.gain.linearRampToValueAtTime(0.0001, now + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      const cleanup = () => {
        try {
          osc.disconnect();
          gain.disconnect();
        } catch (e) {}
        this.activeVoices = Math.max(0, this.activeVoices - 1);
      };

      osc.onended = cleanup;
      osc.start(now);
      osc.stop(now + duration + 0.02);

      // Failsafe auto-disconnect timer in case onended doesn't trigger
      setTimeout(cleanup, Math.ceil((duration + 0.1) * 1000));
    } catch (e) {
      this.activeVoices = Math.max(0, this.activeVoices - 1);
    }
  }

  playClick() {
    this.playTone({
      type: 'sine',
      freqStart: 600,
      freqEnd: 880,
      duration: 0.07,
      gainVal: 0.16
    });
  }

  playJump() {
    this.playTone({
      type: 'triangle',
      freqStart: 260,
      freqEnd: 580,
      duration: 0.14,
      gainVal: 0.22
    });
  }

  playBounce() {
    this.playTone({
      type: 'sine',
      freqStart: 180,
      freqEnd: 680,
      duration: 0.22,
      gainVal: 0.3
    });
  }

  playTeleport() {
    this.playTone({
      type: 'sawtooth',
      freqStart: 880,
      freqEnd: 220,
      duration: 0.22,
      gainVal: 0.16
    });
  }

  playTag() {
    this.playTone({
      type: 'square',
      freqStart: 350,
      freqEnd: 120,
      duration: 0.18,
      gainVal: 0.35
    });
    setTimeout(() => {
      this.playTone({
        type: 'sine',
        freqStart: 987,
        freqEnd: 880,
        duration: 0.22,
        gainVal: 0.22
      });
    }, 40);
  }

  playBuff() {
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, idx) => {
      setTimeout(() => {
        this.playTone({
          type: 'sine',
          freqStart: freq,
          freqEnd: freq,
          duration: 0.12,
          gainVal: 0.18
        });
      }, idx * 55);
    });
  }

  playCountdown() {
    this.playTone({
      type: 'sine',
      freqStart: 440,
      freqEnd: 440,
      duration: 0.11,
      gainVal: 0.2
    });
  }

  playWhistle() {
    this.playTone({
      type: 'triangle',
      freqStart: 1760,
      freqEnd: 1880,
      duration: 0.28,
      gainVal: 0.25
    });
  }

  playSplash() {
    this.playTone({
      type: 'triangle',
      freqStart: 380,
      freqEnd: 160,
      duration: 0.16,
      gainVal: 0.22
    });
  }

  playWin() {
    const chords = [
      { freqs: [523.25, 659.25], delay: 0 },
      { freqs: [587.33, 739.99], delay: 160 },
      { freqs: [659.25, 830.61], delay: 320 },
      { freqs: [783.99, 987.77, 1174.66], delay: 480 }
    ];
    chords.forEach(({ freqs, delay }) => {
      setTimeout(() => {
        freqs.forEach(f => {
          this.playTone({
            type: 'triangle',
            freqStart: f,
            freqEnd: f,
            duration: 0.26,
            gainVal: 0.12
          });
        });
      }, delay);
    });
  }

  startBGM() {
    try {
      if (!this.musicEnabled || !this.available || this.isPlayingBGM) return;
      this.init();
      if (!this.ctx) return;
      this.isPlayingBGM = true;
      this.bgmStep = 0;

      const melody = [
        523.25, null, 659.25, null, 783.99, 659.25, 523.25, null,
        587.33, null, 783.99, null, 659.25, null, 523.25, null,
        440.00, null, 523.25, null, 659.25, null, 587.33, 523.25,
        493.88, null, 587.33, null, 523.25, null, null, null
      ];
      const bass = [
        261.63, null, 261.63, null, 329.63, null, 261.63, null,
        293.66, null, 293.66, null, 392.00, null, 293.66, null,
        220.00, null, 220.00, null, 261.63, null, 220.00, null,
        196.00, null, 246.94, null, 261.63, null, 261.63, null
      ];

      const stepInterval = 140;
      const playNextNote = () => {
        if (!this.musicEnabled || !this.isPlayingBGM || !this.available) return;

        try {
          if (this.ctx && this.ctx.state === 'running') {
            const mFreq = melody[this.bgmStep % melody.length];
            const bFreq = bass[this.bgmStep % bass.length];

            if (mFreq) {
              this.playTone({
                type: 'triangle',
                freqStart: mFreq,
                freqEnd: mFreq,
                duration: 0.13,
                gainVal: 0.06
              });
            }

            if (bFreq) {
              this.playTone({
                type: 'sine',
                freqStart: bFreq / 2,
                freqEnd: bFreq / 2,
                duration: 0.18,
                gainVal: 0.08
              });
            }
          }
        } catch (e) {}

        this.bgmStep++;
        this.bgmTimer = setTimeout(playNextNote, stepInterval);
      };

      playNextNote();
    } catch (e) {
      this.isPlayingBGM = false;
    }
  }

  stopBGM() {
    this.isPlayingBGM = false;
    if (this.bgmTimer) {
      clearTimeout(this.bgmTimer);
      this.bgmTimer = null;
    }
  }
}

export const soundManager = new SoundManager();
