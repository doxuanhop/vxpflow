import { BlockDef } from '../types';

export const BLOCK_DEFINITIONS: BlockDef[] = [
  /** Khởi tạo bàn phím cứng cho thiết bị (S30+ / Nokia 225) — gọi trước các khối bắt phím */
  {
    id: 'keypad_init',
    type: 'statement',
    category: 'system',
    label: 'Khởi tạo bàn phím cứng [thiết bị]',
    color: '#14b8a6',
    statement: true,
    inputs: [{ name: 'device', type: 'string', default: 'S30+ (240x320)', options: ['S30+ (240x320)', 'Nokia 225', 'S30+ Ngang (320x240)'] }]
  },
  /** Sự kiện Initialize cho thành phần non-visible (Clock/Keypad/Notifier/Sound/Vibrator/Storage/KeyInit) */
  {
    id: 'event_component_init',
    type: 'event',
    category: 'events',
    label: 'khi <thành_phần>.KhởiTạo do',
    color: '#ca8a04',
    statement: true,
    inputs: [{ name: 'component', type: 'string', default: 'Timer1' }],
    bodies: [{ name: 'then', label: 'do' }]
  },
  // Events
  {
    id: 'event_screen_init',
    type: 'event',
    category: 'events',
    label: 'khi Screen.KhởiTạo do',
    color: '#ca8a04',
    statement: true,
    inputs: [{ name: 'screen', type: 'string', default: 'Screen1' }],
    bodies: [{ name: 'then', label: 'do' }]
  },
  {
    id: 'event_btn_click',
    type: 'event',
    category: 'events',
    label: 'khi Nút.ĐượcBấm do',
    color: '#ca8a04',
    statement: true,
    inputs: [{ name: 'button', type: 'string', default: 'Button1' }],
    bodies: [{ name: 'then', label: 'do' }]
  },
  {
    id: 'event_timer_tick',
    type: 'event',
    category: 'events',
    label: 'khi ĐồngHồ.MỗiChuKỳ do',
    color: '#ca8a04',
    statement: true,
    inputs: [{ name: 'timer', type: 'string', default: 'GameClock' }],
    bodies: [{ name: 'then', label: 'do' }]
  },
  {
    id: 'event_key_press',
    type: 'event',
    category: 'events',
    label: 'khi BànPhím.NhấnPhím(phím) do',
    color: '#ca8a04',
    statement: true,
    inputs: [{ name: 'key', type: 'string', default: 'KEY_OK' }],
    bodies: [{ name: 'then', label: 'do' }]
  },
  /** khi phím BẤT KỲ được nhấn (biến "phím" dùng được trong thân) — kiểu App Inventor "any key" */
  {
    id: 'event_any_key',
    type: 'event',
    category: 'events',
    label: 'khi BànPhím.NhấnPhímBấtKỳ(phím) do',
    color: '#ca8a04',
    statement: true,
    bodies: [{ name: 'then', label: 'do' }]
  },
  {
    id: 'event_canvas_touch',
    type: 'event',
    category: 'events',
    label: 'khi Canvas.ChạmVào(x, y) do',
    color: '#ca8a04',
    statement: true,
    inputs: [{ name: 'canvas', type: 'string', default: 'GameCanvas' }],
    bodies: [{ name: 'then', label: 'do' }]
  },
  /** Sự kiện chu kỳ Timer theo TÊN thành phần Clock trong Designer (mỗi Clock riêng) */
  {
    id: 'event_clock_timer',
    type: 'event',
    category: 'events',
    label: 'khi <đồng_hồ>.MỗiChuKỳ do',
    color: '#ca8a04',
    statement: true,
    inputs: [{ name: 'timer', type: 'string', default: 'Timer1' }],
    bodies: [{ name: 'then', label: 'do' }]
  },
  /** Sự kiện Hộp thoại thông báo (Notifier) được bấm chọn */
  {
    id: 'event_notifier_choose',
    type: 'event',
    category: 'events',
    label: 'khi <thông_báo>.ChọnSauThôngBáo(lựa_chọn) do',
    color: '#ca8a04',
    statement: true,
    inputs: [{ name: 'component', type: 'string', default: 'Notifier1' }],
    bodies: [{ name: 'then', label: 'do' }]
  },

  // Control
  {
    id: 'ctrl_if',
    type: 'statement',
    category: 'control',
    label: 'nếu <điều_kiện> thì',
    color: '#ea580c',
    statement: true,
    inputs: [{ name: 'condition', type: 'boolean', default: 'true', socket: true }],
    bodies: [{ name: 'then', label: 'thì' }]
  },
  {
    id: 'ctrl_if_else',
    type: 'statement',
    category: 'control',
    label: 'nếu <điều_kiện> thì ... ngược lại',
    color: '#ea580c',
    statement: true,
    inputs: [{ name: 'condition', type: 'boolean', default: 'true', socket: true }],
    bodies: [
      { name: 'then', label: 'thì' },
      { name: 'else', label: 'ngược lại' }
    ]
  },
  {
    id: 'ctrl_repeat',
    type: 'statement',
    category: 'control',
    label: 'lặp lại <count> lần',
    color: '#ea580c',
    statement: true,
    inputs: [{ name: 'count', type: 'number', default: 10, socket: true }],
    bodies: [{ name: 'body', label: 'lặp lại' }]
  },
  {
    id: 'ctrl_while',
    type: 'statement',
    category: 'control',
    label: 'trong khi <điều_kiện> làm',
    color: '#ea580c',
    statement: true,
    inputs: [{ name: 'condition', type: 'boolean', default: 'true', socket: true }],
    bodies: [{ name: 'body', label: 'lặp' }]
  },
  /** for each (number from a to b by step) — kiểu "for range" của App Inventor */
  {
    id: 'ctrl_for_range',
    type: 'statement',
    category: 'control',
    label: 'với <biến> từ <từ> đến <đến> bước <bước> làm',
    color: '#ea580c',
    statement: true,
    inputs: [
      { name: 'name', type: 'string', default: 'i' },
      { name: 'from', type: 'number', default: 1, socket: true },
      { name: 'to', type: 'number', default: 10, socket: true },
      { name: 'step', type: 'number', default: 1, socket: true }
    ],
    bodies: [{ name: 'body', label: 'lặp' }]
  },
  /** duyệt từng phần tử chuỗi (tách theo dấu) — kiểu "for each in list" */
  {
    id: 'ctrl_for_each',
    type: 'statement',
    category: 'control',
    label: 'với mỗi <phần_tử> trong <danh_sách> làm',
    color: '#ea580c',
    statement: true,
    inputs: [
      { name: 'name', type: 'string', default: 'item' },
      { name: 'list', type: 'any', default: '', socket: true }
    ],
    bodies: [{ name: 'body', label: 'lặp' }]
  },
  /** thoát vòng lặp — như khối "break" của App Inventor */
  {
    id: 'ctrl_break',
    type: 'statement',
    category: 'control',
    label: 'thoát vòng lặp',
    color: '#ea580c',
    statement: true
  },
  /** bỏ qua lần lặp hiện tại — như "continue" */
  {
    id: 'ctrl_continue',
    type: 'statement',
    category: 'control',
    label: 'bỏ qua lần lặp này',
    color: '#ea580c',
    statement: true
  },
  /** Chờ N ms rồi chạy tiếp (giả lập bận rộn trong 1 frame) */
  {
    id: 'ctrl_wait',
    type: 'statement',
    category: 'control',
    label: 'chờ <mili_giây> rồi làm',
    color: '#ea580c',
    statement: true,
    inputs: [{ name: 'duration', type: 'number', default: 500, socket: true }],
    bodies: [{ name: 'body', label: 'sau đó' }]
  },
  {
    id: 'set_timer_enabled',
    type: 'statement',
    category: 'control',
    label: 'đặt ĐồngHồ.Bật = <giá_trị>',
    color: '#ea580c',
    statement: true,
    inputs: [
      { name: 'timer', type: 'string', default: 'GameClock' },
      { name: 'enabled', type: 'boolean', default: true, socket: true }
    ]
  },

  // Logic & Math
  {
    id: 'math_number',
    type: 'value',
    category: 'math',
    label: 'số <giá_trị>',
    color: '#2563eb',
    outputType: 'number',
    inputs: [{ name: 'value', type: 'number', default: 0 }]
  },
  {
    id: 'math_op',
    type: 'value',
    category: 'math',
    label: '<A> [+] <B>',
    color: '#2563eb',
    outputType: 'number',
    inputs: [
      { name: 'a', type: 'number', default: 0, socket: true },
      { name: 'op', type: 'string', default: '+', options: ['+', '-', '*', '/', '%', '^'] },
      { name: 'b', type: 'number', default: 1, socket: true }
    ]
  },
  {
    id: 'math_random',
    type: 'value',
    category: 'math',
    label: 'ngẫu nhiên từ <min> đến <max>',
    color: '#2563eb',
    outputType: 'number',
    inputs: [
      { name: 'min', type: 'number', default: 1, socket: true },
      { name: 'max', type: 'number', default: 100, socket: true }
    ]
  },
  /** Phép toán một ngôi: âm / abs / làm tròn / sàn / trần / căn bậc hai / sin... */
  {
    id: 'math_unary',
    type: 'value',
    category: 'math',
    label: '[abs] <số>',
    color: '#2563eb',
    outputType: 'number',
    inputs: [
      { name: 'op', type: 'string', default: 'abs', options: ['abs', 'âm', 'làm tròn', 'sàn', 'trần', 'căn bậc hai', 'sin', 'cos', 'tan'] },
      { name: 'value', type: 'number', default: 0, socket: true }
    ]
  },
  /** Chia lấy phần nguyên / phần dư — như khối "quotient-remainder" của App Inventor */
  {
    id: 'math_div',
    type: 'value',
    category: 'math',
    label: '[phần nguyên] <A> : <B>',
    color: '#2563eb',
    outputType: 'number',
    inputs: [
      { name: 'mode', type: 'string', default: 'phần nguyên', options: ['phần nguyên', 'phần dư'] },
      { name: 'a', type: 'number', default: 7, socket: true },
      { name: 'b', type: 'number', default: 3, socket: true }
    ]
  },
  /** min/max của 2 số */
  {
    id: 'math_min_max',
    type: 'value',
    category: 'math',
    label: '[nhỏ nhất] <A> , <B>',
    color: '#2563eb',
    outputType: 'number',
    inputs: [
      { name: 'mode', type: 'string', default: 'nhỏ nhất', options: ['nhỏ nhất', 'lớn nhất'] },
      { name: 'a', type: 'number', default: 0, socket: true },
      { name: 'b', type: 'number', default: 0, socket: true }
    ]
  },
  /** Ép kiểu số — như khối "convert to number" */
  {
    id: 'math_to_number',
    type: 'value',
    category: 'math',
    label: 'đổi <giá_trị> thành số',
    color: '#2563eb',
    outputType: 'number',
    inputs: [{ name: 'value', type: 'any', default: '0', socket: true }]
  },
  /** Khối ĐÚNG/SAI (tương tự khối logic_boolean của App Inventor) */
  {
    id: 'logic_boolean',
    type: 'value',
    category: 'logic',
    label: 'đúng/sai <giá_trị>',
    color: '#0284c7',
    outputType: 'boolean',
    inputs: [{ name: 'literal', type: 'boolean', default: true }]
  },
  {
    id: 'logic_compare',
    type: 'value',
    category: 'logic',
    label: '<A> [==] <B>',
    color: '#0284c7',
    outputType: 'boolean',
    inputs: [
      { name: 'a', type: 'any', default: 0, socket: true },
      { name: 'op', type: 'string', default: '==', options: ['==', '!=', '<', '>', '<=', '>='] },
      { name: 'b', type: 'any', default: 0, socket: true }
    ]
  },
  /** VÀ / HOẶC — như khối "and/or" của App Inventor */
  {
    id: 'logic_and_or',
    type: 'value',
    category: 'logic',
    label: '<A> [và] <B>',
    color: '#0284c7',
    outputType: 'boolean',
    inputs: [
      { name: 'a', type: 'boolean', default: true, socket: true },
      { name: 'op', type: 'string', default: 'và', options: ['và', 'hoặc'] },
      { name: 'b', type: 'boolean', default: true, socket: true }
    ]
  },
  /** PHỦ ĐỊNH — như khối "not" */
  {
    id: 'logic_not',
    type: 'value',
    category: 'logic',
    label: 'không phải <điều_kiện>',
    color: '#0284c7',
    outputType: 'boolean',
    inputs: [{ name: 'a', type: 'boolean', default: true, socket: true }]
  },

  // Text (văn bản)
  {
    id: 'text_literal',
    type: 'value',
    category: 'text',
    label: '" <nội_dung> "',
    color: '#e91e63',
    outputType: 'string',
    inputs: [{ name: 'literal', type: 'string', default: 'Xin chào' }]
  },
  {
    id: 'text_join',
    type: 'value',
    category: 'text',
    label: 'ghép <A> + <B>',
    color: '#e91e63',
    outputType: 'string',
    inputs: [
      { name: 'a', type: 'any', default: '', socket: true },
      { name: 'b', type: 'any', default: '', socket: true }
    ]
  },
  {
    id: 'text_length',
    type: 'value',
    category: 'text',
    label: 'độ dài <văn_bản>',
    color: '#e91e63',
    outputType: 'number',
    inputs: [{ name: 'text', type: 'any', default: '', socket: true }]
  },
  {
    id: 'text_is_empty',
    type: 'value',
    category: 'text',
    label: 'là trống? <văn_bản>',
    color: '#e91e63',
    outputType: 'boolean',
    inputs: [{ name: 'text', type: 'any', default: '', socket: true }]
  },
  {
    id: 'text_is_string',
    type: 'value',
    category: 'text',
    label: 'là chuỗi? <giá_trị>',
    color: '#e91e63',
    outputType: 'boolean',
    inputs: [{ name: 'value', type: 'any', default: '', socket: true }]
  },
  {
    id: 'text_compare',
    type: 'value',
    category: 'text',
    label: 'so sánh <A> [<] <B>',
    color: '#e91e63',
    outputType: 'boolean',
    inputs: [
      { name: 'a', type: 'any', default: '', socket: true },
      { name: 'op', type: 'string', default: '<', options: ['<', '<=', '==', '>=', '>', '!='] },
      { name: 'b', type: 'any', default: '', socket: true }
    ]
  },
  {
    id: 'text_trim',
    type: 'value',
    category: 'text',
    label: 'cắt khoảng trắng <văn_bản>',
    color: '#e91e63',
    outputType: 'string',
    inputs: [{ name: 'text', type: 'any', default: '', socket: true }]
  },
  {
    id: 'text_case',
    type: 'value',
    category: 'text',
    label: '<văn_bản> [UPCASE]',
    color: '#e91e63',
    outputType: 'string',
    inputs: [
      { name: 'text', type: 'any', default: '', socket: true },
      { name: 'op', type: 'string', default: 'upcase', options: ['upcase', 'downcase'] }
    ]
  },
  {
    id: 'text_starts_with',
    type: 'value',
    category: 'text',
    label: 'bắt đầu bằng <văn_bản> bởi <tiêude>',
    color: '#e91e63',
    outputType: 'boolean',
    inputs: [
      { name: 'text', type: 'any', default: '', socket: true },
      { name: 'piece', type: 'any', default: '', socket: true }
    ]
  },
  {
    id: 'text_contains',
    type: 'value',
    category: 'text',
    label: 'chứa <văn_bản> <tiêude>',
    color: '#e91e63',
    outputType: 'boolean',
    inputs: [
      { name: 'text', type: 'any', default: '', socket: true },
      { name: 'piece', type: 'any', default: '', socket: true }
    ]
  },
  {
    id: 'text_split',
    type: 'value',
    category: 'text',
    label: 'chia <văn_bản> tại <phân_cách>',
    color: '#e91e63',
    outputType: 'string',
    inputs: [
      { name: 'text', type: 'any', default: '', socket: true },
      { name: 'delimiter', type: 'any', default: ' ', socket: true }
    ]
  },
  /** Lấy phần tử thứ N của danh sách (tách bằng text_split) — như "select list item" */
  {
    id: 'list_get_item',
    type: 'value',
    category: 'text',
    label: 'phần tử thứ <vị_trí> của <danh_sách>',
    color: '#e91e63',
    outputType: 'any',
    inputs: [
      { name: 'list', type: 'any', default: '', socket: true },
      { name: 'index', type: 'number', default: 1, socket: true }
    ]
  },
  /** Số phần tử của danh sách — như "length of list" */
  {
    id: 'list_length',
    type: 'value',
    category: 'text',
    label: 'số phần tử của <danh_sách>',
    color: '#e91e63',
    outputType: 'number',
    inputs: [{ name: 'list', type: 'any', default: '', socket: true }]
  },
  /** Cắt chuỗi con — như khối "segment" của App Inventor */
  {
    id: 'text_substring',
    type: 'value',
    category: 'text',
    label: 'cắt <văn_bản> từ <bắt_đầu> dài <độ_dài>',
    color: '#e91e63',
    outputType: 'string',
    inputs: [
      { name: 'text', type: 'any', default: '', socket: true },
      { name: 'start', type: 'number', default: 1, socket: true },
      { name: 'length', type: 'number', default: 1, socket: true }
    ]
  },
  /** Ghép chuỗi A lặp N lần — như "repeat text" */
  {
    id: 'text_repeat',
    type: 'value',
    category: 'text',
    label: 'lặp <văn_bản> <số_lần> lần',
    color: '#e91e63',
    outputType: 'string',
    inputs: [
      { name: 'text', type: 'any', default: 'ab', socket: true },
      { name: 'count', type: 'number', default: 2, socket: true }
    ]
  },
  /** Thay thế chuỗi con — như "replace all" */
  {
    id: 'text_replace',
    type: 'value',
    category: 'text',
    label: 'thay <tìm> bằng <mới> trong <văn_bản>',
    color: '#e91e63',
    outputType: 'string',
    inputs: [
      { name: 'text', type: 'any', default: '', socket: true },
      { name: 'find', type: 'any', default: 'a', socket: true },
      { name: 'replace', type: 'any', default: 'b', socket: true }
    ]
  },
  /** Đổi số thành chuỗi — như "convert to text" */
  {
    id: 'text_to_string',
    type: 'value',
    category: 'text',
    label: 'đổi <giá_trị> thành văn bản',
    color: '#e91e63',
    outputType: 'string',
    inputs: [{ name: 'value', type: 'any', default: 0, socket: true }]
  },

  // UI Components
  {
    id: 'set_label_text',
    type: 'statement',
    category: 'ui',
    label: 'đặt Nhãn.NộiDung = <văn_bản>',
    color: '#16a34a',
    statement: true,
    inputs: [
      { name: 'component', type: 'string', default: 'ScoreLabel' },
      { name: 'text', type: 'any', default: 'Điểm: 0', socket: true }
    ]
  },
  {
    id: 'get_label_text',
    type: 'value',
    category: 'ui',
    label: 'lấy Nhãn.NộiDung',
    color: '#16a34a',
    outputType: 'string',
    inputs: [{ name: 'component', type: 'string', default: 'ScoreLabel' }]
  },
  {
    id: 'get_textbox_text',
    type: 'value',
    category: 'ui',
    label: 'lấy TextBox.NộiDung',
    color: '#16a34a',
    outputType: 'string',
    inputs: [{ name: 'component', type: 'string', default: 'TextBox1' }]
  },
  /** Hiển thị hộp thoại thông báo kiểu Notifier của App Inventor (2 nút OK/Cancel) */
  {
    id: 'notifier_alert',
    type: 'statement',
    category: 'ui',
    label: '<thông_báo>.Hiển thịThôngBáo(văn_bản)',
    color: '#16a34a',
    statement: true,
    inputs: [
      { name: 'component', type: 'string', default: 'Notifier1' },
      { name: 'text', type: 'any', default: 'Xin chào!', socket: true }
    ]
  },
  /** Hộp thoại chọn 2 lựa chọn (OK / Hủy) — kết quả đẩy về event_notifier_choose */
  {
    id: 'notifier_choose',
    type: 'statement',
    category: 'ui',
    label: '<thông_báo>.HỏiChọn(thông_điệp, nút1, nút2)',
    color: '#16a34a',
    statement: true,
    inputs: [
      { name: 'component', type: 'string', default: 'Notifier1' },
      { name: 'text', type: 'any', default: 'Tiếp tục?', socket: true },
      { name: 'button1', type: 'string', default: 'Đồng ý' },
      { name: 'button2', type: 'string', default: 'Hủy' }
    ]
  },
  /** Đóng hộp thoại thông báo đang mở */
  {
    id: 'notifier_close',
    type: 'statement',
    category: 'ui',
    label: '<thông_báo>.ĐóngThôngBáo()',
    color: '#16a34a',
    statement: true,
    inputs: [{ name: 'component', type: 'string', default: 'Notifier1' }]
  },
  /** Lấy lựa chọn gần nhất từ hộp thoại chọn (dùng trong event_notifier_choose) */
  {
    id: 'notifier_get_choice',
    type: 'value',
    category: 'ui',
    label: 'lấy <thông_báo>.LựaChọn',
    color: '#16a34a',
    outputType: 'string',
    inputs: [{ name: 'component', type: 'string', default: 'Notifier1' }]
  },
  // Khối CHUNG đặt/lấy thuộc tính — áp dụng cho mọi thành phần có thuộc tính tương ứng trong Designer
  {
    id: 'set_comp_prop',
    type: 'statement',
    category: 'ui',
    label: 'đặt <thành phần>.<thuộc tính> = <giá_trị>',
    color: '#16a34a',
    statement: true,
    inputs: [
      { name: 'component', type: 'string', default: 'Button1' },
      { name: 'property', type: 'property', default: 'KhảNhìn' },
      { name: 'value', type: 'any', default: true, socket: true }
    ]
  },
  {
    id: 'get_comp_prop',
    type: 'value',
    category: 'ui',
    label: 'lấy <thành phần>.<thuộc tính>',
    color: '#16a34a',
    outputType: 'any',
    inputs: [
      { name: 'component', type: 'string', default: 'Button1' },
      { name: 'property', type: 'property', default: 'KhảNhìn' }
    ]
  },

  // Canvas & Game
  {
    id: 'canvas_draw_rect',
    type: 'statement',
    category: 'game',
    label: 'Canvas.VẽHìnhChữNhật(x, y, w, h, màu)',
    color: '#9333ea',
    statement: true,
    inputs: [
      { name: 'x', type: 'number', default: 10, socket: true },
      { name: 'y', type: 'number', default: 10, socket: true },
      { name: 'width', type: 'number', default: 20, socket: true },
      { name: 'height', type: 'number', default: 20, socket: true },
      { name: 'color', type: 'string', default: '#22c55e' }
    ]
  },
  {
    id: 'canvas_draw_text',
    type: 'statement',
    category: 'game',
    label: 'Canvas.VẽChữ(văn_bản, x, y, màu)',
    color: '#9333ea',
    statement: true,
    inputs: [
      { name: 'text', type: 'any', default: 'Xin chào!', socket: true },
      { name: 'x', type: 'number', default: 20, socket: true },
      { name: 'y', type: 'number', default: 50, socket: true },
      { name: 'color', type: 'string', default: '#ffffff' }
    ]
  },
  {
    id: 'canvas_clear',
    type: 'statement',
    category: 'game',
    label: 'Canvas.XóaMànHình(màu)',
    color: '#9333ea',
    statement: true,
    inputs: [{ name: 'color', type: 'string', default: '#0f172a' }]
  },
  {
    id: 'canvas_draw_line',
    type: 'statement',
    category: 'game',
    label: 'Canvas.VẽĐườngThẳng(x1, y1, x2, y2, màu)',
    color: '#9333ea',
    statement: true,
    inputs: [
      { name: 'x1', type: 'number', default: 20, socket: true },
      { name: 'y1', type: 'number', default: 20, socket: true },
      { name: 'x2', type: 'number', default: 200, socket: true },
      { name: 'y2', type: 'number', default: 120, socket: true },
      { name: 'color', type: 'string', default: '#22d3ee' }
    ]
  },
  {
    id: 'canvas_draw_pixel',
    type: 'statement',
    category: 'game',
    label: 'Canvas.VẽĐiểmẢnh(x, y, màu)',
    color: '#9333ea',
    statement: true,
    inputs: [
      { name: 'x', type: 'number', default: 100, socket: true },
      { name: 'y', type: 'number', default: 100, socket: true },
      { name: 'color', type: 'string', default: '#fbbf24' }
    ]
  },
  {
    id: 'canvas_draw_circle',
    type: 'statement',
    category: 'game',
    label: 'Canvas.VẽHìnhTròn(x, y, bán_kính, màu)',
    color: '#9333ea',
    statement: true,
    inputs: [
      { name: 'x', type: 'number', default: 120, socket: true },
      { name: 'y', type: 'number', default: 160, socket: true },
      { name: 'radius', type: 'number', default: 20, socket: true },
      { name: 'color', type: 'string', default: '#f472b6' }
    ]
  },
  {
    id: 'sprite_create',
    type: 'statement',
    category: 'game',
    label: 'tạo NhânVật <sprite> màu <màu> cỡ <size>',
    color: '#9333ea',
    statement: true,
    inputs: [
      { name: 'sprite', type: 'string', default: 'Player' },
      { name: 'color', type: 'string', default: '#22c55e' },
      { name: 'size', type: 'number', default: 12, socket: true }
    ]
  },
  {
    id: 'sprite_move',
    type: 'statement',
    category: 'game',
    label: 'NhânVật.DiChuyển(<sprite>, x, y)',
    color: '#9333ea',
    statement: true,
    inputs: [
      { name: 'sprite', type: 'string', default: 'Player' },
      { name: 'x', type: 'number', default: 100, socket: true },
      { name: 'y', type: 'number', default: 200, socket: true }
    ]
  },
  {
    id: 'sprite_rotate',
    type: 'statement',
    category: 'game',
    label: 'xoay NhânVật <sprite> góc <góc_độ>',
    color: '#9333ea',
    statement: true,
    inputs: [
      { name: 'sprite', type: 'string', default: 'Player' },
      { name: 'angle', type: 'number', default: 90, socket: true }
    ]
  },

  // System & MRE
  {
    id: 'call_sound_play',
    type: 'statement',
    category: 'system',
    label: 'PhátÂmThanh(hiệu_ứng)',
    color: '#0d9488',
    statement: true,
    inputs: [{ name: 'sound', type: 'string', default: 'coin' }]
  },
  {
    id: 'call_vibrate',
    type: 'statement',
    category: 'system',
    label: 'RungMáy(mili_giây)',
    color: '#0d9488',
    statement: true,
    inputs: [{ name: 'duration', type: 'number', default: 50, socket: true }]
  },
  {
    id: 'call_exit_app',
    type: 'statement',
    category: 'system',
    label: 'ThoátỨngDụng()',
    color: '#0d9488',
    statement: true
  },
  {
    id: 'storage_get_value',
    type: 'value',
    category: 'system',
    label: 'lấy BộNhớTinyDB <component>.<key>',
    color: '#0d9488',
    outputType: 'any',
    inputs: [
      { name: 'component', type: 'string', default: 'TinyDB1' },
      { name: 'key', type: 'string', default: 'diem_cao' },
      { name: 'default', type: 'any', default: '' }
    ]
  },
  {
    id: 'storage_set_value',
    type: 'statement',
    category: 'system',
    label: 'đặt BộNhớTinyDB <component>.<key> = <giá_trị>',
    color: '#0d9488',
    statement: true,
    inputs: [
      { name: 'component', type: 'string', default: 'TinyDB1' },
      { name: 'key', type: 'string', default: 'diem_cao' },
      { name: 'value', type: 'any', default: 0, socket: true }
    ]
  },

  // Variables
  {
    id: 'var_set',
    type: 'statement',
    category: 'variables',
    label: 'gán biến <tên> = <giá_trị>',
    color: '#db2777',
    statement: true,
    inputs: [
      { name: 'name', type: 'string', default: 'diem_so' },
      { name: 'value', type: 'any', default: 0, socket: true }
    ]
  },
  {
    id: 'var_change',
    type: 'statement',
    category: 'variables',
    label: 'thay đổi biến <tên> một lượng <số>',
    color: '#db2777',
    statement: true,
    inputs: [
      { name: 'name', type: 'string', default: 'diem_so' },
      { name: 'delta', type: 'number', default: 1, socket: true }
    ]
  },
  {
    id: 'var_get',
    type: 'value',
    category: 'variables',
    label: 'lấy biến <tên>',
    color: '#db2777',
    outputType: 'any',
    inputs: [{ name: 'name', type: 'string', default: 'diem_so' }]
  },

  // Procedures & Functions — như khối "to proc / to func / do result / call" của App Inventor
  /** ĐỊNH NGHĨA thủ tục (không trả giá trị) — mũ đầu chuỗi như khối sự kiện */
  {
    id: 'proc_def',
    type: 'event',
    category: 'procedures',
    label: 'định nghĩa thủ tục <tên> làm',
    color: '#c026d3',
    statement: true,
    inputs: [{ name: 'name', type: 'string', default: 'ThuTucCuaToi' }],
    bodies: [{ name: 'then', label: 'làm' }]
  },
  /** GỌI thủ tục */
  {
    id: 'proc_call',
    type: 'statement',
    category: 'procedures',
    label: 'gọi thủ tục <tên>',
    color: '#c026d3',
    statement: true,
    inputs: [{ name: 'name', type: 'string', default: 'ThuTucCuaToi' }]
  },
  /** Kết quả của thủ tục hàm (trả về) — chỉ dùng trong proc_def */
  {
    id: 'proc_return',
    type: 'statement',
    category: 'procedures',
    label: 'trả về kết quả <giá_trị>',
    color: '#c026d3',
    statement: true,
    inputs: [{ name: 'value', type: 'any', default: 0, socket: true }]
  }
];
