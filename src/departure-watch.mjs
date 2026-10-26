// The supplied events already include service-day and conditional-date filtering.
export function nextDeparture(events, now, previousAt = -Infinity, lineId = 'all') {
  const after = Math.max(now, previousAt);
  return events.find(event => event.at > after && (lineId === 'all' || event.lineId === lineId)) || null;
}

// Only replay a departure still present in the current service-day dataset.
export function replayDeparture(events, watched) {
  if (!watched) return null;
  return events.find(event => event.at === watched.at && event.lineId === watched.lineId) || null;
}

// Rewind within this exact departure and operating day; never seek forward.
export function rewindDeparture(events, watched, now, serviceStart = -Infinity) {
  const event = replayDeparture(events, watched);
  if (!event || !Number.isFinite(now)) return null;
  const start = Math.max(event.at - 5000, serviceStart);
  return now > start ? Math.max(start, now - 5000) : null;
}
