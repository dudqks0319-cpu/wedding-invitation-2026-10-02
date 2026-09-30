import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="font-script text-[48px] text-brand-400">Oops!</p>
      <p className="text-[18px] font-semibold">페이지를 찾을 수 없어요</p>
      <Link href="/" className="mt-4 rounded-full bg-brand-500 px-6 py-3 text-[14px] font-semibold text-white">
        홈으로
      </Link>
    </div>
  );
}
