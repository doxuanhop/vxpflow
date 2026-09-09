import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Square, Type, Image as ImageIcon, CheckSquare, Sliders, 
  Layers, Clock, Volume2, Gamepad2, Vibrate, HardDrive, 
  Trash2, Edit3, Smartphone, Search, ChevronDown, ChevronRight,
  Plus, X, HelpCircle, Eye, EyeOff, LayoutGrid, ToggleLeft, 
  CircleDot, Star, Calendar, Music, Sparkles, Folder, Copy,
  ClipboardPaste, Grid, Move, Maximize2, Minimize2, ArrowUp,
  ArrowDown, ArrowLeft, ArrowRight, CornerDownLeft, AlertCircle,
  Check, Phone, PhoneOff, Compass, Key, PanelLeftClose, PanelLeftOpen,
  AlignLeft, AlignCenter, AlignRight, ArrowUpToLine, ArrowDownToLine,
  AlignVerticalJustifyCenter, Palette, Rocket, Keyboard, Puzzle, WandSparkles
} from 'lucide-react';
import { useI18n } from '../../i18n';
import { useSysDialogs } from '../SystemDialogs/SystemDialogs';
import { ExtensionManagerModal } from '../Blocks/ExtensionManagerModal';
import { useAppStore } from '../../store/appStore';
import { UIComponent, ScreenResolution, VXPScreenProps, ProjectAsset } from '../../types';
import { usePointerDrag } from '../../utils/pointerDrag';
import { S30PlusColorPalette } from './S30PlusColorPalette';
import { debugLogger } from '../../utils/debugLogger';
import { nextScreenName } from '../../utils/screens';

interface DesignerWorkspaceProps {
  /** Thành phần của ĐÚNG màn hình đang thiết kế (đã lọc ở App) */
  components: UIComponent[];
  screens: string[];
  activeScreen: string;
  entryScreen: string;
  screenProperties: VXPScreenProps;
  selectedComponentId: string | null;
  resolution: ScreenResolution;
  /** Ảnh đã import trong tab Files (Import Assets) — cho linh kiện Image/Sprite chọn */
  assets?: ProjectAsset[];
  onSelectComponent: (id: string | null) => void;
  onUpdateComponents: (components: UIComponent[]) => void;
  onSwitchScreen: (screen: string) => void;
  onAddScreen: (name: string) => void;
  /** Sao chép màn hình hiện tại (thành phần + blocks) — kiểu Kodular Duplicate Screen */
  onCopyScreen: (name: string) => void;
  onRenameScreen: (oldName: string, newName: string) => void;
  onDeleteScreen: (name: string) => void;
  onSetEntryScreen: (screen: string) => void;
  onUpdateScreenProps: (patch: Partial<VXPScreenProps>) => void;
  /** Đổi tên thành phần → đồng bộ các khối lệnh đang trỏ tên cũ (store) */
  onRenameComponent?: (oldName: string, newName: string) => void;
}

interface PaletteItem {
  type: UIComponent['type'];
  name: string;
  vietnameseName: string;
  icon: React.ComponentType<{ className?: string }>;
  defaultProps: Record<string, any>;
  defaultWidth?: number | string;
  defaultHeight?: number | string;
  description: string;
}

/** Mảng rỗng dùng chung — tránh tạo mảng mới mỗi render (gây vòng lặp zustand selector) */
const EMPTY_EXTS: import('../../types').VXPExtension[] = [];

interface PaletteCategory {
  id: string;
  title: string;
  items: PaletteItem[];
}

const PALETTE_CATEGORIES: PaletteCategory[] = [
  {
    id: 'ui',
    title: 'Giao diện người dùng (User Interface)',
    items: [
      { 
        type: 'Button', 
        name: 'Button', 
        vietnameseName: 'Nút bấm', 
        icon: Square, 
        description: 'Nút nhấn kích hoạt sự kiện bấm phím hoặc cảm ứng',
        defaultProps: { text: 'Nút bấm', backgroundColor: '#3B82F6', textColor: '#ffffff', fontSize: 14, fontBold: false, fontItalic: false, textAlignment: 'center', enabled: true, visible: true }, 
        defaultWidth: 'auto', 
        defaultHeight: 36 
      },
      { 
        type: 'Label', 
        name: 'Label', 
        vietnameseName: 'Nhãn văn bản', 
        icon: Type, 
        description: 'Hiển thị đoạn văn bản, tiêu đề hoặc thông số',
        defaultProps: { text: 'Nhãn văn bản', textColor: '#ffffff', fontSize: 14, fontBold: false, fontItalic: false, textAlignment: 'left', visible: true }, 
        defaultWidth: 'auto', 
        defaultHeight: 24 
      },
      { 
        type: 'CheckBox', 
        name: 'CheckBox', 
        vietnameseName: 'Hộp kiểm', 
        icon: CheckSquare, 
        description: 'Hộp chọn bật/tắt (True/False)',
        defaultProps: { text: 'Tùy chọn bật/tắt', checked: true, textColor: '#ffffff', fontSize: 14, fontBold: false, enabled: true, visible: true }, 
        defaultWidth: 'auto', 
        defaultHeight: 30 
      },
      { 
        type: 'TextBox', 
        name: 'TextBox', 
        vietnameseName: 'Hộp nhập liệu', 
        icon: Type, 
        description: 'Ô nhập văn bản từ bàn phím S30+',
        defaultProps: { text: '', placeholder: 'Nhập nội dung...', backgroundColor: '#1E293B', textColor: '#ffffff', fontSize: 14, enabled: true, visible: true }, 
        defaultWidth: 'fill', 
        defaultHeight: 36 
      },
      { 
        type: 'Image', 
        name: 'Image', 
        vietnameseName: 'Hình ảnh', 
        icon: ImageIcon, 
        description: 'Hiển thị hình ảnh hoặc icon 240x320',
        defaultProps: { picture: 'logo.png', rotationAngle: 0, scalePictureToFit: true, clickable: false, visible: true }, 
        defaultWidth: 120, 
        defaultHeight: 80 
      },
      { 
        type: 'ProgressBar', 
        name: 'Linear Progressbar', 
        vietnameseName: 'Thanh tiến trình', 
        icon: Sliders, 
        description: 'Thanh hiển thị % hoàn thành hoặc máu/thể lực',
        defaultProps: { value: 65, color: '#10B981', backgroundColor: '#374151', visible: true }, 
        defaultWidth: 'fill', 
        defaultHeight: 12 
      },
      { 
        type: 'CircularProgress', 
        name: 'Circular Progress', 
        vietnameseName: 'Tiến trình xoay', 
        icon: CircleDot, 
        description: 'Vòng tròn xoay đang tải',
        defaultProps: { color: '#38BDF8', size: 32, visible: true }, 
        defaultWidth: 32, 
        defaultHeight: 32 
      },
      { 
        type: 'Slider', 
        name: 'Slider', 
        vietnameseName: 'Thanh trượt', 
        icon: Sliders, 
        description: 'Thanh trượt chọn giá trị âm lượng, độ sáng',
        defaultProps: { value: 50, minValue: 0, maxValue: 100, colorLeft: '#3B82F6', visible: true }, 
        defaultWidth: 'fill', 
        defaultHeight: 28 
      },
      { 
        type: 'Switch', 
        name: 'Switch', 
        vietnameseName: 'Công tắc gạt', 
        icon: ToggleLeft, 
        description: 'Công tắc chuyển trạng thái hiện đại',
        defaultProps: { text: 'Bật âm thanh', checked: true, thumbColor: '#38BDF8', trackColor: '#1E293B', visible: true }, 
        defaultWidth: 'auto', 
        defaultHeight: 30 
      }
    ]
  },
  {
    id: 'layout',
    title: 'Bố cục (Layout)',
    items: [
      { 
        type: 'HorizontalArrangement', 
        name: 'Horizontal Arrangement', 
        vietnameseName: 'Bố cục Ngang', 
        icon: Layers, 
        description: 'Chứa các phần tử xếp theo hàng ngang',
        defaultProps: { backgroundColor: 'transparent', alignHorizontal: 'left', alignVertical: 'center', visible: true }, 
        defaultWidth: 'fill', 
        defaultHeight: 'auto' 
      },
      { 
        type: 'VerticalArrangement', 
        name: 'Vertical Arrangement', 
        vietnameseName: 'Bố cục Dọc', 
        icon: Layers, 
        description: 'Chứa các phần tử xếp theo cột dọc',
        defaultProps: { backgroundColor: 'transparent', alignHorizontal: 'left', alignVertical: 'top', visible: true }, 
        defaultWidth: 'fill', 
        defaultHeight: 'auto' 
      },
      { 
        type: 'CardView', 
        name: 'Card View', 
        vietnameseName: 'Khung thẻ (Card)', 
        icon: LayoutGrid, 
        description: 'Khung thẻ bo góc nổi bật',
        defaultProps: { backgroundColor: '#1F2937', cornerRadius: 8, elevation: 4, padding: 8, visible: true }, 
        defaultWidth: 'fill', 
        defaultHeight: 'auto' 
      },
      { 
        type: 'Space', 
        name: 'Space', 
        vietnameseName: 'Khoảng trống', 
        icon: Square, 
        description: 'Tạo khoảng cách trống giữa các phần tử',
        defaultProps: { height: 16, width: 16, visible: true }, 
        defaultWidth: 'fill', 
        defaultHeight: 16 
      }
    ]
  },
  {
    id: 'drawing',
    title: 'Đồ họa & Hoạt hình (Drawing & 2D)',
    items: [
      { 
        type: 'Canvas', 
        name: 'Canvas 2D', 
        vietnameseName: 'Khung vẽ Canvas', 
        icon: Layers, 
        description: 'Khung vẽ đồ họa 2D chuẩn S30+ 240x320',
        defaultProps: { backgroundColor: '#020617', paintColor: '#38BDF8', lineWidth: 2, visible: true }, 
        defaultWidth: 'fill', 
        defaultHeight: 180 
      },
      { 
        type: 'Sprite', 
        name: 'Sprite (Nhân vật)', 
        vietnameseName: 'Nhân vật Sprite', 
        icon: ImageIcon, 
        description: 'Đối tượng đồ họa di chuyển trong game',
        defaultProps: { speed: 2, heading: 0, picture: 'sprite.png', visible: true }, 
        defaultWidth: 32, 
        defaultHeight: 32 
      }
    ]
  },
  {
    id: 'media_hardware',
    title: 'Cảm biến & Phần cứng (Non-visible)',
    items: [
      { type: 'Timer', name: 'Clock (Timer)', vietnameseName: 'Đồng hồ hẹn giờ', icon: Clock, description: 'Kích hoạt sự kiện lặp lại theo chu kỳ mili-giây', defaultProps: { interval: 100, enabled: true, timerAlwaysFires: true } },
      { type: 'Sound', name: 'Sound (Chiptune)', vietnameseName: 'Bộ phát âm thanh', icon: Volume2, description: 'Phát âm thanh chiptune và hiệu ứng game', defaultProps: { volume: 100, minInterval: 100 } },
      { type: 'KeypadListener', name: 'Keypad (Nokia S30+)', vietnameseName: 'Bộ bắt phím cứng', icon: Gamepad2, description: 'Bắt các phím D-Pad và 12 phím số S30+', defaultProps: { handleDPad: true, handleNumKeys: true } },
      { type: 'Vibrator', name: 'Vibrator', vietnameseName: 'Mô-tơ rung', icon: Vibrate, description: 'Kích hoạt mô tơ rung phản hồi của máy', defaultProps: { duration: 50 } },
      { type: 'Storage', name: 'TinyDB (Storage)', vietnameseName: 'Bộ nhớ lưu trữ', icon: HardDrive, description: 'Lưu điểm cao và cấu hình vào bộ nhớ máy', defaultProps: { namespace: 'TinyDB1' } },
      { type: 'Notifier', name: 'Notifier', vietnameseName: 'Hộp thoại thông báo', icon: HelpCircle, description: 'Hiển thị popup thông báo trên màn hình', defaultProps: { textColor: '#ffffff', backgroundColor: '#1F2937' } },
      { type: 'KeyInit', name: 'Initialize (KeyInit)', vietnameseName: 'Khởi tạo bàn phím', icon: Keyboard, description: 'Khởi tạo keypad S30+/Nokia 225 để bắt phím cứng', defaultProps: { device: 'S30+ (240x320)' } }
    ]
  }
];

export const DesignerWorkspace: React.FC<DesignerWorkspaceProps> = ({
  components,
  screens,
  activeScreen,
  entryScreen,
  screenProperties,
  selectedComponentId,
  resolution,
  assets = [],
  onSelectComponent,
  onUpdateComponents,
  onSwitchScreen,
  onAddScreen,
  onCopyScreen,
  onRenameScreen,
  onDeleteScreen,
  onSetEntryScreen,
  onUpdateScreenProps,
  onRenameComponent
}) => {
  // Screens: trạng thái & thao tác đều được store/project quản lý (persist qua reload)
  const [showAddScreenModal, setShowAddScreenModal] = useState<boolean>(false);
  const [newScreenNameInput, setNewScreenNameInput] = useState<string>('');
  const [isScreenMenuOpen, setIsScreenMenuOpen] = useState<boolean>(false);
  const isEntryScreen = activeScreen === entryScreen;

  // Drawer "Thư viện thành phần" State
  const [isLibraryDrawerOpen, setIsLibraryDrawerOpen] = useState<boolean>(true);
  const [paletteSearch, setPaletteSearch] = useState<string>('');
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    ui: true,
    layout: true,
    drawing: true,
    media_hardware: true
  });

  // Snap to Grid System State
  const [snapToGrid, setSnapToGrid] = useState<boolean>(true);
  const [gridSize, setGridSize] = useState<number>(8); // 8px default (perfect for 240x320: 30x40 cells)
  const [showGridOverlay, setShowGridOverlay] = useState<boolean>(true);

  // Viewer Device Selection: Physical S30+ Phone, Large Pixel 3, or Native 240x320
  const [viewerDevice, setViewerDevice] = useState<'s30plus_physical' | 'pixel3' | 'native'>('s30plus_physical');

  // Clipboard for Keyboard Shortcuts (Ctrl+C, Ctrl+V)
  const [clipboardComponent, setClipboardComponent] = useState<UIComponent | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Drag & Drop State
  /* Kéo-thả kiểu App Inventor — pointer (không HTML5 drag & drop, hay bị chặn
     trong webview). Vùng thả = thẻ [data-zone]; drop được nạp qua ref bên dưới. */
  type DesignerDragPayload = { source: 'palette'; item: PaletteItem } | { source: 'canvas'; compId: string };
  const dropRef = useRef<(payload: DesignerDragPayload, zoneEl: HTMLElement, pt: { x: number; y: number }) => void>(() => {});
  const pd = usePointerDrag<DesignerDragPayload>({
    accepts: () => true,
    drop: (payload, zoneEl, pt) => dropRef.current(payload, zoneEl, pt)
  });
  // Trạng thái highlight vùng thả — suy ra từ vùng đang trỏ tới
  const dragOverParentId = pd.overZone ? (pd.overZone.dataset.parent === '' ? null : (pd.overZone.dataset.parent ?? null)) : null;
  const dragOverIndex = pd.overZone ? Number(pd.overZone.dataset.index ?? -1) : null;

  // Rename Component Modal / State
  const [isRenaming, setIsRenaming] = useState<boolean>(false);
  const [renameInput, setRenameInput] = useState<string>('');

  // Physical Keypad interactive feedback
  const [activePressedKey, setActivePressedKey] = useState<string | null>(null);

  // S30+ Color Target state (Background or Text Color)
  const [colorTarget, setColorTarget] = useState<'backgroundColor' | 'textColor'>('backgroundColor');
  const [screenColorTarget, setScreenColorTarget] = useState<'backgroundColor' | 'navBarColor'>('backgroundColor');

  const isNonVisible = (type: string) => 
    ['Timer', 'Sound', 'KeypadListener', 'Vibrator', 'Storage', 'Notifier'].includes(type);

  const visibleComponents = components.filter(c => !isNonVisible(c.type));
  const nonVisibleComponents = components.filter(c => isNonVisible(c.type));
  const selectedComponent = components.find(c => c.id === selectedComponentId);

  // Helper: Snap value to grid
  const snap = (val: number, step = gridSize): number => {
    if (!snapToGrid) return Math.round(val);
    return Math.round(val / step) * step;
  };

  // Toast notification helper
  const { t } = useI18n();
  const { confirmDialog, promptDialog } = useSysDialogs();
  const projectOfStore = useAppStore((s) => s.project);
  const storeExtensions = projectOfStore.extensions ?? EMPTY_EXTS;
  const [isExtModalOpen, setIsExtModalOpen] = useState<boolean>(false);
  /** Nhãn + mô tả palette theo ngôn ngữ hiện tại (fallback dữ liệu gốc) */
  const paletteName = (item: PaletteItem) => t(`comp.${item.type}`, item.vietnameseName);
  const paletteDesc = (item: PaletteItem) => t(`comp.${item.type}.desc`, item.description);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(prev => prev === msg ? null : prev);
    }, 2500);
  };

  // Add Component from Library
  const handleAddComponent = (item: PaletteItem, targetParentId: string | null = null, insertIndex: number = -1, dropCoord?: { x: number; y: number }) => {
    const existingCount = components.filter(c => c.type === item.type).length + 1;
    const newCompName = `${item.type}${existingCount}`;
    
    // Determine initial X and Y with Grid Snap
    let initX = 16;
    let initY = 16 + (visibleComponents.length % 6) * 32;

    if (dropCoord) {
      initX = snap(dropCoord.x);
      initY = snap(dropCoord.y);
    } else {
      initX = snap(initX);
      initY = snap(initY);
    }

    const newComponent: UIComponent = {
      id: `comp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: newCompName,
      type: item.type,
      x: isNonVisible(item.type) ? 0 : Math.max(0, Math.min(240 - 40, initX)),
      y: isNonVisible(item.type) ? 0 : Math.max(0, Math.min(320 - 30, initY)),
      width: item.defaultWidth ?? (item.type.includes('Arrangement') ? 'fill' : 'auto'),
      height: item.defaultHeight ?? (item.type.includes('Arrangement') ? 'auto' : 32),
      properties: {
        ...item.defaultProps,
        ...(typeof item.defaultProps.text === 'string' && item.defaultProps.text
          ? { text: t(`comp.${item.type}.text`, item.defaultProps.text) }
          : {})
      },
      parentId: targetParentId || undefined
    };

    if (insertIndex >= 0 && insertIndex < components.length) {
      const nextList = [...components];
      nextList.splice(insertIndex, 0, newComponent);
      onUpdateComponents(nextList);
    } else {
      onUpdateComponents([...components, newComponent]);
    }
    
    onSelectComponent(newComponent.id);
    showToast(`${t('dw.added')}: ${newComponent.name}`);
  };

  // Duplicate Component
  const handleDuplicateComponent = (sourceComp: UIComponent) => {
    const existingCount = components.filter(c => c.type === sourceComp.type).length + 1;
    const duplicate: UIComponent = {
      ...JSON.parse(JSON.stringify(sourceComp)),
      id: `comp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: `${sourceComp.type}${existingCount}`,
      x: snap(sourceComp.x + gridSize * 2),
      y: snap(sourceComp.y + gridSize * 2),
    };

    // Prevent overflowing out of 240x320 screen bounds
    if (duplicate.x > 220) duplicate.x = 8;
    if (duplicate.y > 300) duplicate.y = 16;

    onUpdateComponents([...components, duplicate]);
    onSelectComponent(duplicate.id);
    showToast(`${t('dw.duplicated')}: ${duplicate.name}`);
  };

  // Copy & Paste functionality
  const handleCopy = () => {
    if (!selectedComponent) return;
    setClipboardComponent(JSON.parse(JSON.stringify(selectedComponent)));
    showToast(`${t('dw.copied')}: ${selectedComponent.name} (Ctrl+C)`);
  };

  const handlePaste = () => {
    if (!clipboardComponent) {
      showToast(t('dw.clipboardEmpty'));
      return;
    }
    handleDuplicateComponent(clipboardComponent);
  };

  // Delete Component
  const handleDeleteComponent = (id: string) => {
    const compToDelete = components.find(c => c.id === id);
    const updated = components.filter(c => c.id !== id && c.parentId !== id);
    onUpdateComponents(updated);
    if (selectedComponentId === id) onSelectComponent(null);
    if (compToDelete) {
      showToast(`${t('dw.deleted')}: ${compToDelete.name}`);
    }
  };

  // Nudge selected component position with arrow keys
  const handleNudge = (dx: number, dy: number, fast = false) => {
    if (!selectedComponentId) return;
    // Shift+Arrow = bước nhanh 8px (grid lớn); thường = 1px tinh chỉnh nếu đang snap
    const step = fast ? 8 : (snapToGrid ? gridSize : 1);
    const deltaX = dx * step;
    const deltaY = dy * step;

    const updated = components.map(c => {
      if (c.id === selectedComponentId) {
        const nextX = Math.max(0, Math.min(240, snap((c.x || 0) + deltaX)));
        const nextY = Math.max(0, Math.min(320, snap((c.y || 0) + deltaY)));
        return {
          ...c,
          x: nextX,
          y: nextY
        };
      }
      return c;
    });
    onUpdateComponents(updated);
  };

  // Keyboard Shortcuts: Ctrl+C, Ctrl+V, Delete, Backspace, Ctrl+D, Arrow Keys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is currently typing in an input field or textarea
      const targetTag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (targetTag === 'input' || targetTag === 'textarea' || (e.target as HTMLElement)?.isContentEditable) {
        return;
      }

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const isCtrl = isMac ? e.metaKey : e.ctrlKey;

      // Copy: Ctrl+C or Cmd+C
      if (isCtrl && (e.key === 'c' || e.key === 'C')) {
        if (selectedComponent) {
          e.preventDefault();
          handleCopy();
        }
        return;
      }

      // Paste: Ctrl+V or Cmd+V
      if (isCtrl && (e.key === 'v' || e.key === 'V')) {
        e.preventDefault();
        handlePaste();
        return;
      }

      // Duplicate: Ctrl+D or Cmd+D
      if (isCtrl && (e.key === 'd' || e.key === 'D')) {
        if (selectedComponent) {
          e.preventDefault();
          handleDuplicateComponent(selectedComponent);
        }
        return;
      }

      // Delete: Delete or Backspace
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedComponentId) {
          e.preventDefault();
          handleDeleteComponent(selectedComponentId);
        }
        return;
      }

      // Deselect: Escape
      if (e.key === 'Escape') {
        onSelectComponent(null);
        return;
      }

      // Arrow navigation / nudging
      if (selectedComponentId) {
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          handleNudge(0, -1, e.shiftKey);
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          handleNudge(0, 1, e.shiftKey);
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          handleNudge(-1, 0, e.shiftKey);
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          handleNudge(1, 0, e.shiftKey);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedComponent, selectedComponentId, clipboardComponent, components, snapToGrid, gridSize]);  // Thả tại vùng [data-zone] — đọc tham số từ thuộc tính của vùng thả
  const handleZoneDrop = useCallback((payload: DesignerDragPayload, zoneEl: HTMLElement, pt: { x: number; y: number }) => {
    const targetParentId = (zoneEl.dataset.parent ?? '') === '' ? null : (zoneEl.dataset.parent ?? null);
    const dropIndex = Number(zoneEl.dataset.index ?? -1);

    // Tọa độ thả tương đối với vùng thả
    const targetRect = zoneEl.getBoundingClientRect();
    const dropX = pt.x - targetRect.left;
    const dropY = pt.y - targetRect.top;

    if (payload.source === 'palette') {
      handleAddComponent(payload.item, targetParentId, dropIndex, { x: dropX, y: dropY });
    } else if (payload.source === 'canvas') {
      const compId = payload.compId;
      const compIndex = components.findIndex(c => c.id === compId);
      if (compIndex === -1) return;

      const currentComp = components[compIndex];
      // Phòng ngừa: không cho thành phần làm cha của chính nó (khi thả lên
      // chính hộc chứa của nó) — tránh vòng lặp làm mất thành phần khỏi màn hình
      const finalParentId = targetParentId === currentComp.id ? currentComp.parentId : targetParentId;
      // Ctrl+thả = không snap — đặt chính xác vị trí chuột (tinh chỉnh tự do)
      const freePlace = pd.drag?.ctrlKey === true;
      const updatedComp = {
        ...currentComp,
        parentId: finalParentId || undefined,
        x: freePlace ? Math.round(dropX) : snap(dropX),
        y: freePlace ? Math.round(dropY) : snap(dropY)
      };

      const remaining = components.filter(c => c.id !== compId);
      const targetIdx = dropIndex >= 0 ? Math.min(dropIndex, remaining.length) : remaining.length;
      remaining.splice(targetIdx, 0, updatedComp);

      onUpdateComponents(remaining);
      onSelectComponent(compId);
    }
  }, [components, onUpdateComponents, onSelectComponent, snap, handleAddComponent]);
  dropRef.current = handleZoneDrop;

  // Update property
  const handleUpdateProperty = (propName: string, value: any) => {
    if (!selectedComponentId) return;
    const updated = components.map(c => {
      if (c.id === selectedComponentId) {
        return {
          ...c,
          properties: {
            ...c.properties,
            [propName]: value
          }
        };
      }
      return c;
    });
    onUpdateComponents(updated);
  };

  // Update geometry (width, height, x, y, name)
  const handleUpdateGeometry = (field: 'name' | 'width' | 'height' | 'x' | 'y', value: any) => {
    if (!selectedComponentId) return;
    const updated = components.map(c => {
      if (c.id === selectedComponentId) {
        let finalValue = value;
        if ((field === 'x' || field === 'y') && typeof value === 'number') {
          finalValue = snapToGrid ? snap(value) : Math.round(value);
        } else if ((field === 'width' || field === 'height') && typeof value === 'number') {
          finalValue = snapToGrid ? snap(value) : Math.round(value);
        }
        return {
          ...c,
          [field]: finalValue
        };
      }
      return c;
    });
    onUpdateComponents(updated);
  };

  // Snap the selected component to the grid immediately
  const handleSnapSelectedToGrid = () => {
    if (!selectedComponent) return;
    const nextX = snap(selectedComponent.x || 0);
    const nextY = snap(selectedComponent.y || 0);
    const updated = components.map(c => {
      if (c.id === selectedComponent.id) {
        return {
          ...c,
          x: nextX,
          y: nextY
        };
      }
      return c;
    });
    onUpdateComponents(updated);
    showToast(`${t('dw.snapped')}: ${selectedComponent.name} (${gridSize}px)`);
  };

  // Quick Alignment Handler (Align Left, Center, Right, Top, Middle, Bottom)
  const handleQuickAlign = (alignment: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => {
    if (!selectedComponent) return;

    const CANVAS_W = 240;
    const CANVAS_H = 320;

    let compW = 100;
    if (typeof selectedComponent.width === 'number') {
      compW = selectedComponent.width;
    } else if (selectedComponent.width === 'fill') {
      compW = CANVAS_W;
    }

    let compH = 30;
    if (typeof selectedComponent.height === 'number') {
      compH = selectedComponent.height;
    } else if (selectedComponent.height === 'fill') {
      compH = CANVAS_H;
    }

    let nextX = selectedComponent.x || 0;
    let nextY = selectedComponent.y || 0;
    let label = '';

    switch (alignment) {
      case 'left':
        nextX = 0;
        label = t('dw.alignLeft');
        break;
      case 'center':
        nextX = Math.max(0, Math.round((CANVAS_W - compW) / 2));
        label = t('dw.alignCenterH');
        break;
      case 'right':
        nextX = Math.max(0, CANVAS_W - compW);
        label = t('dw.alignRight');
        break;
      case 'top':
        nextY = 0;
        label = t('dw.alignTop');
        break;
      case 'middle':
        nextY = Math.max(0, Math.round((CANVAS_H - compH) / 2));
        label = t('dw.alignMiddle');
        break;
      case 'bottom':
        nextY = Math.max(0, CANVAS_H - compH);
        label = t('dw.alignBottom');
        break;
    }

    if (snapToGrid) {
      nextX = snap(nextX);
      nextY = snap(nextY);
    }

    const updated = components.map(c => {
      if (c.id === selectedComponent.id) {
        return {
          ...c,
          x: nextX,
          y: nextY
        };
      }
      return c;
    });

    onUpdateComponents(updated);
    showToast(`${t('dw.aligned')} ${label}: (${nextX}px, ${nextY}px)`);
    debugLogger.info('Designer', `Đã ${label} cho "${selectedComponent.name}" tại (${nextX}px, ${nextY}px)`);
  };

  // Rename Component — đồng thời đồng bộ các khối lệnh đang trỏ tên cũ (qua store)
  const handleConfirmRename = () => {
    if (!selectedComponentId || !renameInput.trim()) {
      setIsRenaming(false);
      return;
    }
    const oldName = selectedComponent?.name;
    const cleanName = renameInput.trim().replace(/\s+/g, '_');
    handleUpdateGeometry('name', cleanName);
    if (oldName && cleanName !== oldName) {
      onRenameComponent?.(oldName, cleanName);
    }
    setIsRenaming(false);
  };

  // Add Screen — màn hình mới LUÔN TRỐNG (store không copy thành phần màn hình cũ)
  const openAddScreenModal = () => {
    setNewScreenNameInput(nextScreenName(screens));
    setShowAddScreenModal(true);
    setIsScreenMenuOpen(false);
  };

  const handleCreateScreen = () => {
    const screenName = (newScreenNameInput || '').trim().replace(/\s+/g, '');
    if (!screenName) return;
    onAddScreen(screenName);
    setShowAddScreenModal(false);
    setNewScreenNameInput('');
  };

  const handleRenameActiveScreen = async () => {
    const raw = await promptDialog({ title: t('dw.renameCompTitle'), label: t('dw.renameScreenPrompt'), initial: activeScreen });
    if (!raw || !raw.trim()) return;
    const clean = raw.trim().replace(/\s+/g, '');
    if (clean === activeScreen) {
      setIsScreenMenuOpen(false);
      return;
    }
    onRenameScreen(activeScreen, clean);
    setIsScreenMenuOpen(false);
  };

  const handleDeleteActiveScreen = async () => {
    if (screens.length <= 1) {
      showToast(t('dw.cantDeleteOnlyScreen'));
      setIsScreenMenuOpen(false);
      return;
    }
    if (await confirmDialog({ title: t('dw.delScreenTitle'), message: t('dw.deleteScreenConfirm').replace('{name}', activeScreen), danger: true })) {
      onDeleteScreen(activeScreen);
    }
    setIsScreenMenuOpen(false);
  };


  /* ---- TIDY: tự động xếp layout gọn (kiểu m3e-canvas) — Lưu lại bản trước để undo ---- */
  const [lastTidy, setLastTidy] = useState<UIComponent[] | null>(null);
  const handleTidyLayout = () => {
    if (!components.length) return;
    if (lastTidy) {
      // bấm lần 2 → hoàn tác
      onUpdateComponents(lastTidy);
      setLastTidy(null);
      showToast(t('dw.tidyRestored'));
      return;
    }
    setLastTidy(components);
    // Xếp: sắp theo y rồi x; mỗi dòng ghép sát mép trái + cách nhau 1 nửa grid; nhóm hàng có chung y±8
    const vis = components.filter(c => !isNonVisible(c.type) && (c.screen ?? 'Screen1') === activeScreen);
    const rest = components.filter(c => !vis.includes(c));
    const sorted = [...vis].sort((a, b) => (a.y - b.y) || (a.x - b.x));
    const rows: UIComponent[][] = [];
    for (const c of sorted) {
      const row = rows.find(r => Math.abs((r[0]?.y ?? 0) - c.y) <= 12);
      if (row) row.push(c); else rows.push([c]);
    }
    const MARGIN = 4, GAP = 4;
    const out: UIComponent[] = [];
    let cursorY = MARGIN;
    for (const row of rows) {
      let cursorX = MARGIN;
      let rowH = 0;
      for (const c of row) {
        const w = typeof c.width === 'number' ? c.width : 100;
        const h = typeof c.height === 'number' ? c.height : 30;
        const maxX = Math.max(0, 240 - w);
        out.push({ ...c, x: Math.min(cursorX, maxX), y: cursorY });
        cursorX += w + GAP;
        rowH = Math.max(rowH, h);
      }
      cursorY += rowH + GAP;
    }
    onUpdateComponents([...rest, ...out]);
    showToast(t('dw.tidyDone'));
  };

  // Filter palette items based on search
  const filterPaletteItems = (items: PaletteItem[]) => {
    if (!paletteSearch.trim()) return items;
    const q = paletteSearch.toLowerCase();
    return items.filter(i => 
      i.name.toLowerCase().includes(q) || 
      i.vietnameseName.toLowerCase().includes(q) || 
      i.type.toLowerCase().includes(q) ||
      i.description.toLowerCase().includes(q)
    );
  };

  // Handle Physical Keypad Click (simulating physical S30+ buttons)
  const handlePhysicalKeypadPress = (keyName: string) => {
    setActivePressedKey(keyName);
    setTimeout(() => setActivePressedKey(null), 200);

    // If a component is selected, D-Pad keys nudge its position
    if (selectedComponentId) {
      if (keyName === 'UP') handleNudge(0, -1);
      if (keyName === 'DOWN') handleNudge(0, 1);
      if (keyName === 'LEFT') handleNudge(-1, 0);
      if (keyName === 'RIGHT') handleNudge(1, 0);
      if (keyName === 'OK') showToast(`${t('dw.keyOkSelected')}: ${selectedComponent?.name}`);
    } else {
      showToast(`${t('dw.physicalKey')}: ${keyName}`);
    }
  };

  // Dimensions of Viewer Phone Frame
  const getViewerDimensions = () => {
    switch (viewerDevice) {
      case 'pixel3':
        return { width: 330, height: 580, bezelRadius: 'rounded-[36px]', label: t('dw.framePixel3') };
      case 's30plus_physical':
        return { width: 284, height: 320, bezelRadius: 'rounded-[32px]', label: t('dw.frameS30') };
      case 'native':
      default:
        return { width: 240, height: 320, bezelRadius: 'rounded-[16px]', label: t('dw.frameNative') };
    }
  };

  const viewerDim = getViewerDimensions();

  // Render Component inside the Phone Screen (Viewer)
  const renderViewerComponent = (comp: UIComponent, index: number) => {
    const isSelected = selectedComponentId === comp.id;
    const isVisible = comp.properties.visible !== false;

    if (!isVisible) return null;

    const childComponents = components.filter(c => c.parentId === comp.id);

    return (
      <div 
        key={comp.id}
        className="relative group select-none"
        data-zone={`row_${comp.id}`} data-action="drop"
        data-parent={comp.parentId ?? ''} data-index={index}
      >
        {/* Drop indicator line before this component */}
        {dragOverIndex === index && dragOverParentId === (comp.parentId || null) && (
          <div className="h-1 bg-[#A78BFA] shadow-[0_0_8px_#A78BFA] my-1 rounded-full animate-pulse transition-all" />
        )}

        <div
          onPointerDown={(e) => pd.startDrag(e, { source: 'canvas', compId: comp.id })}
          onClick={(e) => {
            e.stopPropagation();
            onSelectComponent(comp.id);
          }}
          style={{
            backgroundColor: comp.properties.backgroundColor || 'transparent',
            color: comp.properties.textColor || '#ffffff',
            fontSize: `${comp.properties.fontSize || 14}px`,
            fontWeight: comp.properties.fontBold ? 'bold' : 'normal',
            fontStyle: comp.properties.fontItalic ? 'italic' : 'normal',
            textAlign: comp.properties.textAlignment || 'left',
            width: comp.width === 'fill' ? '100%' : (typeof comp.width === 'number' ? `${comp.width}px` : 'auto'),
            minHeight: typeof comp.height === 'number' ? `${comp.height}px` : undefined
          }}
          className={`relative cursor-pointer transition-all border border-transparent rounded px-1.5 py-1 ${
            isSelected 
              ? 'ring-2 ring-[#7C3AED] ring-offset-1 ring-offset-[#0F1115] z-20 shadow-md bg-opacity-95' 
              : 'hover:ring-1 hover:ring-[#4B5563]'
          }`}
        >
          {/* Quick Selection Tag Header with X/Y Coordinate Badge */}
          {isSelected && (
            <div className="absolute -top-5 left-0 bg-[#7C3AED] text-white text-[9px] font-mono px-2 py-0.5 rounded-t shadow-md z-30 flex items-center gap-1.5">
              <span className="font-bold">{comp.name}</span>
              <span className="text-[8px] opacity-80 border-l border-white/30 pl-1">
                X:{comp.x ?? 0} Y:{comp.y ?? 0}
              </span>
            </div>
          )}

          {/* Component Types Rendering */}
          {comp.type === 'Button' && (
            <div 
              style={{
                backgroundColor: comp.properties.backgroundColor || '#3B82F6',
                color: comp.properties.textColor || '#ffffff'
              }}
              className="px-3 py-1.5 rounded font-medium text-center shadow-sm w-full flex items-center justify-center min-h-[32px] text-xs"
            >
              <span>{comp.properties.text || comp.name}</span>
            </div>
          )}

          {comp.type === 'Label' && (
            <div className="py-0.5 break-words text-xs">
              {comp.properties.text || comp.name}
            </div>
          )}

          {comp.type === 'CheckBox' && (
            <div className="flex items-center gap-2 py-1 text-xs">
              <input 
                type="checkbox" 
                checked={comp.properties.checked !== false} 
                readOnly 
                className="w-3.5 h-3.5 accent-[#7C3AED] cursor-pointer rounded"
              />
              <span>{comp.properties.text || comp.name}</span>
            </div>
          )}

          {comp.type === 'TextBox' && (
            <div 
              style={{ backgroundColor: comp.properties.backgroundColor || '#1E293B' }}
              className="border border-[#374151] rounded px-2.5 py-1.5 text-xs text-[#9CA3AF] w-full truncate"
            >
              {comp.properties.text || comp.properties.placeholder || t('dw.textBoxPlaceholder')}
            </div>
          )}

          {comp.type === 'Image' && (() => {
            const pic = assets.find(a => a.type === 'image' && a.name === (comp.properties.picture || ''));
            const boxW = typeof comp.width === 'number' ? `${comp.width}px` : '100%';
            const boxH = typeof comp.height === 'number' ? `${comp.height}px` : '90px';
            if (pic) {
              return (
                <div
                  style={{ width: boxW, height: boxH }}
                  className="border border-[#38BDF8] rounded overflow-hidden bg-[#1E293B] relative"
                  title={`Ảnh assets/: ${pic.name} (${pic.width}x${pic.height})`}
                >
                  <img src={pic.data} alt={pic.name} className="w-full h-full object-cover pixelated" />
                </div>
              );
            }
            return (
              <div 
                style={{ width: boxW, height: boxH }}
                className="bg-[#1E293B] border border-[#374151] rounded flex flex-col items-center justify-center p-2 text-center text-[#9CA3AF] overflow-hidden"
              >
                <ImageIcon className="w-6 h-6 text-[#38BDF8] mb-1 opacity-80" />
                <span className="text-[11px] font-mono font-semibold text-white truncate max-w-full">
                  {comp.properties.picture || 'logo.png'}
                </span>
                <span className="text-[9px] text-[#6B7280]">240x320 S30+</span>
              </div>
            );
          })()}

          {comp.type === 'ProgressBar' && (
            <div className="w-full py-1">
              <div className="w-full h-2.5 bg-[#1F2937] rounded-full overflow-hidden border border-[#374151] p-0.5">
                <div 
                  className="h-full rounded-full transition-all" 
                  style={{ 
                    width: `${comp.properties.value || 50}%`,
                    backgroundColor: comp.properties.color || '#10B981'
                  }}
                />
              </div>
            </div>
          )}

          {comp.type === 'CircularProgress' && (
            <div className="flex items-center justify-center p-1.5">
              <div 
                className="w-6 h-6 border-2 border-[#38BDF8] border-t-transparent rounded-full animate-spin"
              />
            </div>
          )}

          {comp.type === 'Slider' && (
            <div className="w-full py-1.5">
              <div className="w-full h-1.5 bg-[#1F2937] rounded-lg relative flex items-center">
                <div 
                  className="h-full bg-[#3B82F6] rounded-lg" 
                  style={{ width: `${comp.properties.value || 50}%` }}
                />
                <div 
                  className="w-3.5 h-3.5 bg-white rounded-full shadow-md border border-[#3B82F6] absolute -ml-1.5"
                  style={{ left: `${comp.properties.value || 50}%` }}
                />
              </div>
            </div>
          )}

          {comp.type === 'Switch' && (
            <div className="flex items-center justify-between py-1 px-1 text-xs">
              <span>{comp.properties.text || comp.name}</span>
              <div className="w-8 h-4 bg-[#7C3AED] rounded-full p-0.5 flex items-center justify-end">
                <div className="w-3 h-3 bg-white rounded-full shadow" />
              </div>
            </div>
          )}

          {comp.type === 'CardView' && (
            <div 
              style={{ backgroundColor: comp.properties.backgroundColor || '#1F2937' }}
              className="rounded-lg p-2.5 border border-[#374151] shadow-md w-full"
            >
              <div className="text-[9px] text-[#6B7280] font-mono mb-1">Card View Container</div>
              {childComponents.length === 0 ? (
                <div className="border border-dashed border-[#4B5563] rounded p-2 text-center text-[11px] text-[#9CA3AF]">
                  {t('dw.dropIntoCard')}
                </div>
              ) : (
                <div className="space-y-1.5">
                  {childComponents.map((child, cIdx) => renderViewerComponent(child, cIdx))}
                </div>
              )}
            </div>
          )}

          {comp.type === 'Space' && (
            <div 
              style={{ height: `${comp.properties.height || 16}px` }} 
              className="w-full bg-transparent flex items-center justify-center opacity-30 hover:opacity-100 hover:bg-[#374151]/30 rounded transition-opacity"
            >
              <span className="text-[8px] text-[#9CA3AF] font-mono">{t('dw.space')} ({comp.properties.height || 16}px)</span>
            </div>
          )}

          {comp.type === 'Canvas' && (
            <div 
              style={{
                backgroundColor: comp.properties.backgroundColor || '#020617',
                height: typeof comp.height === 'number' ? `${comp.height}px` : '150px'
              }}
              className="w-full border-2 border-dashed border-[#374151] rounded flex flex-col items-center justify-center text-center p-2 font-mono text-xs text-[#9CA3AF]"
            >
              <Layers className="w-5 h-5 text-[#38BDF8] mb-1 opacity-70" />
              <span className="font-semibold text-white text-xs">Canvas 2D Viewport</span>
              <span className="text-[9px] text-[#6B7280]">240x320 Nokia S30+</span>
            </div>
          )}

          {/* Arrangements: Horizontal & Vertical Containers */}
          {(comp.type === 'HorizontalArrangement' || comp.type === 'VerticalArrangement') && (
            <div 
              data-zone={`arr_${comp.id}`} data-action="drop"
              data-parent={comp.id} data-index={childComponents.length}
              style={{
                backgroundColor: comp.properties.backgroundColor || 'transparent'
              }}
              className={`border-2 border-dashed rounded p-1.5 transition-colors min-h-[42px] ${
                dragOverParentId === comp.id ? 'border-[#A78BFA] bg-[#7C3AED]/10' : 'border-[#374151]/80 hover:border-[#4F46E5]'
              }`}
            >
              <div className="flex items-center justify-between text-[9px] font-mono text-[#9CA3AF] mb-1">
                <span>{comp.name}</span>
                <span className="text-[8px] text-[#6B7280]">
                  {comp.type === 'HorizontalArrangement' ? t('dw.arrH') : t('dw.arrV')}
                </span>
              </div>

              {childComponents.length === 0 ? (
                <div className="py-1.5 text-center text-[10px] text-[#6B7280] font-sans">
                  {t('dw.dropHere')} ({comp.type === 'HorizontalArrangement' ? t('dw.arrHFull') : t('dw.arrVFull')})
                </div>
              ) : (
                <div className={`gap-1.5 ${comp.type === 'HorizontalArrangement' ? 'flex flex-row items-center overflow-x-auto' : 'flex flex-col'}`}>
                  {childComponents.map((child, cIdx) => renderViewerComponent(child, cIdx))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  const rootComponents = visibleComponents.filter(c => !c.parentId);

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#EFEAF6] select-none text-[#221E2B]" onClickCapture={pd.suppressClick}>
      {/* VXP Subheader Toolbar: Screen Selector, Grid Snap Controls, Device Mode */}
      <div className="h-11 bg-[#F7F3FC] border-b border-[#E4DEF1] px-3 md:px-4 flex items-center justify-between shrink-0 z-20 gap-2">
        {/* Left: Screen selector and Drawer toggle button */}
        <div className="flex items-center gap-2">
          {/* Toggle "Thư viện thành phần" Drawer Button */}
          <button
            onClick={() => setIsLibraryDrawerOpen(!isLibraryDrawerOpen)}
            className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1.5 border transition-colors cursor-pointer ${
              isLibraryDrawerOpen 
                ? 'bg-[#7C3AED]/15 border-[#7C3AED] text-[#6D28D9]' 
                : 'bg-[#F3EEFA] border-[#CBC3DD] text-[#494256] hover:text-[#221E2B]'
            }`}
            title={t('dw.toggleLibrary')}
          >
            {isLibraryDrawerOpen ? <PanelLeftClose className="w-3.5 h-3.5 text-[#6D28D9]" /> : <PanelLeftOpen className="w-3.5 h-3.5 text-[#0284C7]" />}
            <span className="hidden sm:inline">{t('dw.libraryTitle')}</span>
          </button>

          {/* Screen Switcher: chuyển đổi màn hình + thêm/đổi tên/xóa/đặt màn hình chính */}
          <div className="relative">
            <button
              onClick={() => setIsScreenMenuOpen(!isScreenMenuOpen)}
              className="flex items-center gap-1.5 bg-[#F3EEFA] border border-[#CBC3DD] rounded px-2.5 py-1 text-xs font-semibold text-[#221E2B] hover:border-[#7C3AED] transition-colors cursor-pointer"
              title={t('dw.screenSwitcher')}
            >
              {isEntryScreen ? (
                <Star className="w-3.5 h-3.5 text-[#D97706] fill-current" />
              ) : (
                <Smartphone className="w-3.5 h-3.5 text-[#0284C7]" />
              )}
              <span>{activeScreen}</span>
              <ChevronDown className={`w-3 h-3 text-[#494256] transition-transform ${isScreenMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {isScreenMenuOpen && (
              <>
                {/* Overlay để đóng menu khi click ra ngoài */}
                <div className="fixed inset-0 z-40" onClick={() => setIsScreenMenuOpen(false)} />
                <div className="absolute left-0 top-full mt-1.5 bg-[#FDFCFF] border border-[#E4DEF1] rounded-xl shadow-2xl w-72 z-50 py-1.5 text-xs">
                  <div className="px-3 pt-1 pb-1.5 flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold text-[#6F687E] uppercase tracking-wider">
                      {t('dw.screens')} ({screens.length})
                    </span>
                    {isEntryScreen && (
                      <span className="text-[9px] font-semibold text-[#D97706] bg-[#FEF3C7] px-1.5 py-0.5 rounded-full">
                        ★ {t('dw.mainScreen')}
                      </span>
                    )}
                  </div>

                  <div className="max-h-52 overflow-y-auto px-1.5 space-y-0.5">
                    {screens.map((s) => {
                      const isActive = s === activeScreen;
                      const isEntry = s === entryScreen;
                      return (
                        <button
                          key={s}
                          onClick={() => {
                            onSwitchScreen(s);
                            setIsScreenMenuOpen(false);
                          }}
                          className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer ${
                            isActive ? 'bg-[#7C3AED] text-white font-semibold' : 'text-[#221E2B] hover:bg-[#F3EEFA]'
                          }`}
                          title={isActive ? `${t('dw.designing')} ${s}` : `${t('dw.switchTo')} ${s}`}
                        >
                          {isEntry ? (
                            <Star className={`w-3.5 h-3.5 shrink-0 fill-current ${isActive ? 'text-[#FDE68A]' : 'text-[#F59E0B]'}`} />
                          ) : (
                            <Smartphone className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-white/85' : 'text-[#0284C7]'}`} />
                          )}
                          <span className="truncate">{s}</span>
                          <span className={`ml-auto text-[9px] shrink-0 ${isEntry ? (isActive ? 'text-[#FDE68A]' : 'text-[#B45309]') : 'opacity-0'}`}>
                            chính
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="border-t border-[#E4DEF1] my-1.5" />
                  <div className="px-1.5 grid grid-cols-2 gap-1">
                    <button
                      onClick={openAddScreenModal}
                      className="px-2 py-1.5 rounded-lg bg-[#F3EEFA] hover:bg-[#E4DEF1] text-[#221E2B] text-[11px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5 text-[#047857]" />
                      <span>{t('dw.newScreen')}</span>
                    </button>
                    <button
                      onClick={() => { onCopyScreen(activeScreen); setIsScreenMenuOpen(false); }}
                      className="px-2 py-1.5 rounded-lg bg-[#F3EEFA] hover:bg-[#E4DEF1] text-[#221E2B] text-[11px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                      title={t('dw.dupScreenHint')}
                    >
                      <Copy className="w-3.5 h-3.5 text-[#7C3AED]" />
                      <span>{t('dw.dupScreen')}</span>
                    </button>
                    <button
                      onClick={() => {
                        if (isEntryScreen) {
                          showToast(t('dw.alreadyEntry'));
                        } else {
                          onSetEntryScreen(activeScreen);
                        }
                        setIsScreenMenuOpen(false);
                      }}
                      disabled={isEntryScreen}
                      className="px-2 py-1.5 rounded-lg bg-[#F3EEFA] hover:bg-[#E4DEF1] disabled:opacity-40 disabled:cursor-not-allowed text-[#221E2B] text-[11px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                      title={t('dw.entryTooltip')}
                    >
                      <Rocket className="w-3.5 h-3.5 text-[#B45309]" />
                      <span>{t('dw.setEntry')}</span>
                    </button>
                    <button
                      onClick={handleRenameActiveScreen}
                      className="px-2 py-1.5 rounded-lg bg-[#F3EEFA] hover:bg-[#E4DEF1] text-[#221E2B] text-[11px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-[#0284C7]" />
                      <span>{t('common.rename')}</span>
                    </button>
                    <button
                      onClick={handleDeleteActiveScreen}
                      disabled={screens.length <= 1}
                      className="px-2 py-1.5 rounded-lg bg-[#F3EEFA] hover:bg-red-950/30 hover:text-red-600 disabled:opacity-40 disabled:cursor-not-allowed text-red-500 text-[11px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{t('common.delete')}</span>
                    </button>
                  </div>

                  {!isEntryScreen && (
                    <p className="px-3 pt-1.5 pb-1 text-[9px] leading-snug text-[#B45309]">
                      {t('dw.secondaryNote')}
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Center: Grid Snap Controls & S30+ 240x320 Indicator */}
        <div className="flex items-center gap-2">
          {/* Snap-to-Grid System Toolbar */}
          <div className="flex items-center bg-[#F3EEFA] border border-[#CBC3DD] rounded-lg p-0.5 text-xs">
            <button
              onClick={() => setSnapToGrid(!snapToGrid)}
              className={`px-2 py-1 rounded text-xs font-medium flex items-center gap-1 transition-colors ${
                snapToGrid ? 'bg-[#7C3AED] text-white' : 'text-[#494256] hover:text-[#221E2B]'
              }`}
              title={t('dw.toggleSnap')}
            >
              <Grid className="w-3 h-3" />
              <span className="hidden md:inline">{t('dw.snap')} ({gridSize}px)</span>
            </button>

            {/* Tidy — tự xếp layout gọn, bấm lần nữa để hoàn tác (kiểu m3e-canvas) */}
            <button
              onClick={handleTidyLayout}
              disabled={!components.length}
              className={`px-2 py-1 rounded text-xs font-medium flex items-center gap-1 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer ${
                lastTidy ? 'bg-[#0EA5E9] text-white' : 'text-[#494256] hover:text-[#221E2B] hover:bg-[#E4DEF1]'
              }`}
              title={t('dw.tidyHint')}
            >
              <WandSparkles className="w-3 h-3" />
              <span className="hidden md:inline">{lastTidy ? t('dw.tidyUndo') : t('dw.tidy')}</span>
            </button>

            {/* Grid size options */}
            <select
              value={gridSize}
              onChange={(e) => setGridSize(Number(e.target.value))}
              disabled={!snapToGrid}
              className="bg-transparent text-[11px] text-[#221E2B] px-1.5 py-0.5 outline-none cursor-pointer disabled:opacity-40"
              title={t('dw.gridResTitle')}
            >
              <option value={4} className="bg-[#F3EEFA] text-[#221E2B]">4px</option>
              <option value={8} className="bg-[#F3EEFA] text-[#221E2B]">{t('dw.grid8')}</option>
              <option value={16} className="bg-[#F3EEFA] text-[#221E2B]">16px</option>
            </select>

            {/* Toggle visual grid overlay */}
            <button
              onClick={() => setShowGridOverlay(!showGridOverlay)}
              className={`p-1 rounded text-xs transition-colors ${
                showGridOverlay ? 'text-[#0284C7]' : 'text-[#6F687E] hover:text-[#494256]'
              }`}
              title={showGridOverlay ? t('dw.hideGrid') : t('dw.showGrid')}
            >
              <LayoutGrid className="w-3 h-3" />
            </button>
          </div>

          {/* Device Mockup Selector */}
          <div className="flex items-center gap-1 bg-[#F3EEFA] border border-[#CBC3DD] rounded px-2.5 py-1 text-xs text-[#221E2B]">
            <Phone className="w-3.5 h-3.5 text-[#0284C7]" />
            <select
              value={viewerDevice}
              onChange={(e) => setViewerDevice(e.target.value as any)}
              className="bg-transparent text-xs text-[#221E2B] outline-none cursor-pointer pr-1"
            >
              <option value="s30plus_physical" className="bg-[#F3EEFA] text-[#221E2B]">{t('dw.deviceS30')}</option>
              <option value="pixel3" className="bg-[#F3EEFA] text-[#221E2B]">{t('dw.framePixel3')}</option>
              <option value="native" className="bg-[#F3EEFA] text-[#221E2B]">{t('dw.deviceNative')}</option>
            </select>
          </div>
        </div>

        {/* Right: Dimension boundary badge & Quick Actions */}
        <div className="flex items-center gap-2 text-xs">
          {/* 240x320 Highlight Badge */}
          <div 
            className="flex items-center gap-1.5 px-2.5 py-1 bg-[#F3EEFA] border border-[#047857]/50 rounded text-[11px] font-mono text-[#047857]"
            title={t('dw.resTooltip')}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#047857] animate-pulse" />
            <span>240 × 320 px</span>
          </div>

          {/* Quick copy / paste buttons */}
          {selectedComponent && (
            <div className="hidden lg:flex items-center gap-1 bg-[#F3EEFA] border border-[#CBC3DD] rounded p-0.5">
              <button
                onClick={handleCopy}
                className="p-1 hover:bg-[#E4DEF1] text-[#494256] hover:text-[#221E2B] rounded"
                title={t('dw.copyTitle')}
              >
                <Copy className="w-3 h-3 text-[#0284C7]" />
              </button>
              <button
                onClick={handlePaste}
                className="p-1 hover:bg-[#E4DEF1] text-[#494256] hover:text-[#221E2B] rounded"
                title={t('dw.pasteTitle')}
              >
                <ClipboardPaste className="w-3 h-3 text-[#047857]" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Work Area: Drawer + Canvas Viewer + Component Tree + Properties Panel */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* ========================================================
            COLUMN 1: NGĂN KÉO 'THƯ VIỆN THÀNH PHẦN' (Component Library Drawer)
            ======================================================== */}
        <aside 
          className={`bg-[#F7F3FC] border-r border-[#E4DEF1] flex flex-col shrink-0 select-none overflow-hidden transition-all duration-200 z-10 ${
            isLibraryDrawerOpen ? 'w-64 md:w-72' : 'w-0 border-r-0'
          }`}
        >
          {/* Library Drawer Header & Search */}
          <div className="p-3 border-b border-[#E4DEF1]">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xs font-bold text-[#221E2B] uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#6D28D9]" />
                <span>{t('dw.libraryTitle')}</span>
              </h2>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setIsExtModalOpen(true)}
                  className="p-1.5 rounded-lg hover:bg-[#F3EEFA] text-[#494256] hover:text-[#221E2B] transition-colors cursor-pointer"
                  title={t('dw.importExt')}
                >
                  <Puzzle className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setIsLibraryDrawerOpen(false)}
                  className="p-1 text-[#494256] hover:text-[#221E2B] hover:bg-[#F3EEFA] rounded"
                  title={t('dw.collapseDrawer')}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#494256] absolute left-2.5 top-2.5 pointer-events-none" />
              <input
                type="text"
                placeholder={t('dw.searchPalette')}
                value={paletteSearch}
                onChange={(e) => setPaletteSearch(e.target.value)}
                className="w-full bg-[#EFEAF6] border border-[#CBC3DD] rounded text-xs text-[#221E2B] pl-8 pr-2.5 py-1.5 outline-none focus:border-[#7C3AED] transition-colors placeholder:text-[#6F687E]"
              />
            </div>
          </div>

          {/* Category Accordion */}
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {PALETTE_CATEGORIES.map((cat) => {
              const filteredItems = filterPaletteItems(cat.items);
              if (filteredItems.length === 0) return null;
              const isExpanded = expandedCategories[cat.id] !== false;

              return (
                <div key={cat.id} className="border border-[#E4DEF1] rounded-lg bg-[#FDFCFF] overflow-hidden">
                  <button
                    onClick={() => setExpandedCategories(prev => ({ ...prev, [cat.id]: !isExpanded }))}
                    className="w-full px-3 py-2 text-left flex items-center justify-between text-xs font-semibold text-[#221E2B] bg-[#F0EBF8] hover:bg-[#E8E1F3] transition-colors"
                  >
                    <span>{t('dw.cat.' + cat.id, cat.title)}</span>
                    <ChevronDown className={`w-3.5 h-3.5 text-[#494256] transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  </button>

                  {isExpanded && (
                    <div className="p-1.5 space-y-1">
                      {filteredItems.map((item, idx) => {
                        const Icon = item.icon;
                        return (
                          <div
                            key={idx}
                            onPointerDown={(e) => pd.startDrag(e, { source: 'palette', item })}
                            onClick={() => handleAddComponent(item)}
                            className="w-full text-left p-2 bg-[#F7F3FC] hover:bg-[#E8E1F3] rounded-md border border-[#E4DEF1] hover:border-[#7C3AED] cursor-grab active:cursor-grabbing select-none flex items-start gap-2.5 text-xs text-[#221E2B] hover:text-[#221E2B] group transition-colors shadow-sm"
                            title={`${t('dw.paletteAdd')} ${paletteName(item)}`}
                          >
                            <div className="w-6 h-6 rounded bg-[#F3EEFA] border border-[#CBC3DD] group-hover:border-[#7C3AED] flex items-center justify-center shrink-0 mt-0.5">
                              <Icon className="w-3.5 h-3.5 text-[#494256] group-hover:text-[#6D28D9] transition-colors" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <span className="font-semibold text-[#221E2B] text-[11px] truncate">{paletteName(item)}</span>
                                <span className="text-[9px] text-[#6F687E] font-mono">{item.name}</span>
                              </div>
                              <p className="text-[10px] text-[#494256] truncate mt-0.5">{paletteDesc(item)}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Drawer Footer Tip */}
          <div className="p-2 border-t border-[#E4DEF1] bg-[#EFEAF6] text-[10px] text-[#494256] flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#047857]" />
            <span>{t('dw.dragDropHint')}</span>
          </div>
        </aside>

        {/* ========================================================
            COLUMN 2: VIEWER (Màn hình giả lập & Bàn phím vật lý S30+)
            ======================================================== */}
        <section 
          className="flex-1 bg-[#EAE4F2] relative flex flex-col items-center justify-start p-4 md:p-6 overflow-y-auto"
          onClick={() => onSelectComponent(null)}
        >
          {/* Subtle Canvas Dot Grid Background */}
          <div className="absolute inset-0 opacity-15 pointer-events-none geometric-dot-grid" />

          {/* ===================================================
              CASE A: NOKIA S30+ WITH REAL PHYSICAL KEYPAD
              =================================================== */}
          {viewerDevice === 's30plus_physical' ? (
            <div className="w-[300px] bg-gradient-to-b from-[#252831] via-[#1C1F26] to-[#14161C] border-4 border-[#374151] rounded-[44px] p-4 shadow-2xl flex flex-col items-center select-none relative z-10">
              {/* Earpiece speaker slit */}
              <div className="w-14 h-1.5 bg-[#0F1115] rounded-full mb-2 border border-[#2D2F36] shadow-inner" />

              {/* Nokia Logo */}
              <div className="text-[11px] tracking-[4px] font-black text-[#9CA3AF] font-sans mb-2.5">
                NOKIA
              </div>

              {/* Exact 240x320 Display Bezel with Boundary Indicators */}
              <div className="relative mb-3">
                {/* 240px Width Ruler Label */}
                <div className="absolute -top-4 left-0 right-0 flex items-center justify-between text-[8px] font-mono text-[#10B981] px-1">
                  <span>0px</span>
                  <span className="bg-[#0F1115] px-1 rounded border border-[#10B981]/30">{t('dw.width240')}</span>
                  <span>240px</span>
                </div>

                {/* 320px Height Ruler Label */}
                <div className="absolute top-0 bottom-0 -left-5 flex flex-col justify-between text-[8px] font-mono text-[#10B981]">
                  <span>0</span>
                  <span className="transform -rotate-90 origin-center whitespace-nowrap bg-[#0F1115] px-1 rounded border border-[#10B981]/30">320px</span>
                  <span>320</span>
                </div>

                {/* Screen Housing (Exact 240x320 display canvas) */}
                <div 
                  style={{ width: '240px', height: '320px' }}
                  className="bg-[#000000] border-2 border-[#10B981]/60 rounded-lg flex flex-col overflow-hidden shadow-inner relative"
                >
                  {/* Visual Grid Overlay on Canvas */}
                  {showGridOverlay && (
                    <div 
                      style={{ 
                        backgroundImage: `radial-gradient(#374151 1px, transparent 1px)`,
                        backgroundSize: `${gridSize}px ${gridSize}px`
                      }}
                      className="absolute inset-0 pointer-events-none opacity-40 z-10"
                    />
                  )}

                  {/* 240x320 Boundary Guideline Watermark */}
                  <div className="absolute bottom-1 right-1 text-[8px] font-mono text-[#10B981]/60 pointer-events-none z-10">
                    240×320 QVGA
                  </div>

                  {/* Phone Status Bar */}
                  {screenProperties.showStatusBar !== false && (
                    <div className="h-5 bg-[#16181D] border-b border-[#2D2F36] px-2 flex items-center justify-between text-[9px] text-[#9CA3AF] font-mono shrink-0 z-20">
                      <div className="flex items-center gap-1">
                        <span className="text-[#38BDF8] font-bold text-[8px]">▲▲▲</span>
                        <span className="text-[8px]">Viettel</span>
                      </div>
                      <span className="text-[8px]">12:00</span>
                      <span className="text-[#10B981] text-[8px] font-bold">100% ■</span>
                    </div>
                  )}

                  {/* Screen Title Bar */}
                  <div 
                    style={{ backgroundColor: screenProperties.navBarColor || '#16181D' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectComponent(null);
                    }}
                    className={`h-7 border-b border-[#2D2F36] px-2 flex items-center justify-between text-[11px] font-bold text-white shrink-0 cursor-pointer z-20 ${
                      selectedComponentId === null ? 'ring-1 ring-[#7C3AED]' : 'hover:bg-[#1E222B]'
                    }`}
                    title={t('dw.screenPropsTitle')}
                  >
                    <span className="truncate">{screenProperties.title || activeScreen}</span>
                    <span className="text-[8px] text-[#9CA3AF] font-normal font-mono">S30+</span>
                  </div>

                  {/* Canvas Body: Drop Zone */}
                  <div 
                    data-zone="screen" data-action="drop"
                    data-parent="" data-index={rootComponents.length}
                    style={{ backgroundColor: screenProperties.backgroundColor || '#0F1115' }}
                    className={`flex-1 p-2 flex flex-col gap-2 overflow-y-auto transition-colors relative z-20 ${
                      dragOverParentId === null && dragOverIndex !== null ? 'bg-[#7C3AED]/10' : ''
                    }`}
                  >
                    {rootComponents.length === 0 ? (
                      <div className="flex-1 flex flex-col items-center justify-center p-3 text-center text-[#6B7280] border border-dashed border-[#2D2F36] rounded">
                        <Sparkles className="w-6 h-6 text-[#7C3AED] mb-1 opacity-70 animate-pulse" />
                        <p className="text-[11px] font-semibold text-white mb-0.5">{t('dw.canvas240')}</p>
                        <p className="text-[9px] text-[#9CA3AF]">
                          {t('dw.dropFromLibrary')}
                        </p>
                      </div>
                    ) : (
                      rootComponents.map((comp, idx) => renderViewerComponent(comp, idx))
                    )}
                  </div>
                </div>
              </div>

              {/* Realistic Physical Keypad Area */}
              <div className="w-full space-y-2 px-1 pt-1">
                {/* Row 1: Soft Keys & 5-way D-Pad */}
                <div className="grid grid-cols-3 gap-2 items-center">
                  {/* Left Soft Key & Call Button */}
                  <div className="flex flex-col gap-1.5">
                    <button
                      onClick={() => handlePhysicalKeypadPress('SOFT_LEFT')}
                      className={`h-7 bg-[#1F242E] active:bg-[#2D3342] rounded-lg text-[10px] font-bold text-[#D1D5DB] border border-[#374151] shadow-md flex items-center justify-center transition-transform ${
                        activePressedKey === 'SOFT_LEFT' ? 'scale-95 bg-[#374151]' : ''
                      }`}
                    >
                      --- L ---
                    </button>
                    <button
                      onClick={() => handlePhysicalKeypadPress('CALL')}
                      className={`h-7 bg-emerald-800 hover:bg-emerald-700 active:bg-emerald-900 rounded-lg text-[10px] font-bold text-white border border-emerald-600 shadow-md flex items-center justify-center gap-1 transition-transform ${
                        activePressedKey === 'CALL' ? 'scale-95' : ''
                      }`}
                    >
                      <Phone className="w-3 h-3" />
                      <span>{t('dw.call')}</span>
                    </button>
                  </div>

                  {/* 5-way D-Pad (Up, Down, Left, Right, OK) */}
                  <div className="relative w-20 h-20 bg-[#0F1115] rounded-full border-2 border-[#374151] shadow-inner mx-auto flex items-center justify-center">
                    <button
                      onClick={() => handlePhysicalKeypadPress('UP')}
                      className={`absolute top-0.5 left-1/2 -translate-x-1/2 w-7 h-5 text-[9px] text-[#9CA3AF] hover:text-white flex items-center justify-center hover:bg-[#1F2937] rounded-t transition-colors ${
                        activePressedKey === 'UP' ? 'text-[#38BDF8] font-bold' : ''
                      }`}
                      title={t('dw.dpadUp')}
                    >
                      ▲
                    </button>
                    <button
                      onClick={() => handlePhysicalKeypadPress('DOWN')}
                      className={`absolute bottom-0.5 left-1/2 -translate-x-1/2 w-7 h-5 text-[9px] text-[#9CA3AF] hover:text-white flex items-center justify-center hover:bg-[#1F2937] rounded-b transition-colors ${
                        activePressedKey === 'DOWN' ? 'text-[#38BDF8] font-bold' : ''
                      }`}
                      title={t('dw.dpadDown')}
                    >
                      ▼
                    </button>
                    <button
                      onClick={() => handlePhysicalKeypadPress('LEFT')}
                      className={`absolute left-0.5 top-1/2 -translate-y-1/2 w-5 h-7 text-[9px] text-[#9CA3AF] hover:text-white flex items-center justify-center hover:bg-[#1F2937] rounded-l transition-colors ${
                        activePressedKey === 'LEFT' ? 'text-[#38BDF8] font-bold' : ''
                      }`}
                      title={t('dw.dpadLeft')}
                    >
                      ◀
                    </button>
                    <button
                      onClick={() => handlePhysicalKeypadPress('RIGHT')}
                      className={`absolute right-0.5 top-1/2 -translate-y-1/2 w-5 h-7 text-[9px] text-[#9CA3AF] hover:text-white flex items-center justify-center hover:bg-[#1F2937] rounded-r transition-colors ${
                        activePressedKey === 'RIGHT' ? 'text-[#38BDF8] font-bold' : ''
                      }`}
                      title={t('dw.dpadRight')}
                    >
                      ▶
                    </button>
                    <button
                      onClick={() => handlePhysicalKeypadPress('OK')}
                      className={`w-8 h-8 rounded-full bg-[#1F242E] active:bg-[#374151] border border-[#4B5563] text-[9px] font-bold text-white shadow flex items-center justify-center transition-transform ${
                        activePressedKey === 'OK' ? 'scale-90 bg-[#7C3AED]' : ''
                      }`}
                    >
                      OK
                    </button>
                  </div>

                  {/* Right Soft Key & End Call Button */}
                  <div className="flex flex-col gap-1.5">
                    <button
                      onClick={() => handlePhysicalKeypadPress('SOFT_RIGHT')}
                      className={`h-7 bg-[#1F242E] active:bg-[#2D3342] rounded-lg text-[10px] font-bold text-[#D1D5DB] border border-[#374151] shadow-md flex items-center justify-center transition-transform ${
                        activePressedKey === 'SOFT_RIGHT' ? 'scale-95 bg-[#374151]' : ''
                      }`}
                    >
                      --- R ---
                    </button>
                    <button
                      onClick={() => handlePhysicalKeypadPress('END_CALL')}
                      className={`h-7 bg-red-900 hover:bg-red-800 active:bg-red-950 rounded-lg text-[10px] font-bold text-white border border-red-700 shadow-md flex items-center justify-center gap-1 transition-transform ${
                        activePressedKey === 'END_CALL' ? 'scale-95' : ''
                      }`}
                    >
                      <PhoneOff className="w-3 h-3" />
                      <span>{t('dw.endCall')}</span>
                    </button>
                  </div>
                </div>

                {/* 12-Key Numeric Keypad Grid Matrix */}
                <div className="grid grid-cols-3 gap-1.5 pt-1">
                  {[
                    { num: '1', sub: '.,' },
                    { num: '2', sub: 'abc' },
                    { num: '3', sub: 'def' },
                    { num: '4', sub: 'ghi' },
                    { num: '5', sub: 'jkl' },
                    { num: '6', sub: 'mno' },
                    { num: '7', sub: 'pqrs' },
                    { num: '8', sub: 'tuv' },
                    { num: '9', sub: 'wxyz' },
                    { num: '*', sub: '+' },
                    { num: '0', sub: '␣' },
                    { num: '#', sub: '🔒' },
                  ].map((k) => (
                    <button
                      key={k.num}
                      onClick={() => handlePhysicalKeypadPress(k.num)}
                      className={`h-7 bg-gradient-to-b from-[#222631] to-[#181B22] active:from-[#374151] active:to-[#222631] rounded-lg border border-[#374151] shadow-sm flex flex-col items-center justify-center text-white transition-all cursor-pointer ${
                        activePressedKey === k.num ? 'scale-95 border-[#7C3AED] shadow-inner' : 'hover:border-[#4B5563]'
                      }`}
                    >
                      <span className="text-xs font-bold leading-tight">{k.num}</span>
                      <span className="text-[7px] text-[#9CA3AF] leading-none">{k.sub}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* ===================================================
               CASE B & C: PIXEL 3 LARGE OR NATIVE 240x320 BEZEL
               =================================================== */
            <div 
              style={{ width: `${viewerDim.width}px` }}
              className={`bg-[#16181D] border-4 border-[#2D2F36] ${viewerDim.bezelRadius} p-3 shadow-2xl relative z-10 flex flex-col transition-all`}
            >
              {/* Top Notch / Speaker */}
              <div className="h-4 w-full flex items-center justify-center relative mb-2">
                <div className="w-12 h-1 bg-[#374151] rounded-full" />
                <div className="w-2 h-2 rounded-full bg-[#1E293B] border border-[#374151] absolute right-8" />
              </div>

              {/* Phone Screen Container with 240x320 highlight */}
              <div 
                style={{ minHeight: `${viewerDim.height}px` }}
                className="w-full bg-[#000000] border border-[#10B981]/50 rounded-xl flex flex-col overflow-hidden shadow-inner relative"
              >
                {/* Visual Grid Overlay */}
                {showGridOverlay && (
                  <div 
                    style={{ 
                      backgroundImage: `radial-gradient(#374151 1px, transparent 1px)`,
                      backgroundSize: `${gridSize}px ${gridSize}px`
                    }}
                    className="absolute inset-0 pointer-events-none opacity-40 z-10"
                  />
                )}

                {/* Status Bar */}
                {screenProperties.showStatusBar !== false && (
                  <div className="h-5 bg-[#16181D] border-b border-[#2D2F36] px-3 flex items-center justify-between text-[10px] text-[#9CA3AF] font-mono shrink-0 z-20">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[#38BDF8] font-bold text-[9px]">▲▲▲</span>
                      <span>Viettel</span>
                    </div>
                    <span>12:00</span>
                    <span className="text-[#10B981] text-[9px]">100% ■</span>
                  </div>
                )}

                {/* Screen Title Bar */}
                <div 
                  style={{ backgroundColor: screenProperties.navBarColor || '#16181D' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectComponent(null);
                  }}
                  className={`h-8 border-b border-[#2D2F36] px-3 flex items-center justify-between text-xs font-bold text-white shrink-0 cursor-pointer z-20 ${
                    selectedComponentId === null ? 'ring-1 ring-[#7C3AED]' : 'hover:bg-[#1E222B]'
                  }`}
                >
                  <span>{screenProperties.title || activeScreen}</span>
                  <span className="text-[10px] text-[#10B981] font-mono">240x320</span>
                </div>

                {/* Screen Content Body */}
                <div 
                  data-zone="screen" data-action="drop"
                  data-parent="" data-index={rootComponents.length}
                  style={{ backgroundColor: screenProperties.backgroundColor || '#0F1115' }}
                  className={`flex-1 p-3 flex flex-col gap-2.5 overflow-y-auto transition-colors relative z-20 min-h-[360px] ${
                    dragOverParentId === null && dragOverIndex !== null ? 'bg-[#7C3AED]/5' : ''
                  }`}
                >
                  {rootComponents.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-[#6B7280] border-2 border-dashed border-[#2D2F36] rounded-lg">
                      <Sparkles className="w-8 h-8 text-[#7C3AED] mb-2 opacity-60 animate-pulse" />
                      <p className="text-xs font-semibold text-white mb-1">{t('dw.emptyScreen')}</p>
                      <p className="text-[11px] text-[#9CA3AF] max-w-[200px]">
                        {t('dw.emptyScreenDesc')}
                      </p>
                    </div>
                  ) : (
                    rootComponents.map((comp, idx) => renderViewerComponent(comp, idx))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Non-Visible Components Shelf */}
          {nonVisibleComponents.length > 0 && (
            <div className="mt-4 bg-[#F7F3FC] border border-[#E4DEF1] rounded-lg p-2.5 flex items-center gap-2 max-w-[340px] overflow-x-auto shadow-md relative z-10">
              <span className="text-[10px] text-[#6F687E] uppercase font-bold tracking-wider mr-1 shrink-0">
                Non-visible:
              </span>
              {nonVisibleComponents.map((comp) => {
                const isSelected = selectedComponentId === comp.id;
                return (
                  <button
                    key={comp.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectComponent(comp.id);
                    }}
                    className={`px-2 py-1 rounded text-xs flex items-center gap-1.5 border transition-colors shrink-0 ${
                      isSelected 
                        ? 'bg-[#7C3AED] text-white border-[#7C3AED]' 
                        : 'bg-[#F3EEFA] text-[#221E2B] border-[#CBC3DD] hover:border-[#7C3AED]'
                    }`}
                  >
                    <Clock className="w-3 h-3 text-[#B45309]" />
                    <span className="truncate max-w-[90px]">{comp.name}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Floating Toast Notification */}
          {toastMessage && (
            <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-[#F3EEFA]/95 border border-[#7C3AED] text-[#221E2B] text-xs px-4 py-2 rounded-lg shadow-xl flex items-center gap-2 z-50 animate-fade-in backdrop-blur-sm">
              <Check className="w-3.5 h-3.5 text-[#047857]" />
              <span>{toastMessage}</span>
            </div>
          )}
        </section>

        {/* ========================================================
            COLUMN 3: ALL COMPONENTS (Cây phân cấp thành phần)
            ======================================================== */}
        <aside className="w-52 md:w-60 bg-[#F7F3FC] border-l border-[#E4DEF1] flex flex-col shrink-0 select-none overflow-hidden">
          {/* Header */}
          <div className="p-3 border-b border-[#E4DEF1] flex items-center justify-between">
            <h2 className="text-xs font-bold text-[#221E2B] uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-[#0284C7]" />
              <span>All Components</span>
            </h2>
            <span className="text-[10px] text-[#494256] font-mono bg-[#F3EEFA] px-1.5 py-0.5 rounded">
              {components.length}
            </span>
          </div>

          {/* Component Hierarchy Tree */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {/* Root Screen Node */}
            <div
              onClick={() => onSelectComponent(null)}
              className={`px-2.5 py-1.5 rounded text-xs flex items-center gap-2 cursor-pointer transition-colors ${
                selectedComponentId === null ? 'bg-[#7C3AED] text-white font-semibold' : 'text-[#221E2B] hover:bg-[#F0EBF8]'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5 text-[#0284C7]" />
              <span className="font-semibold">{activeScreen}</span>
            </div>

            {/* Tree Items */}
            {components.map((comp) => {
              const isSelected = selectedComponentId === comp.id;
              const isChild = !!comp.parentId;
              return (
                <div
                  key={comp.id}
                  onClick={() => onSelectComponent(comp.id)}
                  className={`px-2.5 py-1.5 rounded text-xs flex items-center justify-between cursor-pointer transition-colors ${
                    isChild ? 'ml-4' : 'ml-1'
                  } ${
                    isSelected ? 'bg-[#7C3AED] text-white font-medium' : 'text-[#221E2B] hover:bg-[#F0EBF8]'
                  }`}
                >
                  <div className="flex items-center gap-1.5 truncate">
                    <ChevronRight className="w-3 h-3 text-[#6F687E] shrink-0" />
                    <span className="truncate">{comp.name}</span>
                  </div>
                  <span className="text-[9px] opacity-60 font-mono shrink-0">
                    {comp.type}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Bottom Actions: Rename and Delete */}
          <div className="p-2 border-t border-[#E4DEF1] grid grid-cols-2 gap-2 bg-[#FDFCFF]">
            <button
              disabled={!selectedComponent}
              onClick={() => {
                if (selectedComponent) {
                  setRenameInput(selectedComponent.name);
                  setIsRenaming(true);
                }
              }}
              className="px-2 py-1.5 bg-[#F3EEFA] hover:bg-[#E4DEF1] disabled:opacity-40 disabled:cursor-not-allowed text-xs text-[#221E2B] rounded border border-[#CBC3DD] flex items-center justify-center gap-1 transition-colors"
            >
              <Edit3 className="w-3.5 h-3.5 text-[#0284C7]" />
              <span>{t('common.rename')}</span>
            </button>

            <button
              disabled={!selectedComponent}
              onClick={async () => {
                if (selectedComponent && await confirmDialog({ title: t('common.delete'), message: t('dw.deleteCompConfirm').replace('{name}', selectedComponent.name), danger: true })) {
                  handleDeleteComponent(selectedComponent.id);
                }
              }}
              className="px-2 py-1.5 bg-[#F3EEFA] hover:bg-red-950/40 hover:border-red-800 disabled:opacity-40 disabled:cursor-not-allowed text-xs text-red-600 rounded border border-[#CBC3DD] flex items-center justify-center gap-1 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{t('common.delete')}</span>
            </button>
          </div>
        </aside>

        {/* ========================================================
            COLUMN 4: BẢNG THUỘC TÍNH (Properties Side Panel)
            ======================================================== */}
        <aside className="w-64 md:w-72 bg-[#F7F3FC] border-l border-[#E4DEF1] flex flex-col shrink-0 select-none overflow-hidden">
          {/* Header */}
          <div className="p-3 border-b border-[#E4DEF1]">
            <h2 className="text-xs font-bold text-[#221E2B] uppercase tracking-wider flex items-center justify-between">
              <span className="truncate">
                {t('dw.propsOf').replace('{name}', selectedComponent ? selectedComponent.name : activeScreen)}
              </span>
              {selectedComponent && (
                <span className="text-[9px] bg-[#7C3AED]/20 text-[#6D28D9] px-1.5 py-0.5 rounded font-mono">
                  {selectedComponent.type}
                </span>
              )}
            </h2>
            <span className="text-[10px] text-[#494256] block mt-0.5">
              {selectedComponent ? t('dw.editProps') : t('dw.screenConfig')}
            </span>
          </div>

          {/* Properties Content Area */}
          <div className="flex-1 overflow-y-auto p-3 space-y-4 text-xs">
            {/* Case A: Screen Properties (When no specific component is selected) */}
            {!selectedComponent && (
              <div className="space-y-3.5">
                <div>
                  <label className="block text-[10px] text-[#494256] mb-1">{t('dw.aboutScreen')}</label>
                  <textarea
                    value={screenProperties.aboutScreen || ''}
                    onChange={(e) => onUpdateScreenProps({ aboutScreen: e.target.value })}
                    rows={2}
                    className="w-full bg-[#EFEAF6] border border-[#CBC3DD] text-xs text-[#221E2B] rounded p-2 outline-none focus:border-[#7C3AED]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-[#494256] mb-1">{t('dw.screenBgLabel')}</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={screenProperties.backgroundColor || '#0F1115'}
                      onChange={(e) => onUpdateScreenProps({ backgroundColor: e.target.value })}
                      className="w-7 h-7 rounded border border-[#CBC3DD] cursor-pointer bg-transparent"
                    />
                    <span className="font-mono text-xs text-[#221E2B]">{screenProperties.backgroundColor || '#EFEAF6'}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] text-[#494256] mb-1">{t('dw.screenTitleLabel')}</label>
                  <input
                    type="text"
                    value={screenProperties.title || activeScreen}
                    onChange={(e) => onUpdateScreenProps({ title: e.target.value })}
                    className="w-full bg-[#EFEAF6] border border-[#CBC3DD] text-xs text-[#221E2B] rounded px-2.5 py-1.5 outline-none focus:border-[#7C3AED]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-[#494256] mb-1">{t('dw.navColorLabel')}</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={screenProperties.navBarColor || '#16181D'}
                      onChange={(e) => onUpdateScreenProps({ navBarColor: e.target.value })}
                      className="w-7 h-7 rounded border border-[#CBC3DD] cursor-pointer bg-transparent"
                    />
                    <span className="font-mono text-xs text-[#221E2B]">{screenProperties.navBarColor || '#F7F3FC'}</span>
                  </div>
                </div>

                {/* S30+ Standard Palette for Screen */}
                <div className="space-y-1.5 pt-1 border-t border-[#E4DEF1]">
                  <div className="flex items-center gap-1 bg-[#EFEAF6] p-0.5 rounded border border-[#E4DEF1]">
                    <button
                      type="button"
                      onClick={() => setScreenColorTarget('backgroundColor')}
                      className={`flex-1 py-0.5 text-center rounded text-[9px] font-semibold transition-colors ${
                        screenColorTarget === 'backgroundColor' ? 'bg-[#7C3AED] text-white' : 'text-[#494256]'
                      }`}
                    >
                      Màu nền màn hình
                    </button>
                    <button
                      type="button"
                      onClick={() => setScreenColorTarget('navBarColor')}
                      className={`flex-1 py-0.5 text-center rounded text-[9px] font-semibold transition-colors ${
                        screenColorTarget === 'navBarColor' ? 'bg-[#7C3AED] text-white' : 'text-[#494256]'
                      }`}
                    >
                      Màu thanh điều hướng
                    </button>
                  </div>
                  <S30PlusColorPalette
                    currentColor={screenColorTarget === 'backgroundColor' ? screenProperties.backgroundColor || '#EFEAF6' : screenProperties.navBarColor || '#F7F3FC'}
                    onSelectColor={(hex) => {
                      onUpdateScreenProps({ [screenColorTarget]: hex });
                      debugLogger.info('Designer', `Áp dụng màu chuẩn S30+ (${hex}) cho ${screenColorTarget}`);
                    }}
                    label={t('dw.stdPalette')}
                  />
                </div>

                <div className="pt-2 border-t border-[#E4DEF1] space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={screenProperties.scrollable !== false}
                      onChange={(e) => onUpdateScreenProps({ scrollable: e.target.checked })}
                      className="accent-[#7C3AED]"
                    />
                    <span>{t('dw.scrollable')}</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={screenProperties.showStatusBar !== false}
                      onChange={(e) => onUpdateScreenProps({ showStatusBar: e.target.checked })}
                      className="accent-[#7C3AED]"
                    />
                    <span>{t('dw.statusBar')}</span>
                  </label>
                </div>
              </div>
            )}

            {/* Case B: Component Specific Properties */}
            {selectedComponent && (
              <div className="space-y-4">
                {/* 1. VỊ TRÍ X, Y VÀ CĂN CHỈNH LƯỚI */}
                <div className="bg-[#FDFCFF] border border-[#E4DEF1] rounded-lg p-2.5 space-y-2">
                  <div className="flex items-center justify-between text-[10px] text-[#494256] font-bold uppercase tracking-wider">
                    <span>{t('dw.coordinates')}</span>
                    <button
                      onClick={handleSnapSelectedToGrid}
                      className="text-[9px] text-[#0284C7] hover:underline flex items-center gap-0.5 lowercase"
                      title={t('dw.snapCoords')}
                    >
                      <Grid className="w-2.5 h-2.5" />
                      <span>{t('dw.snapShort')}</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[9px] text-[#494256] mb-1 font-mono">{t('dw.coordX')}</label>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          value={selectedComponent.x ?? 0}
                          onChange={(e) => handleUpdateGeometry('x', Number(e.target.value))}
                          className="w-full bg-[#EFEAF6] border border-[#CBC3DD] text-xs text-[#221E2B] rounded px-2 py-1 outline-none focus:border-[#7C3AED] font-mono"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[9px] text-[#494256] mb-1 font-mono">{t('dw.coordY')}</label>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          value={selectedComponent.y ?? 0}
                          onChange={(e) => handleUpdateGeometry('y', Number(e.target.value))}
                          className="w-full bg-[#EFEAF6] border border-[#CBC3DD] text-xs text-[#221E2B] rounded px-2 py-1 outline-none focus:border-[#7C3AED] font-mono"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Nudge buttons for precision placement */}
                  <div className="flex items-center justify-between pt-1 border-t border-[#E4DEF1] text-[10px]">
                    <span className="text-[#6F687E]">{t('dw.nudge')} ({gridSize}px):</span>
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={() => handleNudge(-1, 0)}
                        className="w-5 h-5 bg-[#EFEAF6] hover:bg-[#E4DEF1] rounded border border-[#CBC3DD] flex items-center justify-center text-[#494256] hover:text-[#221E2B]"
                        title={t('dw.nudgeL')}
                      >
                        ◀
                      </button>
                      <button 
                        onClick={() => handleNudge(1, 0)}
                        className="w-5 h-5 bg-[#EFEAF6] hover:bg-[#E4DEF1] rounded border border-[#CBC3DD] flex items-center justify-center text-[#494256] hover:text-[#221E2B]"
                        title={t('dw.nudgeR')}
                      >
                        ▶
                      </button>
                      <button 
                        onClick={() => handleNudge(0, -1)}
                        className="w-5 h-5 bg-[#EFEAF6] hover:bg-[#E4DEF1] rounded border border-[#CBC3DD] flex items-center justify-center text-[#494256] hover:text-[#221E2B]"
                        title={t('dw.nudgeU')}
                      >
                        ▲
                      </button>
                      <button 
                        onClick={() => handleNudge(0, 1)}
                        className="w-5 h-5 bg-[#EFEAF6] hover:bg-[#E4DEF1] rounded border border-[#CBC3DD] flex items-center justify-center text-[#494256] hover:text-[#221E2B]"
                        title={t('dw.nudgeD')}
                      >
                        ▼
                      </button>
                    </div>
                  </div>

                  {/* CĂN CHỈNH NHANH (QUICK ALIGN BUTTONS: Left, Center, Right, Top, Bottom) */}
                  <div className="pt-2 border-t border-[#E4DEF1] space-y-1.5">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="font-bold text-[#221E2B] flex items-center gap-1">
                        <span>{t('dw.quickAlign')}</span>
                      </span>
                      <span className="text-[9px] text-[#0284C7] font-mono">240x320</span>
                    </div>

                    {/* Button group for 5 primary alignment actions */}
                    <div className="grid grid-cols-5 gap-1 bg-[#EFEAF6] p-1 rounded border border-[#E4DEF1]">
                      <button
                        type="button"
                        onClick={() => handleQuickAlign('left')}
                        className="py-1 px-1 bg-[#FDFCFF] hover:bg-[#7C3AED] text-[#221E2B] hover:text-white rounded border border-[#CBC3DD] hover:border-[#7C3AED] flex flex-col items-center justify-center gap-1 transition-all active:scale-95"
                        title={t('dw.alLTitle')}
                      >
                        <AlignLeft className="w-3.5 h-3.5" />
                        <span className="text-[8px] font-medium leading-none">{t('dw.shortLeft')}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleQuickAlign('center')}
                        className="py-1 px-1 bg-[#FDFCFF] hover:bg-[#7C3AED] text-[#221E2B] hover:text-white rounded border border-[#CBC3DD] hover:border-[#7C3AED] flex flex-col items-center justify-center gap-1 transition-all active:scale-95"
                        title={t('dw.alCTitle')}
                      >
                        <AlignCenter className="w-3.5 h-3.5" />
                        <span className="text-[8px] font-medium leading-none">{t('dw.shortCenter')}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleQuickAlign('right')}
                        className="py-1 px-1 bg-[#FDFCFF] hover:bg-[#7C3AED] text-[#221E2B] hover:text-white rounded border border-[#CBC3DD] hover:border-[#7C3AED] flex flex-col items-center justify-center gap-1 transition-all active:scale-95"
                        title={t('dw.alRTitle')}
                      >
                        <AlignRight className="w-3.5 h-3.5" />
                        <span className="text-[8px] font-medium leading-none">{t('dw.shortRight')}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleQuickAlign('top')}
                        className="py-1 px-1 bg-[#FDFCFF] hover:bg-[#7C3AED] text-[#221E2B] hover:text-white rounded border border-[#CBC3DD] hover:border-[#7C3AED] flex flex-col items-center justify-center gap-1 transition-all active:scale-95"
                        title={t('dw.alTTitle')}
                      >
                        <ArrowUpToLine className="w-3.5 h-3.5" />
                        <span className="text-[8px] font-medium leading-none">{t('dw.shortTop')}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleQuickAlign('bottom')}
                        className="py-1 px-1 bg-[#FDFCFF] hover:bg-[#7C3AED] text-[#221E2B] hover:text-white rounded border border-[#CBC3DD] hover:border-[#7C3AED] flex flex-col items-center justify-center gap-1 transition-all active:scale-95"
                        title={t('dw.alBTitle')}
                      >
                        <ArrowDownToLine className="w-3.5 h-3.5" />
                        <span className="text-[8px] font-medium leading-none">{t('dw.shortBottom')}</span>
                      </button>
                    </div>

                    {/* Secondary align actions: Middle and Center All */}
                    <div className="flex items-center justify-between text-[9px] px-1 pt-0.5">
                      <button
                        type="button"
                        onClick={() => handleQuickAlign('middle')}
                        className="text-[#0284C7] hover:text-[#221E2B] hover:underline flex items-center gap-1 transition-colors"
                        title={t('dw.middleVTitle')}
                      >
                        <AlignVerticalJustifyCenter className="w-3 h-3" />
                        <span>{t('dw.middleV')}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          handleQuickAlign('center');
                          handleQuickAlign('middle');
                        }}
                        className="text-[#6D28D9] hover:text-[#221E2B] hover:underline font-semibold transition-colors"
                        title={t('dw.centerTitle')}
                      >
                        {t('dw.centerScreen')}
                      </button>
                    </div>
                  </div>
                </div>

                {/* 2. KÍCH THƯỚC (WIDTH & HEIGHT) */}
                <div className="space-y-3">
                  {/* Width: Automatic / Fill Parent / Pixels */}
                  <div>
                    <label className="block text-[10px] text-[#494256] mb-1">{t('dw.widthLabel')}</label>
                    <div className="grid grid-cols-3 gap-1">
                      <button
                        onClick={() => handleUpdateGeometry('width', 'auto')}
                        className={`py-1 text-[11px] rounded border transition-colors ${
                          selectedComponent.width === 'auto' ? 'bg-[#7C3AED] text-white border-[#7C3AED]' : 'bg-[#EFEAF6] border-[#CBC3DD] text-[#494256]'
                        }`}
                      >
                        {t('dw.auto')}
                      </button>
                      <button
                        onClick={() => handleUpdateGeometry('width', 'fill')}
                        className={`py-1 text-[11px] rounded border transition-colors ${
                          selectedComponent.width === 'fill' ? 'bg-[#7C3AED] text-white border-[#7C3AED]' : 'bg-[#EFEAF6] border-[#CBC3DD] text-[#494256]'
                        }`}
                      >
                        {t('dw.fillParent')}
                      </button>
                      <input
                        type="number"
                        placeholder="Pixels"
                        value={typeof selectedComponent.width === 'number' ? selectedComponent.width : ''}
                        onChange={(e) => handleUpdateGeometry('width', Number(e.target.value))}
                        className="bg-[#EFEAF6] border border-[#CBC3DD] text-xs text-[#221E2B] rounded px-2 py-1 text-center outline-none focus:border-[#7C3AED]"
                      />
                    </div>
                  </div>

                  {/* Height: Automatic / Fill Parent / Pixels */}
                  <div>
                    <label className="block text-[10px] text-[#494256] mb-1">{t('dw.heightLabel')}</label>
                    <div className="grid grid-cols-3 gap-1">
                      <button
                        onClick={() => handleUpdateGeometry('height', 'auto')}
                        className={`py-1 text-[11px] rounded border transition-colors ${
                          selectedComponent.height === 'auto' ? 'bg-[#7C3AED] text-white border-[#7C3AED]' : 'bg-[#EFEAF6] border-[#CBC3DD] text-[#494256]'
                        }`}
                      >
                        {t('dw.auto')}
                      </button>
                      <button
                        onClick={() => handleUpdateGeometry('height', 'fill')}
                        className={`py-1 text-[11px] rounded border transition-colors ${
                          selectedComponent.height === 'fill' ? 'bg-[#7C3AED] text-white border-[#7C3AED]' : 'bg-[#EFEAF6] border-[#CBC3DD] text-[#494256]'
                        }`}
                      >
                        {t('dw.fillParent')}
                      </button>
                      <input
                        type="number"
                        placeholder="Pixels"
                        value={typeof selectedComponent.height === 'number' ? selectedComponent.height : ''}
                        onChange={(e) => handleUpdateGeometry('height', Number(e.target.value))}
                        className="bg-[#EFEAF6] border border-[#CBC3DD] text-xs text-[#221E2B] rounded px-2 py-1 text-center outline-none focus:border-[#7C3AED]"
                      />
                    </div>
                  </div>
                </div>

                {/* 3. VĂN BẢN (NẾU CÓ) */}
                {'text' in selectedComponent.properties && (
                  <div>
                    <label className="block text-[10px] text-[#494256] mb-1">{t('dw.textLabel')}</label>
                    <input
                      type="text"
                      value={selectedComponent.properties.text || ''}
                      onChange={(e) => handleUpdateProperty('text', e.target.value)}
                      className="w-full bg-[#EFEAF6] border border-[#CBC3DD] text-xs text-[#221E2B] rounded px-2.5 py-1.5 outline-none focus:border-[#7C3AED]"
                    />
                  </div>
                )}

                {/* 4. MÀU SẮC (BACKGROUND & TEXT COLOR) */}
                <div className="space-y-3 bg-[#FDFCFF] border border-[#E4DEF1] rounded-lg p-2.5">
                  <div className="flex items-center justify-between text-[10px] text-[#494256] font-bold uppercase tracking-wider">
                    <span>{t('dw.colors')}</span>
                    <span className="text-[9px] text-[#0284C7] flex items-center gap-1 font-normal lowercase">
                      <Palette className="w-2.5 h-2.5" />
                      <span>{t('dw.stdS30')}</span>
                    </span>
                  </div>

                  {/* Target Selector Toggle if textColor exists */}
                  {'textColor' in selectedComponent.properties && (
                    <div className="flex items-center gap-1 bg-[#EFEAF6] p-1 rounded border border-[#E4DEF1]">
                      <button
                        type="button"
                        onClick={() => setColorTarget('backgroundColor')}
                        className={`flex-1 py-1 text-center rounded text-[10px] font-semibold transition-colors flex items-center justify-center gap-1.5 ${
                          colorTarget === 'backgroundColor'
                            ? 'bg-[#7C3AED] text-white shadow-sm'
                            : 'text-[#494256] hover:text-[#221E2B]'
                        }`}
                      >
                        <span 
                          className="w-2.5 h-2.5 rounded-full border border-white/40 inline-block shrink-0"
                          style={{ backgroundColor: selectedComponent.properties.backgroundColor || '#3B82F6' }}
                        />
                        <span>{t('dw.bgColor')}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setColorTarget('textColor')}
                        className={`flex-1 py-1 text-center rounded text-[10px] font-semibold transition-colors flex items-center justify-center gap-1.5 ${
                          colorTarget === 'textColor'
                            ? 'bg-[#7C3AED] text-white shadow-sm'
                            : 'text-[#494256] hover:text-[#221E2B]'
                        }`}
                      >
                        <span 
                          className="w-2.5 h-2.5 rounded-full border border-white/40 inline-block shrink-0"
                          style={{ backgroundColor: selectedComponent.properties.textColor || '#ffffff' }}
                        />
                        <span>{t('dw.fgColor')}</span>
                      </button>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[9px] text-[#494256] mb-1">{t('dw.customBg')}</label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="color"
                          value={selectedComponent.properties.backgroundColor || '#3B82F6'}
                          onChange={(e) => handleUpdateProperty('backgroundColor', e.target.value)}
                          className="w-7 h-7 rounded border border-[#CBC3DD] cursor-pointer bg-transparent shrink-0"
                        />
                        <span className="font-mono text-[11px] text-[#221E2B] truncate">
                          {selectedComponent.properties.backgroundColor || '#3B82F6'}
                        </span>
                      </div>
                    </div>

                    {'textColor' in selectedComponent.properties && (
                      <div>
                        <label className="block text-[9px] text-[#494256] mb-1">{t('dw.customFg')}</label>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="color"
                            value={selectedComponent.properties.textColor || '#ffffff'}
                            onChange={(e) => handleUpdateProperty('textColor', e.target.value)}
                            className="w-7 h-7 rounded border border-[#CBC3DD] cursor-pointer bg-transparent shrink-0"
                          />
                          <span className="font-mono text-[11px] text-[#221E2B] truncate">
                            {selectedComponent.properties.textColor || '#ffffff'}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* S30+ Standard Color Palette */}
                  <S30PlusColorPalette
                    currentColor={
                      colorTarget === 'textColor' && 'textColor' in selectedComponent.properties
                        ? selectedComponent.properties.textColor || '#ffffff'
                        : selectedComponent.properties.backgroundColor || '#3B82F6'
                    }
                    onSelectColor={(hex) => {
                      const propName = (colorTarget === 'textColor' && 'textColor' in selectedComponent.properties)
                        ? 'textColor'
                        : 'backgroundColor';
                      handleUpdateProperty(propName, hex);
                      debugLogger.info('Designer', `Áp dụng màu S30+ (${hex}) cho ${propName} của "${selectedComponent.name}"`);
                    }}
                    label={`${t('dw.stdPaletteS30')} (${colorTarget === 'textColor' && 'textColor' in selectedComponent.properties ? t('dw.fgColor') : t('dw.bgColor')})`}
                  />
                </div>

                {/* 5. PHÔNG CHỮ VÀ CĂN LỀ */}
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] text-[#494256] mb-1">{t('dw.fontSizeLabel')}</label>
                      <input
                        type="number"
                        value={selectedComponent.properties.fontSize || 14}
                        onChange={(e) => handleUpdateProperty('fontSize', Number(e.target.value))}
                        className="w-full bg-[#EFEAF6] border border-[#CBC3DD] text-xs text-[#221E2B] rounded px-2 py-1 outline-none focus:border-[#7C3AED]"
                      />
                    </div>

                    {'textAlignment' in selectedComponent.properties && (
                      <div>
                        <label className="block text-[10px] text-[#494256] mb-1">{t('dw.alignLabel')}</label>
                        <select
                          value={selectedComponent.properties.textAlignment || 'left'}
                          onChange={(e) => handleUpdateProperty('textAlignment', e.target.value)}
                          className="w-full bg-[#EFEAF6] border border-[#CBC3DD] text-xs text-[#221E2B] rounded px-2 py-1 outline-none focus:border-[#7C3AED]"
                        >
                          <option value="left" className="bg-[#F3EEFA]">{t('dw.shortLeft')}</option>
                          <option value="center" className="bg-[#F3EEFA]">{t('dw.shortCenter')}</option>
                          <option value="right" className="bg-[#F3EEFA]">{t('dw.shortRight')}</option>
                        </select>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedComponent.properties.fontBold || false}
                        onChange={(e) => handleUpdateProperty('fontBold', e.target.checked)}
                        className="accent-[#7C3AED]"
                      />
                      <span className="font-bold">{t('dw.bold')}</span>
                    </label>

                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedComponent.properties.fontItalic || false}
                        onChange={(e) => handleUpdateProperty('fontItalic', e.target.checked)}
                        className="accent-[#7C3AED]"
                      />
                      <span className="italic">{t('dw.italic')}</span>
                    </label>
                  </div>
                </div>

                {/* 6. TRẠNG THÁI (VISIBLE & ENABLED) */}
                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[#E4DEF1]">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedComponent.properties.visible !== false}
                      onChange={(e) => handleUpdateProperty('visible', e.target.checked)}
                      className="accent-[#7C3AED]"
                    />
                    <span>{t('dw.visible')}</span>
                  </label>

                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedComponent.properties.enabled !== false}
                      onChange={(e) => handleUpdateProperty('enabled', e.target.checked)}
                      className="accent-[#7C3AED]"
                    />
                    <span>{t('dw.enabled')}</span>
                  </label>
                </div>

                {/* 7. THUỘC TÍNH RIÊNG BIỆT TỪNG LINH KIỆN */}
                {/* Image Picture Selector */}
                {(selectedComponent.type === 'Image' || selectedComponent.type === 'Sprite') && (
                  <div>
                    <label className="block text-[10px] text-[#494256] mb-1">{t('dw.pictureLabel')}</label>
                    <select
                      value={selectedComponent.properties.picture || 'logo.png'}
                      onChange={(e) => handleUpdateProperty('picture', e.target.value)}
                      className="w-full bg-[#EFEAF6] border border-[#CBC3DD] text-xs text-[#221E2B] rounded px-2.5 py-1.5 outline-none focus:border-[#7C3AED]"
                    >
                      <option value="logo.png">{t('dw.logoDefault')}</option>
                      <option value="player_sprite.png">player_sprite.png</option>
                      <option value="icon.png">icon.png</option>
                      <option value="background.png">background.png</option>
                      {assets.filter(a => a.type === 'image').map(a => (
                        <option key={a.id} value={a.name}>
                          {a.name} ({a.width}x{a.height}) — assets/
                        </option>
                      ))}
                    </select>
                    {assets.filter(a => a.type === 'image').length === 0 && (
                      <p className="text-[9px] text-[#A79EBD] mt-1 leading-snug">
                        {t('dw.noAssets')}
                      </p>
                    )}
                    {(() => {
                      const sel = assets.find(a => a.type === 'image' && a.name === (selectedComponent.properties.picture || ''));
                      if (!sel) return null;
                      return (
                        <img src={sel.data} alt={sel.name} className="mt-2 pixelated border border-[#CBC3DD] rounded" style={{ width: 96, height: 'auto' }} />
                      );
                    })()}
                  </div>
                )}

                {/* CheckBox checked */}
                {selectedComponent.type === 'CheckBox' && (
                  <div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedComponent.properties.checked !== false}
                        onChange={(e) => handleUpdateProperty('checked', e.target.checked)}
                        className="accent-[#7C3AED]"
                      />
                      <span>{t('dw.checked')}</span>
                    </label>
                  </div>
                )}

                {/* Slider / ProgressBar value */}
                {('value' in selectedComponent.properties) && (
                  <div>
                    <label className="block text-[10px] text-[#494256] mb-1">
                      {t('dw.value')} ({selectedComponent.properties.value || 50}%):
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={selectedComponent.properties.value || 50}
                      onChange={(e) => handleUpdateProperty('value', Number(e.target.value))}
                      className="w-full accent-[#7C3AED]"
                    />
                  </div>
                )}

                {/* Timer Interval */}
                {selectedComponent.type === 'Timer' && (
                  <div>
                    <label className="block text-[10px] text-[#494256] mb-1">{t('dw.intervalLabel')}</label>
                    <input
                      type="number"
                      value={selectedComponent.properties.interval || 100}
                      onChange={(e) => handleUpdateProperty('interval', Number(e.target.value))}
                      className="w-full bg-[#EFEAF6] border border-[#CBC3DD] text-xs text-[#221E2B] rounded px-2.5 py-1.5 outline-none focus:border-[#7C3AED]"
                    />
                  </div>
                )}

                {/* Quick actions for selected component */}
                <div className="pt-2 border-t border-[#E4DEF1] flex items-center gap-2">
                  <button
                    onClick={() => handleDuplicateComponent(selectedComponent)}
                    className="flex-1 py-1.5 bg-[#F3EEFA] hover:bg-[#E4DEF1] text-[#221E2B] rounded border border-[#CBC3DD] text-xs font-medium flex items-center justify-center gap-1"
                    title={t('dw.dupeTitle')}
                  >
                    <Copy className="w-3.5 h-3.5 text-[#0284C7]" />
                    <span>{t('dw.dupe')}</span>
                  </button>
                  <button
                    onClick={() => handleDeleteComponent(selectedComponent.id)}
                    className="py-1.5 px-3 bg-[#F3EEFA] hover:bg-red-950/40 text-red-600 rounded border border-[#CBC3DD] hover:border-red-800 text-xs font-medium flex items-center justify-center gap-1"
                    title={t('dw.deleteTitle')}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{t('common.delete')}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Bottom Keyboard Shortcuts Helper Bar */}
      <div className="h-7 bg-[#EFEAF6] border-t border-[#E4DEF1] px-3 flex items-center justify-between text-[10px] text-[#494256] shrink-0 font-mono">
        <div className="flex items-center gap-3 overflow-x-auto">
          <span className="text-[#6F687E]">{t('dw.shortcuts')}</span>
          <span><kbd className="bg-[#F3EEFA] px-1 rounded text-[#221E2B] border border-[#CBC3DD]">Ctrl+C</kbd> {t('dw.copy')}</span>
          <span><kbd className="bg-[#F3EEFA] px-1 rounded text-[#221E2B] border border-[#CBC3DD]">Ctrl+V</kbd> {t('dw.paste')}</span>
          <span><kbd className="bg-[#F3EEFA] px-1 rounded text-[#221E2B] border border-[#CBC3DD]">Ctrl+D</kbd> {t('dw.dupe')}</span>
          <span><kbd className="bg-[#F3EEFA] px-1 rounded text-[#221E2B] border border-[#CBC3DD]">Del</kbd> {t('common.delete')}</span>
          <span><kbd className="bg-[#F3EEFA] px-1 rounded text-[#221E2B] border border-[#CBC3DD]">Mũi tên</kbd> {t('dw.arrowAlign')} ({gridSize}px)</span>
          <span><kbd className="bg-[#F3EEFA] px-1 rounded text-[#221E2B] border border-[#CBC3DD]">Esc</kbd> {t('dw.deselect')}</span>
        </div>
        <div className="hidden sm:flex items-center gap-1.5 text-[#047857]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#047857]" />
          <span>S30+ QVGA (240x320)</span>
        </div>
      </div>

      {/* Rename Component Modal Dialog */}
      {isRenaming && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#F7F3FC] border border-[#E4DEF1] rounded-xl w-full max-w-sm p-5 shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-[#221E2B] flex items-center gap-2">
              <Edit3 className="w-4 h-4 text-[#0284C7]" />
              <span>{t('dw.renameCompTitle')}</span>
            </h3>
            <p className="text-xs text-[#494256]">
              {t('dw.renameCompDesc')}
            </p>
            <input
              type="text"
              value={renameInput}
              onChange={(e) => setRenameInput(e.target.value)}
              autoFocus
              className="w-full bg-[#EFEAF6] border border-[#CBC3DD] text-sm text-[#221E2B] rounded px-3 py-2 outline-none focus:border-[#7C3AED]"
            />
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setIsRenaming(false)}
                className="px-3 py-1.5 text-xs text-[#221E2B] hover:text-[#221E2B] bg-[#F3EEFA] rounded"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleConfirmRename}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-[#7C3AED] hover:bg-[#6D28D9] rounded transition-colors"
              >
                Đổi tên
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Screen Modal Dialog */}
      {showAddScreenModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#F7F3FC] border border-[#E4DEF1] rounded-xl w-full max-w-sm p-6 shadow-2xl text-center relative overflow-hidden">
            <div className="w-20 h-20 mx-auto mb-4 relative flex items-center justify-center">
              <div className="w-12 h-12 rounded-full bg-[#7C3AED] absolute -left-1 opacity-80" />
              <div className="w-10 h-10 bg-[#BE185D] transform rotate-45 absolute -right-1 opacity-90" />
              <div className="w-8 h-8 rounded-full bg-[#0284C7] z-10" />
            </div>

            <h3 className="text-base font-bold text-[#221E2B] mb-2">{t('dw.addScreenTitle')}</h3>
            <p className="text-xs text-[#494256] mb-4">
              {t('dw.addScreenDesc1')} <strong className="text-[#047857]">{t('dw.blank')}</strong> {t('dw.addScreenDesc2')}
            </p>

            <input
              type="text"
              value={newScreenNameInput}
              onChange={(e) => setNewScreenNameInput(e.target.value)}
              placeholder={t('dw.screenNamePh')}
              className="w-full bg-[#EFEAF6] border border-[#CBC3DD] text-sm text-[#221E2B] rounded-lg px-3 py-2 outline-none focus:border-[#7C3AED] mb-5 text-center font-medium"
            />

            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setShowAddScreenModal(false)}
                className="px-5 py-2 text-xs font-medium text-[#221E2B] hover:text-[#221E2B] bg-[#F3EEFA] hover:bg-[#E4DEF1] rounded-lg transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleCreateScreen}
                className="px-6 py-2 text-xs font-semibold text-white bg-[#7C3AED] hover:bg-[#6D28D9] rounded-lg shadow-lg shadow-[#7C3AED]/30 transition-colors"
              >
                {t('dw.createScreen')}
              </button>
            </div>
          </div>
        </div>
      )}
      <ExtensionManagerModal
        isOpen={isExtModalOpen}
        onClose={() => setIsExtModalOpen(false)}
        extensions={storeExtensions}
        onAddExtension={(ext) => useAppStore.getState().addExtension(ext)}
        onRemoveExtension={(id) => useAppStore.getState().removeExtension(id)}
      />
    </div>
  );
};
