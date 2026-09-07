import React, { useState, useEffect } from 'react';
import { 
  History, Clock, RotateCcw, Trash2, X, ShieldCheck, 
  Download, AlertCircle, CheckCircle2, Save, Layers, Blocks, Puzzle } from 'lucide-react';
import { 
  ProjectBackupSnapshot, 
  getStoredBackups, 
  createAutoBackup, 
  deleteStoredBackup, 
  clearStoredBackups 
} from '../../utils/projectStorage';
import { VXPProject } from '../../types';
import { debugLogger } from '../../utils/debugLogger';

interface BackupHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeProject: VXPProject;
  onRestoreProject: (project: VXPProject) => void;
}

export const BackupHistoryModal: React.FC<BackupHistoryModalProps> = ({
  isOpen,
  onClose,
  activeProject,
  onRestoreProject
}) => {
  const [backups, setBackups] = useState<ProjectBackupSnapshot[]>([]);
  const [notification, setNotification] = useState<string | null>(null);

  const reloadBackups = () => {
    const list = getStoredBackups(activeProject?.id);
    setBackups(list);
  };

  useEffect(() => {
    if (isOpen) {
      reloadBackups();
    }
  }, [isOpen, activeProject?.id]);

  if (!isOpen) return null;

  const handleCreateManualBackup = () => {
    const newSnapshot = createAutoBackup(activeProject, 'manual', 'Sao lưu thủ công của người dùng');
    if (newSnapshot) {
      reloadBackups();
      setNotification('Đã tạo bản sao lưu mới thành công!');
      setTimeout(() => setNotification(null), 3000);
      debugLogger.info('AutoBackup', `Tạo bản sao lưu thủ công cho "${activeProject.name}"`);
    }
  };

  const handleRestore = (snapshot: ProjectBackupSnapshot) => {
    if (window.confirm(`Bạn có chắc chắn muốn khôi phục dự án về bản sao lưu lúc ${snapshot.timestamp}?`)) {
      onRestoreProject(snapshot.data);
      setNotification(`Đã khôi phục dự án từ bản sao lưu lúc ${snapshot.timestamp}!`);
      debugLogger.info('AutoBackup', `Khôi phục dự án "${snapshot.projectName}" từ bản sao lưu ${snapshot.id}`);
      setTimeout(() => {
        setNotification(null);
        onClose();
      }, 1500);
    }
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteStoredBackup(id);
    reloadBackups();
    debugLogger.info('AutoBackup', `Đã xóa bản sao lưu ${id}`);
  };

  const handleClearAll = () => {
    if (window.confirm('Bạn có chắc chắn muốn xóa toàn bộ lịch sử sao lưu của dự án này?')) {
      clearStoredBackups(activeProject?.id);
      reloadBackups();
      setNotification('Đã dọn sạch toàn bộ bản sao lưu.');
      setTimeout(() => setNotification(null), 2500);
    }
  };

  const handleExportBackupJson = (snapshot: ProjectBackupSnapshot) => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(snapshot.data, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `${snapshot.projectName}_backup_${snapshot.timestampMs || Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#F7F3FC] border border-[#E4DEF1] rounded-xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#E8E1F3] flex items-center justify-between bg-[#EFEAF6]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#047857]/20 border border-[#047857]/40 flex items-center justify-center text-[#047857]">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#221E2B] flex items-center gap-2">
                <span>Lịch sử sao lưu tự động (Auto-Backup)</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#F3EEFA] text-[#494256] border border-[#CBC3DD]">
                  {backups.length} / 15 bản ghi
                </span>
              </h2>
              <p className="text-[11px] text-[#494256]">
                Bảo vệ dự án an toàn trước sự cố đóng trình duyệt hoặc tải lại ngoài ý muốn
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-[#494256] hover:text-[#221E2B] p-1 rounded-lg hover:bg-[#E8E1F3] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Info Banner & Actions */}
        <div className="px-5 py-3 bg-[#0E1015] border-b border-[#E8E1F3] flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-[11px] text-[#221E2B]">
            <Clock className="w-4 h-4 text-[#0284C7] shrink-0" />
            <span>Tự động tạo bản sao mỗi <strong>5 phút</strong> hoặc khi sửa đổi cấu trúc linh kiện.</span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleCreateManualBackup}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#047857] hover:bg-[#065F46] text-white text-[11px] font-medium transition-colors shadow-sm"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Sao lưu ngay</span>
            </button>

            {backups.length > 0 && (
              <button
                onClick={handleClearAll}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#1F242E] hover:bg-red-950 text-[#494256] hover:text-red-600 border border-[#2D3342] hover:border-red-800 text-[11px] transition-colors"
                title="Xóa toàn bộ bản sao lưu cũ"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Xóa hết</span>
              </button>
            )}
          </div>
        </div>

        {/* Notifications */}
        {notification && (
          <div className="mx-5 mt-3 p-2.5 bg-emerald-950/60 border border-emerald-700/60 text-emerald-600 rounded-lg text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{notification}</span>
          </div>
        )}

        {/* Backups List */}
        <div className="flex-1 overflow-y-auto p-5 space-y-2.5">
          {backups.length === 0 ? (
            <div className="py-12 text-center text-[#6F687E]">
              <History className="w-10 h-10 mx-auto mb-2 opacity-40 text-[#494256]" />
              <p className="text-sm font-medium text-[#221E2B] mb-1">Chưa có bản sao lưu tự động nào</p>
              <p className="text-xs">Hệ thống sẽ bắt đầu sao lưu sau 5 phút làm việc hoặc khi bạn nhấn "Sao lưu ngay".</p>
            </div>
          ) : (
            backups.map((snapshot) => {
              const dateObj = new Date(snapshot.timestampMs || Date.now());
              const dateFormatted = !isNaN(dateObj.getTime()) ? dateObj.toLocaleDateString('vi-VN') : '';
              const timeFormatted = !isNaN(dateObj.getTime()) ? dateObj.toLocaleTimeString('vi-VN') : snapshot.timestamp;

              return (
                <div
                  key={snapshot.id}
                  className="bg-[#EFEAF6] hover:bg-[#1A1D24] border border-[#E4DEF1] hover:border-[#0284C7]/40 rounded-xl p-3.5 transition-all flex items-center justify-between gap-4 group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-[#F3EEFA] border border-[#CBC3DD] flex items-center justify-center text-[#0284C7] shrink-0 font-mono text-xs">
                      <Clock className="w-4 h-4" />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-[#221E2B] text-xs">
                          {timeFormatted} {dateFormatted ? `• ${dateFormatted}` : ''}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#F3EEFA] border border-[#CBC3DD] text-[#6D28D9] font-medium">
                          {snapshot.reasonLabel || snapshot.reason}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-[10px] text-[#494256] mt-1 font-mono">
                        <span className="flex items-center gap-1">
                          <Layers className="w-3 h-3 text-[#0284C7]" />
                          <span>{snapshot.componentCount} linh kiện</span>
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Blocks className="w-3 h-3 text-[#B45309]" />
                          <span>{snapshot.blockCount} khối lệnh</span>
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Puzzle className="w-3 h-3 text-[#8b5cf6]" />
                          <span>{snapshot.extensionCount || 0} tiện ích</span>
                        </span>
                        <span>•</span>
                        <span>Độ phân giải: 240x320</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions for snapshot */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => handleRestore(snapshot)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-semibold transition-colors shadow-sm"
                      title="Khôi phục trạng thái dự án về thời điểm này"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Khôi phục</span>
                    </button>

                    <button
                      onClick={() => handleExportBackupJson(snapshot)}
                      className="p-1.5 text-[#494256] hover:text-[#221E2B] rounded-lg hover:bg-[#E8E1F3] transition-colors border border-transparent hover:border-[#CBC3DD]"
                      title="Tải tệp JSON của bản sao này"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={(e) => handleDelete(snapshot.id, e)}
                      className="p-1.5 text-[#494256] hover:text-red-600 rounded-lg hover:bg-[#E8E1F3] transition-colors border border-transparent hover:border-red-900"
                      title="Xóa bản sao lưu này"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#E8E1F3] bg-[#EFEAF6] flex items-center justify-between text-xs text-[#494256]">
          <span>Lưu trữ tối đa 15 bản sao gần nhất trong LocalStorage</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[#F3EEFA] hover:bg-[#2D3748] text-[#221E2B] font-medium transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
