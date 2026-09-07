import React, { useState } from 'react';
import { useI18n } from '../../i18n';
import { Palette, Check } from 'lucide-react';

export interface S30ColorDef {
  name: string;
  hex: string;
  category: 'brand' | 'neutral' | 'accent';
  desc: string;
}

export const S30_PLUS_PALETTE: S30ColorDef[] = [
  // Iconic Nokia Brand Colors
  { name: 'Nokia Blue', hex: '#0085D0', category: 'brand', desc: 'Xanh dương thương hiệu Nokia kinh điển' },
  { name: 'S30+ Sky', hex: '#00A4E4', category: 'brand', desc: 'Xanh da trời thanh tiêu đề S30+' },
  { name: 'S30+ Navy', hex: '#1A3B70', category: 'brand', desc: 'Xanh hải quân đậm' },
  { name: 'Nokia Green', hex: '#107C10', category: 'brand', desc: 'Xanh lá gọi điện thoại Nokia' },
  { name: 'S30+ Lime', hex: '#78B833', category: 'brand', desc: 'Xanh nõn chuối S30+ UI' },
  { name: 'Nokia Orange', hex: '#D83B01', category: 'brand', desc: 'Cam rực rỡ Nokia Asha' },
  { name: 'Nokia Red', hex: '#E81123', category: 'brand', desc: 'Đỏ phím ngắt cuộc gọi' },
  { name: 'S30+ Amber', hex: '#FFB900', category: 'brand', desc: 'Vàng pin & sóng tín hiệu' },
  { name: 'S30+ Purple', hex: '#881798', category: 'brand', desc: 'Tím chủ đề Nokia S30+' },
  { name: 'S30+ Magenta', hex: '#B4009E', category: 'brand', desc: 'Hồng cánh sen trẻ trung' },

  // Neutrals & S30+ Display
  { name: 'OLED Black', hex: '#000000', category: 'neutral', desc: 'Đen tuyệt đối nền màn hình QVGA' },
  { name: 'Chassis Dark', hex: '#16181D', category: 'neutral', desc: 'Xám than vỏ máy Nokia S30+' },
  { name: 'Surface Dark', hex: '#1F2937', category: 'neutral', desc: 'Nền thanh điều khiển & phím mềm' },
  { name: 'Border Gray', hex: '#374151', category: 'neutral', desc: 'Viền khung linh kiện MRE' },
  { name: 'Dim Gray', hex: '#4B5563', category: 'neutral', desc: 'Đường phân cách giao diện' },
  { name: 'Text Gray', hex: '#9CA3AF', category: 'neutral', desc: 'Chữ phụ & nhãn hướng dẫn' },
  { name: 'Pure White', hex: '#FFFFFF', category: 'neutral', desc: 'Trắng tinh khiết chữ tiêu đề' },

  // Game & Retro Accents
  { name: 'Snake Green', hex: '#22C55E', category: 'accent', desc: 'Màu rắn săn mồi cổ điển (Snake)' },
  { name: 'Retro Neon', hex: '#00E5FF', category: 'accent', desc: 'Xanh neon phi thuyền bắn súng' },
  { name: 'Arcade Yellow', hex: '#FACC15', category: 'accent', desc: 'Vàng điểm số Retro Arcade' },
  { name: 'Brick Red', hex: '#F97316', category: 'accent', desc: 'Cam gạch xếp hình Tetris' },
  { name: 'Bonus Pink', hex: '#EC4899', category: 'accent', desc: 'Hồng điểm thưởng trò chơi' },
];

interface S30PlusColorPaletteProps {
  currentColor: string;
  onSelectColor: (hex: string) => void;
  label?: string;
}

export const S30PlusColorPalette: React.FC<S30PlusColorPaletteProps> = ({
  currentColor,
  onSelectColor,
  label
}) => {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<'all' | 'brand' | 'neutral' | 'accent'>('all');

  const filteredColors = activeTab === 'all' 
    ? S30_PLUS_PALETTE 
    : S30_PLUS_PALETTE.filter(c => c.category === activeTab);

  const normalizedCurrent = (currentColor || '').toLowerCase();

  return (
    <div className="bg-[#121418] border border-[#2D2F36] rounded-lg p-2 space-y-2 select-none shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold text-[#D1D5DB] flex items-center gap-1">
          <Palette className="w-3 h-3 text-[#38BDF8]" />
          <span>{label}</span>
        </span>
        <span className="font-mono text-[9px] text-[#9CA3AF] px-1 bg-[#1F2937] rounded border border-[#374151]">
          16-bit RGB565
        </span>
      </div>

      {/* Category Tabs */}
      <div className="flex items-center gap-1 text-[9px] bg-[#0F1115] p-0.5 rounded border border-[#2D2F36]">
        {[
          { id: 'all', labelKey: 'cp.all', label: 'Tất cả' },
          { id: 'brand', label: 'Nokia S30+' },
          { id: 'neutral', labelKey: 'cp.mono', label: 'Trắng/Đen' },
          { id: 'accent', labelKey: 'cp.game', label: 'Game/Retro' }
        ].map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex-1 py-0.5 text-center rounded transition-colors ${
              activeTab === tab.id 
                ? 'bg-[#7C3AED] text-white font-semibold' 
                : 'text-[#9CA3AF] hover:text-white'
            }`}
          >
            {t(tab.labelKey, tab.label)}
          </button>
        ))}
      </div>

      {/* Color Swatches Grid */}
      <div className="grid grid-cols-6 gap-1.5 pt-0.5">
        {filteredColors.map((color) => {
          const isSelected = normalizedCurrent === color.hex.toLowerCase();
          // Check luminance for checkmark contrast
          const isLight = ['#ffffff', '#ffb900', '#facc15', '#00e5ff', '#78b833', '#9ca3af'].includes(color.hex.toLowerCase());

          return (
            <button
              key={color.name}
              type="button"
              onClick={() => onSelectColor(color.hex)}
              className={`w-full aspect-square rounded-md border relative transition-all group flex items-center justify-center ${
                isSelected 
                  ? 'ring-2 ring-[#7C3AED] ring-offset-1 ring-offset-[#0F1115] scale-110 z-10 border-white' 
                  : 'border-[#374151] hover:scale-105 hover:border-white/80'
              }`}
              style={{ backgroundColor: color.hex }}
              title={`${color.name} (${color.hex}) - ${color.desc}`}
            >
              {isSelected && (
                <Check className={`w-3 h-3 ${isLight ? 'text-black' : 'text-white'} drop-shadow`} />
              )}
            </button>
          );
        })}
      </div>

      {/* Current Selection Footnote */}
      <div className="flex items-center justify-between text-[9px] text-[#9CA3AF] pt-1 border-t border-[#252833]">
        <div className="flex items-center gap-1.5">
          <span 
            className="w-3 h-3 rounded-full border border-[#4B5563] inline-block shadow-sm"
            style={{ backgroundColor: currentColor || '#000000' }}
          />
          <span className="font-mono text-white font-bold">{currentColor || '#000000'}</span>
        </div>
        <span className="text-[8px] text-[#6B7280]">{t('cp.std16')}</span>
      </div>
    </div>
  );
};
