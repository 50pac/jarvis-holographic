export type ParsedCommand =
  | { type: 'exit' }
  | { type: 'showMark' }
  | { type: 'hideMark' }
  | { type: 'suit'; action: 'stop' | 'reset' | 'fly' | 'landing' }
  | { type: 'showMap' }
  | { type: 'hideMap' }
  | { type: 'scanOn' }
  | { type: 'scanOff' }
  | { type: 'eyeOn' }
  | { type: 'eyeOff' }
  | { type: 'zoom'; direction: 'in' | 'out' }
  | { type: 'locate'; city: string };

/** Wake phrases use the same case-insensitive, trimmed matching as the voice handler. */
export function isWakeWord(transcript: string): boolean {
  const text = transcript.trim().toLowerCase();
  return text.includes('hello jarvis') ||
    text.includes('hey jarvis') ||
    text.includes('你好 jarvis') ||
    text.includes('jarvis');
}

/** Extract a requested city while preserving its original case. */
export function getCityCandidate(raw: string): string | null {
  const text = raw.trim();
  const zh = text.match(/定位到\s*(.+)/);
  if (zh && zh[1]) {
    const name = zh[1].replace(/的?地图|地图|城市|市|\.$|。$/gi, '').trim();
    return name.length >= 2 ? name : null;
  }
  const en = text.match(/\blocate\b\s+to\b\s+(.+)/i);
  if (en && en[1]) {
    const name = en[1].replace(/map|city|\.$/gi, '').trim();
    return name.length >= 2 ? name : null;
  }
  return null;
}

/**
 * Priority is close commands, exit, location, show mark, suit actions, map,
 * scan, eye, then zoom. Specific close commands come first so "scan off" does
 * not turn scanning on. Location precedes map because a city request can
 * contain "map" or "地图". Word boundaries keep English keywords from matching
 * inside unrelated words such as "discover" or "island".
 */
export function parseCommand(raw: string): ParsedCommand | null {
  const text = raw.trim().toLowerCase();
  if (!text) return null;

  if (/\bscan\s+off\b|\bstop\s+scan\b/.test(text) || text.includes('关闭扫描')) return { type: 'scanOff' };
  if (/\beye\s+off\b/.test(text) || text.includes('关闭右眼标记')) return { type: 'eyeOff' };
  if (/\boff\s+mark\b|\bmark\s+off\b|\bclose\s+mark\b/.test(text) || /关闭\s*mark\b/.test(text)) return { type: 'hideMark' };
  if (/\bmap\s+off\b|\bclose\s+map\b/.test(text) || text.includes('关闭地图') || /关闭\s*map\b/.test(text)) return { type: 'hideMap' };

  if (/\bover\b/.test(text)) return { type: 'exit' };

  const city = getCityCandidate(raw);
  if (city) return { type: 'locate', city };

  if (/\bshow\s+mark\b/.test(text)) return { type: 'showMark' };

  if (/\bstop\b/.test(text)) return { type: 'suit', action: 'stop' };
  if (/\breset\b/.test(text)) return { type: 'suit', action: 'reset' };
  if (/\bland(?:ing)?\b/.test(text)) return { type: 'suit', action: 'landing' };
  if (/\bfly\b/.test(text)) return { type: 'suit', action: 'fly' };

  if (/\bmap\b/.test(text) || text.includes('地图')) return { type: 'showMap' };
  if (/\bscan\b/.test(text) || text.includes('扫描')) return { type: 'scanOn' };
  if (/\beye\b/.test(text) || text.includes('右眼')) return { type: 'eyeOn' };

  if (text.includes('放大') || /\bzoom\s+in\b/.test(text)) return { type: 'zoom', direction: 'in' };
  if (text.includes('缩小') || /\bzoom\s+out\b/.test(text)) return { type: 'zoom', direction: 'out' };

  return null;
}
