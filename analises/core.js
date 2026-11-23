const SUPABASE_URL = 'https://ppiqkrvlvtsnsthnfibg.supabase.co';
const SUPABASE_KEY = 'sb_publishable_O9oB4kDpibrJPSoWDlgX-A_yAsQ2znY';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const BRL = n => n==null ? '—' : n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const NUM = (n,d=0) => n==null ? '—' : n.toLocaleString('pt-BR',{maximumFractionDigits:d,minimumFractionDigits:d});
const el = id => document.getElementById(id);
let ME = null, CACHE = {};

Chart.defaults.color = '#475569';
Chart.defaults.borderColor = 'rgba(226,232,240,.9)';
Chart.defaults.font.family = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif";
Chart.defaults.plugins.tooltip.backgroundColor = '#0f172a';
Chart.defaults.plugins.tooltip.titleColor = '#f8fafc';
Chart.defaults.plugins.tooltip.bodyColor = '#e2e8f0';
Chart.defaults.plugins.tooltip.padding = 10;
Chart.defaults.plugins.tooltip.cornerRadius = 8;

function status(msg){ const s=el('status'); if(!msg){s.style.display='none';return;} s.textContent=msg; s.style.display='block'; }

async function doLogin(){
  const email = el('logEmail').value.trim().toLowerCase();
  const pass = el('logPass').value;
  el('logErr').textContent = '';
  if(!email || !pass){ el('logErr').textContent='Informe e-mail e senha.'; return; }
  status('Entrando…');
  const { error } = await sb.auth.signInWithPassword({ email, password: pass });
  if(error){ status(null); el('logErr').textContent = 'E-mail ou senha incorretos.'; return; }
  await aposLogin();
}

async function aposLogin(){
  const { data:{ user } } = await sb.auth.getUser();
  if(!user){ status(null); return; }
  // 1) usuário do app CASAGRANDE (gerência)?
  const { data: u } = await sb.from('usuarios').select('id,nome,perfil,empresa,ativo').eq('id', user.id).maybeSingle();
  if(u && u.ativo && u.perfil!=='pendente' && ['OVOS','AMBAS','TODAS'].includes(u.empresa)){
    ME = { id:user.id, nome:u.nome, perfil:u.perfil, empresa:u.empresa, ativo:true, tipo:'GERENCIA' };
  } else {
    // 2) vendedor com login próprio?
    const { data: v } = await sb.from('ovos_vendedores').select('id,nome,comissao_pct,tipo,ativo').eq('usuario_id', user.id).maybeSingle();
    if(!v || !v.ativo){
      await sb.auth.signOut(); status(null);
      el('logErr').textContent = 'Conta sem acesso ao painel OVOS.';
      return;
    }
    ME = { id:user.id, nome:v.nome, perfil:'vendedor', empresa:'OVOS', ativo:true, vend_id:v.id, tipo:'VENDEDOR' };
  }
  el('loginScreen').style.display='none';
  el('app').style.display='block';
  el('userChip').innerHTML = `<b>${ME.nome}</b> · <span>${ME.perfil}</span> <button onclick="logout()">sair</button>`;
  montarAbas();
  await irAba(ME.tipo==='VENDEDOR' ? 'meuvend' : 'hoje');
}

async function logout(){ await sb.auth.signOut(); location.reload(); }

sb.auth.onAuthStateChange((ev)=>{
  if(ev==='SIGNED_OUT' && ME){ location.reload(); }
  if(ev==='INITIAL_SESSION'){ sb.auth.getUser().then(({data:{user}})=>{ if(user && !ME) aposLogin(); }); }
});

// ---------- dados ----------
async function carregar(tabla, cols='*', filtro=null){
  const key = tabla+':'+cols+':'+(filtro||'');
  if(CACHE[key]) return CACHE[key];
  status('Carregando '+tabla+'…');
  // PostgREST devolve no máx 1000 linhas por chamada — paginar com range()
  const PAG = 1000;
  let all = [], from = 0;
  while(true){
    let q = sb.from(tabla).select(cols);
    if(filtro) q = q.or(filtro);
    const { data, error } = await q.range(from, from + PAG - 1);
    if(error){ console.error(tabla, error); status(null); throw error; }
    all = all.concat(data || []);
    if(!data || data.length < PAG) break;
    from += PAG;
    if(from > 200000) break; // trava de segurança
  }
  status(null);
  CACHE[key] = all;
  return all;
}
function limparCache(){ CACHE = {}; }
const ultimaBase = rows => rows.reduce((m,r)=> r.data_base>m?r.data_base:m, '');
const fmtData = d => d ? d.split('-').reverse().join('/') : '—';
const MESN = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
const fmtMes = ym => { const [a,b]=ym.split('-'); return `${MESN[+b-1]}/${a.slice(2)}`; };

// ---------- exportação CSV ----------
function baixarCSV(nome, linhas){
  const csv = linhas.map(r => r.map(x => {
    const s = String(x ?? '');
    return /[;",\n]/.test(s) ? '"'+s.replace(/"/g,'""')+'"' : s;
  }).join(';')).join('\n');
  const blob = new Blob(['\ufeff'+csv], {type:'text/csv;charset=utf-8'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nome;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ---------- gaveta de origem (drill-down) ----------
let DW_CFG = null;
function fecharOrigem(){
  el('drawerAnalise').classList.remove('on');
  el('drawerOverlay').classList.remove('on');
  DW_CFG = null;
}
function abrirOrigem(cfg){
  // cfg: { titulo, subtitulo, resumoTop, colunas, linhas, nomeCsv, extra, extra2, ... }
  DW_CFG = cfg;
  el('dwTitulo').textContent = cfg.titulo || 'Origem';
  el('dwSub').textContent = cfg.subtitulo || '';
  const colunas = cfg.colunas || [], linhas = cfg.linhas || [];
  // colunas numéricas = todas as linhas têm valor number não-nulo
  const numCols = colunas.map((c,i)=> linhas.length && linhas.every(r => typeof r[i]==='number') ? i : -1).filter(i=>i>=0);
  // mini-resumo: top 3 maiores pela 1ª coluna numérica
  const res = el('dwResumo');
  if(cfg.resumoTop && numCols.length){
    const ni = numCols[0];
    const top = [...linhas].sort((a,b)=> Math.abs(b[ni])-Math.abs(a[ni])).slice(0,3);
    const fmt = v => colunas[ni].toLowerCase().includes('r$')||colunas[ni].toLowerCase().includes('valor') ? BRL(v) : NUM(v,1);
    res.innerHTML = top.map(r=>`<div class="dw-ri"><span>${String(r[0])}</span><b>${fmt(r[ni])}</b></div>`).join('');
    res.classList.add('on');
  } else { res.innerHTML=''; res.classList.remove('on'); }
  // tabela (classe .tabela-cartao + data-l para o mobile)
  const tab = el('dwTab');
  tab.className = 'tabela-cartao';
  tab.innerHTML = '<thead><tr>'+colunas.map((c,i)=>`<th${numCols.includes(i)?' class="num"':''}>${c}</th>`).join('')+'</tr></thead>'
    + '<tbody>'+linhas.map(r=>'<tr>'+r.map((v,i)=>`<td${numCols.includes(i)?' class="num"':''} data-l="${colunas[i]}">${fmtCelula(v,colunas[i])}</td>`).join('')+'</tr>').join('')+'</tbody>';
  // rodapé com totalização automática das colunas numéricas
  const tot = numCols.map(i=>{
    const soma = linhas.reduce((s,r)=>s+(r[i]||0),0);
    const fmt = colunas[i].toLowerCase().includes('r$')||colunas[i].toLowerCase().includes('valor') ? BRL : NUM;
    return `<span>${colunas[i]}: <b>${fmt(soma)}</b></span>`;
  }).join('');
  el('dwFoot').innerHTML = `<span>${NUM(linhas.length)} registro${linhas.length===1?'':'s'}</span>${tot}`;
  // CSV
  el('dwCsv').onclick = ()=> baixarCSV(cfg.nomeCsv || 'recorte.csv', [colunas, ...linhas]);
  // visões extras (ex.: resumo por produto + lançamentos diários) — alternador interno
  // formato: extra:{titulo2,colunas2,linhas2,nomeCsv2}, extra2:{...}, extra3:{...} (N visões)
  const extras = [];
  if(cfg.extra) extras.push(cfg.extra);
  for(let e=2; e<=9; e++){ const x = cfg['extra'+e]; if(x) extras.push(x); }
  const headEl = el('drawerAnalise').querySelector('.dw-head');
  let tabsEl = el('dwTabs');
  if(!tabsEl){ tabsEl = document.createElement('div'); tabsEl.id='dwTabs'; tabsEl.className='dw-tabs'; headEl.after(tabsEl); }
  if(!extras.length){ tabsEl.style.display='none'; tabsEl.innerHTML=''; }
  else{
    tabsEl.style.display='flex';
    const visoes = [{ titulo:'Visão 1', colunas, linhas, nomeCsv:cfg.nomeCsv }, ...extras.map(x=>({titulo:x.titulo2||'Visão', colunas:x.colunas2, linhas:x.linhas2, nomeCsv:x.nomeCsv2}))];
    tabsEl.innerHTML = visoes.map((v,i)=>`<button class="${i===0?'on':''}" data-v="${i}">${v.titulo}</button>`).join('');
    const mostrar = (vi)=>{
      const v = visoes[vi];
      tabsEl.querySelectorAll('button').forEach((b,j)=>b.classList.toggle('on', j===vi));
      const numCols2 = v.colunas.map((c,i)=> v.linhas.length && v.linhas.every(r => typeof r[i]==='number') ? i : -1).filter(i=>i>=0);
      el('dwTab').innerHTML = '<thead><tr>'+v.colunas.map((c,i)=>`<th${numCols2.includes(i)?' class="num"':''}>${c}</th>`).join('')+'</tr></thead>'
        + '<tbody>'+v.linhas.map(r=>'<tr>'+r.map((x,i)=>`<td${numCols2.includes(i)?' class="num"':''} data-l="${v.colunas[i]}">${fmtCelula(x,v.colunas[i])}</td>`).join('')+'</tr>').join('')+'</tbody>';
      const tot2 = numCols2.map(i=>{
        const soma2 = v.linhas.reduce((s,r)=>s+(r[i]||0),0);
        const fmt2 = v.colunas[i].toLowerCase().includes('r$')||v.colunas[i].toLowerCase().includes('valor') ? BRL : NUM;
        return `<span>${v.colunas[i]}: <b>${fmt2(soma2)}</b></span>`;
      }).join('');
      el('dwFoot').innerHTML = `<span>${NUM(v.linhas.length)} registro${v.linhas.length===1?'':'s'}</span>${tot2}`;
      el('dwCsv').onclick = ()=> baixarCSV(v.nomeCsv || 'recorte.csv', [v.colunas, ...v.linhas]);
    };
    tabsEl.querySelectorAll('button').forEach(b=> b.onclick = ()=> mostrar(+b.getAttribute('data-v')));
    mostrar(0);
  }
  el('drawerOverlay').classList.add('on');
  el('drawerAnalise').classList.add('on');
}
function fmtCelula(v, col){
  if(v==null) return '—';
  if(typeof v==='number'){
    const c=(col||'').toLowerCase();
    if(c.includes('r$')||c.includes('valor')||c.includes('saldo')) return BRL(v);
    if(c.includes('%')) return NUM(v,1)+'%';
    if(c.includes('data')||c.includes('venc')) return fmtData(String(v));
    return NUM(v, c.includes('cx')||c.includes('caixa')?1:0);
  }
  return String(v);
}
document.addEventListener('keydown', e=>{ if(e.key==='Escape' && el('drawerAnalise').classList.contains('on')) fecharOrigem(); });

// ---------- chip de filtro ativo ----------
function renderChipFiltro(containerId, labelFiltro, onLimpar){
  const c = el(containerId);
  if(!c) return;
  if(!labelFiltro){ c.classList.remove('on'); c.innerHTML=''; return; }
  c.classList.add('on');
  c.innerHTML = `<span class="pill">Filtrando por: <b>${labelFiltro}</b> <button aria-label="Limpar filtro" title="Limpar filtro">✕</button></span>`;
  c.querySelector('button').onclick = ()=>{ c.classList.remove('on'); c.innerHTML=''; if(onLimpar) onLimpar(); };
}

// ---------- gráficos interativos ----------
const GRAFICOS = {}; // canvasId -> instância Chart (destruída antes de recriar)
function criarGraficoInterativo(canvasId, config){
  const cv = el(canvasId);
  if(!cv) return null;
  if(GRAFICOS[canvasId]){ GRAFICOS[canvasId].destroy(); delete GRAFICOS[canvasId]; }
  const orfa = Chart.getChart(cv); // instância criada fora do wrapper (new Chart direto)
  if(orfa) orfa.destroy();
  // clone preservando TODAS as funções (JSON.stringify descartaria callbacks aninhados)
  const preservar = (orig, clone) => {
    for(const k in orig){
      if(typeof orig[k]==='function'){ clone[k] = orig[k]; }
      else if(orig[k] && typeof orig[k]==='object' && clone[k] && typeof clone[k]==='object'){ preservar(orig[k], clone[k]); }
    }
  };
  const cfg = JSON.parse(JSON.stringify(config));
  preservar(config, cfg);
  // visual padrão da marca
  cfg.options = cfg.options || {};
  cfg.options.animation = Object.assign({ duration:450, easing:'easeOutQuart' }, cfg.options.animation||{});
  cfg.options.responsive = true;
  // interação/clique: mode index + intersect false garante que clicar/tocar em QUALQUER
  // altura da coluna/linha captura o índice (essencial em barras baixas e no celular).
  // axis: 'y' em barras horizontais (indexAxis:'y'), 'x' no resto.
  const horiz = cfg.options.indexAxis === 'y';
  cfg.options.interaction = Object.assign({ mode:'index', intersect:false }, cfg.options.interaction||{});
  if(!cfg.options.interaction.axis) cfg.options.interaction.axis = horiz ? 'y' : 'x';
  // NÃO forçar maintainAspectRatio:false: os canvas existentes usam atributo height
  // e dependem do aspect-ratio padrão do Chart.js — só aplicar se o config pedir.
  // gradientes verticais suaves nas barras (cores da marca)
  const marca = [getComputedStyle(document.documentElement).getPropertyValue('--acc-bright').trim()||'#ffd400',
                 getComputedStyle(document.documentElement).getPropertyValue('--acc').trim()||'#f59e0b'];
  const grad = (ctx, area)=>{ const g=ctx.createLinearGradient(0,area.bottom,0,area.top); g.addColorStop(0,marca[0]+'55'); g.addColorStop(1,marca[1]); return g; };
  (cfg.data.datasets||[]).forEach(ds=>{
    if((ds.type||cfg.type)==='bar' && !ds.backgroundColor){
      ds.borderRadius = 6;
      ds.backgroundColor = c=>{ const {ctx,chartArea}=c.chart; return chartArea ? grad(ctx,chartArea) : marca[1]; };
    }
  });
  // cursor pointer quando houver elemento sob o mouse
  const onClickItem = cfg.options.onClickItem;
  cfg.options.onHover = (e, els)=>{
    e.native.target.style.cursor = els.length && onClickItem ? 'pointer' : 'default';
  };
  if(onClickItem){
    cfg.options.onClick = (e, els)=>{
      if(!els.length) return;
      const i = els[0].index, d = els[0].datasetIndex;
      const label = cfg.data.labels ? cfg.data.labels[i] : i;
      onClickItem(i, label, d);
    };
  }
  const inst = new Chart(cv, cfg);
  // Chart.js v4 normaliza options.onClick (função -> objeto interno); expõe de volta p/ testes e uso externo
  if(onClickItem) inst.options.onClick = cfg.options.onClick;
  GRAFICOS[canvasId] = inst;
  return inst;
}
// subtítulo discreto "Toque/clique para ver a origem" no rodapé do card do gráfico
function hintGrafico(canvasId, texto){
  const cv = el(canvasId);
  if(!cv) return;
  const card = cv.closest('.cardbox');
  if(!card) return;
  const head = card.querySelector('.cardbox-head');
  const hint = document.createElement('span');
  hint.className = 'hint';
  hint.textContent = texto || '👆 toque/clique para ver a origem';
  (head || card).appendChild(hint);
}

// ---------- abas ----------
function abasDoUsuario(){
  if(ME.tipo==='VENDEDOR') return [['meuvend','Meu painel']];
  return [
    ['hoje','Hoje'],['receber','Receber'],['pagar','Pagar'],
    ['producao','Produção'],['compras','Compras'],['clientes','Clientes'],
    ['janela','Janela ERP'],['vendedores','Vendedores'],['transportadora','Transportadora']
  ];
}
let ABA = null;
function montarAbas(){
  const abas = abasDoUsuario();
  el('tabs').innerHTML = abas.map(([id,l])=>`<button id="tab-${id}" onclick="irAba('${id}')">${l}</button>`).join('');
}
async function irAba(id){
  ABA = id;
  abasDoUsuario().forEach(([k])=>{ const b=el('tab-'+k); if(b) b.classList.toggle('on', k===id); });
  el('conteudo').innerHTML = '<div class="cardbox" style="color:var(--mut)">Carregando indicadores…</div>';
  try{
    if(id==='hoje') await abaHoje();
    else if(id==='receber') await abaReceber();
    else if(id==='pagar') await abaPagar();
    else if(id==='producao') await abaProducao();
    else if(id==='compras') await abaCompras();
    else if(id==='clientes') await abaClientes();
    else if(id==='janela') await abaJanela();
    else if(id==='vendedores') await abaVendedoresAdmin();
    else if(id==='transportadora') await abaTransportadora();
    else if(id==='meuvend') await abaPainelVendedor(null);
  }catch(e){
    el('conteudo').innerHTML = `<div class="cardbox" style="color:var(--bad)">Erro ao carregar: ${e.message||e}</div>`;
  }
}