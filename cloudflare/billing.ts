import type {Env} from './types';
import {ApiError} from '../src/lib/server/validation';
import {actor,csrf,hmac,quota,response} from './security';

export const APPLE_EVENT_CREDIT='com.invitehub.wedding-preview.event-credit.v1';
const APPLE_BUNDLE='com.invitehub.wedding-preview';
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
export type VerifiedAppleTransaction={
 transactionId:string;productId:string;bundleId:string;environment:'Sandbox'|'Production';
 appAccountToken:string;purchaseDate:number;signedDate:number;revocationDate?:number;
};
export type VerifiedAppleRefundNotification={
 notificationUUID:string;notificationType:'REFUND'|'REFUND_REVERSED';signedDate:number;
 environment:'Sandbox'|'Production';bundleId:string;transaction:VerifiedAppleTransaction;
};

function validateTransaction(input:VerifiedAppleTransaction){
 if(!input||typeof input.transactionId!=='string'||typeof input.appAccountToken!=='string')
  throw new ApiError(400,'구매 확인 정보가 올바르지 않아요');
 const now=Date.now(),token=input.appAccountToken?.toLowerCase();
 if(!/^\d{1,64}$/.test(input.transactionId)||input.productId!==APPLE_EVENT_CREDIT||input.bundleId!==APPLE_BUNDLE||
  !['Sandbox','Production'].includes(input.environment)||!uuid.test(token??'')||
  !Number.isSafeInteger(input.purchaseDate)||input.purchaseDate<=0||input.purchaseDate>now+300000||
  !Number.isSafeInteger(input.signedDate)||input.signedDate<input.purchaseDate||input.signedDate>now+300000||
  (input.revocationDate!==undefined&&(!Number.isSafeInteger(input.revocationDate)||input.revocationDate<input.purchaseDate||input.revocationDate>input.signedDate)))
  throw new ApiError(400,'구매 확인 정보가 올바르지 않아요');
 return token;
}

/** Internal ledger boundary. Production callers must verify Apple's signatures first.
 * No HTTP route calls these functions. Plain objects are not cryptographic proof.
 * Purchases cannot undo refunds; only a newer verified REFUND_REVERSED notification can.
 */
export async function recordVerifiedAppleTransaction(env:Env,input:VerifiedAppleTransaction){
 return recordLedger(env,input);
}

/** The adapter must verify BOTH the notification envelope and its nested transaction JWS.
 * REFUND_REVERSED is authoritative even if the nested transaction retains revocationDate.
 * Notification signedDate orders status snapshots, not arrival time or transaction ID.
 */
export async function recordVerifiedAppleRefundNotification(env:Env,input:VerifiedAppleRefundNotification){
 if(!input||!['REFUND','REFUND_REVERSED'].includes(input.notificationType)||
  typeof input.notificationUUID!=='string'||!uuid.test(input.notificationUUID.toLowerCase())||
  !Number.isSafeInteger(input.signedDate)||input.signedDate<=0||input.signedDate>Date.now()+300000)
  throw new ApiError(400,'환불 알림 정보가 올바르지 않아요');
 validateTransaction(input.transaction);
 if(input.environment!==input.transaction.environment||input.bundleId!==input.transaction.bundleId||
  input.signedDate<input.transaction.purchaseDate||
  (input.notificationType==='REFUND'&&input.transaction.revocationDate===undefined))
  throw new ApiError(400,'환불 알림과 구매 정보가 일치하지 않아요');
 return recordLedger(env,input.transaction,input);
}

async function recordLedger(env:Env,input:VerifiedAppleTransaction,notification?:VerifiedAppleRefundNotification){
 const token=validateTransaction(input),hash=await hmac(env,'apple-account:'+token);
 const owner=await env.DB.prepare(`SELECT b.owner_id FROM w2_billing_accounts b WHERE app_account_token=?
  AND NOT EXISTS(SELECT 1 FROM w2_account_deletions d WHERE d.owner_id=b.owner_id)
  AND NOT EXISTS(SELECT 1 FROM deletion_jobs d WHERE d.owner_id=b.owner_id AND d.state<>'complete')`).bind(token).first<{owner_id:string}>();
 const revokedAt=notification?.notificationType==='REFUND_REVERSED'?null:input.revocationDate??null;
 const statusAt=notification?.signedDate??(revokedAt===null?0:input.signedDate);
 if(!owner&&revokedAt===null&&!notification)throw new ApiError(403,'구매한 서비스 계정으로 다시 로그인해 주세요');
 const notificationId=notification?.notificationUUID.toLowerCase();
 // Keep only minimal audit facts, never the raw signed payload or an account token.
 const eventHash=notification?await hmac(env,'apple-refund-event:'+JSON.stringify([
  input.environment,notificationId,notification.notificationType,notification.signedDate,
  input.transactionId,input.productId,hash,input.purchaseDate,input.signedDate,input.revocationDate??null])):null;
 const recordedAt=new Date().toISOString(),queries=[];
 if(notification)queries.push(env.DB.prepare(`INSERT INTO w2_apple_refund_notifications
  (environment,notification_id,transaction_id,notification_type,signed_at,revoked_at,payload_hash,recorded_at)
  SELECT ?,?,?,?,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM w2_apple_transactions WHERE environment=? AND transaction_id=?)
   OR EXISTS(SELECT 1 FROM w2_apple_transactions WHERE environment=? AND transaction_id=?
    AND product_id=? AND account_token_hash=? AND purchased_at=?)
  ON CONFLICT(environment,notification_id) DO NOTHING`).bind(input.environment,notificationId!,input.transactionId,
   notification.notificationType,notification.signedDate,input.revocationDate??null,eventHash,recordedAt,
   input.environment,input.transactionId,input.environment,input.transactionId,input.productId,hash,input.purchaseDate));
 // SQL rechecks the account after the asynchronous lookup. A deletion cannot revive credit.
 const ledger=env.DB.prepare(`INSERT INTO w2_apple_transactions
  (environment,transaction_id,product_id,account_token_hash,owner_id,purchased_at,signed_at,revoked_at,recorded_at,refund_state_signed_at)
  SELECT ?,?,?,?,(SELECT b.owner_id FROM w2_billing_accounts b WHERE b.app_account_token=?
   AND NOT EXISTS(SELECT 1 FROM w2_account_deletions d WHERE d.owner_id=b.owner_id)
   AND NOT EXISTS(SELECT 1 FROM deletion_jobs d WHERE d.owner_id=b.owner_id AND d.state<>'complete')),?,?,?,?,?
  WHERE (?=1 OR EXISTS(SELECT 1 FROM w2_billing_accounts b WHERE b.app_account_token=?
   AND NOT EXISTS(SELECT 1 FROM w2_account_deletions d WHERE d.owner_id=b.owner_id)
   AND NOT EXISTS(SELECT 1 FROM deletion_jobs d WHERE d.owner_id=b.owner_id AND d.state<>'complete')))
   AND (?=0 OR EXISTS(SELECT 1 FROM w2_apple_refund_notifications
    WHERE environment=? AND notification_id=? AND payload_hash=?))
  ON CONFLICT(environment,transaction_id) DO UPDATE SET
   signed_at=MAX(signed_at,excluded.signed_at),
   revoked_at=CASE WHEN excluded.refund_state_signed_at>refund_state_signed_at
    OR (excluded.refund_state_signed_at=refund_state_signed_at AND excluded.revoked_at IS NOT NULL)
    THEN excluded.revoked_at ELSE revoked_at END,
   refund_state_signed_at=MAX(refund_state_signed_at,excluded.refund_state_signed_at)
  WHERE product_id=excluded.product_id AND account_token_hash=excluded.account_token_hash
   AND purchased_at=excluded.purchased_at`).bind(input.environment,input.transactionId,input.productId,hash,token,
    input.purchaseDate,input.signedDate,revokedAt,recordedAt,statusAt,
    revokedAt!==null||notification?1:0,token,notification?1:0,input.environment,notificationId??null,eventHash);
 queries.push(ledger);
 // The event identity check and status update commit together. Concurrent UUID conflicts cannot change state.
 await env.DB.batch(queries);
 if(notification){
  const event=await env.DB.prepare(`SELECT payload_hash FROM w2_apple_refund_notifications
   WHERE environment=? AND notification_id=?`).bind(input.environment,notificationId!).first<{payload_hash:string}>();
  if(event?.payload_hash!==eventHash)throw new ApiError(409,'기존 환불 알림과 일치하지 않아요');
 }
 const row=await env.DB.prepare(`SELECT product_id,account_token_hash,owner_id,purchased_at,revoked_at
  FROM w2_apple_transactions WHERE environment=? AND transaction_id=?`).bind(input.environment,input.transactionId)
  .first<{product_id:string;account_token_hash:string;owner_id:string|null;purchased_at:number;revoked_at:number|null}>();
 if(!row||row.product_id!==input.productId||row.account_token_hash!==hash||row.purchased_at!==input.purchaseDate)
  throw new ApiError(409,'기존 구매 기록과 일치하지 않아요');
 if(notification)return {transactionId:input.transactionId,
  state:row.owner_id===null?'unlinked':row.revoked_at===null?'credited':'refunded',durablyRecorded:true};
 if(revokedAt===null&&row.owner_id!==owner?.owner_id)throw new ApiError(403,'삭제되었거나 다른 계정의 구매예요');
 return {transactionId:input.transactionId,productId:input.productId,
  appAccountToken:token,state:row.revoked_at===null?'credited':'refunded',durablyRecorded:true};
}

export async function billingSummary(env:Env,owner:string){
 const counts=await env.DB.prepare(`SELECT
  SUM(CASE WHEN revoked_at IS NULL AND NOT EXISTS(SELECT 1 FROM w2_event_credits c
   WHERE c.environment=w2_apple_transactions.environment AND c.transaction_id=w2_apple_transactions.transaction_id)
   THEN 1 ELSE 0 END) AS available,
  SUM(CASE WHEN revoked_at IS NOT NULL THEN 1 ELSE 0 END) AS refunded
  FROM w2_apple_transactions WHERE owner_id=? AND environment='Production'`).bind(owner)
  .first<{available:number|null;refunded:number|null}>();
 return {available:counts?.available??0,refunded:counts?.refunded??0};
}

export async function billingRoute(env:Env,request:Request,action:string){
 const user=(await actor(env,request))!;
 if(action==='summary'&&request.method==='GET'){
  await quota(env,user.id,'billing-read',30,60);return response(await billingSummary(env,user.id));
 }
 if(['prepare','deliver'].includes(action)&&request.method==='POST'){
  csrf(env,request);await quota(env,user.id,'billing-write',10,60);
  // A control toggle is insufficient. No verifier, provider/budget readiness or paid benefit contract exists yet.
  // Never return an account token/ack, parse a client JWS, or open a chargeable StoreKit flow here.
  throw new ApiError(503,'결제 준비 중이에요. 지금은 구매할 수 없어요');
 }
 throw new ApiError(404,'요청을 찾을 수 없어요');
}
