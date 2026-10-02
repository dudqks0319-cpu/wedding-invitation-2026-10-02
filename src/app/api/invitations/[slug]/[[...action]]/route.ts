import {db,session} from '@/lib/server/supabase';
import {ApiError,guestbookValue,object,rsvpValue,slugValue,text} from '@/lib/server/validation';
import {apiResult,checkOrigin,hashPassword,idempotent,jsonBody,limits,verifyPassword} from '@/lib/server/security';
import {findInvitation,parseInvitation,rowData,validatePhotos,type InvitationRow} from '@/lib/server/invitations';

type Context={params:Promise<{slug:string;action?:string[]}>};
type GuestRow={id:string;invitation_id:string;name:string;message:string;password_hash:string;created_at:string};
type RsvpRow={id:string;side:'groom'|'bride'|'host';name:string;attending:boolean;count:number;meal:'yes'|'no'|'unknown';memo:string;created_at:string};
const guestData=(r:GuestRow)=>({id:r.id,name:r.name,message:r.message,createdAt:r.created_at});

async function handle(request:Request,context:Context) {
  const {slug,action=[]}=await context.params;slugValue(slug);
  const method=request.method;
  if(method!=='GET')checkOrigin(request);
  if(!action.length) {
    if(method==='GET') {
      await limits(request,'public-read');
      try {return rowData((await findInvitation(slug)).row);} catch(error) {
        if(!(error instanceof ApiError) || error.status!==404)throw error;
        return rowData((await findInvitation(slug,true)).row);
      }
    }
    const user=(await session())!;await limits(request,'invitation-write',user.id);
    if(method==='PUT') {
      const inv=parseInvitation(await jsonBody(request));
      if(inv.slug!==slug)throw new ApiError(400,'주소가 일치하지 않아요');
      await validatePhotos(inv,user.id);
      const existing=await db<InvitationRow[]>('invitations',{slug:`eq.${slug}`,select:'id,owner_id,data,published,expires_at',limit:'1'});
      if(existing.length && existing[0].owner_id!==user.id)throw new ApiError(409,'이미 사용 중인 주소예요');
      return idempotent(request,`invitation:${user.id}:${slug}`,inv,async(id)=> {
        const value={owner_id:user.id,slug,template_id:inv.templateId,type:inv.type,data:inv,updated_at:new Date().toISOString()};
        const rows=await db<InvitationRow[]>('invitations',existing.length?{slug:`eq.${slug}`,owner_id:`eq.${user.id}`}:{},existing.length?'PATCH':'POST',existing.length?value:{...value,id,published:false});
        if(!rows.length)throw new ApiError(404,'청첩장을 찾을 수 없어요');
        return rowData(rows[0]);
      });
    }
    if(method==='DELETE') {
      const {row}=await findInvitation(slug,true);
      return idempotent(request,`delete:${user.id}:${slug}`,{},async()=>{
        await db('invitations',{id:`eq.${row.id}`,owner_id:`eq.${user.id}`},'DELETE',undefined);
        return {deleted:true};
      });
    }
  }
  if(action[0]==='publish' && action.length===1 && method==='POST') {
    const {row,user}=await findInvitation(slug,true);await limits(request,'publish',user!.id);
    const input=object(await jsonBody(request));
    if(typeof input.published!=='boolean')throw new ApiError(400,'공유 여부를 확인해 주세요');
    return idempotent(request,`publish:${user!.id}:${slug}`,input,async()=>{
      const rows=await db<InvitationRow[]>('invitations',{id:`eq.${row.id}`,owner_id:`eq.${user!.id}`},'PATCH',{published:input.published,updated_at:new Date().toISOString()});
      if(!rows.length)throw new ApiError(404,'청첩장을 찾을 수 없어요');return rowData(rows[0]);
    });
  }
  if(action[0]==='guestbook' && action.length<=2) {
    await limits(request,method==='GET'?'public-read':'guestbook');
    const {row}=await findInvitation(slug);
    if(!row.data.options.showGuestbook)throw new ApiError(404,'방명록을 사용하지 않는 청첩장이에요');
    if(method==='GET' && action.length===1) {
      const page=Number(new URL(request.url).searchParams.get('page')||'0');
      if(!Number.isInteger(page)||page<0||page>99)throw new ApiError(400,'페이지를 확인해 주세요');
      return (await db<GuestRow[]>('guestbook',{invitation_id:`eq.${row.id}`,deleted_at:'is.null',select:'id,name,message,created_at',order:'created_at.desc,id.desc',limit:'50',offset:String(page*50)})).map(guestData);
    }
    if(method==='POST' && action.length===1) {
      const input=guestbookValue(await jsonBody(request));
      return idempotent(request,`guestbook:${row.id}`,input,async(id)=>{
        const rows=await db<GuestRow[]>('guestbook',{},'POST',{id,invitation_id:row.id,name:input.name,message:input.message,password_hash:await hashPassword(input.password)});
        return guestData(rows[0]);
      });
    }
    if(method==='DELETE' && action.length===2) {
      if(!/^[a-f0-9-]{36}$/.test(action[1]))throw new ApiError(400,'메시지를 확인해 주세요');
      const user=await session(false),input=object(await jsonBody(request));
      const rows=await db<GuestRow[]>('guestbook',{id:`eq.${action[1]}`,invitation_id:`eq.${row.id}`,limit:'1'});
      if(!rows.length)throw new ApiError(404,'메시지를 찾을 수 없어요');
      if(user?.id!==row.owner_id && !await verifyPassword(text(input.password,64,'비밀번호'),rows[0].password_hash))throw new ApiError(403,'비밀번호가 일치하지 않아요');
      return idempotent(request,`guestbook-delete:${row.id}:${action[1]}`,input,async()=>{
        await db('guestbook',{id:`eq.${action[1]}`,invitation_id:`eq.${row.id}`},'PATCH',{deleted_at:new Date().toISOString()});return {deleted:true};
      });
    }
  }
  if(action[0]==='rsvp' && action.length===1) {
    if(method==='GET') {
      const {row,user}=await findInvitation(slug,true);await limits(request,'rsvp-read',user!.id);
      return (await db<RsvpRow[]>('rsvps',{invitation_id:`eq.${row.id}`,select:'id,side,name,attending,count,meal,memo,created_at',order:'created_at.desc',limit:'1000'},'GET',undefined,user!.token)).map(r=>({id:r.id,side:r.side,name:r.name,attending:r.attending,count:r.count,meal:r.meal,memo:r.memo,createdAt:r.created_at}));
    }
    if(method==='POST') {
      await limits(request,'rsvp');const {row}=await findInvitation(slug);
      if(!row.data.options.showRsvp)throw new ApiError(404,'참석 응답을 사용하지 않는 청첩장이에요');
      const input=rsvpValue(await jsonBody(request));
      if((row.data.type==='wedding' && input.side==='host') || (row.data.type!=='wedding' && input.side!=='host'))throw new ApiError(400,'하객 구분을 확인해 주세요');
      return idempotent(request,`rsvp:${row.id}`,input,async(id)=>{
        const rows=await db<RsvpRow[]>('rsvps',{},'POST',{...input,id,invitation_id:row.id});
        return {...input,id:rows[0].id,createdAt:rows[0].created_at};
      });
    }
  }
  throw new ApiError(405,'지원하지 않는 요청이에요');
}
export const GET=(r:Request,c:Context)=>apiResult(()=>handle(r,c));
export const PUT=GET;
export const POST=GET;
export const DELETE=GET;
