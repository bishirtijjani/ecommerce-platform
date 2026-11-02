import { getUploadSignature, type UploadKind } from './auth';

export type UploadResult = { url: string; type: 'image' | 'video' };

const VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];

export const isVideoFile = (file: File) => VIDEO_TYPES.includes(file.type);

export const uploadMedia = async (
  file: File,
  kind: 'profile' | 'product' | 'vendor_logo' | 'vendor_cover' | 'category' | 'highlight',
  onProgress?: (pct: number) => void,
): Promise<UploadResult> => {
  const isVideo = isVideoFile(file);
  const uploadKind: UploadKind = isVideo ? (`${kind}_video` as UploadKind) : kind;
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
