export interface Query {
 bind(...values:(string|number|null)[]):Query;
 first<T=Record<string,unknown>>():Promise<T|null>;
 all<T=Record<string,unknown>>():Promise<{results:T[]}>;
 run():Promise<{meta:{changes:number}}>;
}
export interface Database {prepare(sql:string):Query;batch(queries:Query[]):Promise<unknown[]>;}
export interface Bucket {
 put(key:string,bytes:ArrayBuffer|Uint8Array,options?:{httpMetadata:{contentType:string}}):Promise<unknown>;
 get(key:string):Promise<{body:ReadableStream;size:number}|null>;
 delete(key:string):Promise<void>;
}
export interface Env {
 DB:Database;MEDIA:Bucket;ABUSE_HMAC_SECRET:string;NEXT_PUBLIC_SITE_URL?:string;
 WEDDING_OPERATOR_NAME?:string;WEDDING_SUPPORT_EMAIL?:string;WEDDING_PRIVACY_TRANSFER_NOTICE?:string;
 WEDDING_OPERATOR_IDS?:string;
 APPLE_CLIENT_SECRET?:string;APPLE_TOKEN_ENCRYPTION_KEY?:string;
 ASSETS?:{fetch(request:Request):Promise<Response>};
 IMAGES?:{info(stream:ReadableStream):Promise<{width?:number;height?:number;format:string}>;
 input(stream:ReadableStream):{transform(options:Record<string,unknown>):{output(options:Record<string,unknown>):Promise<{response():Response}>}}};
}
