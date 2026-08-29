const ICON='https://cdn.shopify.com/s/files/1/0917/4289/6503/files/visual-care-logo-app-original.png?v=1787903859';

self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));

self.addEventListener('push',event=>{
  let data={};
  try{data=event.data?event.data.json():{}}catch{data={body:event.data?event.data.text():'Promemoria Optyker'}}
  const title=data.title||'Optyker · Ottica Visual Care';
  const options={
    body:data.body||'Promemoria Optyker',
    icon:ICON,
    badge:ICON,
    tag:data.tag||'optyker-timer',
    renotify:true,
    data:{url:data.url||'/optyker-web/iphone-app-v13/?app=13&tab=timer'}
  };
  event.waitUntil(self.registration.showNotification(title,options));
});

self.addEventListener('notificationclick',event=>{
  event.notification.close();
  const url=event.notification?.data?.url||'/optyker-web/iphone-app-v13/?app=13&tab=timer';
  event.waitUntil((async()=>{
    const list=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    for(const client of list){
      try{
        if('navigate' in client)await client.navigate(url);
        if('focus' in client)return client.focus();
      }catch{}
    }
    return self.clients.openWindow(url);
  })());
});