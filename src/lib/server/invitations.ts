import 'server-only';
import type {Invitation} from '@/types/invitation';
import {TEMPLATES} from '@/data/templates';
import {ALL_PHOTO_KEYS,photo} from '@/data/photos';
import {db,session} from './supabase';
import {ApiError,invitationValue,slugValue} from './validation';

export interface InvitationRow {id:string;owner_id:string;data:Invitation;published:boolean;expires_at:string;}
export function rowData(row:InvitationRow):Invitation {return {...row.data,published:row.published};}
export async function findInvitation(slug:string, ownerOnly=false) {
  slugValue(slug);
  const user=ownerOnly ? await session() : null;
  const rows=await db<InvitationRow[]>('invitations',{slug:`eq.${slug}`,select:'id,owner_id,data,published,expires_at',...(user?{owner_id:`eq.${user.id}`}:{published:'eq.true',expires_at:`gt.${new Date().toISOString()}`}),limit:'1'},'GET',undefined,user?.token);
  if(!rows.length)throw new ApiError(404,'청첩장을 찾을 수 없어요');
  return {row:rows[0],user};
}
export async function publicInvitation(slug:string):Promise<Invitation|null> {
  try {return rowData((await findInvitation(slug)).row);} catch(error) {if(error instanceof ApiError && error.status===404)return null;throw error;}
}
export async function validatePhotos(inv:Invitation, ownerId:string) {
  const samples=new Set(ALL_PHOTO_KEYS.map(photo));
  if([inv.coverPhoto,...inv.gallery].some(url=>url.startsWith('/photos/') && !samples.has(url)))throw new ApiError(400,'사용할 예시 사진을 다시 골라 주세요');
  const urls=Array.from(new Set([inv.coverPhoto,...inv.gallery].filter(p=>p.startsWith('/api/photos/'))));
  if(!urls.length)return;
  const ids=urls.map(p=>p.split('/').pop());
  const rows=await db<{id:string}[]>('invitation_photos',{id:`in.(${ids.join(',')})`,owner_id:`eq.${ownerId}`,select:'id',limit:'31'});
  if(rows.length!==ids.length)throw new ApiError(403,'본인이 올린 사진만 사용할 수 있어요');
}
export const parseInvitation=(input:unknown)=>invitationValue(input,TEMPLATES);
