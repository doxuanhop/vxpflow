import { BlockDef, BlockInstance, VXPExtension, VXPBlockManifest } from '../types';

/**
 * Registry tiện ích .mvxp (kiểu .aix của App Inventor).
 *
 * Một tiện ích = manifest (khai báo khối mới + hook sinh mã Lua) + mã nguồn
 * Lua thư viện. Khối của tiện ích có defId = `ext_<extId>_<blockId>` và được
 * trộn vào palette Blocks; khi sinh mã Lua, hook template của khối được điền
 * các ô nhập rồi chèn vào tệp .lua, cùng với toàn bộ thư viện Lua của tiện ích.
 */

export const EXTENSION_CATEGORY = 'extensions';

export function extBlockId(extId: string, blockId: string): string {
  return `ext_${extId}_${blockId}`;
}

/** Chuyển manifest của tiện ích thành BlockDef hiểu được bởi Blocks palette */
export function extensionBlockDefs(extensions: VXPExtension[]): BlockDef[] {
  const defs: BlockDef[] = [];
  for (const ext of extensions) {
    for (const m of ext.blocks || []) {
      const isValue = !!m.outputType && !m.statement && !m.event;
      defs.push({
        id: extBlockId(ext.id, m.id),
        type: m.event ? 'event' : isValue ? 'value' : 'statement',
        category: EXTENSION_CATEGORY as BlockDef['category'],
        label: m.label || m.id,
        color: m.color || ext.color || '#8b5cf6',
        statement: !!m.statement || !!m.event,
        outputType: m.outputType,
        inputs: (m.inputs || []).map(i => ({
          name: i.name,
          type: i.type,
          default: i.default,
          socket: i.socket,
          component: i.component
        }))
      });
    }
  }
  return defs;
}

/** Tìm manifest gốc của một khối (theo defId đã tiền tố) — trả về null nếu là khối builtin */
export function findExtensionManifest(
  extensions: VXPExtension[],
  defId: string
): { ext: VXPExtension; manifest: VXPBlockManifest } | null {
  for (const ext of extensions) {
    for (const m of ext.blocks || []) {
      if (extBlockId(ext.id, m.id) === defId) return { ext, manifest: m };
    }
  }
  return null;
}

/** Các helper sinh literal/biểu thức trong luaGenerator (tránh import vòng) */
export interface LuaTemplateHelpers {
  numIn: (blk: BlockInstance, allBlocks: BlockInstance[], name: string, depth: number) => string;
  boolIn: (blk: BlockInstance, allBlocks: BlockInstance[], name: string, depth: number) => string;
  anyIn: (blk: BlockInstance, allBlocks: BlockInstance[], name: string, depth: number) => string;
  strIn: (blk: BlockInstance, allBlocks: BlockInstance[], name: string, depth: number) => string;
  literalLua: (raw: any) => string;
}

/**
 * Điền HOOK SINH MÃ LUA của khối tiện ích.
 * Placeholder: {tên} literal · {num:x} số · {bool:x} đúng/sai ·
 * {any:x} biểu thức bất kỳ (khối cắm vào socket) · {str:x} chuỗi có nháy.
 */
export function renderExtensionLua(
  template: string,
  blk: BlockInstance,
  allBlocks: BlockInstance[],
  depth: number,
  h: LuaTemplateHelpers
): string {
  return template.replace(/\{((?:num|bool|any|str):)?([A-Za-z_][A-Za-z0-9_]*)\}/g, (full, prefix: string | undefined, name: string) => {
    switch (prefix) {
      case 'num:':
        return h.numIn(blk, allBlocks, name, depth);
      case 'bool:':
        return h.boolIn(blk, allBlocks, name, depth);
      case 'any:':
        return h.anyIn(blk, allBlocks, name, depth);
      case 'str:':
        return h.strIn(blk, allBlocks, name, depth);
      default:
        return h.literalLua(blk.fields[name]);
    }
  });
}