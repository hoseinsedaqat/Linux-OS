import { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, Clock, Cpu, HardDrive, MemoryStick, Trash2, X } from 'lucide-react';
import type { AppWindowProps } from '@/core/apps/types';
import { useWindows } from '@/core/window-manager/windowsStore';
import { useFiles } from '@/core/virtual-filesystem/fsStore';
import { estimateUsage } from '@/core/persistence/db';
import { useUptime } from '@/hooks';
import { useT } from '@/core/localization/i18n';
import { AppIcon } from '@/components/common/AppIcon';
import { APP_META } from '@/core/apps/appMeta';
import { fileSize, formatBytes } from '@/utils';

function Sparkline({ values, color, height = 44 }: { values: number[]; color: string; height?: number }) {
  const width = 240;
  const max = Math.max(100, ...values);
  const points = values
    .map((value, index) => {
      const x = (index / Math.max(1, values.length - 1)) * width;
      const y = height - (value / max) * (height - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="monitor__spark" preserveAspectRatio="none">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
      <polygon points={`0,${height} ${points} ${width},${height}`} fill={color} opacity="0.12" />
    </svg>
  );
}

export function SystemMonitorApp(_props: AppWindowProps) {
  const t = useT();
  const windows = useWindows((state) => state.windows);
  const focusWindow = useWindows((state) => state.focusWindow);
  const closeWindow = useWindows((state) => state.closeWindow);
  const minimizeWindow = useWindows((state) => state.minimizeWindow);
  const nodes = useFiles((state) => state.nodes);
  const uptime = useUptime();
  const [cpu, setCpu] = useState<number[]>(() => Array.from({ length: 40 }, (_, index) => 12 + Math.sin(index / 3) * 6));
  const [memory, setMemory] = useState<number[]>(() => Array.from({ length: 40 }, () => 46));
  const [fps, setFps] = useState(60);
  const [usage, setUsage] = useState<{ usage: number; quota: number } | null>(null);
  const [real, setReal] = useState<{ heap: number | null; heapLimit: number | null; online: boolean; cores: number }>({
    heap: null,
    heapLimit: null,
    online: true,
    cores: 0,
  });
  const cpuRef = useRef(18);
  const memRef = useRef(46);

  useEffect(() => {
    const interval = window.setInterval(() => {
      const windowLoad = windows.length * 2.4;
      cpuRef.current = Math.max(4, Math.min(96, cpuRef.current + (Math.random() - 0.48) * 9 + (windowLoad > 20 ? 0.6 : 0)));
      memRef.current = Math.max(28, Math.min(92, memRef.current + (Math.random() - 0.5) * 3));
      setCpu((current) => [...current.slice(-39), cpuRef.current]);
      setMemory((current) => [...current.slice(-39), memRef.current]);
    }, 1100);
    return () => window.clearInterval(interval);
  }, [windows.length]);

  useEffect(() => {
    let frames = 0;
    let last = performance.now();
    let frame = 0;
    const loop = (now: number) => {
      frames += 1;
      if (now - last >= 1000) {
        setFps(Math.round((frames * 1000) / (now - last)));
        frames = 0;
        last = now;
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    void estimateUsage().then(setUsage);
  }, [nodes]);

  /* Real numbers from this browser — nothing simulated in this card. */
  useEffect(() => {
    const read = () => {
      const memory = (performance as Performance & { memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number } }).memory;
      setReal({
        heap: memory ? memory.usedJSHeapSize : null,
        heapLimit: memory ? memory.jsHeapSizeLimit : null,
        online: navigator.onLine,
        cores: navigator.hardwareConcurrency ?? 0,
      });
    };
    read();
    const interval = window.setInterval(read, 2000);
    window.addEventListener('online', read);
    window.addEventListener('offline', read);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('online', read);
      window.removeEventListener('offline', read);
    };
  }, []);

  const diskUsed = useMemo(
    () => Object.values(nodes).reduce((acc, node) => acc + (node.kind === 'folder' ? 0 : fileSize(node)), 0),
    [nodes],
  );
  const trashed = Object.values(nodes).filter((node) => node.trashed).length;
  const fileCount = Object.values(nodes).filter((node) => node.kind !== 'folder' && !node.trashed).length;
  const latestCpu = Math.round(cpu[cpu.length - 1] ?? 0);
  const latestMem = Math.round(memory[memory.length - 1] ?? 0);
  const diskPercent = Math.min(94, Math.round(28 + diskUsed / 4000));

  const formatUptime = () => {
    const h = Math.floor(uptime / 3600);
    const m = Math.floor((uptime % 3600) / 60);
    const s = uptime % 60;
    return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div className="app monitor">
      <div className="app__toolbar">
        <Activity size={15} style={{ color: 'var(--accent)' }} />
        <strong className="small">{t('System Monitor')}</strong>
        <span className="badge badge--accent">{t('Simulated metrics')}</span>
        <span className="grow" />
        <span className="tiny faint">
          <Clock size={11} style={{ display: 'inline', marginInlineEnd: 4 }} />
          {t('Session uptime')}: {formatUptime()}
        </span>
      </div>

      <div className="monitor__body">
        <p className="monitor__disclaimer">{t('These numbers describe the simulator itself, not your real hardware.')}</p>

        <div className="monitor__cards">
          <div className="monitor__card">
            <div className="monitor__card-head">
              <span className="monitor__card-title">
                <Cpu size={14} /> {t('CPU (simulated)')}
              </span>
              <span className="monitor__card-value">{latestCpu}%</span>
            </div>
            <Sparkline values={cpu} color="var(--accent)" />
            <div className="monitor__bars">
              {Array.from({ length: 8 }, (_, index) => (
                <span
                  key={index}
                  className="monitor__bar"
                  style={{ height: `${Math.max(6, latestCpu - index * 9)}%`, background: 'var(--accent)' }}
                />
              ))}
            </div>
          </div>

          <div className="monitor__card">
            <div className="monitor__card-head">
              <span className="monitor__card-title">
                <MemoryStick size={14} /> {t('Memory (simulated)')}
              </span>
              <span className="monitor__card-value">{latestMem}%</span>
            </div>
            <Sparkline values={memory} color="#5aa9ff" />
            <div className="monitor__meter">
              <span style={{ width: `${latestMem}%`, background: '#5aa9ff' }} />
            </div>
            <div className="tiny faint">
              {(latestMem / 100 * 8).toFixed(1)} GB / 8 GB
            </div>
          </div>

          <div className="monitor__card">
            <div className="monitor__card-head">
              <span className="monitor__card-title">
                <HardDrive size={14} /> {t('Disk (simulated)')}
              </span>
              <span className="monitor__card-value">{diskPercent}%</span>
            </div>
            <div className="monitor__meter" style={{ marginTop: 12 }}>
              <span style={{ width: `${diskPercent}%`, background: '#f2b64c' }} />
            </div>
            <dl className="monitor__stats">
              <dt>{t('Virtual files')}</dt>
              <dd>{fileCount}</dd>
              <dt>{t('Content size')}</dt>
              <dd>{formatBytes(diskUsed)}</dd>
              <dt>{t('Trash')}</dt>
              <dd>{trashed}</dd>
              <dt>{t('Browser storage')}</dt>
              <dd>{usage ? `${formatBytes(usage.usage)} / ${formatBytes(usage.quota)}` : '—'}</dd>
            </dl>
          </div>

          <div className="monitor__card">
            <div className="monitor__card-head">
              <span className="monitor__card-title">
                <Activity size={14} /> {t('Interface performance')}
              </span>
              <span className="monitor__card-value">{fps} FPS</span>
            </div>
            <dl className="monitor__stats">
              <dt>{t('Open windows')}</dt>
              <dd>{windows.length}</dd>
              <dt>{t('Active renders')}</dt>
              <dd>{windows.filter((win) => !win.minimized).length}</dd>
              <dt>{t('Viewport')}</dt>
              <dd>
                {window.innerWidth} × {window.innerHeight}
              </dd>
              <dt>{t('Session uptime')}</dt>
              <dd>{formatUptime()}</dd>
            </dl>
          </div>

          <div className="monitor__card">
            <div className="monitor__card-head">
              <span className="monitor__card-title">
                <Cpu size={14} /> {t('This browser (real data)')}
              </span>
              <span className="badge badge--accent">{t('Real')}</span>
            </div>
            <dl className="monitor__stats">
              <dt>{t('JS heap')}</dt>
              <dd>
                {real.heap !== null
                  ? `${formatBytes(real.heap)}${real.heapLimit ? ` / ${formatBytes(real.heapLimit)}` : ''}`
                  : t('Not exposed by this browser')}
              </dd>
              <dt>{t('Logical cores')}</dt>
              <dd>{real.cores || '—'}</dd>
              <dt>{t('Connection')}</dt>
              <dd>{real.online ? t('Online') : t('Offline')}</dd>
              <dt>{t('Pixel ratio')}</dt>
              <dd>{window.devicePixelRatio.toFixed(2)}×</dd>
              <dt>{t('Language')}</dt>
              <dd>{navigator.language}</dd>
            </dl>
            <p className="tiny faint" style={{ marginTop: 8 }}>
              {t('Read live from the browser APIs — this one is not simulated.')}
            </p>
          </div>
        </div>

        <div className="monitor__processes">
          <div className="monitor__section-title">{t('Open windows')}</div>
          {windows.length === 0 ? (
            <div className="empty-state" style={{ minHeight: 100 }}>
              <div className="empty-state__title">{t('No items')}</div>
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>{t('Name')}</th>
                  <th>{t('Status')}</th>
                  <th style={{ width: 120 }} />
                </tr>
              </thead>
              <tbody>
                {windows.map((win) => (
                  <tr key={win.id}>
                    <td>
                      <span className="row" style={{ gap: 8 }}>
                        <AppIcon appId={win.appId} size="xs" plain />
                        {win.title}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${win.minimized ? '' : 'badge--accent'}`}>
                        {win.minimized ? t('Minimized') : t('Running')}
                      </span>
                    </td>
                    <td>
                      <span className="row" style={{ gap: 4, justifyContent: 'flex-end' }}>
                        <button className="icon-btn" onClick={() => focusWindow(win.id)} title={t('Restore')}>
                          <Activity size={13} />
                        </button>
                        <button className="icon-btn" onClick={() => minimizeWindow(win.id)} title={t('Minimize')}>
                          <X size={13} />
                        </button>
                        <button className="icon-btn" onClick={() => closeWindow(win.id)} title={t('Close')}>
                          <Trash2 size={13} />
                        </button>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="monitor__meta">
          {APP_META.monitor.description}
        </div>
      </div>
    </div>
  );
}
