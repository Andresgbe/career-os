// Shrinks a photo client-side before it ever reaches Supabase Storage.
//
// Nothing in this app compressed images before this: every upload — chat
// photos, eval plans, medical exams, motorcycle attachments, project
// images — stored the file exactly as the phone camera produced it. A
// single photo is commonly 3-8 MB; 150-200 of them (a semester's worth of
// class photos across two subjects) adds up to 600+ MB for something that
// renders at a few hundred pixels wide. Resizing to a sane max width and
// re-encoding as JPEG cuts that by roughly 10-20x with no visible loss for
// a note, a receipt, or a screenshot.
//
// Safe by construction: anything that isn't a plain JPEG/PNG, anything
// already small, or anything that fails to decode (HEIC, corrupt files,
// browsers without canvas image support) passes through untouched rather
// than blocking the upload. PDFs and other documents are never touched —
// only this narrow image/jpeg|png case is handled, so camera scans of
// paperwork (medical exams, receipts) upload exactly as given.

const MAX_WIDTH = 1600;
const MAX_HEIGHT = 1600;
const QUALITY = 0.82;
// Below this, compressing isn't worth the CPU time — covers icons, small
// screenshots, anything already reasonably sized.
const MIN_SIZE_TO_COMPRESS = 300 * 1024;

const COMPRESSIBLE_TYPES = new Set(["image/jpeg", "image/jpg", "image/png"]);

export async function compressImage(file: File): Promise<File> {
  if (!COMPRESSIBLE_TYPES.has(file.type) || file.size <= MIN_SIZE_TO_COMPRESS) {
    return file;
  }

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_WIDTH / bitmap.width, MAX_HEIGHT / bitmap.height);
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;

    // Flattens transparency to white — fine for camera photos and opaque
    // screenshots, which is what this threshold actually catches in
    // practice (a PNG logo or icon never reaches 300 KB).
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", QUALITY)
    );
    if (!blob || blob.size >= file.size) return file;

    const name = file.name.replace(/\.(jpe?g|png)$/i, "") + ".jpg";
    return new File([blob], name, { type: "image/jpeg", lastModified: Date.now() });
  } catch {
    // Decoding failed (HEIC, a corrupt file, an old browser) — the
    // original upload still has to go through.
    return file;
  }
}
