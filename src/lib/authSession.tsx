"use client";
import {createContext,useContext} from 'react';
import {useApiState} from './api';
import {REMOTE_DATA} from './dataMode';
export type AuthStatus='checking'|'signedIn'|'signedOut'|'unavailable';
export const AuthContext=createContext<AuthStatus|null>(null);
export function useAuthSession():AuthStatus{
 const shared=useContext(AuthContext);
 const state=useApiState(shared!==null?'':'/api/auth/session');
 if(!REMOTE_DATA)return 'signedOut';
 if(shared!==null)return shared;
 if(state.loading)return 'checking';
 if(state.error)return state.error.status===401?'signedOut':'unavailable';
 return (state.data as {id?:string}|undefined)?.id?'signedIn':'signedOut';
}
