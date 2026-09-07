import React, { useState } from 'react';
import { BookOpen, X, Smartphone, Cpu, Code, Layers, PlayCircle, Download, CheckCircle, HelpCircle } from 'lucide-react';

interface DocsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DocsModal: React.FC<DocsModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'intro' | 'designer' | 'blocks' | 'lua' | 's30install' | 'android'>('intro');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-[#F7F3FC] border border-[#E4DEF1] w-full max-w-4xl h-[85vh] rounded-xl flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E4DEF1] bg-[#EFEAF6]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#6750A4]/15 text-[#6750A4] rounded-lg border border-[#6750A4]/30">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#221E2B] flex items-center gap-2">
                VXPFlow Developer Docs
                <span className="text-xs bg-[#047857]/15 text-[#047857] border border-[#047857]/40 px-2 py-0.5 rounded-full font-mono">v1.2 S30+ MRE</span>
              </h2>
              <p className="text-xs text-[#494256]">Tài liệu hướng dẫn phát triển ứng dụng &amp; game VXP cho Nokia S30+ và Giả lập Android</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-[#494256] hover:text-[#221E2B] hover:bg-[#F3EEFA] rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Layout */}
        <div className="flex-1 flex overflow-hidden">
          {/* Navigation Sidebar */}
          <div className="w-64 bg-[#EFEAF6] border-r border-[#E4DEF1] p-3 space-y-1 select-none shrink-0">
            <button
              onClick={() => setActiveTab('intro')}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2.5 transition-colors ${
                activeTab === 'intro' ? 'bg-[#6750A4] text-white font-medium' : 'text-[#494256] hover:bg-[#F7F3FC] hover:text-[#221E2B]'
              }`}
            >
              <Cpu className="w-4 h-4 text-[#0284C7]" />
              1. Tổng quan MRE &amp; VXP
            </button>
            <button
              onClick={() => setActiveTab('designer')}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2.5 transition-colors ${
                activeTab === 'designer' ? 'bg-[#6750A4] text-white font-medium' : 'text-[#494256] hover:bg-[#F7F3FC] hover:text-[#221E2B]'
              }`}
            >
              <Layers className="w-4 h-4 text-[#B45309]" />
              2. Kéo thả Designer
            </button>
            <button
              onClick={() => setActiveTab('blocks')}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2.5 transition-colors ${
                activeTab === 'blocks' ? 'bg-[#6750A4] text-white font-medium' : 'text-[#494256] hover:bg-[#F7F3FC] hover:text-[#221E2B]'
              }`}
            >
              <Code className="w-4 h-4 text-[#047857]" />
              3. Lập trình Khối (Blocks)
            </button>
            <button
              onClick={() => setActiveTab('lua')}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2.5 transition-colors ${
                activeTab === 'lua' ? 'bg-[#6750A4] text-white font-medium' : 'text-[#494256] hover:bg-[#F7F3FC] hover:text-[#221E2B]'
              }`}
            >
              <Code className="w-4 h-4 text-[#A855F7]" />
              4. Tài liệu API Lua MRE
            </button>
            <button
              onClick={() => setActiveTab('s30install')}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2.5 transition-colors ${
                activeTab === 's30install' ? 'bg-[#6750A4] text-white font-medium' : 'text-[#494256] hover:bg-[#F7F3FC] hover:text-[#221E2B]'
              }`}
            >
              <Smartphone className="w-4 h-4 text-[#BE185D]" />
              5. Cài đặt trên Nokia S30+
            </button>
            <button
              onClick={() => setActiveTab('android')}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2.5 transition-colors ${
                activeTab === 'android' ? 'bg-[#6750A4] text-white font-medium' : 'text-[#494256] hover:bg-[#F7F3FC] hover:text-[#221E2B]'
              }`}
            >
              <PlayCircle className="w-4 h-4 text-[#059669]" />
              6. Live Testing (chạy thử)
            </button>
          </div>

          {/* Main Body */}
          <div className="flex-1 p-6 overflow-y-auto bg-[#F7F3FC] text-[#221E2B] text-sm leading-relaxed space-y-6">
            {activeTab === 'intro' && (
              <div className="space-y-4">
                <h3 className="text-xl font-bold text-[#221E2B] flex items-center gap-2">
                  <Cpu className="w-5 h-5 text-[#0284C7]" />
                  MRE SDK &amp; Nền tảng VXP Nokia Series 30+ là gì?
                </h3>
                <p>
                  <strong>MRE (MediaTek Runtime Environment)</strong> là nền tảng thực thi ứng dụng nhẹ được phát triển bởi MediaTek dành cho các dòng điện thoại phổ thông chạy chipset MediaTek (như MT6260, MT6261). Nền tảng này được sử dụng trên hàng triệu thiết bị Nokia S30+ như <strong>Nokia 130, Nokia 150, Nokia 215, 216, 220, 222, 225, 230, Nokia 3310 (2017)</strong>.
                </p>
                <div className="p-4 bg-[#EFEAF6] rounded-lg border border-[#E4DEF1] space-y-2">
                  <h4 className="font-semibold text-[#0284C7]">Đặc điểm kỹ thuật chính:</h4>
                  <ul className="list-disc pl-5 space-y-1 text-xs text-[#494256]">
                    <li>Định dạng file thực thi: <code className="text-[#B45309]">.vxp</code></li>
                    <li>Độ phân giải màn hình chuẩn: <strong>240x320 pixels (QVGA)</strong> hoặc 128x160 (low-end).</li>
                    <li>Điều khiển: Phím 4 chiều (D-Pad), phím chọn chính giữa (OK), 2 phím chức năng mềm (Soft Left / Soft Right), bàn phím số T9 (0-9, *, #).</li>
                    <li>Ngôn ngữ kịch bản tích hợp: <strong>Lua 5.1/5.2</strong> kết hợp nhân C/C++ MRE Runtime.</li>
                  </ul>
                </div>
                <p>
                  <strong>VXPFlow</strong> mang trải nghiệm lập trình kéo thả hiện đại kết hợp khả năng viết mã Lua trực tiếp và trình biên dịch tạo file <code>.vxp</code> hoàn chỉnh chỉ với 1 cú nhấp chuột, trên nền tảng VXP MRE Nokia S30+.
                </p>
              </div>
            )}

            {activeTab === 'designer' && (
              <div className="space-y-4">
                <h3 className="text-xl font-bold text-[#221E2B] flex items-center gap-2">
                  <Layers className="w-5 h-5 text-[#B45309]" />
                  Hướng dẫn Kéo thả Giao diện (Designer)
                </h3>
                <p>
                  Giao diện Designer cho phép bạn tạo màn hình ứng dụng nhanh chóng mà không cần viết tọa độ thủ công:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-[#EFEAF6] rounded-lg border border-[#E4DEF1]">
                    <h4 className="font-bold text-[#047857] mb-2">Thành phần Giao diện (UI):</h4>
                    <ul className="text-xs space-y-1.5 text-[#494256]">
                      <li>• <strong>Button (Nút bấm):</strong> Nút bấm tương tác, hỗ trợ phím tắt số hoặc phím OK.</li>
                      <li>• <strong>Label (Nhãn):</strong> Hiển thị văn bản, điểm số, thông báo với kích cỡ font tùy chỉnh.</li>
                      <li>• <strong>TextBox:</strong> Khung nhập liệu văn bản hỗ trợ bàn phím T9.</li>
                      <li>• <strong>Canvas (Vùng vẽ):</strong> Bảng vẽ đồ họa 2D 240x320 dành cho game, vẽ pixel, sprite.</li>
                      <li>• <strong>Sprite (Nhân vật):</strong> Đối tượng nhân vật trong game có tọa độ X, Y, tốc độ và hướng di chuyển.</li>
                    </ul>
                  </div>

                  <div className="p-4 bg-[#EFEAF6] rounded-lg border border-[#E4DEF1]">
                    <h4 className="font-bold text-[#B45309] mb-2">Thành phần Phần cứng &amp; Hệ thống:</h4>
                    <ul className="text-xs space-y-1.5 text-[#494256]">
                      <li>• <strong>Clock / Timer (Đồng hồ chu kỳ):</strong> Kích hoạt vòng lặp game lặp lại sau mỗi mili-giây (ví dụ 50ms = 20fps).</li>
                      <li>• <strong>Sound (Âm thanh):</strong> Phát âm thanh retro 8-bit, tiếng bíp tần số cao hoặc chiptune.</li>
                      <li>• <strong>KeypadListener:</strong> Bắt sự kiện bấm phím D-Pad và phím số của máy Nokia.</li>
                      <li>• <strong>Vibrator:</strong> Kích hoạt motor rung của điện thoại.</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'blocks' && (
              <div className="space-y-4">
                <h3 className="text-xl font-bold text-[#221E2B] flex items-center gap-2">
                  <Code className="w-5 h-5 text-[#047857]" />
                  Lập trình Khối trực quan (Visual Blocks)
                </h3>
                <p>
                  Các khối lệnh được ghép nối logic với nhau:
                </p>
                <div className="space-y-3">
                  <div className="p-3 bg-amber-950/20 border border-amber-800/40 rounded-lg">
                    <span className="font-bold text-[#B45309] text-xs uppercase tracking-wider block mb-1">Khối Sự kiện (Events - Màu vàng)</span>
                    <p className="text-xs text-[#221E2B]">
                      <code>khi Screen.KhởiTạo</code>, <code>khi Nút.ĐượcBấm</code>, <code>khi ĐồngHồ.MỗiChuKỳ</code>, <code>khi BànPhím.NhấnPhím</code>. Đây là khối mấu chốt để bắt đầu mọi luồng xử lý.
                    </p>
                  </div>
                  <div className="p-3 bg-blue-950/20 border border-blue-800/40 rounded-lg">
                    <span className="font-bold text-[#0284C7] text-xs uppercase tracking-wider block mb-1">Khối Điều khiển &amp; Toán học (Control / Math - Màu xanh)</span>
                    <p className="text-xs text-[#221E2B]">
                      Câu lệnh điều kiện <code>nếu ... thì</code>, phép cộng trừ nhân chia, sinh số ngẫu nhiên <code>ngẫu nhiên từ min đến max</code> (ví dụ vị trí xuất hiện mồi quả táo trong game rắn).
                    </p>
                  </div>
                  <div className="p-3 bg-purple-950/20 border border-purple-800/40 rounded-lg">
                    <span className="font-bold text-[#7C3AED] text-xs uppercase tracking-wider block mb-1">Khối Đồ họa Game (Game &amp; Canvas - Màu tím)</span>
                    <p className="text-xs text-[#221E2B]">
                      Vẽ hình chữ nhật, vẽ pixel, di chuyển Sprite nhân vật, xóa màn hình.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'lua' && (
              <div className="space-y-4">
                <h3 className="text-xl font-bold text-[#221E2B] flex items-center gap-2">
                  <Code className="w-5 h-5 text-[#047857]" />
                  Bảng tra cứu API Lua MRE trong VXPFlow
                </h3>
                <p>Mọi block đều được biên dịch sang mã Lua 5.1/5.2 tiêu chuẩn của MRE SDK:</p>
                
                <div className="bg-[#EFEAF6] p-4 rounded-lg font-mono text-xs border border-[#E4DEF1] overflow-x-auto text-[#047857] shadow-inner">
                  <p className="text-[#6F687E]">-- 1. Khởi tạo ứng dụng</p>
                  <p>MRE.app_init(app_name, width, height)</p>
                  <br />
                  <p className="text-[#6F687E]">-- 2. Đồ họa màn hình</p>
                  <p>MRE.draw_rect(x, y, width, height, hexColor)</p>
                  <p>MRE.draw_text(text, x, y, hexColor, fontSize)</p>
                  <p>MRE.draw_pixel(x, y, hexColor)</p>
                  <p>MRE.draw_line(x1, y1, x2, y2, hexColor)</p>
                  <br />
                  <p className="text-[#6F687E]">-- 3. Âm thanh &amp; Rung</p>
                  <p>MRE.sound_play("click" | "jump" | "coin" | "hit" | "gameover")</p>
                  <p>MRE.sound_tone(frequency_hz, duration_ms)</p>
                  <p>MRE.vibrate(duration_ms)</p>
                  <br />
                  <p className="text-[#6F687E]">-- 4. Bàn phím &amp; Vòng lặp</p>
                  <p>MRE.register_key_listener(callback_func)</p>
                  <p>MRE.create_timer(interval_ms, callback_func)</p>
                </div>
              </div>
            )}

            {activeTab === 's30install' && (
              <div className="space-y-4">
                <h3 className="text-xl font-bold text-[#221E2B] flex items-center gap-2">
                  <Smartphone className="w-5 h-5 text-[#BE185D]" />
                  Hướng dẫn cài đặt file .vxp vào điện thoại Nokia S30+ thật
                </h3>
                <div className="space-y-3">
                  <div className="flex gap-3 items-start p-3 bg-[#EFEAF6] rounded-lg border border-[#E4DEF1]">
                    <span className="w-6 h-6 rounded-full bg-[#6750A4] text-white font-bold flex items-center justify-center text-xs shrink-0">1</span>
                    <div>
                      <p className="font-semibold text-[#221E2B]">Xuất file .vxp từ VXPFlow</p>
                      <p className="text-xs text-[#494256]">Bấm nút <strong>"Xuất .VXP"</strong> ở thanh công cụ phía trên để tải file thực thi về máy tính của bạn.</p>
                    </div>
                  </div>

                  <div className="flex gap-3 items-start p-3 bg-[#EFEAF6] rounded-lg border border-[#E4DEF1]">
                    <span className="w-6 h-6 rounded-full bg-[#6750A4] text-white font-bold flex items-center justify-center text-xs shrink-0">2</span>
                    <div>
                      <p className="font-semibold text-[#221E2B]">Chép vào Thẻ nhớ MicroSD</p>
                      <p className="text-xs text-[#494256]">Cắm thẻ nhớ microSD vào máy tính hoặc kết nối điện thoại Nokia qua cáp MicroUSB ở chế độ "Ổ lưu trữ".</p>
                      <p className="text-xs text-[#B45309] mt-1">Tạo một thư mục tên là <code>vxp</code> hoặc <code>mythroad</code> ngay tại thư mục gốc của thẻ nhớ (Ví dụ: <code>E:\vxp\tengame.vxp</code>).</p>
                    </div>
                  </div>

                  <div className="flex gap-3 items-start p-3 bg-[#EFEAF6] rounded-lg border border-[#E4DEF1]">
                    <span className="w-6 h-6 rounded-full bg-[#6750A4] text-white font-bold flex items-center justify-center text-xs shrink-0">3</span>
                    <div>
                      <p className="font-semibold text-[#221E2B]">Chạy ứng dụng trên máy Nokia</p>
                      <ul className="list-disc pl-5 text-xs text-[#494256] space-y-1">
                        <li><strong>Cách 1 (Nokia 220, 225, 230):</strong> Mở Menu &gt; Tệp (File Manager) &gt; Thẻ nhớ &gt; Thư mục vxp &gt; Nhấp vào file .vxp để cài đặt.</li>
                        <li><strong>Cách 2 (Mã lệnh MRE):</strong> Mở màn hình quay số cuộc gọi, gõ mã đặc biệt: <code>*#220807#</code> hoặc <code>*#1234#</code> để kích hoạt trình duyệt file VXP của máy MediaTek.</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'android' && (
              <div className="space-y-4">
                <h3 className="text-xl font-bold text-[#221E2B] flex items-center gap-2">
                  <PlayCircle className="w-5 h-5 text-[#059669]" />
                  Chạy file .vxp trên điện thoại Android
                </h3>
                <p>
                  Bạn có thể chơi và chạy các ứng dụng .vxp trực tiếp trên điện thoại Android mà không cần máy Nokia bằng các giải pháp sau:
                </p>
                <div className="space-y-3">
                  <div className="p-4 bg-[#EFEAF6] rounded-lg border border-[#E4DEF1]">
                    <h4 className="font-semibold text-[#047857]">1. Giả lập tích hợp trong VXPFlow (Ngay tại trình duyệt)</h4>
                    <p className="text-xs text-[#494256] mt-1">
                      Chuyển khung nhìn ở góc phải sang <strong>"Giả lập Android (MREmu)"</strong>. Bạn sẽ thấy giao diện smartphone Android với D-pad ảo, các nút A/B/X/Y, thanh Logcat debug và tỷ lệ màn hình 240x320 chuẩn xác.
                    </p>
                  </div>
                  <div className="p-4 bg-[#EFEAF6] rounded-lg border border-[#E4DEF1]">
                    <h4 className="font-semibold text-[#0284C7]">2. Ứng dụng giả lập độc lập trên Android</h4>
                    <ul className="list-disc pl-5 text-xs text-[#494256] space-y-1.5 mt-1">
                      <li><strong>MREmu (MRE Emulator for Android — APK):</strong> Giả lập MRE gốc chạy file <code>.vxp</code> trực tiếp từ bộ nhớ máy Android — đây là cách chạy đúng chuẩn VXP (không dùng Java ME).</li>
                      <li><strong>Lưu ý:</strong> <em>J2ME Loader KHÔNG chạy được file .vxp</em> — đó là giả lập Java ME (chạy .jar/.jad), hoàn toàn khác nền tảng MRE của Nokia S30+. Vui lòng dùng APK MREmu.</li>
                      <li>Chỉ cần sao chép file <code>.vxp</code> vào thư mục <code>Download</code> trên máy Android, mở MREmu và chọn file — ứng dụng chạy ngay lập tức.</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-[#E4DEF1] bg-[#EFEAF6] flex items-center justify-between">
          <div className="text-xs text-[#6F687E]">
            VXPFlow v1.2 • Dành cho cộng đồng yêu thích điện thoại cổ điển &amp; Nokia S30+
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-[#F3EEFA] hover:bg-[#E4DEF1] text-[#221E2B] rounded text-xs font-semibold border border-[#CBC3DD] transition-colors"
          >
            Đóng tài liệu
          </button>
        </div>
      </div>
    </div>
  );
};
