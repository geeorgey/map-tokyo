export const DAY_MS = 86400000;
export const JST_MS = 9 * 3600000;
export const SPEEDS = [0.5, 1, 2, 5, 10, 30, 60, 300];
export const pad = n => String(n).padStart(2, '0');

export function japanTime(timestamp) {
  const date = new Date(timestamp + JST_MS);
  return {
    date: date.toISOString().slice(0, 10),
    time: `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`,
    day: '日月火水木金土'[date.getUTCDay()],
    hour: date.getUTCHours(),
    seconds: date.getUTCHours() * 3600 + date.getUTCMinutes() * 60 + date.getUTCSeconds(),
  };
}

export function parseJapanDateTime(date, time) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}(:\d{2})?$/.test(time)) return null;
  const value = Date.parse(`${date}T${time.length === 5 ? `${time}:00` : time}+09:00`);
  if (!Number.isFinite(value)) return null;
  const parsed = japanTime(value);
  return parsed.date === date && parsed.time === (time.length === 5 ? `${time}:00` : time) ? value : null;
}

export function serviceContext(timestamp, data) {
  const civil = japanTime(timestamp);
  // Departures at 00:xx belong to the previous operating day.
  const date = civil.hour < 3 ? japanTime(timestamp - DAY_MS).date : civil.date;
  const weekday = new Date(`${date}T12:00:00+09:00`).getUTCDay();
  const holiday = data?.holidays?.[date];
  const dayType = weekday === 0 || weekday === 6 || holiday ? 'holiday' : 'weekday';
  return { date, dayType, holiday, midnight: Date.parse(`${date}T00:00:00+09:00`), supported: date.startsWith(data?.month || 'unavailable') };
}

export class SimulationClock {
  constructor({ wallNow = () => Date.now(), monotonicNow = () => performance.now() } = {}) {
    this.wallNow = wallNow;
    this.monotonicNow = monotonicNow;
    this.sync();
  }
  now() {
    if (this.live) return this.wallNow();
    return this.anchor + (this.paused ? 0 : (this.monotonicNow() - this.tick) * this.speed);
  }
  sync() {
    this.live = true;
    this.paused = false;
    this.speed = 1;
    this.anchor = this.wallNow();
    this.tick = this.monotonicNow();
  }
  setSpeed(speed) {
    if (!SPEEDS.includes(speed)) throw new Error('Unsupported clock speed');
    const time = this.now();
    this.anchor = time;
    this.tick = this.monotonicNow();
    if (speed !== 1) this.live = false;
    this.speed = speed;
  }
  setPaused(paused) {
    const time = this.now();
    this.anchor = time;
    this.tick = this.monotonicNow();
    this.live = false;
    this.paused = paused;
  }
  seek(timestamp) {
    if (!Number.isFinite(timestamp) || Math.abs(timestamp) > 8640000000000000) throw new Error('Invalid date');
    this.anchor = timestamp;
    this.tick = this.monotonicNow();
    this.live = false;
  }
}
