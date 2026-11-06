import React from 'react';
import { createRoot } from 'react-dom/client';
import { Preferences } from '@capacitor/preferences';
import MaintenanceLog from './MaintenanceLog.jsx';
import '@fontsource/oswald/400.css';
import '@fontsource/oswald/500.css';
import '@fontsource/oswald/600.css';
import '@fontsource/oswald/700.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import '@fontsource/jetbrains-mono/700.css';
import './mobile.css';

// Keep the component's original storage keys and JSON format. Android's native
// SharedPreferences are included in the system's Auto Backup. On first read,
// copy an existing value from the original APK's WebView localStorage.
window.storage = {
  async get(key) {
    const saved = await Preferences.get({ key });
    if (saved.value !== null) return saved;
    const oldValue = localStorage.getItem(key);
    if (oldValue === null) return null;
    await Preferences.set({ key, value: oldValue });
    return { value: oldValue };
  },
  async set(key, value) {
    await Preferences.set({ key, value });
  },
};

createRoot(document.getElementById('root')).render(<MaintenanceLog />);
