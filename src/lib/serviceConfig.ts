"use client";
import {useApiState} from './api';
export type ServiceConfig={operatorName:string;supportEmail:string;transferNotice:string;privacyReady:boolean;appleEnabled:boolean;billingEnabled:boolean};
const empty:ServiceConfig={operatorName:'',supportEmail:'',transferNotice:'',privacyReady:false,appleEnabled:false,billingEnabled:false};
export function useServiceConfig(){
 const state=useApiState('/api/account/config');
 return {config:(state.data as ServiceConfig|undefined)??empty,loading:state.loading,error:state.error};
}
