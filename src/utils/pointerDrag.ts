import { useRef, useState } from 'react';

/**
 * Kéo-thả kiểu App Inventor / Blockly — KHÔNG dùng HTML5 drag & drop
 * (dataTransfer/draggable thường bị chặn trong webview desktop, khiến
 * kéo thả không hoạt động). Cách hoạt động:
 *
 * - `startDrag` gắn vào onPointerDown của phần tử kéo được. Không
 *   preventDefault ngay → nếu người dùng chỉ nhấp (không di chuyển) thì
 *   sự kiện click vẫn bình thường (thêm khối / chọn thành phần).
 * - Di chuyển quá ngưỡng 6px → bắt đầu kéo thật: bắt con trỏ
 *   (pointer capture), vẽ ghost theo chuột, hit-test vùng thả qua
 *   document.elementFromPoint + thẻ [data-zone].
 * - pointerup trên vùng thả → gọi opts.drop(payload, zoneEl, point).
 *   Không trên vùng nào → hủy. Click phát sinh sau một cú kéo bị nuốt
 *   qua `suppressClick` (dán ở onClickCapture của workspace).
 *
 * Các listener window được gắn TRỰC TIẾP trong startDrag (không qua
 * useEffect) để phiên kéo hoạt động ngay sau pointerdown, kể cả khi
 * pointermove/pointerup xảy ra trước khi React kịp flush.
 */

export interface PointerDragOptions<T> {
  /** Vùng thả [data-zone] có chấp nhận payload này không (hoverEl = phần tử đang trỏ) */
  accepts: (payload: T, zoneEl: HTMLElement, hoverEl: HTMLElement) => boolean;
  /** Thực hiện thả tại vùng thả với tọa độ con trỏ (client) */
  drop: (payload: T, zoneEl: HTMLElement, point: { x: number; y: number }) => void;
}

export interface PointerDragState<T> {
  payload: T;
  label: string;
  color: string;
  x: number;
  y: number;
  /** Ctrl đang giữ trong lúc kéo (bỏ snap ở drop handler nếu muốn) */
  ctrlKey: boolean;
}

const DRAG_THRESHOLD = 6;

interface DragSession<T> {
  pointerId: number;
  startX: number;
  startY: number;
  source: HTMLElement;
  payload: T;
  label: string;
  color: string;
  moved: boolean;
  ctrlKey: boolean;
}

export function usePointerDrag<T>(opts: PointerDragOptions<T>) {
  const optsRef = useRef(opts);
  optsRef.current = opts;

  /** Trạng thái kéo (null = không kéo) — dùng để vẽ ghost + đổi style */
  const [drag, setDrag] = useState<PointerDragState<T> | null>(null);
  /** Vùng thả đang trỏ tới (để highlight) */
  const [overZone, setOverZone] = useState<HTMLElement | null>(null);

  const sessionRef = useRef<DragSession<T> | null>(null);
  /** Nuốt click phát sinh NGAY SAU một cú kéo (tránh thêm khối 2 lần) */
  const suppressUntilRef = useRef(0);

  /** Gỡ listener + xóa trạng thái phiên kéo */
  function clearSession() {
    const s = sessionRef.current;
    sessionRef.current = null;
    window.removeEventListener('pointermove', handleMove);
    window.removeEventListener('pointerup', handleUp);
    window.removeEventListener('pointercancel', handleCancel);
    window.removeEventListener('blur', handleCancel);
    setDrag(null);
    setOverZone(null);
    document.body.style.userSelect = '';
  }

  function handleMove(e: PointerEvent) {
    const s = sessionRef.current;
    if (!s) return;
    const dx = e.clientX - s.startX;
    const dy = e.clientY - s.startY;
    if (!s.moved) {
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      s.moved = true;
      suppressUntilRef.current = Date.now() + 800;
      document.body.style.userSelect = 'none';
      // KHÔNG dùng setPointerCapture — nó phá elementFromPoint trong một số browser
    }
    setDrag({ payload: s.payload, label: s.label, color: s.color, x: e.clientX, y: e.clientY, ctrlKey: e.ctrlKey });
    // Hit-test: tạm ẩn ghost để elementFromPoint tìm đúng zone bên dưới
    const ghostEl = document.getElementById('block-ghost');
    if (ghostEl) ghostEl.style.display = 'none';
    const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
    if (ghostEl) ghostEl.style.display = '';
    const zoneEl = el?.closest?.('[data-zone]') as HTMLElement | null;
    let hit: HTMLElement | null = null;
    if (zoneEl && el && optsRef.current.accepts(s.payload, zoneEl, el)) hit = zoneEl;
    setOverZone(prev => (prev === hit ? prev : hit));
  }

  function handleUp(e: PointerEvent) {
    const s = sessionRef.current;
    if (!s) return;
    const wasDragging = s.moved;
    let zone: HTMLElement | null = null;
    if (wasDragging) {
      // Tạm ẩn ghost để elementFromPoint tìm đúng zone
      const ghostEl = document.getElementById('block-ghost');
      if (ghostEl) ghostEl.style.display = 'none';
      const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
      if (ghostEl) ghostEl.style.display = '';
      const zoneEl = el?.closest?.('[data-zone]') as HTMLElement | null;
      if (zoneEl && el && optsRef.current.accepts(s.payload, zoneEl, el)) zone = zoneEl;
    }
    clearSession();
    if (zone) {
      optsRef.current.drop(s.payload, zone, { x: e.clientX, y: e.clientY });
    }
  }

  function handleCancel() {
    clearSession();
  }

  /**
   * Gắn vào onPointerDown của phần tử kéo được.
   * Bỏ qua nếu bấm vào ô nhập/nút (input, select, button…) bên trong khối.
   */
  function startDrag(e: React.PointerEvent, payload: T, label = '', color = '#7C3AED') {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const t = e.target as HTMLElement;
    if (t.closest('input,select,button,textarea,[contenteditable]')) return;
    // Chặn sự kiện lan tới KHỐI/THÀNH PHẦN CHA (khối/linh kiện lồng nhau): nếu
    // không, bấm vào con (vd ActionBtn trong FooterBar) sẽ kích hoạt luôn
    // onPointerDown của cha → cha cướp payload kéo của con.
    e.stopPropagation();
    // Dừng phiên cũ nếu có (an toàn)
    clearSession();
    sessionRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      source: (e.currentTarget as HTMLElement) || t,
      payload,
      label,
      color,
      moved: false,
      ctrlKey: e.ctrlKey
    };
    // Gắn listener TRỰC TIẾP — không chờ useEffect (React flush có thể trễ)
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleCancel);
    window.addEventListener('blur', handleCancel);
  }

  /**
   * onClickCapture ở gốc workspace: nuốt click phát sinh ngay sau một cú
   * kéo thật (pointer capture chuyển click về phần tử nguồn → tránh kích
   * hoạt nhầm onClick thêm khối/chọn thành phần).
   */
  function suppressClick(e: React.SyntheticEvent) {
    if (Date.now() < suppressUntilRef.current) {
      e.preventDefault();
      e.stopPropagation();
    }
  }

  return { drag, overZone, startDrag, suppressClick, clearSession };
}