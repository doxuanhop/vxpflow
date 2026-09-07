import React, { useState, useRef, useEffect } from 'react';
import { 
  Palette, Paintbrush, Eraser, PaintBucket, Pipette, 
  RotateCcw, Download, Save, ZoomIn, ZoomOut, FlipHorizontal, FlipVertical, Grid, Plus
} from 'lucide-react';
import { ProjectAsset } from '../../types';

interface PixelArtStudioProps {
  assets: ProjectAsset[];
  onSaveSprite: (asset: ProjectAsset) => void;
}

const PALETTES = {
  s30plus: {
    name: 'S30+ 16-Màu',
    colors: ['transparent', '#000000', '#EAE4F4', '#64748b', '#ffffff', '#B91C1C', '#f97316', '#B45309', '#22c55e', '#047857', '#06b6d4', '#3b82f6', '#8b5cf6', '#BE185D', '#78350f', '#B45309']
  },
  pico8: {
    name: 'PICO-8 Retro',
    colors: ['transparent', '#000000', '#1D2B53', '#7E2553', '#008751', '#AB5236', '#5F574F', '#C2C3C7', '#FFF1E8', '#FF004D', '#FFA300', '#FFEC27', '#00E436', '#29ADFF', '#83769C', '#FF77A8']
  },
  nokia: {
    name: 'Nokia 3310 Monochrome',
    colors: ['transparent', '#1f2d1f', '#43523d', '#879774', '#c7d4b4']
  },
  gameboy: {
    name: 'Game Boy Classic',
    colors: ['transparent', '#0f380f', '#306230', '#8bac0f', '#9bbc0f']
  }
};

export const PixelArtStudio: React.FC<PixelArtStudioProps> = ({ assets, onSaveSprite }) => {
  const [gridSize, setGridSize] = useState<number>(16);
  const [pixels, setPixels] = useState<string[]>(() => Array(16 * 16).fill('transparent'));
  const [selectedPalette, setSelectedPalette] = useState<keyof typeof PALETTES>('s30plus');
  const [currentColor, setCurrentColor] = useState<string>('#22c55e');
  const [tool, setTool] = useState<'pencil' | 'eraser' | 'bucket' | 'picker'>('pencil');
  const [spriteName, setSpriteName] = useState<string>('custom_sprite.png');
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [history, setHistory] = useState<string[][]>([]);
  const isMouseDown = useRef<boolean>(false);

  // Load existing sprite if chosen
  const handleLoadAsset = (asset: ProjectAsset) => {
    try {
      const parsed = JSON.parse(asset.data);
      if (parsed.width && parsed.pixels && parsed.palette) {
        setGridSize(parsed.width);
        const mapped = parsed.pixels.map((idx: number) => parsed.palette[idx] || 'transparent');
        setPixels(mapped);
        setSpriteName(asset.name);
      }
    } catch (e) {
      console.warn('Failed to parse asset data', e);
    }
  };

  const pushHistory = (newPixels: string[]) => {
    setHistory(prev => [...prev.slice(-10), pixels]);
    setPixels(newPixels);
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setHistory(h => h.slice(0, -1));
    setPixels(prev);
  };

  const setPixelAt = (index: number, color: string) => {
    if (pixels[index] === color) return;
    const next = [...pixels];
    next[index] = color;
    setPixels(next);
  };

  const handlePixelClick = (index: number) => {
    pushHistory(pixels);
    if (tool === 'pencil') {
      setPixelAt(index, currentColor);
    } else if (tool === 'eraser') {
      setPixelAt(index, 'transparent');
    } else if (tool === 'picker') {
      if (pixels[index] !== 'transparent') {
        setCurrentColor(pixels[index]);
        setTool('pencil');
      }
    } else if (tool === 'bucket') {
      floodFill(index);
    }
  };

  const handleMouseEnter = (index: number) => {
    if (!isMouseDown.current) return;
    if (tool === 'pencil') {
      setPixelAt(index, currentColor);
    } else if (tool === 'eraser') {
      setPixelAt(index, 'transparent');
    }
  };

  const floodFill = (startIndex: number) => {
    const targetColor = pixels[startIndex];
    const fillCol = currentColor;
    if (targetColor === fillCol) return;

    const next = [...pixels];
    const queue = [startIndex];
    const visited = new Set<number>();

    while (queue.length > 0) {
      const idx = queue.pop()!;
      if (visited.has(idx)) continue;
      visited.add(idx);

      if (next[idx] === targetColor) {
        next[idx] = fillCol;

        const x = idx % gridSize;
        const y = Math.floor(idx / gridSize);

        if (x > 0) queue.push(idx - 1);
        if (x < gridSize - 1) queue.push(idx + 1);
        if (y > 0) queue.push(idx - gridSize);
        if (y < gridSize - 1) queue.push(idx + gridSize);
      }
    }

    setPixels(next);
  };

  const handleClear = () => {
    pushHistory(pixels);
    setPixels(Array(gridSize * gridSize).fill('transparent'));
  };

  const handleFlipHorizontal = () => {
    pushHistory(pixels);
    const next = [...pixels];
    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < Math.floor(gridSize / 2); x++) {
        const leftIdx = y * gridSize + x;
        const rightIdx = y * gridSize + (gridSize - 1 - x);
        const temp = next[leftIdx];
        next[leftIdx] = next[rightIdx];
        next[rightIdx] = temp;
      }
    }
    setPixels(next);
  };

  const handleFlipVertical = () => {
    pushHistory(pixels);
    const next = [...pixels];
    for (let y = 0; y < Math.floor(gridSize / 2); y++) {
      for (let x = 0; x < gridSize; x++) {
        const topIdx = y * gridSize + x;
        const bottomIdx = (gridSize - 1 - y) * gridSize + x;
        const temp = next[topIdx];
        next[topIdx] = next[bottomIdx];
        next[bottomIdx] = temp;
      }
    }
    setPixels(next);
  };

  const handleSaveToProject = () => {
    // Generate palette array and indexed pixels
    const uniquePalette = Array.from(new Set(pixels));
    const indexedPixels = pixels.map(c => uniquePalette.indexOf(c));

    const assetData = JSON.stringify({
      width: gridSize,
      height: gridSize,
      palette: uniquePalette,
      pixels: indexedPixels
    });

    const newAsset: ProjectAsset = {
      id: `sprite_${Date.now()}`,
      name: spriteName.endsWith('.png') ? spriteName : `${spriteName}.png`,
      type: 'sprite',
      size: gridSize * gridSize,
      width: gridSize,
      height: gridSize,
      data: assetData
    };

    onSaveSprite(newAsset);
    alert(`Đã lưu Sprite "${newAsset.name}" vào danh sách tài nguyên của dự án!`);
  };

  return (
    <div className="flex-1 flex overflow-hidden bg-[#EFEAF6] text-[#221E2B]">
      {/* Left Toolbar */}
      <aside className="w-64 bg-[#F7F3FC] border-r border-[#E4DEF1] p-4 flex flex-col gap-4 overflow-y-auto shrink-0 select-none">
        <h2 className="text-xs font-bold text-[#6F687E] uppercase tracking-wider flex items-center gap-2 pb-2 border-b border-[#E4DEF1]">
          <Palette className="w-4 h-4 text-[#047857]" />
          <span>Xưởng Pixel 2D (S30+)</span>
        </h2>

        {/* Grid Resolution */}
        <div className="space-y-1.5">
          <label className="text-[10px] uppercase font-bold tracking-wider text-[#6F687E]">Kích cỡ lưới (Pixel):</label>
          <div className="grid grid-cols-4 gap-1">
            {[8, 16, 24, 32].map(size => (
              <button
                key={size}
                onClick={() => {
                  setGridSize(size);
                  setPixels(Array(size * size).fill('transparent'));
                  setHistory([]);
                }}
                className={`py-1.5 text-xs font-mono font-medium rounded border transition-colors ${
                  gridSize === size
                    ? 'bg-[#6750A4] border-[#6750A4] text-white'
                    : 'bg-[#F3EEFA] border-[#CBC3DD] text-[#221E2B] hover:border-[#6750A4]'
                }`}
              >
                {size}x{size}
              </button>
            ))}
          </div>
        </div>

        {/* Drawing Tools */}
        <div className="space-y-1.5">
          <label className="text-[10px] uppercase font-bold tracking-wider text-[#6F687E]">Công cụ vẽ:</label>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={() => setTool('pencil')}
              className={`p-2 rounded text-xs flex items-center gap-2 border font-medium transition-colors ${
                tool === 'pencil' ? 'bg-[#047857] border-[#047857] text-white font-bold' : 'bg-[#F3EEFA] border-[#CBC3DD] text-[#221E2B] hover:border-[#6750A4]'
              }`}
            >
              <Paintbrush className="w-4 h-4" /> Bút chì
            </button>
            <button
              onClick={() => setTool('eraser')}
              className={`p-2 rounded text-xs flex items-center gap-2 border font-medium transition-colors ${
                tool === 'eraser' ? 'bg-[#047857] border-[#047857] text-white font-bold' : 'bg-[#F3EEFA] border-[#CBC3DD] text-[#221E2B] hover:border-[#6750A4]'
              }`}
            >
              <Eraser className="w-4 h-4" /> Tẩy xóa
            </button>
            <button
              onClick={() => setTool('bucket')}
              className={`p-2 rounded text-xs flex items-center gap-2 border font-medium transition-colors ${
                tool === 'bucket' ? 'bg-[#047857] border-[#047857] text-white font-bold' : 'bg-[#F3EEFA] border-[#CBC3DD] text-[#221E2B] hover:border-[#6750A4]'
              }`}
            >
              <PaintBucket className="w-4 h-4" /> Đổ màu
            </button>
            <button
              onClick={() => setTool('picker')}
              className={`p-2 rounded text-xs flex items-center gap-2 border font-medium transition-colors ${
                tool === 'picker' ? 'bg-[#047857] border-[#047857] text-white font-bold' : 'bg-[#F3EEFA] border-[#CBC3DD] text-[#221E2B] hover:border-[#6750A4]'
              }`}
            >
              <Pipette className="w-4 h-4" /> Chấm màu
            </button>
          </div>
        </div>

        {/* Quick Operations */}
        <div className="flex gap-1.5">
          <button
            onClick={handleUndo}
            disabled={history.length === 0}
            className="flex-1 p-1.5 bg-[#F3EEFA] hover:bg-[#E4DEF1] disabled:opacity-40 rounded border border-[#CBC3DD] text-[#221E2B] text-xs flex items-center justify-center gap-1 transition-colors"
            title="Hoàn tác (Ctrl+Z)"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Hoàn tác
          </button>
          <button
            onClick={handleFlipHorizontal}
            className="p-1.5 bg-[#F3EEFA] hover:bg-[#E4DEF1] rounded border border-[#CBC3DD] text-[#221E2B] text-xs transition-colors"
            title="Lật ngang"
          >
            <FlipHorizontal className="w-4 h-4" />
          </button>
          <button
            onClick={handleFlipVertical}
            className="p-1.5 bg-[#F3EEFA] hover:bg-[#E4DEF1] rounded border border-[#CBC3DD] text-[#221E2B] text-xs transition-colors"
            title="Lật dọc"
          >
            <FlipVertical className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowGrid(!showGrid)}
            className={`p-1.5 rounded border text-xs transition-colors ${showGrid ? 'bg-[#6750A4] border-[#6750A4] text-white' : 'bg-[#F3EEFA] border-[#CBC3DD] text-[#494256]'}`}
            title="Bật/Tắt lưới"
          >
            <Grid className="w-4 h-4" />
          </button>
          <button
            onClick={handleClear}
            className="p-1.5 bg-red-950/40 hover:bg-red-900/60 text-red-500 rounded border border-red-800/80 text-xs transition-colors"
            title="Xóa trắng"
          >
            Xóa
          </button>
        </div>

        {/* Palette Selector */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[10px] uppercase font-bold tracking-wider text-[#6F687E]">Bảng màu Retro:</label>
            <select
              value={selectedPalette}
              onChange={(e) => setSelectedPalette(e.target.value as keyof typeof PALETTES)}
              className="text-xs bg-[#EFEAF6] border border-[#CBC3DD] text-[#221E2B] rounded px-1.5 py-0.5 outline-none focus:border-[#6750A4]"
            >
              {Object.entries(PALETTES).map(([key, pal]) => (
                <option key={key} value={key}>{pal.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-4 gap-1.5 p-2 bg-[#EFEAF6] rounded-lg border border-[#E4DEF1]">
            {PALETTES[selectedPalette].colors.map((c, i) => (
              <button
                key={i}
                onClick={() => {
                  setCurrentColor(c);
                  if (tool === 'eraser') setTool('pencil');
                }}
                className={`h-7 rounded border transition-transform ${
                  currentColor === c && tool !== 'eraser' ? 'ring-2 ring-[#047857] scale-110' : 'border-[#CBC3DD]'
                }`}
                style={{
                  backgroundColor: c === 'transparent' ? '#EFEAF6' : c,
                  backgroundImage: c === 'transparent' ? 'repeating-conic-gradient(#F3EEFA 0% 25%, #EFEAF6 0% 50%) 50% / 10px 10px' : 'none'
                }}
                title={c}
              />
            ))}
          </div>
        </div>

        {/* Existing Assets */}
        {assets.filter(a => a.type === 'sprite').length > 0 && (
          <div className="space-y-1.5 pt-2 border-t border-[#E4DEF1]">
            <label className="text-[10px] uppercase font-bold tracking-wider text-[#6F687E]">Sprite trong dự án:</label>
            <div className="space-y-1 max-h-28 overflow-y-auto">
              {assets.filter(a => a.type === 'sprite').map(a => (
                <button
                  key={a.id}
                  onClick={() => handleLoadAsset(a)}
                  className="w-full text-left px-2 py-1.5 bg-[#EFEAF6] hover:bg-[#F3EEFA] rounded text-xs text-[#221E2B] truncate flex items-center justify-between border border-[#E4DEF1] hover:border-[#6750A4] transition-colors"
                >
                  <span className="truncate">{a.name}</span>
                  <span className="text-[10px] text-[#6F687E] font-mono">{a.width}x{a.height}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Save/Export */}
        <div className="space-y-2 mt-auto pt-4 border-t border-[#E4DEF1]">
          <input
            type="text"
            value={spriteName}
            onChange={(e) => setSpriteName(e.target.value)}
            className="w-full bg-[#EFEAF6] border border-[#CBC3DD] text-xs text-[#221E2B] px-2.5 py-1.5 rounded font-mono outline-none focus:border-[#6750A4]"
            placeholder="Tên sprite (vd: player.png)"
          />
          <button
            onClick={handleSaveToProject}
            className="w-full py-2 bg-[#047857] hover:bg-[#065F46] text-white text-xs font-bold rounded flex items-center justify-center gap-2 shadow-lg transition-colors"
          >
            <Save className="w-4 h-4" /> Lưu vào Tài nguyên Dự án
          </button>
        </div>
      </aside>

      {/* Main Drawing Grid Area */}
      <section 
        className="flex-1 flex flex-col items-center justify-center p-8 overflow-auto bg-[#EFEAF6] geometric-dot-grid"
        onMouseUp={() => { isMouseDown.current = false; }}
        onMouseLeave={() => { isMouseDown.current = false; }}
      >
        <div className="bg-[#F7F3FC] border-2 border-[#E4DEF1] rounded-2xl p-5 shadow-2xl flex flex-col items-center gap-4">
          <div 
            className="relative select-none border-2 border-[#E4DEF1] bg-[#000000] shadow-inner"
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))`,
              width: `${Math.min(480, gridSize * 24)}px`,
              height: `${Math.min(480, gridSize * 24)}px`,
              backgroundImage: 'repeating-conic-gradient(#F7F3FC 0% 25%, #EFEAF6 0% 50%) 50% / 16px 16px'
            }}
          >
            {pixels.map((color, idx) => (
              <div
                key={idx}
                onMouseDown={() => {
                  isMouseDown.current = true;
                  handlePixelClick(idx);
                }}
                onMouseEnter={() => handleMouseEnter(idx)}
                style={{
                  backgroundColor: color === 'transparent' ? 'transparent' : color
                }}
                className={`transition-colors cursor-crosshair ${
                  showGrid ? 'border-[0.5px] border-white/10' : ''
                }`}
              />
            ))}
          </div>

          {/* Live Preview Bar */}
          <div className="flex items-center gap-6 text-xs text-[#494256] bg-[#EFEAF6] px-4 py-2 rounded-lg border border-[#E4DEF1]">
            <span className="font-semibold text-[#221E2B]">Xem trước thực tế (1x, 2x, 4x):</span>
            <div className="flex items-center gap-4">
              {/* 1x */}
              <div 
                className="pixelated border border-[#CBC3DD] bg-[#F7F3FC]"
                style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${gridSize}, 1px)`,
                  width: `${gridSize}px`,
                  height: `${gridSize}px`
                }}
              >
                {pixels.map((c, i) => (
                  <div key={i} style={{ backgroundColor: c }} />
                ))}
              </div>

              {/* 2x */}
              <div 
                className="pixelated border border-[#CBC3DD] bg-[#F7F3FC]"
                style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${gridSize}, 2px)`,
                  width: `${gridSize * 2}px`,
                  height: `${gridSize * 2}px`
                }}
              >
                {pixels.map((c, i) => (
                  <div key={i} style={{ backgroundColor: c }} />
                ))}
              </div>

              {/* 4x */}
              <div 
                className="pixelated border border-[#CBC3DD] bg-[#F7F3FC]"
                style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${gridSize}, 4px)`,
                  width: `${gridSize * 4}px`,
                  height: `${gridSize * 4}px`
                }}
              >
                {pixels.map((c, i) => (
                  <div key={i} style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
