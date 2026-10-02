import {db,session} from '@/lib/server/supabase';
import {apiResult,limits} from '@/lib/server/security';
import {rowData,type InvitationRow} from '@/lib/server/invitations';

export function GET(request:Request) {return apiResult(async()=>{
  const user=(await session())!;
  await limits(request,'owner-read',user.id);
  const rows=await db<InvitationRow[]>('invitations',{owner_id:`eq.${user.id}`,select:'id,owner_id,data,published,expires_at',order:'updated_at.desc',limit:'5'},'GET',undefined,user.token);
  return Object.fromEntries(rows.map(row=>[row.data.slug,rowData(row)]));
});}
