import React, { useState, useMemo, useRef } from 'react';
import {
  Calculator, FileText, Folder, Gamepad2, Rocket, 
  Plus, Upload, FolderPlus, Search, Download, Trash2, 
  ArrowLeftRight, LayoutGrid, List, ChevronDown, 
  BookOpen, Sun, Moon, HelpCircle, X, Check, Copy,
  Sparkles, Smartphone, Layers, AlertTriangle, FileCode,
  CloudDownload, HardDrive, RotateCcw, RotateCw, Cpu
} from 'lucide-react';
import { VXPProject, ProjectFolder, ScreenResolution } from '../../types';
import { 
  createBlankProject, 
  deleteStoredProject, 
  duplicateStoredProject, 
  loadDefaultSampleProjects,
  formatDateTime
} from '../../utils/projectStorage';

import { isDesktop, pickDesktopProjectJson, pickProjectFolder, workspaceRoot } from '../../utils/desktop';
import { useI18n, LanguageSwitcher } from '../../i18n';
import { SettingsModal } from '../Settings/SettingsModal';
import { InstallingModal } from '../Settings/InstallingModal';
import { Settings as SettingsIcon } from 'lucide-react';
import { useSysDialogs } from '../SystemDialogs/SystemDialogs';
import {
  RESOLUTIONS,
  RAM_OPTIONS,
  DEFAULT_RAM_KB,
  defaultPackageOf,
  slugOf
} from '../../utils/projectConfig';
import JSZip from 'jszip';

interface ProjectHubProps {
  projects: VXPProject[];
  folders: ProjectFolder[];
  onSelectProject: (project: VXPProject) => void;
  onCreateProject: (project: VXPProject) => void;
  onUpdateProjectsList: (projects: VXPProject[]) => void;
  onOpenDocs: () => void;
}

type SortOption = 'modified_desc' | 'modified_asc' | 'created_desc' | 'created_asc' | 'name_asc' | 'name_desc';

export const ProjectHub: React.FC<ProjectHubProps> = ({
  projects,
  folders,
  onSelectProject,
  onCreateProject,
  onUpdateProjectsList,
  onOpenDocs
}) => {

  const { t } = useI18n();
  const { infoDialog } = useSysDialogs();
  const [viewStyle, setViewStyle] = useState<'grid' | 'list'>('grid');
  const [sortOption, setSortOption] = useState<SortOption>('modified_desc');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const [isNewFolderModalOpen, setIsNewFolderModalOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [projectToDelete, setProjectToDelete] = useState<VXPProject | null>(null);
  const [projectToDuplicate, setProjectToDuplicate] = useState<VXPProject | null>(null);
  const [duplicateName, setDuplicateName] = useState<string>('');

  // Form states for Create Project
  const [newProjectName, setNewProjectName] = useState<string>('');
  const [newProjectResolution, setNewProjectResolution] = useState<ScreenResolution>('240x320');
  const [newProjectTemplate, setNewProjectTemplate] = useState<'blank' | 'snake' | 'space_shooter' | 'calculator'>('blank');
  const [nameError, setNameError] = useState<string | null>(null);
  const [exportingProjectId, setExportingProjectId] = useState<string | null>(null);

  // Tùy chọn tạo dự án: App ID, RAM, chiều màn hình, vị trí lưu trữ (workspace)
  const [newProjectAppId, setNewProjectAppId] = useState<string>('');
  const [appIdTouched, setAppIdTouched] = useState<boolean>(false);
  const [appIdError, setAppIdError] = useState<string | null>(null);
  const [newProjectOrientation, setNewProjectOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [newProjectRamKb, setNewProjectRamKb] = useState<number>(DEFAULT_RAM_KB);
  const [newProjectStoragePath, setNewProjectStoragePath] = useState<string | null>(null);
  const [storageBusy, setStorageBusy] = useState<boolean>(false);

  // Filtered and sorted projects
  const displayedProjects = useMemo(() => {
    let result = [...projects];

    if (activeFolderId) {
      result = result.filter(p => p.folderId === activeFolderId);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(p => 
        p.name.toLowerCase().includes(q) || 
        p.packageName.toLowerCase().includes(q) ||
        (p.description && p.description.toLowerCase().includes(q))
      );
    }

    result.sort((a, b) => {
      switch (sortOption) {
        case 'modified_desc': {
          const tA = new Date(a.modifiedAt || 0).getTime() || 0;
          const tB = new Date(b.modifiedAt || 0).getTime() || 0;
          return tB - tA;
        }
        case 'modified_asc': {
          const tA = new Date(a.modifiedAt || 0).getTime() || 0;
          const tB = new Date(b.modifiedAt || 0).getTime() || 0;
          return tA - tB;
        }
        case 'created_desc': {
          const tA = new Date(a.createdAt || 0).getTime() || 0;
          const tB = new Date(b.createdAt || 0).getTime() || 0;
          return tB - tA;
        }
        case 'created_asc': {
          const tA = new Date(a.createdAt || 0).getTime() || 0;
          const tB = new Date(b.createdAt || 0).getTime() || 0;
          return tA - tB;
        }
        case 'name_asc':
          return a.name.localeCompare(b.name);
        case 'name_desc':
          return b.name.localeCompare(a.name);
        default:
          return 0;
      }
    });

    return result;
  }, [projects, activeFolderId, searchQuery, sortOption]);

  const syncAppIdFromName = (name: string) => {
    if (!appIdTouched) setNewProjectAppId(defaultPackageOf(name));
  };

  const chooseOrientation = (o: 'portrait' | 'landscape') => {
    setNewProjectOrientation(o);
    const list = RESOLUTIONS[o];
    const recommended = list.find(r => r.recommended) || list[0];
    if (!list.some(r => r.value === newProjectResolution) && recommended) {
      setNewProjectResolution(recommended.value);
    }
  };

  const handlePickStorageFolder = async () => {
    if (!isDesktop()) return;
    setStorageBusy(true);
    try {
      const path = await pickProjectFolder();
      if (path) setNewProjectStoragePath(path);
    } finally {
      setStorageBusy(false);
    }
  };

  // Handle Create Project
  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newProjectName.trim();
    if (!trimmed) {
      setNameError(t('hub.errName'));
      return;
    }
    if (!/^[a-zA-Z0-9_ -]+$/.test(trimmed)) {
      setNameError(t('hub.errNameChars'));
      return;
    }

    const appId = (newProjectAppId.trim() || defaultPackageOf(trimmed)).toLowerCase();
    if (!/^[a-z][a-z0-9_]*$/.test(appId) && !/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(appId)) {
      setAppIdError(t('hub.errAppId'));
      return;
    }

    const templateKey = newProjectTemplate === 'blank' ? undefined : newProjectTemplate;
    const newProj = createBlankProject(trimmed, {
      resolution: newProjectResolution,
      templateKey,
      packageName: appId,
      orientation: newProjectOrientation,
      ramKb: newProjectRamKb,
      storagePath: newProjectStoragePath || (isDesktop() ? workspaceRoot() : undefined)
    });
    if (activeFolderId) {
      newProj.folderId = activeFolderId;
    }

    onCreateProject(newProj);
    setIsCreateModalOpen(false);
    setNewProjectName('');
    setNewProjectAppId('');
    setAppIdTouched(false);
    setAppIdError(null);
    setNewProjectStoragePath(null);
    setNameError(null);
  };

  // Handle Build .vxp of a Project (biên dịch + đóng gói Lua vào .vxp — không tải file)
  const handleQuickExport = async (e: React.MouseEvent, proj: VXPProject) => {
    e.stopPropagation();
    try {
      setExportingProjectId(proj.id);
      // Build .vxp thật: Lua → luac → PackApp → <workspace>/<slug>/build/<slug>.vxp
      const { isDesktop, buildProjectVxpDesktop } = await import('../../utils/desktop');
      const { projectDirOf, ramKbOf } = await import('../../utils/projectConfig');
      const { useAppStore } = await import('../../store/appStore');
      const notify = useAppStore.getState().notify;
      const luaCode = proj.customLuaCode || useAppStore.getState().luaCode;

      if (!isDesktop()) {
        notify(t('hub.needDesktop'), 5000);
        return;
      }
      const buildDir = `${projectDirOf(proj) || proj.id}/build`;
      const appIdHash = Math.abs(
        Array.from(proj.packageName || proj.name).reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) & 0xffffffff, 0)
      ) % 65536 || 67502;
      const res = await buildProjectVxpDesktop(luaCode, proj.name, buildDir, appIdHash, ramKbOf(proj));
      if (res && res.ok) {
        notify(t('hub.builtOk').replace('{name}', proj.name).replace('{kb}', String(Math.round(res.vxpBytes / 1024))), 5000);
      } else {
        const why = res ? res.output.slice(-200) : 'toolchain không khả dụng';
        console.error('[quick build vxp]:', why);
        notify(t('hub.builtFail'), 5000);
      }
    } catch (err) {
      console.error('Quick build error:', err);
      void infoDialog({ title: t('hub.buildVxp'), message: t('hub.cantBuildVxp'), icon: 'warn' });
    } finally {
      setExportingProjectId(null);
    }
  };

  // Handle Duplicate Project
  const handleConfirmDuplicate = () => {
    if (!projectToDuplicate) return;
    const { list, newProject } = duplicateStoredProject(projectToDuplicate.id, duplicateName.trim() || undefined);
    onUpdateProjectsList(list);
    setProjectToDuplicate(null);
    setDuplicateName('');
  };

  // Handle Delete Project
  const handleConfirmDelete = () => {
    if (!projectToDelete) return;
    const updated = deleteStoredProject(projectToDelete.id);
    onUpdateProjectsList(updated);
    setProjectToDelete(null);
  };

  // Handle Loading Default Samples
  const handleLoadSamples = () => {
    const samples = loadDefaultSampleProjects();
    onUpdateProjectsList(samples);
  };

  // Shared JSON parsing used by both the browser file picker and the Tauri native dialog
  const applyJsonContent = (content: string) => {
    try {
      const parsed = JSON.parse(content);
      if (parsed.name && (parsed.components || parsed.customLuaCode)) {
        const now = formatDateTime();
        const importedProj: VXPProject = {
          ...parsed,
          id: `imported_${Date.now()}`,
          name: parsed.name + '_Imported',
          createdAt: now,
          modifiedAt: now
        };
        const updated = [importedProj, ...projects];
        onUpdateProjectsList(updated);
        setIsImportModalOpen(false);
      } else {
        void infoDialog({ title: t('hub.import'), message: t('hub.badJson'), icon: 'warn' });
      }
    } catch (err) {
      void infoDialog({ title: t('hub.import'), message: t('hub.cantReadJson'), icon: 'warn' });
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Import Project JSON: native dialog under Tauri, browser file picker otherwise
  const handleImportProject = async () => {
    if (isDesktop()) {
      const picked = await pickDesktopProjectJson();
      if (picked) applyJsonContent(picked.content);
      return;
    }
    fileInputRef.current?.click();
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => applyJsonContent(event.target?.result as string);
    reader.readAsText(file);
  };

  return (
    <div className="min-h-screen w-full bg-[#EFEAF6] text-[#221E2B] flex flex-col select-none font-sans">
      {/* 1. VXP Brand Top Navbar */}
      <header className="h-14 bg-[#EFEAF6] border-b border-[#E0D9EC] px-4 md:px-6 flex items-center justify-between z-30">
        <div className="flex items-center gap-3">
          {/* VXP App Icon */}
          <img src="/app-icon.png" alt="VXPFlow" className="w-8 h-8 rounded-lg object-cover shadow-md" />
          <span className="text-[#221E2B] font-bold text-lg tracking-tight flex items-center gap-1.5">
            VXPFlow
            <span className="text-[#6D28D9]">— Drag &amp; Drop</span>
            <span className="text-[10px] bg-[#F3EEFA] text-[#494256] border border-[#CBC3DD] px-1.5 py-0.5 rounded font-mono font-normal ml-1">
              MRE S30+
            </span>
          </span>
        </div>

        {/* Right side utility icons */}
        <div className="flex items-center gap-3">
          <LanguageSwitcher />

          {/* Free Badge */}
          <span className="px-3 py-1 rounded-full bg-[#FDFCFF] border border-[#E4DEF1] text-[11px] font-medium text-[#221E2B]">
            Free
          </span>

          <button 
            onClick={onOpenDocs}
            className="w-8 h-8 rounded-full hover:bg-[#F3EEFA] flex items-center justify-center text-[#494256] hover:text-[#221E2B] transition-colors"
            title={t('hub.docsTitle')}
          >
            <BookOpen className="w-4 h-4" />
          </button>

          <button
            onClick={() => setIsSettingsOpen(true)}
            className="w-8 h-8 rounded-full hover:bg-[#F3EEFA] flex items-center justify-center text-[#494256] hover:text-[#221E2B] transition-colors"
            title={t('st.title')}
          >
            <SettingsIcon className="w-4 h-4" />
          </button>

          <button 
            className="w-8 h-8 rounded-full hover:bg-[#F3EEFA] flex items-center justify-center text-[#494256] hover:text-[#221E2B] transition-colors"
            title={t('hub.themeTitle')}
          >
            <Sun className="w-4 h-4" />
          </button>

          {/* User Avatar Circle */}
          <div className="w-8 h-8 rounded-full bg-[#F3EEFA] border border-[#CBC3DD] flex items-center justify-center text-xs font-semibold text-[#221E2B]">
            U
          </div>
        </div>
      </header>

      {/* 2. Main VXP Toolbar */}
      <div className="px-6 py-3 bg-[#EFEAF6]/80 border-b border-[#E0D9EC] flex flex-wrap items-center justify-between gap-3">
        {/* Left Actions: Create project, Import project, New Folder, Search */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              setNewProjectName('');
              setNameError(null);
    if (isDesktop() && !newProjectStoragePath) setNewProjectStoragePath(workspaceRoot());
              setIsCreateModalOpen(true);
            }}
            className="px-4 py-1.5 bg-[#F7F3FC] hover:bg-[#F3EEFA] border border-[#CBC3DD] hover:border-[#6750A4] text-[#221E2B] text-xs font-medium rounded transition-all flex items-center gap-1.5 shadow-sm"
          >
            <Plus className="w-3.5 h-3.5 text-[#6750A4]" />
            <span>{t('hub.create')}</span>
          </button>

          <button
            onClick={() => setIsImportModalOpen(true)}
            className="px-4 py-1.5 bg-[#F7F3FC] hover:bg-[#F3EEFA] border border-[#CBC3DD] hover:border-[#6750A4] text-[#221E2B] text-xs font-medium rounded transition-all flex items-center gap-1.5"
          >
            <Upload className="w-3.5 h-3.5 text-[#0284C7]" />
            <span>{t('hub.import')}</span>
          </button>

          <button
            onClick={() => setIsNewFolderModalOpen(true)}
            className="px-4 py-1.5 bg-[#F7F3FC] hover:bg-[#F3EEFA] border border-[#CBC3DD] hover:border-[#6750A4] text-[#221E2B] text-xs font-medium rounded transition-all flex items-center gap-1.5"
          >
            <FolderPlus className="w-3.5 h-3.5 text-[#B45309]" />
            <span>{t('hub.newFolder')}</span>
          </button>

          {/* Search Toggle / Input */}
          <div className="relative flex items-center">
            {isSearchOpen ? (
              <div className="flex items-center bg-[#F7F3FC] border border-[#6750A4] rounded px-2 py-1 text-xs">
                <Search className="w-3.5 h-3.5 text-[#494256] mr-1.5 shrink-0" />
                <input
                  type="text"
                  placeholder={t('hub.searchPlaceholder')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoFocus
                  className="bg-transparent border-none text-[#221E2B] focus:outline-none w-36 sm:w-48 text-xs"
                />
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setIsSearchOpen(false);
                  }}
                  className="text-[#494256] hover:text-[#221E2B] ml-1"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsSearchOpen(true)}
                className="p-1.5 bg-[#F7F3FC] hover:bg-[#F3EEFA] border border-[#CBC3DD] text-[#494256] hover:text-[#221E2B] rounded transition-colors"
                title={t('hub.search')}
              >
                <Search className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Right Controls: Sort by dropdown & Grid/List view toggles */}
        <div className="flex items-center gap-3">
          {/* Sort By Dropdown */}
          <div className="flex items-center text-xs">
            <span className="text-[#494256] mr-1.5 hidden sm:inline">{t('hub.sort')}</span>
            <div className="relative">
              <select
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value as SortOption)}
                className="bg-[#F7F3FC] border border-[#CBC3DD] text-[#221E2B] text-xs rounded px-2.5 py-1.5 pr-7 appearance-none cursor-pointer hover:border-[#6750A4] focus:outline-none focus:border-[#6750A4]"
              >
                <option value="modified_desc">{t('hub.sortModDesc')}</option>
                <option value="modified_asc">{t('hub.sortModAsc')}</option>
                <option value="created_desc">{t('hub.sortCreDesc')}</option>
                <option value="created_asc">{t('hub.sortCreAsc')}</option>
                <option value="name_asc">{t('hub.sortNameAsc')}</option>
                <option value="name_desc">{t('hub.sortNameDesc')}</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-[#494256] absolute right-2 top-2.5 pointer-events-none" />
            </div>
          </div>

          {/* View Switchers: Grid, List */}
          <div className="flex items-center bg-[#F7F3FC] border border-[#CBC3DD] rounded p-0.5">
            <button
              onClick={() => setViewStyle('grid')}
              className={`p-1.5 rounded transition-colors ${
                viewStyle === 'grid' 
                  ? 'bg-[#E4DEF1] text-[#221E2B] shadow-sm' 
                  : 'text-[#494256] hover:text-[#221E2B]'
              }`}
              title={t("hub.grid")}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewStyle('list')}
              className={`p-1.5 rounded transition-colors ${
                viewStyle === 'list' 
                  ? 'bg-[#E4DEF1] text-[#221E2B] shadow-sm' 
                  : 'text-[#494256] hover:text-[#221E2B]'
              }`}
              title={t("hub.list")}
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* 3. Sub-bar: Breadcrumb / Folder Filter */}
      <div className="px-6 py-2 bg-[#EFEAF6] flex items-center justify-between text-xs text-[#494256] border-b border-[#1A1C20]">
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setActiveFolderId(null)}
            className={`flex items-center gap-1.5 font-medium hover:text-[#221E2B] transition-colors ${!activeFolderId ? 'text-[#221E2B]' : 'text-[#494256]'}`}
          >
            <Folder className="w-3.5 h-3.5 text-[#B45309]" />
            <span>{t('hub.projects')}</span>
          </button>

          {activeFolderId && (
            <>
              <span>/</span>
              <span className="text-[#221E2B] font-medium">
                {folders.find(f => f.id === activeFolderId)?.name || 'Folder'}
              </span>
            </>
          )}

          <span className="text-[#6F687E] text-[11px] ml-2">
            ({displayedProjects.length} {t('hub.count')})
          </span>
        </div>

        {/* Quick sample loader shortcut if empty */}
        {projects.length === 0 && (
          <button
            onClick={handleLoadSamples}
            className="text-[11px] text-[#0284C7] hover:underline flex items-center gap-1"
          >
            <Sparkles className="w-3 h-3" />
            {t('hub.samples.short')}
          </button>
        )}
      </div>

      {/* 4. Main Body: Project Grid or List View */}
      <main className="flex-1 p-6 overflow-y-auto">
        {/* EMPTY STATE (Default when no projects exist) */}
        {displayedProjects.length === 0 ? (
          <div className="h-[60vh] flex flex-col items-center justify-center text-center p-6 max-w-md mx-auto">
            <h3 className="text-lg font-bold text-[#221E2B] mb-1">
              {t('hub.empty.title')}
            </h3>
            <p className="text-xs text-[#494256] leading-relaxed mb-6">
              {t('hub.empty.desc')}
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-3 w-full justify-center">
              <button
                onClick={() => {
                  setNewProjectName('');
                  setNameError(null);
                  setIsCreateModalOpen(true);
                }}
                className="w-full sm:w-auto px-5 py-2.5 bg-[#6750A4] hover:bg-[#6750A4] text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-2 shadow-lg shadow-[#6750A4]/20 transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>{t('hub.create')}</span>
              </button>

              <button
                onClick={handleLoadSamples}
                className="w-full sm:w-auto px-5 py-2.5 bg-[#F7F3FC] hover:bg-[#F3EEFA] border border-[#CBC3DD] hover:border-[#B45309] text-[#221E2B] text-xs font-medium rounded-lg flex items-center justify-center gap-2 transition-all"
              >
                <Sparkles className="w-4 h-4 text-[#B45309]" />
                <span>{t('hub.samples')}</span>
              </button>
            </div>
          </div>
        ) : viewStyle === 'grid' ? (
          /* GRID VIEW */
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {displayedProjects.map((proj) => (
              <div
                key={proj.id}
                onClick={() => onSelectProject(proj)}
                className="bg-[#EFEAF6] hover:bg-[#F0EBF8] border border-[#E0D9EC] hover:border-[#6750A4] rounded-xl p-4 flex flex-col justify-between h-56 transition-all duration-200 cursor-pointer shadow-md hover:shadow-xl hover:-translate-y-0.5 group relative"
              >
                {/* Top Center: VXP Purple Circular Icon */}
                <div className="flex flex-col items-center pt-2">
                  <div className="w-12 h-12 rounded-full bg-[#5B21B6] border border-[#7C3AED]/40 flex items-center justify-center shadow-lg shadow-[#5B21B6]/30 mb-3 group-hover:scale-105 transition-transform">
                    <span className="text-white font-extrabold text-xl font-sans tracking-tight">V</span>
                  </div>

                  {/* Project Name (Centered, bold white) */}
                  <h4 className="text-sm font-bold text-[#221E2B] text-center tracking-tight truncate max-w-full px-2" title={proj.name}>
                    {proj.name}
                  </h4>
                </div>

                {/* Middle: Created & Modified timestamps */}
                <div className="text-center space-y-1 my-auto">
                  <p className="text-[11px] text-[#494256]">
                    {t('hub.created')} {proj.createdAt || 'Jun 16, 2024, 7:06:58 AM'}
                  </p>
                  <p className="text-[11px] text-[#494256]">
                    {t('hub.modified')} {proj.modifiedAt || 'Aug 22, 2026, 11:38:31 AM'}
                  </p>
                </div>

                {/* Bottom Action Footer: 3 icons as in the image */}
                <div className="pt-2 border-t border-[#1F2127] flex items-center justify-around text-[#494256]">
                  {/* Cloud Download / Export Icon */}
                  <button
                    onClick={(e) => handleQuickExport(e, proj)}
                    disabled={exportingProjectId === proj.id}
                    className="p-1.5 hover:text-[#0284C7] hover:bg-[#F3EEFA] rounded transition-colors"
                    title={t('hub.buildTitle')}
                  >
                    <CloudDownload className={`w-4 h-4 ${exportingProjectId === proj.id ? 'animate-bounce text-[#0284C7]' : ''}`} />
                  </button>

                  {/* Transfer / Duplicate / Move Icon */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setProjectToDuplicate(proj);
                      setDuplicateName(`${proj.name}_Copy`);
                    }}
                    className="p-1.5 hover:text-[#B45309] hover:bg-[#F3EEFA] rounded transition-colors"
                    title={t("hub.duplicate")}
                  >
                    <ArrowLeftRight className="w-4 h-4" />
                  </button>

                  {/* Trash Bin Icon */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setProjectToDelete(proj);
                    }}
                    className="p-1.5 hover:text-[#B91C1C] hover:bg-[#F3EEFA] rounded transition-colors"
                    title={t("hub.delete")}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* LIST / TABLE VIEW */
          <div className="bg-[#EFEAF6] border border-[#E0D9EC] rounded-xl overflow-hidden shadow-lg">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F7F3FC] text-[#494256] border-b border-[#E0D9EC] uppercase font-semibold text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">{t('hub.thName')}</th>
                  <th className="py-3 px-4">{t('hub.thRes')}</th>
                  <th className="py-3 px-4">{t('hub.thCreated')}</th>
                  <th className="py-3 px-4">{t('hub.thModified')}</th>
                  <th className="py-3 px-4 text-right">{t('hub.thActions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1F2127]">
                {displayedProjects.map((proj) => (
                  <tr 
                    key={proj.id}
                    onClick={() => onSelectProject(proj)}
                    className="hover:bg-[#1A1D24] cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4 flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-[#5B21B6] flex items-center justify-center text-white font-bold text-xs shrink-0">
                        k
                      </div>
                      <div>
                        <div className="font-bold text-[#221E2B] text-sm">{proj.name}</div>
                        <div className="text-[10px] text-[#494256] font-mono">{proj.packageName}</div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-[#221E2B]">
                      <span className="px-2 py-0.5 bg-[#F3EEFA] border border-[#CBC3DD] rounded text-[10px] font-mono">
                        {proj.resolution || '240x320'} S30+
                      </span>
                    </td>
                    <td className="py-3 px-4 text-[#494256]">
                      {proj.createdAt || 'N/A'}
                    </td>
                    <td className="py-3 px-4 text-[#494256]">
                      {proj.modifiedAt || 'N/A'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={(e) => handleQuickExport(e, proj)}
                          className="p-1.5 hover:text-[#0284C7] hover:bg-[#F3EEFA] rounded transition-colors"
                          title={t("hub.buildVxp")}
                        >
                          <CloudDownload className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setProjectToDuplicate(proj);
                            setDuplicateName(`${proj.name}_Copy`);
                          }}
                          className="p-1.5 hover:text-[#B45309] hover:bg-[#F3EEFA] rounded transition-colors"
                          title={t('hub.duplicateTitle')}
                        >
                          <ArrowLeftRight className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setProjectToDelete(proj)}
                          className="p-1.5 hover:text-[#B91C1C] hover:bg-[#F3EEFA] rounded transition-colors"
                          title={t('hub.deleteTitle')}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* MODAL 1: Create Project Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-[#F7F3FC] border border-[#E4DEF1] rounded-xl w-full max-w-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E0D9EC] bg-[#EFEAF6]">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full bg-[#5B21B6] flex items-center justify-center text-white font-bold text-sm">
                  V
                </div>
                <h3 className="font-bold text-[#221E2B] text-base">{t('hub.createTitle')}</h3>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-[#494256] hover:text-[#221E2B] p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-6 space-y-4 max-h-[85vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-semibold text-[#221E2B] mb-1">
                  {t('hub.thName')} <span className="text-[#B91C1C]">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder={t('hub.namePlaceholder')}
                  value={newProjectName}
                  onChange={(e) => {
                    setNewProjectName(e.target.value);
                    syncAppIdFromName(e.target.value);
                    setNameError(null);
                  }}
                  className="w-full bg-[#EFEAF6] border border-[#CBC3DD] focus:border-[#6750A4] rounded-lg px-3.5 py-2 text-[#221E2B] text-sm focus:outline-none transition-colors"
                  autoFocus
                />
                {nameError && (
                  <p className="text-[#B91C1C] text-xs mt-1">{nameError}</p>
                )}
                <p className="text-[11px] text-[#494256] mt-1">
                  {t('hub.nameHint')} <code>{newProjectName ? newProjectName.toLowerCase().replace(/[^a-z0-9]/g, '_') : 'app'}.vxp</code>.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#221E2B] mb-1">
                  {t('hub.appIdLabel')} <span className="text-[#B91C1C]">*</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    spellCheck={false}
                    placeholder="com.vxp.myapp"
                    value={newProjectAppId}
                    onChange={(e) => {
                      setNewProjectAppId(e.target.value);
                      setAppIdTouched(true);
                      setAppIdError(null);
                    }}
                    className="w-full bg-[#EFEAF6] border border-[#CBC3DD] focus:border-[#6750A4] rounded-lg px-3.5 py-2 text-[#221E2B] text-sm font-mono focus:outline-none transition-colors"
                  />
                  <button
                    type="button"
                    title={t('hub.resetAppId')}
                    onClick={() => {
                      setAppIdTouched(false);
                      setNewProjectAppId(defaultPackageOf(newProjectName));
                      setAppIdError(null);
                    }}
                    className="px-3 py-2 shrink-0 bg-[#F3EEFA] hover:bg-[#E4DEF1] border border-[#CBC3DD] text-[#494256] rounded-lg text-xs font-medium transition-colors cursor-pointer"
                  >
                    {t('hub.auto')}
                  </button>
                </div>
                {appIdError && (
                  <p className="text-[#B91C1C] text-xs mt-1">{appIdError}</p>
                )}
                <p className="text-[11px] text-[#494256] mt-1">
                  {t('hub.appIdHintPre')} <code>com.vxp.{newProjectName ? slugOf(newProjectName) : 'app'}</code> {t('hub.appIdHintPost')}
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#221E2B] mb-2">
                  {t('hub.orientation')}
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <div
                    onClick={() => chooseOrientation('portrait')}
                    className={`p-3 rounded-lg border cursor-pointer transition-all flex items-center gap-2 ${
                      newProjectOrientation === 'portrait'
                        ? 'bg-[#F3EEFA] border-[#6750A4]'
                        : 'bg-[#EFEAF6] border-[#E4DEF1] hover:border-[#CBC3DD]'
                    }`}
                  >
                    <RotateCw className="w-5 h-5 text-[#6750A4]" />
                    <div>
                      <div className="font-semibold text-xs text-[#221E2B]">{t('hub.portrait')}</div>
                      <div className="text-[10px] text-[#494256]">{t('hub.portraitDesc')}</div>
                    </div>
                  </div>
                  <div
                    onClick={() => chooseOrientation('landscape')}
                    className={`p-3 rounded-lg border cursor-pointer transition-all flex items-center gap-2 ${
                      newProjectOrientation === 'landscape'
                        ? 'bg-[#F3EEFA] border-[#6750A4]'
                        : 'bg-[#EFEAF6] border-[#E4DEF1] hover:border-[#CBC3DD]'
                    }`}
                  >
                    <RotateCcw className="w-5 h-5 text-[#6750A4]" />
                    <div>
                      <div className="font-semibold text-xs text-[#221E2B]">{t('hub.landscape')}</div>
                      <div className="text-[10px] text-[#494256]">{t('hub.landscapeDesc')}</div>
                    </div>
                  </div>
                </div>
                <div className="mt-2">
                  <select
                    value={newProjectResolution}
                    onChange={(e) => setNewProjectResolution(e.target.value as ScreenResolution)}
                    className="w-full bg-[#EFEAF6] border border-[#CBC3DD] focus:border-[#6750A4] rounded-lg px-3.5 py-2 text-[#221E2B] text-sm focus:outline-none cursor-pointer"
                  >
                    {RESOLUTIONS[newProjectOrientation].map(r => (
                      <option key={r.value} value={r.value}>
                        {r.label}{r.recommended ? ' ✓ (' + t('hub.recommended') + ')' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#221E2B] mb-1 flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-[#6750A4]" />
                  {t('hub.heapLabel')}
                </label>
                <select
                  value={newProjectRamKb}
                  onChange={(e) => setNewProjectRamKb(Number(e.target.value))}
                  className="w-full bg-[#EFEAF6] border border-[#CBC3DD] focus:border-[#6750A4] rounded-lg px-3.5 py-2 text-[#221E2B] text-sm focus:outline-none cursor-pointer"
                >
                  {RAM_OPTIONS.map(r => (
                    <option key={r.kb} value={r.kb}>
                      {r.label}{r.recommended ? ' ✓ (' + t('hub.ramOpt') + ')' : ''}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-[#494256] mt-1">
                  {t('hub.heapHint')}
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#221E2B] mb-2 flex items-center gap-1.5">
                  <HardDrive className="w-3.5 h-3.5 text-[#6750A4]" />
                  {t('hub.storageLabel')}
                </label>
                <div
                  onClick={isDesktop() ? handlePickStorageFolder : undefined}
                  title={!isDesktop() ? t('hub.storageOnlyDesktop') : undefined}
                  className={`p-3 rounded-lg border transition-all flex items-start gap-2.5 ${
                    isDesktop() ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'
                  } ${newProjectStoragePath ? 'bg-[#F3EEFA] border-[#6750A4]' : 'bg-[#EFEAF6] border-[#E4DEF1]'} ${isDesktop() ? 'hover:border-[#CBC3DD]' : ''}`}
                >
                  <Folder className={`mt-0.5 w-4 h-4 shrink-0 ${newProjectStoragePath ? 'text-[#6750A4]' : 'text-[#494256]'}`} />
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-xs text-[#221E2B]">
                      {newProjectStoragePath ? t('hub.storagePicked') : t('hub.storagePick')}
                      {!isDesktop() && <span className="text-[#B45309] font-normal ml-1">{t('hub.desktopOnly')}</span>}
                    </div>
                    {newProjectStoragePath ? (
                      <p className="text-[10px] text-[#494256] font-mono break-all mt-0.5">
                        <Folder className="inline w-3 h-3 text-[#6750A4] align-[-2px]" /> {newProjectStoragePath}/{slugOf(newProjectName) || 'app'}/
                      </p>
                    ) : (
                      <p className="text-[10px] text-[#494256]">
                        {isDesktop()
                          ? storageBusy
                            ? t('hub.storagePicking')
                            : t('hub.storagePickHint')
                          : t('hub.storageWebHint')}
                      </p>
                    )}
                  </div>
                </div>
                {newProjectStoragePath && (
                  <p className="text-[10px] text-[#494256] mt-1.5 ml-1">
                    {t('hub.storageStructure')} <code>{slugOf(newProjectName) || 'app'}/project.json + src/main.lua + assets/ + build/*.vxp</code>
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#221E2B] mb-2">
                  {t('hub.templateLabel')}
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <div
                    onClick={() => setNewProjectTemplate('blank')}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      newProjectTemplate === 'blank'
                        ? 'bg-[#F3EEFA] border-[#6750A4] text-[#221E2B]'
                        : 'bg-[#EFEAF6] border-[#E4DEF1] text-[#494256] hover:border-[#CBC3DD]'
                    }`}
                  >
                    <div className="font-semibold text-xs flex items-center gap-1.5 mb-1 text-[#221E2B]">
                      <FileText className="w-3.5 h-3.5 text-[#6750A4]" />
                      <span>{t('hub.tplBlank')}</span>
                    </div>
                    <p className="text-[10px] text-[#494256]">{t('hub.tplBlankDesc')}</p>
                  </div>

                  <div
                    onClick={() => setNewProjectTemplate('snake')}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      newProjectTemplate === 'snake'
                        ? 'bg-[#F3EEFA] border-[#6750A4] text-[#221E2B]'
                        : 'bg-[#EFEAF6] border-[#E4DEF1] text-[#494256] hover:border-[#CBC3DD]'
                    }`}
                  >
                    <div className="font-semibold text-xs flex items-center gap-1.5 mb-1 text-[#221E2B]">
                      <Gamepad2 className="w-3.5 h-3.5 text-[#22C55E]" />
                      <span>{t('hub.tplSnake')}</span>
                    </div>
                    <p className="text-[10px] text-[#494256]">{t('hub.tplSnakeDesc')}</p>
                  </div>

                  <div
                    onClick={() => setNewProjectTemplate('space_shooter')}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      newProjectTemplate === 'space_shooter'
                        ? 'bg-[#F3EEFA] border-[#6750A4] text-[#221E2B]'
                        : 'bg-[#EFEAF6] border-[#E4DEF1] text-[#494256] hover:border-[#CBC3DD]'
                    }`}
                  >
                    <div className="font-semibold text-xs flex items-center gap-1.5 mb-1 text-[#221E2B]">
                      <Rocket className="w-3.5 h-3.5 text-[#EF4444]" />
                      <span>Space Shooter</span>
                    </div>
                    <p className="text-[10px] text-[#494256]">{t('hub.tplSpaceDesc')}</p>
                  </div>

                  <div
                    onClick={() => setNewProjectTemplate('calculator')}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      newProjectTemplate === 'calculator'
                        ? 'bg-[#F3EEFA] border-[#6750A4] text-[#221E2B]'
                        : 'bg-[#EFEAF6] border-[#E4DEF1] text-[#494256] hover:border-[#CBC3DD]'
                    }`}
                  >
                    <div className="font-semibold text-xs flex items-center gap-1.5 mb-1 text-[#221E2B]">
                      <Calculator className="w-3.5 h-3.5 text-[#0EA5E9]" />
                      <span>{t('hub.tplCalc')}</span>
                    </div>
                    <p className="text-[10px] text-[#494256]">{t('hub.tplCalcDesc')}</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E0D9EC]">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 bg-[#F3EEFA] hover:bg-[#E4DEF1] text-[#221E2B] rounded-lg text-xs font-medium transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#6750A4] hover:bg-[#6750A4] text-white rounded-lg text-xs font-semibold shadow-md transition-colors flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{t('hub.create')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Import Project Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#F7F3FC] border border-[#E4DEF1] rounded-xl w-full max-w-md shadow-2xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-[#E0D9EC] mb-4">
              <h3 className="font-bold text-[#221E2B] text-sm flex items-center gap-2">
                <Upload className="w-4 h-4 text-[#0284C7]" />
                {t('hub.import')}
              </h3>
              <button onClick={() => setIsImportModalOpen(false)} className="text-[#494256] hover:text-[#221E2B]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[#494256] mb-4">
              {t('hub.importDesc')}
            </p>

            <div
              role="button"
              tabIndex={0}
              onClick={() => void handleImportProject()}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') void handleImportProject(); }}
              className="border-2 border-dashed border-[#CBC3DD] hover:border-[#6750A4] rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition-colors bg-[#EFEAF6]"
            >
              <Upload className="w-8 h-8 text-[#6750A4] mb-2" />
              <span className="text-xs font-medium text-[#221E2B] mb-1">{t('hub.importPick')}</span>
              <span className="text-[10px] text-[#6F687E]">{t('hub.importSupport')}</span>
              <input ref={fileInputRef} type="file" accept=".json" onChange={handleImportFile} className="hidden" />
            </div>

            <div className="flex justify-end mt-4">
              <button
                onClick={() => setIsImportModalOpen(false)}
                className="px-4 py-1.5 bg-[#F3EEFA] hover:bg-[#E4DEF1] text-[#221E2B] text-xs rounded-lg"
              >
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: New Folder Modal */}
      {isNewFolderModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#F7F3FC] border border-[#E4DEF1] rounded-xl w-full max-w-sm shadow-2xl p-6">
            <h3 className="font-bold text-[#221E2B] text-sm mb-3 flex items-center gap-2">
              <FolderPlus className="w-4 h-4 text-[#B45309]" />
              {t('hub.folderTitle')}
            </h3>
            <input
              type="text"
              id="new-folder-input"
              placeholder={t('hub.folderPlaceholder')}
              className="w-full bg-[#EFEAF6] border border-[#CBC3DD] rounded-lg px-3 py-2 text-[#221E2B] text-xs mb-4 focus:outline-none focus:border-[#6750A4]"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setIsNewFolderModalOpen(false)}
                className="px-3 py-1.5 bg-[#F3EEFA] text-xs rounded text-[#494256] hover:text-[#221E2B]"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={() => {
                  const input = document.getElementById('new-folder-input') as HTMLInputElement;
                  if (input && input.value.trim()) {
                    // We can manage folders list
                    setIsNewFolderModalOpen(false);
                  }
                }}
                className="px-4 py-1.5 bg-[#6750A4] hover:bg-[#6750A4] text-xs font-semibold rounded text-white"
              >
                {t('hub.createFolder')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: Duplicate Project Modal */}
      {projectToDuplicate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#F7F3FC] border border-[#E4DEF1] rounded-xl w-full max-w-sm shadow-2xl p-6">
            <h3 className="font-bold text-[#221E2B] text-sm mb-3 flex items-center gap-2">
              <ArrowLeftRight className="w-4 h-4 text-[#B45309]" />
              {t('hub.dupTitle')}
            </h3>
            <p className="text-xs text-[#494256] mb-3">
              {t('hub.dupDesc')} <strong className="text-[#221E2B]">{projectToDuplicate.name}</strong>:
            </p>
            <input
              type="text"
              value={duplicateName}
              onChange={(e) => setDuplicateName(e.target.value)}
              className="w-full bg-[#EFEAF6] border border-[#CBC3DD] rounded-lg px-3 py-2 text-[#221E2B] text-xs mb-4 focus:outline-none focus:border-[#6750A4]"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setProjectToDuplicate(null)}
                className="px-3 py-1.5 bg-[#F3EEFA] text-xs rounded text-[#494256] hover:text-[#221E2B]"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleConfirmDuplicate}
                className="px-4 py-1.5 bg-[#6750A4] hover:bg-[#6750A4] text-xs font-semibold rounded text-white"
              >
                {t('hub.dupBtn')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: Delete Confirmation Modal */}
      {projectToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#F7F3FC] border border-[#B91C1C]/40 rounded-xl w-full max-w-sm shadow-2xl p-6">
            <div className="flex items-center gap-3 text-[#B91C1C] mb-3">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="font-bold text-[#221E2B] text-sm">{t('hub.delTitle')}</h3>
            </div>
            <p className="text-xs text-[#221E2B] mb-4 leading-relaxed">
              {t('hub.delDesc')} <strong className="text-[#221E2B] font-semibold">"{projectToDelete.name}"</strong>{t('hub.delDescPost')}
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setProjectToDelete(null)}
                className="px-3 py-1.5 bg-[#F3EEFA] hover:bg-[#E4DEF1] text-xs rounded text-[#221E2B]"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-4 py-1.5 bg-[#B91C1C] hover:bg-[#DC2626] text-xs font-semibold rounded text-white"
              >
                {t('hub.delBtn')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Settings & Environment (menu icon Settings) ===== */}
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

      {/* ===== Installing Modal: lần đầu mở app — cài môi trường đầy đủ ===== */}
      <InstallingModal />

      {/* Footer */}
      <footer className="h-8 bg-[#EFEAF6] border-t border-[#E0D9EC] flex items-center justify-between px-6 text-[10px] text-[#6F687E]">
        <span>VXPFlow Studio · Nokia S30+ (MRE / VXP)</span>
        <span>{t('hub.storage')}</span>
      </footer>
    </div>
  );
};
