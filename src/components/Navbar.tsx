import React, { useState } from 'react';
import {
  Boxes, Code, Palette, Folder, BookOpen,
  Smartphone, RefreshCw, Layers, ArrowLeft,
  Download, HelpCircle, ShieldCheck, FolderOpen, Package, Hammer,
  Image as ImageIcon, X
} from 'lucide-react';
import { Project } from '../types';
import { LanguageSwitcher, useI18n } from '../i18n';
import { Info, Github, Mail, Globe, Cpu, Heart, Sparkles, Puzzle, Terminal, Library } from 'lucide-react';

interface NavbarProps {
  currentView: 'designer' | 'blocks' | 'code' | 'pixel' | 'files' | 'projects';
  onChangeView: (view: 'designer' | 'blocks' | 'code' | 'pixel' | 'files' | 'projects') => void;
  project: Project;
  /** Build .VXP: tổng hợp Design + Blocks → Lua → gói .VXP */
  onBuildVXP: () => void;
  isCompiling: boolean;
  /** Mở giả lập trong cửa sổ riêng (không nằm chung giao diện studio) */
  onOpenEmulator: () => void;
  /** Xuất gói MRE thật: LuaEngine.vxp (runtime Lua 5.1) + script.lua + README */
  onExportMRE?: () => void;
  onSelectTemplate: (templateId: 'snake' | 'space_shooter' | 'calculator') => void;
  onOpenDocs: () => void;
  onOpenBackupHistory?: () => void;
  /** Mở hộp thoại Assets (modal) — thay vì chuyển view */
  onOpenAssets?: () => void;
}

/** Các "màn hình" (workspace) chính của studio — hiển thị dưới dạng icon để chuyển đổi nhanh */
const VIEW_ITEMS: { view: 'designer' | 'blocks' | 'code' | 'pixel' | 'files'; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { view: 'designer', label: 'Designer (màn hình thiết kế)', icon: Layers },
  { view: 'blocks', label: 'Blocks (màn hình khối lệnh)', icon: Boxes },
  { view: 'code', label: 'Mã Lua', icon: Code },
  { view: 'pixel', label: 'Vẽ Pixel 2D Sprite', icon: Palette }
];

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  onChangeView,
  project,
  onBuildVXP,
  isCompiling,
  onOpenEmulator,
  onExportMRE,
  onSelectTemplate,
  onOpenDocs,
  onOpenBackupHistory,
  onOpenAssets
}) => {

  const { t } = useI18n();
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [activeMenu, setActiveMenu] = useState<'project' | 'help' | null>(null);

  const toggleMenu = (menu: 'project' | 'help') => {
    setActiveMenu(prev => prev === menu ? null : menu);
  };

  const closeMenu = () => setActiveMenu(null);

  const downloadProjectJson = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(project, null, 2));
    const dl = document.createElement('a');
    dl.setAttribute("href", dataStr);
    dl.setAttribute("download", `${project.name}.vxp-project.json`);
    dl.click();
    closeMenu();
  };

  return (
    <header className="h-13 bg-[#F7F3FC] border-b border-[#E4DEF1] px-3 md:px-4 flex items-center justify-between gap-2 select-none z-30 shrink-0 text-[#221E2B] relative">
      {/* Left: Brand + icon-only tool menus */}
      <div className="flex items-center gap-1.5 md:gap-3 min-w-0">
        {/* Brand Icon & Title */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => onChangeView('projects')}
            className="flex items-center gap-2 group cursor-pointer"
            title={t("nav.backToHub")}
          >
            <div className="w-8 h-8 rounded-lg overflow-hidden border border-[#7C3AED]/40 shadow-md group-hover:border-[#6D28D9] transition-colors">
              <img src="/app-icon.png" alt="VXPFlow" className="w-full h-full object-cover" />
            </div>
            <span className="hidden sm:block text-[#221E2B] font-bold text-sm tracking-tight">VXPFlow <span className="text-[#6D28D9]">Studio</span></span>
          </button>
        </div>

        <LanguageSwitcher />

        <span className="w-px h-6 bg-[#E4DEF1] shrink-0 hidden md:block" />

        {/* Icon menus (title chỉ hiện khi rê chuột vào) */}
        <div className="hidden md:flex items-center gap-0.5 text-[#494256]">
          {/* Project Menu */}
          <div className="relative">
            <button
              onClick={() => toggleMenu('project')}
              className={`p-2 rounded-lg hover:text-[#221E2B] hover:bg-[#F3EEFA] transition-colors cursor-pointer ${
                activeMenu === 'project' ? 'text-[#221E2B] bg-[#F3EEFA]' : ''
              }`}
              title={t("nav.projectMenu")}
              aria-label="Menu Dự án"
            >
              <FolderOpen className="w-4 h-4" />
            </button>

            {activeMenu === 'project' && (
              <div className="absolute left-0 top-full mt-1.5 bg-[#F7F3FC] border border-[#E4DEF1] rounded-lg shadow-2xl py-1 w-60 z-50 text-xs">
                <button
                  onClick={() => { onChangeView('projects'); closeMenu(); }}
                  className="w-full text-left px-3 py-2 hover:bg-[#F3EEFA] hover:text-[#221E2B] flex items-center gap-2"
                >
                  <ArrowLeft className="w-3.5 h-3.5 text-[#0284C7]" />
                  <span>My Projects (Danh sách dự án)</span>
                </button>
                {onOpenBackupHistory && (
                  <button
                    onClick={() => { onOpenBackupHistory(); closeMenu(); }}
                    className="w-full text-left px-3 py-2 hover:bg-[#F3EEFA] hover:text-[#221E2B] flex items-center gap-2"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-[#047857]" />
                    <span>Lịch sử sao lưu (Auto-Backup)</span>
                  </button>
                )}
                <div className="border-t border-[#E4DEF1] my-1" />
                <button
                  onClick={downloadProjectJson}
                  className="w-full text-left px-3 py-2 hover:bg-[#F3EEFA] hover:text-[#221E2B] flex items-center gap-2"
                >
                  <Download className="w-3.5 h-3.5 text-[#047857]" />
                  <span>Export project (.json)</span>
                </button>
                {onExportMRE && (
                  <button
                    onClick={() => { onExportMRE(); closeMenu(); }}
                    className="w-full text-left px-3 py-2 hover:bg-[#F3EEFA] hover:text-[#221E2B] flex items-center gap-2"
                    title={t("nav.exportMre")}
                  >
                    <Package className="w-3.5 h-3.5 text-[#7C3AED]" />
                    <span>Xuất gói thẻ nhớ (script.lua)</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Help Menu */}
          <div className="relative">
            <button
              onClick={() => toggleMenu('help')}
              className={`p-2 rounded-lg hover:text-[#221E2B] hover:bg-[#F3EEFA] transition-colors cursor-pointer ${
                activeMenu === 'help' ? 'text-[#221E2B] bg-[#F3EEFA]' : ''
              }`}
              title={t("nav.helpMenu")}
              aria-label="Menu Trợ giúp"
            >
              <HelpCircle className="w-4 h-4" />
            </button>

            {activeMenu === 'help' && (
              <div className="absolute left-0 top-full mt-1.5 bg-[#F7F3FC] border border-[#E4DEF1] rounded-lg shadow-2xl py-1 w-56 z-50 text-xs">
                <button
                  onClick={() => { onOpenDocs(); closeMenu(); }}
                  className="w-full text-left px-3 py-2 hover:bg-[#F3EEFA] hover:text-[#221E2B] flex items-center gap-2"
                >
                  <BookOpen className="w-3.5 h-3.5 text-[#0284C7]" />
                  <span>{t('nav.docs')}</span>
                </button>
                <button
                  onClick={() => { setIsAboutOpen(true); closeMenu(); }}
                  className="w-full text-left px-3 py-2 hover:bg-[#F3EEFA] hover:text-[#221E2B] flex items-center gap-2"
                >
                  <Info className="w-3.5 h-3.5 text-[#6750A4]" />
                  <span>{t('nav.about')}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Center: View Dock — chuyển đổi màn hình làm việc chỉ với 1 cú nhấp */}
      <div className="flex items-center bg-[#EFEAF6] p-1 rounded-lg border border-[#E4DEF1] gap-0.5">
        {VIEW_ITEMS.map(({ view, label, icon: Icon }) => {
          const isActive = currentView === view;
          return (
            <button
              key={view}
              onClick={() => onChangeView(view)}
              className={`px-2.5 py-1.5 rounded-md transition-all cursor-pointer flex items-center justify-center ${
                isActive
                  ? 'bg-[#7C3AED] text-white shadow-md shadow-[#7C3AED]/20'
                  : 'text-[#494256] hover:text-[#221E2B] hover:bg-[#E4DEF1]/60'
              }`}
              title={isActive ? `${label} (đang mở)` : `Chuyển sang ${label}`}
              aria-label={label}
            >
              <Icon className="w-4 h-4" />
            </button>
          );
        })}
      </div>

      {/* Right: Assets · Build .VXP & Emulator */}
      <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
        {/* Assets: thư viện tài nguyên — cạnh nút Build .VXP để thêm nhanh vào Design */}
        <button
          onClick={() => onOpenAssets?.()}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
            currentView === 'files'
              ? 'bg-[#B45309] text-white border-[#B45309] shadow-md shadow-[#B45309]/20'
              : 'bg-[#FDFCFF] border-[#E4DEF1] text-[#494256] hover:text-[#221E2B] hover:border-[#B45309]'
          }`}
          title={t("nav.assets")}
          aria-label="Thư viện Assets"
        >
          <ImageIcon className="w-3.5 h-3.5" />
          <span className="hidden md:inline">{t("nav.assets")}</span>
        </button>

        {/* Build .VXP: tổng hợp Design + Blocks → Lua → gói .VXP */}
        <button
          onClick={onBuildVXP}
          disabled={isCompiling}
          className="px-3 md:px-4 py-2 bg-[#047857] hover:bg-[#065F46] text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-md shadow-[#047857]/20 transition-all cursor-pointer disabled:opacity-50"
          title={t("nav.build")}
        >
          {isCompiling ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>{t("nav.building")}</span>
            </>
          ) : (
            <>
              <Hammer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t("nav.build")}</span>
            </>
          )}
        </button>

        {/* Emulator: opens its OWN window */}
        <button
          onClick={onOpenEmulator}
          className="p-2 rounded-lg border transition-colors cursor-pointer bg-[#F7F3FC] border-[#E4DEF1] text-[#494256] hover:text-[#221E2B] hover:border-[#7C3AED]"
          title={t("nav.emulator")}
          aria-label={t("nav.emulator")}
        >
          <Smartphone className="w-4 h-4" />
        </button>
      {/* ===== MODAL ABOUT ===== */}
      {isAboutOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setIsAboutOpen(false)}>
          <div className="bg-[#F7F3FC] border border-[#E4DEF1] rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 flex items-center gap-3 border-b border-[#E4DEF1] bg-gradient-to-r from-[#F3EEFA] to-[#EFEAF6]">
              <img src="/app-icon.png" alt="VXPFlow" className="w-10 h-10 rounded-lg object-cover shadow-md" />
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-[#221E2B]">VXPFlow Studio</h3>
                <p className="text-[10px] text-[#6F687E]">{t('about.subtitle')}</p>
              </div>
              <button onClick={() => setIsAboutOpen(false)} className="p-1.5 rounded-lg text-[#6F687E] hover:text-[#221E2B] hover:bg-[#E4DEF1] cursor-pointer" aria-label={t('common.close')}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-5 py-4 max-h-[65vh] overflow-y-auto text-xs text-[#494256] space-y-4">
              <p className="leading-relaxed">{t('about.intro')}</p>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#A79EBD] mb-2">{t('about.credits')}</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-2 bg-[#FDFCFF] border border-[#E4DEF1] rounded-lg px-3 py-2">
                    <Terminal className="w-4 h-4 text-[#3b82f6] shrink-0" />
                    <div className="min-w-0"><p className="font-semibold text-[#221E2B] truncate">Lua 5.1 + fengari</p><p className="text-[9px] text-[#6F687E] truncate">{t('about.credit.lua')}</p></div>
                  </div>
                  <div className="flex items-center gap-2 bg-[#FDFCFF] border border-[#E4DEF1] rounded-lg px-3 py-2">
                    <Library className="w-4 h-4 text-[#f97316] shrink-0" />
                    <div className="min-w-0"><p className="font-semibold text-[#221E2B] truncate">MediaTek MRE SDK</p><p className="text-[9px] text-[#6F687E] truncate">{t('about.credit.mre')}</p></div>
                  </div>
                  <div className="flex items-center gap-2 bg-[#FDFCFF] border border-[#E4DEF1] rounded-lg px-3 py-2">
                    <Cpu className="w-4 h-4 text-[#10b981] shrink-0" />
                    <div className="min-w-0"><p className="font-semibold text-[#221E2B] truncate">luac / PackApp</p><p className="text-[9px] text-[#6F687E] truncate">{t('about.credit.pack')}</p></div>
                  </div>
                  <div className="flex items-center gap-2 bg-[#FDFCFF] border border-[#E4DEF1] rounded-lg px-3 py-2">
                    <Puzzle className="w-4 h-4 text-[#8b5cf6] shrink-0" />
                    <div className="min-w-0"><p className="font-semibold text-[#221E2B] truncate">React + Tauri + Zustand</p><p className="text-[9px] text-[#6F687E] truncate">{t('about.credit.frontend')}</p></div>
                  </div>
                </div>
              </div>
              <div className="bg-[#F3EEFA] border border-[#E4DEF1] rounded-lg px-3 py-2.5 flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-[#6750A4] shrink-0 mt-0.5" />
                <p className="leading-relaxed">{t('about.ai')}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#A79EBD] mb-2">{t('about.author')}</p>
                <div className="bg-[#FDFCFF] border border-[#E4DEF1] rounded-lg px-3 py-3 space-y-2">
                  <a href="https://github.com/doxuanhop" target="_blank" rel="noreferrer" className="flex items-center gap-2.5 hover:text-[#6750A4] text-[#221E2B] font-semibold">
                    <Github className="w-4 h-4 text-[#221E2B]" />
                    <span>github.com/doxuanhop</span>
                  </a>
                  <a href="mailto:dohop96@gmail.com" className="flex items-center gap-2.5 hover:text-[#6750A4] text-[#221E2B] font-semibold">
                    <Mail className="w-4 h-4 text-[#ea4335]" />
                    <span>dohop96@gmail.com</span>
                  </a>
                  <a href="http://qeafivels.com/" target="_blank" rel="noreferrer" className="flex items-center gap-2.5 hover:text-[#6750A4] text-[#221E2B] font-semibold">
                    <Globe className="w-4 h-4 text-[#0284C7]" />
                    <span>qeafivels.com</span>
                  </a>
                  <p className="flex items-center gap-2 text-[10px] text-[#6F687E] pt-1 border-t border-[#EFEAF6]">
                    <Heart className="w-3 h-3 text-red-500" />
                    {t('about.thanks')}
                  </p>
                </div>
              </div>
            </div>
            <div className="px-5 py-3 bg-[#F3EEFA] border-t border-[#E4DEF1] flex items-center justify-between">
              <p className="text-[10px] text-[#6F687E]">© 2026 VXPFlow · VXP / MRE / Nokia S30+</p>
              <button onClick={() => setIsAboutOpen(false)} className="px-5 py-2 text-xs font-bold text-white bg-[#6750A4] hover:bg-[#5A4692] rounded-lg shadow-md cursor-pointer transition-colors">
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </header>
  );
};
