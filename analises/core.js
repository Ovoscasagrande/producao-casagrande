const SUPABASE_URL = 'https://ppiqkrvlvtsnsthnfibg.supabase.co';
const SUPABASE_KEY = 'sb_publishable_O9oB4kDpibrJPSoWDlgX-A_yAsQ2znY';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const BRL = n => n==null ? '—' : n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const NUM = (n,d=0) => n==null ? '—' : n.toLocaleString('pt-BR',{maximumFractionDigits:d,minimumFractionDigits:d});
const el = id => document.getElementById(id);
let ME = null, CACHE = {};

Chart.defaults.color = '#9a9a9a';
Chart.defaults.borderColor = 'rgba(42,42,42,.9)';
Chart.defaults.font.family = "-apple-system,'Segoe UI',Roboto,Arial,sans-serif";

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
  const { data: u, error } = await sb.from('usuarios').select('id,nome,perfil,empresa,ativo').eq('id', user.id).maybeSingle();
  if(error || !u || !u.ativo || u.perfil==='pendente' || !['OVOS','AMBAS','TODAS'].includes(u.empresa)){
    await sb.auth.signOut(); status(null);
    el('logErr').textContent = 'Conta sem acesso ao painel OVOS.';
    return;
  }
  ME = u;
  el('loginScreen').style.display='none';
  el('app').style.display='block';
  el('userChip').innerHTML = `<b>${u.nome}</b> · ${u.perfil} <button onclick="logout()">sair</button>`;
  montarAbas();
  await irAba('hoje');
}

async function logout(){ await sb.auth.signOut(); location.reload(); }

sb.auth.onAuthStateChange((ev)=>{
  if(ev==='SIGNED_OUT' && ME){ location.reload(); }
  if(ev==='INITIAL_SESSION'){ sb.auth.getUser().then(({data:{user}})=>{ if(user && !ME) aposLogin(); }); }
});

// ---------- dados ----------
async function carregar(tabla, cols='*'){
  const key = tabla+':'+cols;
  if(CACHE[key]) return CACHE[key];
  status('Carregando '+tabla+'…');
  const { data, error } = await sb.from(tabla).select(cols);
  status(null);
  if(error){ console.error(tabla, error); throw error; }
  CACHE[key] = data;
  return data;
}
const ultimaBase = rows => rows.reduce((m,r)=> r.data_base>m?r.data_base:m, '');

// ---------- abas ----------
const ABAS = [
  ['hoje','Hoje'],['receber','Receber'],['pagar','Pagar'],
  ['producao','Produção'],['compras','Compras'],['clientes','Clientes'],['janela','Janela ERP']
];
let ABA = null;
function montarAbas(){
  el('tabs').innerHTML = ABAS.map(([id,l])=>`<button id="tab-${id}" onclick="irAba('${id}')">${l}</button>`).join('');
}
async function irAba(id){
  ABA = id;
  ABAS.forEach(([k])=> el('tab-'+k).classList.toggle('on', k===id));
  el('conteudo').innerHTML = '<div class="cardbox">Carregando…</div>';
  try{
    if(id==='hoje') await abaHoje();
    else if(id==='receber') await abaReceber();
    else if(id==='pagar') await abaPagar();
    else if(id==='producao') await abaProducao();
    else if(id==='compras') await abaCompras();
    else if(id==='clientes') await abaClientes();
    else if(id==='janela') await abaJanela();
  }catch(e){
    el('conteudo').innerHTML = `<div class="cardbox">Erro ao carregar: ${e.message||e}</div>`;
  }
}
