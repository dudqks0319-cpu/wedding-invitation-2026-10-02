"use client";
import Link from 'next/link';
import {useServiceConfig} from '@/lib/serviceConfig';

export function PolicyPage({kind}:{kind:'privacy'|'terms'}){
 const {config,loading,error}=useServiceConfig();
 return <article className="mx-auto max-w-3xl space-y-7 px-5 py-14 text-[15px] leading-8">
  <h1 className="text-3xl font-bold">{kind==='privacy'?'개인정보처리방침':'이용약관'}</h1>
  <p className="text-muted">청첩장 서비스 · 2026년 10월 7일 작성</p>
  {loading?<p role="status">운영 정보를 확인하고 있어요…</p>:error?<p role="alert">운영 정보를 불러오지 못했어요. 다시 접속해 주세요.</p>:!config.privacyReady&&<p role="note" className="rounded-xl bg-cream p-4">공개 출시 전 안내문입니다. 운영자 연락처와 국외 처리 정보를 확인 중이에요.</p>}
  {kind==='privacy'?<>
   <section><h2 className="text-xl font-bold">처리하는 정보와 목적</h2><p>로그인 제공자의 계정 식별값과 로그인 세션은 계정 확인에 사용합니다. Apple 로그인은 이메일과 이름을 요청하지 않습니다. 직접 입력한 행사 일시, 이름, 연락처, 장소, 계좌, 사진은 청첩장 제작과 공유에 사용합니다. 하객 이름·참석 인원·식사·메모는 참석 명단, 이름·메시지·삭제 비밀번호의 해시값은 방명록에 사용합니다. 문의와 신고 내용은 지원 및 악성 콘텐츠 처리에 사용합니다. 비밀번호 원문을 저장하지 않습니다.</p></section>
   <section><h2 className="text-xl font-bold">공개 범위와 공유</h2><p>초안과 참석 응답은 작성자만 확인할 수 있습니다. 공유를 시작한 청첩장과 승인한 방명록은 링크를 가진 누구나 볼 수 있습니다. 계좌·연락처·사진의 공개 여부를 확인하고 공유해 주세요. 받는 사람이 저장한 화면이나 카카오톡 등에 이미 전달한 정보까지 회수할 수는 없습니다.</p></section>
   <section><h2 className="text-xl font-bold">보관과 삭제</h2><p>청첩장은 행사일 30일 뒤 만료되며, 연결이 끊긴 사진은 정리 대상이 됩니다. 로그인 세션은 최대 30일, 문의·신고 기록은 최대 90일 보관합니다. 악성 요청 방지를 위해 원본 IP 대신 해시 식별값과 제한된 요청 수를 사용합니다. 방명록 작성 브라우저를 구분하는 보안 쿠키는 최대 180일 사용합니다.</p><p>앱 또는 웹의 <Link href="/settings" className="underline">계정 및 개인정보</Link>에서 서비스 계정을 삭제할 수 있습니다. 공유와 해당 서비스 세션을 즉시 중지하고 청첩장·참석 응답·방명록·문의를 삭제합니다. 사진 파일과 Apple 연결 해제는 후속 정리 작업으로 처리합니다. 오삼오삼 자료는 별도 서비스 자료이므로 자동 삭제하지 않습니다. 공통 로그인 식별값은 그 서비스에서 계속 사용하는 경우 유지됩니다. 사진 정리와 Apple 연결 해제가 끝날 때까지 삭제 상태를 유지하며, 삭제 요청 후 90일이 지나고 후속 정리가 완료되면 재접속 방지 기록을 정리합니다. Apple 로그인으로만 만든 독립 계정 식별값도 정리합니다.</p></section>
   <section><h2 className="text-xl font-bold">처리 위탁과 국외 처리</h2><p>웹 화면 전달에는 Sites, 계정·청첩장·사진 처리에는 Cloudflare의 Workers·D1·R2·Images를 사용합니다. Google·카카오·Apple 로그인과 카카오 공유는 해당 제공자의 정책도 적용됩니다.</p><p>{config.transferNotice||'처리 국가, 이전 항목·시점·방법·보유기간, 수탁자 연락처 및 거부 방법은 공개 운영 전에 확정해 이 안내문에 반영합니다.'}</p></section>
   <section><h2 className="text-xl font-bold">권리 행사와 보호</h2><p>작성한 정보는 편집기에서 수정하거나 삭제하고, 공유를 중지할 수 있습니다. 참석 명단 등 다른 분의 정보를 입력할 때 필요한 안내와 권한을 확보해 주세요. 접속은 암호화하며, 서버에서 로그인과 자료 소유권을 확인합니다. 운영자에게 열람·정정·삭제·처리 정지를 요청할 수 있습니다.</p></section>
  </>:<>
   <section><h2 className="text-xl font-bold">서비스와 이용 범위</h2><p>청첩장·행사 초대장의 제작, 저장, 공유와 참석 응답을 제공합니다. 현재는 무료 시험 운영이며 유료 상품을 판매하지 않습니다. 이용자는 직접 올리는 사진과 개인정보를 사용할 권한 및 필요한 동의를 확보해야 합니다. AI 예시 사진은 디자인 확인용이며 실제 초대장을 공유할 때 직접 준비한 사진으로 바꿔야 합니다.</p></section>
   <section><h2 className="text-xl font-bold">안전한 이용</h2><p>불법·음란·혐오·협박·괴롭힘, 타인의 개인정보 무단 공개, 저작권 침해, 사칭 및 자동 대량 요청을 허용하지 않습니다. 방명록은 작성자 승인 후 공개되며, 작성자는 메시지 삭제 및 작성 브라우저 차단을 사용할 수 있습니다. 공개 화면의 신고와 <Link href="/support" className="underline">고객지원</Link>으로 문제를 접수할 수 있습니다. 위반 콘텐츠는 운영자가 검토해 제한하거나 삭제할 수 있습니다.</p></section>
   <section><h2 className="text-xl font-bold">보관, 용량과 서비스 중지</h2><p>계정별 사진 100MB, 청첩장 20개, 한 청첩장의 갤러리 30장·참석 응답 500건·방명록 100건을 제공합니다. 행사일 30일 뒤 만료됩니다. 서비스 전체 저장 공간 및 일일 처리 한도나 점검에 따라 새 저장이 제한될 수 있습니다. 중요한 원본은 별도로 보관해 주세요.</p></section>
   <section><h2 className="text-xl font-bold">향후 유료 상품</h2><p>유료 상품은 제공 범위, 이용 기간, 가격과 환불 조건을 구매 화면에 안내한 뒤 판매합니다. 현재 구매를 요구하거나 외부 결제 사이트로 연결하지 않습니다. App Store 구매의 환불은 Apple의 승인 결과에 따라 반영됩니다.</p></section>
   <section><h2 className="text-xl font-bold">탈퇴와 변경 안내</h2><p><Link href="/settings" className="underline">계정 및 개인정보</Link>에서 서비스 탈퇴를 신청할 수 있습니다. 서비스 범위·요금·개인정보 처리에 중요한 변경이 있으면 시행 전에 서비스 안에 안내합니다. 소비자에게 적용되는 법적 권리를 제한하지 않습니다.</p></section>
  </>}
  <section><h2 className="text-xl font-bold">운영자와 문의</h2><p>운영자: {config.operatorName||'공개 전 확인 중'}</p><p>{config.supportEmail?<a className="underline" href={'mailto:'+config.supportEmail}>{config.supportEmail}</a>:'공개 문의 이메일 확인 중'}</p><Link className="underline" href="/support">앱 내 고객지원</Link></section>
 </article>;
}
