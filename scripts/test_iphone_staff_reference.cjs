'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'iphone-app-v13/staff-reference-ui-v1.js'), 'utf8');
const html = fs.readFileSync(path.resolve(root, process.argv[2] || '_site/iphone-app-v13/index.html'), 'utf8');
assert.equal((html.match(/id="optykerStaffReferenceJs"/g) || []).length, 1);
assert.equal((html.match(/id="optykerStaffReferenceCss"/g) || []).length, 1);
assert.ok(html.includes(source));
assert.ok(html.indexOf('id="optykerStaffReferenceJs"') > html.indexOf('id="optykerPremiumUiInlineV2"'));
for (const name of ['staffPage','staffAgendaMarkup','staffShiftMarkup','staffClientsMarkup','staffClientDetailMarkup','staffPrescriptionEditors','staffOrdersMarkup','staffThreadsMarkup','staffConversationMarkup']) {
  assert.equal((html.match(new RegExp('function '+name+'\\(', 'g')) || []).length, 1, name+' must be preserved');
}
assert.ok(html.includes("f[0]==='add'&&(i===1||i===4)"), 'Preserve locked ADD rows');
for (const handler of ['saveStaffClient','saveStaffPrescription','saveStaffClinical','staffQuoteConvert','staffQuoteDelete','sendStaffChat','saveStaffProfile','openStaffBooking','openNewStaffClient']) {
  assert.ok(html.includes('window.'+handler+'='), 'Missing business handler '+handler);
}
const noop = () => {};
const ctx = {
  state: {me:{role:'staff',email:'demo@example.invalid',operator:{id:'op-test',username:'DEMO',display_name:'Demo <unsafe>',phone:'123'}},staffHome:{stats:{clients:12,orders:4,pending_reorders:1,unread_chats:2}},staffAgenda:[],staffThreads:[]},
  staffStatsMarkup: () => 'BASE_HOME', staffProfileMarkup: () => 'BASE_PROFILE', staffRender:noop,staffShell:noop,login:noop,shell:noop,
  document: {readyState:'loading',body:{classList:{remove:noop}},addEventListener:noop,querySelector:()=>null,querySelectorAll:()=>[],getElementById:()=>null},
  esc: x => String(x??'').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])),
  fmtDateTime: String, fmtTime: String, Intl, Date,
  staffGo: tab => {ctx.lastRoute=tab;}, toggleDrawer:noop
};
ctx.window=ctx;
vm.createContext(ctx);vm.runInContext(source,ctx);
const home=ctx.staffStatsMarkup();
for (const route of ['staff_agenda','staff_clients','staff_orders','staff_chat','staff_shifts','staff_profile']) assert.ok(home.includes(route), 'Missing service '+route);
for (const cls of ['refDashboard','refHomeTop','refBrandBar','refHero','refPlant','refQuickGrid']) assert.ok(home.includes(cls));
assert.equal((home.match(/class="refQuick"/g)||[]).length,6);
assert.equal((home.match(/class="staffStat"/g)||[]).length,4);
assert.ok(home.includes('Demo &lt;unsafe&gt;') === false); // greeting uses first name only
assert.ok(!home.includes('<unsafe>'));
assert.ok(!home.includes('class="refAppt"'), 'No invented appointments');
const profile=ctx.staffProfileMarkup();
for (const id of ['staffDisplayName','staffPhone','staffProfileFile','staffRefProfileEdit']) assert.equal((profile.match(new RegExp('id="'+id+'"','g'))||[]).length,1,id);
assert.equal((profile.match(/ readonly/g)||[]).length,2);
assert.ok(profile.includes('Demo &lt;unsafe&gt;'));
assert.ok(profile.includes('saveStaffProfile()'));
assert.ok(!profile.includes('Cliente Premium'));
ctx.optykerStaffGo('staff_clients');assert.equal(ctx.lastRoute,'staff_clients');
ctx.optykerStaffGo('shop');assert.equal(ctx.lastRoute,'staff_clients','Do not add customer routes to staff');
ctx.state.me.role='customer';
assert.equal(ctx.staffStatsMarkup(),'BASE_HOME');assert.equal(ctx.staffProfileMarkup(),'BASE_PROFILE');
ctx.optykerStaffGo('staff_orders');assert.equal(ctx.lastRoute,'staff_clients','Customer cannot use staff navigation');
ctx.state.me=null;ctx.optykerStaffGo('staff_home');assert.equal(ctx.lastRoute,'staff_clients');
assert.ok(!source.includes("call(API, 'customer_home'"));
console.log('PASS: shared staff/client UI, staff routes, profile fields, role guards, unchanged business handlers, inline production asset.');
