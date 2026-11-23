// ============================================================
//  ABA TRANSPORTADORA — TRANSPORTADORA CASAGRANDE
//  Fonte: painel oficial https://ovoscasagrande.github.io/transportadora-painel/
//  (JSON agregado pelo app TRANSPORTADORA, embutido no index.html).
//  Fallbacks: raw.githubusercontent (CDN) e snapshot embutido.
//  Não é TMS: 1 embarcador fixo, 2 cavalos mecânicos, sem cotação/frete/CT-e.
//  O que importa: custo por km e por caminhão.
// ============================================================

const TRANSP_FONTES = [
  'https://ovoscasagrande.github.io/transportadora-painel/index.html',
  'https://raw.githubusercontent.com/Ovoscasagrande/transportadora-painel/master/index.html'
];

// SNAPSHOT capturado em 23/11/2026 18:38 UTC (painel oficial) — usado só se as fontes falharem
const TRANSP_SNAPSHOT = {"gerado_em":"2026-11-23T18:38:19.972343+00:00","periodo_receita":{"de":"2026-08-03","ate":"2026-10-23"},"periodo_combustivel":{"de":"2026-08-03","ate":"2026-11-18"},"periodo_jornadas":{"de":"2026-11-10","ate":"2026-11-23"},"frota":[{"placa":"UQA6I75","modelo":"Iveco Tector 11-190","km_rodado":2283,"combustivel":27447.51,"manutencao":0,"despesas":11900.81,"total":39348.32,"rkm":17.235},{"placa":"UQU4A94","modelo":"Mercedes-Benz Accelo 1117 CE","km_rodado":1984,"combustivel":22393.81,"manutencao":0,"despesas":11694.34,"total":34088.15,"rkm":17.182}],"receita":{"confirmada":191524.06,"lancamentos":213},"receita_por_mes":[{"mes":"2026-08","valor":67823.2,"qtd":73},{"mes":"2026-09","valor":75983.13,"qtd":82},{"mes":"2026-10","valor":47717.73,"qtd":58}],"combustivel_por_mes":[{"mes":"2026-08","valor":15747.18,"litros":2325.1,"preco":6.77},{"mes":"2026-09","valor":17176.84,"litros":2615.3,"preco":6.57},{"mes":"2026-10","valor":13262.49,"litros":1915,"preco":6.93},{"mes":"2026-11","valor":3654.81,"litros":527.3,"preco":6.93}],"despesas_por_mes":[{"mes":"2026-08","valor":5153.17,"qtd":37},{"mes":"2026-09","valor":14097.29,"qtd":22},{"mes":"2026-10","valor":1174.69,"qtd":3},{"mes":"2026-11","valor":3170,"qtd":13}],"despesas_por_categoria":[{"categoria":"PERNOITE","valor":15309.5,"qtd":25},{"categoria":"DESCARGA","valor":5430.31,"qtd":37},{"categoria":"DIESEL","valor":2855.34,"qtd":13}],"top_destinos":[{"municipio":"GUARULHOS","valor":17206.74,"qtd":12},{"municipio":"SÃO PAULO","valor":15578.93,"qtd":14},{"municipio":"CAMPINAS","valor":14105.94,"qtd":14},{"municipio":"PRAIA GRANDE","valor":12528.8,"qtd":10},{"municipio":"HORTOLANDIA","valor":10672.03,"qtd":18},{"municipio":"ARUJA","valor":10187,"qtd":11},{"municipio":"RIBEIRÃO PRETO","valor":7772,"qtd":7},{"municipio":"SUMARE","valor":6358.04,"qtd":15},{"municipio":"SAO PAULO","valor":4889.1,"qtd":7},{"municipio":"JUNDIAI","valor":4468.87,"qtd":7}],"pendentes":{"qtd":8,"valor":2320},"jornadas_abertas":2};

// extrai o objeto `const D = {...}` do HTML do painel (varredura balanceada, sem regex frágil)
function transpExtraiJSON(html){
  const i = html.indexOf('const D = ');
  if(i < 0) return null;
  const ini = html.indexOf('{', i);
  if(ini < 0) return null;
  let prof = 0, str = false, esc = false;
  for(let j = ini; j < html.length; j++){
    const c = html[j];
    if(str){ if(esc) esc = false; else if(c === '\\') esc = true; else if(c === '"') str = false; continue; }
    if(c === '"') str = true;
    else if(c === '{') prof++;
    else if(c === '}'){ prof--; if(prof === 0){ try{ return JSON.parse(html.slice(ini, j+1)); }catch(e){ return null; } } }
  }
  return null;
}

async function transpDados(){
  for(const u of TRANSP_FONTES){
    try{
      const r = await fetch(u + '?t=' + Date.now(), { cache:'no-store' });
      if(!r.ok) continue;
      const d = transpExtraiJSON(await r.text());
      if(d && d.frota) return { D:d, fonte:'painel oficial (ao vivo)', live:true };
    }catch(e){ /* tenta a próxima fonte */ }
  }
  return { D: JSON.parse(JSON.stringify(TRANSP_SNAPSHOT)), fonte:'snapshot local de 23/11 (painel indisponível)', live:false };
}

const transpRkm = v => 'R$ ' + (Number(v)||0).toLocaleString('pt-BR',{minimumFractionDigits:2, maximumFractionDigits:2});

async function abaTransportadora(){
  const { D, fonte, live } = await transpDados();

  const frota = D.frota || [];
  const recMes = D.receita_por_mes || [];
  const combMes = D.combustivel_por_mes || [];
  const despMes = D.despesas_por_mes || [];
  const cats = D.despesas_por_categoria || [];
  const dest = D.top_destinos || [];
  const pend = D.pendentes || {};

  const receita = Number((D.receita||{}).confirmada)||0;
  const nLanc = Number((D.receita||{}).lancamentos)||0;
  const custo = frota.reduce((s,f)=>s+(Number(f.total)||0),0);
  const resultado = receita - custo;
  const margem = receita > 0 ? resultado/receita*100 : null;

  const pr = D.periodo_receita||{}, pc = D.periodo_combustivel||{}, pj = D.periodo_jornadas||{};
  const gerado = D.gerado_em ? D.gerado_em.replace('T',' ').slice(0,16)+' UTC' : '—';

  // meses unindo receita + combustível + despesas
  const meses = [...new Set([...recMes.map(r=>r.mes), ...combMes.map(r=>r.mes), ...despMes.map(r=>r.mes)])].sort();
  const valRec = m => Number((recMes.find(x=>x.mes===m)||{}).valor)||0;
  const valComb = m => Number((combMes.find(x=>x.mes===m)||{}).valor)||0;
  const valDesp = m => Number((despMes.find(x=>x.mes===m)||{}).valor)||0;

  // gaveta: tabela da frota (R$/km como texto — média não se soma)
  const gavetaFrota = (titulo)=> abrirOrigem({
    titulo: titulo || 'Frota — números do período',
    subtitulo: 'KM: jornadas '+fmtData(pj.de)+' a '+fmtData(pj.ate)+' · custo: combustível '+fmtData(pc.de)+' a '+fmtData(pc.ate),
    resumoTop: true,
    colunas: ['Caminhão','Modelo','KM','R$ Combustível','R$ Despesas','R$ Total','R$/km'],
    linhas: frota.map(f=>[f.placa, f.modelo||'—', Number(f.km_rodado)||0, Number(f.combustivel)||0, Number(f.despesas)||0, Number(f.total)||0, f.rkm?transpRkm(f.rkm):'—']),
    nomeCsv: 'transportadora-frota.csv'
  });

  el('conteudo').innerHTML = `
  <div class="section-head">
    <h2>Transportadora</h2>
    <span class="meta">receita ${fmtData(pr.de)} a ${fmtData(pr.ate)} · combustível até ${fmtData(pc.ate)} · KM até ${fmtData(pj.ate)}</span>
    <button class="btn-sm" onclick="abaTransportadora()">↻ atualizar</button>
  </div>

  ${live ? '' : `<div class="cardbox" style="border-left:4px solid var(--bad);background:var(--bad-bg);margin-bottom:14px">
    <div style="font-size:12.5px;color:var(--bad);font-weight:600">⚠️ Painel oficial indisponível agora — mostrando o snapshot de 23/11. Tente atualizar mais tarde.</div></div>`}

  <div class="kpis">
    <button class="kpi k-click k-ok" id="tkRec"><div class="l">Receita confirmada</div><div class="v">${BRL(receita)}</div><div class="s">${NUM(nLanc)} lançamentos · clique para ver por mês</div></button>
    <button class="kpi k-click k-bad" id="tkCust"><div class="l">Custo total</div><div class="v">${BRL(custo)}</div><div class="s">combustível + despesas · ${frota.length} caminhões</div></button>
    <div class="kpi ${resultado>=0?'k-ok':'k-bad'}"><div class="l">Resultado</div><div class="v" style="color:${resultado>=0?'var(--ok)':'var(--bad)'}">${BRL(resultado)}</div><div class="s">receita − custo</div></div>
    <div class="kpi k-gold"><div class="l">Margem</div><div class="v">${margem!=null?NUM(margem,1)+'%':'—'}</div><div class="s">resultado ÷ receita</div></div>
    <div class="kpi k-slate"><div class="l">Caminhões</div><div class="v">${frota.length}</div><div class="s">cavalos mecânicos · embarcador fixo</div></div>
    <div class="kpi ${pend.qtd?'k-bad':'k-slate'}"><div class="l">Despesas a aprovar</div><div class="v">${pend.qtd||0}</div><div class="s">${BRL(pend.valor||0)} · reprovada não entra no custo</div></div>
  </div>

  <div class="cardbox" style="border-left:4px solid var(--acc);background:#fffbeb">
    <h3>⚠️ R$/km inflado — os períodos não batem</h3>
    <div style="font-size:12.5px;color:#78350f;line-height:1.55">
      O custo cobre <b>${fmtData(pc.de)} a ${fmtData(pc.ate)}</b> (ago–out, 101 abastecimentos) e o KM rodado só tem <b>jornadas de ${fmtData(pj.de)} a ${fmtData(pj.ate)}</b> (${NUM(frota.reduce((s,f)=>s+(+f.km_rodado||0),0))} km nos 2 caminhões).
      Não é erro de lançamento e <b>não dá para calcular km/L</b> — os períodos são diferentes. Quando as jornadas cobrirem o mesmo período do custo, o R$/km cai para o valor real.
    </div>
  </div>

  <div class="cardbox">
    <div class="cardbox-head"><h3>Receita e custo por mês (R$)</h3><span class="hint">custo = combustível + despesas do mês</span></div>
    <canvas id="tchMes" height="105"></canvas>
  </div>

  <div class="two">
    <div class="cardbox">
      <div class="cardbox-head"><h3>Custo por caminhão</h3><span class="hint">R$/km · toque no caminhão</span></div>
      <canvas id="tchFrota" height="95"></canvas>
    </div>
    <div class="cardbox">
      <div class="cardbox-head"><h3>Preço do litro — diesel</h3><span class="hint">média por mês</span></div>
      <canvas id="tchComb" height="95"></canvas>
    </div>
  </div>

  <div class="two">
    <div class="cardbox">
      <div class="cardbox-head"><h3>Despesas por categoria</h3><span class="hint">onde o dinheiro sai</span></div>
      <canvas id="tchDesp" height="110"></canvas>
    </div>
    <div class="cardbox">
      <div class="cardbox-head"><h3>Destinos que mais pagam</h3><span class="hint">receita por município · top 8</span></div>
      <canvas id="tchDest" height="110"></canvas>
    </div>
  </div>

  <div class="cardbox">
    <div class="cardbox-head"><h3>Frota — números do período</h3><span class="hint">👆 toque na linha para a origem</span></div>
    <div class="table-wrap"><table id="tTabFrota" class="tabela-cartao"></table></div>
  </div>

  <div class="cardbox" style="color:var(--mut);font-size:11.5px;line-height:1.6">
    <b style="color:var(--txt)">Fonte:</b> app TRANSPORTADORA CASAGRANDE (Supabase), agregado no painel oficial — ${fonte}.<br>
    Gerado em ${gerado}. Despesa reprovada não entra no custo; receita só entra quando confirmada.<br>
    <b style="color:var(--txt)">Não é TMS:</b> a transportadora tem um embarcador fixo e 2 cavalos mecânicos — o que importa é custo por km e por caminhão.
  </div>`;

  // ---- tabela da frota ----
  el('tTabFrota').innerHTML = '<thead><tr><th>Caminhão</th><th>Modelo</th><th class="num">KM</th><th class="num">Combustível</th><th class="num">Despesas</th><th class="num">Total</th><th class="num">R$/km</th></tr></thead><tbody>'
    + frota.map(f=>`<tr style="cursor:pointer">
        <td data-l="Caminhão"><b>${f.placa}</b></td><td data-l="Modelo" style="color:var(--mut);font-size:11.5px">${f.modelo||'—'}</td>
        <td class="num" data-l="KM">${NUM(f.km_rodado)}</td><td class="num" data-l="Combustível">${BRL(f.combustivel)}</td>
        <td class="num" data-l="Despesas">${BRL(f.despesas)}</td><td class="num" data-l="Total"><b>${BRL(f.total)}</b></td>
        <td class="num" data-l="R$/km">${f.rkm?transpRkm(f.rkm):'—'}</td></tr>`).join('')
    + '</tbody>';
  // clique nas linhas (gavetaFrota é local — ligar por código, não onclick inline)
  [...el('tTabFrota').querySelectorAll('tbody tr')].forEach((tr, i)=>{ tr.onclick = ()=> gavetaFrota(frota[i] && frota[i].placa); });

  // ---- KPIs clicáveis ----
  el('tkRec').onclick = ()=> abrirOrigem({
    titulo:'Receita confirmada por mês', subtitulo: NUM(nLanc)+' lançamentos · '+BRL(receita)+' no período',
    resumoTop:true, colunas:['Mês','Lançamentos','R$ Receita'],
    linhas: recMes.map(r=>[fmtMes(r.mes), Number(r.qtd)||0, Number(r.valor)||0]),
    nomeCsv:'transportadora-receita-mes.csv'
  });
  el('tkCust').onclick = ()=> gavetaFrota('Custo total — composição por caminhão');

  // ---- 1) receita × custo por mês ----
  if(!meses.length) el('tchMes').closest('.cardbox').innerHTML = '<div class="cardbox-head"><h3>Receita e custo por mês (R$)</h3></div><div style="color:var(--mut);padding:12px 0">Sem lançamentos ainda.</div>';
  else criarGraficoInterativo('tchMes', { type:'bar', data:{ labels:meses.map(fmtMes), datasets:[
      { label:'Receita', data:meses.map(valRec), backgroundColor:'#16a34a', borderRadius:6 },
      { label:'Custo', data:meses.map(m=>valComb(m)+valDesp(m)), backgroundColor:'#dc2626', borderRadius:6 },
    ]}, options:{
      plugins:{ legend:{ position:'top', labels:{ usePointStyle:true, boxWidth:10 } },
        tooltip:{ callbacks:{ label: ctx => ctx.dataset.label+': '+BRL(ctx.parsed.y),
          afterBody: (items)=>{ const m = meses[items[0].dataIndex];
            const res = valRec(m)-valComb(m)-valDesp(m);
            return ['', 'Resultado do mês: '+BRL(res), 'Combustível '+BRL(valComb(m))+' · Despesas '+BRL(valDesp(m))]; } } } },
      scales:{ y:{ ticks:{ callback:v=>'R$ '+(v/1e3).toFixed(0)+'k' } } },
      onClickItem:(i)=>{ const m = meses[i]; if(!m) return;
        const res = valRec(m)-valComb(m)-valDesp(m);
        const rcm = recMes.find(x=>x.mes===m)||{}, cmm = combMes.find(x=>x.mes===m)||{}, dmm = despMes.find(x=>x.mes===m)||{};
        abrirOrigem({
          titulo:'Detalhe de '+fmtMes(m),
          subtitulo:'receita '+BRL(valRec(m))+' · custo '+BRL(valComb(m)+valDesp(m))+' · resultado '+BRL(res),
          resumoTop:true,
          colunas:['Mês','Lançamentos receita','R$ Receita','Litros diesel','R$ Combustível','R$/L','Despesas (qtd)','R$ Despesas','R$ Resultado'],
          linhas: meses.map(x=>{
            const rc = recMes.find(z=>z.mes===x)||{}, cc = combMes.find(z=>z.mes===x)||{}, dc = despMes.find(z=>z.mes===x)||{};
            return [fmtMes(x), Number(rc.qtd)||0, Number(rc.valor)||0, cc.litros!=null?Number(cc.litros):null, Number(cc.valor)||0, cc.preco!=null?transpRkm(cc.preco):'—', Number(dc.qtd)||0, Number(dc.valor)||0, (Number(rc.valor)||0)-(Number(cc.valor)||0)-(Number(dc.valor)||0)];
          }),
          nomeCsv:'transportadora-mes-'+m+'.csv'
        });
      }
    } });
  hintGrafico('tchMes');

  // ---- 2) custo por caminhão (R$/km) ----
  const frotaOrd = frota.filter(f=>f.rkm).sort((a,b)=>Number(b.rkm)-Number(a.rkm));
  if(!frotaOrd.length) el('tchFrota').closest('.cardbox').innerHTML = '<div class="cardbox-head"><h3>Custo por caminhão</h3></div><div style="color:var(--mut);padding:12px 0">Sem jornadas com KM lançado ainda.</div>';
  else criarGraficoInterativo('tchFrota', { type:'bar', data:{ labels:frotaOrd.map(f=>f.placa), datasets:[
      { label:'R$/km', data:frotaOrd.map(f=>Number(f.rkm)), backgroundColor:'#f59e0b', borderRadius:6 } ]},
    options:{ indexAxis:'y',
      plugins:{ legend:{ display:false },
        tooltip:{ callbacks:{ label: ctx => { const f = frotaOrd[ctx.dataIndex];
          return ['R$ '+NUM(f.rkm,2)+'/km', NUM(f.km_rodado)+' km · total '+BRL(f.total), 'combustível '+BRL(f.combustivel)+' · despesas '+BRL(f.despesas)]; } } } },
      scales:{ x:{ ticks:{ callback:v=>'R$'+Number(v).toFixed(0) } } },
      onClickItem:(i)=>{ const f = frotaOrd[i]; if(!f) return;
        abrirOrigem({
          titulo:'Caminhão '+f.placa,
          subtitulo:(f.modelo||'')+' · '+NUM(f.km_rodado)+' km · '+transpRkm(f.rkm)+'/km',
          resumoTop:true,
          colunas:['Item','R$ Valor'],
          linhas:[['Combustível', Number(f.combustivel)||0], ['Despesas', Number(f.despesas)||0], ['Manutenção', Number(f.manutencao)||0], ['Total', Number(f.total)||0]],
          extra:{ titulo2:'Frota completa', colunas2:['Caminhão','Modelo','KM','R$ Combustível','R$ Despesas','R$ Total','R$/km'],
            linhas2: frota.map(x=>[x.placa, x.modelo||'—', Number(x.km_rodado)||0, Number(x.combustivel)||0, Number(x.despesas)||0, Number(x.total)||0, x.rkm?transpRkm(x.rkm):'—']),
            nomeCsv2:'transportadora-frota.csv' },
          nomeCsv:'transportadora-caminhao-'+f.placa+'.csv'
        });
      }
    } });
  hintGrafico('tchFrota');

  // ---- 3) preço do litro ----
  if(!combMes.length) el('tchComb').closest('.cardbox').innerHTML = '<div class="cardbox-head"><h3>Preço do litro — diesel</h3></div><div style="color:var(--mut);padding:12px 0">Sem abastecimentos lançados.</div>';
  else { const precos = combMes.map(c=>Number(c.preco)||0);
    criarGraficoInterativo('tchComb', { type:'line', data:{ labels:combMes.map(c=>fmtMes(c.mes)), datasets:[
        { label:'R$/L', data:precos, borderColor:'#f59e0b', backgroundColor:'rgba(245,158,11,.14)', fill:true, tension:.35, pointRadius:4, pointBackgroundColor:'#f59e0b', borderWidth:2.5 } ]},
      options:{ plugins:{ legend:{ display:false },
          tooltip:{ callbacks:{ label: ctx => { const c = combMes[ctx.dataIndex];
            return ['R$ '+NUM(c.preco,2)+'/L', NUM(c.litros,1)+' litros · '+BRL(c.valor)]; } } } },
        scales:{ y:{ min: Math.max(0, Math.min(...precos)*0.97), ticks:{ callback:v=>'R$'+Number(v).toFixed(2) } } },
        onClickItem:(i)=>{ const c = combMes[i]; if(!c) return;
          abrirOrigem({
            titulo:'Diesel — '+fmtMes(c.mes),
            subtitulo:'R$ '+NUM(c.preco,2)+'/L · '+NUM(c.litros,1)+' L · '+BRL(c.valor),
            resumoTop:true,
            colunas:['Mês','Litros','R$ Valor','R$/L'],
            linhas: combMes.map(x=>[fmtMes(x.mes), Number(x.litros)||0, Number(x.valor)||0, transpRkm(x.preco)]),
            nomeCsv:'transportadora-diesel.csv'
          });
        }
      } }); }
  hintGrafico('tchComb');

  // ---- 4) despesas por categoria ----
  const CORES = ['#f59e0b','#0ea5e9','#16a34a','#dc2626','#8b5cf6','#64748b','#eab308','#06b6d4'];
  const totCat = cats.reduce((s,c)=>s+(Number(c.valor)||0),0);
  if(!cats.length) el('tchDesp').closest('.cardbox').innerHTML = '<div class="cardbox-head"><h3>Despesas por categoria</h3></div><div style="color:var(--mut);padding:12px 0">Sem despesas aprovadas no período.</div>';
  else criarGraficoInterativo('tchDesp', { type:'doughnut', data:{ labels:cats.map(c=>c.categoria), datasets:[
      { data:cats.map(c=>Number(c.valor)||0), backgroundColor:cats.map((c,i)=>CORES[i%CORES.length]), borderColor:'#fff', borderWidth:2 } ]},
    options:{ cutout:'55%',
      plugins:{ legend:{ position:'bottom', labels:{ usePointStyle:true, boxWidth:10 } },
        tooltip:{ callbacks:{ label: ctx => { const c = cats[ctx.dataIndex];
          const pct = totCat>0 ? (Number(c.valor)/totCat*100).toFixed(1).replace('.',',') : '0';
          return [c.categoria+': '+BRL(c.valor), pct+'% do total · '+NUM(c.qtd)+' lançamentos']; } } } },
      onClickItem:(i)=>{ const c = cats[i]; if(!c) return;
        abrirOrigem({
          titulo:'Despesas — '+c.categoria,
          subtitulo:BRL(c.valor)+' · '+NUM(c.qtd)+' lançamentos · '+(totCat>0?(Number(c.valor)/totCat*100).toFixed(1).replace('.',','):'0')+'% do total',
          resumoTop:true,
          colunas:['Categoria','Lançamentos','R$ Valor','% do total'],
          linhas: cats.map(x=>[x.categoria, Number(x.qtd)||0, Number(x.valor)||0, totCat>0?(Number(x.valor)/totCat*100).toFixed(1).replace('.',',')+'%':'—']),
          nomeCsv:'transportadora-despesas.csv'
        });
      }
    } });
  hintGrafico('tchDesp');

  // ---- 5) destinos que mais pagam ----
  const destTop = dest.slice(0,8);
  if(!destTop.length) el('tchDest').closest('.cardbox').innerHTML = '<div class="cardbox-head"><h3>Destinos que mais pagam</h3></div><div style="color:var(--mut);padding:12px 0">Sem receitas com município lançado.</div>';
  else criarGraficoInterativo('tchDest', { type:'bar', data:{ labels:destTop.map(d=>d.municipio), datasets:[
      { label:'Receita', data:destTop.map(d=>Number(d.valor)||0), backgroundColor:'#0ea5e9', borderRadius:6 } ]},
    options:{ indexAxis:'y',
      plugins:{ legend:{ display:false },
        tooltip:{ callbacks:{ label: ctx => { const d = destTop[ctx.dataIndex];
          const med = d.qtd ? Number(d.valor)/d.qtd : 0;
          return [BRL(d.valor), NUM(d.qtd)+' viagens · média '+BRL(med)+'/viagem']; } } } },
      scales:{ x:{ ticks:{ callback:v=>'R$ '+(v/1e3).toFixed(0)+'k' } } },
      onClickItem:(i)=>{ const d = destTop[i]; if(!d) return;
        const med = d.qtd ? Number(d.valor)/d.qtd : 0;
        abrirOrigem({
          titulo:'Destino '+d.municipio,
          subtitulo:BRL(d.valor)+' · '+NUM(d.qtd)+' viagens · média '+BRL(med)+'/viagem',
          resumoTop:true,
          colunas:['Município','Viagens','R$ Receita','R$ Média/viagem'],
          linhas: dest.map(x=>[x.municipio, Number(x.qtd)||0, Number(x.valor)||0, x.qtd?transpRkm(Number(x.valor)/x.qtd):'—']),
          nomeCsv:'transportadora-destinos.csv'
        });
      }
    } });
  hintGrafico('tchDest');
}
