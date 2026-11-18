// ---------- Hoje (agenda da semana e do mês) ----------
// O que está PROGRAMADO: contas a pagar/receber, produção e compras da semana e do mês,
// saldo do dia e saldo projetado. Comparativos 2025 ficam nas abas específicas.
async function abaHoje(){
  const [serie, rec, pag, prod, comp] = await Promise.all([
    carregar('ovos_serie_diaria'),
    carregar('ovos_receber','vencimento,saldo,cliente,dias_atraso'),
    carregar('ovos_pagar','vencimento,saldo,fornecedor,dias_venc,centro_custo'),
    carregar('ovos_producao','data,caixas'),
    carregar('ovos_compras','data,caixas'),
  ]);
  serie.sort((a,b)=> a.data_base<b.data_base?-1:1);
  const u = serie[serie.length-1];
  const hoje = new Date();
  const y = hoje.getFullYear(), m = hoje.getMonth(), d = hoje.getDate();
  const ISO = dt => dt.toISOString().slice(0,10);
  const hojeISO = ISO(new Date(y, m, d));
  const faltam = hoje.getDay()===0 ? 0 : 7 - hoje.getDay(); // semana vai até o domingo
  const fimSemanaISO = ISO(new Date(y, m, d + faltam));
  const fimMesISO = ISO(new Date(y, m+1, 0));

  const janela = (rows, campo, a, b) => rows.filter(r=>r[campo]>=a && r[campo]<=b);
  const soma = (rows, f='saldo') => rows.reduce((s,r)=>s+(+r[f]||0),0);

  // --- agenda: receber / pagar ---
  const recSem = janela(rec,'vencimento',hojeISO,fimSemanaISO);
  const pagSem = janela(pag,'vencimento',hojeISO,fimSemanaISO);
  const recMes = janela(rec,'vencimento',hojeISO,fimMesISO);
  const pagMes = janela(pag,'vencimento',hojeISO,fimMesISO);
  const recVenc = rec.filter(r=>r.vencimento<hojeISO);
  const pagVenc = pag.filter(r=>r.vencimento<hojeISO);

  // --- produção e compras: semana e mês ---
  const cxJ = (rows,a,b) => soma(janela(rows,'data',a,b),'caixas');
  const prodSem = cxJ(prod,hojeISO,fimSemanaISO), prodMes = cxJ(prod,hojeISO,fimMesISO);
  const compSem = cxJ(comp,hojeISO,fimSemanaISO), compMes = cxJ(comp,hojeISO,fimMesISO);

  // --- saldo do dia (programado: vence hoje) ---
  const recHoje = soma(janela(rec,'vencimento',hojeISO,hojeISO));
  const pagHoje = soma(janela(pag,'vencimento',hojeISO,hojeISO));

  // --- agenda por dia (para o gráfico) ---
  const porDia = {};
  [...recMes.map(r=>({d:r.vencimento,tipo:'R',nome:r.cliente||'—',v:+r.saldo||0})),
   ...pagMes.map(r=>({d:r.vencimento,tipo:'P',nome:r.fornecedor||'—',v:+r.saldo||0}))]
   .forEach(x=>{ (porDia[x.d]=porDia[x.d]||[]).push(x); });
  const dias = Object.keys(porDia).sort();

  el('conteudo').innerHTML = `
  <div class="section-head">
    <h2>Hoje</h2>
    <span class="meta">programação de ${fmtData(hojeISO)} a ${fmtData(fimMesISO)} · posição ${fmtData(u.data_base)}</span>
  </div>
  <div class="kpis">
    <div class="kpi ${recHoje-pagHoje>=0?'k-ok':'k-bad'}"><div class="l">Saldo do dia (hoje)</div>
      <div class="v" style="color:${recHoje-pagHoje>=0?'var(--ok)':'var(--bad)'}">${BRL(recHoje-pagHoje)}</div>
      <div class="s">receber ${BRL(recHoje)} − pagar ${BRL(pagHoje)}</div></div>
    <div class="kpi k-ok"><div class="l">A receber na semana</div><div class="v">${BRL(soma(recSem))}</div><div class="s">${recSem.length} títulos · até ${fmtData(fimSemanaISO)}</div></div>
    <div class="kpi k-bad"><div class="l">A pagar na semana</div><div class="v">${BRL(soma(pagSem))}</div><div class="s">${pagSem.length} títulos · até ${fmtData(fimSemanaISO)}</div></div>
    <div class="kpi ${soma(recSem)-soma(pagSem)>=0?'k-ok':'k-bad'}"><div class="l">Saldo da semana</div>
      <div class="v" style="color:${soma(recSem)-soma(pagSem)>=0?'var(--ok)':'var(--bad)'}">${BRL(soma(recSem)-soma(pagSem))}</div><div class="s">receber − pagar</div></div>
    <div class="kpi k-ok"><div class="l">A receber no mês</div><div class="v" style="color:var(--ok)">${BRL(soma(recMes))}</div><div class="s">${recMes.length} títulos · até ${fmtData(fimMesISO)}</div></div>
    <div class="kpi k-bad"><div class="l">A pagar no mês</div><div class="v">${BRL(soma(pagMes))}</div><div class="s">${pagMes.length} títulos · até ${fmtData(fimMesISO)}</div></div>
    <div class="kpi ${soma(recMes)-soma(pagMes)>=0?'k-ok':'k-bad'}"><div class="l">Saldo do mês</div>
      <div class="v" style="color:${soma(recMes)-soma(pagMes)>=0?'var(--ok)':'var(--bad)'}">${BRL(soma(recMes)-soma(pagMes))}</div><div class="s">receber − pagar</div></div>
    <div class="kpi k-slate"><div class="l">Produção semana · mês</div><div class="v">${NUM(prodSem,0)} · ${NUM(prodMes,0)} cx</div><div class="s">programado até ${fmtData(fimSemanaISO)} / ${fmtData(fimMesISO)}</div></div>
    <div class="kpi k-slate"><div class="l">Compras semana · mês</div><div class="v">${NUM(compSem,0)} · ${NUM(compMes,0)} cx</div><div class="s">programado até ${fmtData(fimSemanaISO)} / ${fmtData(fimMesISO)}</div></div>
    <div class="kpi k-gold"><div class="l">Vencido em aberto</div><div class="v" style="color:var(--bad)">${BRL(soma(recVenc))}</div><div class="s">receber · pagar ${BRL(soma(pagVenc))}</div></div>
  </div>

  <div class="two">
    <div class="cardbox">
      <div class="cardbox-head"><h3>Agenda do mês — por dia (R$)</h3><span class="hint">verde = receber · vermelho = pagar</span></div>
      <canvas id="chAgenda" height="110"></canvas>
    </div>
    <div class="cardbox">
      <div class="cardbox-head"><h3>Produção × Compras — próximos dias (cx)</h3><span class="hint">programado</span></div>
      <canvas id="chProdComp" height="110"></canvas>
    </div>
  </div>

  <div class="cardbox">
    <div class="cardbox-head"><h3>Próximos vencimentos (14 dias)</h3><span class="hint">títulos que vencem primeiro</span></div>
    <div class="table-wrap"><table><thead><tr><th>Data</th><th>Tipo</th><th>Cliente / Fornecedor</th><th class="num">Valor</th></tr></thead><tbody>
    ${[...recSem.concat(recMes).map(r=>({d:r.vencimento,t:'RECEBER',n:r.cliente||'—',v:+r.saldo||0})),
       ...pagSem.concat(pagMes).map(r=>({d:r.vencimento,t:'PAGAR',n:r.fornecedor||'—',v:+r.saldo||0}))]
      .sort((a,b)=>a.d.localeCompare(b.d)).slice(0,14)
      .map(x=>`<tr><td>${fmtData(x.d)}</td><td><span class="badge ${x.t==='RECEBER'?'g':'r'}">${x.t}</span></td><td>${x.n}</td><td class="num" style="color:${x.t==='RECEBER'?'var(--ok)':'inherit'}">${BRL(x.v)}</td></tr>`).join('')}
    </tbody></table></div>
  </div>

  <div class="cardbox">
    <div class="cardbox-head"><h3>Série diária — posição das contas (R$)</h3><span class="hint">A receber &amp; A pagar (esq.) · Atrasado (dir.)</span></div>
    <canvas id="chSerie" height="95"></canvas>
  </div>`;

  // agenda por dia (barras positivas receber, negativas pagar)
  const lblAg = dias.map(dt=>dt.slice(8,10)+'/'+dt.slice(5,7));
  const recAg = dias.map(dt=>porDia[dt].filter(x=>x.tipo==='R').reduce((s,x)=>s+x.v,0));
  const pagAg = dias.map(dt=>-porDia[dt].filter(x=>x.tipo==='P').reduce((s,x)=>s+x.v,0));
  new Chart(el('chAgenda'), { type:'bar', data:{ labels:lblAg, datasets:[
    { label:'Receber', data:recAg, backgroundColor:'#16a34a', borderRadius:3, stack:'a' },
    { label:'Pagar', data:pagAg, backgroundColor:'#dc2626', borderRadius:3, stack:'a' },
  ]}, options:{
    interaction:{ mode:'index', intersect:false },
    plugins:{ legend:{ position:'top', labels:{ usePointStyle:true, boxWidth:10 } } },
    scales:{ y:{ ticks:{ callback:v=>'R$ '+(v/1e3).toFixed(0)+'k' } } }
  } });

  // produção × compras próximos 14 dias
  const dias14 = [];
  for(let i=0;i<14;i++){ dias14.push(ISO(new Date(y,m,d+i))); }
  const prodD = dias14.map(dt=>cxJ(prod,dt,dt));
  const compD = dias14.map(dt=>cxJ(comp,dt,dt));
  new Chart(el('chProdComp'), { type:'bar', data:{ labels:dias14.map(dt=>dt.slice(8,10)+'/'+dt.slice(5,7)), datasets:[
    { label:'Produção', data:prodD, backgroundColor:'#f59e0b', borderRadius:3 },
    { label:'Compras', data:compD, backgroundColor:'#0ea5e9', borderRadius:3 },
  ]}, options:{
    interaction:{ mode:'index', intersect:false },
    plugins:{ legend:{ position:'top', labels:{ usePointStyle:true, boxWidth:10 } } },
    scales:{ y:{ beginAtZero:true } }
  } });

  // série diária
  const labels = serie.map(r=>fmtData(r.data_base));
  new Chart(el('chSerie'), { type:'line', data:{ labels, datasets:[
    { label:'A receber', data:serie.map(r=>r.receber_total), borderColor:'#16a34a', backgroundColor:'rgba(22,163,74,.10)', borderWidth:2.5, tension:.3, pointRadius:3, yAxisID:'y' },
    { label:'A pagar', data:serie.map(r=>r.pagar_total), borderColor:'#f59e0b', backgroundColor:'rgba(245,158,11,.10)', borderWidth:2.5, tension:.3, pointRadius:3, yAxisID:'y' },
    { label:'Receber atrasado', data:serie.map(r=>r.receber_atrasado), borderColor:'#dc2626', backgroundColor:'rgba(220,38,38,.08)', borderWidth:2, borderDash:[4,4], tension:.3, pointRadius:3, yAxisID:'y1' },
  ]}, options:{
    interaction:{ mode:'index', intersect:false },
    plugins:{ legend:{ position:'top', labels:{ usePointStyle:true, boxWidth:10, font:{weight:'600'} } } },
    scales:{
      y:{ position:'left', ticks:{ callback:v=>'R$ '+(v/1e6).toFixed(1)+'M' } },
      y1:{ position:'right', grid:{ drawOnChartArea:false }, ticks:{ color:'#dc2626', callback:v=>'R$ '+(v/1e3).toFixed(0)+'k' } }
    }
  } });
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
    <div class="kpi k-gold"><div class="l">Total em aberto</div><div class="v">${BRL(tot)}</div><div class="s">${rs.length} títulos · base ${fmtData(base)}</div></div>
    <div class="kpi k-bad"><div class="l">Vencido</div><div class="v" style="color:var(--bad)">${BRL(venc)}</div><div class="s">${(100*venc/tot).toFixed(1)}% da carteira</div></div>
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
    <div class="kpi k-gold"><div class="l">Total em aberto</div><div class="v">${BRL(tot)}</div><div class="s">${rs.length} títulos · base ${fmtData(base)}</div></div>
    <div class="kpi k-bad"><div class="l">Vencido</div><div class="v" style="color:var(--bad)">${BRL(venc)}</div><div class="s">${(100*venc/tot).toFixed(1)}% do total</div></div>
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
