import { useCallback, useEffect, useState } from 'react';
import {
  Cloud,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSun,
  Droplets,
  Loader2,
  MapPin,
  RefreshCw,
  Search,
  Snowflake,
  Sun,
  Wind,
  AlertTriangle,
} from 'lucide-react';
import type { AppWindowProps } from '@/core/apps/types';
import { useT } from '@/core/localization/i18n';
import { useSettings } from '@/core/themes/settingsStore';
import { usePersistedValue } from '@/core/persistence/kvStore';
import { PersistedValue } from '@/core/persistence/kvStore';
import { cn } from '@/utils';
import {
  DEFAULT_PLACE,
  describeWeather,
  forecastUrl,
  geocodingUrl,
  mapForecast,
  mapGeocoding,
  nextHours,
  type Forecast,
  type Place,
  type WeatherKind,
} from './weatherLogic';

const weatherStore = new PersistedValue<{ last?: Place; saved: Place[] }>('nova-linux.weather.v1', {
  last: DEFAULT_PLACE,
  saved: [DEFAULT_PLACE, { name: 'Tehran', country: 'Iran', latitude: 35.6892, longitude: 51.389, timezone: 'Asia/Tehran' }],
});

const KIND_ICON: Record<WeatherKind, typeof Sun> = {
  clear: Sun,
  partly: CloudSun,
  cloudy: Cloud,
  fog: CloudFog,
  rain: CloudRain,
  snow: Snowflake,
  storm: CloudLightning,
};

export function WeatherApp(_props: AppWindowProps) {
  const t = useT();
  const language = useSettings((state) => state.language);
  const [store, setStore] = usePersistedValue(weatherStore);
  const [place, setPlace] = useState<Place>(store.last ?? DEFAULT_PLACE);
  const [forecast, setForecast] = useState<Forecast | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setStatus('loading');
    fetch(forecastUrl(place), { signal: controller.signal, credentials: 'omit', referrerPolicy: 'no-referrer' })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((json) => {
        const mapped = mapForecast(json, place);
        if (!mapped) throw new Error('unexpected payload');
        setForecast(mapped);
        setStatus('ready');
        setStore((current) => ({ ...current, last: place }));
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setStatus('error');
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [place.latitude, place.longitude, nonce]);

  const search = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      const value = query.trim();
      if (value.length < 2) return;
      setSearching(true);
      try {
        const response = await fetch(geocodingUrl(value, language === 'fa' ? 'fa' : 'en'), {
          credentials: 'omit',
          referrerPolicy: 'no-referrer',
        });
        const json = await response.json();
        setResults(mapGeocoding(json));
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    },
    [query, language],
  );

  const currentInfo = forecast ? describeWeather(forecast.current.code) : null;
  const CurrentIcon = currentInfo ? KIND_ICON[currentInfo.kind] : CloudSun;
  const hours = forecast ? nextHours(forecast) : [];

  return (
    <div className="app weather">
      <div className="weather__bar">
        <form className="weather__search" onSubmit={search}>
          <Search size={14} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('Search for a city…')}
            aria-label={t('Search for a city')}
          />
          {searching && <Loader2 size={13} className="bsearch__spin" />}
        </form>
        <button className="icon-btn" onClick={() => setNonce((value) => value + 1)} title={t('Refresh')}>
          <RefreshCw size={14} />
        </button>
      </div>

      {results.length > 0 && (
        <div className="weather__results">
          {results.map((result) => (
            <button
              key={`${result.latitude},${result.longitude}`}
              className="weather__result"
              onClick={() => {
                setPlace(result);
                setResults([]);
                setQuery('');
                setStore((current) => ({
                  ...current,
                  saved: current.saved.some((item) => item.name === result.name)
                    ? current.saved
                    : [result, ...current.saved].slice(0, 6),
                }));
              }}
            >
              <MapPin size={12} />
              <span>
                {result.name}
                {result.admin1 ? `, ${result.admin1}` : ''}
                {result.country ? ` · ${result.country}` : ''}
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="weather__body">
        {status === 'loading' && (
          <div className="weather__loading">
            <Loader2 size={18} className="bsearch__spin" />
            {t('Fetching the forecast from Open-Meteo…')}
          </div>
        )}

        {status === 'error' && (
          <div className="bsearch__note bsearch__note--warn" style={{ margin: 16 }}>
            <AlertTriangle size={16} />
            <div>
              <strong>{t('The forecast could not be loaded')}</strong>
              <p>{t('Open-Meteo is a free public API and needs an internet connection. Try again, or pick another city.')}</p>
              <div className="bsearch__links">
                <button className="bsearch__link-btn" onClick={() => setNonce((value) => value + 1)}>
                  <RefreshCw size={12} /> {t('Try again')}
                </button>
              </div>
            </div>
          </div>
        )}

        {status === 'ready' && forecast && currentInfo && (
          <>
            <section className="weather__hero">
              <div className="weather__hero-main">
                <div className="weather__place">
                  <MapPin size={13} />
                  {forecast.place.name}
                  {forecast.place.country ? `, ${forecast.place.country}` : ''}
                </div>
                <div className="weather__temp">
                  {Math.round(forecast.current.temperature)}
                  <span>{forecast.units.temperature}</span>
                </div>
                <div className="weather__summary">
                  {t(currentInfo.label)} · {t('feels like')} {Math.round(forecast.current.apparent)}
                  {forecast.units.temperature}
                </div>
                <div className="weather__metrics">
                  <span>
                    <Droplets size={13} /> {Math.round(forecast.current.humidity)}%
                  </span>
                  <span>
                    <Wind size={13} /> {Math.round(forecast.current.wind)} {forecast.units.wind}
                  </span>
                  <span>
                    <CloudRain size={13} /> {forecast.current.precipitation} mm
                  </span>
                </div>
              </div>
              <div className={cn('weather__hero-icon', forecast.current.isDay ? 'is-day' : 'is-night')}>
                <CurrentIcon size={74} strokeWidth={1.2} />
              </div>
            </section>

            <section className="weather__section">
              <div className="weather__section-title">{t('Next 24 hours')}</div>
              <div className="weather__hours">
                {hours.map((hour) => {
                  const info = describeWeather(hour.code);
                  const Icon = KIND_ICON[info.kind];
                  return (
                    <div className="weather__hour" key={hour.time}>
                      <span className="weather__hour-time">
                        {new Date(hour.time).toLocaleTimeString(language === 'fa' ? 'fa-IR' : 'en-US', {
                          hour: '2-digit',
                          hour12: false,
                        })}
                      </span>
                      <Icon size={17} />
                      <span className="weather__hour-temp">{Math.round(hour.temperature)}°</span>
                      <span className="weather__hour-rain">{Math.round(hour.precipitation)}%</span>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="weather__section">
              <div className="weather__section-title">{t('7-day forecast')}</div>
              <div className="weather__days">
                {forecast.days.map((day, index) => {
                  const info = describeWeather(day.code);
                  const Icon = KIND_ICON[info.kind];
                  return (
                    <div className="weather__day" key={day.date}>
                      <span className="weather__day-name">
                        {index === 0
                          ? t('Today')
                          : new Date(day.date).toLocaleDateString(language === 'fa' ? 'fa-IR' : 'en-US', { weekday: 'short' })}
                      </span>
                      <Icon size={15} />
                      <span className="weather__day-label">{t(info.label)}</span>
                      <span className="weather__day-rain">{Math.round(day.precipitation)}%</span>
                      <span className="weather__day-range">
                        {Math.round(day.max)}° <span className="faint">{Math.round(day.min)}°</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>

            <div className="weather__foot">
              {t('Live data from Open-Meteo (no API key).')} · {t('Location')}: {forecast.place.latitude.toFixed(2)},{' '}
              {forecast.place.longitude.toFixed(2)}
            </div>
          </>
        )}
      </div>

      {store.saved.length > 0 && (
        <div className="weather__saved">
          {store.saved.map((saved) => (
            <button
              key={`${saved.name}-${saved.latitude}`}
              className={cn('game__chip', saved.name === place.name && 'is-active')}
              onClick={() => setPlace(saved)}
            >
              {saved.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
