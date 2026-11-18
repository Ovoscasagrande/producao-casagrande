// ---------- Produção ----------
async function abaProducao(){
  const rows = await carregar('ovos_producao','ano,mes,data,apresentacao,caixas');
  const porAnoMes = {};
  rows.forEach(r=>{ const k=`${r.ano}-${String(r.mes).padStart(2,'0')}`; porAnoMes[k]=porAnoMes[k]||{2025:0,2026:0}; porAnoMes[k][r.ano]+=+r.caixas||0; });
  const meses = Object.keys(porAnoMes).sort();
  const ap26 = {};
  rows.filter(r=>r.ano===2026).forEach(r=>{ ap26[r.apresentacao||'—']=(ap26[r.apresentacao||'—']||0)+(+r.caixas||0); });
  const apOrd = Object.entries(ap26).sort((a,b)=>b[1]-a[1]).slice(0,10);
  // comparativo no MESMO período: 2025 cortado no mesmo dia/mês do último lançamento de 2026
  const max26 = rows.filter(r=>r.ano===2026).reduce((mx,r)=> (r.data && r.data>mx) ? r.data : mx, '');
  const corte25 = max26 ? String(new Date().getFullYear()-1) + max26.slice(4) : '';
  const tot25 = rows.filter(r=>r.ano===2025 && (!corte25 || r.data<=corte25)).reduce((s,r)=>s+(+r.caixas||0),0);
  const tot26 = rows.filter(r=>r.ano===2026).reduce((s,r)=>s+(+r.caixas||0),0);
  const corteLabel = max26 ? ' até '+fmtData(max26) : '';
  el('conteudo').innerHTML = `
  <div class="section-head">
    <h2>Produção (Embalagem &amp; Classificação)</h2>
    <span class="meta">Comparativo anual em caixas</span>
  </div>
  <div class="kpis">
    <div class="kpi k-slate"><div class="l">Produção 2025</div><div class="v">${NUM(tot25,1)} cx</div><div class="s">mesmo período${corteLabel}</div></div>
    <div class="kpi k-gold"><div class="l">Produção 2026</div><div class="v" style="color:#d97706">${NUM(tot26,1)} cx</div><div class="s">até ${fmtData(max26)||'—'}</div></div>
    <div class="kpi k-ok"><div class="l">Variação</div><div class="v" style="color:${tot26>=tot25?'var(--ok)':'var(--bad)'}">${tot25?((tot26/tot25-1)*100).toFixed(1)+'%':'—'}</div><div class="s">mesmo período${corteLabel}</div></div>
  </div>
  <div class="two">
    <div class="cardbox"><h3>Caixas produzidas por mês</h3><canvas id="chProdMes"></canvas></div>
    <div class="cardbox"><h3>Top 10 apresentações 2026</h3>
      ${apOrd.length ? apOrd.map(([nome,val])=>{
        const max = apOrd[0][1] || 1;
        return `<div style="margin-bottom:7px">
          <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:2px"><span>${nome}</span><b>${NUM(val,0)}</b></div>
          <div style="height:8px;background:#f1f5f9;border-radius:4px"><div style="height:8px;width:${(100*val/max).toFixed(1)}%;background:#f59e0b;border-radius:4px"></div></div>
        </div>`;
      }).join('') : '<div style="color:var(--mut);padding:8px 0">Sem dados de 2026 — verificar carga.</div>'}
      <button class="btn-sm" style="margin-top:8px" onclick="baixarCSV('producao-2026.csv',[['Apresentação','Caixas'],...apOrd.map(x=>[x[0],x[1].toFixed(3)])])">baixar CSV</button>
    </div>
  </div>`;
  if(!meses.length) el('chProdMes').closest('.cardbox').innerHTML = '<h3>Caixas produzidas por mês</h3><div style="color:var(--mut);padding:8px 0">Sem dados — verificar carga.</div>';
  else new Chart(el('chProdMes'), { type:'bar', data:{ labels:meses, datasets:[
    { label:'2025', data:meses.map(m=>porAnoMes[m][2025]), backgroundColor:'#94a3b8', borderRadius:5 },
    { label:'2026', data:meses.map(m=>porAnoMes[m][2026]), backgroundColor:'#f59e0b', borderRadius:5 },
  ]}, options:{ plugins:{ legend:{ labels:{ usePointStyle:true, boxWidth:10 } } } } });
}

// ---------- Compras ----------
async function abaCompras(){
  const rows = await carregar('ovos_compras','ano,mes,data,granja,caixas');
  const porAnoMes = {};
  rows.forEach(r=>{ const k=`${r.ano}-${String(r.mes).padStart(2,'0')}`; porAnoMes[k]=porAnoMes[k]||{2025:0,2026:0}; porAnoMes[k][r.ano]+=+r.caixas||0; });
  const meses = Object.keys(porAnoMes).sort();
  const gr = {};
  rows.forEach(r=>{ const g=r.granja||'—'; gr[g]=gr[g]||{2025:0,2026:0}; gr[g][r.ano]+=+r.caixas||0; });
  const gOrd = Object.entries(gr).sort((a,b)=>b[1][2026]-a[1][2026]).slice(0,10);
  const max26 = rows.filter(r=>r.ano===2026).reduce((mx,r)=> (r.data && r.data>mx) ? r.data : mx, '');
  const corte25 = max26 ? String(new Date().getFullYear()-1) + max26.slice(4) : '';
  const tot25 = rows.filter(r=>r.ano===2025 && (!corte25 || r.data<=corte25)).reduce((s,r)=>s+(+r.caixas||0),0);
  const tot26 = rows.filter(r=>r.ano===2026).reduce((s,r)=>s+(+r.caixas||0),0);
  const corteLabel = max26 ? ' até '+fmtData(max26) : '';
  el('conteudo').innerHTML = `
  <div class="section-head">
    <h2>Compras de Ovos (Granjas)</h2>
    <span class="meta">Entrada de matéria-prima em caixas</span>
  </div>
  <div class="kpis">
    <div class="kpi k-slate"><div class="l">Compras 2025</div><div class="v">${NUM(tot25,1)} cx</div><div class="s">mesmo período${corteLabel}</div></div>
    <div class="kpi k-gold"><div class="l">Compras 2026</div><div class="v" style="color:#d97706">${NUM(tot26,1)} cx</div><div class="s">até ${fmtData(max26)||'—'}</div></div>
    <div class="kpi k-ok"><div class="l">Variação</div><div class="v" style="color:${tot26>=tot25?'var(--ok)':'var(--bad)'}">${tot25?((tot26/tot25-1)*100).toFixed(1)+'%':'—'}</div><div class="s">mesmo período${corteLabel}</div></div>
  </div>
  <div class="two">
    <div class="cardbox"><h3>Caixas compradas por mês</h3><canvas id="chCompMes"></canvas></div>
    <div class="cardbox"><h3>Participação por granja 2026</h3>
      ${gOrd.length ? gOrd.map(([nome,g])=>{
        const tot26g = gOrd.reduce((s,x)=>s+x[1][2026],0) || 1;
        const pctg = (100*g[2026]/tot26g).toFixed(1);
        return `<div style="margin-bottom:7px">
          <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:2px"><span>${nome}</span><b>${NUM(g[2026],0)} cx · ${pctg}%</b></div>
          <div style="height:8px;background:#f1f5f9;border-radius:4px"><div style="height:8px;width:${pctg}%;background:#0ea5e9;border-radius:4px"></div></div>
        </div>`;
      }).join('') : '<div style="color:var(--mut);padding:8px 0">Sem dados de 2026 — verificar carga.</div>'}
    </div>
  </div>`;
  if(!meses.length) el('chCompMes').closest('.cardbox').innerHTML = '<h3>Caixas compradas por mês</h3><div style="color:var(--mut);padding:8px 0">Sem dados — verificar carga.</div>';
  else new Chart(el('chCompMes'), { type:'bar', data:{ labels:meses, datasets:[
    { label:'2025', data:meses.map(m=>porAnoMes[m][2025]), backgroundColor:'#94a3b8', borderRadius:5 },
    { label:'2026', data:meses.map(m=>porAnoMes[m][2026]), backgroundColor:'#f59e0b', borderRadius:5 },
  ]}, options:{ plugins:{ legend:{ labels:{ usePointStyle:true, boxWidth:10 } } } } });
}

// ---------- Clientes ----------
async function abaClientes(){
  const rows = await carregar('ovos_clientes');
  const base = ultimaBase(rows);
  const rs = rows.filter(r=>r.data_base===base).sort((a,b)=>(b.vencido||0)-(a.vencido||0));
  const tot = rs.reduce((s,r)=>s+(+r.total_aberto||0),0);
  const venc = rs.reduce((s,r)=>s+(+r.vencido||0),0);
  const porVend = {};
  rs.forEach(r=>{ const v=r.vendedor_principal||'—'; porVend[v]=porVend[v]||{tot:0,venc:0}; porVend[v].tot+=+r.total_aberto||0; porVend[v].venc+=+r.vencido||0; });
  const vOrd = Object.entries(porVend).sort((a,b)=>b[1].tot-a[1].tot).slice(0,10);
  el('conteudo').innerHTML = `
  <div class="section-head">
    <h2>Carteira de Clientes &amp; Cobrança</h2>
    <span class="meta">Posição por cliente · base ${fmtData(base)}</span>
  </div>
  <div class="kpis">
    <div class="kpi k-gold"><div class="l">Carteira aberta</div><div class="v">${BRL(tot)}</div><div class="s">${rs.length} clientes · base ${fmtData(base)}</div></div>
    <div class="kpi k-bad"><div class="l">Vencido</div><div class="v" style="color:var(--bad)">${BRL(venc)}</div><div class="s">${tot?(100*venc/tot).toFixed(1):'0.0'}% da carteira</div></div>
  </div>
  <div class="cardbox"><h3>Carteira por vendedor (R$)</h3><canvas id="chVend" height="90"></canvas></div>
  <div class="cardbox"><h3>Clientes por vencido (Top 20)</h3>
    <div class="table-wrap"><table><thead><tr><th>Cliente</th><th>Vendedor</th><th class="num">Aberto</th><th class="num">Vencido</th><th class="num">Maior atraso</th><th>Status</th></tr></thead><tbody>
    ${rs.slice(0,20).map(r=>{
      const st = r.status_cobranca||''; const cls = st.includes('ATRASADO')?'r':(st.includes('HOJE')?'y':'g');
      return `<tr><td><b>${r.cliente}</b></td><td>${r.vendedor_principal||'—'}</td><td class="num">${BRL(r.total_aberto)}</td><td class="num" style="color:${r.vencido>0?'var(--bad)':'inherit'};font-weight:${r.vencido>0?'700':'400'}">${BRL(r.vencido)}</td><td class="num">${r.maior_atraso_dias??'—'} d</td><td><span class="badge ${cls}">${st}</span></td></tr>`;
    }).join('')}
    </tbody></table></div></div>`;
  new Chart(el('chVend'), { type:'bar', data:{ labels:vOrd.map(x=>x[0]), datasets:[
    { label:'Aberto', data:vOrd.map(x=>x[1].tot), backgroundColor:'#f59e0b', borderRadius:5 },
    { label:'Vencido', data:vOrd.map(x=>x[1].venc), backgroundColor:'#dc2626', borderRadius:5 },
  ]}, options:{ indexAxis:'y', plugins:{ legend:{ labels:{ usePointStyle:true, boxWidth:10 } } } } });
}

// ---------- Janela ERP ----------
async function abaJanela(){
  const pagos = await carregar('ovos_titulos_pagos');
  const recb = await carregar('ovos_titulos_recebidos');
  const base = ultimaBase([...pagos, ...recb].length? [...pagos,...recb] : [{data_base:''}]);
  const pg = pagos.filter(r=>r.data_base===base);
  const rc = recb.filter(r=>r.data_base===base);
  const tp = pg.reduce((s,r)=>s+(+r.valor_pago||0),0);
  const tr = rc.reduce((s,r)=>s+(+r.valor_recebido||0),0);
  el('conteudo').innerHTML = `
  <div class="section-head">
    <h2>Janela de Liquidação ERP</h2>
    <span class="meta">Movimentação realizada · até ${fmtData(base)}</span>
  </div>
  <div class="kpis">
    <div class="kpi k-ok"><div class="l">Recebido na janela</div><div class="v" style="color:var(--ok)">${BRL(tr)}</div><div class="s">${rc.length} títulos · até ${fmtData(base)}</div></div>
    <div class="kpi k-slate"><div class="l">Pago na janela</div><div class="v">${BRL(tp)}</div><div class="s">${pg.length} títulos</div></div>
    <div class="kpi ${tr>=tp?'k-ok':'k-bad'}"><div class="l">Saldo da janela</div><div class="v" style="color:${tr>=tp?'var(--ok)':'var(--bad)'}">${BRL(tr-tp)}</div><div class="s">recebido menos pago</div></div>
  </div>
  <div class="two">
  <div class="cardbox"><h3>Últimos recebimentos</h3>
    <div class="table-wrap"><table><thead><tr><th>Venc.</th><th>Cliente</th><th class="num">Valor</th></tr></thead><tbody>
    ${rc.slice(-12).reverse().map(r=>`<tr><td>${fmtData(r.vencimento)}</td><td>${r.cliente||'—'}</td><td class="num" style="color:var(--ok);font-weight:600">${BRL(r.valor_recebido)}</td></tr>`).join('')}
    </tbody></table></div></div>
  <div class="cardbox"><h3>Últimos pagamentos</h3>
    <div class="table-wrap"><table><thead><tr><th>Venc.</th><th>Fornecedor</th><th class="num">Valor</th></tr></thead><tbody>
    ${pg.slice(-12).reverse().map(r=>`<tr><td>${fmtData(r.vencimento)}</td><td>${r.fornecedor||'—'}</td><td class="num">${BRL(r.valor_pago)}</td></tr>`).join('')}
    </tbody></table></div></div>
  </div>`;
}

el('logPass').addEventListener('keydown', e=>{ if(e.key==='Enter') doLogin(); });
