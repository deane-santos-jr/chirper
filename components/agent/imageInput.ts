import type { AgentImage } from '@/lib/agent/types';

/** Claude's sweet spot for image input; larger images only cost more tokens. */
const MAX_EDGE = 1568;
const JPEG_QUALITY = 0.85;

export interface PendingImage extends AgentImage {
  previewUrl: string;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Could not read ${file.name || 'image'}.`));
    image.src = URL.createObjectURL(file);
  });
}

/** Downscales a screenshot to a JPEG small enough to send through a Server Action. */
export async function toAgentImage(file: File): Promise<PendingImage> {
  const image = await loadImage(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(image.naturalWidth * scale);
  canvas.height = Math.round(image.naturalHeight * scale);
  canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height);
  URL.revokeObjectURL(image.src);
  const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
  return { mediaType: 'image/jpeg', base64: dataUrl.slice(dataUrl.indexOf(',') + 1), previewUrl: dataUrl };
}

export function imageFiles(items: DataTransferItemList | FileList | null): File[] {
  if (!items) return [];
  const files = Array.from(items as ArrayLike<DataTransferItem | File>).map((item) => ('getAsFile' in item ? item.getAsFile() : item));
  return files.filter((file): file is File => Boolean(file && file.type.startsWith('image/')));
}
