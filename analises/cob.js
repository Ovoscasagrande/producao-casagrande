// ---------- Aba Cobrança (vendedor cobra o próprio cliente; gerência vê tudo) ----------
// Lista de clientes vencidos do vendedor -> títulos -> gerar PDF (tom cordial/neutro/firme)
// -> compartilhar no WhatsApp (Web Share API com arquivo; fallback wa.me + download)
// Melhorias pedidas: promessa de pagamento (2), histórico de cobranças (3),
// aging colorido no PDF (4), perda sobe para gerência autorizar (7).

const TOMES = {
  cordial: {
    rotulo: '😊 Cordial',
    texto: (c)=>`Olá${c.contato?' '+c.contato:''}, tudo bem? Passando para conferir com você: identificamos ${c.titulos.length} título${c.titulos.length>1?'s':''} em aberto no nosso sistema, totalizando ${BRL(c.total)}. Segue em anexo o demonstrativo com os detalhes (pedido, vencimento e valor). Se já estiver programado, pode desconsiderar — e qualquer dúvida, estou à disposição. Obrigado!`
  },
  neutro: {
    rotulo: '📋 Neutro',
    texto: (c)=>`Prezado${c.contato?' '+c.contato:''}, constatamos títulos em aberto em nossa carteira: ${c.titulos.length} título${c.titulos.length>1?'s':''}, total de ${BRL(c.total)}, sendo o mais antigo de ${fmtData(c.maisAntigo)} (${c.diasMaisAntigo} dias). Segue demonstrativo em anexo para conferência. Pedimos a gentileza de regularizar ou nos informar a previsão de pagamento. Atenciosamente, Ovos Casagrande.`
  },
  firme: {
    rotulo: '🔴 Firme',
    texto: (c)=>`Prezado${c.contato?' '+c.contato:''}, seus títulos encontram-se VENCIDOS há ${c.diasMaisAntigo} dias (mais antigo: ${fmtData(c.maisAntigo)}), totalizando ${BRL(c.total)} em ${c.titulos.length} título${c.titulos.length>1?'s':''}. O demonstrativo segue anexo. A regularização é necessária para manter o fornecimento. Solicitamos contato hoje mesmo para tratativa. Ovos Casagrande — Departamento Financeiro.`
  }
};

// dados da empresa no PDF (sem PIX — boleto a gerar; vendedor conversa com o cliente)
// TODO: confirmar CNPJ/endereço/telefone reais com a gerência
const EMPRESA = {
  nome: 'OVOS CASAGRANDE',
  cnpj: '12.345.678/0001-90',
  end: 'Rod. [confirmar] — [confirmar cidade/UF]',
  fone: '[confirmar telefone]'
};

async function abaCobranca(){
  const souGerente = ME.tipo!=='VENDEDOR';
  status('Carregando carteira e mapeamento…');
  const [rec, mapaRows, promessas, perdas, cobrancas] = await Promise.all([
    carregar('ovos_receber','vencimento,emissao,cliente,titulo,pedido,saldo,dias_atraso,faixa_aging,data_base'),
    carregar('ovos_cliente_vendedor','cliente,vendedor'),
    carregar('ovos_promessas','id,cliente,titulo,valor,prometido_para,status,obs'),
    souGerente ? carregar('ovos_perdas','id,vendedor,cliente,titulos,valor_total,motivo,status,criado_em') : Promise.resolve([]),
    carregar('ovos_cobrancas','id,cliente,canal,tom,criado_em')
  ]);
  status(null);
  const base = ultimaBase(rec);
  const rs = rec.filter(r=>r.data_base===base && r.dias_atraso>0 && (+r.saldo||0)>0.004);
  const mapa = {}; mapaRows.forEach(m=>{ mapa[m.cliente]=m.vendedor; });

  // --- agrupa por cliente ---
  const porCli = {};
  rs.forEach(r=>{ const c = r.cliente||'—'; (porCli[c]=porCli[c]||[]).push(r); });
  const clientes = Object.entries(porCli).map(([c, titulos])=>{
    titulos.sort((a,b)=>a.vencimento.localeCompare(b.vencimento));
    const total = titulos.reduce((s,r)=>s+(+r.saldo||0),0);
    return { cliente:c, titulos, total, maisAntigo:titulos[0].vencimento,
             diasMaisAntigo:titulos[0].dias_atraso, vendedor:mapa[c]||'—' };
  }).sort((a,b)=>b.diasMaisAntigo-a.diasMaisAntigo);

  const promAtivas = promessas.filter(p=>p.status==='ATIVA');
  const promVencidas = promAtivas.filter(p=>p.prometido_para < new Date().toISOString().slice(0,10));
  const perdasPend = perdas.filter(p=>p.status==='PENDENTE');
  const hojeISO = new Date().toISOString().slice(0,10);

  el('conteudo').innerHTML = `
  <div class="section-head">
    <h2>Cobrança</h2>
    <span class="meta">${souGerente?'visão gerencial — todos os vendedores':'seus clientes vencidos'} · carteira ${fmtData(base)}</span>
  </div>
  <div class="kpis">
    <div class="kpi k-bad"><div class="l">Vencido total</div><div class="v" style="color:var(--bad)">${BRL(clientes.reduce((s,c)=>s+c.total,0))}</div><div class="s">${clientes.length} clientes · ${rs.length} títulos</div></div>
    <div class="kpi k-gold"><div class="l">Promessas ativas</div><div class="v">${promAtivas.length}</div><div class="s">${promVencidas.length} vencida${promVencidas.length===1?'':'s'} — prometido e não pagou</div></div>
    <div class="kpi k-slate"><div class="l">Cobranças geradas</div><div class="v">${cobrancas.length}</div><div class="s">histórico registrado</div></div>
    ${souGerente?`<button class="kpi k-click k-bad" id="kpiPerdas"><div class="l">Perdas p/ autorizar</div><div class="v" style="color:var(--bad)">${perdasPend.length}</div><div class="s">clique para ver</div></button>`:''}
  </div>
  <div class="cardbox" style="padding:12px 14px">
    <div style="font-size:11px;color:var(--mut);font-weight:700;text-transform:uppercase;letter-spacing:.4px;margin-bottom:8px">Filtrar por vendedor</div>
    <div class="periodo-bar" id="cobVendBar">
      <button data-v="todos" class="per-btn on">Todos</button>
      ${[...new Set(clientes.map(c=>c.vendedor).filter(v=>v!=='—'))].map(v=>`<button data-v="${v.replace(/"/g,'&quot;')}" class="per-btn">${v}</button>`).join('')}
      <button data-v="—" class="per-btn">Sem vendedor</button>
    </div>
  </div>
  <div class="cardbox">
    <div class="cardbox-head"><h3>Clientes com títulos vencidos</h3><span class="hint">toque no cliente para ver os títulos e gerar a cobrança</span></div>
    <div class="table-wrap"><table class="tabela-cartao"><thead><tr><th>Cliente</th><th>Vendedor</th><th class="num">Vencido</th><th class="num">Tít.</th><th class="num">Mais antigo</th><th>Promessa</th></tr></thead><tbody id="cobBody"></tbody></table></div>
  </div>
  <div class="cardbox">
    <div class="cardbox-head"><h3>Promessas de pagamento</h3><span class="hint">cliente prometeu pagar — acompanhe</span></div>
    <div id="promBox"></div>
  </div>
  ${souGerente?`<div class="cardbox">
    <div class="cardbox-head"><h3>Perdas reportadas</h3><span class="hint">vendedor marcou cliente como perda — autorize ou rejeite</span></div>
    <div id="perdasBox"></div>
  </div>`:''}`;

  if(souGerente && el('kpiPerdas')) el('kpiPerdas').onclick = ()=> abrirGavetaPerdas(perdas);

  let filtroVend = 'todos';
  function renderClientes(){
    const lista = filtroVend==='todos' ? clientes : clientes.filter(c=>c.vendedor===filtroVend);
    el('cobBody').innerHTML = lista.map((c,i)=>{
      const prom = promAtivas.find(p=>p.cliente===c.cliente);
      const promTxt = prom ? `<span class="badge ${prom.prometido_para<hojeISO?'r':'y'}">p/ ${fmtData(prom.prometido_para)}</span>` : '<span style="color:var(--mut)">—</span>';
      return `<tr data-i="${i}" style="cursor:pointer">
        <td data-l="Cliente"><b>${c.cliente}</b></td>
        <td data-l="Vendedor">${c.vendedor}</td>
        <td class="num" data-l="Vencido" style="color:var(--bad);font-weight:700">${BRL(c.total)}</td>
        <td class="num" data-l="Títulos">${c.titulos.length}</td>
        <td class="num" data-l="Mais antigo">${c.diasMaisAntigo} dias</td>
        <td data-l="Promessa">${promTxt}</td></tr>`;
    }).join('') || '<tr><td colspan="6" style="color:var(--mut)">Nenhum cliente vencido neste filtro. 🎉</td></tr>';
    [...el('cobBody').querySelectorAll('tr[data-i]')].forEach(tr=>{
      tr.onclick = ()=> gavetaCliente(lista[+tr.getAttribute('data-i')], mapa, promessas, cobrancas);
    });
  }
  renderClientes();
  el('cobVendBar').querySelectorAll('.per-btn').forEach(b=>{
    b.onclick = ()=>{
      filtroVend = b.getAttribute('data-v');
      el('cobVendBar').querySelectorAll('.per-btn').forEach(x=>x.classList.toggle('on', x===b));
      renderClientes();
    };
  });

  renderPromessas(promessas, mapa);
  if(souGerente) renderPerdas(perdas);
}

function renderPromessas(promessas, mapa){
  const ativas = promessas.filter(p=>p.status==='ATIVA');
  if(!ativas.length){ el('promBox').innerHTML = '<div style="color:var(--mut);font-size:12.5px">Nenhuma promessa ativa. Ao gerar uma cobrança, você pode registrar "o cliente vai pagar dia X".</div>'; return; }
  const hojeISO = new Date().toISOString().slice(0,10);
  el('promBox').innerHTML = `<div class="table-wrap"><table class="tabela-cartao"><thead><tr><th>Cliente</th><th>Título</th><th class="num">Valor</th><th>Prometido p/</th><th>Situação</th><th></th></tr></thead><tbody>
    ${ativas.sort((a,b)=>a.prometido_para.localeCompare(b.prometido_para)).map(p=>{
      const atrasada = p.prometido_para < hojeISO;
      return `<tr><td data-l="Cliente"><b>${p.cliente}</b></td><td data-l="Título">${p.titulo||'—'}</td>
      <td class="num" data-l="Valor">${BRL(p.valor)}</td><td data-l="Prometido">${fmtData(p.prometido_para)}</td>
      <td data-l="Situação"><span class="badge ${atrasada?'r':'y'}">${atrasada?'VENCIDA — cobrar':'AGUARDANDO'}</span></td>
      <td style="white-space:nowrap;display:flex;gap:4px">
        <button class="btn-sm" onclick="cumpriuPromessa(${p.id})">pagou ✓</button>
        <button class="btn-sm" onclick="cancelaPromessa(${p.id})">cancelar</button></td></tr>`;
    }).join('')}</tbody></table></div>`;
}
async function cumpriuPromessa(id){
  status('Registrando…');
  const { error } = await sb.from('ovos_promessas').update({ status:'CUMPRIDA' }).eq('id', id);
  status(null);
  if(error){ status('Erro: '+error.message); return; }
  status('Promessa marcada como cumprida ✓'); setTimeout(status,2000,null);
  limparCache(); irAba('cobranca');
}
async function cancelaPromessa(id){
  status('Cancelando…');
  const { error } = await sb.from('ovos_promessas').update({ status:'CANCELADA' }).eq('id', id);
  status(null);
  if(error){ status('Erro: '+error.message); return; }
  limparCache(); irAba('cobranca');
}

function renderPerdas(perdas){
  const pend = perdas.filter(p=>p.status==='PENDENTE');
  const outras = perdas.filter(p=>p.status!=='PENDENTE').slice(0,10);
  el('perdasBox').innerHTML = (pend.length?`<div class="table-wrap"><table class="tabela-cartao"><thead><tr><th>Cliente</th><th>Vendedor</th><th class="num">Valor</th><th>Motivo</th><th>Ações</th></tr></thead><tbody>
    ${pend.map(p=>`<tr><td data-l="Cliente"><b>${p.cliente}</b></td><td data-l="Vendedor">${p.vendedor}</td>
    <td class="num" data-l="Valor" style="color:var(--bad);font-weight:700">${BRL(p.valor_total)}</td>
    <td data-l="Motivo">${p.motivo||'—'}</td>
    <td style="white-space:nowrap;display:flex;gap:4px">
      <button class="btn-sm" onclick="decidePerda(${p.id},'AUTORIZADA')">autorizar ✓</button>
      <button class="btn-sm" onclick="decidePerda(${p.id},'REJEITADA')">rejeitar ✕</button></td></tr>`).join('')}</tbody></table></div>`
    :'<div style="color:var(--mut);font-size:12.5px">Nenhuma perda pendente de autorização.</div>')
    + (outras.length?`<div style="margin-top:10px;font-size:12px;color:var(--mut)"><b>Últimas decididas:</b> ${outras.map(p=>`${p.cliente} (${p.status==='AUTORIZADA'?'✓ autorizada':'✕ rejeitada'})`).join(' · ')}</div>`:'');
}
async function decidePerda(id, decisao){
  status('Registrando decisão…');
  const { error } = await sb.from('ovos_perdas').update({ status:decisao, decidida_por:ME.id, decidida_em:new Date().toISOString() }).eq('id', id);
  status(null);
  if(error){ status('Erro: '+error.message); return; }
  status(decisao==='AUTORIZADA'?'Perda autorizada ✓':'Perda rejeitada ✓'); setTimeout(status,2000,null);
  limparCache(); irAba('cobranca');
}

// ---------- gaveta do cliente: títulos + gerar cobrança ----------
function gavetaCliente(c, mapa, promessas, cobrancas){
  const tomSalvo = localStorage.getItem('cobTom') || 'cordial';
  const linhas = c.titulos.map(r=>[fmtData(r.vencimento), fmtData(r.emissao), r.titulo||'—', r.pedido||'—', +r.saldo||0, r.dias_atraso]);
  const histCli = cobrancas.filter(x=>x.cliente===c.cliente).length;
  abrirOrigem({
    titulo:'Cobrança · '+c.cliente,
    subtitulo:`vendedor: ${c.vendedor} · ${c.titulos.length} títulos vencidos · total ${BRL(c.total)} · mais antigo ${c.diasMaisAntigo} dias (${fmtData(c.maisAntigo)}) · ${histCli} cobrança${histCli===1?'':'s'} já gerada${histCli===1?'':'s'}`,
    resumoTop:true,
    colunas:['Vencimento','Emissão','Título','Pedido','R$ Saldo','Dias atraso'],
    linhas,
    nomeCsv:'cobranca-'+c.cliente.toLowerCase().replace(/[^a-z0-9]+/g,'-')+'.csv'
  });
  setTimeout(()=>{
    const body = document.querySelector('.dw-body');
    if(!body) return;
    const box = document.createElement('div');
    box.id = 'cobAcoes';
    box.style.cssText = 'padding:14px 0;border-top:2px solid var(--line);margin-top:10px';
    box.innerHTML = `
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--mut);margin-bottom:8px">Gerar cobrança</div>
      <div class="periodo-bar" id="tomBar">
        ${Object.entries(TOMES).map(([k,t])=>`<button data-t="${k}" class="per-btn ${k===tomSalvo?'on':''}">${t.rotulo}</button>`).join('')}
      </div>
      <div id="tomPreview" style="font-size:12.5px;background:#f8fafc;border:1px solid var(--line);border-radius:10px;padding:10px;margin:10px 0;color:var(--txt)"></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn-pri" id="btnWa" style="flex:1;min-width:150px">📱 Enviar no WhatsApp</button>
        <button class="btn-sm" id="btnPdf">⬇ baixar PDF</button>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
        <button class="btn-sm acc" id="btnProm">📅 registrar promessa de pagamento</button>
        <button class="btn-sm" id="btnPerda" style="color:var(--bad)">⚠️ marcar como PERDA</button>
      </div>
      <div id="promForm" style="display:none;margin-top:10px">
        <input id="promData" class="inp" type="date" style="width:160px">
        <input id="promObs" class="inp" placeholder="obs (opcional)" style="width:100%;margin-top:6px">
        <button class="btn-pri" id="promSalvar" style="margin-top:6px">salvar promessa</button>
      </div>
      <div id="perdaForm" style="display:none;margin-top:10px">
        <input id="perdaMotivo" class="inp" placeholder="motivo: quebrou, falência, encerrado…" style="width:100%">
        <button class="btn-pri" id="perdaSalvar" style="margin-top:6px;background:linear-gradient(135deg,#dc2626,#b91c1c);color:#fff">enviar perda para gerência</button>
      </div>`;
    body.appendChild(box);
    let tom = tomSalvo;
    const preview = ()=>{ el('tomPreview').textContent = TOMES[tom].texto(c); };
    el('tomBar').querySelectorAll('.per-btn').forEach(b=>{
      b.onclick = ()=>{ tom = b.getAttribute('data-t'); localStorage.setItem('cobTom', tom);
        el('tomBar').querySelectorAll('.per-btn').forEach(x=>x.classList.toggle('on', x===b)); preview(); };
    });
    preview();
    el('btnWa').onclick = ()=> enviarCobranca(c, tom, true);
    el('btnPdf').onclick = ()=> enviarCobranca(c, tom, false);
    el('btnProm').onclick = ()=>{ el('promForm').style.display = el('promForm').style.display==='none'?'block':'none'; el('perdaForm').style.display='none';
      const d = new Date(); d.setDate(d.getDate()+7); el('promData').value = d.toISOString().slice(0,10); };
    el('promSalvar').onclick = async ()=>{
      const data = el('promData').value; if(!data){ status('Escolha a data'); return; }
      status('Salvando promessa…');
      const { error } = await sb.from('ovos_promessas').insert({ vendedor:c.vendedor, cliente:c.cliente, titulo:c.titulos[0].titulo||null, valor:c.total, prometido_para:data, obs:el('promObs').value||null, criado_por:ME.id });
      status(null);
      if(error){ status('Erro: '+error.message); return; }
      status('Promessa registrada ✓'); setTimeout(status,2500,null);
      fecharOrigem(); limparCache(); irAba('cobranca');
    };
    el('btnPerda').onclick = ()=>{ el('perdaForm').style.display = el('perdaForm').style.display==='none'?'block':'none'; el('promForm').style.display='none'; };
    el('perdaSalvar').onclick = async ()=>{
      const motivo = el('perdaMotivo').value.trim(); if(!motivo){ status('Descreva o motivo'); return; }
      status('Enviando perda para gerência…');
      const { error } = await sb.from('ovos_perdas').insert({ vendedor:c.vendedor, cliente:c.cliente, titulos:c.titulos.map(r=>({titulo:r.titulo,pedido:r.pedido,vencimento:r.vencimento,saldo:r.saldo})), valor_total:c.total, motivo, criado_por:ME.id });
      status(null);
      if(error){ status('Erro: '+error.message); return; }
      status('Perda enviada — a gerência vai analisar ✓'); setTimeout(status,2500,null);
      fecharOrigem();
    };
  }, 50);
}

async function abrirGavetaPerdas(perdas){
  abrirOrigem({
    titulo:'Perdas reportadas pelos vendedores',
    subtitulo:'cliente quebrou/faliu → vendedor marca → gerência autoriza → vira setor de PERDA',
    resumoTop:true,
    colunas:['Cliente','Vendedor','R$ Valor','Motivo','Status'],
    linhas: perdas.map(p=>[p.cliente, p.vendedor, +p.valor_total||0, p.motivo||'—', p.status]),
    nomeCsv:'perdas.csv'
  });
  setTimeout(()=>{
    const body = document.querySelector('.dw-body'); if(!body) return;
    const box = document.createElement('div');
    box.style.cssText = 'padding:12px 0;border-top:2px solid var(--line);margin-top:10px;display:flex;gap:8px;flex-wrap:wrap';
    perdas.filter(p=>p.status==='PENDENTE').forEach(p=>{
      const b1 = document.createElement('button'); b1.className='btn-sm'; b1.textContent=`✓ autorizar ${p.cliente} (${BRL(p.valor_total)})`;
      b1.onclick = ()=> decidePerda(p.id,'AUTORIZADA');
      const b2 = document.createElement('button'); b2.className='btn-sm'; b2.textContent=`✕ rejeitar ${p.cliente}`;
      b2.onclick = ()=> decidePerda(p.id,'REJEITADA');
      box.appendChild(b1); box.appendChild(b2);
    });
    if(perdas.filter(p=>p.status==='PENDENTE').length) body.appendChild(box);
  }, 50);
}

// ---------- geração do PDF (jsPDF) ----------
async function enviarCobranca(c, tom, compartilhar){
  status('Gerando PDF…');
  await carregarJsPDF();
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit:'mm', format:'a4' });
  const W = 210;
  doc.setFillColor(15,23,42); doc.rect(0,0,W,34,'F');
  try{
    const img = await carregarLogo();
    if(img) doc.addImage(img, 'PNG', 14, 7, 44, 20);
  }catch(e){}
  doc.setTextColor(255,212,0); doc.setFontSize(15); doc.setFont(undefined,'bold');
  doc.text('OVOS CASAGRANDE', 64, 15);
  doc.setTextColor(226,232,240); doc.setFontSize(8); doc.setFont(undefined,'normal');
  doc.text(EMPRESA.cnpj+'  ·  '+EMPRESA.end, 64, 21);
  doc.text(EMPRESA.fone, 64, 26);
  doc.setTextColor(15,23,42); doc.setFontSize(13); doc.setFont(undefined,'bold');
  doc.text('DEMONSTRATIVO DE DÉBITOS EM ABERTO', 14, 46);
  doc.setFontSize(9); doc.setFont(undefined,'normal'); doc.setTextColor(100,116,139);
  doc.text('Emitido em '+new Date().toLocaleDateString('pt-BR')+' às '+new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})+' — documento de conferência interna', 14, 52);
  doc.setTextColor(15,23,42); doc.setFontSize(10); doc.setFont(undefined,'bold');
  doc.text('Cliente: '+c.cliente, 14, 62);
  doc.setFont(undefined,'normal'); doc.setFontSize(9); doc.setTextColor(71,85,105);
  doc.text('Vendedor responsável: '+c.vendedor, 14, 68);
  let y = 78;
  doc.setFontSize(9); doc.setFont(undefined,'bold'); doc.setTextColor(15,23,42);
  doc.text('Títulos vencidos', 14, y); y += 4;
  doc.setDrawColor(226,232,240); doc.setLineWidth(.2); doc.line(14, y, W-14, y); y += 6;
  doc.setFont(undefined,'bold'); doc.setFontSize(8);
  doc.text('VENCIMENTO', 14, y); doc.text('PEDIDO', 60, y); doc.text('TÍTULO', 90, y);
  doc.text('DIAS', 125, y); doc.text('FAIXA', 140, y); doc.text('VALOR (R$)', W-14, y, {align:'right'});
  y += 2; doc.line(14, y, W-14, y); y += 5;
  doc.setFont(undefined,'normal'); doc.setFontSize(8.5);
  const corFaixa = f => f && f.startsWith('3') ? [217,119,6] : f && (f.startsWith('1')||f.startsWith('2')) ? [220,38,38] : [15,23,42];
  c.titulos.forEach(r=>{
    const cor = corFaixa(r.faixa_aging);
    doc.setTextColor(...cor);
    doc.text(fmtData(r.vencimento), 14, y);
    doc.text(String(r.pedido||'—'), 60, y);
    doc.text(String(r.titulo||'—'), 90, y);
    doc.text(String(r.dias_atraso), 125, y);
    doc.text(String(r.faixa_aging||'—').replace(/^\d+\.\s*/,''), 140, y);
    doc.text((+r.saldo||0).toLocaleString('pt-BR',{minimumFractionDigits:2}), W-14, y, {align:'right'});
    y += 5.5;
    if(y > 250){ doc.addPage(); y = 20; }
  });
  doc.setDrawColor(15,23,42); doc.setLineWidth(.4); doc.line(14, y, W-14, y); y += 7;
  doc.setFont(undefined,'bold'); doc.setFontSize(11); doc.setTextColor(220,38,38);
  doc.text('TOTAL VENCIDO: '+BRL(c.total), 14, y);
  y += 12;
  doc.setFont(undefined,'normal'); doc.setFontSize(9.5); doc.setTextColor(30,41,59);
  const msg = TOMES[tom].texto(c);
  const linhasMsg = doc.splitTextToSize(msg, W-28);
  doc.text(linhasMsg, 14, y);
  y += linhasMsg.length*5 + 6;
  doc.setFontSize(8); doc.setTextColor(100,116,139);
  const rodape = ['Para regularizar: entre em contato com seu vendedor ou com o Departamento Financeiro da Ovos Casagrande.',
    'Boleto de renegociação (com juros/multa) pode ser emitido mediante solicitação.',
    'Este documento é um demonstrativo de conferência e não substitui notificação extrajudicial.'];
  rodape.forEach(l=>{ const ls = doc.splitTextToSize(l, W-28); doc.text(ls, 14, y); y += ls.length*4 + 1; });
  const totPag = doc.internal.getNumberOfPages();
  for(let p=1;p<=totPag;p++){
    doc.setPage(p);
    doc.setFontSize(7.5); doc.setTextColor(148,163,184);
    doc.text('Ovos Casagrande — Gestão Executiva', 14, 290);
    doc.text('página '+p+' de '+totPag, W-14, 290, {align:'right'});
  }
  const nomeArq = 'cobranca-'+c.cliente.toLowerCase().replace(/[^a-z0-9]+/g,'-').slice(0,40)+'.pdf';
  const blob = doc.output('blob');
  status(null);
  sb.from('ovos_cobrancas').insert({ vendedor:c.vendedor, cliente:c.cliente, canal: compartilhar?'whatsapp':'pdf', tom, criado_por:ME.id }).then(()=>limparCache());
  if(compartilhar && navigator.canShare){
    const arquivo = new File([blob], nomeArq, { type:'application/pdf' });
    const texto = TOMES[tom].texto(c);
    if(navigator.canShare({ files:[arquivo] })){
      try{
        await navigator.share({ files:[arquivo], text:texto, title:'Cobrança — '+c.cliente });
        status('Compartilhado ✓'); setTimeout(status,2000,null);
        return;
      }catch(e){ /* usuário cancelou — cai para fallback */ }
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = nomeArq; a.click();
  setTimeout(()=>URL.revokeObjectURL(url), 5000);
  const texto = encodeURIComponent(TOMES[tom].texto(c));
  window.open('https://wa.me/?text='+texto, '_blank');
  status('PDF baixado + WhatsApp aberto — anexe o PDF na conversa ✓');
  setTimeout(status,4000,null);
}

function carregarJsPDF(){
  if(window.jspdf && window.jspdf.jsPDF) return Promise.resolve();
  return new Promise((res,rej)=>{
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js';
    s.onload = res; s.onerror = ()=>rej(new Error('Falha ao carregar jsPDF'));
    document.head.appendChild(s);
  });
}
let LOGO_CACHE = null;
async function carregarLogo(){
  if(LOGO_CACHE) return LOGO_CACHE;
  try{
    const r = await fetch('https://raw.githubusercontent.com/Ovoscasagrande/producao-casagrande/main/analises/logo-casagrande.png');
    const b = await r.blob();
    return new Promise((res)=>{
      const rd = new FileReader();
      rd.onload = ()=>{ LOGO_CACHE = rd.result; res(LOGO_CACHE); };
      rd.readAsDataURL(b);
    });
  }catch(e){ return null; }
}
