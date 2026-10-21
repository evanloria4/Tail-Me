// Profile photos in Supabase Storage. Uploads go through our server with the
// admin key (the browser never talks to Storage directly), into a public
// bucket so <img> tags can load them. The browser crops and shrinks photos to
// 256px squares before sending, so files are small.
import supabaseAdmin from './supabase';

const BUCKET = 'avatars';
export const AVATAR_MAX_BYTES = 1024 * 1024;

/** Image types we accept, by the first bytes of the file (not the header) */
function sniff(buf: Buffer): 'jpg' | 'png' | 'webp' | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (
    buf
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  )
    return 'png';
  if (
    buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buf.subarray(8, 12).toString('ascii') === 'WEBP'
  )
    return 'webp';
  return null;
}

let bucketReady: Promise<void> | null = null;

/** Creates the public bucket the first time it's needed */
function ensureBucket() {
  bucketReady ??= (async () => {
    const { data } = await supabaseAdmin.storage.getBucket(BUCKET);
    if (data) return;
    const { error } = await supabaseAdmin.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: AVATAR_MAX_BYTES,
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    });
    if (error && !/already exists/i.test(error.message)) throw error;
  })().catch((err) => {
    bucketReady = null;
    throw err;
  });
  return bucketReady;
}

/** Our object path inside the bucket, from a stored public URL */
function pathFromUrl(url: string | null): string | null {
  if (!url) return null;
  const marker = `/object/public/${BUCKET}/`;
  const i = url.indexOf(marker);
  return i === -1 ? null : url.slice(i + marker.length);
}

export class AvatarError extends Error {}

/** Stores a new photo for the user and returns its public URL */
export async function uploadAvatar(userId: string, body: unknown) {
  if (!Buffer.isBuffer(body) || !body.length) {
    throw new AvatarError('Choose a photo to upload');
  }
  if (body.length > AVATAR_MAX_BYTES) {
    throw new AvatarError('That photo is too big (1 MB max)');
  }
  const ext = sniff(body);
  if (!ext) throw new AvatarError('Use a JPG, PNG or WebP photo');

  await ensureBucket();
  // A new name each time, so browsers and CDNs never show the old photo
  const path = `${userId}/${Date.now()}.${ext}`;
  const { error } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, body, {
      contentType: ext === 'jpg' ? 'image/jpeg' : `image/${ext}`,
      cacheControl: '31536000',
    });
  if (error) throw error;
  return supabaseAdmin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

/** Deletes a stored photo (best effort; a leftover file is harmless) */
export async function removeAvatarFile(url: string | null) {
  const path = pathFromUrl(url);
  if (!path) return;
  await supabaseAdmin.storage
    .from(BUCKET)
    .remove([path])
    .catch(() => {});
}
