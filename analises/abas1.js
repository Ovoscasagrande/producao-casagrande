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
  criarGraficoInterativo('chProdComp', { type:'bar', data:{ labels:dias14.map(dt=>dt.slice(8,10)+'/'+dt.slice(5,7)), datasets:[
    { label:'Produção', data:prodD, backgroundColor:'#f59e0b', borderRadius:3 },
    { label:'Compras', data:compD, backgroundColor:'#0ea5e9', borderRadius:3 },
  ]}, options:{
    interaction:{ mode:'index', intersect:false },
    plugins:{ legend:{ position:'top', labels:{ usePointStyle:true, boxWidth:10 } },
      tooltip:{ callbacks:{
        // tooltip: produção/compras do dia + variação % vs dia anterior (respeita corte maxDataPC)
        label: (ctx)=>{
          const i = ctx.dataIndex;
          const val = ctx.parsed.y;
          const ant = i>0 ? (ctx.datasetIndex===0?prodD[i-1]:compD[i-1]) : null;
          const dv = (ant!=null && ant) ? (100*(val-ant)/ant) : null;
          const base = (ctx.datasetIndex===0?'Produção: ':'Compras (cx 360): ')+NUM(val,0)+' cx';
          return dv==null ? [base] : [base, 'vs dia anterior: '+(dv>=0?'▲':'▼')+' '+NUM(Math.abs(dv),1)+'%'];
        }
      } }
    },
    scales:{ y:{ beginAtZero:true } },
    onClickItem:(i, label, d)=>{
      const dt = dias14[i]; if(!dt) return;
      const rec = d===0;
      const rows = rec ? prod : comp;
      const doDia = rows.filter(r=>r.data===dt);
      if(!doDia.length){ status('Sem lançamentos de '+(rec?'produção':'compras')+' em '+fmtData(dt)+'.'); setTimeout(()=>status(null),1800); return; }
      const totDia = doDia.reduce((s,r)=>s+(+r.caixas||0),0);
      // ranking agrupado (produto ou granja) com % de participação
      const porChave = {};
      doDia.forEach(r=>{ const k = rec ? (r.apresentacao||'—') : (r.granja||'—'); porChave[k]=(porChave[k]||0)+(+r.caixas||0); });
      const rank = Object.entries(porChave).sort((a,b)=>b[1]-a[1]).map(([k,v])=>[k, v, totDia?+(100*v/totDia).toFixed(1):0]);
      abrirOrigem({
        titulo:(rec?'Produção':'Compras (cx 360)')+' de '+fmtData(dt),
        subtitulo: NUM(totDia,1)+' cx · '+doDia.length+' lançamentos',
        resumoTop:true,
        colunas: rec ? ['Apresentação','Caixas','% Part.'] : ['Granja','Caixas (360)','% Conc.'],
        linhas: rank,
        nomeCsv:(rec?'producao-':'compras-')+dt+'.csv'
      });
    }
  } });
  hintGrafico('chProdComp');

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
// ---------- seletor de período (Receber/Pagar) ----------
const PERIODOS = [
  ['hoje','Hoje'],['amanha','Amanhã'],['semana','Até sexta'],['prox7','Próx. 7 dias'],
  ['mes','Este mês'],['prox30','Próx. 30 dias'],['tudo','Tudo']
];
function dataDe(d){ return d ? d.split('-').reverse().join('/') : '—'; }
function janelaPeriodo(tipo, base){
  // base = data_base da carteira (YYYY-MM-DD); retorna [de, ate] em ISO ou null
  const b = new Date(base + 'T12:00:00');
  const iso = d => d.toISOString().slice(0,10);
  const add = (n)=>{ const x = new Date(b); x.setDate(x.getDate()+n); return x; };
  switch(tipo){
    case 'hoje':   return [base, base];
    case 'amanha': return [iso(add(1)), iso(add(1))];
    case 'semana': { // hoje até sexta (se hoje for sáb/dom, até a próxima sexta)
      let ate = new Date(b);
      const dow = ate.getDay(); // 5=sexta
      if(dow <= 5) ate = add(5 - dow); else ate = add(5 + 7 - dow);
      return [base, iso(ate)];
    }
    case 'prox7':  return [base, iso(add(7))];
    case 'mes':    { const fim = new Date(b.getFullYear(), b.getMonth()+1, 0); return [base, iso(fim)]; }
    case 'prox30': return [base, iso(add(30))];
    default:       return [null, null]; // tudo
  }
}
function noPeriodo(r, campo, de, ate){
  const v = r[campo];
  if(!v) return false;
  if(de && v < de) return false;
  if(ate && v > ate) return false;
  return true;
}
function seletorPeriodoHTML(id){
  return '<div class="periodo-bar" id="'+id+'">' + PERIODOS.map(([k,l]) =>
    '<button data-p="'+k+'" class="per-btn'+(k==='tudo'?' on':'')+'">'+l+'</button>').join('') + '</div>';
}
function ligarSeletorPeriodo(id, aoMudar){
  let ativo = 'tudo';
  el(id).querySelectorAll('.per-btn').forEach(b=>{
    b.onclick = ()=>{
      ativo = b.getAttribute('data-p');
      el(id).querySelectorAll('.per-btn').forEach(x=>x.classList.toggle('on', x===b));
      aoMudar(ativo);
    };
  });
  return ()=> ativo;
}

async function abaReceber(){
  chipFaixa = null;
  const rows = await carregar('ovos_receber');
  const base = ultimaBase(rows);
  const rsBase = rows.filter(r=>r.data_base===base);
  el('conteudo').innerHTML = `
  <div class="section-head">
    <h2>Contas a Receber</h2>
    <span class="meta">carteira aberta · base ${fmtData(base)}</span>
    <button id="csvRec" class="btn-sm" style="margin-left:auto">baixar CSV</button>
  </div>
  <div class="cardbox" style="padding:12px 14px">
    <div style="font-size:11px;color:var(--mut);font-weight:700;text-transform:uppercase;letter-spacing:.4px;margin-bottom:8px">Período de vencimento</div>
    ${seletorPeriodoHTML('perRec')}
    <div id="recResumo" style="margin-top:10px;font-size:13px"></div>
  </div>
  <div class="kpis" id="kpisRec"></div>
  <div id="chipAging" class="chip-filtro"></div>
  <div class="two">
  <div class="cardbox"><h3>Aging por faixa (R$)</h3><canvas id="chAging"></canvas></div>
  <div class="cardbox"><h3 id="recTopH3">Top 12 clientes por vencido</h3>
    <table><tr><th>Cliente</th><th class="num">Aberto</th><th class="num">Vencido</th><th class="num">Tít.</th></tr>
    <tbody id="recTopBody"></tbody></table></div>
  </div>
  <div class="cardbox">
    <div class="cardbox-head"><h3>Títulos em aberto</h3><span class="hint" id="recTabHint"></span></div>
    <div class="table-wrap"><table id="tabRecTitulos"><thead><tr><th>Cliente</th><th>Vendedor</th><th>Vencimento</th><th>Faixa</th><th class="num">Saldo</th></tr></thead><tbody id="recTabBody"></tbody></table></div>
  </div>`;
  const corFaixa = '#ffd400';
  let RS = rsBase; // títulos no período selecionado

  function render(sep){
    const rs = RS;
    const tot = rs.reduce((s,r)=>s+(+r.saldo||0),0);
    const venc = rs.filter(r=>r.dias_atraso>0).reduce((s,r)=>s+(+r.saldo||0),0);
    // KPIs
    el('kpisRec').innerHTML = `
      <button class="kpi k-click k-gold" id="kRecTot"><div class="l">Total no período</div><div class="v">${BRL(tot)}</div><div class="s">${rs.length} títulos · clique p/ ver todos</div></button>
      <div class="kpi k-bad"><div class="l">Vencido no período</div><div class="v" style="color:var(--bad)">${BRL(venc)}</div><div class="s">${tot?(100*venc/tot).toFixed(1):'0'}% do período</div></div>`;
    el('kRecTot').onclick = ()=> abrirOrigem({
      titulo:'Recebíveis do período', subtitulo: BRL(tot)+' · '+rs.length+' títulos',
      resumoTop:true, colunas:['Vencimento','Cliente','Vendedor','Saldo','Dias atraso'],
      linhas: [...rs].sort((a,b)=>(a.vencimento||'').localeCompare(b.vencimento||'')).map(r=>[fmtData(r.vencimento), r.cliente||'—', r.vendedor||'—', +r.saldo||0, r.dias_atraso]),
      nomeCsv:'receber-periodo.csv'
    });
    // aging
    const faixas = {};
    rs.forEach(r=>{ const f = r.faixa_aging||'—'; faixas[f]=(faixas[f]||0)+(+r.saldo||0); });
    const ordF = Object.entries(faixas).sort((a,b)=> a[0].localeCompare(b[0]));
    criarGraficoInterativo('chAging', { type:'bar', data:{ labels:ordF.map(x=>x[0]), datasets:[{ label:'Saldo (R$)', data:ordF.map(x=>x[1]), backgroundColor:corFaixa }] },
      options:{
        plugins:{ legend:{display:false},
          tooltip:{ callbacks:{
            label: (ctx)=>{
              const faixa = ordF[ctx.dataIndex][0];
              const nTit = rs.filter(r=>(r.faixa_aging||'—')===faixa).length;
              const pct = tot ? 100*ctx.parsed.y/tot : 0;
              return ['Valor: '+BRL(ctx.parsed.y), pct.toFixed(1)+'% do período', nTit+' títulos'];
            }
          } }
        },
        scales:{ y:{ ticks:{ callback:v=>'R$ '+(v/1e3).toFixed(0)+'k' } }, x:{ ticks:{ autoSkip:false, font:{size:10} } } },
        onClickItem:(i, label)=>{
          const faixa = ordF[i][0];
          const jaAtiva = chipFaixa===faixa;
          chipFaixa = null;
          renderChipFiltro('chipAging', null);
          document.querySelectorAll('#tabRecTitulos tbody tr').forEach(tr=>tr.style.display='');
          const g = Chart.getChart(el('chAging'));
          if(g) g.data.datasets[0].backgroundColor = corFaixa;
          if(jaAtiva){ return; }
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
          const g3 = Chart.getChart(el('chAging'));
          if(g3){
            g3.data.datasets[0].backgroundColor = ordF.map((x,j)=> j===i ? corFaixa : 'rgba(255,212,0,.35)');
            g3.update();
          }
        }
      } });
    hintGrafico('chAging');
    // top clientes
    const porCli = {};
    rs.forEach(r=>{ const c=r.cliente||'—'; porCli[c]=porCli[c]||{tot:0,venc:0,n:0}; porCli[c].tot+=+r.saldo||0; if(r.dias_atraso>0) porCli[c].venc+=+r.saldo||0; porCli[c].n++; });
    const top = Object.entries(porCli).sort((a,b)=>b[1].venc-a[1].venc).slice(0,12);
    el('recTopBody').innerHTML = top.map(([c,v])=>`<tr style="cursor:pointer" data-cli="${c.replace(/"/g,'&quot;')}"><td>${c}</td><td class="num">${BRL(v.tot)}</td><td class="num" style="color:${v.venc>0?'var(--bad)':'inherit'}">${BRL(v.venc)}</td><td class="num">${v.n}</td></tr>`).join('');
    [...el('recTopBody').querySelectorAll('tr')].forEach((tr,i)=>{ tr.onclick = ()=> gavetaCliente(top[i][0]); });
    // tabela
    el('recTabBody').innerHTML = [...rs].sort((a,b)=>b.dias_atraso-a.dias_atraso).map(r=>`<tr data-faixa="${(r.faixa_aging||'—').replace(/"/g,'&quot;')}"><td>${r.cliente||'—'}</td><td>${r.vendedor||'—'}</td><td>${fmtData(r.vencimento)}</td><td><span class="badge ${r.dias_atraso>0?'r':'g'}">${r.faixa_aging||'—'}</span></td><td class="num">${BRL(+r.saldo||0)}</td></tr>`).join('');
    el('recTabHint').textContent = rs.length+' títulos';
  }
  function gavetaCliente(nome){
    const doCli = RS.filter(r=>(r.cliente||'—')===nome);
    abrirOrigem({
      titulo:'Recebíveis de '+nome, subtitulo: BRL(doCli.reduce((s,r)=>s+(+r.saldo||0),0))+' · '+doCli.length+' títulos',
      resumoTop:true, colunas:['Vencimento','Título','Pedido','Saldo','Dias atraso'],
      linhas: doCli.sort((a,b)=>(a.vencimento||'').localeCompare(b.vencimento||'')).map(r=>[fmtData(r.vencimento), r.titulo||'—', r.pedido||'—', +r.saldo||0, r.dias_atraso]),
      nomeCsv:'receber-cliente.csv'
    });
  }
  ligarSeletorPeriodo('perRec', (p)=>{
    const [de, ate] = janelaPeriodo(p, base);
    RS = rsBase.filter(r=>noPeriodo(r, 'vencimento', de, ate));
    const tot = RS.reduce((s,r)=>s+(+r.saldo||0),0);
    const lbl = PERIODOS.find(x=>x[0]===p)[1];
    el('recResumo').innerHTML = de
      ? `💰 <b>${BRL(tot)}</b> para receber entre <b>${dataDe(de)}</b> e <b>${dataDe(ate)}</b> — ${RS.length} títulos`
      : `💰 <b>${BRL(tot)}</b> no total da carteira — ${RS.length} títulos`;
    render();
  });
  el('csvRec').onclick = () => baixarCSV('a-receber.csv',[['Cliente','Vendedor','Vencimento','Faixa','Saldo','Dias atraso'],...RS.map(r=>[r.cliente,r.vendedor,r.vencimento,r.faixa_aging,(+r.saldo).toFixed(2),r.dias_atraso])]);
  // estado inicial: tudo
  el('perRec').querySelector('[data-p="tudo"]').click();
}

async function abaPagar(){
  const rows = await carregar('ovos_pagar');
  const base = ultimaBase(rows);
  const rsBase = rows.filter(r=>r.data_base===base);
  el('conteudo').innerHTML = `
  <div class="section-head">
    <h2>Contas a Pagar</h2>
    <span class="meta">compromissos em aberto · base ${fmtData(base)}</span>
    <button id="csvPag" class="btn-sm" style="margin-left:auto">baixar CSV</button>
  </div>
  <div class="cardbox" style="padding:12px 14px">
    <div style="font-size:11px;color:var(--mut);font-weight:700;text-transform:uppercase;letter-spacing:.4px;margin-bottom:8px">Período de vencimento</div>
    ${seletorPeriodoHTML('perPag')}
    <div id="pagResumo" style="margin-top:10px;font-size:13px"></div>
  </div>
  <div class="kpis" id="kpisPag"></div>
  <div id="chipCC" class="chip-filtro"></div>
  <div class="two">
  <div class="cardbox"><h3>Top 10 centros de custo (R$)</h3><canvas id="chCC"></canvas></div>
  <div class="cardbox"><h3>Top 12 fornecedores</h3>
    <table><tr><th>Fornecedor</th><th class="num">Aberto</th><th class="num">Vencido</th><th class="num">Tít.</th></tr>
    <tbody id="pagTopBody"></tbody></table></div>
  </div>
  <div class="cardbox">
    <div class="cardbox-head"><h3>Títulos a pagar</h3><span class="hint" id="pagTabHint"></span></div>
    <div class="table-wrap"><table id="tabPagTitulos"><thead><tr><th>Fornecedor</th><th>Centro de custo</th><th>Vencimento</th><th class="num">Saldo</th></tr></thead><tbody id="pagTabBody"></tbody></table></div>
  </div>`;
  const corCC = '#ffd400';
  let ccAtivo = null;
  let RS = rsBase;

  function render(){
    const rs = RS;
    const tot = rs.reduce((s,r)=>s+(+r.saldo||0),0);
    const venc = rs.filter(r=>r.dias_venc>0).reduce((s,r)=>s+(+r.saldo||0),0);
    el('kpisPag').innerHTML = `
      <button class="kpi k-click k-gold" id="kPagTot"><div class="l">Total no período</div><div class="v">${BRL(tot)}</div><div class="s">${rs.length} títulos · clique p/ ver todos</div></button>
      <div class="kpi k-bad"><div class="l">Vencido no período</div><div class="v" style="color:var(--bad)">${BRL(venc)}</div><div class="s">${tot?(100*venc/tot).toFixed(1):'0'}% do período</div></div>`;
    el('kPagTot').onclick = ()=> abrirOrigem({
      titulo:'Pagamentos do período', subtitulo: BRL(tot)+' · '+rs.length+' títulos',
      resumoTop:true, colunas:['Vencimento','Fornecedor','Centro de custo','Saldo','Dias venc'],
      linhas: [...rs].sort((a,b)=>(a.vencimento||'').localeCompare(b.vencimento||'')).map(r=>[fmtData(r.vencimento), r.fornecedor||'—', r.centro_custo||'—', +r.saldo||0, r.dias_venc]),
      nomeCsv:'pagar-periodo.csv'
    });
    const porCC = {}, porForn = {};
    rs.forEach(r=>{
      const cc = r.centro_custo||'Não Classificado';
      porCC[cc]=porCC[cc]||{tot:0,n:0}; porCC[cc].tot+=+r.saldo||0; porCC[cc].n++;
      const f = r.fornecedor||'—';
      porForn[f]=porForn[f]||{tot:0,venc:0,n:0}; porForn[f].tot+=+r.saldo||0; if(r.dias_venc>0) porForn[f].venc+=+r.saldo||0; porForn[f].n++;
    });
    const ccOrd = Object.entries(porCC).sort((a,b)=>b[1].tot-a[1].tot).slice(0,10);
    const fOrd = Object.entries(porForn).sort((a,b)=>b[1].tot-a[1].tot).slice(0,12);
    criarGraficoInterativo('chCC', { type:'bar', data:{ labels:ccOrd.map(x=>x[0]), datasets:[{ label:'Saldo (R$)', data:ccOrd.map(x=>x[1].tot), backgroundColor:corCC }] },
      options:{
        indexAxis:'y',
        plugins:{ legend:{display:false},
          tooltip:{ callbacks:{
            label: (ctx)=>{
              const cc = ccOrd[ctx.dataIndex][0];
              const doCC = rs.filter(r=>(r.centro_custo||'Não Classificado')===cc);
              const pct = tot ? 100*ctx.parsed.x/tot : 0;
              const forn = [...doCC.reduce((m,r)=>{ const f=r.fornecedor||'—'; m.set(f,(m.get(f)||0)+(+r.saldo||0)); return m; }, new Map())]
                .sort((a,b)=>b[1]-a[1])[0];
              return ['Valor: '+BRL(ctx.parsed.x), pct.toFixed(1)+'% do período', 'Principal: '+forn[0]+' ('+BRL(forn[1])+')', doCC.length+' títulos'];
            }
          } }
        },
        scales:{ x:{ ticks:{ callback:v=>'R$ '+(v/1e3).toFixed(0)+'k' } } },
        onClickItem:(i, label)=>{
          const cc = ccOrd[i][0];
          const jaAtivo = ccAtivo===cc;
          ccAtivo = null;
          renderChipFiltro('chipCC', null);
          document.querySelectorAll('#tabPagTitulos tbody tr').forEach(tr=>tr.style.display='');
          const g = Chart.getChart(el('chCC'));
          if(g) g.data.datasets[0].backgroundColor = corCC;
          if(jaAtivo){ return; }
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
          const g3 = Chart.getChart(el('chCC'));
          if(g3){
            g3.data.datasets[0].backgroundColor = ccOrd.map((x,j)=> j===i ? corCC : 'rgba(255,212,0,.35)');
            g3.update();
          }
        }
      } });
    hintGrafico('chCC');
    el('pagTopBody').innerHTML = fOrd.map(([f,v])=>`<tr style="cursor:pointer" data-forn="${f.replace(/"/g,'&quot;')}"><td>${f}</td><td class="num">${BRL(v.tot)}</td><td class="num" style="color:${v.venc>0?'var(--bad)':'inherit'}">${BRL(v.venc)}</td><td class="num">${v.n}</td></tr>`).join('');
    [...el('pagTopBody').querySelectorAll('tr')].forEach((tr,i)=>{ tr.onclick = ()=> gavetaForn(fOrd[i][0]); });
    el('pagTabBody').innerHTML = [...rs].sort((a,b)=>b.dias_venc-a.dias_venc).map(r=>`<tr data-cc="${(r.centro_custo||'Não Classificado').replace(/"/g,'&quot;')}"><td>${r.fornecedor||'—'}</td><td>${r.centro_custo||'Não Classificado'}</td><td>${fmtData(r.vencimento)}</td><td class="num">${BRL(+r.saldo||0)}</td></tr>`).join('');
    el('pagTabHint').textContent = rs.length+' títulos';
  }
  function gavetaForn(nome){
    const doF = RS.filter(r=>(r.fornecedor||'—')===nome);
    abrirOrigem({
      titulo:'Pagamentos a '+nome, subtitulo: BRL(doF.reduce((s,r)=>s+(+r.saldo||0),0))+' · '+doF.length+' títulos',
      resumoTop:true, colunas:['Vencimento','NF','Referência','Saldo','Dias venc'],
      linhas: doF.sort((a,b)=>(a.vencimento||'').localeCompare(b.vencimento||'')).map(r=>[fmtData(r.vencimento), r.nf||'—', r.referencia||'—', +r.saldo||0, r.dias_venc]),
      nomeCsv:'pagar-fornecedor.csv'
    });
  }
  ligarSeletorPeriodo('perPag', (p)=>{
    const [de, ate] = janelaPeriodo(p, base);
    RS = rsBase.filter(r=>noPeriodo(r, 'vencimento', de, ate));
    const tot = RS.reduce((s,r)=>s+(+r.saldo||0),0);
    const lbl = PERIODOS.find(x=>x[0]===p)[1];
    el('pagResumo').innerHTML = de
      ? `💸 <b>${BRL(tot)}</b> para pagar entre <b>${dataDe(de)}</b> e <b>${dataDe(ate)}</b> — ${RS.length} títulos`
      : `💸 <b>${BRL(tot)}</b> no total em aberto — ${RS.length} títulos`;
    render();
  });
  el('csvPag').onclick = () => baixarCSV('a-pagar.csv',[['Fornecedor','Vencimento','Centro custo','Saldo','Dias venc'],...RS.map(r=>[r.fornecedor,r.vencimento,r.centro_custo,(+r.saldo).toFixed(2),r.dias_venc])]);
  el('perPag').querySelector('[data-p="tudo"]').click();
}