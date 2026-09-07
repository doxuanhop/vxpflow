import React, { useState, useEffect } from 'react';
import { debugLogger } from './utils/debugLogger';
import { Navbar } from './components/Navbar';
import { ProjectHub } from './components/ProjectHub/ProjectHub';
import { DesignerWorkspace } from './components/Designer/DesignerWorkspace';
import { BlockWorkspace } from './components/Blocks/BlockWorkspace';
import { LuaCodeEditor } from './components/CodeEditor/LuaCodeEditor';
import { PixelArtStudio } from './components/PixelEditor/PixelArtStudio';
import { DocsModal } from './components/Documentation/DocsModal';
import { DebugConsole } from './components/DebugConsole/DebugConsole';
import { BackupHistoryModal } from './components/Backup/BackupHistoryModal';
import { Terminal, ShieldCheck } from 'lucide-react';
import { useAppStore } from './store/appStore';
import { componentsOfScreen, getScreenList } from './utils/screens';
import { isDesktop, workspaceRoot, initWorkspaceRoot } from './utils/desktop';
import { AssetsModal } from './components/Assets/AssetsModal';
import { ProjectAsset } from './types';

export default function App() {
  // Khởi tạo gốc workspace (%APPDATA%/VXPFlow/workspace trên bản cài) ngay khi mở app
  React.useEffect(() => { void initWorkspaceRoot(); }, []);
  const [isDocsOpen, setIsDocsOpen] = useState<boolean>(false);
  const [isDebugConsoleOpen, setIsDebugConsoleOpen] = useState<boolean>(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState<boolean>(false);
  const [isAssetsOpen, setIsAssetsOpen] = useState<boolean>(false);

  // Global session state lives in the Zustand store
  const view = useAppStore(s => s.view);
  const projects = useAppStore(s => s.projects);
  const folders = useAppStore(s => s.folders);
  const project = useAppStore(s => s.project);
  const luaCode = useAppStore(s => s.luaCode);
  const activeScreen = useAppStore(s => s.activeScreen);
  const selectedComponentId = useAppStore(s => s.selectedComponentId);
  const isCompiling = useAppStore(s => s.isCompiling);
  const isBuildingMre = useAppStore(s => s.isBuildingMre);
  const toast = useAppStore(s => s.toast);
  const lastBackupTime = useAppStore(s => s.lastBackupTime);

  const actions = useAppStore;

  // Startup log + periodic auto-backup every 5 minutes
  useEffect(() => {
    debugLogger.info('System', `Khởi động Developer Studio cho dự án "${useAppStore.getState().project.name}" (S30+ QVGA 240x320)`);

    const interval = setInterval(() => {
      useAppStore.getState().autoBackupTick();
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [project?.id]);

  const persistCode = (newCode: string) => {
    // Ghi mã Lua từ bàn phím — phân biệt bản viết tay (giữ nguyên khi sửa Design/Blocks)
    // với bản tự động sinh (tự đồng bộ lại mỗi lần Design/Blocks thay đổi)
    actions.getState().persistLuaCode(newCode);
  };

  // ---- Màn hình (Screens) -------
  // Dự án cũ không có metadata screens → mặc định [Screen1].
  const screenList = getScreenList(project);
  const activeScreenName = screenList.some(s => s.name === activeScreen) ? activeScreen : screenList[0].name;
  const activeScreenComps = componentsOfScreen(project.components, activeScreenName);
  const activeScreenMeta = screenList.find(s => s.name === activeScreenName) || screenList[0];
  const entryScreen = project.entryScreen || screenList[0].name;
  // Blocks lập trình cho màn hình CHÍNH (được đóng gói .vxp); các màn hình khác là bản thiết kế riêng
  const entryScreenComps = componentsOfScreen(project.components, entryScreen);
  // Blocks của MÀN ĐANG CHỌN (dự án cũ không có field screen → thuộc màn chính)
  const activeScreenBlocks = project.blocks.filter(
    b => (b.screen ?? entryScreen) === activeScreenName
  );

  // 1. HOME SCREEN: Project Hub / Dashboard
  if (view === 'projects') {
    return (
      <>
        <ProjectHub
          projects={projects}
          folders={folders}
          onSelectProject={actions.getState().selectProject}
          onCreateProject={actions.getState().createProject}
          onUpdateProjectsList={actions.getState().updateProjectsList}
          onOpenDocs={() => setIsDocsOpen(true)}
        />
        <DocsModal
          isOpen={isDocsOpen}
          onClose={() => setIsDocsOpen(false)}
        />
      </>
    );
  }

  // 2. STUDIO WORKSPACE: Designer, Blocks, Code, Pixel, Files & Dual Emulator
  return (
    <div className="h-screen w-screen flex flex-col bg-[#EFEAF6] text-[#221E2B] overflow-hidden font-sans">
      {/* Top Navbar */}
      <Navbar
        currentView={view}
        onChangeView={actions.getState().setView}
        project={project}
        onSelectTemplate={actions.getState().selectTemplate}
        onBuildVXP={actions.getState().buildVXP}
        isCompiling={isCompiling}
        onOpenAssets={() => setIsAssetsOpen(true)}
        onOpenEmulator={actions.getState().openEmulatorWindow}
        onExportMRE={actions.getState().exportMREBundle}
        onOpenDocs={() => setIsDocsOpen(true)}
        onOpenBackupHistory={() => setIsBackupModalOpen(true)}
      />

      {/* Assets Modal — mở từ nút Assets cạnh Build .VXP (tab Design) */}
      <AssetsModal
        isOpen={isAssetsOpen}
        onClose={() => setIsAssetsOpen(false)}
        project={project.assets}
        onAddAssets={(newAssets: ProjectAsset[]) => {
          actions.getState().updateAssets([...project.assets, ...newAssets.map(a =>
            ({ ...a, id: `img_${Date.now()}_${Math.random().toString(36).slice(2, 7)}` })
          )]);
        }}
        workspaceAssetsDir={isDesktop() ? `${workspaceRoot()}/${(project.packageName || '').split('.').pop() || 'app'}/assets` : null}
        selectedKind={(() => {
          const sel = project.components.find(c => c.id === selectedComponentId);
          if (sel?.type === 'Image') return 'image';
          if (sel?.type === 'Sprite') return 'sprite';
          return null;
        })()}
        onUseAsset={(asset) => {
          // gán cho linh kiện Image/Sprite đang chọn, hoặc tạo linh kiện Image mới
          const comps = activeScreenComps;
          const sel = comps.find(c => c.id === selectedComponentId && (c.type === 'Image' || c.type === 'Sprite'));
          if (sel) {
            actions.getState().updateScreenComponents(activeScreenName, comps.map(c => c.id === sel.id
              ? { ...c, properties: { ...c.properties, picture: asset.name } }
              : c));
            debugLogger.info('Assets', `Đã gán "${asset.name}" cho ${sel.name}`);
          } else {
            const n = comps.filter(c => c.type === 'Image').length + 1;
            const newComp = {
              id: `comp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              name: `Image${n}`,
              type: 'Image' as const,
              x: 20,
              y: 80,
              width: Math.min(asset.width || 120, 240),
              height: Math.min(asset.height || 120, 160),
              properties: { picture: asset.name },
            };
            actions.getState().updateScreenComponents(activeScreenName, [...comps, newComp]);
            actions.getState().selectComponent(newComp.id);
            debugLogger.info('Assets', `Đã thêm ${newComp.name} với ảnh "${asset.name}"`);
          }
        }}
      />

      {/* Notification Toast */}
      {toast && (
        <div className="fixed top-16 right-6 z-50 bg-[#6750A4] border border-[#6750A4] text-white text-xs px-4 py-2.5 rounded-lg shadow-xl backdrop-blur flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-white" />
          <span>{toast}</span>
        </div>
      )}

      {/* Main Studio Workspace — full width (giả lập đã chuyển sang cửa sổ riêng) */}
      <div className="flex-1 flex overflow-hidden">
        {/* Active Workspace */}
        <div className="flex-1 flex flex-col overflow-hidden relative">
          {view === 'designer' && (
            <DesignerWorkspace
              components={activeScreenComps}
              assets={project.assets}
              screens={screenList.map(s => s.name)}
              activeScreen={activeScreenName}
              entryScreen={entryScreen}
              screenProperties={activeScreenMeta.properties}
              selectedComponentId={selectedComponentId}
              resolution={project.resolution}
              onSelectComponent={actions.getState().selectComponent}
              onUpdateComponents={(comps) => actions.getState().updateScreenComponents(activeScreenName, comps)}
              onSwitchScreen={actions.getState().setActiveScreen}
              onAddScreen={actions.getState().addScreen}
              onCopyScreen={actions.getState().copyScreen}
              onRenameScreen={actions.getState().renameScreen}
              onDeleteScreen={actions.getState().deleteScreen}
              onSetEntryScreen={actions.getState().setEntryScreen}
              onUpdateScreenProps={(patch) => actions.getState().updateScreenProps(activeScreenName, patch)}
              onRenameComponent={actions.getState().renameComponent}
            />
          )}

          {view === 'blocks' && (
            <BlockWorkspace
              blocks={activeScreenBlocks}
              components={activeScreenComps}
              onChangeBlocks={actions.getState().updateBlocks}
              projectName={project.name}
              extensions={project.extensions || []}
              resolution={project.resolution}
              screens={screenList.map(s => s.name)}
              activeScreen={activeScreenName}
              entryScreen={entryScreen}
              onSwitchScreen={actions.getState().setActiveScreen}
              onAddScreen={actions.getState().addScreen}
              onCopyScreen={actions.getState().copyScreen}
              onRenameScreen={actions.getState().renameScreen}
              onDeleteScreen={actions.getState().deleteScreen}
            />
          )}

          {view === 'code' && (
            <LuaCodeEditor
              code={luaCode}
              onChangeCode={persistCode}
              onSyncFromBlocks={actions.getState().syncFromBlocks}
              onRunInEmulator={actions.getState().openEmulatorWindow}
            />
          )}

          {view === 'pixel' && (
            <PixelArtStudio
              assets={project.assets}
              onSaveSprite={actions.getState().saveSprite}
            />
          )}
        </div>
      </div>

      {/* Debug Console at the bottom of the studio */}
      <DebugConsole
        isOpen={isDebugConsoleOpen}
        onToggle={() => setIsDebugConsoleOpen(prev => !prev)}
      />

      {/* Status Footer */}
      <footer className="h-8 bg-[#F7F3FC] border-t border-[#E4DEF1] flex items-center justify-between px-3 md:px-4 text-[10px] font-medium text-[#6F687E] shrink-0 select-none">
        <div className="flex items-center gap-3">
          <button
            onClick={() => actions.getState().setView('projects')}
            className="flex items-center gap-1.5 hover:text-[#221E2B] transition-colors"
          >
            <span className="w-2 h-2 rounded-full bg-[#047857]" />
            <span className="text-[#221E2B] font-semibold">VXPFlow Studio</span>
          </button>

          <span className="text-[#A79EBD]">|</span>

          {/* Debug Console Toggle Button */}
          <button
            onClick={() => setIsDebugConsoleOpen(prev => !prev)}
            className={`flex items-center gap-1.5 px-2 py-0.5 rounded border transition-colors ${
              isDebugConsoleOpen
                ? 'bg-[#6750A4] text-white border-[#6750A4]'
                : 'bg-[#F3EEFA] hover:bg-[#E8E1F3] text-[#221E2B] border-[#CBC3DD]'
            }`}
            title="Bật/Tắt Bảng điều khiển gỡ lỗi (Debug Console)"
          >
            <Terminal className="w-3 h-3 text-[#0284C7]" />
            <span className="font-semibold">Debug Console</span>
          </button>

          <span className="text-[#A79EBD] hidden sm:inline">|</span>

          {/* Auto-Backup Status & Trigger */}
          <button
            onClick={() => setIsBackupModalOpen(true)}
            className="hidden sm:flex items-center gap-1.5 hover:text-[#221E2B] transition-colors px-1.5 py-0.5 rounded hover:bg-[#E8E1F3]"
            title="Nhấn để xem lịch sử và quản lý sao lưu tự động"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-[#047857]" />
            <span>Auto-Backup:</span>
            <span className="text-[#047857] font-mono">
              {lastBackupTime ? `Đã lưu ${lastBackupTime}` : 'Đang chạy (5p)'}
            </span>
          </button>
        </div>

        <div className="flex items-center gap-3 font-mono">
          <span className="hidden sm:inline">QVGA 240x320</span>
          <span className="text-[#A79EBD] hidden sm:inline">|</span>
          <span className="text-[#221E2B]">Active: {view.toUpperCase()}</span>
        </div>
      </footer>

      {/* Documentation Modal */}
      <DocsModal
        isOpen={isDocsOpen}
        onClose={() => setIsDocsOpen(false)}
      />

      {/* Auto-Backup History Modal */}
      <BackupHistoryModal
        isOpen={isBackupModalOpen}
        onClose={() => setIsBackupModalOpen(false)}
        activeProject={project}
        onRestoreProject={actions.getState().restoreFromBackup}
      />
    </div>
  );
}
