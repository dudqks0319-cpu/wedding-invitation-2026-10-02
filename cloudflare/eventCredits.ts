import type {Env} from './types';
import {ApiError} from '../src/lib/server/validation';
import {APPLE_EVENT_CREDIT} from './billing';

function validate(owner:string,slug:string){
 if(typeof owner!=='string'||owner.length===0||owner.length>128||
  typeof slug!=='string'||!/^([a-z0-9-]{3,30})$/.test(slug))
  throw new ApiError(400,'청첩장 사용권 정보가 올바르지 않아요');
}

async function liveInvitation(env:Env,owner:string,slug:string){
 const row=await env.DB.prepare(`SELECT slug FROM w2_invitations i WHERE slug=? AND owner_id=? AND expires_at>?
  AND NOT EXISTS(SELECT 1 FROM w2_account_deletions d WHERE d.owner_id=i.owner_id)
  AND NOT EXISTS(SELECT 1 FROM deletion_jobs d WHERE d.owner_id=i.owner_id AND d.state<>'complete')`)
  .bind(slug,owner,new Date().toISOString()).first();
 if(!row)throw new ApiError(404,'청첩장을 찾을 수 없어요');
}

/** Internal only: the caller supplies the authenticated account and a server-verified ledger ID.
 * No HTTP route can apply or read a paid benefit yet. Signature/budget/product gates are separate.
 * A refund changes the joined transaction state; it never frees an already consumed credit.
 */
export async function applyEventCredit(env:Env,owner:string,slug:string,transactionId:string){
 validate(owner,slug);
 if(typeof transactionId!=='string'||!/^\d{1,64}$/.test(transactionId))
  throw new ApiError(400,'구매 확인 정보가 올바르지 않아요');
 await liveInvitation(env,owner,slug);
 // Ownership, deletion, refund and expiry are rechecked in the single atomic INSERT.
 await env.DB.prepare(`INSERT INTO w2_event_credits(environment,transaction_id,invitation_slug,applied_at)
  SELECT t.environment,t.transaction_id,i.slug,? FROM w2_apple_transactions t
  JOIN w2_invitations i ON i.slug=? AND i.owner_id=t.owner_id
  JOIN w2_billing_accounts b ON b.owner_id=t.owner_id
  WHERE t.environment='Production' AND t.transaction_id=? AND t.product_id=?
   AND t.owner_id=? AND t.revoked_at IS NULL AND i.expires_at>?
   AND NOT EXISTS(SELECT 1 FROM w2_account_deletions d WHERE d.owner_id=t.owner_id)
   AND NOT EXISTS(SELECT 1 FROM deletion_jobs d WHERE d.owner_id=t.owner_id AND d.state<>'complete')
   AND NOT EXISTS(SELECT 1 FROM w2_event_credits c
    JOIN w2_apple_transactions current ON current.environment=c.environment AND current.transaction_id=c.transaction_id
    WHERE c.invitation_slug=i.slug AND current.revoked_at IS NULL
     AND c.rowid=(SELECT MAX(newest.rowid) FROM w2_event_credits newest WHERE newest.invitation_slug=i.slug))
  ON CONFLICT DO NOTHING`).bind(new Date().toISOString(),slug,transactionId,APPLE_EVENT_CREDIT,owner,new Date().toISOString()).run();
 const credit=await eventCreditStatus(env,owner,slug);
 if(credit.state!=='active'||credit.transactionId!==transactionId)
  throw new ApiError(409,'이미 사용했거나 현재 사용할 수 없는 구매예요');
 return {transactionId,slug,state:'applied' as const,durablyApplied:true};
}

export async function eventCreditStatus(env:Env,owner:string,slug:string){
 validate(owner,slug);await liveInvitation(env,owner,slug);
 const row=await env.DB.prepare(`SELECT t.transaction_id,t.revoked_at FROM w2_event_credits c
  JOIN w2_apple_transactions t ON t.environment=c.environment AND t.transaction_id=c.transaction_id
  JOIN w2_billing_accounts b ON b.owner_id=t.owner_id
  JOIN w2_invitations i ON i.slug=c.invitation_slug AND i.owner_id=t.owner_id
  WHERE c.environment='Production' AND c.invitation_slug=? AND t.owner_id=? AND t.product_id=? AND i.expires_at>?
   AND NOT EXISTS(SELECT 1 FROM w2_account_deletions d WHERE d.owner_id=t.owner_id)
   AND NOT EXISTS(SELECT 1 FROM deletion_jobs d WHERE d.owner_id=t.owner_id AND d.state<>'complete')
  ORDER BY c.rowid DESC LIMIT 1`)
  .bind(slug,owner,APPLE_EVENT_CREDIT,new Date().toISOString()).first<{transaction_id:string;revoked_at:number|null}>();
 return row?{state:row.revoked_at===null?'active' as const:'refunded' as const,transactionId:row.transaction_id}:
  {state:'none' as const,transactionId:null};
}
