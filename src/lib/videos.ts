import { File } from 'expo-file-system';

import { supabase } from './supabase';

// A file in the club's private video storage, as the server lists it.
export type StoredVideo = { key: string; size: number; modified: string };

// The storage is private: the "video-link" server function checks that a
// coach is signed in, then lists the files or hands out a temporary link.
async function ask<T>(body: Record<string, string | number>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('video-link', { body });
  // A refusal still carries the server's own explanation, such as the free
  // plan being used up for this month.
  const refusal = data?.error ? data : await (error as { context?: Response } | null)?.context?.json?.().catch(() => null);
  if (refusal?.error) throw new StorageRefusal(refusal.error, refusal.limit ?? null);
  if (error) throw new Error('The video storage could not be reached.');
  return data as T;
}

// The storage said no. "limit" is set when the club's free plan is the reason:
// reads (playing), writes (uploading) or storage (full).
export class StorageRefusal extends Error {
  constructor(
    message: string,
    public limit: 'reads' | 'writes' | 'storage' | null,
  ) {
    super(message);
  }
}

// Everything in the storage, newest first, and the name of the bucket.
export async function listStorage(): Promise<{ bucket: string; videos: StoredVideo[] }> {
  const { videos, bucket } = await ask<{ videos: StoredVideo[]; bucket?: string }>({ action: 'list', prefix: '' });
  return { bucket: bucket ?? '', videos: videos.sort((a, b) => b.modified.localeCompare(a.modified)) };
}

export async function listStoredVideos(): Promise<StoredVideo[]> {
  return (await listStorage()).videos;
}

// The free storage at Cloudflare, and from which share of it the admin is warned.
export const FREE_STORAGE_BYTES = 10e9;
export const STORAGE_WARNING = 0.8;

// How full the free storage is (1 = full), asked once per app session for
// the warning on the admin's profile. Null when it could not be read.
let fill: Promise<number | null> | null = null;
export function storageFill(fresh = false): Promise<number | null> {
  if (!fill || fresh) {
    fill = listStorage().then(
      (storage) => storage.videos.reduce((sum, f) => sum + f.size, 0) / FREE_STORAGE_BYTES,
      () => null,
    );
  }
  return fill;
}

// The storage folder for a game's or a training's videos.
export const GAMES_FOLDER = 'Games-U12';
export const TRAININGS_FOLDER = 'Training';

// Sends a video from this phone straight to the storage, through a temporary
// upload link from the server. Returns where it was stored.
export async function uploadVideo(
  video: { uri: string; name: string; mimeType?: string; size?: number },
  folder: string,
  onProgress: (fraction: number) => void,
): Promise<string> {
  const { url, key } = await ask<{ url: string; key: string }>({ action: 'upload', folder, name: video.name, size: video.size ?? 0 });
  const result = await new File(video.uri)
    .createUploadTask(url, {
      httpMethod: 'PUT',
      headers: video.mimeType ? { 'Content-Type': video.mimeType } : undefined,
      // The upload has to finish while this screen is open, to attach the video afterwards.
      sessionType: 'foreground',
      onProgress: ({ bytesSent, totalBytes }) => onProgress(totalBytes > 0 ? bytesSent / totalBytes : 0),
    })
    .uploadAsync();
  if (result.status < 200 || result.status >= 300) throw new Error(`The storage refused the upload (${result.status}).`);
  return key;
}

// What Cloudflare itself counted for the storage this month (admins only).
export type StorageUsage = {
  since: string;
  // Requests in Cloudflare's two billing classes: writing and listing (A), reading (B).
  classA: number;
  classB: number;
  uploads: number;
  downloads: number;
  bytesOut: number;
  storageBytes: number | null;
};

export async function storageUsage(): Promise<StorageUsage> {
  const { data, error } = await supabase.functions.invoke('storage-usage', { body: {} });
  // A refusal still carries Cloudflare's or the server's own explanation.
  const reason = data?.error ?? (await (error as { context?: Response } | null)?.context?.json?.().catch(() => null))?.error;
  if (reason) throw new Error(reason);
  if (error) throw new Error('The statistics could not be reached.');
  return data as StorageUsage;
}

// Removes a file from the storage for good (admins only), together with the
// videos on games and trainings that used it.
export async function deleteStoredVideo(key: string) {
  await ask<{ deleted: boolean }>({ action: 'delete', key });
  const unlinked = await supabase.from('videos').delete().eq('storage_key', key);
  if (unlinked.error) throw new Error(unlinked.error.message);
}

// Counts one more view of a video; a failed count never blocks watching.
export function countView(videoId: string) {
  supabase.rpc('count_video_view', { p_video: videoId }).then(() => {});
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
