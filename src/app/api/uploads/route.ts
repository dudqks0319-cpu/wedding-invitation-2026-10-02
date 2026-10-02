import sharp from 'sharp';
import {db,session,upstream} from '@/lib/server/supabase';
import {ApiError} from '@/lib/server/validation';
import {apiResult,boundedBody,checkOrigin,digest,idempotent,limits} from '@/lib/server/security';

let active=0;
export function POST(request:Request) {return apiResult(async()=>{
  checkOrigin(request);const user=(await session())!;
  if(active>=2)throw new ApiError(429,'사진 처리 중이에요. 잠시 후 다시 올려 주세요');
  active++;
  try {
    await limits(request,'upload-request',user.id);
    if(!['image/jpeg','image/png','image/webp'].includes(request.headers.get('content-type')||''))throw new ApiError(400,'JPG·PNG·WebP 사진만 올릴 수 있어요');
    const buffer=await boundedBody(request,2*1024*1024);
    let output:Buffer;
    try {
      const image=sharp(buffer,{limitInputPixels:12_000_000,animated:false});
      const meta=await image.metadata();
      if(!['jpeg','png','webp'].includes(meta.format||'') || !meta.width || !meta.height || (meta.pages||1)>1)throw new Error('invalid image');
      output=await image.rotate().resize({width:1200,height:1200,fit:'inside',withoutEnlargement:true}).webp({quality:80}).toBuffer();
    } catch {throw new ApiError(400,'사진 파일을 읽을 수 없어요 (최대 1,200만 화소)');}
    if(output.length>1048576)throw new ApiError(413,'사진이 너무 커요. 크기를 줄여 주세요');
    const hash=digest(output);
    const existing=await db<{id:string}[]>('invitation_photos',{owner_id:`eq.${user.id}`,sha256:`eq.${hash}`,select:'id',limit:'1'});
    if(existing.length)return {url:`/api/photos/${existing[0].id}`};
    await limits(request,'upload-bytes',user.id,output.length);
    return idempotent(request,`upload:${user.id}`,{hash},async(id)=>{
      const objectPath=`${user.id}/${id}.webp`;
      await upstream(`/storage/v1/object/invitation-photos/${objectPath}`,{method:'POST',headers:{'Content-Type':'image/webp','x-upsert':'false'},body:new Uint8Array(output)},undefined,true);
      try {await db('invitation_photos',{},'POST',{id,owner_id:user.id,object_path:objectPath,sha256:hash,bytes:output.length});}
      catch(error) {
        // Bounded cleanup only for this request's new object; no unrelated photos are removed.
        await upstream('/storage/v1/object/invitation-photos',{method:'DELETE',body:JSON.stringify({prefixes:[objectPath]})},undefined,true).catch(()=>{});
        throw error;
      }
      return {url:`/api/photos/${id}`};
    });
  } finally {active--;}
});}
