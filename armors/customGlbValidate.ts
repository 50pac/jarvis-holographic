export const MAX_CUSTOM_GLB_BYTES = 32 * 1024 * 1024;

export type GlbValidation = { ok: true } | { ok: false; error: string };

/** Validates a complete, self-contained GLB before it is saved locally. */
export function validateCustomGlb(fileName: string, bytes: ArrayBuffer, maxBytes = MAX_CUSTOM_GLB_BYTES): GlbValidation {
  if (!/\.glb$/i.test(fileName)) return { ok: false, error: '只支持 .glb 文件。' };
  if (bytes.byteLength === 0) return { ok: false, error: '文件为空，请选择有效的 GLB 模型。' };
  if (bytes.byteLength > maxBytes) return { ok: false, error: `文件超过 ${Math.floor(maxBytes / 1024 / 1024)} MiB 上限。` };
  if (bytes.byteLength < 20) return { ok: false, error: 'GLB 文件头不完整。' };

  const view = new DataView(bytes);
  if (view.getUint32(0, true) !== 0x46546c67) return { ok: false, error: 'GLB 魔数无效，文件不是 glTF 二进制模型。' };
  if (view.getUint32(4, true) !== 2) return { ok: false, error: '只支持 glTF 2.0 的 GLB 文件。' };
  if (view.getUint32(8, true) !== bytes.byteLength) return { ok: false, error: 'GLB 声明长度与文件大小不符。' };

  const jsonLength = view.getUint32(12, true);
  if (view.getUint32(16, true) !== 0x4e4f534a || jsonLength === 0 || jsonLength % 4 !== 0 || jsonLength > bytes.byteLength - 20) {
    return { ok: false, error: 'GLB 缺少有效的 JSON 数据块。' };
  }
  let json: { asset?: { version?: string }; buffers?: { uri?: string }[]; images?: { uri?: string }[] } | null;
  try {
    json = JSON.parse(new TextDecoder().decode(new Uint8Array(bytes, 20, jsonLength)));
  } catch {
    return { ok: false, error: 'GLB 的 JSON 数据无效。' };
  }
  if (!json || json.asset?.version !== '2.0') return { ok: false, error: 'GLB 的 glTF 版本必须为 2.0。' };
  if (!Array.isArray(json.buffers ?? []) || !Array.isArray(json.images ?? [])) {
    return { ok: false, error: 'GLB 的资源列表无效。' };
  }
  const external = [...(json.buffers ?? []), ...(json.images ?? [])].some(item => {
    if (!item || !('uri' in item) || item.uri === undefined) return false;
    return typeof item.uri !== 'string' || !item.uri.startsWith('data:');
  });
  if (external) return { ok: false, error: 'GLB 引用了外部文件或网址；请导出贴图与数据均内嵌的单文件 GLB。' };

  let offset = 20 + jsonLength;
  while (offset < bytes.byteLength) {
    if (offset + 8 > bytes.byteLength) return { ok: false, error: 'GLB 数据块头不完整。' };
    const length = view.getUint32(offset, true);
    if (length % 4 !== 0 || length > bytes.byteLength - offset - 8) return { ok: false, error: 'GLB 数据块长度无效。' };
    offset += 8 + length;
  }
  return { ok: true };
}
