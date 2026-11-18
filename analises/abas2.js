// ---------- Produção ----------
async function abaProducao(){
  const rows = await carregar('ovos_producao','ano,mes,data,apresentacao,caixas');
  const porAnoMes = {};
  rows.forEach(r=>{ const k=`${r.ano}-${String(r.mes).padStart(2,'0')}`; porAnoMes[k]=porAnoMes[k]||{2025:0,2026:0}; porAnoMes[k][r.ano]+=+r.caixas||0; });
  const meses = Object.keys(porAnoMes).sort();
  const ap26 = {};
  rows.filter(r=>r.ano===2026).forEach(r=>{ ap26[r.apresentacao||'—']=(ap26[r.apresentacao||'—']||0)+(+r.caixas||0); });
  const apOrd = Object.entries(ap26).sort((a,b)=>b[1]-a[1]).slice(0,10);
  const tot25 = rows.filter(r=>r.ano===2025).reduce((s,r)=>s+(+r.caixas||0),0);
  const tot26 = rows.filter(r=>r.ano===2026).reduce((s,r)=>s+(+r.caixas||0),0);
  el('conteudo').innerHTML = `
  <div class="kpis">
    <div class="kpi"><div class="l">Produção 2025</div><div class="v">${NUM(tot25,1)} cx</div></div>
    <div class="kpi"><div class="l">Produção 2026</div><div class="v" style="color:var(--acc)">${NUM(tot26,1)} cx</div></div>
    <div class="kpi"><div class="l">Variação</div><div class="v">${tot25?((tot26/tot25-1)*100).toFixed(1)+'%':'—'}</div><div class="s">2026 vs 2025</div></div>
  </div>
  <div class="cardbox"><h3>Caixas produzidas por mês</h3><canvas id="chProdMes"></canvas></div>
  <div class="cardbox"><h3>Top 10 apresentações 2026</h3><canvas id="chProdAp"></canvas></div>`;
  new Chart(el('chProdMes'), { type:'bar', data:{ labels:meses, datasets:[
    { label:'2025', data:meses.map(m=>porAnoMes[m][2025]), backgroundColor:'#5a5a5a' },
    { label:'2026', data:meses.map(m=>porAnoMes[m][2026]), backgroundColor:'#ffd400' },
  ]}, options:{ plugins:{ legend:{ labels:{ boxWidth:12 } } } } });
  new Chart(el('chProdAp'), { type:'bar', data:{ labels:apOrd.map(x=>x[0]), datasets:[{ label:'Caixas', data:apOrd.map(x=>x[1]), backgroundColor:'#ffd400' }] },
    options:{ indexAxis:'y', plugins:{ legend:{display:false} } } });
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
  const tot25 = rows.filter(r=>r.ano===2025).reduce((s,r)=>s+(+r.caixas||0),0);
  const tot26 = rows.filter(r=>r.ano===2026).reduce((s,r)=>s+(+r.caixas||0),0);
  el('conteudo').innerHTML = `
  <div class="kpis">
    <div class="kpi"><div class="l">Compras 2025</div><div class="v">${NUM(tot25,1)} cx</div></div>
    <div class="kpi"><div class="l">Compras 2026</div><div class="v" style="color:var(--acc)">${NUM(tot26,1)} cx</div></div>
    <div class="kpi"><div class="l">Variação</div><div class="v">${tot25?((tot26/tot25-1)*100).toFixed(1)+'%':'—'}</div><div class="s">2026 vs 2025</div></div>
  </div>
  <div class="cardbox"><h3>Caixas compradas por mês</h3><canvas id="chCompMes"></canvas></div>
  <div class="cardbox"><h3>Top 10 granjas 2026</h3><canvas id="chCompGr"></canvas></div>`;
  new Chart(el('chCompMes'), { type:'bar', data:{ labels:meses, datasets:[
    { label:'2025', data:meses.map(m=>porAnoMes[m][2025]), backgroundColor:'#5a5a5a' },
    { label:'2026', data:meses.map(m=>porAnoMes[m][2026]), backgroundColor:'#ffd400' },
  ]}, options:{ plugins:{ legend:{ labels:{ boxWidth:12 } } } } });
  new Chart(el('chCompGr'), { type:'bar', data:{ labels:gOrd.map(x=>x[0]), datasets:[{ label:'Caixas', data:gOrd.map(x=>x[1][2026]), backgroundColor:'#ffd400' }] },
    options:{ indexAxis:'y', plugins:{ legend:{display:false} } } });
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
  <div class="kpis">
    <div class="kpi"><div class="l">Carteira aberta</div><div class="v">${BRL(tot)}</div><div class="s">${rs.length} clientes · base ${fmtData(base)}</div></div>
    <div class="kpi"><div class="l">Vencido</div><div class="v" style="color:var(--bad)">${BRL(venc)}</div><div class="s">${(100*venc/tot).toFixed(1)}% da carteira</div></div>
  </div>
  <div class="cardbox"><h3>Carteira por vendedor (R$)</h3><canvas id="chVend"></canvas></div>
  <div class="cardbox"><h3>Clientes por vencido</h3>
    <table><tr><th>Cliente</th><th>Vendedor</th><th class="num">Aberto</th><th class="num">Vencido</th><th class="num">Maior atraso</th><th>Status</th></tr>
    ${rs.slice(0,20).map(r=>{
      const st = r.status_cobranca||''; const cls = st.includes('ATRASADO')?'r':(st.includes('HOJE')?'y':'g');
      return `<tr><td>${r.cliente}</td><td>${r.vendedor_principal||'—'}</td><td class="num">${BRL(r.total_aberto)}</td><td class="num" style="color:${r.vencido>0?'var(--bad)':'inherit'}">${BRL(r.vencido)}</td><td class="num">${r.maior_atraso_dias??'—'} d</td><td><span class="badge ${cls}">${st}</span></td></tr>`;
    }).join('')}
    </table></div>`;
  new Chart(el('chVend'), { type:'bar', data:{ labels:vOrd.map(x=>x[0]), datasets:[
    { label:'Aberto', data:vOrd.map(x=>x[1].tot), backgroundColor:'#ffd400' },
    { label:'Vencido', data:vOrd.map(x=>x[1].venc), backgroundColor:'#ff5252' },
  ]}, options:{ indexAxis:'y', plugins:{ legend:{ labels:{ boxWidth:12 } } } } });
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
  <div class="kpis">
    <div class="kpi"><div class="l">Recebido na janela</div><div class="v" style="color:var(--ok)">${BRL(tr)}</div><div class="s">${rc.length} títulos · até ${fmtData(base)}</div></div>
    <div class="kpi"><div class="l">Pago na janela</div><div class="v">${BRL(tp)}</div><div class="s">${pg.length} títulos</div></div>
  </div>
  <div class="two">
  <div class="cardbox"><h3>Últimos recebimentos</h3>
    <table><tr><th>Venc.</th><th>Cliente</th><th class="num">Valor</th></tr>
    ${rc.slice(-12).reverse().map(r=>`<tr><td>${fmtData(r.vencimento)}</td><td>${r.cliente||'—'}</td><td class="num">${BRL(r.valor_recebido)}</td></tr>`).join('')}
    </table></div>
  <div class="cardbox"><h3>Últimos pagamentos</h3>
    <table><tr><th>Venc.</th><th>Fornecedor</th><th class="num">Valor</th></tr>
    ${pg.slice(-12).reverse().map(r=>`<tr><td>${fmtData(r.vencimento)}</td><td>${r.fornecedor||'—'}</td><td class="num">${BRL(r.valor_pago)}</td></tr>`).join('')}
    </table></div>
  </div>`;
}

el('logPass').addEventListener('keydown', e=>{ if(e.key==='Enter') doLogin(); });
