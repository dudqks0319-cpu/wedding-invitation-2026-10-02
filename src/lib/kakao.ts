"use client";
import type { Invitation } from '@/types/invitation';
interface KakaoSdk { isInitialized(): boolean; init(key:string):void; Share:{sendDefault(value:unknown):void}; }
declare global { interface Window { Kakao?: KakaoSdk; } }
let loading:Promise<KakaoSdk> | undefined;
function sdk():Promise<KakaoSdk> {
  if(window.Kakao)return Promise.resolve(window.Kakao);
  return loading ??= new Promise((resolve,reject)=>{
    const script=document.createElement('script');
    script.src='https://t1.kakaocdn.net/kakao_js_sdk/2.8.3/kakao.min.js';
    script.integrity='sha384-oroumrnFVE0xtgqyDZJARgERibXg2C28380uaUZz2kHDS5CR7tu20eGiOU6GkTpy';
    script.crossOrigin='anonymous';script.async=true;
    const timer=setTimeout(()=>{script.remove();loading=undefined;reject(new Error('카카오 연결 시간이 초과됐어요'));},5000);
    script.onload=()=>{clearTimeout(timer);if(window.Kakao)resolve(window.Kakao);else reject(new Error('카카오 공유를 불러오지 못했어요'));};
    script.onerror=()=>{clearTimeout(timer);script.remove();loading=undefined;reject(new Error('카카오 공유를 불러오지 못했어요'));};
    document.head.appendChild(script);
  });
}
export async function kakaoShare(inv:Invitation,url:string):Promise<boolean> {
  const key=process.env.NEXT_PUBLIC_KAKAO_JS_KEY;
  if(!key || inv.published===false)return false;
  const Kakao=await sdk();if(!Kakao.isInitialized())Kakao.init(key);
  const link={mobileWebUrl:url,webUrl:url};
  Kakao.Share.sendDefault({objectType:'feed',content:{title:inv.shareTitle,description:inv.shareDescription,imageUrl:new URL(inv.coverPhoto,url).toString(),link},buttons:[{title:'초대장 보기',link}]});
  return true;
}
