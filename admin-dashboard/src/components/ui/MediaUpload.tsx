import { useRef, useState } from 'react';
import { ImagePlus, Film, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { uploadMedia, isVideoFile, type UploadResult } from '../../api/upload';
import { cn } from '../../lib/cn';

const MAX_BYTES = 50 * 1024 * 1024;

export const MediaUpload = ({
  value,
  mediaType = 'image',
  onChange,
  onChangeMany,
  multiple = false,
  maxCount,
  kind,
  aspect = 'square',
  label,
  acceptVideo = false,
  containerClassName,
}: {
  value: string | null;
  mediaType?: 'image' | 'video';
  onChange?: (url: string, type: 'image' | 'video') => void;
  onChangeMany?: (results: UploadResult[]) => void;
  multiple?: boolean;
  maxCount?: number;
  kind: 'profile' | 'product' | 'vendor_logo' | 'vendor_cover' | 'category' | 'highlight';
  aspect?: 'square' | 'wide';
  label?: string;
  acceptVideo?: boolean;
  containerClassName?: string;
}) => {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const accept = acceptVideo ? 'image/*,video/mp4,video/webm,video/quicktime' : 'image/*';

  const validate = (file: File) => {
    const isVid = isVideoFile(file);
    if (isVid && !acceptVideo) {
      toast.error('Only image files are allowed here.');
      return false;
    }
    if (!isVid && !file.type.startsWith('image/')) {
      toast.error('Please choose an image or video file.');
      return false;
    }
    if (file.size > MAX_BYTES) {
      toast.error('File must be under 50MB.');
      return false;
    }
    return true;
  };

  const handleFile = async (file: File | undefined) => {
    if (!file || !validate(file)) return;

    setUploading(true);
    try {
      const result = await uploadMedia(file, kind, setProgress);
      onChange?.(result.url, result.type);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  /** Upload several files at once (multi-select / drop). One toast on failure. */
  const handleFiles = async (files: FileList | File[] | null | undefined) => {
    const list = Array.from(files || []);
    if (!list.length) return;

    if (!multiple) {
      await handleFile(list[0]);
      return;
    }

    const cap = maxCount != null ? Math.max(0, maxCount) : list.length;
    if (cap <= 0) {
      toast.error('You have reached the maximum number of files.');
      return;
    }
    const chosen = list.slice(0, cap);
    if (list.length > cap) toast.error('You have reached the maximum number of files.');

    const valid = chosen.filter(validate);
    if (!valid.length) return;

    setUploading(true);
    try {
      const perFile = new Array(valid.length).fill(0);
      const results = await Promise.all(
        valid.map((file, i) =>
          uploadMedia(file, kind, (pct) => {
            perFile[i] = pct;
            const avg = perFile.reduce((a, b) => a + b, 0) / valid.length;
            setProgress(Math.round(avg));
          }),
        ),
      );
      onChangeMany?.(results);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  return (
    <div>
      {label && <p className="mb-1.5 text-sm font-medium text-text-primary">{label}</p>}
      <div
        onClick={() => inputRef.current?.click()}
        onDrop={(e) => {
          e.preventDefault();
          handleFiles(e.dataTransfer.files);
        }}
        onDragOver={(e) => e.preventDefault()}
        className={cn(
          'group relative cursor-pointer overflow-hidden rounded-md border border-dashed border-border bg-bg-muted transition-colors hover:border-brand',
          aspect === 'square' ? 'aspect-square w-32' : 'aspect-[3/1] w-full',
          containerClassName,
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files || []);
            e.target.value = '';
            handleFiles(files);
          }}
        />
        {value ? (
          <>
            {mediaType === 'video' ? (
              <video src={value} className="h-full w-full object-cover" muted preload="metadata" />
            ) : (
              <img src={value} alt="" className="h-full w-full object-cover" />
            )}
            <div className="absolute inset-0 hidden items-center justify-center gap-2 bg-black/50 group-hover:flex">
              {mediaType === 'video' && <Film className="h-4 w-4 text-white" />}
              <span className="text-xs font-medium text-white">Change</span>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange?.('', 'image');
              }}
              className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
              aria-label="Remove media"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </>
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 text-text-muted">
            {uploading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin text-brand" />
                <span className="text-xs">{progress}%</span>
              </>
            ) : (
              <>
                {acceptVideo ? <Film className="h-5 w-5" /> : <ImagePlus className="h-5 w-5" />}
                <span className="text-xs">
                  {acceptVideo ? 'Upload media' : multiple ? 'Upload images' : 'Upload image'}
                </span>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
