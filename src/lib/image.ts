import { REMOTE_DATA } from './dataMode';
/** 로컬 미리보기는 data URL, 원격 모드는 서버에서 다시 검증한 사진 주소를 반환해요. */
export function resizeImage(file: File, maxSize = 1200, quality = 0.82): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return Promise.reject(new Error('JPG·PNG·WebP 사진을 선택해 주세요'));
  if (file.size > 20 * 1024 * 1024) return Promise.reject(new Error('사진은 20MB 이하로 선택해 주세요'));
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("파일을 읽을 수 없어요"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("이미지 파일이 아니에요"));
      img.onload = async () => {
        const ratio = Math.min(1, maxSize / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * ratio);
        canvas.height = Math.round(img.height * ratio);
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("이미지를 처리할 수 없어요"));
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        if (!REMOTE_DATA) return resolve(canvas.toDataURL("image/jpeg", quality));
        try {
          const blob = await new Promise<Blob>((done, fail) => canvas.toBlob((b) => b ? done(b) : fail(new Error('사진을 처리하지 못했어요')), 'image/jpeg', quality));
          const response = await fetch('/api/uploads', { method: 'POST', body: blob, credentials: 'same-origin', signal: AbortSignal.timeout(20_000), headers: { 'Content-Type': 'image/jpeg', 'Idempotency-Key': crypto.randomUUID() } });
          const result = await response.json();
          if (!response.ok) throw new Error(result.error ?? '사진을 저장하지 못했어요');
          resolve(result.url);
        } catch (error) { reject(error); }
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
