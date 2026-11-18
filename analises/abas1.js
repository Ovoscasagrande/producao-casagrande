// ---------- Hoje (pontos principais) ----------
// Prioridade: posição de HOJE + MÊS REAL em destaque; 2025 só como comparativo.
// Comparações justas: o ERP vai até o dia X de nov/2026 (ex. 16/11), então o
// comparativo com 2025 usa o MESMO período (1–16/nov), nunca mês cheio × mês parcial.
async function abaHoje(){
  const hojeISO = new Date().toISOString().slice(0,10);
  const [serie, prod, comp, rec, pag] = await Promise.all([
    carregar('ovos_serie_diaria'),
    carregar('ovos_producao','data,caixas'),
    carregar('ovos_compras','data,caixas'),
    carregar('ovos_recebidos_historico','data_pagamento,valor_pago,vendedor','data_pagamento=gte.2025-01-01'),
    carregar('ovos_pagos_historico','vencimento,valor','vencimento=gte.2025-01-01'),
  ]);
  serie.sort((a,b)=> a.data_base<b.data_base?-1:1);
  const u = serie[serie.length-1];
  const y = new Date().getFullYear();
  const m = new Date().getMonth()+1;
  const MES = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];

  // último dia com dados (data de corte da extração)
  const maxData = rec.reduce((mx,r)=> (r.data_pagamento && r.data_pagamento>mx) ? r.data_pagamento : mx, '2025-01-01');
  const diaCorte = +maxData.slice(8,10);
  const ateLabel = `até ${diaCorte}/${String(m).padStart(2,'0')}`;

  // --- helpers de comparação no mesmo período ---
  const somaRec = (isoA, isoB) => rec.reduce((s,r)=> (r.data_pagamento>=isoA && r.data_pagamento<=isoB) ? s+(+r.valor_pago||0) : s, 0);
  const somaPag = (isoA, isoB) => pag.reduce((s,r)=> (r.vencimento>=isoA && r.vencimento<=isoB) ? s+(+r.valor||0) : s, 0);
  const delta = (a,b) => b ? (a/b-1)*100 : null;
  const pct = d => d==null ? '—' : `${d>=0?'+':''}${d.toFixed(1)}%`;

  // --- MÊS REAL: 1/nov–16/nov/2026 × 1/nov–16/nov/2025 ---
  const mK = `${y}-${String(m).padStart(2,'0')}`, mK25 = `${y-1}-${String(m).padStart(2,'0')}`;
  const inicio26 = `${mK}-01`, inicio25 = `${mK25}-01`;
  const fim26 = maxData, fim25 = `${mK25}-${String(diaCorte).padStart(2,'0')}`;
  const recMes = somaRec(inicio26, fim26), recMes25 = somaRec(inicio25, fim25);
  const pagMes = somaPag(inicio26, fim26), pagMes25 = somaPag(inicio25, fim25);
  const dRec = delta(recMes, recMes25), dPag = delta(pagMes, pagMes25);

  // --- ANO: 1/jan–16/nov/2026 × 1/jan–16/nov/2025 ---
  const recAno = somaRec(`${y}-01-01`, fim26), recAno25 = somaRec(`${y-1}-01-01`, fim25);
  const pagAno = somaPag(`${y}-01-01`, fim26), pagAno25 = somaPag(`${y-1}-01-01`, fim25);
  const dRecAno = delta(recAno, recAno25), dPagAno = delta(pagAno, pagAno25);

  // --- produção e compras: mês e ano no mesmo período ---
  const cx = (a, isoA, isoB) => a.reduce((s,r)=> (r.data>=isoA && r.data<=isoB) ? s+(+r.caixas||0) : s, 0);
  const prodMes = cx(prod, inicio26, fim26), prodMes25 = cx(prod, inicio25, fim25);
  const compMes = cx(comp, inicio26, fim26), compMes25 = cx(comp, inicio25, fim25);
  const prodAno = cx(prod, `${y}-01-01`, fim26), prodAno25 = cx(prod, `${y-1}-01-01`, fim25);
  const compAno = cx(comp, `${y}-01-01`, fim26), compAno25 = cx(comp, `${y-1}-01-01`, fim25);
  const dProd = delta(prodMes, prodMes25), dComp = delta(compMes, compMes25);
  const dProdAno = delta(prodAno, prodAno25), dCompAno = delta(compAno, compAno25);

  // --- série mensal recebido × pago (2025 completo + 2026 até o corte) ---
  const mesesOrd = [];
  for(let mm=1; mm<=12; mm++) mesesOrd.push(`${y-1}-${String(mm).padStart(2,'0')}`);
  for(let mm=1; mm<=m; mm++) mesesOrd.push(`${y}-${String(mm).padStart(2,'0')}`);
  const somaMes = (arr, k, campo) => arr.reduce((s,r)=>{ const d=r[campo]; return (d && d.startsWith(k)) ? s+(+r[campo==='vencimento'?'valor':'valor_pago']||0) : s; }, 0);
  const recSeries = mesesOrd.map(k=>somaMes(rec,k,'data_pagamento'));
  const pagSeries = mesesOrd.map(k=>somaMes(pag,k,'vencimento'));

  // --- top vendedores do ano (recebimentos reais) ---
  const porVend = {};
  rec.filter(r=>r.vendedor && r.data_pagamento>=`${y}-01-01`).forEach(h=>{ porVend[h.vendedor]=(porVend[h.vendedor]||0)+(+h.valor_pago||0); });
  const topV = Object.entries(porVend).sort((a,b)=>b[1]-a[1]).slice(0,6);

  // --- recebimentos do último dia com lançamento ---
  const histUlt = rec.filter(r=>r.data_pagamento===maxData);
  const porVendUlt = {};
  histUlt.forEach(h=>{ const v=h.vendedor||'—'; porVendUlt[v]=(porVendUlt[v]||0)+(+h.valor_pago||0); });
  const topUlt = Object.entries(porVendUlt).sort((a,b)=>b[1]-a[1]);

  el('conteudo').innerHTML = `
  <div class="section-head">
    <h2>Hoje</h2>
    <span class="meta">posição ${fmtData(u.data_base)} · mês real ${MES[m-1]}/${y} ${ateLabel}</span>
  </div>
  <div class="kpis">
    <div class="kpi k-ok"><div class="l">Recebido no mês (${MES[m-1]} ${ateLabel})</div><div class="v" style="color:var(--ok)">${BRL(recMes)}</div>
      <div class="s">${pct(dRec)} vs ${MES[m-1]}/${y-1} no mesmo período (${BRL(recMes25)})</div></div>
    <div class="kpi k-bad"><div class="l">Pago no mês (${MES[m-1]} ${ateLabel})</div><div class="v">${BRL(pagMes)}</div>
      <div class="s">${pct(dPag)} vs ${MES[m-1]}/${y-1} no mesmo período (${BRL(pagMes25)})</div></div>
    <div class="kpi k-gold"><div class="l">A receber (aberto)</div><div class="v">${BRL(u.receber_total)}</div><div class="s">${u.receber_n} títulos · ${BRL(u.receber_atrasado)} atrasado</div></div>
    <div class="kpi k-slate"><div class="l">A pagar (aberto)</div><div class="v">${BRL(u.pagar_total)}</div><div class="s">${u.pagar_n} títulos · ${BRL(u.pagar_vencido)} vencido</div></div>
    <div class="kpi k-ok"><div class="l">Líquido 30 dias</div><div class="v" style="color:var(--ok)">${BRL(u.liquido_30d)}</div><div class="s">projeção da janela</div></div>
    <div class="kpi k-slate"><div class="l">Produção no mês</div><div class="v">${NUM(prodMes,1)} cx</div>
      <div class="s">${pct(dProd)} vs ${MES[m-1]}/${y-1} · no ano ${pct(dProdAno)}</div></div>
    <div class="kpi k-slate"><div class="l">Compras no mês</div><div class="v">${NUM(compMes,1)} cx</div>
      <div class="s">${pct(dComp)} vs ${MES[m-1]}/${y-1} · no ano ${pct(dCompAno)}</div></div>
    <div class="kpi ${recMes>=pagMes?'k-ok':'k-bad'}"><div class="l">Resultado do mês</div><div class="v" style="color:${recMes>=pagMes?'var(--ok)':'var(--bad)'}">${BRL(recMes-pagMes)}</div><div class="s">recebido − pago ${ateLabel}</div></div>
  </div>

  <div class="cardbox">
    <div class="cardbox-head"><h3>Recebido × Pago por mês (R$)</h3><span class="hint">2025 em cinza (comparativo) · 2026 em cor · nov/26 ${ateLabel}</span></div>
    <canvas id="chRecPag" height="105"></canvas>
  </div>

  <div class="two">
    <div class="cardbox">
      <div class="cardbox-head"><h3>Produção — ${MES[m-1]} ${ateLabel} vs ${MES[m-1]}/${y-1}</h3><span class="hint">caixas · mesmo período</span></div>
      <canvas id="chProdCmp" height="110"></canvas>
      <div style="margin-top:8px;font-size:12px;color:var(--mut)">No ano (${ateLabel}): ${NUM(prodAno,1)} cx vs ${NUM(prodAno25,1)} cx (${pct(dProdAno)})</div>
    </div>
    <div class="cardbox">
      <div class="cardbox-head"><h3>Compras — ${MES[m-1]} ${ateLabel} vs ${MES[m-1]}/${y-1}</h3><span class="hint">caixas · mesmo período</span></div>
      <canvas id="chCompCmp" height="110"></canvas>
      <div style="margin-top:8px;font-size:12px;color:var(--mut)">No ano (${ateLabel}): ${NUM(compAno,1)} cx vs ${NUM(compAno25,1)} cx (${pct(dCompAno)})</div>
    </div>
  </div>

  <div class="two">
    <div class="cardbox">
      <div class="cardbox-head"><h3>Top vendedores ${y} (recebido)</h3><span class="hint">base ERP · ${ateLabel}</span></div>
      <canvas id="chTopV" height="130"></canvas>
    </div>
    <div class="cardbox">
      <div class="cardbox-head"><h3>Recebimentos do último dia (${fmtData(maxData)})</h3><span class="hint">por vendedor</span></div>
      ${topUlt.length ? `<table><thead><tr><th>Vendedor</th><th class="num">Valor</th></tr></thead><tbody>
        ${topUlt.map(([v,val])=>`<tr><td>${v}</td><td class="num" style="color:var(--ok);font-weight:600">${BRL(val)}</td></tr>`).join('')}
        <tr><td><b>Total</b></td><td class="num" style="font-weight:700">${BRL(topUlt.reduce((s,x)=>s+x[1],0))}</td></tr>
        </tbody></table>`
        : `<div style="color:var(--mut);padding:8px 0">Sem lançamentos no dia.</div>`}
    </div>
  </div>

  <div class="cardbox">
    <div class="cardbox-head"><h3>Série diária — posição das contas (R$)</h3><span class="hint">A receber &amp; A pagar (esq.) · Atrasado (dir.)</span></div>
    <canvas id="chSerie" height="95"></canvas>
  </div>`;

  // gráfico recebido × pago por mês
  new Chart(el('chRecPag'), { type:'bar', data:{ labels:mesesOrd.map(k=>MES[+k.slice(5,7)-1]+(k.startsWith(String(y))?" '":' ')+k.slice(2,4)), datasets:[
    { label:'Recebido', data:recSeries, backgroundColor:recSeries.map((v,i)=> mesesOrd[i].startsWith(String(y))?'#16a34a':'#cbd5e1'), borderRadius:4 },
    { label:'Pago', data:pagSeries, backgroundColor:pagSeries.map((v,i)=> mesesOrd[i].startsWith(String(y))?'#f59e0b':'#e2e8f0'), borderRadius:4 },
  ]}, options:{
    interaction:{ mode:'index', intersect:false },
    plugins:{ legend:{ position:'top', labels:{ usePointStyle:true, boxWidth:10, font:{weight:'600'} } } },
    scales:{ y:{ ticks:{ callback:v=>'R$ '+(v/1e6).toFixed(1)+'M' } } }
  } });

  // comparativos do mês (mesmo período)
  const cmp = (id, v26, v25, cor) => new Chart(el(id), { type:'bar', data:{ labels:[`${MES[m-1]}/${y}`, `${MES[m-1]}/${y-1}`], datasets:[
    { label:'Caixas', data:[v26, v25], backgroundColor:[cor, '#cbd5e1'], borderRadius:6 },
  ]}, options:{ plugins:{ legend:{display:false} } } });
  cmp('chProdCmp', prodMes, prodMes25, '#f59e0b');
  cmp('chCompCmp', compMes, compMes25, '#0ea5e9');

  // top vendedores
  new Chart(el('chTopV'), { type:'bar', data:{ labels:topV.map(x=>x[0].split(' ').slice(0,2).join(' ')), datasets:[
    { label:'Recebido no ano', data:topV.map(x=>x[1]), backgroundColor:'#16a34a', borderRadius:5 },
  ]}, options:{ indexAxis:'y', plugins:{ legend:{display:false} }, scales:{ x:{ ticks:{ callback:v=>'R$ '+(v/1e6).toFixed(1)+'M' } } } } });

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
