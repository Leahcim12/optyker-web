(function(){
  'use strict';
  var original=staffAgendaMarkup;
  staffAgendaMarkup=function(){
    var html=original.apply(this,arguments);
    if(state.me?.role!=='staff')return html;
    var root=document.createElement('div');root.innerHTML=html;
    var rows=(state.staffAgenda||[]);
    root.querySelectorAll('.staffApptRow').forEach(function(row){
      // The original markup renders seven days in date order, then server order.
      var day=row.closest('.staffDay'),index=Array.from(root.querySelectorAll('.staffDay')).indexOf(day);
      var start=state.staffAgendaStart?new Date(state.staffAgendaStart+'T12:00:00'):staffMonday(new Date());
      var date=staffDateKey(staffPlus(start,index));
      var entries=rows.filter(function(a){return staffDateKey(new Date(a.starts_at))===date});
      var a=entries[Array.from(day.querySelectorAll('.staffApptRow')).indexOf(row)];
      if(!a||!['pending','confirmed'].includes(a.status)||new Date(a.starts_at)<=new Date())return;
      var button=document.createElement('button');button.type='button';button.className='staffMiniBtn';
      button.textContent='Modifica durata';button.dataset.appointmentDuration=a.id;
      row.appendChild(button);
    });
    return root.innerHTML;
  };
  document.addEventListener('click',function(event){
    var button=event.target.closest('[data-appointment-duration]');
    if(!button||state.me?.role!=='staff')return;
    var a=(state.staffAgenda||[]).find(function(a){return a.id===button.dataset.appointmentDuration});
    if(a)optykerEditAppointmentDuration(a,function(payload){return call(APPT,'duration',payload)},async function(){await loadStaffAgenda(true)});
  });
})();
