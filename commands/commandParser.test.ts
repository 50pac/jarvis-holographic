import { describe, it, expect } from 'vitest';
import { getCityCandidate, isWakeWord, parseCommand, type ParsedCommand } from './commandParser';

describe('isWakeWord', () => {
  it.each(['jarvis', 'hello jarvis', 'hey jarvis', '你好 jarvis', '  HELLO JARVIS  '])(
    'recognizes %s', transcript => {
      expect(isWakeWord(transcript)).toBe(true);
    }
  );

  it('does not treat ordinary speech as a wake word', () => {
    expect(isWakeWord('hello')).toBe(false);
  });
});

describe('getCityCandidate', () => {
  it('preserves city case and removes map suffixes', () => {
    expect(getCityCandidate('locate to Paris map')).toBe('Paris');
    expect(getCityCandidate('定位到北京的地图')).toBe('北京');
  });

  it('rejects missing or one-character cities', () => {
    expect(getCityCandidate('locate to A')).toBeNull();
    expect(getCityCandidate('地图')).toBeNull();
  });
});

describe('parseCommand', () => {
  const cases: [string, ParsedCommand | null][] = [
    ['map', { type: 'showMap' }],
    ['地图', { type: 'showMap' }],
    ['map off', { type: 'hideMap' }],
    ['close map', { type: 'hideMap' }],
    ['关闭地图', { type: 'hideMap' }],
    ['关闭 map', { type: 'hideMap' }],
    ['scan', { type: 'scanOn' }],
    ['扫描', { type: 'scanOn' }],
    ['scan off', { type: 'scanOff' }],
    ['stop scan', { type: 'scanOff' }],
    ['关闭扫描', { type: 'scanOff' }],
    ['eye', { type: 'eyeOn' }],
    ['右眼', { type: 'eyeOn' }],
    ['eye off', { type: 'eyeOff' }],
    ['关闭右眼标记', { type: 'eyeOff' }],
    ['show mark', { type: 'showMark' }],
    ['off mark', { type: 'hideMark' }],
    ['mark off', { type: 'hideMark' }],
    ['close mark', { type: 'hideMark' }],
    ['关闭 mark', { type: 'hideMark' }],
    ['stop', { type: 'suit', action: 'stop' }],
    ['reset', { type: 'suit', action: 'reset' }],
    ['fly', { type: 'suit', action: 'fly' }],
    ['land', { type: 'suit', action: 'landing' }],
    ['landing', { type: 'suit', action: 'landing' }],
    ['zoom in', { type: 'zoom', direction: 'in' }],
    ['放大', { type: 'zoom', direction: 'in' }],
    ['zoom out', { type: 'zoom', direction: 'out' }],
    ['缩小', { type: 'zoom', direction: 'out' }],
    ['locate to Paris', { type: 'locate', city: 'Paris' }],
    ['定位到北京的地图', { type: 'locate', city: '北京' }],
    ['over', { type: 'exit' }],
    ['Over.', { type: 'exit' }],
    ['discover', null],
    ['discover the map', { type: 'showMap' }],
    ['island', null],
    ['hello jarvis', null],
    ['  MAP OFF  ', { type: 'hideMap' }],
    ['', null],
  ];

  it.each(cases)('parses %j', (raw, expected) => {
    expect(parseCommand(raw)).toEqual(expected);
  });

  it('allows flexible whitespace in close phrases', () => {
    expect(parseCommand('scan   off')).toEqual({ type: 'scanOff' });
    expect(parseCommand('close\tmap')).toEqual({ type: 'hideMap' });
    expect(parseCommand('show\nmark')).toEqual({ type: 'showMark' });
  });

  it('uses the documented command and suit priorities', () => {
    expect(parseCommand('stop scan over')).toEqual({ type: 'scanOff' });
    expect(parseCommand('stop reset fly landing')).toEqual({ type: 'suit', action: 'stop' });
    expect(parseCommand('reset fly landing')).toEqual({ type: 'suit', action: 'reset' });
    expect(parseCommand('fly landing')).toEqual({ type: 'suit', action: 'landing' });
    expect(parseCommand('zoom out zoom in')).toEqual({ type: 'zoom', direction: 'in' });
  });
});
