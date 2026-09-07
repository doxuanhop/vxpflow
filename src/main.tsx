// Chạy TRƯỚC: polyfill `process` cho fengari (máy ảo Lua) khi chạy trên webview/browser
import './envShim';
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { EmulatorWindow } from './components/Emulator/EmulatorWindow.tsx';
import { I18nProvider } from './i18n.tsx';
import { SystemDialogsProvider } from './components/SystemDialogs/SystemDialogs.tsx';
import './index.css';

// Cửa sổ giả lập riêng được mở với URL .../#/emulator (xem openEmulatorWindow)
const isEmulatorWindow = window.location.hash.startsWith('#/emulator');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider><SystemDialogsProvider>{isEmulatorWindow ? <EmulatorWindow /> : <App />}</SystemDialogsProvider></I18nProvider>
  </StrictMode>,
);