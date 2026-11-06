import { Capacitor, registerPlugin } from '@capacitor/core';
const Native = registerPlugin('MaintenanceFiles');
const native = () => Capacitor.isNativePlatform();
async function db() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open('maintenance-photos', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('photos');
    r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error);
  });
}
export async function writePhoto(id, data) {
  if (native()) return Native.writePhoto({ id, data });
  const database = await db();
  return new Promise((resolve, reject) => {
    const tx = database.transaction('photos', 'readwrite'); tx.objectStore('photos').put(data, id);
    tx.oncomplete = () => { database.close(); resolve(); }; tx.onerror = () => { database.close(); reject(tx.error); };
  });
}
export async function readPhoto(id) {
  if (native()) return (await Native.readPhoto({ id })).data;
  const database = await db();
  return new Promise((resolve, reject) => {
    const r = database.transaction('photos').objectStore('photos').get(id);
    r.onsuccess = () => { database.close(); r.result ? resolve(r.result) : reject(new Error('Photo missing')); };
    r.onerror = () => { database.close(); reject(r.error); };
  });
}
export async function addPhoto(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image(); img.src = url; await img.decode();
    const scale = Math.min(1, 2000 / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas'); canvas.width = Math.round(img.width * scale); canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0,0,canvas.width,canvas.height); ctx.drawImage(img,0,0,canvas.width,canvas.height);
    const data = canvas.toDataURL('image/jpeg', 0.86).split(',')[1];
    const id = crypto.randomUUID() + '.jpg'; await writePhoto(id, data); return { id, name: file.name || 'Photo' };
  } finally { URL.revokeObjectURL(url); }
}
export const photoGroups = [['receipts','Receipt photos'],['before','Before photos'],['after','After photos']];
export function photoRefs(records) { return records.flatMap(r => photoGroups.flatMap(([key]) => r.photos?.[key] || [])); }
export function defaultBackupName(date = new Date()) {
  return `Maintenance log backup ${String(date.getMonth()+1).padStart(2,'0')}/${String(date.getDate()).padStart(2,'0')}/${date.getFullYear()}`;
}
export function safeBackupName(name) {
  const clean = name.trim().replace(/[\\/:*?"<>|\x00-\x1f]/g,'-').replace(/\.json$/i,'');
  if (!clean) throw new Error('Enter a backup name.'); return clean + '.json';
}
export async function buildBackup(payload) {
  const images = {};
  for (const photo of photoRefs([...payload.oilRecords, ...payload.partRecords, ...payload.otherRecords])) {
    if (!images[photo.id]) images[photo.id] = await readPhoto(photo.id);
  }
  return JSON.stringify({ ...payload, format:'maintenance-log', version:2, images });
}
export function parseBackup(text) {
  const data = JSON.parse(text);
  if (!data || !Array.isArray(data.vehicles)) throw new Error('Invalid backup');
  for (const key of ['vehicles','oilRecords','partRecords','otherRecords']) {
    if (data[key] === undefined && key !== 'vehicles') data[key] = [];
    if (!Array.isArray(data[key]) || data[key].some(r => !r || typeof r.id !== 'string')) throw new Error('Invalid records');
  }
  if (data.intervals && (typeof data.intervals !== 'object' || Array.isArray(data.intervals))) throw new Error('Invalid intervals');
  for (const p of photoRefs([...data.oilRecords,...data.partRecords,...data.otherRecords])) {
    if (!/^[a-zA-Z0-9_-]+\.jpg$/.test(p.id) || typeof data.images?.[p.id] !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(data.images[p.id])) throw new Error('Backup contains a missing or invalid photo');
  }
  return data;
}
export async function saveBackup(name, contents) {
  const filename = safeBackupName(name);
  if (native()) return Native.saveBackup({filename,contents});
  const url = URL.createObjectURL(new Blob([contents], {type:'application/json'}));
  const a = document.createElement('a'); a.href=url; a.download=filename; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export async function openNativeBackup() { return (await Native.openBackup()).contents; }
export const isNative = native;
