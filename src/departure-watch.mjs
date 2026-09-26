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
