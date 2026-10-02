import {backendConfig,db,session,upstream} from '@/lib/server/supabase';
import {ApiError} from '@/lib/server/validation';
import {apiResult,limits} from '@/lib/server/security';

export async function GET(request:Request,context:{params:Promise<{id:string}>}) {
  let redirect:string|undefined;
  const result=await apiResult(async()=>{
    const {id}=await context.params;
    if(!/^[a-f0-9-]{36}$/.test(id))throw new ApiError(404,'사진을 찾을 수 없어요');
    await limits(request,'photo-read');
    const rows=await db<{owner_id:string;object_path:string}[]>('invitation_photos',{id:`eq.${id}`,select:'owner_id,object_path',limit:'1'});
    if(!rows.length)throw new ApiError(404,'사진을 찾을 수 없어요');
    const url=`/api/photos/${id}`;
    const inv=await db<{id:string}[]>('invitations',{published:'eq.true',expires_at:`gt.${new Date().toISOString()}`,or:`(data->>coverPhoto.eq.${url},data->gallery.cs.["${url}"])`,select:'id',limit:'1'});
    if(!inv.length && (await session(false))?.id!==rows[0].owner_id)throw new ApiError(404,'사진을 찾을 수 없어요');
    const signed=await upstream<{signedURL:string}>(`/storage/v1/object/sign/invitation-photos/${rows[0].object_path}`,{method:'POST',body:JSON.stringify({expiresIn:60})},undefined,true);
    const target=new URL(`/storage/v1${signed.signedURL}`,backendConfig().url);
    if(target.origin!==new URL(backendConfig().url).origin)throw new ApiError(503,'사진 주소를 확인할 수 없어요');
    redirect=target.toString();return null;
  });
  return redirect?new Response(null,{status:302,headers:{Location:redirect,'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'}}):result;
}
