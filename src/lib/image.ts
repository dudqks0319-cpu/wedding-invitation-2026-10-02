/**
 * 사진을 브라우저에서 줄여서 data URL 로 변환 (저장 공간 절약)
 * TODO(backend): 서버/스토리지(S3 등)에 업로드하고 URL 을 돌려받도록 교체
 */
export function resizeImage(file: File, maxSize = 1200, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("파일을 읽을 수 없어요"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("이미지 파일이 아니에요"));
      img.onload = () => {
        const ratio = Math.min(1, maxSize / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * ratio);
        canvas.height = Math.round(img.height * ratio);
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("이미지를 처리할 수 없어요"));
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
