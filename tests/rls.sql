-- Run only against a dedicated development project after applying the migration.
-- Every fixture is rolled back. This file is not live verification until executed.
begin;
insert into auth.users(id,aud,role,email) values
 ('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','authenticated','authenticated','fixture-owner@example.invalid'),
 ('bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb','authenticated','authenticated','fixture-other@example.invalid');
insert into public.invitations(id,owner_id,slug,template_id,type,data,published) values
 ('cccccccc-cccc-4ccc-cccc-cccccccccccc','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','rls-private','blossom','wedding','{"slug":"rls-private","templateId":"blossom","type":"wedding","gallery":[]}',false),
 ('dddddddd-dddd-4ddd-dddd-dddddddddddd','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','rls-public','blossom','wedding','{"slug":"rls-public","templateId":"blossom","type":"wedding","gallery":[]}',true);
insert into public.guestbook(invitation_id,name,message,password_hash) values
 ('dddddddd-dddd-4ddd-dddd-dddddddddddd','fixture','message','never-return-this-hash');
insert into public.rsvps(invitation_id,side,name,attending,count,meal) values
 ('dddddddd-dddd-4ddd-dddd-dddddddddddd','groom','fixture',true,1,'yes');
set local role anon;
do $$begin
  if (select count(*) from public.invitations where slug like 'rls-%')<>1 then raise exception 'anon draft disclosure';end if;
  if (select count(*) from public.guestbook where name='fixture')<>1 then raise exception 'public guestbook missing';end if;
  begin perform password_hash from public.guestbook;raise exception 'password hash readable';exception when insufficient_privilege then null;end;
  begin perform * from public.rsvps;raise exception 'anonymous RSVP readable';exception when insufficient_privilege then null;end;
  begin perform public.consume_limits('[]'::jsonb);raise exception 'guest quota RPC available';exception when insufficient_privilege then null;end;
end$$;
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb',true);
do $$begin
  if (select count(*) from public.invitations where slug='rls-private')<>0 then raise exception 'other user draft disclosure';end if;
  if (select count(*) from public.rsvps where name='fixture')<>0 then raise exception 'other user RSVP disclosure';end if;
  begin update public.invitations set published=true where slug='rls-private';raise exception 'direct mutation allowed';exception when insufficient_privilege then null;end;
end$$;
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',true);
do $$begin
  if (select count(*) from public.invitations where slug like 'rls-%')<>2 then raise exception 'owner drafts missing';end if;
  if (select count(*) from public.rsvps where name='fixture')<>1 then raise exception 'owner RSVP missing';end if;
  begin perform password_hash from public.guestbook;raise exception 'owner hash readable';exception when insufficient_privilege then null;end;
end$$;
reset role;
do $$begin
  if (select public from storage.buckets where id='invitation-photos') then raise exception 'photo bucket public';end if;
end$$;
rollback;
