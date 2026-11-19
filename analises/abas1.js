// ---------- Hoje (agenda da semana e do mês) ----------
// O que está PROGRAMADO: contas a pagar/receber da semana e do mês, saldo do dia,
// vencido em aberto. Produção e compras = LANÇAMENTOS do ERP (últimos 7 dias e mês
// até o último dia da extração — não são "programados" como títulos).
async function abaHoje(){
  const hoje = new Date();
  const y = hoje.getFullYear(), m = hoje.getMonth(), d = hoje.getDate();
  const ISO = dt => dt.toISOString().slice(0,10);
  const hojeISO = ISO(new Date(y, m, d));
  const [serie, rec, pag, prod, comp, recHojeHist, pagHojeHist] = await Promise.all([
    carregar('ovos_serie_diaria'),
    carregar('ovos_receber','vencimento,saldo,cliente,dias_atraso,vendedor'),
    carregar('ovos_pagar','vencimento,saldo,fornecedor,dias_venc,centro_custo'),
    carregar('ovos_producao','data,caixas'),
    carregar('ovos_compras','data,caixas'),
    carregar('ovos_recebidos_historico','valor_pago','data_pagamento.eq.'+hojeISO),
    carregar('ovos_pagos_historico','valor','vencimento.eq.'+hojeISO),
  ]);
  const recUltDia = recHojeHist.reduce((s,r)=>s+(+r.valor_pago||0),0);
  const pagUltDia = pagHojeHist.reduce((s,r)=>s+(+r.valor||0),0);
  serie.sort((a,b)=> a.data_base<b.data_base?-1:1);
  const u = serie[serie.length-1];
  const faltam = hoje.getDay()===0 ? 0 : 7 - hoje.getDay(); // semana vai até o domingo
  const fimSemanaISO = ISO(new Date(y, m, d + faltam));
  const fimMesISO = ISO(new Date(y, m+1, 0));
  // produção/compras: lançamentos do ERP vão até o último dia da extração — usar esse corte
  const maxDataPC = [...prod, ...comp].reduce((mx,r)=> (r.data && r.data>mx) ? r.data : mx, '');
  const corteLabel = maxDataPC ? fmtData(maxDataPC) : '—';

  const janela = (rows, campo, a, b) => rows.filter(r=>r[campo]>=a && r[campo]<=b);
  const soma = (rows, f='saldo') => rows.reduce((s,r)=>s+(+r[f]||0),0);

  // --- agenda: receber / pagar ---
  const recSem = janela(rec,'vencimento',hojeISO,fimSemanaISO);
  const pagSem = janela(pag,'vencimento',hojeISO,fimSemanaISO);
  const recMes = janela(rec,'vencimento',hojeISO,fimMesISO);
  const pagMes = janela(pag,'vencimento',hojeISO,fimMesISO);
  const recVenc = rec.filter(r=>r.vencimento<hojeISO);
  const pagVenc = pag.filter(r=>r.vencimento<hojeISO);

  // --- janela de datas para produção/compras ---
  const cxJ = (rows,a,b) => soma(janela(rows,'data',a,b),'caixas');

  // --- produção e compras: semana = últimos 7 dias com dados; mês = do dia 1 até o corte ---
  const inicioSemanaISO = ISO(new Date(y, m, d-6));
  const prodSem = cxJ(prod,inicioSemanaISO,maxDataPC), prodMes = cxJ(prod,`${y}-${String(m+1).padStart(2,'0')}-01`,maxDataPC);
  const compSem = cxJ(comp,inicioSemanaISO,maxDataPC), compMes = cxJ(comp,`${y}-${String(m+1).padStart(2,'0')}-01`,maxDataPC);

  // --- saldo do dia (programado: vence hoje) ---
  const recHoje = soma(janela(rec,'vencimento',hojeISO,hojeISO));
  const pagHoje = soma(janela(pag,'vencimento',hojeISO,hojeISO));

  // --- agenda por dia (para o gráfico) ---
  const porDia = {};
  [...recMes.map(r=>({d:r.vencimento,tipo:'R',nome:r.cliente||'—',v:+r.saldo||0,vendedor:r.vendedor||'—',dias:r.dias_atraso||0})),
   ...pagMes.map(r=>({d:r.vencimento,tipo:'P',nome:r.fornecedor||'—',v:+r.saldo||0,cc:r.centro_custo||'—',dias:r.dias_venc||0}))]
   .forEach(x=>{ (porDia[x.d]=porDia[x.d]||[]).push(x); });
  const dias = Object.keys(porDia).sort();

  el('conteudo').innerHTML = `
  <div class="section-head">
    <h2>Hoje</h2>
    <span class="meta">programação de ${fmtData(hojeISO)} a ${fmtData(fimMesISO)} · posição ${fmtData(u.data_base)}</span>
  </div>
  <div class="kpis">
    <div class="kpi ${recHoje-pagHoje>=0?'k-ok':'k-bad'}"><div class="l">Saldo previsto de hoje</div>
      <div class="v" style="color:${recHoje-pagHoje>=0?'var(--ok)':'var(--bad)'}">${BRL(recHoje-pagHoje)}</div>
      <div class="s">vencem hoje: receber ${BRL(recHoje)} − pagar ${BRL(pagHoje)}</div></div>
    <button class="kpi k-click k-ok" id="kpiRecSem"><div class="l">A receber na semana</div><div class="v">${BRL(soma(recSem))}</div><div class="s">${recSem.length} títulos · até ${fmtData(fimSemanaISO)} · clique para ver</div></button>
    <button class="kpi k-click k-bad" id="kpiPagSem"><div class="l">A pagar na semana</div><div class="v">${BRL(soma(pagSem))}</div><div class="s">${pagSem.length} títulos · até ${fmtData(fimSemanaISO)} · clique para ver</div></button>
    <div class="kpi ${soma(recSem)-soma(pagSem)>=0?'k-ok':'k-bad'}"><div class="l">Saldo da semana</div>
      <div class="v" style="color:${soma(recSem)-soma(pagSem)>=0?'var(--ok)':'var(--bad)'}">${BRL(soma(recSem)-soma(pagSem))}</div><div class="s">receber − pagar</div></div>
    <button class="kpi k-click k-ok" id="kpiRecMes"><div class="l">A receber no mês</div><div class="v" style="color:var(--ok)">${BRL(soma(recMes))}</div><div class="s">${recMes.length} títulos · até ${fmtData(fimMesISO)} · clique para ver</div></button>
    <button class="kpi k-click k-bad" id="kpiPagMes"><div class="l">A pagar no mês</div><div class="v">${BRL(soma(pagMes))}</div><div class="s">${pagMes.length} títulos · até ${fmtData(fimMesISO)} · clique para ver</div></button>
    <div class="kpi ${soma(recMes)-soma(pagMes)>=0?'k-ok':'k-bad'}"><div class="l">Saldo do mês</div>
      <div class="v" style="color:${soma(recMes)-soma(pagMes)>=0?'var(--ok)':'var(--bad)'}">${BRL(soma(recMes)-soma(pagMes))}</div><div class="s">receber − pagar</div></div>
    <div class="kpi k-slate"><div class="l">Produção semana · mês</div><div class="v">${NUM(prodSem,0)} · ${NUM(prodMes,0)} cx</div><div class="s">últimos 7 dias · mês até ${corteLabel}</div></div>
    <div class="kpi k-slate"><div class="l">Compras semana · mês</div><div class="v">${NUM(compSem,0)} · ${NUM(compMes,0)} cx</div><div class="s">últimos 7 dias · mês até ${corteLabel}</div></div>
    <div class="kpi ${recUltDia>=pagUltDia?'k-ok':'k-bad'}"><div class="l">Realizado de hoje (caixa)</div>
      <div class="v" style="color:${recUltDia>=pagUltDia?'var(--ok)':'var(--bad)'}">${BRL(recUltDia-pagUltDia)}</div>
      <div class="s">entrou ${BRL(recUltDia)} · saiu ${BRL(pagUltDia)}</div></div>
    <div class="kpi k-gold"><div class="l">Vencido em aberto</div><div class="v" style="color:var(--bad)">${BRL(soma(recVenc))}</div><div class="s">receber · pagar ${BRL(soma(pagVenc))}</div></div>
  </div>

  <div id="chipHoje" class="chip-filtro"></div>

  <div class="two">
    <div class="cardbox">
      <div class="cardbox-head"><h3>Agenda do mês — por dia (R$)</h3><span class="hint">verde = receber · vermelho = pagar</span></div>
      <canvas id="chAgenda" height="110"></canvas>
    </div>
    <div class="cardbox">
      <div class="cardbox-head"><h3>Produção × Compras — últimos 14 dias (cx)</h3><span class="hint">lançamentos até ${corteLabel}</span></div>
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

  // --- KPIs clicáveis: abrem a gaveta com os títulos que compõem o número ---
  const abrirTitulos = (titulo, tipo, itens)=>{
    const rec = tipo==='R';
    abrirOrigem({
      titulo,
      subtitulo: itens.length+' títulos · '+BRL(itens.reduce((s,x)=>s+x.v,0)),
      resumoTop:true,
      colunas: rec ? ['Cliente','Vendedor','Vencimento','Dias atraso','R$ Saldo']
                   : ['Fornecedor','Centro de custo','Vencimento','R$ Saldo'],
      linhas: itens.map(x=> rec
        ? [x.nome, x.vendedor||'—', fmtData(x.d), x.dias||0, x.v]
        : [x.nome, x.cc||'—', fmtData(x.d), x.v]),
      nomeCsv: (rec?'receber-':'pagar-')+titulo.toLowerCase().replace(/[^a-z0-9]+/g,'-')+'.csv'
    });
  };
  el('kpiRecSem').onclick = ()=> abrirTitulos('A receber na semana','R', recSem.map(r=>({d:r.vencimento,nome:r.cliente||'—',v:+r.saldo||0,vendedor:r.vendedor,dias:r.dias_atraso})));
  el('kpiPagSem').onclick = ()=> abrirTitulos('A pagar na semana','P', pagSem.map(r=>({d:r.vencimento,nome:r.fornecedor||'—',v:+r.saldo||0,cc:r.centro_custo,dias:r.dias_venc})));
  el('kpiRecMes').onclick = ()=> abrirTitulos('A receber no mês','R', recMes.map(r=>({d:r.vencimento,nome:r.cliente||'—',v:+r.saldo||0,vendedor:r.vendedor,dias:r.dias_atraso})));
  el('kpiPagMes').onclick = ()=> abrirTitulos('A pagar no mês','P', pagMes.map(r=>({d:r.vencimento,nome:r.fornecedor||'—',v:+r.saldo||0,cc:r.centro_custo,dias:r.dias_venc})));

  // agenda por dia (barras positivas receber, negativas pagar)
  const lblAg = dias.map(dt=>dt.slice(8,10)+'/'+dt.slice(5,7));
  const recAg = dias.map(dt=>porDia[dt].filter(x=>x.tipo==='R').reduce((s,x)=>s+x.v,0));
  const pagAg = dias.map(dt=>-porDia[dt].filter(x=>x.tipo==='P').reduce((s,x)=>s+x.v,0));
  if(!dias.length) el('chAgenda').closest('.cardbox').innerHTML = '<div class="cardbox-head"><h3>Agenda do mês — por dia (R$)</h3></div><div style="color:var(--mut);padding:12px 0">Sem vencimentos programados no período.</div>';
  else criarGraficoInterativo('chAgenda', { type:'bar', data:{ labels:lblAg, datasets:[
    { label:'Receber', data:recAg, backgroundColor:'#16a34a', borderRadius:3, stack:'a' },
    { label:'Pagar', data:pagAg, backgroundColor:'#dc2626', borderRadius:3, stack:'a' },
  ]}, options:{
    interaction:{ mode:'index', intersect:false },
    plugins:{ legend:{ position:'top', labels:{ usePointStyle:true, boxWidth:10 } },
      tooltip:{
        callbacks:{
          // tooltip rico: valor do dia + saldo líquido + 2 maiores do dia
          label: (ctx)=>{
            const dt = dias[ctx.dataIndex];
            const itens = porDia[dt].filter(x=>x.tipo===(ctx.dataset.label==='Receber'?'R':'P'));
            const top2 = [...itens].sort((a,b)=>b.v-a.v).slice(0,2).map(x=>x.nome+' '+BRL(x.v));
            const liq = recAg[ctx.dataIndex]+pagAg[ctx.dataIndex]; // pagAg é negativo
            const base = (ctx.dataset.label==='Receber'?'Receber ':'Pagar ')+BRL(Math.abs(ctx.parsed.y));
            return [base, 'Líquido do dia: '+BRL(liq), ...top2.map(t=>'Top: '+t)];
          }
        }
      }
    },
    scales:{ y:{ ticks:{ callback:v=>'R$ '+(v/1e3).toFixed(0)+'k' } } },
    onClickItem:(i, label, d)=>{
      const dt = dias[i]; if(!dt) return;
      const tipo = d===0 ? 'R' : 'P';
      const itens = porDia[dt].filter(x=>x.tipo===tipo);
      if(!itens.length) return;
      const rec = tipo==='R';
      abrirOrigem({
        titulo:(rec?'A receber':'A pagar')+' de '+fmtData(dt),
        subtitulo: itens.length+' títulos · '+BRL(itens.reduce((s,x)=>s+x.v,0)),
        resumoTop:true,
        colunas: rec ? ['Cliente','Vendedor','Vencimento','Dias atraso','R$ Saldo']
                     : ['Fornecedor','Centro de custo','Vencimento','R$ Saldo'],
        linhas: itens.map(x=> rec
          ? [x.nome, x.vendedor||'—', fmtData(x.d), x.dias||0, x.v]
          : [x.nome, x.cc||'—', fmtData(x.d), x.v]),
        nomeCsv: (rec?'receber-':'pagar-')+dt+'.csv'
      });
    }
  } });
  hintGrafico('chAgenda');

  // produção × compras últimos 14 dias (lançamentos reais)
  const dias14 = [];
  for(let i=13;i>=0;i--){ dias14.push(ISO(new Date(y,m,d-i))); }
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
  criarGraficoInterativo('chSerie', { type:'line', data:{ labels, datasets:[
    { label:'A receber', data:serie.map(r=>r.receber_total), borderColor:'#16a34a', backgroundColor:'rgba(22,163,74,.10)', borderWidth:2.5, tension:.3, pointRadius:3, yAxisID:'y' },
    { label:'A pagar', data:serie.map(r=>r.pagar_total), borderColor:'#f59e0b', backgroundColor:'rgba(245,158,11,.10)', borderWidth:2.5, tension:.3, pointRadius:3, yAxisID:'y' },
    { label:'Receber atrasado', data:serie.map(r=>r.receber_atrasado), borderColor:'#dc2626', backgroundColor:'rgba(220,38,38,.08)', borderWidth:2, borderDash:[4,4], tension:.3, pointRadius:3, yAxisID:'y1' },
  ]}, options:{
    interaction:{ mode:'index', intersect:false },
    plugins:{ legend:{ position:'top', labels:{ usePointStyle:true, boxWidth:10, font:{weight:'600'} } } },
    scales:{
      y:{ position:'left', ticks:{ callback:v=>'R$ '+(v/1e6).toFixed(1)+'M' } },
      y1:{ position:'right', grid:{ drawOnChartArea:false }, ticks:{ color:'#dc2626', callback:v=>'R$ '+(v/1e3).toFixed(0)+'k' } }
    },
    onClickItem:(i)=>{
      const p = serie[i]; if(!p) return;
      const ant = serie[i-1];
      const varTxt = (atual, prev) => {
        if(prev==null || !prev) return 'sem base anterior';
        const dv = atual-prev, dp = 100*dv/prev;
        return (dv>=0?'▲ ':'▼ ')+BRL(Math.abs(dv))+' · '+NUM(Math.abs(dp),1)+'%';
      };
      abrirOrigem({
        titulo:'Posição de '+fmtData(p.data_base),
        subtitulo:'comparativo com o dia anterior da série',
        resumoTop:false,
        colunas:['Indicador','R$ Valor','Variação vs dia anterior'],
        linhas:[
          ['Total a receber', p.receber_total, ant?varTxt(p.receber_total,ant.receber_total):'—'],
          ['Total a pagar', p.pagar_total, ant?varTxt(p.pagar_total,ant.pagar_total):'—'],
          ['Receber atrasado', p.receber_atrasado, ant?varTxt(p.receber_atrasado,ant.receber_atrasado):'—'],
          ['Líquido 30d', p.liquido_30d, ant?varTxt(p.liquido_30d,ant.liquido_30d):'—'],
          ['Títulos a receber', p.receber_n, ant?((p.receber_n-ant.receber_n>=0?'+':'')+(p.receber_n-ant.receber_n)+' tít.'):'—'],
          ['Títulos a pagar', p.pagar_n, ant?((p.pagar_n-ant.pagar_n>=0?'+':'')+(p.pagar_n-ant.pagar_n)+' tít.'):'—'],
        ],
        nomeCsv:'serie-'+p.data_base+'.csv'
      });
    }
  } });
  hintGrafico('chSerie');
}

// ---------- Receber ----------
let chipFaixa = null; // faixa de aging ativa no filtro cruzado
async function abaReceber(){
  chipFaixa = null;
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
  <div class="section-head">
    <h2>Contas a Receber</h2>
    <span class="meta">carteira aberta · base ${fmtData(base)}</span>
    <button id="csvRec" class="btn-sm" style="margin-left:auto">baixar CSV</button>
  </div>
  <div class="kpis">
    <div class="kpi k-gold"><div class="l">Total em aberto</div><div class="v">${BRL(tot)}</div><div class="s">${rs.length} títulos · base ${fmtData(base)}</div></div>
    <div class="kpi k-bad"><div class="l">Vencido</div><div class="v" style="color:var(--bad)">${BRL(venc)}</div><div class="s">${(100*venc/tot).toFixed(1)}% da carteira</div></div>
  </div>
  <div id="chipAging" class="chip-filtro"></div>
  <div class="two">
  <div class="cardbox"><h3>Aging por faixa (R$)</h3><canvas id="chAging"></canvas></div>
  <div class="cardbox"><h3>Top 12 clientes por vencido</h3>
    <table><tr><th>Cliente</th><th class="num">Aberto</th><th class="num">Vencido</th><th class="num">Tít.</th></tr>
    ${top.map(([c,v])=>`<tr><td>${c}</td><td class="num">${BRL(v.tot)}</td><td class="num" style="color:${v.venc>0?'var(--bad)':'inherit'}">${BRL(v.venc)}</td><td class="num">${v.n}</td></tr>`).join('')}
    </table></div>
  </div>
  <div class="cardbox">
    <div class="cardbox-head"><h3>Títulos em aberto</h3><span class="hint" id="recTabHint">${rs.length} títulos</span></div>
    <div class="table-wrap"><table id="tabRecTitulos"><thead><tr><th>Cliente</th><th>Vendedor</th><th>Vencimento</th><th>Faixa</th><th class="num">Saldo</th></tr></thead><tbody>
    ${[...rs].sort((a,b)=>b.dias_atraso-a.dias_atraso).map(r=>`<tr data-faixa="${(r.faixa_aging||'—').replace(/"/g,'&quot;')}"><td>${r.cliente||'—'}</td><td>${r.vendedor||'—'}</td><td>${fmtData(r.vencimento)}</td><td><span class="badge ${r.dias_atraso>0?'r':'g'}">${r.faixa_aging||'—'}</span></td><td class="num">${BRL(+r.saldo||0)}</td></tr>`).join('')}
    </tbody></table></div>
  </div>`;
  // aging: tooltip rico + filtro cruzado + gaveta por cliente
  const corFaixa = '#ffd400';
  criarGraficoInterativo('chAging', { type:'bar', data:{ labels:ordF.map(x=>x[0]), datasets:[{ label:'Saldo (R$)', data:ordF.map(x=>x[1]), backgroundColor:corFaixa }] },
    options:{
      plugins:{ legend:{display:false},
        tooltip:{ callbacks:{
          label: (ctx)=>{
            const faixa = ordF[ctx.dataIndex][0];
            const nTit = rs.filter(r=>(r.faixa_aging||'—')===faixa).length;
            const pct = 100*ctx.parsed.y/tot;
            return ['Valor: '+BRL(ctx.parsed.y), pct.toFixed(1)+'% da carteira', nTit+' títulos'];
          }
        } }
      },
      scales:{ y:{ ticks:{ callback:v=>'R$ '+(v/1e3).toFixed(0)+'k' } }, x:{ ticks:{ autoSkip:false, font:{size:10} } } },
      onClickItem:(i, label)=>{
        const faixa = ordF[i][0];
        const jaAtiva = chipFaixa===faixa;
        // limpa filtro anterior
        chipFaixa = null;
        renderChipFiltro('chipAging', null);
        document.querySelectorAll('#tabRecTitulos tbody tr').forEach(tr=>tr.style.display='');
        const g = Chart.getChart(el('chAging'));
        if(g) g.data.datasets[0].backgroundColor = corFaixa;
        if(jaAtiva){ return; } // segundo clique no mesmo: só limpa
        // aplica filtro
        chipFaixa = faixa;
        const naFaixa = rs.filter(r=>(r.faixa_aging||'—')===faixa);
        document.querySelectorAll('#tabRecTitulos tbody tr').forEach(tr=>{ tr.style.display = tr.getAttribute('data-faixa')===faixa ? '' : 'none'; });
        el('recTabHint').textContent = naFaixa.length+' títulos na faixa '+faixa;
        renderChipFiltro('chipAging', 'Faixa: '+faixa+' · '+BRL(naFaixa.reduce((s,r)=>s+(+r.saldo||0),0)), ()=>{
          chipFaixa = null;
          document.querySelectorAll('#tabRecTitulos tbody tr').forEach(tr=>tr.style.display='');
          el('recTabHint').textContent = rs.length+' títulos';
          const g2 = Chart.getChart(el('chAging'));
          if(g2) g2.data.datasets[0].backgroundColor = corFaixa, g2.update();
        });
        // destaca a barra clicada (opacidade nas outras)
        const g3 = Chart.getChart(el('chAging'));
        if(g3){
          g3.data.datasets[0].backgroundColor = ordF.map((x,j)=> j===i ? corFaixa : 'rgba(255,212,0,.35)');
          g3.update();
        }
      }
    } });
  hintGrafico('chAging');
  // duplo clique na faixa: gaveta agrupada por cliente
  el('chAging').addEventListener('dblclick', ()=>{
    if(chipFaixa==null) return;
    abrirFaixaGaveta();
  });
  function abrirFaixaGaveta(){
    const naFaixa = rs.filter(r=>(r.faixa_aging||'—')===chipFaixa);
    const porC = {};
    naFaixa.forEach(r=>{ const c=r.cliente||'—'; porC[c]=porC[c]||{tot:0,n:0}; porC[c].tot+=+r.saldo||0; porC[c].n++; });
    const linhas = Object.entries(porC).sort((a,b)=>b[1].tot-a[1].tot).map(([c,v])=>[c, v.tot, v.n]);
    abrirOrigem({
      titulo:'Faixa '+chipFaixa+' — por cliente',
      subtitulo: naFaixa.length+' títulos · '+BRL(naFaixa.reduce((s,r)=>s+(+r.saldo||0),0)),
      resumoTop:true,
      colunas:['Cliente','R$ Saldo na faixa','Títulos'],
      linhas,
      nomeCsv:'faixa-'+chipFaixa.replace(/[^a-z0-9]+/gi,'-')+'-por-cliente.csv'
    });
  }
  el('csvRec').onclick = () => baixarCSV('a-receber.csv',[['Cliente','Vendedor','Vencimento','Faixa','Saldo','Dias atraso'],...rs.map(r=>[r.cliente,r.vendedor,r.vencimento,r.faixa_aging,(+r.saldo).toFixed(2),r.dias_atraso])]);
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
  <div class="section-head">
    <h2>Contas a Pagar</h2>
    <span class="meta">compromissos em aberto · base ${fmtData(base)}</span>
    <button id="csvPag" class="btn-sm" style="margin-left:auto">baixar CSV</button>
  </div>
  <div class="kpis">
    <div class="kpi k-gold"><div class="l">Total em aberto</div><div class="v">${BRL(tot)}</div><div class="s">${rs.length} títulos · base ${fmtData(base)}</div></div>
    <div class="kpi k-bad"><div class="l">Vencido</div><div class="v" style="color:var(--bad)">${BRL(venc)}</div><div class="s">${(100*venc/tot).toFixed(1)}% do total</div></div>
  </div>
  <div id="chipCC" class="chip-filtro"></div>
  <div class="two">
  <div class="cardbox"><h3>Top 10 centros de custo (R$)</h3><canvas id="chCC"></canvas></div>
  <div class="cardbox"><h3>Top 12 fornecedores</h3>
    <table><tr><th>Fornecedor</th><th class="num">Aberto</th><th class="num">Vencido</th><th class="num">Tít.</th></tr>
    ${fOrd.map(([f,v])=>`<tr><td>${f}</td><td class="num">${BRL(v.tot)}</td><td class="num" style="color:${v.venc>0?'var(--bad)':'inherit'}">${BRL(v.venc)}</td><td class="num">${v.n}</td></tr>`).join('')}
    </table></div>
  </div>
  <div class="cardbox">
    <div class="cardbox-head"><h3>Títulos a pagar</h3><span class="hint" id="pagTabHint">${rs.length} títulos</span></div>
    <div class="table-wrap"><table id="tabPagTitulos"><thead><tr><th>Fornecedor</th><th>Centro de custo</th><th>Vencimento</th><th class="num">Saldo</th></tr></thead><tbody>
    ${[...rs].sort((a,b)=>b.dias_venc-a.dias_venc).map(r=>`<tr data-cc="${(r.centro_custo||'Não Classificado').replace(/"/g,'&quot;')}"><td>${r.fornecedor||'—'}</td><td>${r.centro_custo||'Não Classificado'}</td><td>${fmtData(r.vencimento)}</td><td class="num">${BRL(+r.saldo||0)}</td></tr>`).join('')}
    </tbody></table></div>
  </div>`;
  // centro de custo: tooltip rico + filtro cruzado com toggle
  const corCC = '#ffd400';
  let ccAtivo = null;
  criarGraficoInterativo('chCC', { type:'bar', data:{ labels:ccOrd.map(x=>x[0]), datasets:[{ label:'Saldo (R$)', data:ccOrd.map(x=>x[1].tot), backgroundColor:corCC }] },
    options:{
      indexAxis:'y',
      plugins:{ legend:{display:false},
        tooltip:{ callbacks:{
          label: (ctx)=>{
            const cc = ccOrd[ctx.dataIndex][0];
            const doCC = rs.filter(r=>(r.centro_custo||'Não Classificado')===cc);
            const pct = 100*ctx.parsed.x/tot;
            const forn = [...doCC.reduce((m,r)=>{ const f=r.fornecedor||'—'; m.set(f,(m.get(f)||0)+(+r.saldo||0)); return m; }, new Map())]
              .sort((a,b)=>b[1]-a[1])[0];
            return ['Valor: '+BRL(ctx.parsed.x), pct.toFixed(1)+'% do total a pagar', 'Principal: '+forn[0]+' ('+BRL(forn[1])+')', doCC.length+' títulos'];
          }
        } }
      },
      scales:{ x:{ ticks:{ callback:v=>'R$ '+(v/1e3).toFixed(0)+'k' } } },
      onClickItem:(i, label)=>{
        const cc = ccOrd[i][0];
        const jaAtivo = ccAtivo===cc;
        // limpa estado anterior
        ccAtivo = null;
        renderChipFiltro('chipCC', null);
        document.querySelectorAll('#tabPagTitulos tbody tr').forEach(tr=>tr.style.display='');
        const g = Chart.getChart(el('chCC'));
        if(g) g.data.datasets[0].backgroundColor = corCC;
        if(jaAtivo){ return; } // segundo clique no mesmo: só limpa
        // aplica filtro
        ccAtivo = cc;
        const doCC = rs.filter(r=>(r.centro_custo||'Não Classificado')===cc);
        document.querySelectorAll('#tabPagTitulos tbody tr').forEach(tr=>{ tr.style.display = tr.getAttribute('data-cc')===cc ? '' : 'none'; });
        el('pagTabHint').textContent = doCC.length+' títulos em '+cc;
        renderChipFiltro('chipCC', 'Centro de custo: '+cc+' · '+BRL(doCC.reduce((s,r)=>s+(+r.saldo||0),0)), ()=>{
          ccAtivo = null;
          document.querySelectorAll('#tabPagTitulos tbody tr').forEach(tr=>tr.style.display='');
          el('pagTabHint').textContent = rs.length+' títulos';
          const g2 = Chart.getChart(el('chCC'));
          if(g2) g2.data.datasets[0].backgroundColor = corCC, g2.update();
        });
        // destaca a barra selecionada
        const g3 = Chart.getChart(el('chCC'));
        if(g3){
          g3.data.datasets[0].backgroundColor = ccOrd.map((x,j)=> j===i ? corCC : 'rgba(255,212,0,.35)');
          g3.update();
        }
      }
    } });
  hintGrafico('chCC');
  el('csvPag').onclick = () => baixarCSV('a-pagar.csv',[['Fornecedor','Vencimento','Centro custo','Saldo','Dias venc'],...rs.map(r=>[r.fornecedor,r.vencimento,r.centro_custo,(+r.saldo).toFixed(2),r.dias_venc])]);
}