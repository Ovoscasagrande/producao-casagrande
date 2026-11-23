// ============================================================
//  ABA MOTORISTAS — operação OVOS (entregas)
//  Fonte: espelho no Supabase do painel (tabelas ovos_moto_*),
//  carregado do app OVOS CASAGRANDE (jornadas, abastecimentos, despesas).
//  Série curta: app em operação desde 10/11/2026.
//  O app NÃO registra volume entregue por cliente/rota — só km, horas e custos.
// ============================================================

const MOTO_URL = 'https://ppiqkrvlvtsnsthnfibg.supabase.co';
const MOTO_KEY = 'sb_publishable_O9oB4kDpibrJPSoWDlgX-A_yAsQ2znY';
const motoSb = supabase.createClient(MOTO_URL, MOTO_KEY);

// busca paginada (PostgREST devolve no máx 1000 por chamada)
async function motoPega(tabela, ordem){
  const out = [];
  let de = 0;
  while(true){
    let q = motoSb.from(tabela).select('*').order(ordem, { ascending:true }).range(de, de+999);
    const { data, error } = await q;
    if(error) throw new Error(tabela+': '+error.message);
    if(!data || !data.length) break;
    out.push(...data);
    if(data.length < 1000) break;
    de += 1000;
  }
  return out;
}

const motoFmtH = h => (h==null || h===0) ? '—' : NUM(h,1)+'h';

async function abaMotoristas(){
  const [jornadas, abast, desp, frota] = await Promise.all([
    motoPega('ovos_moto_jornadas','dia'),
    motoPega('ovos_moto_abastecimentos','dia'),
    motoPega('ovos_moto_despesas','dia'),
    motoPega('ovos_moto_frota','placa'),
  ]);

  const fech = jornadas.filter(j=>j.status==='fechada');
  const abertas = jornadas.filter(j=>j.status==='aberta');
  const canc = jornadas.filter(j=>j.status==='cancelada');
  const km = fech.reduce((s,j)=>s+(+j.km||0),0);
  const horas = fech.reduce((s,j)=>s+(+j.horas||0),0);
  const comb = abast.reduce((s,a)=>s+(+a.valor||0),0);
  const litros = abast.reduce((s,a)=>s+(+a.litros||0),0);
  const despAprov = desp.filter(d=>d.status==='aprovada').reduce((s,d)=>s+(+d.valor||0),0);
  const frotaAtiva = frota.filter(f=>f.ativo);
  const dias = [...new Set(jornadas.map(j=>j.dia))].sort();
  const per = dias.length ? `${fmtData(dias[0])} a ${fmtData(dias[dias.length-1])}` : 'sem dados';

  // agregados
  const porDia = dias.map(d=>{
    const f = jornadas.filter(j=>j.dia===d && j.status==='fechada');
    return { dia:d, jornadas:f.length, km:f.reduce((s,j)=>s+(+j.km||0),0) };
  });
  const porMoto = {};
  jornadas.forEach(j=>{
    const m = j.motorista || '—';
    porMoto[m] = porMoto[m] || { jornadas:0, km:0, horas:0, litros:0, comb:0, desp:0 };
    if(j.status==='fechada'){ porMoto[m].jornadas++; porMoto[m].km += +j.km||0; porMoto[m].horas += +j.horas||0; }
  });
  abast.forEach(a=>{ const m = porMoto[a.motorista||'—']; if(m){ m.litros += +a.litros||0; m.comb += +a.valor||0; } });
  desp.forEach(d=>{ if(d.status==='aprovada'){ const m = porMoto[d.motorista||'—']; if(m) m.desp += +d.valor||0; } });
  const rankMoto = Object.entries(porMoto).filter(([,v])=>v.jornadas>0).sort((a,b)=>b[1].km-a[1].km);

  const porVeic = {};
  jornadas.forEach(j=>{ if(j.status==='fechada' && j.veiculo){ porVeic[j.veiculo] = porVeic[j.veiculo] || { km:0, modelo:j.modelo||'' }; porVeic[j.veiculo].km += +j.km||0; } });
  const rankVeic = Object.entries(porVeic).sort((a,b)=>b[1].km-a[1].km).slice(0,10);

  const gavetaMoto = (nome)=> abrirOrigem({
    titulo:'Jornadas de '+nome,
    subtitulo:'só jornadas fechadas · km e horas do app OVOS',
    resumoTop:true,
    colunas:['Dia','Veículo','Roteiro','KM','Horas','Status'],
    linhas: jornadas.filter(j=>j.motorista===nome && j.status==='fechada')
      .map(j=>[fmtData(j.dia), j.veiculo||'—', j.roteiro||'—', +j.km||0, j.horas?NUM(j.horas,1)+'h':'—', 'fechada']),
    nomeCsv:'motoristas-jornadas-'+nome.replace(/\s+/g,'-').toLowerCase()+'.csv'
  });

  el('conteudo').innerHTML = `
  <div class="section-head">
    <h2>Motoristas</h2>
    <span class="meta">operação de entregas OVOS · ${per}</span>
    <button class="btn-sm" onclick="abaMotoristas()">↻ atualizar</button>
  </div>

  <div class="kpis">
    <button class="kpi k-click k-ok" id="mkJ"><div class="l">Jornadas fechadas</div><div class="v">${NUM(fech.length)}</div><div class="s">${abertas.length} abertas · ${canc.length} canceladas · clique p/ ver por dia</div></button>
    <button class="kpi k-click k-gold" id="mkKm"><div class="l">KM rodados</div><div class="v">${NUM(km)}</div><div class="s">${NUM(km/Math.max(fech.length,1))} km/jornada média</div></button>
    <div class="kpi k-slate"><div class="l">Horas de estrada</div><div class="v">${motoFmtH(horas)}</div><div class="s">média ${fech.length?motoFmtH(horas/fech.length):'—'} por jornada</div></div>
    <button class="kpi k-click k-bad" id="mkComb"><div class="l">Combustível</div><div class="v">${BRL(comb)}</div><div class="s">${NUM(litros)} L · ${abast.length} abastecimentos</div></button>
    <div class="kpi k-slate"><div class="l">Despesas aprovadas</div><div class="v">${BRL(despAprov)}</div><div class="s">${desp.length} lançamentos no app</div></div>
    <div class="kpi k-slate"><div class="l">Frota ativa</div><div class="v">${frotaAtiva.length}</div><div class="s">${rankMoto.length} motoristas rodando</div></div>
  </div>

  <div class="cardbox" style="border-left:4px solid var(--acc);background:#fffbeb">
    <div style="font-size:12.5px;color:#78350f;line-height:1.55">
      <b>Série curta:</b> o app de jornadas entrou em operação em <b>10/11/2026</b> — os números cobrem só os dias lançados. O app registra km, horas e custos, <b>não o volume entregue</b> por cliente/rota (isso só no ERP).
    </div>
  </div>

  <div class="cardbox">
    <div class="cardbox-head"><h3>KM rodados por dia</h3><span class="hint">só jornadas fechadas · toque no dia</span></div>
    <canvas id="mchDia" height="100"></canvas>
  </div>

  <div class="two">
    <div class="cardbox">
      <div class="cardbox-head"><h3>KM por motorista</h3><span class="hint">toque no motorista</span></div>
      <canvas id="mchMoto" height="150"></canvas>
    </div>
    <div class="cardbox">
      <div class="cardbox-head"><h3>KM por veículo</h3><span class="hint">top 10 · toque na placa</span></div>
      <canvas id="mchVeic" height="150"></canvas>
    </div>
  </div>

  <div class="cardbox">
    <div class="cardbox-head"><h3>Motoristas — resumo do período</h3><span class="hint">👆 toque na linha para as jornadas</span></div>
    <div class="table-wrap"><table id="mTab" class="tabela-cartao"></table></div>
  </div>

  <div class="cardbox" style="color:var(--mut);font-size:11.5px;line-height:1.6">
    <b style="color:var(--txt)">Fonte:</b> app OVOS CASAGRANDE (jornadas de entrega), espelhado no banco do painel. Atualizado todo dia junto com a carga do ERP.
  </div>`;

  // tabela de motoristas
  el('mTab').innerHTML = '<thead><tr><th>Motorista</th><th class="num">Jornadas</th><th class="num">KM</th><th class="num">KM/jornada</th><th class="num">Horas</th><th class="num">Litros</th><th class="num">Combustível</th><th class="num">Despesas</th></tr></thead><tbody>'
    + rankMoto.map(([nome,v])=>`<tr style="cursor:pointer">
        <td data-l="Motorista"><b>${nome}</b></td>
        <td class="num" data-l="Jornadas">${NUM(v.jornadas)}</td>
        <td class="num" data-l="KM">${NUM(v.km)}</td>
        <td class="num" data-l="KM/jornada">${NUM(v.km/Math.max(v.jornadas,1))}</td>
        <td class="num" data-l="Horas">${motoFmtH(v.horas)}</td>
        <td class="num" data-l="Litros">${v.litros?NUM(v.litros):'—'}</td>
        <td class="num" data-l="Combustível">${v.comb?BRL(v.comb):'—'}</td>
        <td class="num" data-l="Despesas">${v.desp?BRL(v.desp):'—'}</td></tr>`).join('')
    + '</tbody>';
  [...el('mTab').querySelectorAll('tbody tr')].forEach((tr,i)=>{ tr.onclick = ()=> gavetaMoto(rankMoto[i][0]); });

  el('mkJ').onclick = ()=> abrirOrigem({
    titulo:'Jornadas fechadas por dia', subtitulo: NUM(fech.length)+' jornadas · '+NUM(km)+' km no período',
    resumoTop:true, colunas:['Dia','Jornadas fechadas','KM'],
    linhas: porDia.map(d=>[fmtData(d.dia), d.jornadas, d.km]),
    nomeCsv:'motoristas-por-dia.csv'
  });
  el('mkKm').onclick = ()=> abrirOrigem({
    titulo:'KM por motorista', subtitulo: NUM(km)+' km no período',
    resumoTop:true, colunas:['Motorista','Jornadas','KM','KM/jornada','Horas'],
    linhas: rankMoto.map(([n,v])=>[n, v.jornadas, v.km, NUM(v.km/Math.max(v.jornadas,1)), motoFmtH(v.horas)]),
    nomeCsv:'motoristas-km.csv'
  });
  el('mkComb').onclick = ()=> abrirOrigem({
    titulo:'Abastecimentos do período', subtitulo: NUM(litros)+' L · '+BRL(comb),
    resumoTop:true, colunas:['Dia','Motorista','Placa','Posto','Litros','R$'],
    linhas: abast.map(a=>[fmtData(a.dia), a.motorista||'—', a.placa||'—', (a.posto||'—').trim(), +a.litros||0, +a.valor||0]),
    nomeCsv:'motoristas-abastecimentos.csv'
  });

  criarGraficoInterativo('mchDia', { type:'bar', data:{ labels:porDia.map(d=>fmtData(d.dia)),
      datasets:[{ label:'KM', data:porDia.map(d=>d.km), backgroundColor:'#f59e0b', borderRadius:6 }]},
    options:{ plugins:{ legend:{ display:false },
        tooltip:{ callbacks:{ label: ctx => NUM(ctx.parsed.y)+' km · '+porDia[ctx.dataIndex].jornadas+' jornadas' } } },
      onClickItem:(i)=>{ const d = porDia[i]; if(!d) return;
        abrirOrigem({ titulo:'Jornadas de '+fmtData(d.dia), subtitulo: NUM(d.km)+' km em '+d.jornadas+' jornadas fechadas',
          resumoTop:true, colunas:['Motorista','Veículo','Roteiro','KM','Horas'],
          linhas: jornadas.filter(j=>j.dia===d.dia && j.status==='fechada').map(j=>[j.motorista||'—', j.veiculo||'—', j.roteiro||'—', +j.km||0, j.horas?NUM(j.horas,1)+'h':'—']),
          nomeCsv:'motoristas-dia-'+d.dia+'.csv' }); } } });
  hintGrafico('mchDia');

  criarGraficoInterativo('mchMoto', { type:'bar',
    data:{ labels:rankMoto.map(([n])=>n.split(' ')[0]+(n.split(' ')[1]?' '+n.split(' ')[1][0]+'.':'')),
      datasets:[{ label:'KM', data:rankMoto.map(([,v])=>v.km), backgroundColor:'#ffd400', borderRadius:6 }]},
    options:{ indexAxis:'y', plugins:{ legend:{ display:false },
        tooltip:{ callbacks:{ label: ctx => { const [,v] = rankMoto[ctx.dataIndex]; return NUM(v.km)+' km · '+v.jornadas+' jornadas · '+motoFmtH(v.horas); } } } },
      onClickItem:(i)=>{ const [n] = rankMoto[i]; if(n) gavetaMoto(n); } } });
  hintGrafico('mchMoto');

  criarGraficoInterativo('mchVeic', { type:'bar',
    data:{ labels:rankVeic.map(([p])=>p),
      datasets:[{ label:'KM', data:rankVeic.map(([,v])=>v.km), backgroundColor:'#0ea5e9', borderRadius:6 }]},
    options:{ indexAxis:'y', plugins:{ legend:{ display:false },
        tooltip:{ callbacks:{ label: ctx => { const [p,v] = rankVeic[ctx.dataIndex]; return p+' · '+NUM(v.km)+' km · '+(v.modelo||''); } } } },
      onClickItem:(i)=>{ const [p] = rankVeic[i]; if(!p) return;
        abrirOrigem({ titulo:'Jornadas do veículo '+p, subtitulo: (porVeic[p].modelo||'')+' · '+NUM(porVeic[p].km)+' km',
          resumoTop:true, colunas:['Dia','Motorista','Roteiro','KM','Horas'],
          linhas: jornadas.filter(j=>j.veiculo===p && j.status==='fechada').map(j=>[fmtData(j.dia), j.motorista||'—', j.roteiro||'—', +j.km||0, j.horas?NUM(j.horas,1)+'h':'—']),
          nomeCsv:'motoristas-veiculo-'+p.replace(/-/g,'')+'.csv' }); } } });
  hintGrafico('mchVeic');
}
