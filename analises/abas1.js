// ---------- Hoje ----------
async function abaHoje(){
  const serie = await carregar('ovos_serie_diaria');
  serie.sort((a,b)=> a.data_base<b.data_base?-1:1);
  const u = serie[serie.length-1];
  const prod = await carregar('ovos_producao','data,caixas');
  const comp = await carregar('ovos_compras','data,caixas');
  const ano = new Date().getFullYear();
  const cx = a => a.filter(r=>r.data && r.data.startsWith(ano)).reduce((s,r)=>s+(+r.caixas||0),0);
  el('conteudo').innerHTML = `
  <div class="kpis">
    <div class="kpi"><div class="l">A receber (aberto)</div><div class="v">${BRL(u.receber_total)}</div><div class="s">${u.receber_n} títulos · base ${fmtData(u.data_base)}</div></div>
    <div class="kpi"><div class="l">Receber atrasado</div><div class="v" style="color:var(--bad)">${BRL(u.receber_atrasado)}</div><div class="s">${u.receber_atrasado_n} títulos</div></div>
    <div class="kpi"><div class="l">A pagar (aberto)</div><div class="v">${BRL(u.pagar_total)}</div><div class="s">${u.pagar_n} títulos · base ${fmtData(u.data_base)}</div></div>
    <div class="kpi"><div class="l">Pagar vencido</div><div class="v" style="color:var(--bad)">${BRL(u.pagar_vencido)}</div><div class="s">${u.pagar_vencido_n} títulos</div></div>
    <div class="kpi"><div class="l">Líquido 30 dias</div><div class="v" style="color:var(--ok)">${BRL(u.liquido_30d)}</div><div class="s">projeção da janela</div></div>
    <div class="kpi"><div class="l">Produção ${ano}</div><div class="v">${NUM(cx(prod),1)} cx</div><div class="s">acumulado do ano</div></div>
    <div class="kpi"><div class="l">Compras ${ano}</div><div class="v">${NUM(cx(comp),1)} cx</div><div class="s">acumulado do ano</div></div>
  </div>
  <div class="cardbox"><h3>Série diária — posição das contas (R$)</h3><canvas id="chSerie"></canvas></div>`;
  const labels = serie.map(r=>fmtData(r.data_base));
  new Chart(el('chSerie'), { type:'line', data:{ labels, datasets:[
    { label:'A receber', data:serie.map(r=>r.receber_total), borderColor:'#4caf50', tension:.3, pointRadius:2 },
    { label:'A pagar', data:serie.map(r=>r.pagar_total), borderColor:'#ffd400', tension:.3, pointRadius:2 },
    { label:'Receber atrasado', data:serie.map(r=>r.receber_atrasado), borderColor:'#ff5252', tension:.3, pointRadius:2 },
  ]}, options:{ plugins:{ legend:{ labels:{ boxWidth:12 } } }, scales:{ y:{ ticks:{ callback:v=>'R$ '+(v/1e6).toFixed(1)+'M' } } } } });
}

// ---------- Receber ----------
async function abaReceber(){
  const rows = await carregar('ovos_receber');
  const base = ultimaBase(rows);
  const rs = rows.filter(r=>r.data_base===base);
  const faixas = {};
  rs.forEach(r=>{ const f = r.faixa_aging||'—'; faixas[f]=(faixas[f]||0)+(+r.saldo||0); });
  const ordF = Object.entries(faixas).sort((a,b)=> a[0].localeCompare(b[0]));
  const porCli = {};
  rs.forEach(r=>{ const c=r.cliente||'—'; porCli[c]=porCli[c]||{tot:0,venc:0,n:0}; porCli[c].tot+=+r.saldo||0; if(r.dias_atraso>0) porCli[c].venc+=+r.saldo||0; porCli[c].n++; });
  const top = Object.entries(porCli).sort((a,b)=>b[1].venc-a[1].venc).slice(0,12);
  const tot = rs.reduce((s,r)=>s+(+r.saldo||0),0), venc = rs.filter(r=>r.dias_atraso>0).reduce((s,r)=>s+(+r.saldo||0),0);
  el('conteudo').innerHTML = `
  <div class="kpis">
    <div class="kpi"><div class="l">Total em aberto</div><div class="v">${BRL(tot)}</div><div class="s">${rs.length} títulos · base ${fmtData(base)}</div></div>
    <div class="kpi"><div class="l">Vencido</div><div class="v" style="color:var(--bad)">${BRL(venc)}</div><div class="s">${(100*venc/tot).toFixed(1)}% da carteira</div></div>
  </div>
  <div class="two">
  <div class="cardbox"><h3>Aging por faixa (R$)</h3><canvas id="chAging"></canvas></div>
  <div class="cardbox"><h3>Top 12 clientes por vencido</h3>
    <table><tr><th>Cliente</th><th class="num">Aberto</th><th class="num">Vencido</th><th class="num">Tít.</th></tr>
    ${top.map(([c,v])=>`<tr><td>${c}</td><td class="num">${BRL(v.tot)}</td><td class="num" style="color:${v.venc>0?'var(--bad)':'inherit'}">${BRL(v.venc)}</td><td class="num">${v.n}</td></tr>`).join('')}
    </table></div>
  </div>`;
  new Chart(el('chAging'), { type:'bar', data:{ labels:ordF.map(x=>x[0]), datasets:[{ label:'Saldo (R$)', data:ordF.map(x=>x[1]), backgroundColor:'#ffd400' }] },
    options:{ plugins:{ legend:{display:false} }, scales:{ y:{ ticks:{ callback:v=>'R$ '+(v/1e3).toFixed(0)+'k' } } }, x:{ ticks:{ autoSkip:false, font:{size:10} } } } });
}

// ---------- Pagar ----------
async function abaPagar(){
  const rows = await carregar('ovos_pagar');
  const base = ultimaBase(rows);
  const rs = rows.filter(r=>r.data_base===base);
  const porCC = {}, porForn = {};
  rs.forEach(r=>{
    const cc = r.centro_custo||'Não Classificado';
    porCC[cc]=porCC[cc]||{tot:0,n:0}; porCC[cc].tot+=+r.saldo||0; porCC[cc].n++;
    const f = r.fornecedor||'—';
    porForn[f]=porForn[f]||{tot:0,venc:0,n:0}; porForn[f].tot+=+r.saldo||0; if(r.dias_venc>0) porForn[f].venc+=+r.saldo||0; porForn[f].n++;
  });
  const ccOrd = Object.entries(porCC).sort((a,b)=>b[1].tot-a[1].tot).slice(0,10);
  const fOrd = Object.entries(porForn).sort((a,b)=>b[1].tot-a[1].tot).slice(0,12);
  const tot = rs.reduce((s,r)=>s+(+r.saldo||0),0), venc = rs.filter(r=>r.dias_venc>0).reduce((s,r)=>s+(+r.saldo||0),0);
  el('conteudo').innerHTML = `
  <div class="kpis">
    <div class="kpi"><div class="l">Total em aberto</div><div class="v">${BRL(tot)}</div><div class="s">${rs.length} títulos · base ${fmtData(base)}</div></div>
    <div class="kpi"><div class="l">Vencido</div><div class="v" style="color:var(--bad)">${BRL(venc)}</div><div class="s">${(100*venc/tot).toFixed(1)}% do total</div></div>
  </div>
  <div class="two">
  <div class="cardbox"><h3>Top 10 centros de custo (R$)</h3><canvas id="chCC"></canvas></div>
  <div class="cardbox"><h3>Top 12 fornecedores</h3>
    <table><tr><th>Fornecedor</th><th class="num">Aberto</th><th class="num">Vencido</th><th class="num">Tít.</th></tr>
    ${fOrd.map(([f,v])=>`<tr><td>${f}</td><td class="num">${BRL(v.tot)}</td><td class="num" style="color:${v.venc>0?'var(--bad)':'inherit'}">${BRL(v.venc)}</td><td class="num">${v.n}</td></tr>`).join('')}
    </table></div>
  </div>`;
  new Chart(el('chCC'), { type:'bar', data:{ labels:ccOrd.map(x=>x[0]), datasets:[{ label:'Saldo (R$)', data:ccOrd.map(x=>x[1]), backgroundColor:'#ffd400' }] },
    options:{ indexAxis:'y', plugins:{ legend:{display:false} }, scales:{ x:{ ticks:{ callback:v=>'R$ '+(v/1e3).toFixed(0)+'k' } } } } });
}
