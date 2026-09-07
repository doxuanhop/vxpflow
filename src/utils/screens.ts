import { VXPProject, VXPScreenMeta, VXPScreenProps, UIComponent } from '../types';

export const DEFAULT_SCREEN_NAME = 'Screen1';

/** Thuộc tính mặc định cho màn hình mới (giữ tông tối để bản vẽ game đọc đúng trên IDE sáng) */
export const DEFAULT_SCREEN_PROPS: VXPScreenProps = {
  aboutScreen: '',
  backgroundColor: '#0F1115',
  navBarColor: '#16181D',
  title: 'Screen1',
  scrollable: true,
  showStatusBar: true,
  showOptionsMenu: true
};

/** Màn hình mà một thành phần thuộc về (dự án cũ: mặc định Screen1) */
export const compScreen = (c: UIComponent): string => c.screen ?? DEFAULT_SCREEN_NAME;

/** Danh sách màn hình có metadata; dự án cũ chưa có → sinh mặc định Screen1 */
export function getScreenList(project: VXPProject): VXPScreenMeta[] {
  if (project.screens && project.screens.length > 0) {
    return project.screens;
  }
  return [{ name: project.entryScreen || DEFAULT_SCREEN_NAME, properties: { ...DEFAULT_SCREEN_PROPS, title: project.entryScreen || DEFAULT_SCREEN_NAME } }];
}

/** Tên gợi ý chưa bị trùng cho màn hình mới: Screen2, Screen3… */
export function nextScreenName(screens: string[]): string {
  let i = 1;
  while (screens.includes(`Screen${i}`)) i += 1;
  return `Screen${i}`;
}

/** Lọc thành phần theo một màn hình */
export const componentsOfScreen = (components: UIComponent[], screen: string): UIComponent[] =>
  components.filter(c => compScreen(c) === screen);
