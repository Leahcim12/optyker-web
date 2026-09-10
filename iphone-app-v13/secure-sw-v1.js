const ICON='https://cdn.shopify.com/s/files/1/0917/4289/6503/files/visual-care-logo-app-original.png?v=1787903859';
const APP_VERSION='20260911-secure-auth-v1';
const APP_URL='./?app=13&build='+APP_VERSION;
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
// Never navigate open tabs during activation: that can discard an email link
// or interrupt an in-progress password form. HTML uses the network directly.
self.addEventListener('push',event=>{
 let data={};
 try{data=event.data?event.data.json():{}}catch{data={body:event.data?event.data.text():'Promemoria Optyker'}}
 const title=data.title||'Optyker · Ottica Visual Care';
 event.waitUntil(self.registration.showNotification(title,{body:data.body||'Promemoria Optyker',icon:ICON,badge:ICON,tag:data.tag||'optyker-timer',renotify:true,data:{url:data.url||'./?app=13&tab=timer&build='+APP_VERSION}}));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 const fallback=new URL('./?app=13&tab=timer&build='+APP_VERSION,self.registration.scope);
 let target=fallback;
 try{const u=new URL(event.notification?.data?.url||'',self.registration.scope);if(u.origin===fallback.origin&&u.href.startsWith(self.registration.scope))target=u}catch{}
 event.waitUntil((async()=>{
  const list=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  for(const client of list){
   if(!client.url.startsWith(self.registration.scope))continue;
   try{if('navigate' in client)await client.navigate(target.href);if('focus' in client)return client.focus()}catch{}
  }
  return self.clients.openWindow(target.href);
 })());
});
