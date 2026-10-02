import Link from "next/link";

export default function PricingPage() {
  return <main className="mx-auto max-w-3xl px-5 pt-14">
    <p className="font-script text-[32px] text-brand-400">Invitation</p>
    <h1 className="mt-1 text-[32px] font-bold">서비스 안내</h1>
    <p className="mt-4 text-muted">현재 무료 시험 운영 중입니다. 결제 기능은 제공하지 않아요.</p>
    <section className="mt-8 rounded-[28px] border border-black/5 bg-white p-7">
      <h2 className="text-xl font-bold">내 사진으로 초대하세요</h2>
      <ul className="mt-5 space-y-3 text-[15px] leading-7">
        <li>19가지 디자인, 지도와 길찾기, 계좌 복사, 참석 의사, 승인형 방명록을 사용할 수 있어요.</li>
        <li>대표 사진 1장과 갤러리 최대 30장, 계정별 사진 저장 공간 100MB를 제공합니다.</li>
        <li>AI 예시 사진은 디자인을 살펴보는 용도예요. 공유를 시작하기 전에 내 사진으로 바꿔 주세요.</li>
        <li>저장한 초안은 나만 볼 수 있고, 공유를 시작하면 링크를 가진 분에게 공개됩니다. 수정 후에는 공유 내용을 업데이트해 주세요.</li>
        <li>새 청첩장과 사진은 행사일 30일 후 정리됩니다. 공유 중지는 바로 반영됩니다.</li>
        <li>서비스 전체 저장·처리 한도에 도달하면 저장이 잠시 제한될 수 있어요. 배경음악과 유료 상품은 현재 제공하지 않습니다.</li>
      </ul>
      <Link href="/templates" className="mt-7 inline-block rounded-full bg-ink px-7 py-3.5 font-semibold text-white">청첩장 만들기</Link>
    </section>
  </main>;
}
