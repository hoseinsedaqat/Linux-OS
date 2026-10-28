/**
 * Weather helpers — WMO code mapping and payload shaping.
 * Pure functions so the mapping can be unit-tested without the network.
 */

export interface Place {
  name: string;
  country?: string;
  admin1?: string;
  latitude: number;
  longitude: number;
  timezone?: string;
}

export interface CurrentWeather {
  temperature: number;
  apparent: number;
  humidity: number;
  wind: number;
  precipitation: number;
  code: number;
  isDay: boolean;
  time: string;
}

export interface HourPoint {
  time: string;
  temperature: number;
  precipitation: number;
  code: number;
}

export interface DayPoint {
  date: string;
  code: number;
  max: number;
  min: number;
  precipitation: number;
}

export interface Forecast {
  place: Place;
  current: CurrentWeather;
  hours: HourPoint[];
  days: DayPoint[];
  units: { temperature: string; wind: string };
}

export type WeatherKind = 'clear' | 'partly' | 'cloudy' | 'fog' | 'rain' | 'snow' | 'storm';

export interface WeatherInfo {
  kind: WeatherKind;
  label: string;
}

/** WMO weather interpretation codes → a small icon vocabulary + label. */
export function describeWeather(code: number): WeatherInfo {
  if (code === 0) return { kind: 'clear', label: 'Clear sky' };
  if (code === 1) return { kind: 'partly', label: 'Mainly clear' };
  if (code === 2) return { kind: 'partly', label: 'Partly cloudy' };
  if (code === 3) return { kind: 'cloudy', label: 'Overcast' };
  if (code === 45 || code === 48) return { kind: 'fog', label: 'Fog' };
  if (code >= 51 && code <= 57) return { kind: 'rain', label: 'Drizzle' };
  if (code >= 61 && code <= 67) return { kind: 'rain', label: 'Rain' };
  if (code >= 71 && code <= 77) return { kind: 'snow', label: 'Snow' };
  if (code >= 80 && code <= 82) return { kind: 'rain', label: 'Rain showers' };
  if (code === 85 || code === 86) return { kind: 'snow', label: 'Snow showers' };
  if (code >= 95) return { kind: 'storm', label: 'Thunderstorm' };
  return { kind: 'cloudy', label: 'Cloudy' };
}

export function mapGeocoding(json: unknown): Place[] {
  const results = (json as { results?: Array<Record<string, unknown>> } | null)?.results ?? [];
  return results
    .filter((item) => typeof item.latitude === 'number' && typeof item.longitude === 'number' && typeof item.name === 'string')
    .map((item) => ({
      name: String(item.name),
      country: typeof item.country === 'string' ? item.country : undefined,
      admin1: typeof item.admin1 === 'string' ? item.admin1 : undefined,
      latitude: Number(item.latitude),
      longitude: Number(item.longitude),
      timezone: typeof item.timezone === 'string' ? item.timezone : undefined,
    }));
}

interface OpenMeteoResponse {
  current?: Record<string, number | string>;
  hourly?: { time?: string[]; temperature_2m?: number[]; precipitation_probability?: number[]; weather_code?: number[] };
  daily?: {
    time?: string[];
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
    precipitation_probability_max?: number[];
    weather_code?: number[];
  };
  current_units?: Record<string, string>;
}

export function mapForecast(json: unknown, place: Place): Forecast | null {
  const data = (json ?? {}) as OpenMeteoResponse;
  const current = data.current;
  if (!current || data.hourly?.time === undefined || data.daily?.time === undefined) return null;

  const numbers = (value: unknown, fallback = 0) => (typeof value === 'number' && Number.isFinite(value) ? value : fallback);

  const hours: HourPoint[] = (data.hourly.time ?? []).map((time, index) => ({
    time,
    temperature: numbers(data.hourly?.temperature_2m?.[index]),
    precipitation: numbers(data.hourly?.precipitation_probability?.[index]),
    code: numbers(data.hourly?.weather_code?.[index]),
  }));

  const days: DayPoint[] = (data.daily.time ?? []).map((date, index) => ({
    date,
    code: numbers(data.daily?.weather_code?.[index]),
    max: numbers(data.daily?.temperature_2m_max?.[index]),
    min: numbers(data.daily?.temperature_2m_min?.[index]),
    precipitation: numbers(data.daily?.precipitation_probability_max?.[index]),
  }));

  return {
    place,
    current: {
      temperature: numbers(current.temperature_2m),
      apparent: numbers(current.apparent_temperature),
      humidity: numbers(current.relative_humidity_2m),
      wind: numbers(current.wind_speed_10m),
      precipitation: numbers(current.precipitation),
      code: numbers(current.weather_code),
      isDay: numbers(current.is_day, 1) === 1,
      time: typeof current.time === 'string' ? current.time : '',
    },
    hours,
    days,
    units: {
      temperature: data.current_units?.temperature_2m ?? '°C',
      wind: data.current_units?.wind_speed_10m ?? 'km/h',
    },
  };
}

export function geocodingUrl(query: string, lang = 'en'): string {
  const params = new URLSearchParams({ name: query, count: '6', language: lang, format: 'json' });
  return `https://geocoding-api.open-meteo.com/v1/search?${params.toString()}`;
}

export function forecastUrl(place: Place): string {
  const params = new URLSearchParams({
    latitude: String(place.latitude),
    longitude: String(place.longitude),
    current: 'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m',
    hourly: 'temperature_2m,precipitation_probability,weather_code',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
    timezone: 'auto',
    forecast_days: '7',
  });
  return `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
}

/** Next 24 hours starting from "now", given hourly data for several days. */
export function nextHours(forecast: Forecast, now = new Date(), count = 24): HourPoint[] {
  const stamp = now.getTime();
  const startIndex = Math.max(
    0,
    forecast.hours.findIndex((point) => new Date(point.time).getTime() >= stamp),
  );
  return forecast.hours.slice(startIndex, startIndex + count);
}

export const DEFAULT_PLACE: Place = {
  name: 'Frankfurt',
  country: 'Germany',
  latitude: 50.1109,
  longitude: 8.6821,
  timezone: 'Europe/Berlin',
};
