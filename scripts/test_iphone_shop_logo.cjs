'use strict';
// Focused UI regression test. No customer records, authentication or writes to APIs.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('iphone-app-v13/shop-nav-v2.js', 'utf8');
const html = fs.readFileSync('iphone-app-v13/index.html', 'utf8');
const logo = 'https://cdn.shopify.com/s/files/1/0917/4289/6503/files/visual-care-logo-app-original.png?v=1787903859';
assert.ok(html.includes(source.trim()), 'The deployable HTML must embed the updated Shop module');

function element(text = '') {
  return {
    attributes: {}, textContent: text, innerHTML: '',
    classList: {add() {}, toggle() {}},
    setAttribute(name, value) { this.attributes[name] = value; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    appendChild() {}
  };
}

for (const [tab, title] of [['shop', 'Shop'], ['cart', 'Carrello'], ['recent', 'Acquistati di recente']]) {
  let chrome = null;
  let prependCount = 0;
  let destination = null;
  const page = element();
  page.querySelector = selector => selector === '.refShopChrome' ? chrome : null;
  page.prepend = child => { chrome = child; prependCount++; };
  const content = element();
  content.querySelector = selector => selector === '.page' ? page : null;
  const center = element();
  const orb = element();
  center.querySelector = selector => selector === '.refNavOrb' ? orb : null;
  const bell = element('Notifiche');
  const topBell = element();
  const context = {
    state: {me: {role: 'customer'}, tab, shopParent: 'example', shopCategory: 'example', shopProducts: [1]},
    document: {
      readyState: 'complete',
      getElementById: id => id === 'content' ? content : null,
      querySelector: selector => selector === '.refBottomNav .refNavCenter' ? center : selector === '.refBell' ? topBell : null,
      querySelectorAll: selector => selector === '.refBottomNav .refNavBtn' ? [center, bell] : [],
      createElement: () => element(),
      addEventListener() {}
    },
    render() {}, shell() {}, cartCount: () => 0,
    goTab: value => { destination = value; },
    setTimeout: callback => { callback(); return 0; }
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(source, context);
  assert.ok(chrome, `${tab}: header must exist`);
  assert.ok(chrome.innerHTML.includes('class="refShopOfficialLogo"'), `${tab}: official logo is missing`);
  assert.ok(chrome.innerHTML.includes(`src="${logo}"`), `${tab}: wrong logo source`);
  assert.ok(chrome.innerHTML.includes('alt="Logo Ottica Visual Care"'));
  assert.ok(chrome.innerHTML.includes('object-fit:contain'));
  assert.ok(chrome.innerHTML.includes('border-radius:0'));
  assert.ok(chrome.innerHTML.includes(`<small>${title}</small>`));
  assert.ok(!chrome.innerHTML.includes('refShopMiniLogo'), `${tab}: generic circle must not be rendered`);
  assert.equal(prependCount, 1, 'Repeated enhancement must not duplicate the header');
  assert.equal(center.attributes.onclick, 'openShopHome()');
  assert.equal(bell.attributes.onclick, 'toggleNewsDrawer(true)');
  assert.equal(topBell.attributes.onclick, 'toggleNewsDrawer(true)');
  vm.runInContext('openShopHome()', context);
  assert.equal(destination, 'shop');
  assert.equal(context.state.shopParent, null);
  assert.equal(context.state.shopCategory, null);
  console.log(`PASS ${tab}: official OVC logo, single header, Shop button and notification drawer`);
}
console.log('PASS embedded Shop source matches deployable HTML');
