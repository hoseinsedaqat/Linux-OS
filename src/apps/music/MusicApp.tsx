import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Music2, Pause, Play, RotateCcw, SkipBack, SkipForward, Volume2, AlertTriangle, FolderOpen } from 'lucide-react';
import type { AppWindowProps } from '@/core/apps/types';
import { useT } from '@/core/localization/i18n';
import { useWindows } from '@/core/window-manager/windowsStore';
import { useFiles } from '@/core/virtual-filesystem/fsStore';
import { FOLDER_IDS, childrenOf } from '@/core/virtual-filesystem/fsUtils';
import { cn } from '@/utils';

/**
 * The simulator ships with generated tones (Web Audio) rather than copyrighted
 * audio, so the player is always demonstrable — and any audio file the user
 * drops into ~/Music in the virtual file system appears in the playlist.
 */

interface Track {
  id: string;
  title: string;
  artist: string;
  /** A synth chord recipe, or a data URL for a real file. */
  notes?: number[];
  src?: string;
}

const SYNTH_TRACKS: Track[] = [
  { id: 'synth-boot', title: 'NOVA Boot Chime', artist: 'NOVA Labs', notes: [523.25, 659.25, 783.99] },
  { id: 'synth-desktop', title: 'Desktop Drift', artist: 'NOVA Labs', notes: [440, 554.37, 659.25] },
  { id: 'synth-night', title: 'Night Mode', artist: 'NOVA Labs', notes: [349.23, 440, 523.25] },
  { id: 'synth-signal', title: 'Signal Rain', artist: 'NOVA Labs', notes: [587.33, 698.46, 880] },
];

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function MusicApp(_props: AppWindowProps) {
  const t = useT();
  const openApp = useWindows((state) => state.openApp);
  const nodes = useFiles((state) => state.nodes);
  const [synthIndex, setSynthIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(0.35);
  const [error, setError] = useState<string | null>(null);
  const [level, setLevel] = useState(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const frameRef = useRef(0);

  const files = useMemo(
    () =>
      childrenOf(nodes, FOLDER_IDS.music)
        .filter((node) => node.kind === 'binary' || /\.(mp3|wav|ogg|oga|flac|m4a|aac)$/i.test(node.name))
        .map<Track>((node) => ({
          id: node.id,
          title: node.name.replace(/\.[^.]+$/, ''),
          artist: '~/Music',
          src: node.content ?? undefined,
        })),
    [nodes],
  );

  const playlist = useMemo(() => [...files, ...SYNTH_TRACKS], [files]);
  const track = playlist[Math.min(synthIndex, playlist.length - 1)];

  const stopAll = useCallback(() => {
    window.cancelAnimationFrame(frameRef.current);
    if (ctxRef.current) {
      void ctxRef.current.close();
      ctxRef.current = null;
      analyserRef.current = null;
      gainRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }
    setPlaying(false);
    setLevel(0);
  }, []);

  useEffect(() => stopAll, [stopAll]);

  const startSynth = useCallback(() => {
    if (!track?.notes) return;
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) {
      setError(t('This browser has no Web Audio support.'));
      return;
    }
    const ctx = new Ctor();
    const gain = ctx.createGain();
    gain.gain.value = 0;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    gain.connect(analyser);
    analyser.connect(ctx.destination);
    const now = ctx.currentTime;
    track.notes.forEach((frequency, index) => {
      const osc = ctx.createOscillator();
      osc.type = index === 0 ? 'sine' : 'triangle';
      osc.frequency.value = frequency;
      const voice = ctx.createGain();
      voice.gain.value = 0.22 / track.notes!.length;
      osc.connect(voice);
      voice.connect(gain);
      osc.start(now);
      osc.stop(now + 4);
    });
    gain.gain.linearRampToValueAtTime(volume, now + 0.15);
    gain.gain.setValueAtTime(volume, now + 3.6);
    gain.gain.linearRampToValueAtTime(0, now + 4);
    ctxRef.current = ctx;
    analyserRef.current = analyser;
    gainRef.current = gain;
    setPlaying(true);
    const data = new Uint8Array(analyser.frequencyBinCount);
    let start = performance.now();
    const loop = () => {
      const analyserNode = analyserRef.current;
      if (!analyserNode) return;
      analyserNode.getByteFrequencyData(data);
      const avg = data.reduce((sum, value) => sum + value, 0) / data.length / 255;
      setLevel(avg);
      if (performance.now() - start > 3900) {
        stopAll();
        return;
      }
      frameRef.current = window.requestAnimationFrame(loop);
    };
    frameRef.current = window.requestAnimationFrame(loop);
    window.setTimeout(() => {
      if (ctxRef.current === ctx) {
        stopAll();
        setSynthIndex((index) => (index + 1) % playlist.length);
      }
    }, 4000);
  }, [track, volume, t, stopAll, playlist.length]);

  const startFile = useCallback(() => {
    if (!track?.src) {
      setError(t('This track has no audio data.'));
      return;
    }
    const audio = new Audio(track.src);
    audio.volume = volume;
    audio.onended = () => {
      setPlaying(false);
      setSynthIndex((index) => (index + 1) % playlist.length);
    };
    audio.onerror = () => {
      setPlaying(false);
      setError(t('The file could not be played by this browser.'));
    };
    void audio.play().then(() => setPlaying(true)).catch(() => {
      setError(t('The browser blocked playback — press Play again.'));
    });
    audioRef.current = audio;
    setPlaying(true);
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    const capturable = audio as HTMLAudioElement & { captureStream?: () => MediaStream };
    if (Ctor && capturable.captureStream) {
      try {
        const ctx = new Ctor();
        const source = ctx.createMediaStreamSource(capturable.captureStream());
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        ctxRef.current = ctx;
        analyserRef.current = analyser;
        const data = new Uint8Array(analyser.frequencyBinCount);
        const loop = () => {
          const node = analyserRef.current;
          if (!node) return;
          node.getByteFrequencyData(data);
          setLevel(data.reduce((sum, value) => sum + value, 0) / data.length / 255);
          frameRef.current = window.requestAnimationFrame(loop);
        };
        frameRef.current = window.requestAnimationFrame(loop);
      } catch {
        /* visualiser is optional */
      }
    }
  }, [track, volume, playlist.length, t]);

  const toggle = () => {
    if (playing) {
      stopAll();
      return;
    }
    setError(null);
    if (track?.src) startFile();
    else startSynth();
  };

  const changeTrack = (delta: number) => {
    stopAll();
    setError(null);
    setSynthIndex((index) => (index + delta + playlist.length) % playlist.length);
  };

  const progress = playing ? 0.35 : 0;
  const bars = 42;

  return (
    <div className="app music">
      <div className="music__layout">
        <aside className="music__list">
          <div className="music__list-title">
            <Music2 size={13} /> {t('Playlist')}
          </div>
          {playlist.map((item, index) => (
            <button
              key={item.id}
              className={cn('music__track', index === synthIndex && 'is-active')}
              onClick={() => {
                stopAll();
                setError(null);
                setSynthIndex(index);
              }}
            >
              <span className="music__track-title">{item.title}</span>
              <span className="music__track-artist">{item.artist}</span>
            </button>
          ))}
        </aside>

        <section className="music__stage">
          <div className={cn('music__art', playing && 'is-playing')}>
            <div className="music__art-rings" />
            <Music2 size={44} strokeWidth={1.3} />
          </div>

          <div className="music__meta">
            <strong>{track?.title ?? t('Nothing selected')}</strong>
            <span>{track?.artist ?? ''}</span>
          </div>

          <div className="music__progress">
            <span>{formatTime(progress * 4)}</span>
            <div className="music__bar">
              <div className="music__bar-fill" style={{ width: `${progress * 100}%` }} />
            </div>
            <span>0:04</span>
          </div>

          <div className="music__controls">
            <button className="icon-btn" onClick={() => changeTrack(-1)} aria-label={t('Previous track')}>
              <SkipBack size={15} />
            </button>
            <button className="music__play" onClick={toggle} aria-label={playing ? t('Pause') : t('Play')}>
              {playing ? <Pause size={20} /> : <Play size={20} />}
            </button>
            <button className="icon-btn" onClick={() => changeTrack(1)} aria-label={t('Next track')}>
              <SkipForward size={15} />
            </button>
          </div>

          <div className="music__volume">
            <Volume2 size={14} />
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onChange={(event) => {
                const value = Number(event.target.value);
                setVolume(value);
                if (gainRef.current) gainRef.current.gain.value = value;
                if (audioRef.current) audioRef.current.volume = value;
              }}
              aria-label={t('Volume')}
            />
            <span>{Math.round(volume * 100)}%</span>
          </div>

          <div className="music__visualizer" aria-hidden>
            {Array.from({ length: bars }, (_, index) => {
              const wave = 0.35 + 0.65 * Math.abs(Math.sin(index * 0.7 + level * 6));
              return (
                <span
                  key={index}
                  className="music__visualizer-bar"
                  style={{ height: `${playing ? Math.max(4, wave * level * 220) : 4}px` }}
                />
              );
            })}
          </div>

          {error && (
            <div className="music__error">
              <AlertTriangle size={13} /> {error}
            </div>
          )}

          <div className="music__hint">
            <RotateCcw size={11} />{' '}
            {t('Bundled tracks are synthesised with Web Audio — the player is a working demo, not a media library.')}
            　
            <button className="bsearch__link-btn" onClick={() => openApp('files', { folderPath: '~/Music' })}>
              <FolderOpen size={11} /> {t('Open ~/Music')}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
