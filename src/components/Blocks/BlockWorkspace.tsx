import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Undo2, Redo2, LayoutGrid, Layers,
  Boxes, Plus, Trash2, Code2, ZoomIn, ZoomOut, Search, X, RotateCcw, Move,
  Package, AlertTriangle, Copy, ChevronDown, ChevronRight, MessageSquare,
  EyeOff, Minimize2, CopyPlus, HelpCircle, ImageDown, Backpack, Hand
} from 'lucide-react';
import { BlockInstance, BlockCategory, BlockDef, UIComponent, VXPExtension } from '../../types';
import { BLOCK_DEFINITIONS } from '../../data/blockDefinitions';
import { componentDrawerEntries, componentTypeColor, componentTypeLabel, sortComponents, isComponentRefInput } from '../../data/componentBlocks';
import { genericPropertiesFor } from '../../data/componentProperties';
import { extensionBlockDefs } from '../../utils/extensionRegistry';
import { generateLuaFromProject } from '../../utils/luaGenerator';
import { usePointerDrag, PointerDragState } from '../../utils/pointerDrag';
import { useAppStore } from '../../store/appStore';
import { ExtensionManagerModal } from './ExtensionManagerModal';
import { useI18n } from '../../i18n';
import { useSysDialogs } from '../SystemDialogs/SystemDialogs';
import { generateBlockChainCode } from '../../utils/luaGenerator';

/* ================================================================== *
 *  BlockWorkspace — canvas khối kiểu App Inventor.
 *  - Kéo khối từ thư viện (trái) thả lên bảng → tự "khớp" lắp ghép.
 *  - Khối LỆNH xếp thành chuỗi dọc (cắm vào rãnh / đuôi chuỗi / hốc C).
 *  - Khối GIÁ TRỊ cắm thẳng vào socket tròn (nằm lồng trong khối dùng).
 *  - Không còn đường nối React Flow — thả vào thùng rác để xóa.
 * ================================================================== */

interface BlockWorkspaceProps {
  blocks: BlockInstance[];
  components: UIComponent[];
  onChangeBlocks: (blocks: BlockInstance[]) => void;
  projectName: string;
  /** Tiện ích .mvxp đã cài — khối của chúng được trộn vào palette */
  extensions?: VXPExtension[];
  /** Khổ màn hình dự án — bản xem trước Lua sinh theo đúng khổ */
  resolution?: string;
  /** Danh sách màn hình (thanh Screen kiểu Kodular phía trên bảng khối) */
  screens?: string[];
  activeScreen?: string;
  entryScreen?: string;
  onSwitchScreen?: (name: string) => void;
  onAddScreen?: (name: string) => void;
  onCopyScreen?: (name: string) => void;
  onRenameScreen?: (oldName: string, newName: string) => void;
  onDeleteScreen?: (name: string) => void;
}

/**
 * Chiều cao khe nối giữa hai khối lệnh. Chốt (tab) ở mép dưới khối phía
 * trên cao đúng bằng SEAM nên lấp kín khe → hai khối trông KHỚP NHAU
 * như Blockly / Kodular thay vì đứng rời rạc.
 */
const SEAM = 10;
/** Khoảng thụt lề trái của C-body (notch/tab offset) */
const BODYIndent = 16;
const NOTCH_W = 20;
const NOTCH_H = 8;
const TAB_W = 20;
const TAB_H = SEAM;

const CATEGORY_TABS: { id: BlockCategory; nameKey: string; name: string; color: string }[] = [
  { id: 'events', nameKey: 'bw.catEvents', name: 'Sự kiện (Events)', color: '#eab308' },
  { id: 'control', nameKey: 'bw.catControl', name: 'Điều khiển (Control)', color: '#f97316' },
  { id: 'logic', nameKey: 'bw.catLogic', name: 'Logic', color: '#0ea5e9' },
  { id: 'math', nameKey: 'bw.catMath', name: 'Toán học (Math)', color: '#3b82f6' },
  { id: 'text', nameKey: 'bw.catText', name: 'Văn bản (Text)', color: '#e91e63' },
  { id: 'ui', nameKey: 'bw.catUi', name: 'Giao diện (UI)', color: '#22c55e' },
  { id: 'game', nameKey: 'bw.catGame', name: 'Đồ họa & Game', color: '#a855f7' },
  { id: 'system', nameKey: 'bw.catSystem', name: 'Hệ thống MRE', color: '#14b8a6' },
  { id: 'variables', nameKey: 'bw.catVariables', name: 'Biến số (Variables)', color: '#ec4899' },
  { id: 'procedures', nameKey: 'bw.catProcedures', name: 'Thủ tục & Hàm (Procedures)', color: '#c026d3' },
  { id: 'extensions', nameKey: 'bw.catExtensions', name: 'Tiện ích (.mvxp)', color: '#8b5cf6' }
];

const PARAM_CAPTIONS: Record<string, string> = {
  condition: 'điều kiện', count: 'số lần', a: 'A', b: 'B', min: 'từ', max: 'đến',
  text: 'văn bản', value: 'giá trị', delta: 'lượng', name: 'biến',
  x: 'X', y: 'Y', x1: 'X₁', y1: 'Y₁', x2: 'X₂', y2: 'Y₂', width: 'rộng', height: 'cao',
  radius: 'bán kính', color: 'màu', angle: 'góc', size: 'cỡ', duration: 'ms',
  key: 'phím', screen: 'màn hình', sprite: 'nhân vật', sound: 'hiệu ứng',
  component: '', timer: '', button: '', canvas: '', property: '', enabled: 'bật',
  default: 'mặc định',
  // Khối mới
  from: 'từ', to: 'đến', step: 'bước', list: 'danh sách',
  index: 'vị trí', start: 'bắt đầu', length: 'độ dài',
  find: 'tìm', replace: 'mới', mode: 'chế độ', op: 'phép',
  button1: 'nút 1', button2: 'nút 2',
  // Khối hằng (text_literal / logic_boolean): tên khối đã đủ nghĩa → bỏ nhãn
  literal: ''
};
const captionOf = (n: string): string => {
  const fb = PARAM_CAPTIONS[n] ?? n;
  return BLOCK_T ? BLOCK_T(`bw.p.${n}`, fb) : fb;
};

const SOUND_OPTIONS: [string, string][] = [
  ['click', 'click'], ['coin', 'coin'], ['jump', 'jump'], ['hit', 'hit'], ['gameover', 'gameover']
];
const KEY_OPTIONS: [string, string][] = [
  ['KEY_OK', 'OK'], ['KEY_UP', 'bw.keyUp'], ['KEY_DOWN', 'bw.keyDown'],
  ['KEY_LEFT', 'bw.keyLeft'], ['KEY_RIGHT', 'bw.keyRight'],
  ['KEY_LSOFT', 'bw.keyLsoft'], ['KEY_RSOFT', 'bw.keyRsoft'], ['KEY_CLEAR', 'bw.keyClear']
];

const SHORT_LABELS: Record<string, string> = {
  math_op: 'Phép toán', logic_compare: 'So sánh', get_label_text: 'Lấy nhãn',
  var_get: 'Lấy biến', math_number: 'Số', math_random: 'Ngẫu nhiên',
  text_join: 'Ghép chuỗi', storage_get_value: 'Lấy TinyDB',
  text_literal: 'Văn bản', logic_boolean: 'Đúng/Sai',
  event_screen_init: 'Khi màn hình khởi tạo', event_btn_click: 'Khi bấm nút',
  event_timer_tick: 'Khi đồng hồ chạy', event_key_press: 'Khi nhấn phím',
  event_canvas_touch: 'Khi chạm canvas', call_exit_app: 'Thoát ứng dụng',
  set_comp_prop: 'Đặt thuộc tính', get_comp_prop: 'Lấy thuộc tính',
  // Khối mới kiểu App Inventor
  event_any_key: 'Khi nhấn phím bất kỳ', event_clock_timer: 'Khi đồng hồ (Clock) chạy',
  event_notifier_choose: 'Khi chọn trong hộp thoại',
  ctrl_for_range: 'Lặp từ…đến', ctrl_for_each: 'Lặp mỗi phần tử',
  ctrl_break: 'Thoát vòng lặp', ctrl_continue: 'Bỏ qua lần lặp', ctrl_wait: 'Chờ rồi làm',
  math_unary: 'Toán 1 ngôi', math_div: 'Chia lấy dư/nguyên',
  math_min_max: 'Nhỏ nhất/Lớn nhất', math_to_number: 'Đổi thành số',
  logic_and_or: 'Và/Hoặc', logic_not: 'Phủ định',
  list_get_item: 'Lấy phần tử', list_length: 'Số phần tử',
  text_substring: 'Cắt chuỗi con', text_repeat: 'Lặp chuỗi',
  text_replace: 'Thay thế chuỗi', text_to_string: 'Đổi thành văn bản',
  notifier_alert: 'Hiện hộp thoại', notifier_choose: 'Hỏi chọn',
  notifier_close: 'Đóng hộp thoại', notifier_get_choice: 'Lấy lựa chọn',
  proc_def: 'Định nghĩa thủ tục', proc_call: 'Gọi thủ tục', proc_return: 'Trả về kết quả'
};

/**
 * Thanh ghi khối toàn cục (module scope): gồm khối builtin + khối từ tiện ích
 * .mvxp. BlockWorkspace cập nhật mỗi khi extensions thay đổi (xem allDefs).
 */
let ALL_DEFS: BlockDef[] = BLOCK_DEFINITIONS;
function defOf(block: BlockInstance): BlockDef | undefined {
  return ALL_DEFS.find(d => d.id === block.defId);
}
function findDef(defId: string): BlockDef | undefined {
  return ALL_DEFS.find(d => d.id === defId);
}
function isValueBlock(block: BlockInstance): boolean {
  return !!defOf(block)?.outputType;
}
function isEventDef(def?: BlockDef): boolean {
  return def?.type === 'event';
}
/** Hook i18n dùng chung cho helper ngoài component — cập nhật mỗi render của component chính */
let BLOCK_T: ((k: string, f?: string) => string) | null = null;

/** Nhãn khối theo NGÔN NGỮ người dùng — ưu tiên short (blk.s.*) → full (blk.*) → nhãn gốc */
function blkLabel(def?: BlockDef): string {
  if (!def) return BLOCK_T ? BLOCK_T('bw.block', 'Block') : 'Khối';
  const t = BLOCK_T;
  if (t) {
    const short = SHORT_LABELS[def.id] ? t(`blk.s.${def.id}`, '') : '';
    if (short) return short;
    const full = t(`blk.${def.id}`, '');
    if (full && full !== def.label) return full;
  }
  const base = SHORT_LABELS[def.id] || def.label;
  const prefix = base.split('<')[0].trim().replace(/[\[(].*$/, '').trim();
  return prefix || base;
}

/** Nhãn hốc thân lệnh (thì/ngược lại/lặp…) theo ngôn ngữ */
function bodyLabel(raw: string): string {
  return BLOCK_T ? BLOCK_T(`blk.body.${raw}`, raw) : raw;
}

function shortLabel(def?: BlockDef): string {
  return blkLabel(def);
}



function componentOptionsFor(def: BlockDef, components: UIComponent[]): UIComponent[] {
  switch (def.id) {
    case 'get_label_text': case 'set_label_text': return components.filter(c => c.type === 'Label' || c.type === 'Button' || c.type === 'TextBox');
    case 'get_textbox_text': return components.filter(c => c.type === 'TextBox');
    case 'storage_get_value': case 'storage_set_value': return components.filter(c => c.type === 'Storage');
    case 'set_timer_enabled': case 'event_timer_tick': return components.filter(c => c.type === 'Timer');
    case 'event_clock_timer': return components.filter(c => c.type === 'Timer');
    case 'notifier_alert': case 'notifier_choose': case 'notifier_close':
    case 'notifier_get_choice': case 'event_notifier_choose':
      return components.filter(c => c.type === 'Notifier');
    case 'event_canvas_touch': case 'canvas_draw_rect': case 'canvas_draw_text': case 'canvas_clear':
    case 'canvas_draw_line': case 'canvas_draw_pixel': case 'canvas_draw_circle':
      return components.filter(c => c.type === 'Canvas');
    case 'event_btn_click': return components.filter(c => c.type === 'Button');
    case 'sprite_move': case 'sprite_rotate': case 'sprite_create':
      return components.filter(c => c.type === 'Sprite');
    case 'call_vibrate': return components.filter(c => c.type === 'Vibrator');
    case 'event_key_press': return components.filter(c => c.type === 'KeypadListener');
    default: return components;
  }
}

function nextChainIds(blocks: BlockInstance[], headId: string, max = 300): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  let cur = blocks.find(b => b.id === headId);
  while (cur && !seen.has(cur.id) && out.length < max) {
    seen.add(cur.id);
    out.push(cur.id);
    cur = blocks.find(b => b.id === cur.nextBlockId);
  }
  return out;
}

function subtreeIds(blocks: BlockInstance[], rootId: string, max = 500): Set<string> {
  const out = new Set<string>();
  const stack = [rootId];
  const seen = new Set<string>();
  while (stack.length && out.size < max) {
    const id = stack.pop() as string;
    if (seen.has(id)) continue;
    seen.add(id);
    const b = blocks.find(x => x.id === id);
    if (!b) continue;
    out.add(id);
    if (b.nextBlockId) stack.push(b.nextBlockId);
    for (const h of Object.values(b.childBlocks || {})) stack.push(h);
    for (const v of Object.values(b.inputConnections || {})) stack.push(v);
  }
  return out;
}

type BlockRef =
  | { kind: 'next'; from: string }
  | { kind: 'body'; from: string; slot: string }
  | { kind: 'input'; from: string; input: string };

function findRef(blocks: BlockInstance[], id: string): BlockRef | null {
  for (const b of blocks) {
    if (b.nextBlockId === id) return { kind: 'next', from: b.id };
    for (const [slot, h] of Object.entries(b.childBlocks || {})) if (h === id) return { kind: 'body', from: b.id, slot };
    for (const [input, v] of Object.entries(b.inputConnections || {})) if (v === id) return { kind: 'input', from: b.id, input };
  }
  return null;
}

function unlinkRef(blocks: BlockInstance[], id: string): BlockInstance[] {
  const ref = findRef(blocks, id);
  if (!ref) return blocks;
  return blocks.map(b => {
    if (b.id !== ref.from) return b;
    if (ref.kind === 'next') return { ...b, nextBlockId: undefined };
    if (ref.kind === 'body') {
      const cb = { ...(b.childBlocks || {}) };
      delete cb[ref.slot];
      return { ...b, childBlocks: cb };
    }
    const ic = { ...(b.inputConnections || {}) };
    delete ic[ref.input];
    return { ...b, inputConnections: ic };
  });
}

function newBlockId(): string {
  return `blk_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
}
function makeBlock(def: BlockDef, x: number, y: number, prefill?: Record<string, string>): BlockInstance {
  const block: BlockInstance = { id: newBlockId(), defId: def.id, category: def.category, x, y, fields: {}, inputConnections: {} };
  for (const inp of def.inputs || []) block.fields[inp.name] = inp.default;
  if (prefill) block.fields = { ...block.fields, ...prefill };
  return block;
}

type DragPayload =
  | { kind: 'statement'; headId: string; tailIds: Set<string> }
  | { kind: 'value'; headId: string }
  | { kind: 'palette'; defId: string; isValue: boolean; prefill?: Record<string, string> };


/* Ngữ cảnh truyền xuống mọi khối (giữ component ổn định, không remount) */
interface WsCtx {
  blocks: BlockInstance[];
  components: UIComponent[];
  byId: Map<string, BlockInstance>;
  drag: DragPayload | null;
  hoverZone: string | null;
  /** Kéo-thả kiểu App Inventor: pointerdown khởi động kéo, thả qua [data-zone] */
  stmtPointerDown: (e: React.PointerEvent, block: BlockInstance) => void;
  valPointerDown: (e: React.PointerEvent, block: BlockInstance) => void;
  updateField: (blockId: string, field: string, value: any) => void;
  deleteSplice: (blockId: string) => void;
  detachInput: (blockId: string, input: string) => void;
  detachBody: (blockId: string, slot: string) => void;
  appendStatement: (containerId: string, slot: string, defId: string) => void;
  /** Các ô nhập tên thành phần đang trỏ tới thành phần đã bị xóa/đổi tên ở Designer */
  brokenRefs: (block: BlockInstance) => string[];
  /** Các khối lệnh lồng nhau (builtin + tiện ích) cho menu "Thêm lệnh" */
  innerStmtDefs: BlockDef[];
  /** Context menu chuột phải kiểu Kodular — mở menu thao tác khối */
  openContextMenu: (e: React.MouseEvent, blockId: string) => void;
  /** Cập nhật thuộc tính khối (comment/collapsed/disabled/generic) */
  patchBlock: (blockId: string, patch: Partial<BlockInstance>) => void;
}

/* ================================================================== *
 *  Các component khối — module scope (type ổn định, giữ focus ô nhập)
 * ================================================================== */


/** Dịch phrase drawer thành phần (chứa tên thành phần thật) theo ngôn ngữ hiện tại */
function phraseLabel(raw: string): string {
  const t = BLOCK_T;
  if (!t) return raw;
  // VI là ngôn ngữ gốc của phrase — chỉ dịch khi người dùng chọn ngôn ngữ khác
  if (t('bw.isVi', 'no') === 'yes') return raw;
  let s = raw;
  const MAP: [RegExp, string][] = [
    [/^khi (.+)\.(KhởiTạo|Khởi tạo) do$/, 'when $1.Initialize do'],
    [/^khi (.+)\.được bấm do$/, 'when $1.Click do'],
    [/^khi (.+)\.mỗi chu kỳ \(chung\) do$/, 'when $1.Timer do'],
    [/^khi (.+)\.mỗi chu kỳ do$/, 'when $1.Timer do'],
    [/^khi (.+)\.nhấn phím bất kỳ \(phím\) do$/, 'when $1.AnyKeyPress(key) do'],
    [/^khi (.+)\.nhấn phím do$/, 'when $1.KeyPress do'],
    [/^khi (.+)\.ChọnSauThôngBáo do$/, 'when $1.AfterChoosing do'],
    [/^đặt (.+)\.NộiDung = …$/, 'set $1.Text = …'],
    [/^lấy (.+)\.NộiDung$/, 'get $1.Text'],
    [/^đặt (.+)\.Bật = …$/, 'set $1.Enabled = …'],
    [/^đặt (.+)\.(.+) = …$/, 'set $1.$2 = …'],
    [/^lấy (.+)\.LựaChọn$/, 'get $1.Choice'],
    [/^(.+)\.Hiển thịThôngBáo\(…\)$/, '$1.ShowAlert(…)'],
    [/^(.+)\.HỏiChọn\(…\)$/, '$1.ShowChoose(…)'],
    [/^(.+)\.ĐóngThôngBáo\(\)$/, '$1.CloseAlert()'],
    [/^(.+)\.XóaMànHình\(\)$/, '$1.Clear()'],
    [/^(.+)\.VẽHìnhChữNhật$/, '$1.DrawRect'],
    [/^(.+)\.VẽHìnhTròn$/, '$1.DrawCircle'],
    [/^(.+)\.VẽĐườngThẳng$/, '$1.DrawLine'],
    [/^(.+)\.VẽĐiểmẢnh$/, '$1.DrawPixel'],
    [/^(.+)\.VẽChữ$/, '$1.DrawText'],
    [/^(.+)\.DiChuyển\(…\)$/, '$1.MoveTo(…)'],
    [/^xoay (.+) góc …$/, 'rotate $1 by angle …'],
    [/^(.+)\.Rung\(…\)$/, '$1.Vibrate(…)'],
    [/^(.+)\.Phát âm thanh$/, '$1.PlaySound'],
    [/^đặt (.+) = …$/, 'set $1 = …'],
    [/^lấy (.+)$/, 'get $1'],
    [/^khi bàn phím nhấn phím do$/, 'when Keypad.KeyPress do'],
    [/^khi nhấn phím bất kỳ \(phím\) do$/, 'when AnyKeyPress(key) do'],
    [/^(.+)\.KhởiTạoBànPhím \[thiết bị\]$/, '$1.InitKeypad [device]'],
    [/^gọi thủ tục (.+)$/, 'call procedure $1'],
  ];
  for (const [re, out] of MAP) {
    const m = raw.match(re);
    if (m) {
      s = out;
      for (let i = 1; i < m.length; i++) s = s.replace(`$${i}`, m[i]);
      return s;
    }
  }
  return raw;
}

function CompBlockRow({ def, phrase, onPointerDown, onAdd }: {
  def: BlockDef; phrase: string;
  onPointerDown: (e: React.PointerEvent) => void;
  onAdd: () => void;
}) {
  const { t } = useI18n();
  BLOCK_T = t;
  const isVal = !!def.outputType;
  return (
    <div
      onPointerDown={onPointerDown}
      onClick={onAdd}
      title={BLOCK_T ? `${BLOCK_T('bw.dragOrClick')} “${phraseLabel(phrase)}”` : `Kéo “${phrase}”`}
      className="cursor-grab active:cursor-grabbing select-none"
    >
      <div
        className="flex items-center gap-2 rounded-lg border bg-[#FDFCFF]/85 p-2 pl-3 transition-all hover:shadow-md group pointer-events-none"
        style={{ borderColor: `${def.color}55` }}
      >
        <span className="w-1 h-8 rounded-full shrink-0" style={{ backgroundColor: def.color }} />
        <span className="flex-1 min-w-0">
          <span className="block text-xs font-semibold text-[#221E2B] truncate">{phraseLabel(phrase)}</span>
          <span className="block text-[9px] text-[#6F687E] font-mono mt-0.5 truncate">
            {def.type === 'event' ? (t('bw.kindEvent')) : isVal ? `${t('bw.kindValue')} ${def.outputType}` : def.bodies ? t('bw.kindControl') : t('bw.kindStatement')}
          </span>
        </span>
        <span className="w-5 h-5 rounded-md bg-[#EFEAF6] group-hover:bg-[#E91E63] group-hover:text-white border border-[#CBC3DD] flex items-center justify-center shrink-0 transition-colors">
          <Plus className="w-3 h-3" />
        </span>
      </div>
    </div>
  );
}

function PaletteChip({ def }: { def: BlockDef }) {
  const { t } = useI18n();
  BLOCK_T = t;
  const isVal = !!def.outputType;
  return (
    <div
      className="flex items-center gap-2 rounded-lg border bg-[#FDFCFF]/85 p-2 pl-3 transition-all hover:shadow-md group pointer-events-none"
      style={{ borderColor: `${def.color}66`, background: `linear-gradient(90deg, ${def.color}14, transparent)` }}
    >
      <span className="w-1 h-8 rounded-full shrink-0" style={{ backgroundColor: def.color }} />
      <span className="flex-1 min-w-0">
        <span className="block text-xs font-semibold text-[#221E2B] truncate">{blkLabel(def)}</span>
        <span className="block text-[9px] text-[#6F687E] font-mono mt-0.5 truncate">
          {def.type === 'event' ? t('bw.kindEventHead') : isVal ? `${t('bw.kindValue')} ${def.outputType}` : def.bodies ? t('bw.kindControlBody') : t('bw.kindStatement')}
        </span>
      </span>
      <span className="w-5 h-5 rounded-md bg-[#EFEAF6] group-hover:bg-[#7C3AED] group-hover:text-white border border-[#CBC3DD] flex items-center justify-center shrink-0 transition-colors">
        <Plus className="w-3 h-3" />
      </span>
    </div>
  );
}

/** Vùng "rãnh nối" giữa hai khối lệnh — thả để chen lệnh TRƯỚC target */
function InsertShelf({ ctx, targetId, color, zid }: { ctx: WsCtx; targetId: string; color: string; zid: string }) {
  const { t } = useI18n();
  const accepts = !!ctx.drag && ctx.drag.kind !== 'value';
  const active = ctx.hoverZone === zid;
  return (
    <div
      className="relative"
      data-zone={zid} data-action="before" data-target={targetId}
      style={{ height: 8, minHeight: 8 }}
      title={accepts ? (BLOCK_T ? BLOCK_T('bw.insertBefore', 'Insert before this block') : 'Thả khối lệnh vào đây để chen trước') : undefined}
    >
      <div
        className="pointer-events-none absolute transition-all"
        style={{
          left: BODYIndent + 4, right: 8, top: 1, height: 6,
          background: active ? '#22d3ee' : accepts ? `${color}88` : 'transparent',
          borderRadius: 999,
          boxShadow: active ? '0 0 0 3px rgba(34,211,238,0.4), 0 0 8px rgba(34,211,238,0.5)' : undefined
        }}
      />
    </div>
  );
}

/** Vùng thả ở đuôi chuỗi — nối tiếp lệnh phía sau */
function TailDrop({ ctx, targetId }: { ctx: WsCtx; targetId: string }) {
  const { t } = useI18n();
  const zid = `tail_${targetId}`;
  const accepts = !!ctx.drag && ctx.drag.kind !== 'value';
  const active = ctx.hoverZone === zid;
  return (
    <div
      data-zone={zid} data-action="append" data-target={targetId}
      className="transition-all"
      style={{
        marginLeft: BODYIndent,
        height: 18,
        border: active ? '2px solid #22d3ee' : accepts ? '2px dashed rgba(140,130,160,0.6)' : '2px dashed transparent',
        background: active ? 'rgba(34,211,238,0.25)' : accepts ? 'rgba(140,130,160,0.06)' : 'transparent',
        borderRadius: '0 0 6px 6px'
      }}
      title={t('bw.dropAppend')}
    />
  );
}

/** Khối LỆNH (event hat / statement) — hốc thân lệnh C lồng nhau + chuỗi tiếp nối */
function StatementView({ ctx, block, isHead }: { ctx: WsCtx; block: BlockInstance; isHead?: boolean }) {
  const { t } = useI18n();
  BLOCK_T = t;
  const def = defOf(block);
  if (!def) return null;
  const ev = isEventDef(def);
  const next = block.nextBlockId ? ctx.byId.get(block.nextBlockId) : undefined;
  const broken = ctx.brokenRefs(block);
  // Trạng thái từ context menu (kiểu Kodular)
  const isDisabled = !!block.disabled;
  const isCollapsed = !!block.collapsed;
  const hasComment = !!block.comment;

  return (
    <div
      className="flex flex-col items-stretch w-max max-w-[520px]"
      data-block={block.id}
      onPointerDown={(e) => ctx.stmtPointerDown(e, block)}
      onContextMenu={(e) => ctx.openContextMenu(e, block.id)}
    >
      {/* Card khối */}
      <div
        className="relative text-white select-none transition-opacity"
        style={{
          minWidth: 165,
          opacity: isDisabled ? 0.45 : 1,
          filter: isDisabled ? 'grayscale(60%)' : undefined
        }}
      >
        {/* Badge comment — bóng góc phải trên (như AI2) */}
        {hasComment && (
          <div
            className="absolute -right-2 top-6 z-20 max-w-[180px] bg-amber-100 text-amber-900 text-[9px] leading-snug rounded-lg px-2 py-1 shadow-lg border border-amber-300 cursor-help"
            title={block.comment}
            style={{ fontSize: 9 }}
          >
            💬 {block.comment!.slice(0, 60)}{block.comment!.length > 60 ? '…' : ''}
          </div>
        )}
        {/* Blockly-style notch ở trên (không có cho event hat blocks) */}
        {!ev && !isHead && (
          <div className="absolute left-0 top-0 w-full pointer-events-none" style={{ height: NOTCH_H, zIndex: 3 }}>
            <svg width="100%" height={NOTCH_H} preserveAspectRatio="none" viewBox="0 0 200 8">
              {/* Nền notch */}
              <rect x="0" y="0" width="200" height="8" fill={def.color} />
              {/* Khe nhận tab từ block trên */}
              <rect x={BODYIndent + 2} y="0" width={NOTCH_W - 4} height="8" fill="rgba(0,0,0,0.25)" rx="2" />
            </svg>
          </div>
        )}

        {/* Thân khối chính */}
        <div
          className="relative"
          style={{
            backgroundColor: def.color,
            borderRadius: ev ? '16px 16px 4px 4px' : isHead ? '10px 10px 4px 4px' : '4px',
            marginTop: (!ev && !isHead) ? NOTCH_H : 0,
            boxShadow: broken.length > 0
              ? '0 0 0 2px #dc2626, 0 3px 8px rgba(0,0,0,0.3), inset 0 -2px 0 rgba(0,0,0,0.2)'
              : '0 3px 8px rgba(0,0,0,0.3), inset 0 -2px 0 rgba(0,0,0,0.2)'
          }}
        >
          {/* Đỉnh mũ tròn cho event blocks */}
          {ev && (
            <div
              className="absolute left-0 right-0 pointer-events-none"
              style={{
                top: -8, height: 12,
                background: def.color,
                borderRadius: '50% 50% 0 0 / 100% 100% 0 0',
                boxShadow: '0 -1px 3px rgba(0,0,0,0.15)'
              }}
            />
          )}

          {/* Nút lỗi */}
          {broken.length > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); ctx.deleteSplice(block.id); }}
              className="absolute -right-1.5 -top-1.5 z-10 w-5 h-5 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center shadow hover:scale-110 transition-transform cursor-pointer"
              title={t('bw.blockError')}
            >
              <X className="w-3 h-3" />
            </button>
          )}

          <div className="px-3 pt-2 pb-2 flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 pr-2">
              <span
                className="font-black tracking-wide whitespace-nowrap"
                style={{ fontSize: 11.5, textShadow: '0 1px 2px rgba(0,0,0,0.35)' }}
              >
                {ev ? '▶ ' : ''}{shortLabel(def)}
              </span>
              {def.inputs && def.inputs.map(inp => inp.socket
                ? <SocketChip key={inp.name} ctx={ctx} consumerId={block.id} inputName={inp.name} inputType={inp.type} provId={block.inputConnections?.[inp.name]} />
                : <FieldChip key={inp.name} ctx={ctx} block={block} def={def} inp={inp} />)}
            </div>

            {broken.length > 0 && (
              <div
                className="mt-1 flex items-center gap-1 bg-red-600/30 text-red-50 rounded px-1.5 py-0.5 text-[9px] font-bold"
                title={t('bw.brokenRef')}
              >
                <AlertTriangle className="w-3 h-3 shrink-0" />
                <span className="truncate">{BLOCK_T ? BLOCK_T('bw.deletedRenamed', '') : 'Đã xóa/đổi tên'}: {broken.map(f => block.fields[f]).join(', ')}</span>
              </div>
            )}

            {/* Hốc thân lệnh (C-body) — ẨN khi khối bị Collapse (context menu) */}
            {def.bodies && def.bodies.length > 0 && !isCollapsed && (
              <div className="mt-1 flex flex-col gap-1">
                {def.bodies.map(body => {
                  const headId = (block.childBlocks || {})[body.name];
                  const chain = headId ? nextChainIds(ctx.blocks, headId) : [];
                  const bodyZid = `body_${block.id}_${body.name}`;
                  const accepts = !!ctx.drag && ctx.drag.kind !== 'value';
                  return (
                    <div key={body.name} className="flex flex-col">
                      {/* Label "do" */}
                      <div className="flex items-center gap-1 px-1 py-0.5">
                        <span className="text-[9px] font-black uppercase tracking-wider text-white/80">{bodyLabel(body.label)}</span>
                        {chain.length > 0 && (
                          <span className="text-[9px] font-mono bg-black/25 text-white/85 rounded-full px-1.5 py-px">{chain.length}</span>
                        )}
                        {chain.length > 0 && (
                          <button
                            onClick={(e) => { e.stopPropagation(); ctx.detachBody(block.id, body.name); }}
                            className="ml-auto w-4 h-4 rounded-full hover:bg-white/25 text-white/70 hover:text-white flex items-center justify-center cursor-pointer"
                            title={`${BLOCK_T ? BLOCK_T('bw.detachBody', '') : 'Tách thân'} "${bodyLabel(body.label)}"`}
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                        )}
                      </div>
                      {/* Vùng C-body */}
                      {chain.length > 0 ? (
                        <div className="flex flex-col items-stretch ml-4 pl-2 border-l-2 border-white/20">
                          <InsertShelf ctx={ctx} targetId={chain[0]} color={def.color} zid={`${bodyZid}_top`} />
                          <StatementView ctx={ctx} block={ctx.byId.get(chain[0])!} />
                        </div>
                      ) : (
                        <div className="flex flex-col items-stretch gap-1 ml-4 pl-2 border-l-2 border-white/20">
                          <div
                            data-zone={bodyZid} data-action="intobody"
                            data-container={block.id} data-slot={body.name}
                            className="rounded border-2 border-dashed flex items-center justify-center transition-all"
                            style={{
                              borderColor: ctx.hoverZone === bodyZid ? '#22d3ee' : accepts ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.3)',
                              background: ctx.hoverZone === bodyZid ? 'rgba(34,211,238,0.2)' : 'transparent',
                              minHeight: 28
                            }}
                          >
                            <span className="text-[9px] text-white/60 font-medium">
                              {ctx.drag ? '⊕ Thả vào đây' : 'Thả khối lệnh'}
                            </span>
                          </div>
                          <AddStatementMenu ctx={ctx} parentId={block.id} slot={body.name} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Thu gọn: hiện số lệnh trong thân khi Collapse (context menu) */}
            {isCollapsed && def.bodies && def.bodies.length > 0 && (() => {
              const total = def.bodies.reduce((n, b) => n + ((block.childBlocks || {})[b.name] ? nextChainIds(ctx.blocks, (block.childBlocks || {})[b.name]!).length : 0), 0);
              return total > 0 ? (
                <div className="text-[9px] font-mono bg-black/25 text-white/85 rounded-full px-1.5 py-px self-start" title={t('bw.collapsedHint')}>
                  ⏷ {total} lệnh
                </div>
              ) : null;
            })()}
          </div>
        </div>

        {/* Tab ở mép dưới — cắm vào block kế tiếp */}
        {!ev && (
          <div className="relative pointer-events-none" style={{ height: TAB_H, marginTop: -1, zIndex: 3 }}>
            <svg width={BODYIndent + TAB_W + 10} height={TAB_H + 2} viewBox={`0 0 ${BODYIndent + TAB_W + 10} ${TAB_H + 2}`}>
              <rect x="0" y="0" width={BODYIndent + TAB_W + 10} height={TAB_H + 2} fill={def.color} />
              {/* Tab nổi */}
              <rect
                x={BODYIndent + 2} y={0}
                width={TAB_W - 4} height={TAB_H + 1}
                fill={def.color}
                rx={2}
              />
              <rect
                x={BODYIndent + 4} y={1}
                width={TAB_W - 8} height={TAB_H - 1}
                fill="rgba(0,0,0,0.15)"
                rx={1}
              />
            </svg>
          </div>
        )}

        {/* Khối tiếp theo trong chuỗi */}
        {next && (
          <div className="flex flex-col items-stretch">
            <InsertShelf ctx={ctx} targetId={next.id} color={def.color} zid={`join_${block.id}_${next.id}`} />
            <StatementView ctx={ctx} block={next} />
          </div>
        )}
      </div>
    </div>
  );
}

/** Khối GIÁ TRỊ — viên thuốc tròn, cắm vào socket của khối dùng */
function ValuePill({ ctx, valueBlock, embedded }: { ctx: WsCtx; valueBlock: BlockInstance; embedded: boolean }) {
  const { t } = useI18n();
  BLOCK_T = t;
  const def = defOf(valueBlock);
  if (!def) return null;
  const broken = ctx.brokenRefs(valueBlock);
  return (
    <div
      className="inline-flex items-center gap-1 text-white select-none cursor-grab active:cursor-grabbing"
      style={{
        backgroundColor: def.color, fontSize: 11, fontWeight: 700,
        padding: '4px 10px 4px 8px',
        borderRadius: 14,
        boxShadow: broken.length > 0
          ? '0 0 0 2px #dc2626, 0 2px 6px rgba(0,0,0,0.4), inset 0 -1px 0 rgba(0,0,0,0.2)'
          : '0 2px 6px rgba(0,0,0,0.4), inset 0 -1px 0 rgba(0,0,0,0.2)',
        textShadow: '0 1px 2px rgba(0,0,0,0.3)'
      }}
      data-block={valueBlock.id}
      onPointerDown={(e) => ctx.valPointerDown(e, valueBlock)}
      onContextMenu={(e) => ctx.openContextMenu(e, valueBlock.id)}
      title={broken.length > 0 ? `${BLOCK_T ? BLOCK_T('bw.deletedRenamed', '') : 'Đã xóa/đổi tên'}: ${broken.map(f => valueBlock.fields[f]).join(', ')}` : undefined}
    >
      {broken.length > 0 && <AlertTriangle className="w-3 h-3 text-red-200 shrink-0" />}
      {!embedded && <span className="w-2 h-2 rounded-full bg-white/80 shrink-0" />}
      <span className="whitespace-nowrap">{shortLabel(def)}</span>
      {def.inputs && def.inputs.map(inp => inp.socket
        ? <SocketChip key={inp.name} ctx={ctx} consumerId={valueBlock.id} inputName={inp.name} inputType={inp.type} provId={valueBlock.inputConnections?.[inp.name]} />
        : <FieldChip key={inp.name} ctx={ctx} block={valueBlock} def={def} inp={inp} />)}
    </div>
  );
}

/**
 * Socket nhận khối giá trị — kiểu App Inventor / Scratch:
 *  - CHƯA cắm gì → ô BÓNG (shadow) màu trắng, GÕ TRỰC TIẾP được
 *    (văn bản / số / đúng-sai theo kiểu của input).
 *  - ĐÃ cắm khối giá trị → hiện viên thuốc + nút gỡ.
 * Thả một khối giá trị lên socket sẽ thay thế ô bóng; giá trị đã gõ được
 * giữ nguyên trong fields nên gỡ khối ra là dùng tiếp.
 */
function SocketChip({ ctx, consumerId, inputName, inputType, provId }: {
  ctx: WsCtx; consumerId: string; inputName: string; inputType: string; provId?: string;
}) {
  const { t } = useI18n();
  const prov = provId ? ctx.byId.get(provId) : undefined;
  const consumer = ctx.byId.get(consumerId);
  const inpDef = consumer ? defOf(consumer)?.inputs?.find(i => i.name === inputName) : undefined;
  const zid = `socket_${consumerId}_${inputName}`;
  const accepts = !!ctx.drag && (ctx.drag.kind === 'value' || (ctx.drag.kind === 'palette' && ctx.drag.isValue));
  const active = ctx.hoverZone === zid;
  const cap = captionOf(inputName);

  /** Ô bóng khi socket trống — gõ trực tiếp không cần kéo khối nào cả */
  const shadow = (() => {
    const current = consumer?.fields[inputName] ?? inpDef?.default ?? '';
    const write = (v: unknown) => ctx.updateField(consumerId, inputName, v);
    const base: React.CSSProperties = {
      fontSize: 11, fontWeight: 700, color: '#111827',
      background: 'transparent', border: 'none', outline: 'none'
    };
    if (inputType === 'boolean') {
      return (
        <select
          value={String(current)} onChange={e => write(e.target.value === 'true')}
          className="cursor-pointer rounded-full px-1.5 py-px"
          style={base}
        >
          <option value="true">✓ {BLOCK_T ? BLOCK_T('bw.true', 'True') : 'Đúng'}</option>
          <option value="false">✗ {BLOCK_T ? BLOCK_T('bw.false', 'False') : 'Sai'}</option>
        </select>
      );
    }
    if (inputType === 'number') {
      return (
        <input
          type="number" value={String(current)} onChange={e => write(Number(e.target.value))}
          className="w-14 text-center rounded-full px-1.5 py-px" style={base}
        />
      );
    }
    return (
      <input
        type="text" value={String(current)} placeholder={t('bw.textPh')}
        onChange={e => write(e.target.value)}
        className="w-[78px] rounded-full px-2 py-px placeholder:font-normal placeholder:text-[#9ca3af]"
        style={base}
      />
    );
  })();

  return (
    <span className="inline-flex items-center gap-1 align-middle" style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.92)' }}>
      {cap && <span style={{ whiteSpace: 'nowrap' }}>{cap}:</span>}
      {prov ? (
        <span
          className="inline-flex items-center gap-0.5 rounded-full"
          data-zone={zid} data-action="socket"
          data-consumer={consumerId} data-input={inputName}
          style={{ outline: active ? '2px solid #22d3ee' : undefined, borderRadius: 999, padding: '2px' }}
          title={t('bw.swapValue')}
        >
          <ValuePill ctx={ctx} valueBlock={prov} embedded />
          <button
            onClick={(e) => { e.stopPropagation(); ctx.detachInput(consumerId, inputName); }}
            className="w-4 h-4 rounded-full hover:bg-black/30 text-white/70 hover:text-white flex items-center justify-center cursor-pointer shrink-0"
            title={t('bw.unplugValue')}
          >
            <X className="w-2.5 h-2.5" />
          </button>
        </span>
      ) : (
        <span
          data-zone={zid} data-action="socket"
          data-consumer={consumerId} data-input={inputName}
          className="inline-flex items-center justify-center transition-all align-middle"
          style={{
            borderRadius: 999, padding: '3px 6px',
            background: active ? 'rgba(34,211,238,0.3)' : 'rgba(255,255,255,0.95)',
            boxShadow: active
              ? '0 0 0 3px #22d3ee, 0 0 0 6px rgba(34,211,238,0.35)'
              : 'inset 0 1px 2px rgba(0,0,0,0.30)',
            minWidth: 40, minHeight: 22
          }}
          title={accepts
            ? 'Thả khối giá trị vào đây (hoặc gõ trực tiếp)'
            : `Gõ trực tiếp, hoặc kéo khối ${inputType === 'number' ? 'số' : inputType === 'boolean' ? 'đúng/sai' : 'giá trị'} cắm vào đây`}
        >
          {shadow}
        </span>
      )}
    </span>
  );
}

function FieldSelect({ value, onChange, children, danger, title }: { value: string; onChange: (v: string) => void; children: React.ReactNode; danger?: boolean; title?: string }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      title={title}
      className={`rounded-md px-1 font-bold outline-none cursor-pointer ${danger ? 'bg-red-100 text-red-800 ring-2 ring-red-400' : 'bg-white text-[#111827]'}`}
      style={{ fontSize: 11, maxWidth: 150 }}
    >
      {children}
    </select>
  );
}

/** Ô nhập tham số thường (kiểu Blockly — nền trắng chữ đậm) */
function FieldChip({ ctx, block, def, inp }: {
  ctx: WsCtx; block: BlockInstance; def: BlockDef;
  inp: NonNullable<BlockDef['inputs']>[number];
}) {
  const { t } = useI18n();
  const current = block.fields[inp.name] ?? inp.default;
  const cap = captionOf(inp.name);
  const isCompName = isComponentRefInput(inp);
  const showCap = cap !== '' && !isCompName;
  const compList = isCompName ? componentOptionsFor(def, ctx.components) : [];
  // Thành phần bị xóa/đổi tên ở Designer: ô chọn chuyển đỏ kèm cảnh báo
  const missingCompName = isCompName && String(current ?? '').trim() !== ''
    ? (!compList.some(c => c.name === String(current)) ? String(current) : null)
    : null;

  const selectOptions: [string, string][] =
    inp.name === 'sound' ? SOUND_OPTIONS
      : inp.name === 'key' ? KEY_OPTIONS
        : inp.options ? inp.options.map(o => [o, o] as [string, string]) : [];

  let control: React.ReactNode;
  if (inp.type === 'property') {
    // Dropdown thuộc tính CHUNG theo linh kiện đang chọn (Chỉ hiện thuộc tính linh kiện có trong Designer)
    const compName = String(block.fields.component ?? '');
    const comp = ctx.components.find(c => c.name === compName);
    const propLabels = genericPropertiesFor(comp).map(p => p.label);
    const curProp = String(current ?? 'KhảNhìn');
    control = (
      <FieldSelect value={propLabels.includes(curProp) ? curProp : ''} onChange={v => ctx.updateField(block.id, inp.name, v)}>
        {!propLabels.includes(curProp) && (
          <option value="" className="text-red-700 font-bold">⚠ {curProp} ({BLOCK_T ? BLOCK_T('bw.notOnComponent', 'not on this component') : 'không có trên linh kiện này'})</option>
        )}
        {propLabels.map(l => <option key={l} value={l}>{l}</option>)}
      </FieldSelect>
    );
  } else if (isCompName && compList.length > 0) {
    control = (
      <FieldSelect
        value={String(current)}
        onChange={v => ctx.updateField(block.id, inp.name, v)}
        danger={!!missingCompName}
        title={missingCompName ? (BLOCK_T ? BLOCK_T('bw.brokenRef').replace('{name}', missingCompName) : `Thành phần "${missingCompName}" đã bị xóa hoặc đổi tên`) : undefined}
      >
        {missingCompName && <option value={missingCompName} className="text-red-700 font-bold">⚠ {missingCompName} ({BLOCK_T ? BLOCK_T('bw.deletedRenamed', 'deleted/renamed') : 'đã xóa/đổi tên'})</option>}
        {compList.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
      </FieldSelect>
    );
  } else if (selectOptions.length > 0) {
    control = (
      <FieldSelect value={String(current)} onChange={v => ctx.updateField(block.id, inp.name, v)}>
        {selectOptions.map(([v, l]) => {
          let lbl = l;
          if (BLOCK_T) {
            if (l.startsWith('bw.') || l.startsWith('m.')) lbl = BLOCK_T(l, l);
            else if (/[à-ỹ]/.test(l)) lbl = BLOCK_T(`op.${l}`, l);
          }
          return <option key={v} value={v}>{lbl}</option>;
        })}
      </FieldSelect>
    );
  } else if (inp.type === 'boolean') {
    control = (
      <FieldSelect value={String(current)} onChange={v => ctx.updateField(block.id, inp.name, v === 'true')}>
        <option value="true">✓ {BLOCK_T ? BLOCK_T('bw.true', 'True') : 'Đúng'}</option>
        <option value="false">✗ {BLOCK_T ? BLOCK_T('bw.false', 'False') : 'Sai'}</option>
      </FieldSelect>
    );
  } else if (inp.name === 'color') {
    control = (
      <input
        type="color"
        value={typeof current === 'string' && /^#[0-9a-fA-F]{6}$/.test(current) ? current : '#ffffff'}
        onChange={e => ctx.updateField(block.id, inp.name, e.target.value)}
        className="w-5 h-5 border-0 p-0 bg-transparent cursor-pointer"
        title={t('bw.pickColor')}
      />
    );
  } else {
    control = (
      <input
        type={inp.type === 'number' ? 'number' : 'text'}
        value={current ?? ''}
        onChange={e => ctx.updateField(block.id, inp.name, inp.type === 'number' ? Number(e.target.value) : e.target.value)}
        className={`bg-white text-[#111827] rounded-md px-1.5 font-mono font-bold outline-none focus:ring-2 ring-[#11182744] ${inp.type === 'number' ? 'w-14 text-center' : 'w-24'}`}
        style={{ fontSize: 11 }}
      />
    );
  }

  return (
    <span className="inline-flex items-center gap-0.5 whitespace-nowrap">
      {showCap && <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.85)' }}>{cap}:</span>}
      {control}
    </span>
  );
}

/** Nút "+ Thêm lệnh" cho hốc rỗng */
function AddStatementMenu({ ctx, parentId, slot }: { ctx: WsCtx; parentId: string; slot: string }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <div className="relative flex items-center">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
        className="flex items-center gap-1 text-[9px] font-bold text-white/55 hover:text-white hover:bg-black/25 rounded-md px-1.5 py-0.5 border border-dashed border-white/25 cursor-pointer self-start"
      >
        <Plus className="w-2.5 h-2.5" />
        <span>{t('bw.addStatement')}</span>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-40 mt-1 w-[220px] max-h-44 overflow-auto bg-[#2A2540] border border-white/25 rounded-lg shadow-2xl p-1.5 flex flex-col gap-0.5">
          {ctx.innerStmtDefs.map(sd => (
            <button
              key={sd.id}
              onClick={(e) => { e.stopPropagation(); ctx.appendStatement(parentId, slot, sd.id); setOpen(false); }}
              className="text-left text-[10px] text-white/90 hover:bg-white/15 rounded px-1.5 py-1 cursor-pointer truncate flex items-center gap-1.5"
            >
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: sd.color }} />
              <span className="truncate">{sd.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ================================================================== *
 *  Component chính
 * ================================================================== */
export const BlockWorkspace: React.FC<BlockWorkspaceProps> = ({
  blocks, components, onChangeBlocks, projectName, extensions = [], resolution,
  screens = [], activeScreen, entryScreen,
  onSwitchScreen, onAddScreen, onCopyScreen, onRenameScreen, onDeleteScreen
}) => {
  const { t } = useI18n();
  BLOCK_T = t; // helper ngoài component dùng nhãn theo ngôn ngữ hiện tại
  const { confirmDialog, promptDialog, infoDialog } = useSysDialogs();
  const [isExtModalOpen, setIsExtModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showLuaPreview, setShowLuaPreview] = useState(false);
  /** Mục đang mở trong palette kiểu Kodular: `comp_<id>` (thành phần) hoặc `cat_<id>` (danh mục) */
  const [expandedKey, setExpandedKey] = useState<string | null>('comp_screen1');
  /** Bật/tắt bảng cảnh báo góc dưới (nút "Show Warnings" kiểu Kodular) */
  const [showWarnings, setShowWarnings] = useState(false);
  const [generatedLua, setGeneratedLua] = useState('');
  const [view, setView] = useState({ x: 40, y: 24, k: 1 });

  /* Kéo-thả kiểu App Inventor — KHÔNG dùng HTML5 drag & drop (dataTransfer hay bị
     chặn trong webview). accepts/drop được nạp qua ref vì định nghĩa ở bên dưới. */
  const acceptsRef = useRef<(p: DragPayload, zoneEl: HTMLElement, hoverEl: HTMLElement) => boolean>(() => false);
  const dropRef = useRef<(p: DragPayload, zoneEl: HTMLElement, pt: { x: number; y: number }) => void>(() => {});
  const pd = usePointerDrag<DragPayload>({
    accepts: (p, zoneEl, hoverEl) => acceptsRef.current(p, zoneEl, hoverEl),
    drop: (p, zoneEl, pt) => dropRef.current(p, zoneEl, pt)
  });
  const drag: DragPayload | null = pd.drag?.payload ?? null;
  const hoverZone: string | null = pd.overZone?.dataset.zone ?? null;
  const ghost = pd.drag ? {
    x: pd.drag.x + 14, y: pd.drag.y + 14,
    kind: (pd.drag.payload.kind === 'value' || (pd.drag.payload.kind === 'palette' && pd.drag.payload.isValue)) ? 'value' : 'statement',
    label: pd.drag.label, color: pd.drag.color
  } : null;
  const overTrash = pd.overZone?.dataset.action === 'trash';

  const workspaceRef = useRef<HTMLDivElement | null>(null);

  /** Toàn bộ khối khả dụng = builtin + khối từ tiện ích .mvxp */
  const allDefs = useMemo(() => [...BLOCK_DEFINITIONS, ...extensionBlockDefs(extensions)], [extensions]);
  // Cập nhật thanh ghi module — defOf/findDef của các khối trên canvas dùng chung
  ALL_DEFS = allDefs;
  /** Các khối LỆNH lồng nhau (cho menu "Thêm lệnh" trong hốc C) */
  const innerStmtDefs = useMemo(() => allDefs.filter(d => d.statement && d.category !== 'events'), [allDefs]);

  const byId = useMemo(() => {
    const m = new Map<string, BlockInstance>();
    for (const b of blocks) m.set(b.id, b);
    return m;
  }, [blocks]);

  /** Khối TỰ DO = không bị khối nào trỏ tới → đầu mỗi chuỗi trên bảng */
  const roots = useMemo(() => {
    const referenced = new Set<string>();
    for (const b of blocks) {
      if (b.nextBlockId) referenced.add(b.nextBlockId);
      for (const h of Object.values(b.childBlocks || {})) referenced.add(h);
      for (const v of Object.values(b.inputConnections || {})) referenced.add(v);
    }
    return blocks.filter(b => !referenced.has(b.id));
  }, [blocks]);

  useEffect(() => {
    setGeneratedLua(generateLuaFromProject(components, blocks, projectName, 'Screen1', extensions, resolution));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [components, blocks, projectName, extensions]);

  /* ---- Đồng bộ danh sách Thành phần với Designer: nếu thành phần bị xóa/đổi tên
     ở tab Design, làm mới ngay danh sách bên Blocks (đã là props) và bỏ chọn
     mục đang mở nếu không còn tồn tại. Các khối trỏ tên đã xóa được đánh dấu đỏ. ---- */
  const compNames = useMemo(() => new Set(components.map(c => c.name)), [components]);
  const brokenRefFields = useCallback((block: BlockInstance): string[] => {
    const def = defOf(block);
    if (!def) return [];
    const out: string[] = [];
    for (const inp of def.inputs || []) {
      if (!isComponentRefInput(inp)) continue;
      const v = block.fields[inp.name];
      if (typeof v === 'string' && v.trim() !== '' && !compNames.has(v.trim())) out.push(inp.name);
    }
    return out;
  }, [compNames]);
  const brokenBlockCount = useMemo(() => blocks.filter(b => brokenRefFields(b).length > 0).length, [blocks, brokenRefFields]);

  /** Danh sách cảnh báo — nguồn cho bảng "Show Warnings" kiểu Kodular */
  const warnings = useMemo(() => {
    const out: { blockId: string; label: string; message: string }[] = [];
    for (const b of blocks) {
      for (const f of brokenRefFields(b)) {
        out.push({
          blockId: b.id,
          label: shortLabel(defOf(b)),
          message: `Thành phần "${b.fields[f]}" đã bị xóa hoặc đổi tên ở tab Design`
        });
      }
    }
    return out;
  }, [blocks, brokenRefFields]);

  useEffect(() => {
    // Thành phần đang mở trong palette bị xóa ở Designer → đóng mục đó lại
    // (mục SCREEN giả định id 'screen_<tên>' — không thuộc components, bỏ qua)
    if (expandedKey?.startsWith('comp_') && !expandedKey.startsWith('comp_screen_')) {
      const id = expandedKey.slice(5);
      if (!components.some(c => c.id === id)) setExpandedKey(null);
    }
  }, [components, expandedKey]);

  /* ---------------- Undo / Redo (menu chuột phải nền canvas) ----------------
     Lịch sử snapshot các blocks: mỗi thay đổi qua updateBlocks đẩy bản TRƯỚC
     vào undoStack; Ctrl+Z / menu Undo quay về, Ctrl+Y / menu Redo tiến lại. */
  const undoStack = useRef<BlockInstance[][]>([]);
  const redoStack = useRef<BlockInstance[][]>([]);
  const lastPushed = useRef<BlockInstance[] | null>(null);
  const [histVersion, setHistVersion] = useState(0); // re-render để cập nhật enable menu

  /** Ghi 1 snapshot vào undo stack (gọi TRƯỚC khi áp dụng thay đổi) */
  const pushHistory = useCallback((snapshot: BlockInstance[]) => {
    undoStack.current.push(snapshot);
    if (undoStack.current.length > 80) undoStack.current.shift();
    redoStack.current = [];
    lastPushed.current = snapshot;
    setHistVersion(v => v + 1);
  }, []);

  const canUndo = undoStack.current.length > 0;
  const canRedo = redoStack.current.length > 0;

  const handleUndo = useCallback(() => {
    const prev = undoStack.current.pop();
    if (!prev) return;
    const cur = lastPushed.current && undoStack.current.length === 0 ? null : null; // (giữ lastPushed cho redo)
    void cur;
    redoStack.current.push(lastPushed.current ?? prev);
    lastPushed.current = prev;
    onChangeBlocks(prev);
    setHistVersion(v => v + 1);
  }, [onChangeBlocks]);

  const handleRedo = useCallback(() => {
    const next = redoStack.current.pop();
    if (!next) return;
    undoStack.current.push(lastPushed.current ?? next);
    lastPushed.current = next;
    onChangeBlocks(next);
    setHistVersion(v => v + 1);
  }, [onChangeBlocks]);

  /* ---------------- Auto-layout: sắp xếp blocks theo hàng ngang ---------------
     Mỗi chuỗi (root → nextBlockId → ...) xếp 1 hàng ngang; các khối giá trị
     cắm trong ô nhập được kéo theo chủ; nhiều chuỗi xếp thành lưới xuống dưới. */
  const handleCleanUpLayout = useCallback(() => {
    if (blocks.length === 0) return;
    pushHistory(blocks);
    const COL_W = 210;   // khoảng cách ngang giữa 2 khối nối tiếp
    const ROW_H = 132;   // khoảng cách dọc giữa 2 chuỗi
    const START_X = 60, START_Y = 40;
    // roots theo thứ tự y hiện tại (ổn định khi undo/redo lại layout)
    const referenced = new Set<string>();
    for (const b of blocks) {
      if (b.nextBlockId) referenced.add(b.nextBlockId);
      for (const h of Object.values(b.childBlocks || {})) referenced.add(h);
      for (const v of Object.values(b.inputConnections || {})) referenced.add(v);
    }
    const rootList = blocks.filter(b => !referenced.has(b.id))
      .sort((a, b) => (a.y - b.y) || (a.x - b.x) || a.id.localeCompare(b.id));
    const nextPos = new Map<string, { x: number; y: number }>();
    rootList.forEach((root, ri) => {
      let cx = START_X, cy = START_Y + ri * ROW_H;
      let cur: BlockInstance | undefined = root;
      let guard = 0;
      while (cur && guard++ < 400) {
        nextPos.set(cur.id, { x: cx, y: cy });
        // khối giá trị cắm trong root → xếp bên phải khối chủ
        for (const v of Object.values(cur.inputConnections || {})) {
          const prov = blocks.find(b => b.id === v);
          if (prov && !nextPos.has(prov.id)) nextPos.set(prov.id, { x: cx + 165, y: cy + 6 });
        }
        // thân lệnh trong hốc C → thụt xuống dưới
        for (const h of Object.values(cur.childBlocks || {})) {
          let body: BlockInstance | undefined = blocks.find(b => b.id === h);
          let bx = cx + 28, by = cy + 46, bg = 0;
          while (body && bg++ < 200) {
            nextPos.set(body.id, { x: bx, y: by });
            for (const v of Object.values(body.inputConnections || {})) {
              const prov = blocks.find(b => b.id === v);
              if (prov && !nextPos.has(prov.id)) nextPos.set(prov.id, { x: bx + 165, y: by + 6 });
            }
            body = body.nextBlockId ? blocks.find(b => b.id === body!.nextBlockId) : undefined;
            by += 46;
          }
        }
        cur = cur.nextBlockId ? blocks.find(b => b.id === cur!.nextBlockId) : undefined;
        cx += COL_W;
      }
    });
    const moved = blocks.map(b => {
      const p = nextPos.get(b.id);
      return p ? { ...b, x: p.x, y: p.y } : b;
    });
    onChangeBlocks(moved);
    setView({ x: 40, y: 24, k: 1 });
  }, [blocks, onChangeBlocks, pushHistory]);

  // Phím tắt Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y (không chặn khi đang gõ input)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tgt = e.target as HTMLElement;
      if (tgt && (tgt.tagName === 'INPUT' || tgt.tagName === 'TEXTAREA' || tgt.isContentEditable)) return;
      if ((e.ctrlKey || e.metaKey) && !e.altKey) {
        const k = e.key.toLowerCase();
        if (k === 'z' && !e.shiftKey) { e.preventDefault(); handleUndo(); }
        else if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); handleRedo(); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleUndo, handleRedo]);
  // reset lịch sử khi đổi màn hình/dự án (blocks rỗng đột biến do switch screen)
  useEffect(() => {
    if (blocks.length === 0) {
      undoStack.current = [];
      redoStack.current = [];
      lastPushed.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeScreen]);

  /* ---------------- mutation helpers ---------------- */
  const updateBlocks = useCallback((mutate: (bs: BlockInstance[]) => BlockInstance[]) => {
    pushHistory(blocks);
    onChangeBlocks(mutate(blocks));
  }, [blocks, onChangeBlocks, pushHistory]);

  const handleUpdateField = useCallback((blockId: string, fieldName: string, value: any) => {
    updateBlocks(bs => bs.map(b => b.id === blockId ? { ...b, fields: { ...b.fields, [fieldName]: value } } : b));
  }, [updateBlocks]);

  const detachInput = useCallback((blockId: string, inputName: string) => {
    updateBlocks(bs => bs.map(b => {
      if (b.id !== blockId || !b.inputConnections?.[inputName]) return b;
      const ic = { ...b.inputConnections };
      delete ic[inputName];
      return { ...b, inputConnections: ic };
    }));
  }, [updateBlocks]);

  const detachBody = useCallback((blockId: string, slot: string) => {
    updateBlocks(bs => bs.map(b => {
      if (b.id !== blockId || !b.childBlocks?.[slot]) return b;
      const cb = { ...b.childBlocks };
      delete cb[slot];
      return { ...b, childBlocks: cb };
    }));
  }, [updateBlocks]);

  const appendStatement = useCallback((containerId: string, slot: string, defId: string) => {
    const def = findDef(defId);
    const container = byId.get(containerId);
    if (!def?.statement || !container || isEventDef(def)) return;
    const nb = makeBlock(def, container.x + 30, container.y + 40);
    updateBlocks(bs => {
      const head = (container.childBlocks || {})[slot];
      if (!head) return bs.map(b => b.id === containerId
        ? { ...b, childBlocks: { ...(b.childBlocks || {}), [slot]: nb.id } }
        : b).concat(nb);
      const tail = nextChainIds(bs, head).slice(-1)[0];
      return bs.map(b => b.id === tail ? { ...b, nextBlockId: nb.id } : b).concat(nb);
    });
  }, [byId, updateBlocks]);

  /** Xóa 1 khối nhưng NỐI TIẾP mạch — cha trỏ sang khối kế tiếp; body/socket con tự bung */
  const deleteBlockSplice = useCallback((blockId: string) => {
    const victim = byId.get(blockId);
    if (!victim) return;
    updateBlocks(bs => {
      const vnext = victim.nextBlockId;
      return bs
        .map(b => {
          if (b.nextBlockId === blockId) return { ...b, nextBlockId: vnext };
          if (b.childBlocks) {
            const hit = Object.entries(b.childBlocks).find(([, v]) => v === blockId);
            if (hit) {
              const cb = { ...b.childBlocks };
              if (vnext) cb[hit[0]] = vnext; else delete cb[hit[0]];
              return { ...b, childBlocks: cb };
            }
          }
          if (b.inputConnections) {
            const hit = Object.entries(b.inputConnections).find(([, v]) => v === blockId);
            if (hit) {
              const ic = { ...b.inputConnections };
              delete ic[hit[0]];
              return { ...b, inputConnections: ic };
            }
          }
          return b;
        })
        .filter(b => b.id !== blockId);
    });
  }, [byId, updateBlocks]);

  /* ================================================================== *
   *  CONTEXT MENU KIỂU KODULAR — chuột phải trên khối                  *
   *  (Duplicate / Comment / Collapse / Disable / Backpack / Delete /   *
   *   Make Generic / Download PNG / Help)                              *
   * ================================================================== */
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; blockId: string } | null>(null);
  /** Menu chuột phải NỀN CANVAS: Undo / Redo / Clean up blocks / Help */
  const [canvasMenu, setCanvasMenu] = useState<{ x: number; y: number } | null>(null);
  /** Modal đối chiếu mã Lua của khối đang chuột phải */
  const [luaCompare, setLuaCompare] = useState<{ blockId: string } | null>(null);
  /** Backpack kiểu AI2: khối đã lưu trong localStorage, nút mở lại để thả vào bảng */
  const [backpackCount, setBackpackCount] = useState<number>(() => {
    try { return (JSON.parse(localStorage.getItem('vxp_block_backpack') || '[]') as any[]).length; }
    catch { return 0; }
  });

  const patchBlock = useCallback((blockId: string, patch: Partial<BlockInstance>) => {
    updateBlocks(bs => bs.map(b => b.id === blockId ? { ...b, ...patch } : b));
  }, [updateBlocks]);

  const openContextMenu = useCallback((e: React.MouseEvent, blockId: string) => {
    e.preventDefault();
    e.stopPropagation();
    // vị trí menu theo viewport
    setCtxMenu({ x: e.clientX, y: e.clientY, blockId });
  }, []);

  // Đóng menu khi click chỗ khác / scroll
  useEffect(() => {
    if (!ctxMenu) return;
    const close = () => setCtxMenu(null);
    window.addEventListener('click', close);
    window.addEventListener('wheel', close, { passive: true });
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('wheel', close);
    };
  }, [ctxMenu]);

  useEffect(() => {
    if (!canvasMenu) return;
    const close = () => setCanvasMenu(null);
    window.addEventListener('click', close);
    window.addEventListener('wheel', close, { passive: true });
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('wheel', close);
    };
  }, [canvasMenu, histVersion]);

  /** Sao chép SÂU subtree khối (trả block mới với id mới, remap mọi liên kết nội bộ) */
  const cloneSubtree = useCallback((headId: string): BlockInstance[] => {
    const subIds = Array.from(subtreeIds(blocks, headId));
    const idMap = new Map<string, string>();
    const stamp = Date.now();
    subIds.forEach((oid, i) => idMap.set(oid, `blk_${stamp}_${i}_${Math.floor(Math.random() * 900 + 100)}`));
    return subIds
      .map(oid => blocks.find(b => b.id === oid))
      .filter(Boolean)
      .map((b, i) => {
        const nb: BlockInstance = { ...b!, id: idMap.get(b!.id)! };
        if (nb.nextBlockId) nb.nextBlockId = idMap.get(nb.nextBlockId) ?? undefined;
        if (nb.childBlocks) nb.childBlocks = Object.fromEntries(Object.entries(nb.childBlocks).map(([k, v]) => [k, idMap.get(v) ?? v]));
        if (nb.inputConnections) nb.inputConnections = Object.fromEntries(Object.entries(nb.inputConnections).map(([k, v]) => [k, idMap.get(v) ?? v]));
        // bỏ trạng thái comment reference (giữ comment vẫn thiết thực — giữ nguyên)
        return nb;
      });
  }, [blocks]);

  /** Mục Duplicate: nhân bản subtree, thả thành chuỗi tự do cạnh khối gốc */
  const handleDuplicate = useCallback((blockId: string) => {
    const src = byId.get(blockId);
    if (!src) return;
    const clones = cloneSubtree(blockId);
    if (!clones.length) return;
    // đặt cạnh phải-dưới khối gốc
    updateBlocks(bs => bs.concat(clones.map(c => ({ ...c, x: src.x + 44, y: src.y + 34 }))));
    setCtxMenu(null);
  }, [byId, cloneSubtree, updateBlocks]);

  /** Lưu subtree vào backpack (localStorage) — kéo ra sau bằng nút Backpack */
  const handleSaveToBackpack = useCallback((blockId: string) => {
    const clones = cloneSubtree(blockId);
    if (!clones.length) return;
    try {
      const cur = JSON.parse(localStorage.getItem('vxp_block_backpack') || '[]') as BlockInstance[];
      const next = [...cur, ...clones];
      // giới hạn 60 khối để không phình localStorage
      localStorage.setItem('vxp_block_backpack', JSON.stringify(next.slice(-60)));
      setBackpackCount(next.length);
    } catch { /* ignore */ }
    setCtxMenu(null);
  }, [cloneSubtree]);

  /** Đổ khối cuối trong backpack ra bảng */
  const handlePopBackpack = useCallback(() => {
    try {
      const cur = JSON.parse(localStorage.getItem('vxp_block_backpack') || '[]') as BlockInstance[];
      if (!cur.length) return;
      // tìm các khối root trong backpack (không bị khối khác trong backpack trỏ tới)
      const refd = new Set<string>();
      for (const b of cur) {
        if (b.nextBlockId) refd.add(b.nextBlockId);
        for (const v of Object.values(b.childBlocks || {})) refd.add(v);
        for (const v of Object.values(b.inputConnections || {})) refd.add(v);
      }
      const roots = cur.filter(b => !refd.has(b.id));
      if (!roots.length) return;
      const root = roots[roots.length - 1];
      const sub = new Set(Array.from(subtreeIds(cur, root.id)));
      const picked = cur.filter(b => sub.has(b.id));
      const rest = cur.filter(b => !sub.has(b.id));
      localStorage.setItem('vxp_block_backpack', JSON.stringify(rest));
      setBackpackCount(rest.length);
      // stamp id mới để không trùng
      const stamp = Date.now();
      const idMap = new Map<string, string>();
      picked.forEach((b, i) => idMap.set(b.id, `blk_${stamp}_${i}_${Math.floor(Math.random() * 900 + 100)}`));
      const fresh = picked.map(b => {
        const nb = { ...b, id: idMap.get(b.id)! };
        if (nb.nextBlockId) nb.nextBlockId = idMap.get(nb.nextBlockId) ?? undefined;
        if (nb.childBlocks) nb.childBlocks = Object.fromEntries(Object.entries(nb.childBlocks).map(([k, v]) => [k, idMap.get(v) ?? v]));
        if (nb.inputConnections) nb.inputConnections = Object.fromEntries(Object.entries(nb.inputConnections).map(([k, v]) => [k, idMap.get(v) ?? v]));
        return nb;
      });
      const n = blocks.length;
      updateBlocks(bs => [...bs, ...fresh.map((b, i) => ({ ...b, x: 60 + (n % 6) * 40 + i * 8, y: 60 + Math.floor((n % 24) / 6) * 80 }))]);
    } catch { /* ignore */ }
  }, [blocks, onChangeBlocks]);

  /** Xóa TOÀN BỘ subtree khối (Delete Block) — bung khối ra trước khi xóa để không mồ côi */
  const handleDeleteSubtree = useCallback((blockId: string) => {
    const dead = subtreeIds(blocks, blockId);
    updateBlocks(bs => unlinkRef(bs, blockId).filter(b => !dead.has(b.id)));
    setCtxMenu(null);
  }, [blocks, updateBlocks]);

  /** Comment — modal TÙY CHỈNH nhập / sửa / xóa ghi chú */
  const handleComment = useCallback(async (blockId: string) => {
    const blk = byId.get(blockId);
    if (!blk) return;
    const cur = blk.comment || '';
    const v = await promptDialog({
      title: cur ? t('bw.editComment') : t('bw.addComment'),
      label: t('bw.commentHint'),
      initial: cur,
      placeholder: t('bw.commentPh'),
    });
    if (v === null) return; // hủy
    patchBlock(blockId, { comment: v.trim() ? v.trim() : undefined });
    setCtxMenu(null);
  }, [byId, patchBlock, promptDialog, t]);

  /** Download blocks as PNG — vẽ cây khối ra canvas rồi tải về */
  const handleDownloadPng = useCallback((blockId: string) => {
    const el = document.querySelector(`[data-block="${blockId}"]`) as HTMLElement | null;
    const studio = workspaceRef.current;
    if (!el || !studio) return;
    const er = el.getBoundingClientRect();
    const sr = studio.getBoundingClientRect();
    // Vẽ lại bằng canvas 2D: nền + sao chép DOM khó — dùng cách chép ảnh qua SVG foreignObject
    const W = Math.ceil(er.width) + 32, H = Math.ceil(er.height) + 32;
    const clone = el.cloneNode(true) as HTMLElement;
    // xóa nút tương tác để ảnh sạch
    clone.querySelectorAll('button').forEach(b => b.remove());
    const wrap = document.createElement('div');
    wrap.style.cssText = `position:absolute;left:0;top:0;width:${er.width}px;background:#EFEAF6;padding:16px;`;
    wrap.appendChild(clone);
    const html = `<div xmlns="http://www.w3.org/1999/xhtml" style="background:#EFEAF6;padding:16px;font-family:sans-serif;">${wrap.innerHTML}</div>`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><foreignObject width="100%" height="100%">${html}</foreignObject></svg>`;
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const cv = document.createElement('canvas');
      cv.width = W * 2; cv.height = H * 2;
      const c2 = cv.getContext('2d');
      if (c2) {
        c2.scale(2, 2);
        c2.fillStyle = '#EFEAF6';
        c2.fillRect(0, 0, W, H);
        c2.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);
        const a = document.createElement('a');
        const blk = byId.get(blockId);
        a.download = `block_${blk?.defId || 'vxp'}_${Date.now()}.png`;
        a.href = cv.toDataURL('image/png');
        a.click();
      }
    };
    img.onerror = () => URL.revokeObjectURL(url);
    img.src = url;
    setCtxMenu(null);
  }, [byId]);

  const ctxBlock = ctxMenu ? byId.get(ctxMenu.blockId) : undefined;
  const ctxDef = ctxBlock ? defOf(ctxBlock) : undefined;

  const addByClick = useCallback((def: BlockDef, prefill?: Record<string, string>) => {
    const n = roots.length;
    const nb = makeBlock(def, 60 + (n % 6) * 40, 60 + Math.floor((n % 24) / 6) * 80, prefill);
    updateBlocks(bs => [...bs, nb]);
  }, [blocks, onChangeBlocks, roots.length]);

  const clearAll = () => {
    if (confirm('Bạn có chắc muốn xóa toàn bộ khối lệnh trên bảng?')) onChangeBlocks([]);
  };

  /* ---------------- Thanh màn hình kiểu Kodular ---------------- */
  const currentScreen = activeScreen ?? screens[0] ?? 'Screen1';

  const handleAddScreen = async () => {
    const raw = await promptDialog({
      title: t('bw.newScreenTitle'),
      label: t('bw.newScreenLabel'),
      initial: `Screen${screens.length + 1}`,
    });
    const name = raw?.trim().replace(/\s+/g, '');
    if (name) onAddScreen?.(name);
  };

  const handleDeleteScreen = async () => {
    if (screens.length <= 1) return;
    const ok = await confirmDialog({
      title: t('bw.delScreen'),
      message: t('bw.delScreenConfirm').replace('{name}', currentScreen),
      danger: true,
    });
    if (ok) onDeleteScreen?.(currentScreen);
  };

  /* ---------------- drag & drop (kiểu App Inventor — pointer, không HTML5 DnD) ---------------- */
  /** Vùng [data-zone] chấp nhận payload nào */
  const acceptsZone = useCallback((p: DragPayload, zoneEl: HTMLElement, hoverEl: HTMLElement) => {
    const action = zoneEl.dataset.action;
    switch (action) {
      case 'canvas':
        // Chỉ thả khi không trỏ vào khối/chuỗi khác
        return !hoverEl.closest('[data-block],[data-stack]');
      case 'trash':
        return true;
      case 'before':
      case 'append':
      case 'intobody':
        return p.kind === 'statement' || (p.kind === 'palette' && !p.isValue);
      case 'socket':
        return p.kind === 'value' || (p.kind === 'palette' && !!p.isValue);
      default:
        return false;
    }
  }, []);

  const stmtPointerDown = useCallback((e: React.PointerEvent, block: BlockInstance) => {
    const def = defOf(block);
    if (!def) return;
    const tail = nextChainIds(blocks, block.id);
    pd.startDrag(e, { kind: 'statement', headId: block.id, tailIds: new Set(tail) }, shortLabel(def), def.color);
  }, [blocks, pd]);

  const valPointerDown = useCallback((e: React.PointerEvent, block: BlockInstance) => {
    const def = defOf(block);
    if (!def) return;
    pd.startDrag(e, { kind: 'value', headId: block.id }, shortLabel(def), def.color);
  }, [pd]);

  const isPaletteStatement = (p: DragPayload): p is DragPayload & { kind: 'palette'; isValue: false } =>
    p.kind === 'palette' && !p.isValue;

  /** Drop STATEMENT: chen TRƯỚC targetId (target trở thành lệnh kế tiếp của đuôi) */
  const dropStatementBeforeAt = useCallback((p: DragPayload, targetId: string) => {
    if (p.kind === 'value') return;
    if (isPaletteStatement(p)) {
      const def = findDef(p.defId);
      if (!def?.statement || isEventDef(def)) return;
      updateBlocks(bs => {
        const ref = findRef(bs, targetId);
        if (!ref) return bs;
        const nb = makeBlock(def, 0, 0, p.prefill);
        const arr = [...bs, nb];
        const tailId = nextChainIds(arr, nb.id).slice(-1)[0];
        return arr.map(b => {
          let out = b;
          if (ref.kind === 'next' && b.id === ref.from) out = { ...out, nextBlockId: nb.id };
          else if (ref.kind === 'body' && b.id === ref.from) out = { ...out, childBlocks: { ...(out.childBlocks || {}), [ref.slot]: nb.id } };
          if (b.id === tailId) out = { ...out, nextBlockId: targetId };
          return out;
        });
      });
    } else if (p.kind === 'statement') {
      if (p.tailIds.has(targetId) || p.headId === targetId) return;
      if (!byId.get(p.headId)) return;
      updateBlocks(bs => {
        const ref = findRef(bs, targetId);
        if (!ref) return bs;
        const arr = unlinkRef(bs, p.headId);
        const tailId = nextChainIds(arr, p.headId).slice(-1)[0];
        return arr.map(b => {
          let out = b;
          if (ref.kind === 'next' && b.id === ref.from) out = { ...out, nextBlockId: p.headId };
          else if (ref.kind === 'body' && b.id === ref.from) out = { ...out, childBlocks: { ...(out.childBlocks || {}), [ref.slot]: p.headId } };
          if (b.id === tailId) out = { ...out, nextBlockId: targetId };
          return out;
        });
      });
    }
  }, [byId, updateBlocks]);

  /** Drop STATEMENT: nối dưới khối anchor (cuối chuỗi) */
  const dropStatementAppendAt = useCallback((p: DragPayload, anchorId: string) => {
    if (p.kind === 'value') return;
    const anchor = byId.get(anchorId);
    if (!anchor) return;
    if (isPaletteStatement(p)) {
      const def = findDef(p.defId);
      if (!def?.statement || isEventDef(def)) return;
      updateBlocks(bs => {
        const nb = makeBlock(def, anchor.x + 20, anchor.y + 40, p.prefill);
        return [...bs, nb].map(b => (b.id === anchorId ? { ...b, nextBlockId: nb.id } : b));
      });
    } else if (p.kind === 'statement') {
      if (p.tailIds.has(anchorId) || p.headId === anchorId) return;
      if (!byId.get(p.headId)) return;
      updateBlocks(bs => {
        const arr = unlinkRef(bs, p.headId);
        return arr.map(b => (b.id === anchorId ? { ...b, nextBlockId: p.headId } : b));
      });
    }
  }, [byId, updateBlocks]);

  /** Drop STATEMENT vào HỐC THÂN LỆNH trống */
  const dropStatementIntoBodyAt = useCallback((p: DragPayload, containerId: string, slot: string) => {
    if (p.kind === 'value') return;
    const container = byId.get(containerId);
    if (!container || (container.childBlocks || {})[slot]) return;
    if (isPaletteStatement(p)) {
      const def = findDef(p.defId);
      if (!def?.statement || isEventDef(def)) return;
      updateBlocks(bs => {
        const nb = makeBlock(def, container.x + 30, container.y + 50, p.prefill);
        return [...bs, nb].map(b => (b.id === containerId
          ? { ...b, childBlocks: { ...(b.childBlocks || {}), [slot]: nb.id } }
          : b));
      });
    } else if (p.kind === 'statement') {
      if (subtreeIds(blocks, p.headId).has(containerId)) return;
      updateBlocks(bs => {
        const arr = unlinkRef(bs, p.headId);
        return arr.map(b => (b.id === containerId
          ? { ...b, childBlocks: { ...(b.childBlocks || {}), [slot]: p.headId } }
          : b));
      });
    }
  }, [byId, blocks, updateBlocks]);

  /** Drop VALUE vào socket input */
  const dropValueIntoAt = useCallback((p: DragPayload, consumerId: string, inputName: string) => {
    if (p.kind === 'statement') return;
    const consumer = byId.get(consumerId);
    if (!consumer) return;
    const input = defOf(consumer)?.inputs?.find(i => i.name === inputName && i.socket);
    if (!input) return;
    const typeOk = (outType?: string) => !!outType && (outType === 'any' || input.type === 'any' || input.type === outType);
    const apply = (def: BlockDef) => {
      if (!typeOk(def.outputType)) return;
      const prefill = p.kind === 'palette' ? p.prefill : undefined;
      updateBlocks(bs => {
        const nb = makeBlock(def, consumer.x + 30, consumer.y + 60, prefill);
        return [...bs, nb].map(b => (b.id === consumerId
          ? { ...b, inputConnections: { ...(b.inputConnections || {}), [inputName]: nb.id } }
          : b));
      });
    };
    if (p.kind === 'palette') {
      if (!p.isValue) return;
      const def = findDef(p.defId);
      if (def) apply(def);
    } else {
      if (subtreeIds(blocks, p.headId).has(consumerId)) return; // chống vòng lặp
      if (!byId.get(p.headId)) return;
      updateBlocks(bs => {
        const arr = unlinkRef(bs, p.headId);
        return arr.map(b => (b.id === consumerId
          ? { ...b, inputConnections: { ...(b.inputConnections || {}), [inputName]: p.headId } }
          : b));
      });
    }
  }, [byId, blocks, updateBlocks]);

  /** Drop lên nền trống: tạo khối mới / đặt lại vị trí chuỗi */
  const dropOnCanvasAt = useCallback((p: DragPayload, pt: { x: number; y: number }) => {
    const el = workspaceRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const wx = Math.round((pt.x - rect.left - view.x) / view.k);
    const wy = Math.round((pt.y - rect.top - view.y) / view.k);
    if (p.kind === 'palette') {
      const def = findDef(p.defId);
      if (def) updateBlocks(bs => [...bs, makeBlock(def, wx, wy, p.prefill)]);
      return;
    }
    const head = byId.get(p.headId);
    if (!head) return;
    updateBlocks(bs => unlinkRef(bs, p.headId).map(b => (b.id === p.headId ? { ...b, x: wx, y: wy } : b)));
  }, [byId, blocks, view, onChangeBlocks, updateBlocks]);

  /** Drop vào THÙNG RÁC: xóa cả chuỗi */
  const dropToTrashAt = useCallback((p: DragPayload) => {
    if (p.kind !== 'palette') {
      const dead = subtreeIds(blocks, p.headId);
      updateBlocks(bs => unlinkRef(bs, p.headId).filter(b => !dead.has(b.id)));
    }
  }, [blocks, updateBlocks]);

  /** Phân phối thả theo data-action trên vùng [data-zone] */
  const handleZoneDrop = useCallback((p: DragPayload, zoneEl: HTMLElement, pt: { x: number; y: number }) => {
    const action = zoneEl.dataset.action;
    if (action === 'canvas') dropOnCanvasAt(p, pt);
    else if (action === 'trash') dropToTrashAt(p);
    else if (action === 'before') dropStatementBeforeAt(p, zoneEl.dataset.target ?? '');
    else if (action === 'append') dropStatementAppendAt(p, zoneEl.dataset.target ?? '');
    else if (action === 'intobody') dropStatementIntoBodyAt(p, zoneEl.dataset.container ?? '', zoneEl.dataset.slot ?? '');
    else if (action === 'socket') dropValueIntoAt(p, zoneEl.dataset.consumer ?? '', zoneEl.dataset.input ?? '');
  }, [dropOnCanvasAt, dropToTrashAt, dropStatementBeforeAt, dropStatementAppendAt, dropStatementIntoBodyAt, dropValueIntoAt]);

  acceptsRef.current = acceptsZone;
  dropRef.current = handleZoneDrop;

  /* ---------------- palette list ---------------- */
  /** Đang tìm kiếm → hiện danh sách kết quả phẳng thay cho cây accordion */
  const isSearching = searchQuery.trim().length > 0;
  const paletteList = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return [] as BlockDef[];
    return allDefs.filter(d => d.label.toLowerCase().includes(query) || d.category.includes(query));
  }, [searchQuery, allDefs]);

  /* ---------------- danh sách thành phần (thư viện con kiểu AI2) ---------------- */
  const sortedComps = useMemo(() => sortComponents(components), [components]);
  const filteredComps = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return sortedComps;
    return sortedComps.filter(c => c.name.toLowerCase().includes(q) || componentTypeLabel(c.type).toLowerCase().includes(q));
  }, [sortedComps, searchQuery]);

  /* --------- Thủ tục đã định nghĩa trên bảng: hiện khối "gọi thủ tục" --------- */
  const definedProcs = useMemo(() => {
    const out: string[] = [];
    const seen = new Set<string>();
    for (const b of blocks) {
      if (b.defId !== 'proc_def') continue;
      const nm = String(b.fields.name || '').trim();
      if (nm && !seen.has(nm)) {
        seen.add(nm);
        out.push(nm);
      }
    }
    return out;
  }, [blocks]);

  /* ---------------- context cho các khối ---------------- */
  const ctx: WsCtx = {
    blocks, components, byId, drag, hoverZone,
    stmtPointerDown, valPointerDown,
    updateField: handleUpdateField, deleteSplice: deleteBlockSplice,
    detachInput, detachBody, appendStatement,
    brokenRefs: brokenRefFields, innerStmtDefs,
    openContextMenu, patchBlock
  };

  /* ---------------- render ---------------- */
  return (
    <div className="flex-1 flex overflow-hidden bg-[#EFEAF6] text-[#221E2B]" onClickCapture={pd.suppressClick}>
      {/* Palette */}
      <aside className="w-72 bg-[#F7F3FC] border-r border-[#E4DEF1] flex flex-col overflow-hidden shrink-0 select-none">
        <div className="p-3 pb-2 border-b border-[#E4DEF1] bg-[#F7F3FC] shrink-0">
          <h2 className="text-xs font-bold text-[#6F687E] uppercase tracking-wider mb-2 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Boxes className="w-4 h-4 text-[#6750A4]" />
              <span>{t('bw.paletteTitle')}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="text-[9px] text-[#494256] bg-[#EFEAF6] border border-[#E4DEF1] px-1.5 py-0.5 rounded-full font-mono font-normal">
                {allDefs.length} khối
              </span>
              <button
                onClick={() => setIsExtModalOpen(true)}
                className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                  extensions.length > 0
                    ? 'bg-[#7C3AED]/10 text-[#6D28D9] border-[#7C3AED]/40 hover:bg-[#7C3AED]/20'
                    : 'bg-[#EFEAF6] text-[#494256] border-[#E4DEF1] hover:text-[#221E2B] hover:border-[#7C3AED]'
                }`}
                title={t('bw.extManager')}
                aria-label={t('bw.extManager')}
              >
                <Package className="w-3.5 h-3.5" />
              </button>
            </span>
          </h2>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#6F687E] pointer-events-none" />
            <input
              type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('bw.searchBlocks')}
              className="w-full bg-[#EFEAF6] border border-[#CBC3DD] text-xs text-[#221E2B] rounded-lg pl-8 pr-7 py-1.5 outline-none focus:border-[#7C3AED] placeholder:text-[#A79EBD]"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#6F687E] hover:text-[#221E2B] cursor-pointer" title="Xóa tìm kiếm">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0">
          {isSearching ? (
            <div className="p-2 space-y-1">
              {paletteList.length === 0 ? (
                <div className="text-center py-8 px-3 text-[11px] text-[#6F687E]">
                  <Search className="w-6 h-6 mx-auto mb-2 text-[#C7BFD9]" />
                  Không tìm thấy khối nào phù hợp.
                </div>
              ) : paletteList.map(def => (
                <div
                  key={def.id}
                  onPointerDown={(e) => pd.startDrag(e, { kind: 'palette', defId: def.id, isValue: !!def.outputType }, shortLabel(def), def.color)}
                  onClick={() => addByClick(def)}
                  title={BLOCK_T ? `${BLOCK_T('bw.dragOrClick')} "${blkLabel(def)}"` : `Kéo "${def.label}"`}
                  className="cursor-grab active:cursor-grabbing select-none"
                >
                  <PaletteChip def={def} />
                </div>
              ))}
            </div>
          ) : (
            <>
              {/* ---- Khối có sẵn: thanh màu theo danh mục ---- */}
              <div className="px-3 py-1 text-[9px] font-bold uppercase tracking-wider text-[#6F687E] bg-[#EFEAF6] border-y border-[#E4DEF1]">
                Khối có sẵn
              </div>
              {CATEGORY_TABS.map(cat => {
                const defs = allDefs.filter(d => d.category === cat.id);
                const key = `cat_${cat.id}`;
                const isOpen = expandedKey === key;
                return (
                  <div key={cat.id} className="border-b border-[#E4DEF1]">
                    <button
                      onClick={() => setExpandedKey(isOpen ? null : key)}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-left transition-opacity hover:opacity-90 cursor-pointer"
                      style={{ backgroundColor: cat.color }}
                      title={`${t(cat.nameKey, cat.name)} — ${defs.length}`}
                    >
                      <span
                        className="text-[11px] font-bold text-white truncate"
                        style={{ textShadow: '0 1px 1px rgba(0,0,0,0.25)' }}
                      >
                        {t(cat.nameKey, cat.name)}
                      </span>
                      <span className="ml-auto flex items-center gap-1 shrink-0">
                        <span className="text-[9px] font-mono text-white/80">{defs.length}</span>
                        <span className={`text-white/85 transition-transform ${isOpen ? 'rotate-90' : ''}`}>›</span>
                      </span>
                    </button>
                    {isOpen && (
                      <div className="border-t border-[#E4DEF1] px-2 py-1.5 space-y-1 bg-white/45">
                        {defs.length === 0 ? (
                          cat.id === 'extensions' ? (
                            <div className="text-center py-4 px-3 text-[11px] text-[#6F687E]">
                              <Package className="w-5 h-5 mx-auto mb-2 text-[#C7BFD9]" />
                              Chưa cài tiện ích .mvxp nào.
                              <button
                                onClick={() => setIsExtModalOpen(true)}
                                className="block mx-auto mt-2 px-3 py-1.5 rounded-lg bg-[#7C3AED] text-white text-[11px] font-bold hover:bg-[#6D28D9] transition-colors cursor-pointer"
                              >
                                Thêm tiện ích (Lua + manifest)
                              </button>
                            </div>
                          ) : (
                            <p className="text-[10px] text-[#A79EBD] px-1 py-1">{t('bw.noBlocks')}</p>
                          )
                        ) : defs.map(def => (
                          <div
                            key={def.id}
                            onPointerDown={(e) => pd.startDrag(e, { kind: 'palette', defId: def.id, isValue: !!def.outputType }, shortLabel(def), def.color)}
                            onClick={() => addByClick(def)}
                            title={BLOCK_T ? `${BLOCK_T('bw.dragOrClick')} "${blkLabel(def)}"` : `Kéo "${def.label}"`}
                            className="cursor-grab active:cursor-grabbing select-none"
                          >
                            <PaletteChip def={def} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* ---- Components: Kodular-style accordion ---- */}
              {filteredComps.length > 0 && (
                <>
                  <div className="px-3 py-1 text-[9px] font-bold uppercase tracking-wider text-[#6F687E] bg-[#EFEAF6] border-y border-[#E4DEF1]">
                    Components
                  </div>

                  {/* Screen1 */}
                  {(() => {
                    const screenComp = { id: 'screen_' + currentScreen, name: currentScreen, type: 'Screen', properties: {}, x: 0, y: 0, width: 240, height: 320 } as any;
                    const screenEntries = componentDrawerEntries(screenComp);
                    const key = 'comp_screen_' + currentScreen;
                    const isOpen = expandedKey === key;
                    return (
                      <div className="border-b border-[#E4DEF1]">
                        <button
                          onClick={() => setExpandedKey(isOpen ? null : key)}
                          className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors cursor-pointer ${isOpen ? 'bg-[#6750A4]/10' : 'hover:bg-[#F3EEFA]'}`}
                        >
                          <span className={`w-2 h-2 rounded-full shrink-0 ${isOpen ? 'bg-[#6750A4]' : 'bg-[#A79EBD]'}`} />
                          <span className="text-[11px] font-bold text-[#221E2B] truncate flex-1">{currentScreen}</span>
                          {screenEntries.length > 0 && (
                            <span className={`text-[#6F687E] text-[10px] transition-transform ${isOpen ? 'rotate-90' : ''}`}>›</span>
                          )}
                        </button>
                        {isOpen && (
                          <div className="pl-6 pr-2 py-1 space-y-1 bg-white/30">
                            {screenEntries.length === 0 ? (
                              <p className="text-[9px] text-[#A79EBD] px-1 py-1">Chưa có khối nào.</p>
                            ) : screenEntries.map(en => {
                              const def = findDef(en.defId);
                              if (!def) return null;
                              return (
                                <CompBlockRow
                                  key={en.defId}
                                  def={def}
                                  phrase={en.phrase}
                                  onPointerDown={(e) => pd.startDrag(e, { kind: 'palette', defId: en.defId, isValue: !!def.outputType, prefill: en.prefill }, en.phrase, def.color)}
                                  onAdd={() => addByClick(def, en.prefill)}
                                />
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Các thành phần khác */}
                  {filteredComps.map(comp => {
                    const entries = componentDrawerEntries(comp);
                    const key = `comp_${comp.id}`;
                    const isOpen = expandedKey === key;
                    const dot = componentTypeColor(comp.type);
                    return (
                      <div key={comp.id} className="border-b border-[#E4DEF1]">
                        <button
                          onClick={() => setExpandedKey(isOpen ? null : key)}
                          className={`w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors cursor-pointer ${isOpen ? 'bg-[#6750A4]/10' : 'hover:bg-[#F3EEFA]'}`}
                        >
                          <span className={`w-2 h-2 rounded-full shrink-0 ${isOpen ? 'bg-[#6750A4]' : ''}`} style={!isOpen ? { backgroundColor: dot } : undefined} />
                          <span className="text-[11px] font-semibold text-[#221E2B] truncate flex-1">{comp.name}</span>
                          <span className="text-[8px] font-mono text-[#A79EBD] shrink-0">{t('ct.' + comp.type, componentTypeLabel(comp.type))}</span>
                          {entries.length > 0 && (
                            <span className={`text-[#6F687E] text-[10px] transition-transform ${isOpen ? 'rotate-90' : ''}`}>›</span>
                          )}
                        </button>
                        {isOpen && (
                          <div className="pl-6 pr-2 py-1 space-y-1 bg-white/30">
                            {entries.length === 0 ? (
                              <p className="text-[9px] text-[#A79EBD] px-1 py-1">{t('bw.noDedicatedBlocks')}</p>
                            ) : entries.map(en => {
                              const def = findDef(en.defId);
                              if (!def) return null;
                              return (
                                <CompBlockRow
                                  key={en.defId}
                                  def={def}
                                  phrase={en.phrase}
                                  onPointerDown={(e) => pd.startDrag(e, { kind: 'palette', defId: en.defId, isValue: !!def.outputType, prefill: en.prefill }, en.phrase, def.color)}
                                  onAdd={() => addByClick(def, en.prefill)}
                                />
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* ---- Thủ tục đã định nghĩa: khối "gọi thủ tục" sẵn tên ---- */}
                  {definedProcs.length > 0 && (
                    <div className="border-b border-[#E4DEF1]">
                      <button
                        onClick={() => setExpandedKey(expandedKey === 'procs' ? null : 'procs')}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors cursor-pointer ${expandedKey === 'procs' ? 'bg-[#C026D3]/10' : 'hover:bg-[#F3EEFA]'}`}
                      >
                        <span className={`w-2 h-2 rounded-full shrink-0 ${expandedKey === 'procs' ? 'bg-[#C026D3]' : 'bg-[#C084FC]'}`} />
                        <span className="text-[11px] font-bold text-[#221E2B] truncate flex-1">{t('bw.definedProcedures')}</span>
                        <span className="text-[8px] font-mono text-[#A79EBD] shrink-0">{definedProcs.length}</span>
                        <span className={`text-[#6F687E] text-[10px] transition-transform ${expandedKey === 'procs' ? 'rotate-90' : ''}`}>›</span>
                      </button>
                      {expandedKey === 'procs' && (
                        <div className="pl-6 pr-2 py-1 space-y-1 bg-white/30">
                          {definedProcs.map(nm => {
                            const def = findDef('proc_call');
                            if (!def) return null;
                            return (
                              <CompBlockRow
                                key={nm}
                                def={def}
                                phrase={`gọi thủ tục ${nm}`}
                                onPointerDown={(e) => pd.startDrag(e, { kind: 'palette', defId: 'proc_call', isValue: false, prefill: { name: nm } }, `gọi thủ tục ${nm}`, def.color)}
                                onAdd={() => addByClick(def, { name: nm })}
                              />
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </aside>

      {/* Canvas */}
      <section className="flex-1 flex flex-col relative overflow-hidden bg-[#EFEAF6] min-w-0">
        {/* Thanh MÀN HÌNH kiểu Kodular: chọn màn hình + Thêm / Sao chép / Xóa */}
        {screens.length > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-[#F3EEFA] border-b border-[#E4DEF1] shrink-0">
            <select
              value={currentScreen}
              onChange={(e) => onSwitchScreen?.(e.target.value)}
              className="bg-white border border-[#CBC3DD] text-[#221E2B] text-xs font-bold rounded px-2 py-1 outline-none cursor-pointer max-w-[170px]"
              title={t('bw.pickScreen')}
            >
              {screens.map(s => <option key={s} value={s}>{s}</option>)}
            </select>

            {entryScreen && (
              <span
                className="text-[9px] font-mono text-[#047857] bg-white border border-[#CBC3DD] rounded px-1.5 py-0.5 whitespace-nowrap"
                title={t('bw.entryScreenHint')}
              >
                ⬤ {t('bw.main')} {entryScreen}
              </span>
            )}

            <span className="flex-1" />

            {/* Màn hình được quản lý ở tab DESIGNER — ở Blocks chỉ CHỌN màn để lập trình.
                Tạo/sao chép/xóa màn hình vui lòng thực hiện ở Designer. */}
            <span
              className="flex items-center gap-1 text-[9px] font-semibold text-[#6F687E] bg-white border border-[#E4DEF1] rounded-full px-2 py-1 whitespace-nowrap"
              title={t('bw.screenManagedInDesigner')}
            >
              <Layers className="w-3 h-3" />
              <span className="hidden sm:inline">{t('bw.screenManagedInDesigner')}</span>
            </span>
          </div>
        )}

        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-2 bg-[#F7F3FC] border-b border-[#E4DEF1] z-10 text-[#221E2B] shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-xs text-[#494256] font-mono whitespace-nowrap">
              {blocks.length} {t('bw.blocksN')} · {roots.length} {t('bw.chainsN')}
            </span>
            {brokenBlockCount > 0 && (
              <span
                className="flex items-center gap-1.5 text-[10px] font-bold text-red-700 bg-red-100 border border-red-300 rounded-full px-2 py-0.5 whitespace-nowrap cursor-help"
                title={t('bw.brokenListHint')}
              >
                <AlertTriangle className="w-3 h-3" />
                {brokenBlockCount} khối trỏ tới thành phần đã xóa/đổi tên
              </span>
            )}
            <span className="hidden xl:flex items-center gap-1 text-[10px] text-[#6F687E] border border-[#E4DEF1] rounded-full px-2 py-0.5 bg-[#F3EEFA] whitespace-nowrap">
              <Hand className="w-3 h-3 text-[#6750A4]" />
              Kéo chuột trái nền trống để cuộn · Chuột phải khối để mở menu
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={() => setView(v => ({ ...v, k: Math.max(0.3, +(v.k - 0.15).toFixed(2)) }))}
              className="p-1.5 bg-[#F3EEFA] hover:bg-[#E4DEF1] text-[#221E2B] rounded border border-[#CBC3DD] cursor-pointer" title={t('bw.zoomOut')}>
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-xs font-mono text-[#494256] w-12 text-center">{Math.round(view.k * 100)}%</span>
            <button onClick={() => setView(v => ({ ...v, k: Math.min(2, +(v.k + 0.15).toFixed(2)) }))}
              className="p-1.5 bg-[#F3EEFA] hover:bg-[#E4DEF1] text-[#221E2B] rounded border border-[#CBC3DD] cursor-pointer" title={t('bw.zoomIn')}>
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => setView({ x: 40, y: 24, k: 1 })}
              className="p-1.5 bg-[#F3EEFA] hover:bg-[#E4DEF1] text-[#221E2B] rounded border border-[#CBC3DD] cursor-pointer" title={t('bw.resetView')}>
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            {/* Ba lô khối (Backpack) — kiểu Kodular: chuột phải khối → "Lưu vào Ba lô" */}
            <button
              onClick={handlePopBackpack}
              disabled={backpackCount === 0}
              className={`relative flex items-center gap-1 px-2 py-1.5 rounded border transition-colors ${
                backpackCount > 0
                  ? 'bg-[#B45309] hover:bg-[#92400E] text-white border-[#B45309] cursor-pointer'
                  : 'bg-[#F3EEFA] text-[#A79EBD] border-[#E4DEF1] cursor-not-allowed'
              }`}
              title={backpackCount > 0 ? `${t('bw.backpackTake')} (${backpackCount})` : `${t('bw.backpackEmpty')} — ${t('bw.backpackHow')}`}
            >
              <Backpack className="w-3.5 h-3.5" />
              <span className="text-[10px] font-bold">{backpackCount > 0 ? backpackCount : t('bw.backpackLabel')}</span>
            </button>
            <button onClick={() => setShowLuaPreview(v => !v)}
              className={`p-2 rounded-lg transition-colors border cursor-pointer ${showLuaPreview ? 'bg-[#6750A4] text-white border-[#6750A4]' : 'bg-[#F3EEFA] hover:bg-[#E4DEF1] text-[#221E2B] border-[#CBC3DD]'}`}
              title={showLuaPreview ? 'Ẩn mã Lua' : 'Xem mã Lua sinh từ khối & Designer'}>
              <Code2 className="w-4 h-4" />
            </button>
            <button onClick={clearAll}
              className="p-2 bg-[#F3EEFA] hover:bg-red-950/20 hover:text-red-600 text-red-500 rounded-lg border border-[#CBC3DD] hover:border-red-300 transition-colors cursor-pointer"
              title={t('bw.clearAll')}>
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Nền bảng vẽ — chuột trái kéo nền trống để CUỘN ngang/dọc (kiểu Kodular) */}
        <div
          ref={workspaceRef}
          className="flex-1 relative min-h-0 overflow-hidden cursor-grab active:cursor-grabbing"
          style={{
            backgroundImage: 'radial-gradient(circle, #C7BFD9 1.1px, transparent 1.1px)',
            backgroundSize: '22px 22px'
          }}
          onWheel={(e) => {
            const el = workspaceRef.current;
            if (!el) return;
            const rect = el.getBoundingClientRect();
            const mx = e.clientX - rect.left, my = e.clientY - rect.top;
            const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
            setView(v => {
              const k = Math.min(2, Math.max(0.3, v.k * factor));
              return { k, x: mx - ((mx - v.x) / v.k) * k, y: my - ((my - v.y) / v.k) * k };
            });
          }}
          onContextMenu={(e) => {
            // Menu nền (không trỏ khối): mở menu CANVAS (Undo/Redo/Clean up/Help)
            const t = e.target as HTMLElement;
            if (t.closest('[data-block],[input],[select],button')) return;
            e.preventDefault();
            setCanvasMenu({ x: e.clientX, y: e.clientY });
          }}
          onPointerDown={(e) => {
            // Chuột trái (hoặc giữa) trên nền trống → bắt đầu PAN cuộn ngang/dọc.
            // Chỉ chặn khi trúng KHỐI hoặc vùng thả RIÊNG (không phải chính canvas —
            // canvas cũng là [data-zone="canvas"] nên không dùng closest('[data-zone]')).
            if (e.button !== 0 && e.button !== 1) return;
            const t = e.target as HTMLElement;
            if (t.closest('[data-block],[data-stack],[input],[select],button')) return;
            const zone = t.closest('[data-zone]') as HTMLElement | null;
            if (zone && zone.dataset.action !== 'canvas') return;
            e.preventDefault();
            // Đăng listener NGAY TRỰC TIẾP trên window (không chờ React flush —
            // giống pointerDrag.ts) để pan mượt kể cả synthetic/touch.
            const start = { px: e.clientX, py: e.clientY, vx: view.x, vy: view.y, moved: false };
            const onMove = (ev: PointerEvent) => {
              const dx = ev.clientX - start.px, dy = ev.clientY - start.py;
              if (!start.moved) {
                if (Math.hypot(dx, dy) < 5) return;
                start.moved = true;
                document.body.style.userSelect = 'none';
              }
              setView(v => ({ ...v, x: start.vx + dx, y: start.vy + dy }));
            };
            const onUp = () => {
              window.removeEventListener('pointermove', onMove);
              window.removeEventListener('pointerup', onUp);
              window.removeEventListener('pointercancel', onUp);
              document.body.style.userSelect = '';
            };
            window.addEventListener('pointermove', onMove);
            window.addEventListener('pointerup', onUp);
            window.addEventListener('pointercancel', onUp);
          }}
          data-zone="canvas" data-action="canvas"
        >
          {/* Lớp nội dung thu phóng */}
          <div
            className="absolute origin-top-left"
            style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})`, width: 4000, height: 4000 }}
          >
            {roots.map(root => <StackView key={root.id} ctx={ctx} root={root} />)}
          </div>

          {blocks.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-[#6F687E] pointer-events-none z-10">
              <Boxes className="w-12 h-12 mb-3 stroke-[1.5] text-[#6750A4]" />
              <p className="text-sm font-semibold text-[#494256]">{t('bw.emptyCanvasTitle')}</p>
              <p className="text-xs text-[#6F687E] mt-1">{t('bw.emptyCanvasDesc')}</p>
            </div>
          )}

          {/* Nút "Show Warnings" kiểu Kodular — góc dưới trái bảng vẽ */}
          <button
            onClick={() => setShowWarnings(v => !v)}
            className={`absolute bottom-4 left-4 z-20 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[10px] font-bold shadow-sm transition-colors cursor-pointer ${
              warnings.length > 0
                ? 'bg-amber-50 border-amber-400 text-amber-800 hover:bg-amber-100'
                : 'bg-[#F7F3FC]/90 border-[#CBC3DD] text-[#494256] hover:bg-white'
            }`}
            title={warnings.length > 0 ? `${warnings.length} cảnh báo — bấm để xem` : 'Không có cảnh báo nào'}
          >
            <AlertTriangle className={`w-3.5 h-3.5 ${warnings.length > 0 ? 'text-amber-600' : 'text-[#A79EBD]'}`} />
            <span>{showWarnings ? t('bw.hideWarnings') : t('bw.showWarnings')}</span>
            {warnings.length > 0 && (
              <span className="ml-0.5 bg-amber-600 text-white rounded-full px-1.5 text-[9px] font-black">{warnings.length}</span>
            )}
          </button>

          {/* Bảng cảnh báo */}
          {showWarnings && (
            <div className="absolute bottom-16 left-4 z-20 w-[330px] max-h-52 overflow-auto bg-white border border-[#CBC3DD] rounded-xl shadow-2xl">
              <div className="sticky top-0 px-3 py-2 border-b border-[#E4DEF1] bg-[#F7F3FC] flex items-center justify-between">
                <span className="text-[11px] font-bold text-[#221E2B]">{t('bw.warnings')} ({warnings.length})</span>
                <button onClick={() => setShowWarnings(false)} className="text-[#6F687E] hover:text-[#221E2B] cursor-pointer" title="Đóng">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              {warnings.length === 0 ? (
                <p className="px-3 py-4 text-[11px] text-[#6F687E]">
                  Không có cảnh báo nào — mọi khối đều trỏ đúng thành phần.
                </p>
              ) : (
                <ul className="divide-y divide-[#E4DEF1]">
                  {warnings.map((w, i) => (
                    <li key={`${w.blockId}_${i}`} className="px-3 py-2 flex items-start gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[11px] font-bold text-[#221E2B] truncate">{w.label}</p>
                        <p className="text-[10px] text-[#6F687E]">{w.message}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Thùng rác — góc dưới phải (như App Inventor / Kodular) */}
          <div
            data-zone="trash" data-action="trash"
            className={`absolute bottom-4 right-4 z-20 w-24 h-20 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-1 text-[10px] font-bold transition-all ${
              overTrash && drag
                ? 'bg-red-600 text-white border-red-400 scale-110 shadow-2xl'
                : drag
                  ? 'bg-red-50 text-red-400 border-red-300'
                  : 'bg-[#F7F3FC]/70 text-[#A79EBD] border-[#CBC3DD]'
            }`}
            title={t('bw.dropToDelete')}
          >
            <Trash2 className="w-7 h-7" />
            <span>{drag ? t('bw.dropToDelete') : t('bw.trash')}</span>
          </div>

          {/* Ghost kéo */}
          {ghost && (
            <div
              id="block-ghost"
              className="fixed z-[999] pointer-events-none opacity-80"
              style={{ left: ghost.x, top: ghost.y, transform: 'rotate(1.5deg)' }}
            >
              <div
                className={ghost.kind === 'value' ? 'rounded-full px-4 py-1.5 text-white text-xs font-bold whitespace-nowrap shadow-2xl' : 'rounded-xl px-4 py-2 text-white text-xs font-bold whitespace-nowrap shadow-2xl'}
                style={{ backgroundColor: ghost.color }}
              >
                {ghost.label}
              </div>
            </div>
          )}
        </div>

        {/* Lua preview */}
        {showLuaPreview && (
          <div className="h-64 bg-[#F7F3FC] border-t border-[#E4DEF1] flex flex-col z-20 shadow-2xl shrink-0">
            <div className="flex items-center justify-between px-4 py-2 bg-[#F3EEFA] border-b border-[#E4DEF1]">
              <span className="text-xs font-bold text-[#221E2B] flex items-center gap-2">
                <Code2 className="w-4 h-4 text-[#047857]" />
                Mã Lua tự động sinh từ Blocks &amp; Designer
              </span>
              <button onClick={() => setShowLuaPreview(false)} className="text-xs text-[#494256] hover:text-[#221E2B] cursor-pointer">{t('common.close')}</button>
            </div>
            <pre className="flex-1 p-4 font-mono text-xs text-[#047857] overflow-auto bg-[#EFEAF6] leading-relaxed">{generatedLua}</pre>
          </div>
        )}
      </section>

      {/* ============ MENU CHUỘT PHẢI NỀN CANVAS: Undo / Redo / Clean up / Help ============ */}
      {canvasMenu && (() => {
        const menuW = 218, menuH = 172;
        const mx = Math.min(canvasMenu.x, window.innerWidth - menuW - 8);
        const my = Math.min(canvasMenu.y, window.innerHeight - menuH - 8);
        const CItem = ({ icon: Icon, label, onClick, danger, hint, disabled }: {
          icon: any; label: string; onClick: () => void; danger?: boolean; hint?: string; disabled?: boolean;
        }) => (
          <button
            onClick={(e) => { e.stopPropagation(); if (!disabled) { onClick(); setCanvasMenu(null); } }}
            disabled={disabled}
            className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-left text-[11px] font-semibold transition-colors cursor-pointer ${
              disabled
                ? 'text-[#A79EBD] cursor-not-allowed'
                : danger
                  ? 'text-red-700 hover:bg-red-50'
                  : 'text-[#221E2B] hover:bg-[#F3EEFA]'
            }`}
            title={hint}
          >
            <Icon className={`w-3.5 h-3.5 shrink-0 ${danger ? 'text-red-500' : 'text-[#6750A4]'}`} />
            <span className="flex-1">{label}</span>
            {hint && <span className="text-[9px] text-[#A79EBD] font-mono">{hint}</span>}
          </button>
        );
        return (
          <div
            className="fixed z-[9999] bg-white border border-[#CBC3DD] rounded-xl shadow-2xl py-1.5 select-none overflow-hidden"
            style={{ left: mx, top: my, width: menuW }}
            onClick={(e) => e.stopPropagation()}
            onContextMenu={(e) => e.preventDefault()}
          >
            <div className="px-3 py-1 text-[9px] font-bold uppercase tracking-wider text-[#A79EBD] border-b border-[#E4DEF1] mb-1">
              {t('bw.canvasMenu')}
            </div>
            <CItem icon={Undo2} label={t('bw.undo')} onClick={handleUndo} hint="Ctrl+Z" disabled={!canUndo} />
            <CItem icon={Redo2} label={t('bw.redo')} onClick={handleRedo} hint="Ctrl+Y" disabled={!canRedo} />
            <div className="my-1 border-t border-[#E4DEF1]" />
            <CItem icon={LayoutGrid} label={t('bw.cleanUp')} onClick={handleCleanUpLayout} hint={t('bw.byConnection')} />
            <CItem icon={HelpCircle} label={t('bw.helpTitle')} onClick={() => void infoDialog({ title: t('bw.helpTitle'), message: t('bw.helpText'), icon: 'help' })} />
          </div>
        );
      })()}

      {/* ============ CONTEXT MENU chuột phải kiểu Kodular ============ */}
      {ctxMenu && ctxBlock && ctxDef && (() => {
        const isEventBlock = isEventDef(ctxDef);
        const hasBodies = !!ctxDef.bodies && ctxDef.bodies.length > 0;
        // vị trí menu: kẹp trong viewport
        const menuW = 232, menuH = 376;
        const mx = Math.min(ctxMenu.x, window.innerWidth - menuW - 8);
        const my = Math.min(ctxMenu.y, window.innerHeight - menuH - 8);
        const MenuItem = ({ icon: Icon, label, onClick, danger, hint, disabled }: {
          icon: any; label: string; onClick: () => void; danger?: boolean; hint?: string; disabled?: boolean;
        }) => (
          <button
            onClick={(e) => { e.stopPropagation(); if (!disabled) onClick(); }}
            disabled={disabled}
            className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-left text-[11px] font-semibold transition-colors cursor-pointer ${
              disabled
                ? 'text-[#A79EBD] cursor-not-allowed'
                : danger
                  ? 'text-red-700 hover:bg-red-50'
                  : 'text-[#221E2B] hover:bg-[#F3EEFA]'
            }`}
            title={hint}
          >
            <Icon className={`w-3.5 h-3.5 shrink-0 ${danger ? 'text-red-500' : 'text-[#6750A4]'}`} />
            <span className="flex-1">{label}</span>
            {hint && <span className="text-[9px] text-[#A79EBD] font-mono">{hint}</span>}
          </button>
        );
        return (
          <div
            className="fixed z-[9999] bg-white border border-[#CBC3DD] rounded-xl shadow-2xl py-1.5 select-none overflow-hidden"
            style={{ left: mx, top: my, width: menuW }}
            onClick={(e) => e.stopPropagation()}
            onContextMenu={(e) => e.preventDefault()}
          >
            <div className="px-3 py-1 text-[9px] font-bold uppercase tracking-wider text-[#A79EBD] truncate border-b border-[#E4DEF1] mb-1">
              {shortLabel(ctxDef)}
            </div>
            <MenuItem icon={Copy} label={t('bw.duplicate')} hint={t('bw.subtree')}
              onClick={() => handleDuplicate(ctxMenu.blockId)} />
            <MenuItem icon={CopyPlus} label={t('bw.backpack')} hint={t('bw.saveSubtree')}
              onClick={() => handleSaveToBackpack(ctxMenu.blockId)} />
            <div className="my-1 border-t border-[#E4DEF1]" />
            <MenuItem icon={MessageSquare} label={ctxBlock.comment ? t('bw.editComment') : t('bw.addComment')}
              onClick={() => handleComment(ctxMenu.blockId)}
              hint={ctxBlock.comment ? '✓' : undefined} />
            {hasBodies && (
              <MenuItem icon={Minimize2} label={ctxBlock.collapsed ? t('bw.expand') : t('bw.collapse')}
                onClick={() => patchBlock(ctxMenu.blockId, { collapsed: !ctxBlock.collapsed })}
                hint={ctxBlock.collapsed ? '✓' : undefined} />
            )}
            <MenuItem icon={EyeOff} label={ctxBlock.disabled ? t('bw.enable') : t('bw.disable')}
              onClick={() => patchBlock(ctxMenu.blockId, { disabled: !ctxBlock.disabled })}
              hint={ctxBlock.disabled ? '✓' : undefined} />
            <MenuItem icon={Boxes} label={ctxBlock.generic ? t('bw.unGeneric') : t('bw.makeGeneric')}
              onClick={() => patchBlock(ctxMenu.blockId, { generic: !ctxBlock.generic })}
              hint={ctxBlock.generic ? '✓' : t('bw.genericHint')}
              disabled={isEventBlock} />
            <div className="my-1 border-t border-[#E4DEF1]" />
            <MenuItem icon={ImageDown} label={t('bw.downloadPng')}
              onClick={() => handleDownloadPng(ctxMenu.blockId)} />
            <MenuItem icon={Code2} label={t('bw.luaCompare')}
              onClick={() => { setLuaCompare({ blockId: ctxMenu.blockId }); setCtxMenu(null); }} />
            <div className="my-1 border-t border-[#E4DEF1]" />
            <MenuItem icon={Trash2} label={t('bw.deleteBlock')} danger
              onClick={() => handleDeleteSubtree(ctxMenu.blockId)}
              hint="cả chuỗi con" />
          </div>
        );
      })()}

      {/* ===== Modal ĐỐI CHIẾU MÃ LUA của khối đang chọn ===== */}
      {luaCompare && (() => {
        const blk = byId.get(luaCompare.blockId);
        const def = blk ? defOf(blk) : undefined;
        if (!blk || !def) return null;
        // Mã Lua chính xác của khối này (chuỗi lệnh bắt đầu từ nó / thân sự kiện)
        const luaCode = (generateBlockChainCode(blk, blocks) || '-- (không sinh mã)').trimEnd();
        return (
          <div
            className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            onClick={() => setLuaCompare(null)}
          >
            <div
              className="bg-[#F7F3FC] border border-[#E4DEF1] rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-5 py-3 flex items-center gap-2.5 border-b border-[#E4DEF1] bg-[#F3EEFA]">
                <Code2 className="w-4 h-4 text-[#6750A4]" />
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-[#221E2B] truncate">{t('bw.luaCompare')}</h3>
                  <p className="text-[10px] text-[#6F687E] truncate">{shortLabel(def)} — {blk.id}</p>
                </div>
                <button
                  onClick={() => setLuaCompare(null)}
                  className="p-1.5 rounded-lg text-[#6F687E] hover:text-[#221E2B] hover:bg-[#E4DEF1] transition-colors cursor-pointer"
                  aria-label={t('common.close')}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-[#E4DEF1] max-h-[65vh]">
                <div className="p-4 overflow-y-auto">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#A79EBD] mb-2">{t('bw.blockSide')}</p>
                  <div
                    className="inline-block max-w-full"
                    data-compare-block={blk.id}
                  >
                    <StackView ctx={ctx} root={blk} />
                  </div>
                  <p className="text-[9px] text-[#6F687E] mt-3 italic">{t('bw.luaCompareHint')}</p>
                </div>
                <div className="p-4 overflow-y-auto bg-[#0F1115]">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#7C8DA6] mb-2">{t('bw.luaSide')}</p>
                  <pre className="text-[11px] leading-relaxed font-mono text-[#93E6A0] whitespace-pre-wrap break-words">{luaCode}</pre>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Quản lý tiện ích .mvxp (nhập tệp Lua + manifest) */}
      <ExtensionManagerModal
        isOpen={isExtModalOpen}
        onClose={() => setIsExtModalOpen(false)}
        extensions={extensions}
        onAddExtension={useAppStore.getState().addExtension}
        onRemoveExtension={useAppStore.getState().removeExtension}
      />
    </div>
  );
};

/** Một CHUỖI (stack) tự do trên bảng — đặt tại x,y của khối đầu */
function StackView({ ctx, root }: { ctx: WsCtx; root: BlockInstance }) {
  const def = defOf(root);
  if (!def) return null;
  const isVal = !!def.outputType;
  return (
    <div className="absolute flex flex-col" style={{ left: root.x ?? 60, top: root.y ?? 60 }} data-stack={root.id}>
      {isVal
        ? <ValuePill ctx={ctx} valueBlock={root} embedded={false} />
        : <StatementView ctx={ctx} block={root} isHead />}
    </div>
  );
}
