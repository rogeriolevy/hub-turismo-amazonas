import { createServer } from "node:http";
import next from "next";

// Started only by the isolated integration preview, never by npm start.
const app = next({ dev: false, hostname: "127.0.0.1", port: 3100 });
await app.prepare();
const handle = app.getRequestHandler();
const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Revisão responsiva — Hub Turismo Amazonas</title>
<style>
body{margin:0;background:#edf3ef;color:#173c32;font:16px/1.5 Arial,sans-serif}
header{padding:16px 24px;background:white;border-bottom:1px solid #bdcdc2}
h1{font-size:20px;margin:0 0 8px}p{margin:6px 0}nav{display:flex;flex-wrap:wrap;gap:12px;align-items:center;margin-top:12px}
button,select{font:inherit;padding:10px;border:1px solid #557161;border-radius:4px;background:white;color:inherit;min-height:44px}
button{cursor:pointer}button[aria-pressed=true]{color:white;background:#173c32}
:focus-visible{outline:3px solid #a86f12;outline-offset:3px}
main{padding:20px;overflow:auto}iframe{display:block;background:white;border:1px solid #557161;height:850px;width:375px}
</style></head><body>
<header><h1>Revisão responsiva</h1><p>Ambiente temporário, com dados fictícios. A largura do quadro simula o espaço disponível; não emula um aparelho.</p>
<nav aria-label="Controles da revisão">
<button data-path="/" aria-pressed="true">Início</button><button data-path="/#contato" aria-pressed="false">Contato</button><button data-path="/privacidade" aria-pressed="false">Privacidade</button><button data-path="/admin" aria-pressed="false">Administração</button>
<button data-path="/hospedagens" aria-pressed="false">Hospedagens</button><button data-path="/hospedagens/pousada-demonstracao" aria-pressed="false">Detalhe da hospedagem</button><button data-path="/passeios" aria-pressed="false">Passeios</button><button data-path="/passeios/passeio-demonstracao" aria-pressed="false">Detalhe do passeio</button><button data-path="/guias/guia-demonstracao" aria-pressed="false">Guia</button><button data-path="/cadastro" aria-pressed="false">Cadastro</button><button data-path="/minha-conta" aria-pressed="false">Conta</button><button data-path="/painel/plataforma/empresas" aria-pressed="false">Empresas</button><button data-path="/painel/hotel/quartos" aria-pressed="false">Quartos</button><button data-path="/painel/passeios/agenda" aria-pressed="false">Agenda</button>
<button data-path="/painel/plataforma/cadastur" aria-pressed="false">Cadastur</button>
<button data-width="320" aria-pressed="false">320 px</button><button data-width="375" aria-pressed="true">375 px</button><button data-width="768" aria-pressed="false">768 px</button><button data-width="1280" aria-pressed="false">1280 px</button>
</nav><p id="dimensions" role="status">Largura: 375 px</p><p id="metrics" role="status">Aguardando a página…</p></header>
<main><iframe id="site-frame" title="Página em revisão" src="/"></iframe></main>
<script>
const frame=document.getElementById('site-frame');
function measure(){
const doc=frame.contentDocument;if(!doc)return;
const width=doc.documentElement.clientWidth;
const content=doc.documentElement.scrollWidth;
const overflow=Array.from(doc.querySelectorAll('body *')).filter(element=>{
const bounds=element.getBoundingClientRect();return bounds.width>0&&bounds.right>width+1&&frame.contentWindow.getComputedStyle(element).position!=='absolute';
}).slice(0,5).map(element=>element.tagName.toLowerCase()+'.'+String(element.className).replaceAll(' ','.'));
document.getElementById('metrics').textContent='Página: '+doc.location.pathname+' | Área útil: '+width+' px | Conteúdo: '+content+' px | '+(content>width?'Excesso horizontal: '+overflow.join(', '):'Sem excesso horizontal');
}
frame.addEventListener('load',()=>{new ResizeObserver(measure).observe(frame.contentDocument.body);measure()});
document.querySelectorAll('[data-path]').forEach(button=>button.addEventListener('click',()=>{
frame.src=button.dataset.path;
document.querySelectorAll('[data-path]').forEach(item=>item.setAttribute('aria-pressed',String(item===button)));
}));
document.querySelectorAll('[data-width]').forEach(button=>button.addEventListener('click',()=>{
frame.style.width=button.dataset.width+'px';
document.getElementById('dimensions').textContent='Largura: '+button.dataset.width+' px';
document.querySelectorAll('[data-width]').forEach(item=>item.setAttribute('aria-pressed',String(item===button)));
requestAnimationFrame(measure);
}));
</script></body></html>`;

createServer((request, response) => {
  if (request.url === "/__qa/layout") {
    response.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
    });
    response.end(html);
    return;
  }
  handle(request, response);
}).listen(3100, "127.0.0.1");
