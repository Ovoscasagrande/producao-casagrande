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

// ---------- abas ----------
function abasDoUsuario(){
  if(ME.tipo==='VENDEDOR') return [['meuvend','Meu painel']];
  return [
    ['hoje','Hoje'],['receber','Receber'],['pagar','Pagar'],
    ['producao','Produção'],['compras','Compras'],['clientes','Clientes'],
    ['janela','Janela ERP'],['vendedores','Vendedores']
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
    else if(id==='meuvend') await abaPainelVendedor(null);
  }catch(e){
    el('conteudo').innerHTML = `<div class="cardbox" style="color:var(--bad)">Erro ao carregar: ${e.message||e}</div>`;
  }
}
