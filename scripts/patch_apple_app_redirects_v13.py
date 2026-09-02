from pathlib import Path

TARGET = "../iphone-app-v13/?app=13&build=20260903-app-live1"
OLD = ["iphone-app"] + [f"iphone-app-v{i}" for i in range(2,13)]

html = """<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#ffffff">
<title>Optyker</title>
<style>
html,body{margin:0;min-height:100%;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#eef3f7;color:#17324a}
main{min-height:100dvh;display:grid;place-items:center;padding:24px;text-align:center}
.card{background:#fff;border:1px solid #d8e3eb;border-radius:20px;padding:26px;max-width:420px;box-shadow:0 16px 44px #17324a18}
h1{font-size:22px;margin:0 0 8px}p{font-size:13px;color:#6d8291;line-height:1.5}
a{display:block;margin-top:16px;padding:13px 16px;border-radius:11px;background:#1769aa;color:#fff;text-decoration:none;font-weight:900}
</style>
<script>
(function(){
  var target='""" + TARGET + """'+'&fresh='+Date.now();
  var extra=(location.search||'').replace(/^\?/,'');
  if(extra){
    extra=extra.split('&').filter(function(x){return x && !/^app=/.test(x)}).join('&');
    if(extra) target += '&'+extra;
  }
  target += (location.hash||'');
  try{
    if('serviceWorker' in navigator){
      navigator.serviceWorker.getRegistrations().then(function(regs){
        return Promise.all((regs||[]).filter(function(r){
          return /\/optyker-web\/iphone-app(?:-v\d+)?\//.test(r.scope||'') &&
                 !/\/iphone-app-v13\//.test(r.scope||'');
        }).map(function(r){return r.unregister()}));
      }).finally(function(){location.replace(target)});
      setTimeout(function(){location.replace(target)},900);
    }else{
      location.replace(target);
    }
  }catch(e){ location.replace(target); }
})();
</script>
</head>
<body><main><div class="card"><h1>Aggiornamento Optyker</h1><p>Sto aprendo automaticamente la versione Apple più recente.</p><a href='""" + TARGET + """'>Apri Optyker 13.0</a></div></main></body>
</html>"""

for name in OLD:
    p = Path("_site") / name / "index.html"
    if p.exists():
        p.write_text(html, encoding="utf-8")
print("Vecchie app Apple reindirizzate a Optyker 13.0")
