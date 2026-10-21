import api from './api';
import type { Profile } from '../auth/AuthProvider';

/** Photos are stored as small squares; plenty for every place they show */
const SIZE = 256;

/**
 * Center-crops an image file to a square and shrinks it to SIZE px as a
 * JPEG, so uploads are small and every avatar has the same shape.
 */
export async function squarePhoto(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Choose an image file');
  }
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error('That photo couldn’t be read. Try a JPG or PNG.');
  });
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    SIZE,
    SIZE
  );
  bitmap.close();
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(new Error('Could not process that photo')),
      'image/jpeg',
      0.85
    );
  });
}

/** Crops, shrinks and saves a new profile photo; returns the updated profile */
export async function uploadAvatar(file: File): Promise<Profile> {
  const photo = await squarePhoto(file);
  const { data } = await api.put<Profile>('/me/avatar', photo, {
    headers: { 'Content-Type': 'image/jpeg' },
  });
  return data;
}

export async function removeAvatar(): Promise<Profile> {
  const { data } = await api.delete<Profile>('/me/avatar');
  return data;
}
