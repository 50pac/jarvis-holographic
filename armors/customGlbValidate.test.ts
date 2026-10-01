import { describe, expect, it } from 'vitest';
import { MAX_CUSTOM_GLB_BYTES, validateCustomGlb } from './customGlbValidate';

function glb(json: object, bin = new Uint8Array(4)): ArrayBuffer {
  const encoded = new TextEncoder().encode(JSON.stringify(json));
  const jsonSize = Math.ceil(encoded.length / 4) * 4;
  const bytes = new Uint8Array(12 + 8 + jsonSize + 8 + bin.byteLength);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, 0x46546c67, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, bytes.byteLength, true);
  view.setUint32(12, jsonSize, true);
  view.setUint32(16, 0x4e4f534a, true);
  bytes.fill(0x20, 20, 20 + jsonSize);
  bytes.set(encoded, 20);
  view.setUint32(20 + jsonSize, bin.byteLength, true);
  view.setUint32(24 + jsonSize, 0x004e4942, true);
  bytes.set(bin, 28 + jsonSize);
  return bytes.buffer;
}

describe('custom GLB validation', () => {
  it('accepts a minimal glTF 2.0 GLB with JSON and BIN chunks', () => {
    expect(validateCustomGlb('My Suit.GLB', glb({ asset: { version: '2.0' }, buffers: [{ byteLength: 4 }] }))).toEqual({ ok: true });
  });

  it('rejects empty and truncated files', () => {
    expect(validateCustomGlb('empty.glb', new ArrayBuffer(0))).toMatchObject({ ok: false, error: expect.stringContaining('为空') });
    expect(validateCustomGlb('short.glb', new ArrayBuffer(12))).toMatchObject({ ok: false, error: expect.stringContaining('文件头') });
  });

  it('rejects files over 32 MiB and other extensions', () => {
    expect(validateCustomGlb('large.glb', new ArrayBuffer(MAX_CUSTOM_GLB_BYTES + 1))).toMatchObject({ ok: false, error: expect.stringContaining('32 MiB') });
    expect(validateCustomGlb('model.gltf', glb({ asset: { version: '2.0' } }))).toMatchObject({ ok: false });
  });

  it('rejects bad magic, version, length and external resources', () => {
    const badMagic = glb({ asset: { version: '2.0' } });
    new Uint8Array(badMagic)[0] = 0;
    expect(validateCustomGlb('bad.glb', badMagic)).toMatchObject({ ok: false, error: expect.stringContaining('魔数') });
    const badVersion = glb({ asset: { version: '2.0' } });
    new DataView(badVersion).setUint32(4, 1, true);
    expect(validateCustomGlb('old.glb', badVersion)).toMatchObject({ ok: false });
    const badLength = glb({ asset: { version: '2.0' } });
    new DataView(badLength).setUint32(8, 12, true);
    expect(validateCustomGlb('bad.glb', badLength)).toMatchObject({ ok: false });
    expect(validateCustomGlb('external.glb', glb({ asset: { version: '2.0' }, images: [{ uri: 'texture.png' }] })))
      .toMatchObject({ ok: false, error: expect.stringContaining('外部') });
    expect(validateCustomGlb('malformed.glb', glb({ asset: { version: '2.0' }, images: {} })))
      .toMatchObject({ ok: false, error: expect.stringContaining('资源列表') });
  });
});
