import React, { useEffect, useState } from 'react';
import { X, RefreshCw, Gamepad2, FolderX } from 'lucide-react';
import { VXPProject, EmulatorDevice } from '../../types';
import { getStoredProjects } from '../../utils/projectStorage';
import { readActiveProjectId } from '../../store/appStore';
import { VxpEmulator } from './VxpEmulator';
import { generateLuaFromProject, LUA_GEN_MARKER } from '../../utils/luaGenerator';
import { DEFAULT_SCREEN_NAME } from '../../utils/screens';

const DEVICE_KEY = 'vxp_emulator_device';

interface EmulatorSession {
  project: VXPProject;
  luaCode: string;
}

function loadSession(): EmulatorSession | null {
  const list = getStoredProjects();
  const activeId = readActiveProjectId();
  const project = (activeId && list.find(p => p.id === activeId)) || list[0];
  if (!project) return null;

  // Luôn sinh lại mã Lua từ Design/Blocks để đảm bảo hiển thị đúng.
  // Không tin customLuaCode từ localStorage vì nó có thể đã cũ từ phiên trước.
  const luaCode = generateLuaFromProject(
    project.components || [],
    project.blocks || [],
    project.name || 'VXP App',
    project.entryScreen || DEFAULT_SCREEN_NAME,
    project.extensions || [],
    project.resolution
  );
  return { project, luaCode };
}

function loadDevice(): EmulatorDevice {
  try {
    const v = localStorage.getItem(DEVICE_KEY);
    if (v === 'android' || v === 's30plus') return v;
  } catch {
    /* ignore */
  }
  return 's30plus';
}

/**
 * Cửa sổ giả lập RIÊNG — không nằm chung với studio.
 *
 * Được mở bởi openEmulatorWindow() (#/emulator). Đọc dự án đang mở từ
 * localStorage dùng chung, và tự nạp lại khi cửa sổ studio ghi thay đổi
 * (storage event), nên bạn có thể sửa game ở studio rồi xem kết quả ngay
 * trong cửa sổ này mà không cần đóng/mở lại.
 */
export const EmulatorWindow: React.FC = () => {
  const [session, setSession] = useState<EmulatorSession | null>(loadSession);
  const [device, setDevice] = useState<EmulatorDevice>(loadDevice);
  const [runKey, setRunKey] = useState<number>(0);
  const [lastSync, setLastSync] = useState<string>(() => new Date().toLocaleTimeString('vi-VN'));

  // Live sync: cửa sổ studio tự đồng bộ mã Lua (Design/Blocks thay đổi) và ghi
  // localStorage → sự kiện storage chạy ở mọi cửa sổ khác cùng origin → tự nạp
  // lại + chạy lại, không cần bấm gì.
  useEffect(() => {
    const reload = (e: StorageEvent) => {
      if (e.key && e.key !== 'vxp_creator_projects' && e.key !== 'vxp_creator_active_project') return;
      const next = loadSession();
      if (!next) return;
      setSession(next);
      setRunKey(k => k + 1); // remount → game loop chạy lại với code mới
      setLastSync(new Date().toLocaleTimeString('vi-VN'));
    };
    window.addEventListener('storage', reload);
    return () => window.removeEventListener('storage', reload);
  }, []);

  // Cửa sổ này cũng có thể mở trực tiếp từ URL (#/emulator) — thêm nút làm mới
  // để chủ động nạp lại code hiện hành từ dự án đang lưu.
  const reloadSession = () => {
    const next = loadSession();
    if (next) {
      setSession(next);
      setRunKey(k => k + 1);
      setLastSync(new Date().toLocaleTimeString('vi-VN'));
    }
  };

  const changeDevice = (d: EmulatorDevice) => {
    setDevice(d);
    try {
      localStorage.setItem(DEVICE_KEY, d);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-[#EFEAF6] text-[#221E2B] overflow-hidden font-sans">
      {/* Window title bar */}
      <div className="h-11 bg-[#F7F3FC] border-b border-[#E4DEF1] px-4 flex items-center justify-between shrink-0 select-none">
        <div className="flex items-center gap-2.5 min-w-0">
          <img src="/app-icon.png" alt="VXPFlow" className="w-7 h-7 rounded-lg object-cover shadow" />
          <div className="flex flex-col min-w-0 leading-tight">
            <span className="text-xs font-bold flex items-center gap-1.5">
              <Gamepad2 className="w-3.5 h-3.5 text-[#047857]" />
              Live Testing — Cửa sổ chạy thử
            </span>
            <span className="text-[10px] text-[#6F687E] truncate">
              {session ? `${session.project.name} • ${session.project.resolution} • đồng bộ ${lastSync}` : 'Chưa có dự án'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={reloadSession}
            className="p-2 rounded-lg bg-[#F3EEFA] hover:bg-[#E4DEF1] border border-[#CBC3DD] text-[#494256] hover:text-[#221E2B] transition-colors cursor-pointer"
            title="Nạp lại code hiện hành từ dự án đang lưu"
            aria-label="Nạp lại giả lập"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => window.close()}
            className="p-2 rounded-lg bg-[#F3EEFA] hover:bg-red-100 border border-[#CBC3DD] text-[#494256] hover:text-red-700 transition-colors cursor-pointer"
            title="Đóng cửa sổ giả lập"
            aria-label="Đóng cửa sổ giả lập"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Emulator body */}
      <div className="flex-1 overflow-hidden">
        {session ? (
          <VxpEmulator
            key={runKey}
            project={session.project}
            luaCode={session.luaCode}
            device={device}
            onChangeDevice={changeDevice}
          />
        ) : (
          <div className="h-full flex flex-col items-center justify-center gap-3 text-center px-6">
            <FolderX className="w-10 h-10 text-[#A79EBD]" />
            <div className="text-sm font-semibold text-[#494256]">Chưa có dự án nào để giả lập</div>
            <p className="text-xs text-[#6F687E] max-w-sm">
              Tạo hoặc mở một dự án ở cửa sổ studio trước, rồi bấm nút làm mới — cửa sổ này sẽ tự
              nạp dự án đang mở.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};