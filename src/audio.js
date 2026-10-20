// Procedural Web Audio API sound and music synthesizer

class SoundManager {
  constructor() {
    this.ctx = null;
    this.soundEnabled = true;
    this.musicEnabled = true;
    this.bgmTimer = null;
    this.bgmStep = 0;
    this.isPlayingBGM = false;

    // Load sound preference from localStorage
    const savedMusic = localStorage.getItem('tag_music_enabled');
    if (savedMusic !== null) {
      this.musicEnabled = savedMusic === 'true';
    }
  }

  init() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContext();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleMusic() {
    this.init();
    this.musicEnabled = !this.musicEnabled;
    localStorage.setItem('tag_music_enabled', this.musicEnabled);
    if (this.musicEnabled) {
      this.startBGM();
    } else {
      this.stopBGM();
    }
    return this.musicEnabled;
  }

  playClick() {
    if (!this.soundEnabled) return;
    this.init();
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.08);

    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.08);
  }

  playJump() {
    if (!this.soundEnabled) return;
    this.init();
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(260, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(580, ctx.currentTime + 0.15);

    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.15);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  }

  playBounce() {
    if (!this.soundEnabled) return;
    this.init();
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.18);
    osc.frequency.exponentialRampToValueAtTime(320, ctx.currentTime + 0.32);

    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.32);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.32);
  }

  playTeleport() {
    if (!this.soundEnabled) return;
    this.init();
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(220, ctx.currentTime + 0.25);

    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.25);
  }

  playTag() {
    if (!this.soundEnabled) return;
    this.init();
    const ctx = this.ctx;
    
    // Slap noise burst + bell ring
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(350, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(120, ctx.currentTime + 0.2);

    gain.gain.setValueAtTime(0.45, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.2);

    // High accent ding
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(987.77, ctx.currentTime); // B5
    gain2.gain.setValueAtTime(0.3, ctx.currentTime);
    gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start();
    osc2.stop(ctx.currentTime + 0.3);
  }

  playBuff() {
    if (!this.soundEnabled) return;
    this.init();
    const ctx = this.ctx;
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const startTime = ctx.currentTime + idx * 0.06;
      gain.gain.setValueAtTime(0.2, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + 0.15);
    });
  }

  playCountdown() {
    if (!this.soundEnabled) return;
    this.init();
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, ctx.currentTime);
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
  }

  playWhistle() {
    if (!this.soundEnabled) return;
    this.init();
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1760, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(1900, ctx.currentTime + 0.08);
    osc.frequency.linearRampToValueAtTime(1760, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  }

  playWin() {
    if (!this.soundEnabled) return;
    this.init();
    const ctx = this.ctx;
    const chords = [
      { freqs: [523.25, 659.25, 783.99], time: 0 },
      { freqs: [587.33, 739.99, 880.00], time: 0.18 },
      { freqs: [659.25, 830.61, 987.77], time: 0.36 },
      { freqs: [783.99, 987.77, 1174.66], time: 0.54 }
    ];
    chords.forEach(({ freqs, time }) => {
      freqs.forEach(freq => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        const st = ctx.currentTime + time;
        gain.gain.setValueAtTime(0.15, st);
        gain.gain.exponentialRampToValueAtTime(0.001, st + 0.3);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(st);
        osc.stop(st + 0.3);
      });
    });
  }

  // Playful chiptune background music loop
  startBGM() {
    if (!this.musicEnabled || this.isPlayingBGM) return;
    this.init();
    this.isPlayingBGM = true;
    this.bgmStep = 0;

    // Upbeat melody pattern in C Major / Pentatonic
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

    const stepInterval = 135; // ~111 BPM
    const playNextNote = () => {
      if (!this.musicEnabled || !this.isPlayingBGM) return;

      const mFreq = melody[this.bgmStep % melody.length];
      const bFreq = bass[this.bgmStep % bass.length];
      const now = this.ctx.currentTime;

      if (mFreq) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(mFreq, now);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.16);
      }

      if (bFreq) {
        const bOsc = this.ctx.createOscillator();
        const bGain = this.ctx.createGain();
        bOsc.type = 'sine';
        bOsc.frequency.setValueAtTime(bFreq / 2, now);
        bGain.gain.setValueAtTime(0.12, now);
        bGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
        bOsc.connect(bGain);
        bGain.connect(this.ctx.destination);
        bOsc.start(now);
        bOsc.stop(now + 0.22);
      }

      this.bgmStep++;
      this.bgmTimer = setTimeout(playNextNote, stepInterval);
    };

    playNextNote();
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
