/* One matching rule for the client archive, dashboard, global search and agenda. */
(function(root){
  function norm(v){return String(v==null?'':v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[’']/g,' ').replace(/\s+/g,' ').trim()}
  function digits(v){return String(v||'').replace(/\D/g,'')}
  function phone(v){return digits(v).replace(/^(?:0039|39)(?=\d{9,11}$)/,'')}
  function matches(c,q){
    c=c||{};q=norm(q);if(!q)return true;
    var phones=[c.phone,c.phoneHome,c.home_phone,c.mobile,c.telephone].filter(Boolean);
    var text=norm([c.surname,c.name,c.first_name,c.last_name,c.email,c.pec,c.fiscal,c.vat,c.reference_no,c.reference_code,c.street,c.streetNumber,c.zip,c.city,c.province,c.profession,c.hobby,c.referral,c.notes].concat(phones).join(' '));
    if(/^[+\d\s()./-]+$/.test(q)&&digits(q)){
      return text.includes(q)||phones.some(function(p){return digits(p).includes(digits(q))||phone(p).includes(phone(q))});
    }
    return q.split(' ').every(function(term){return text.includes(term)||(/^\d+$/.test(term)&&phones.some(function(p){return digits(p).includes(term)}))});
  }
  root.optykerClientMatches=matches;
  if(typeof module==='object'&&module.exports)module.exports=matches;
})(typeof window==='object'?window:globalThis);
