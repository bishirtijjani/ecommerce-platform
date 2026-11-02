import { getUploadSignature } from './auth';

export type UploadResult = { url: string; type: 'image' | 'video' };

const VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];

/**
 * Direct-to-Cloudinary signed upload. Gets a short-lived signature from our
 * backend (scoped to the caller's own folder - see auth.service.getCloudinaryUploadSignature),
 * then uploads straight to Cloudinary so the file never touches our server.
 *
 * Returns `{ url, type }` — the Cloudinary URL and whether it's an image or video.
 */
export type UploadKind = 'vendor_logo' | 'vendor_cover' | 'product' | 'product_video' | 'chat' | 'ticket' | 'highlight' | 'highlight_video' | 'category';

export const uploadMedia = async (
  file: File,
  kind: 'vendor_logo' | 'vendor_cover' | 'product' | 'chat' | 'ticket' | 'highlight' | 'category',
  onProgress?: (pct: number) => void,
): Promise<UploadResult> => {
  const isVideo = VIDEO_TYPES.includes(file.type);
  const uploadKind: UploadKind = isVideo ? `${kind}_video` as UploadKind : kind;
  const resourceType = isVideo ? 'video' : 'image';

  const sig = await getUploadSignature(uploadKind);

  const form = new FormData();
  form.append('file', file);
  form.append('api_key', sig.apiKey);
  form.append('timestamp', String(sig.timestamp));
  form.append('signature', sig.signature);
  form.append('folder', sig.folder);
  form.append('public_id', sig.publicId);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${sig.cloudName}/${resourceType}/upload`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const data = JSON.parse(xhr.responseText);
        resolve({ url: data.secure_url as string, type: isVideo ? 'video' : 'image' });
      } else {
        reject(new Error('Upload failed. Please try again.'));
      }
    };
    xhr.onerror = () => reject(new Error('Upload failed. Please check your connection.'));
    xhr.send(form);
  });
};
