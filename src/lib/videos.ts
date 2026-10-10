import { supabase } from './supabase';

// A file in the club's private video storage, as the server lists it.
export type StoredVideo = { key: string; size: number; modified: string };

// The storage is private: the "video-link" server function checks that a
// coach is signed in, then lists the files or hands out a temporary link.
async function ask<T>(body: Record<string, string>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('video-link', { body });
  if (error) throw new Error('The video storage could not be reached.');
  if (data?.error) throw new Error(data.error);
  return data as T;
}

export async function listStoredVideos(): Promise<StoredVideo[]> {
  const { videos } = await ask<{ videos: StoredVideo[] }>({ action: 'list', prefix: '' });
  return videos.sort((a, b) => b.modified.localeCompare(a.modified));
}

// A fresh temporary link to a file in the storage.
export async function storedVideoUrl(key: string) {
  return (await ask<{ url: string }>({ action: 'link', key })).url;
}

export const fileName = (key: string) => key.split('/').pop() ?? key;
export const folderName = (key: string) => (key.includes('/') ? key.slice(0, key.lastIndexOf('/')) : '');

export function fmtSize(bytes: number | null) {
  if (!bytes) return '';
  const mb = bytes / 1e6;
  return mb >= 1000 ? `${(mb / 1000).toFixed(1)} GB` : `${Math.max(1, Math.round(mb))} MB`;
}

export function fmtDay(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

// "youtube.com" for a pasted link.
export function siteOf(url: string) {
  const host = url.match(/^https?:\/\/([^/?#]+)/i)?.[1] ?? '';
  const name = host.replace(/^www\./, '');
  return /youtu\.?be/.test(name) ? 'YouTube' : name;
}
