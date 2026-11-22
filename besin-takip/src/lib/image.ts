export interface CompressedImage {
  blob: Blob;
  base64: string;
  dataUrl: string;
  mimeType: "image/jpeg";
}

/** Fotoğrafı tarayıcıda küçültür (en uzun kenar 1280 px, JPEG). EXIF konum bilgisi de böylece atılır. */
export async function compressImage(file: Blob, maxDim = 1280, quality = 0.82): Promise<CompressedImage> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("image_decode_failed"));
      el.src = url;
    });
    const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas_unavailable");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    const dataUrl = canvas.toDataURL("image/jpeg", quality);
    const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
    const bin = atob(base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return { blob: new Blob([bytes], { type: "image/jpeg" }), base64, dataUrl, mimeType: "image/jpeg" };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Ana sayfadaki kamera düğmesinden seçilen dosyayı ekleme sayfasına taşımak için. */
let pending: { file: File; kind: "photo" | "label" } | null = null;
export function setPendingPhoto(file: File, kind: "photo" | "label" = "photo") {
  pending = { file, kind };
}
export function takePendingPhoto() {
  const p = pending;
  pending = null;
  return p;
}
