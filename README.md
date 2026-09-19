<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>CMS V6 Prototype — Dokumentasi Teknis</title>
<meta name="description" content="Prototype aplikasi CMS berbasis web dengan integrasi Firebase: autentikasi, data gereja, realtime sync, notifikasi, chat, dan keuangan." />
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<style>
/* ============ RESET & TOKENS ============ */
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#05060c;
  --panel:rgba(255,255,255,.035);
  --panel-2:rgba(255,255,255,.06);
  --border:rgba(255,255,255,.09);
  --border-strong:rgba(255,255,255,.16);
  --text:#e7eaf3;
  --muted:#8b93a8;
  --muted-2:#646c80;
  --accent:#7c8cff;
  --accent-2:#22d3ee;
  --accent-3:#f472b6;
  --green:#34d399;
  --amber:#fbbf24;
  --red:#fb7185;
  --mono:'JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,monospace;
  --sans:'Inter',system-ui,-apple-system,Segoe UI,sans-serif;
  --r-sm:10px; --r-md:16px; --r-lg:22px;
  --shadow:0 24px 60px -20px rgba(0,0,0,.75);
}
html{scroll-behavior:smooth;scroll-padding-top:100px}
body{
  font-family:var(--sans);
  color:var(--text);
  background-color:var(--bg);
  line-height:1.7;
  -webkit-font-smoothing:antialiased;
  overflow-x:hidden;
  min-height:100vh;
}
::selection{background:rgba(124,140,255,.35);color:#fff}

/* ============ ANIMATED BACKGROUND ============ */
.bg-layer{position:fixed;inset:0;z-index:-2;overflow:hidden;pointer-events:none}
.orb{position:absolute;border-radius:50%;filter:blur(90px);opacity:.5;will-change:transform}
.orb.a{width:620px;height:620px;top:-220px;left:-160px;background:radial-gradient(circle,rgba(124,140,255,.55),transparent 68%);animation:drift1 26s ease-in-out infinite}
.orb.b{width:560px;height:560px;top:-140px;right:-180px;background:radial-gradient(circle,rgba(34,211,238,.42),transparent 68%);animation:drift2 32s ease-in-out infinite}
.orb.c{width:680px;height:680px;bottom:-320px;left:38%;background:radial-gradient(circle,rgba(244,114,182,.30),transparent 70%);animation:drift3 38s ease-in-out infinite}
@keyframes drift1{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(90px,60px) scale(1.12)}}
@keyframes drift2{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(-110px,80px) scale(1.08)}}
@keyframes drift3{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(60px,-90px) scale(1.15)}}

.bg-grid{
  position:fixed;inset:0;z-index:-1;pointer-events:none;
  background-image:
    linear-gradient(rgba(255,255,255,.028) 1px,transparent 1px),
    linear-gradient(90deg,rgba(255,255,255,.028) 1px,transparent 1px);
  background-size:64px 64px;
  mask-image:radial-gradient(ellipse 90% 60% at 50% 0%,#000 20%,transparent 80%);
  -webkit-mask-image:radial-gradient(ellipse 90% 60% at 50% 0%,#000 20%,transparent 80%);
}

/* ============ SCROLL PROGRESS ============ */
.progress{
  position:fixed;top:0;left:0;height:2.5px;width:100%;z-index:100;
  transform:scaleX(0);transform-origin:0 50%;
  background:linear-gradient(90deg,var(--accent),var(--accent-2) 55%,var(--accent-3));
  box-shadow:0 0 14px rgba(124,140,255,.7);
  transition:transform .08s linear;
}

/* ============ TOPBAR ============ */
.topbar{
  position:sticky;top:0;z-index:60;
  backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);
  background:rgba(6,7,14,.66);
  border-bottom:1px solid var(--border);
}
.topbar-inner{
  max-width:1280px;margin:0 auto;padding:14px 28px;
  display:flex;align-items:center;gap:18px;
}
.brand{display:flex;align-items:center;gap:11px;text-decoration:none;color:var(--text);font-weight:700;letter-spacing:-.02em}
.brand-mark{
  width:32px;height:32px;border-radius:9px;display:grid;place-items:center;
  background:linear-gradient(135deg,var(--accent),var(--accent-2));
  font-size:15px;font-weight:800;color:#05060c;
  box-shadow:0 0 0 1px rgba(255,255,255,.14),0 8px 22px -8px rgba(124,140,255,.9);
}
.brand span small{display:block;font-size:10.5px;font-weight:500;color:var(--muted-2);letter-spacing:.08em;text-transform:uppercase;line-height:1.2}
.topnav{margin-left:auto;display:flex;align-items:center;gap:6px}
.topnav a{
  color:var(--muted);text-decoration:none;font-size:13.5px;font-weight:500;
  padding:8px 13px;border-radius:9px;transition:.22s;
}
.topnav a:hover{color:var(--text);background:var(--panel-2)}
.pill-branch{
  display:inline-flex;align-items:center;gap:7px;
  font-family:var(--mono);font-size:11.5px;font-weight:500;
  padding:6px 12px;border-radius:999px;
  border:1px solid rgba(124,140,255,.35);
  background:rgba(124,140,255,.10);color:#b9c2ff;
}
.pill-branch::before{content:'';width:6px;height:6px;border-radius:50%;background:var(--accent);box-shadow:0 0 8px var(--accent);animation:pulse 2.2s ease-in-out infinite}
@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.35;transform:scale(.75)}}

/* ============ HERO ============ */
.hero{max-width:1280px;margin:0 auto;padding:80px 28px 40px}
.hero-grid{display:grid;grid-template-columns:1.05fr .95fr;gap:56px;align-items:center}
.badge-status{
  display:inline-flex;align-items:center;gap:9px;
  font-size:12.5px;font-weight:600;letter-spacing:.02em;
  padding:7px 15px 7px 12px;border-radius:999px;
  border:1px solid rgba(251,191,36,.3);
  background:rgba(251,191,36,.08);color:#fcd34d;
  margin-bottom:26px;
}
.badge-status .dot{width:7px;height:7px;border-radius:50%;background:var(--amber);box-shadow:0 0 10px var(--amber);animation:pulse 1.8s ease-in-out infinite}
h1.hero-title{
  font-size:clamp(2.4rem,5.4vw,4rem);
  font-weight:800;letter-spacing:-.035em;line-height:1.05;
  margin-bottom:22px;
}
h1.hero-title .grad{
  background:linear-gradient(120deg,var(--accent) 0%,var(--accent-2) 48%,var(--accent-3) 100%);
  background-size:220% 220%;
  -webkit-background-clip:text;background-clip:text;
  -webkit-text-fill-color:transparent;color:transparent;
  animation:shift 9s ease-in-out infinite;
}
@keyframes shift{0%,100%{background-position:0% 50%}50%{background-position:100% 50%}}
.hero-sub{font-size:17px;color:var(--muted);max-width:56ch;margin-bottom:30px}
.hero-sub strong{color:var(--text);font-weight:600}
.hero-meta{display:flex;flex-wrap:wrap;gap:9px;margin-bottom:34px}
.chip{
  display:inline-flex;align-items:center;gap:7px;
  font-family:var(--mono);font-size:11.5px;font-weight:500;
  padding:6px 12px;border-radius:8px;
  border:1px solid var(--border);background:var(--panel);color:var(--muted);
  transition:.25s;
}
.chip:hover{border-color:var(--border-strong);color:var(--text);transform:translateY(-2px)}
.chip.accent{color:#b9c2ff;border-color:rgba(124,140,255,.3);background:rgba(124,140,255,.08)}
.chip.cyan{color:#a5f3fc;border-color:rgba(34,211,238,.28);background:rgba(34,211,238,.07)}

.hero-cta{display:flex;flex-wrap:wrap;gap:12px}
.btn{
  display:inline-flex;align-items:center;gap:9px;
  font-size:14px;font-weight:600;text-decoration:none;
  padding:13px 24px;border-radius:12px;border:1px solid transparent;
  transition:.25s cubic-bezier(.4,0,.2,1);cursor:pointer;position:relative;overflow:hidden;
}
.btn-primary{
  background:linear-gradient(135deg,var(--accent),#5b6cf0);
  color:#fff;box-shadow:0 12px 32px -12px rgba(124,140,255,.95);
}
.btn-primary:hover{transform:translateY(-3px);box-shadow:0 20px 44px -14px rgba(124,140,255,1)}
.btn-ghost{
  background:var(--panel);border-color:var(--border);color:var(--text);
}
.btn-ghost:hover{background:var(--panel-2);border-color:var(--border-strong);transform:translateY(-3px)}
.btn svg{width:16px;height:16px}

/* ============ TERMINAL ============ */
.terminal{
  border-radius:var(--r-md);overflow:hidden;
  border:1px solid var(--border);
  background:linear-gradient(180deg,rgba(16,18,30,.95),rgba(9,10,18,.95));
  box-shadow:var(--shadow),0 0 0 1px rgba(255,255,255,.03) inset;
  backdrop-filter:blur(10px);
}
.term-bar{
  display:flex;align-items:center;gap:8px;
  padding:12px 16px;border-bottom:1px solid var(--border);
  background:rgba(255,255,255,.025);
}
.term-bar .dot{width:11px;height:11px;border-radius:50%}
.dot.red{background:#ff5f57}.dot.yellow{background:#febc2e}.dot.green{background:#28c840}
.term-title{margin-left:8px;font-family:var(--mono);font-size:11.5px;color:var(--muted-2)}
.term-body{padding:20px 18px;font-family:var(--mono);font-size:12.8px;line-height:2.05}
.term-line{
  opacity:0;transform:translateY(8px);
  animation:termIn .5s cubic-bezier(.4,0,.2,1) forwards;
  animation-delay:calc(var(--i) * .34s + .35s);
  white-space:pre-wrap;word-break:break-word;
}
@keyframes termIn{to{opacity:1;transform:translateY(0)}}
.tp{color:var(--accent-2);margin-right:8px;font-weight:600}
.tc{color:#e7eaf3}
.tm{color:var(--muted-2)}
.ts{color:var(--green)}
.cursor{
  display:inline-block;width:8px;height:15px;vertical-align:-2px;
  background:var(--accent-2);margin-left:3px;
  animation:blink 1.05s step-end infinite;
}
@keyframes blink{0%,100%{opacity:1}50%{opacity:0}}

/* ============ LAYOUT ============ */
.wrap{max-width:1280px;margin:0 auto;padding:60px 28px 120px}
.layout{display:grid;grid-template-columns:236px 1fr;gap:64px;align-items:start}

/* ============ TOC ============ */
.toc{position:sticky;top:96px}
.toc-label{
  font-size:10.5px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;
  color:var(--muted-2);margin-bottom:16px;padding-left:14px;
}
.toc-list{list-style:none;position:relative;border-left:1px solid var(--border)}
.toc-list a{
  display:block;position:relative;
  padding:8px 0 8px 18px;
  font-size:13.5px;color:var(--muted);text-decoration:none;
  transition:.24s;
}
.toc-list a::before{
  content:'';position:absolute;left:-1px;top:50%;transform:translateY(-50%) scaleY(0);
  width:2px;height:100%;background:linear-gradient(180deg,var(--accent),var(--accent-2));
  transition:transform .28s cubic-bezier(.4,0,.2,1);
  box-shadow:0 0 12px rgba(124,140,255,.9);
}
.toc-list a:hover{color:var(--text);padding-left:22px}
.toc-list a.active{color:#c7cdff;font-weight:600}
.toc-list a.active::before{transform:translateY(-50%) scaleY(1)}

/* ============ SECTIONS ============ */
.section{margin-bottom:88px;scroll-margin-top:100px}
.sec-head{margin-bottom:32px}
.sec-num{
  display:inline-block;font-family:var(--mono);font-size:11.5px;font-weight:600;
  letter-spacing:.12em;color:var(--accent);
  padding:4px 11px;border-radius:7px;
  border:1px solid rgba(124,140,255,.28);background:rgba(124,140,255,.09);
  margin-bottom:14px;
}
.sec-head h2{
  font-size:clamp(1.5rem,3vw,2rem);font-weight:700;
  letter-spacing:-.025em;margin-bottom:10px;
}
.sec-sub{color:var(--muted);font-size:15px;max-width:62ch}
h3{font-size:15.5px;font-weight:650;letter-spacing:-.01em;margin-bottom:10px;color:var(--text)}

/* ============ FEATURE GRID ============ */
.feature-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:16px}
.feature{
  position:relative;overflow:hidden;
  padding:26px 24px 24px;border-radius:var(--r-md);
  border:1px solid var(--border);
  background:linear-gradient(160deg,rgba(255,255,255,.045),rgba(255,255,255,.012));
  transition:.35s cubic-bezier(.4,0,.2,1);
}
.feature::after{
  content:'';position:absolute;inset:0;border-radius:inherit;opacity:0;
  background:radial-gradient(420px circle at var(--mx,50%) var(--my,0%),rgba(124,140,255,.16),transparent 62%);
  transition:opacity .35s;pointer-events:none;
}
.feature:hover{
  transform:translateY(-5px);
  border-color:rgba(124,140,255,.34);
  box-shadow:0 24px 52px -24px rgba(0,0,0,.9),0 0 0 1px rgba(124,140,255,.1);
}
.feature:hover::after{opacity:1}
.f-icon{
  width:42px;height:42px;border-radius:12px;display:grid;place-items:center;
  font-size:19px;margin-bottom:16px;
  background:linear-gradient(140deg,rgba(124,140,255,.2),rgba(34,211,238,.12));
  border:1px solid rgba(124,140,255,.24);
  box-shadow:0 8px 22px -12px rgba(124,140,255,.8);
  transition:.35s;
}
.feature:hover .f-icon{transform:scale(1.08) rotate(-4deg)}
.feature h3{margin-bottom:12px}
.feature ul{list-style:none;display:grid;gap:8px}
.feature li{
  position:relative;padding-left:19px;
  font-size:13.5px;color:var(--muted);line-height:1.62;
}
.feature li::before{
  content:'';position:absolute;left:3px;top:.62em;
  width:5px;height:5px;border-radius:50%;
  background:linear-gradient(135deg,var(--accent),var(--accent-2));
  box-shadow:0 0 8px rgba(124,140,255,.8);
}

/* ============ CARD / PANEL ============ */
.card{
  border-radius:var(--r-md);border:1px solid var(--border);
  background:linear-gradient(160deg,rgba(255,255,255,.04),rgba(255,255,255,.012));
  padding:24px 26px;
  transition:.3s;
}
.card:hover{border-color:var(--border-strong)}

/* ============ CODE BLOCK ============ */
.code-wrap{
  position:relative;border-radius:var(--r-md);overflow:hidden;
  border:1px solid var(--border);
  background:linear-gradient(180deg,rgba(14,16,26,.92),rgba(8,9,16,.92));
  box-shadow:var(--shadow);
}
.code-head{
  display:flex;align-items:center;gap:10px;
  padding:10px 14px 10px 18px;
  border-bottom:1px solid var(--border);
  background:rgba(255,255,255,.022);
}
.code-head .lang{
  font-family:var(--mono);font-size:11px;font-weight:600;letter-spacing:.08em;
  text-transform:uppercase;color:var(--muted-2);
}
.copy-btn{
  margin-left:auto;display:inline-flex;align-items:center;gap:6px;
  font-family:var(--sans);font-size:11.5px;font-weight:600;
  padding:5px 11px;border-radius:7px;cursor:pointer;
  border:1px solid var(--border);background:var(--panel);color:var(--muted);
  transition:.22s;
}
.copy-btn:hover{color:var(--text);border-color:var(--border-strong);background:var(--panel-2)}
.copy-btn.done{color:var(--green);border-color:rgba(52,211,153,.4);background:rgba(52,211,153,.1)}
.copy-btn svg{width:13px;height:13px}
pre{
  padding:20px 22px;overflow-x:auto;
  font-family:var(--mono);font-size:13px;line-height:1.95;
  color:#c9d1e4;
}
pre::-webkit-scrollbar{height:8px}
pre::-webkit-scrollbar-thumb{background:rgba(255,255,255,.12);border-radius:4px}
.cm{color:var(--muted-2);font-style:italic}
.ck{color:#c084fc}
.cs{color:#7dd3fc}
.cn{color:#fbbf24}
.cf{color:#86efac}

/* ============ FILE TREE ============ */
.tree{
  font-family:var(--mono);font-size:13px;line-height:2.05;
  padding:24px 26px;border-radius:var(--r-md);
  border:1px solid var(--border);
  background:linear-gradient(160deg,rgba(255,255,255,.035),rgba(255,255,255,.01));
  overflow-x:auto;
}
.tree .dir{color:#a5b4fc;font-weight:600}
.tree .file{color:#cbd5e1}
.tree .branch{color:var(--muted-2)}
.tree .note{color:var(--muted-2);font-style:italic}

/* ============ TECH CHIPS ============ */
.tech-grid{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:26px}
.tech{
  display:inline-flex;align-items:center;gap:9px;
  padding:9px 16px;border-radius:11px;
  border:1px solid var(--border);background:var(--panel);
  font-size:13.5px;font-weight:500;color:var(--text);
  transition:.28s cubic-bezier(.4,0,.2,1);cursor:default;
}
.tech:hover{
  transform:translateY(-3px);
  border-color:rgba(124,140,255,.4);
  background:rgba(124,140,255,.09);
  box-shadow:0 12px 28px -16px rgba(124,140,255,.9);
}
.tech .sq{
  width:7px;height:7px;border-radius:2px;
  background:linear-gradient(135deg,var(--accent),var(--accent-2));
}

/* ============ STEPS ============ */
.steps{display:grid;gap:14px;counter-reset:step}
.step{
  position:relative;display:grid;grid-template-columns:44px 1fr;gap:18px;
  padding:22px 24px;border-radius:var(--r-md);
  border:1px solid var(--border);
  background:linear-gradient(160deg,rgba(255,255,255,.04),rgba(255,255,255,.012));
  transition:.3s;
}
.step:hover{border-color:rgba(124,140,255,.3);transform:translateX(4px)}
.step-num{
  counter-increment:step;
  width:44px;height:44px;border-radius:12px;display:grid;place-items:center;
  font-family:var(--mono);font-size:15px;font-weight:700;color:#fff;
  background:linear-gradient(140deg,var(--accent),#5b6cf0);
  box-shadow:0 10px 24px -12px rgba(124,140,255,1);
}
.step-num::before{content:counter(step,decimal-leading-zero)}
.step-body h3{margin-bottom:6px}
.step-body p{font-size:13.5px;color:var(--muted);margin-bottom:12px}
.step-body .code-wrap{margin-top:10px}

/* ============ ALERT ============ */
.alert{
  display:grid;grid-template-columns:auto 1fr;gap:16px;
  padding:20px 22px;border-radius:var(--r-md);
  border:1px solid rgba(251,191,36,.26);
  background:linear-gradient(120deg,rgba(251,191,36,.08),rgba(251,191,36,.02));
  margin-bottom:22px;
}
.alert .ico{font-size:20px;line-height:1.4}
.alert strong{display:block;color:#fcd34d;font-size:14px;margin-bottom:5px;font-weight:650}
.alert p{font-size:13.5px;color:var(--muted)}

/* ============ CHECKLIST ============ */
.check-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}
.check{
  display:flex;align-items:flex-start;gap:12px;
  padding:15px 18px;border-radius:12px;
  border:1px solid var(--border);background:var(--panel);
  font-size:13.5px;color:var(--muted);
  transition:.28s;
}
.check:hover{border-color:rgba(52,211,153,.32);background:rgba(52,211,153,.05);color:var(--text);transform:translateY(-2px)}
.check .box{
  flex:0 0 18px;width:18px;height:18px;margin-top:2px;border-radius:6px;
  border:1.5px solid rgba(52,211,153,.45);
  background:rgba(52,211,153,.1);
  display:grid;place-items:center;
  font-size:10px;color:var(--green);font-weight:800;
}
.check .box::before{content:'✓'}

/* ============ TIMELINE ============ */
.timeline{position:relative;padding-left:34px}
.timeline::before{
  content:'';position:absolute;left:9px;top:8px;bottom:8px;width:2px;
  background:linear-gradient(180deg,var(--accent),var(--accent-2),var(--accent-3));
  opacity:.42;border-radius:2px;
}
.tl-item{position:relative;padding:0 0 20px}
.tl-item:last-child{padding-bottom:0}
.tl-item::before{
  content:'';position:absolute;left:-31px;top:9px;
  width:10px;height:10px;border-radius:50%;
  background:var(--bg);
  border:2px solid var(--accent);
  box-shadow:0 0 0 4px rgba(124,140,255,.1),0 0 12px rgba(124,140,255,.7);
  transition:.3s;
}
.tl-item:hover::before{background:var(--accent);box-shadow:0 0 0 5px rgba(124,140,255,.18),0 0 20px rgba(124,140,255,1)}
.tl-code{
  display:inline-block;font-family:var(--mono);font-size:12.5px;
  padding:7px 14px;border-radius:9px;
  border:1px solid var(--border);background:rgba(255,255,255,.03);
  color:#cbd5e1;transition:.28s;
}
.tl-item:hover .tl-code{
  border-color:rgba(124,140,255,.36);
  background:rgba(124,140,255,.08);
  color:#c7cdff;transform:translateX(3px);
}
.tl-type{
  font-family:var(--mono);font-size:10.5px;font-weight:700;letter-spacing:.08em;
  text-transform:uppercase;padding:2px 8px;border-radius:5px;margin-right:9px;
  vertical-align:1px;
}
.tl-type.fix{color:#fca5a5;background:rgba(251,113,133,.12);border:1px solid rgba(251,113,133,.24)}
.tl-type.docs{color:#93c5fd;background:rgba(96,165,250,.12);border:1px solid rgba(96,165,250,.24)}
.tl-type.chore{color:#fcd34d;background:rgba(251,191,36,.1);border:1px solid rgba(251,191,36,.22)}

/* ============ FOOTER ============ */
footer{
  border-top:1px solid var(--border);
  background:rgba(255,255,255,.012);
}
.footer-inner{
  max-width:1280px;margin:0 auto;padding:44px 28px;
  display:flex;flex-wrap:wrap;gap:20px;align-items:center;justify-content:space-between;
}
.footer-inner p{font-size:13px;color:var(--muted-2)}
.footer-inner a{color:var(--muted);text-decoration:none;font-size:13px;transition:.22s}
.footer-inner a:hover{color:var(--accent-2)}

 /* ---------- Back to top ---------- */
  toTop.addEventListener('click', function () {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  /* ---------- Feature card glow follow ---------- */
  document.querySelectorAll('.feature').forEach(function (card) {
    card.addEventListener('mousemove', function (e) {
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      card.style.setProperty('--my', (e.clientY - r.top) + 'px');
    });
  });
})();
</script>
</body>
</html>
