import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('desktop', {
  pickAdbPath: (): Promise<string> => ipcRenderer.invoke('pick-adb-path'),
});
