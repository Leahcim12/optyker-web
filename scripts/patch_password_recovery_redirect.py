from pathlib import Path

p = Path("_site/index.html")
text = p.read_text(encoding="utf-8")
marker = "OPTYKER_PASSWORD_RECOVERY_REDIRECT_V1"
if marker not in text:
    script = r'''
<script id="OPTYKER_PASSWORD_RECOVERY_REDIRECT_V1">
(function(){
  try{
    var hash = location.hash || "";
    var qs = location.search || "";
    var isRecovery =
      /(?:^|[#&?])type=recovery(?:&|$)/i.test(hash + qs) ||
      /(?:^|[#&?])access_token=/i.test(hash) && /(?:^|[#&?])refresh_token=/i.test(hash) ||
      /(?:^|[?&])code=/i.test(qs) && /recovery/i.test(hash + qs);
    if(isRecovery && !/\/reset-password\/?$/i.test(location.pathname)){
      location.replace("./reset-password/" + qs + hash);
    }
  }catch(e){}
})();
</script>
'''
    if "</head>" in text:
        text = text.replace("</head>", script + "\n</head>", 1)
    else:
        text = script + text
    p.write_text(text, encoding="utf-8")
