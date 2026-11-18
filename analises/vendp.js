// ---------- Painel do vendedor (mobile-first) ----------
// Enquanto ovos_vendas está vazio (planilha pendente), o painel usa os RECEBIMENTOS
// do ERP (ovos_recebidos_historico) — RLS garante que o vendedor só lê o próprio nome.
async function abaPainelVendedor(vendId){
  const vend = await carregar('ovos_vendedores');
  const v = vendId ? vend.find(x=>x.id===vendId) : vend.find(x=>x.id===ME.vend_id);
  if(!v){ el('conteudo').innerHTML='<div class="cardbox">Vendedor não encontrado.</div>'; return; }
  const pct = +v.comissao_pct||0;
  const hoje = new Date();
  const y = hoje.getFullYear();
  const mesAtu = `${y}-${String(hoje.getMonth()+1).padStart(2,'0')}`;
  const mesAnt = new Date(y, hoje.getMonth()-1, 1);
  const mesAntK = `${mesAnt.getFullYear()}-${String(mesAnt.getMonth()+1).padStart(2,'0')}`;

  // recebimentos do próprio vendedor
  let hist;
  if(ME.tipo==='VENDEDOR'){
    status('Carregando meus recebimentos…');
    const { data, error } = await sb.rpc('ovos_recebimentos_do_vendedor');
    status(null);
    if(error) throw error;
    hist = data || [];
  } else {
    const all = await carregar('ovos_recebidos_historico','data_pagamento,cliente,titulo,valor_pago,vendedor');
    hist = all.filter(r=>r.vendedor===v.nome);
  }
  const anoH = hist.filter(r=>r.data_pagamento && r.data_pagamento.startsWith(String(y)));
  const mesH = k => anoH.filter(r=>r.data_pagamento.startsWith(k)).reduce((s,r)=>s+(+r.valor_pago||0),0);
  const recMesAtu = mesH(mesAtu), recMesAnt = mesH(mesAntK), recAno = anoH.reduce((s,r)=>s+(+r.valor_pago||0),0);

  // por mês (todos os anos do histórico, para a série)
  const porMes = {};
  hist.forEach(r=>{ if(!r.data_pagamento) return; const k=r.data_pagamento.slice(0,7);
    porMes[k]=(porMes[k]||0)+(+r.valor_pago||0); });
  const meses = Object.keys(porMes).sort().slice(-18);

  // top clientes do ano
  const porCli = {};
  anoH.forEach(r=>{ const c=r.cliente||'—'; porCli[c]=(porCli[c]||0)+(+r.valor_pago||0); });
  const topCli = Object.entries(porCli).sort((a,b)=>b[1]-a[1]).slice(0,10);

  // vendas (planilha) — quando existirem, entram nos KPIs
  const vendas = (await carregar('ovos_vendas')).filter(r=>r.vendedor_id===v.id);
  const temVendas = vendas.length>0;
  const soma = (arr,f) => arr.reduce((s,r)=>s+(+r[f]||0),0);
  const vendasMes = k => soma(vendas.filter(r=>r.data_venda && r.data_venda.startsWith(k)),'valor_venda');
  const anoV = soma(vendas.filter(r=>r.data_venda && r.data_venda.startsWith(String(y))),'valor_venda');

  el('conteudo').innerHTML = `
  <div class="kpis">
    <div class="kpi"><div class="l">Recebido ${fmtMes(mesAtu)}</div><div class="v">${BRL(recMesAtu)}</div><div class="s">base ERP ${fmtMes(mesAtu)}</div></div>
    <div class="kpi"><div class="l">Recebido ${fmtMes(mesAntK)}</div><div class="v">${BRL(recMesAnt)}</div></div>
    <div class="kpi"><div class="l">Recebido no ano</div><div class="v" style="color:var(--acc)">${BRL(recAno)}</div></div>
    <div class="kpi"><div class="l">Comissão ${fmtMes(mesAtu)}</div><div class="v" style="color:var(--ok)">${BRL(recMesAtu*pct/100)}</div><div class="s">${pct}% sobre recebido</div></div>
    <div class="kpi"><div class="l">Comissão ${fmtMes(mesAntK)}</div><div class="v">${BRL(recMesAnt*pct/100)}</div></div>
    <div class="kpi"><div class="l">Comissão do ano</div><div class="v">${BRL(recAno*pct/100)}</div><div class="s">estimada · paga mês seguinte</div></div>
    ${temVendas?`<div class="kpi"><div class="l">Vendas ${fmtMes(mesAtu)}</div><div class="v">${BRL(vendasMes(mesAtu))}</div></div>
    <div class="kpi"><div class="l">Vendas do ano</div><div class="v">${BRL(anoV)}</div></div>`:''}
  </div>
  <div class="cardbox"><h3>Recebimentos por mês (R$)</h3><canvas id="chRM"></canvas></div>
  <div class="cardbox"><h3>Comissão estimada por mês (R$)</h3><canvas id="chCE"></canvas></div>
  <div class="cardbox"><h3>Top 10 clientes ${y} (por recebido)</h3>
    <table><tr><th>Cliente</th><th class="num">Recebido</th><th class="num">Comissão</th></tr>
    ${topCli.map(([c,val])=>`<tr><td>${c}</td><td class="num">${BRL(val)}</td><td class="num">${BRL(val*pct/100)}</td></tr>`).join('')}
    </table></div>
  <div class="cardbox"><h3>Últimos recebimentos</h3>
    <table><tr><th>Data</th><th>Cliente</th><th class="num">Valor</th></tr>
    ${hist.slice(0).sort((a,b)=>(b.data_pagamento||'').localeCompare(a.data_pagamento||'')).slice(0,12).map(r=>`<tr><td>${fmtData(r.data_pagamento)}</td><td>${r.cliente||'—'}</td><td class="num">${BRL(r.valor_pago)}</td></tr>`).join('')}
    </table></div>
  ${temVendas?'':'<div class="cardbox" style="font-size:12px;color:var(--mut)">Análises de produtos, margem e perfil de clientes entram quando a planilha de vendas for carregada.</div>'}`;

  new Chart(el('chRM'), { type:'bar', data:{ labels:meses.map(fmtMes), datasets:[
    { label:'Recebido', data:meses.map(k=>porMes[k]||0), backgroundColor:'#ffd400' },
  ]}, options:{ plugins:{ legend:{display:false} } } });
  new Chart(el('chCE'), { type:'line', data:{ labels:meses.map(fmtMes), datasets:[
    { label:`Comissão ${pct}%`, data:meses.map(k=>(porMes[k]||0)*pct/100), borderColor:'#4caf50', tension:.3 },
  ]}, options:{ plugins:{ legend:{display:false} } } });
}
