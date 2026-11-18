// ---------- Vendedores: admin (gerência) ----------
async function abaVendedoresAdmin(){
  const vend = await carregar('ovos_vendedores');
  const vendas = await carregar('ovos_vendas','vendedor_id,valor_venda,valor_recebido,data_venda');
  const comis = await carregar('ovos_comissoes','vendedor_id,competencia,valor_comissao,status');
  const agora = new Date();
  const mesAtu = `${agora.getFullYear()}-${String(agora.getMonth()+1).padStart(2,'0')}`;
  const resumo = {};
  vend.forEach(v=> resumo[v.id] = {venda:0, rec:0, comis:0, prev:0});
  vendas.forEach(x=>{ const r=resumo[x.vendedor_id]; if(!r) return; r.venda+=+x.valor_venda||0; r.rec+=+x.valor_recebido||0; });
  comis.forEach(c=>{ const r=resumo[c.vendedor_id]; if(!r) return;
    if(c.status==='GERADA' && c.competencia===mesAtu) r.comis+=+c.valor_comissao||0;
    if(c.status==='PREVISTA') r.prev+=+c.valor_comissao||0; });
  el('conteudo').innerHTML = `
  <div class="cardbox">
    <h3>Novo vendedor</h3>
    <div style="display:grid;gap:8px;max-width:420px">
      <input id="vdNome" placeholder="Nome do vendedor" style="background:#000;color:var(--txt);border:1px solid var(--line);border-radius:8px;padding:9px 12px">
      <input id="vdPct" type="number" step="0.01" min="0" max="100" placeholder="Comissão %" value="1.0" style="background:#000;color:var(--txt);border:1px solid var(--line);border-radius:8px;padding:9px 12px">
      <select id="vdTipo" style="background:#000;color:var(--txt);border:1px solid var(--line);border-radius:8px;padding:9px 12px">
        <option value="GENERICO">Genérico (sem login — vendas não vinculadas)</option>
        <option value="LOGIN">Com login (acesso pelo celular)</option>
      </select>
      <div id="vdLoginBox" style="display:none">
        <input id="vdEmail" placeholder="E-mail de acesso" style="width:100%;background:#000;color:var(--txt);border:1px solid var(--line);border-radius:8px;padding:9px 12px;margin-bottom:8px">
        <input id="vdSenha" type="password" placeholder="Senha inicial" style="width:100%;background:#000;color:var(--txt);border:1px solid var(--line);border-radius:8px;padding:9px 12px">
      </div>
      <button onclick="criarVendedor()" style="background:var(--acc);color:#000;border:none;border-radius:8px;padding:10px;font-weight:700;cursor:pointer">Cadastrar</button>
      <div id="vdMsg" style="font-size:12px;color:var(--mut);min-height:14px"></div>
    </div>
  </div>
  <div class="cardbox">
    <h3>Vendedores cadastrados</h3>
    <table>
      <tr><th>Nome</th><th>Tipo</th><th class="num">Comissão</th><th class="num">Vendas (R$)</th><th class="num">Recebido (R$)</th><th class="num">Comissão ${fmtMes(mesAtu)}</th><th class="num">Prevista</th><th>Status</th><th></th></tr>
      ${vend.map(v=>{
        const r=resumo[v.id];
        return `<tr><td>${v.nome}</td><td>${v.tipo==='LOGIN'?'Com login':'Genérico'}</td>
        <td class="num"><input id="pct-${v.id}" type="number" step="0.01" min="0" max="100" value="${v.comissao_pct}" style="width:70px;background:#000;color:var(--txt);border:1px solid var(--line);border-radius:6px;padding:4px 6px;text-align:right"> %</td>
        <td class="num">${BRL(r.venda)}</td><td class="num">${BRL(r.rec)}</td>
        <td class="num">${BRL(r.comis)}</td><td class="num">${BRL(r.prev)}</td>
        <td><span class="badge ${v.ativo?'g':'r'}">${v.ativo?'ATIVO':'BLOQUEADO'}</span></td>
        <td style="white-space:nowrap">
          <button onclick="salvaPct(${v.id})" style="background:none;border:1px solid var(--line);color:var(--acc);border-radius:6px;padding:4px 8px;cursor:pointer;font-size:11px">salvar %</button>
          <button onclick="toggleVend(${v.id},${v.ativo})" style="background:none;border:1px solid var(--line);color:var(--mut);border-radius:6px;padding:4px 8px;cursor:pointer;font-size:11px">${v.ativo?'bloquear':'ativar'}</button>
        </td></tr>`;
      }).join('')}
    </table>
  </div>`;
  const sel = el('vdTipo');
  if(sel) sel.onchange = ()=> el('vdLoginBox').style.display = sel.value==='LOGIN' ? 'block' : 'none';
}

// cria vendedor; se LOGIN, cria a conta de acesso (signup em cliente separado, sem derrubar sua sessão)
async function criarVendedor(){
  const nome = el('vdNome').value.trim();
  const pct = parseFloat(el('vdPct').value);
  const tipo = el('vdTipo').value;
  const msg = el('vdMsg');
  if(!nome){ msg.textContent='Informe o nome.'; return; }
  if(isNaN(pct) || pct<0 || pct>100){ msg.textContent='Comissão inválida.'; return; }
  let usuario_id = null;
  if(tipo==='LOGIN'){
    const email = el('vdEmail').value.trim().toLowerCase();
    const senha = el('vdSenha').value;
    if(!email || senha.length<6){ msg.textContent='Informe e-mail e senha (mín. 6 caracteres).'; return; }
    status('Criando conta de acesso…');
    const sb2 = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    const { data: nu, error: e1 } = await sb2.auth.signUp({ email, password: senha });
    status(null);
    if(e1){ msg.textContent = 'Conta não criada: '+(e1.message||e1); return; }
    if(!nu || !nu.user){ msg.textContent = 'Conta não retornou usuário (verifique se o e-mail já não existe).'; return; }
    usuario_id = nu.user.id;
  }
  status('Salvando…');
  const { error: e2 } = await sb.from('ovos_vendedores').insert({ nome, comissao_pct:pct, tipo, usuario_id });
  status(null);
  if(e2){ msg.textContent = 'Erro: '+(e2.message||e2); return; }
  limparCache();
  status(tipo==='LOGIN' ? 'Vendedor criado com acesso ✓' : 'Vendedor criado ✓');
  setTimeout(status, 2500, null);
  await abaVendedoresAdmin();
}

async function salvaPct(id){
  const pct = parseFloat(el('pct-'+id).value);
  if(isNaN(pct) || pct<0 || pct>100){ status('Comissão inválida'); return; }
  status('Salvando…');
  const { error } = await sb.from('ovos_vendedores').update({ comissao_pct:pct }).eq('id', id);
  status(null);
  status(error ? ('Erro: '+error.message) : 'Comissão atualizada ✓');
  if(!error){ limparCache(); setTimeout(status, 2500, null); }
}

async function toggleVend(id, ativo){
  status('Atualizando…');
  const { error } = await sb.from('ovos_vendedores').update({ ativo: !ativo }).eq('id', id);
  status(null);
  if(error){ status('Erro: '+error.message); return; }
  limparCache(); await abaVendedoresAdmin();
}

// ---------- Painel do vendedor (mobile-first) ----------
async function abaPainelVendedor(vendId){
  const vend = await carregar('ovos_vendedores');
  const v = vendId ? vend.find(x=>x.id===vendId) : vend.find(x=>x.id===ME.vend_id);
  if(!v){ el('conteudo').innerHTML='<div class="cardbox">Vendedor não encontrado.</div>'; return; }
  const vendas = (await carregar('ovos_vendas')).filter(r=>r.vendedor_id===v.id);
  const comis = (await carregar('ovos_comissoes')).filter(r=>r.vendedor_id===v.id);
  const hoje = new Date();
  const y = hoje.getFullYear();
  const mesAtu = `${y}-${String(hoje.getMonth()+1).padStart(2,'0')}`;
  const mesAnt = new Date(y, hoje.getMonth()-1, 1);
  const mesAntK = `${mesAnt.getFullYear()}-${String(mesAnt.getMonth()+1).padStart(2,'0')}`;
  const soma = (arr,f) => arr.reduce((s,r)=>s+(+r[f]||0),0);
  const vendasMes = k => soma(vendas.filter(r=>r.data_venda && r.data_venda.startsWith(k)),'valor_venda');
  const recMes = k => soma(vendas.filter(r=>r.data_venda && r.data_venda.startsWith(k)),'valor_recebido');
  const porMesV = {}, porMesC = {}, porMesR = {};
  vendas.forEach(r=>{ if(!r.data_venda) return; const k=r.data_venda.slice(0,7);
    porMesV[k]=(porMesV[k]||0)+(+r.valor_venda||0); porMesR[k]=(porMesR[k]||0)+(+r.valor_recebido||0); });
  comis.filter(c=>c.status==='GERADA').forEach(c=>{ if(!c.competencia) return; const k=c.competencia.slice(0,7);
    porMesC[k]=(porMesC[k]||0)+(+c.valor_comissao||0); });
  const meses = [...new Set([...Object.keys(porMesV), ...Object.keys(porMesC)])].sort();
  const comisMes = k => porMesC[k]||0;
  const comisPrev = soma(comis.filter(c=>c.status==='PREVISTA'),'valor_comissao');
  const anoV = soma(vendas.filter(r=>r.data_venda && r.data_venda.startsWith(String(y))),'valor_venda');

  // desempenho
  const porProd = {}, porCli = {}, porPerfil = {};
  vendas.forEach(r=>{
    const p = r.produto||'—'; porProd[p]=porProd[p]||{v:0,m:0}; porProd[p].v+=+r.valor_venda||0; porProd[p].m+=+r.margem_valor||0;
    const c = r.cliente||'—'; porCli[c]=porCli[c]||{v:0,rec:0}; porCli[c].v+=+r.valor_venda||0; porCli[c].rec+=+r.valor_recebido||0;
    const pf = r.cliente_perfil||'—'; porPerfil[pf]=(porPerfil[pf]||0)+(+r.valor_venda||0);
  });
  const topProd = Object.entries(porProd).sort((a,b)=>b[1].v-a[1].v).slice(0,10);
  const topCli = Object.entries(porCli).sort((a,b)=>b[1].v-a[1].v).slice(0,10);
  const margemReal = anoV ? (soma(vendas.filter(r=>r.data_venda&&r.data_venda.startsWith(String(y))),'margem_valor')/anoV*100) : null;

  el('conteudo').innerHTML = `
  <div class="kpis">
    <div class="kpi"><div class="l">Vendas ${fmtMes(mesAtu)}</div><div class="v">${BRL(vendasMes(mesAtu))}</div></div>
    <div class="kpi"><div class="l">Vendas ${fmtMes(mesAntK)}</div><div class="v">${BRL(vendasMes(mesAntK))}</div></div>
    <div class="kpi"><div class="l">Vendas do ano</div><div class="v" style="color:var(--acc)">${BRL(anoV)}</div></div>
    <div class="kpi"><div class="l">Comissão ${fmtMes(mesAtu)}</div><div class="v" style="color:var(--ok)">${BRL(comisMes(mesAtu))}</div><div class="s">sobre recebido</div></div>
    <div class="kpi"><div class="l">Comissão ${fmtMes(mesAntK)}</div><div class="v">${BRL(comisMes(mesAntK))}</div></div>
    <div class="kpi"><div class="l">Comissão prevista</div><div class="v" style="color:var(--bad)">${BRL(comisPrev)}</div><div class="s">vendas ainda não recebidas</div></div>
    <div class="kpi"><div class="l">Recebido ${fmtMes(mesAtu)}</div><div class="v">${BRL(recMes(mesAtu))}</div></div>
    <div class="kpi"><div class="l">Margem real ${y}</div><div class="v">${margemReal==null?'—':margemReal.toFixed(1)+'%'}</div></div>
  </div>
  <div class="cardbox"><h3>Vendas × recebido × comissão por mês</h3><canvas id="chVM"></canvas></div>
  <div class="cardbox"><h3>Comissões por mês</h3><canvas id="chCM"></canvas></div>
  <div class="two">
  <div class="cardbox"><h3>Top produtos</h3>
    <table><tr><th>Produto</th><th class="num">Vendas</th><th class="num">Margem</th></tr>
    ${topProd.map(([p,d])=>`<tr><td>${p}</td><td class="num">${BRL(d.v)}</td><td class="num">${d.v? (d.m/d.v*100).toFixed(1)+'%':'—'}</td></tr>`).join('')}
    </table></div>
  <div class="cardbox"><h3>Top clientes</h3>
    <table><tr><th>Cliente</th><th class="num">Vendas</th><th class="num">Recebido</th></tr>
    ${topCli.map(([c,d])=>`<tr><td>${c}</td><td class="num">${BRL(d.v)}</td><td class="num">${BRL(d.rec)}</td></tr>`).join('')}
    </table></div>
  </div>
  <div class="cardbox"><h3>Vendas por perfil de cliente</h3><canvas id="chPF"></canvas></div>`;

  new Chart(el('chVM'), { type:'bar', data:{ labels:meses.map(fmtMes), datasets:[
    { label:'Vendas', data:meses.map(k=>porMesV[k]||0), backgroundColor:'#ffd400' },
    { label:'Recebido', data:meses.map(k=>porMesR[k]||0), backgroundColor:'#4caf50' },
  ]}, options:{ plugins:{ legend:{ labels:{ boxWidth:12 } } } } });
  new Chart(el('chCM'), { type:'line', data:{ labels:meses.map(fmtMes), datasets:[
    { label:'Comissão gerada', data:meses.map(k=>porMesC[k]||0), borderColor:'#4caf50', tension:.3 },
  ]}, options:{ plugins:{ legend:{ labels:{ boxWidth:12 } } } } });
  const pfOrd = Object.entries(porPerfil).sort((a,b)=>b[1]-a[1]);
  new Chart(el('chPF'), { type:'bar', data:{ labels:pfOrd.map(x=>x[0]), datasets:[{ label:'Vendas', data:pfOrd.map(x=>x[1]), backgroundColor:'#ffd400' }] },
    options:{ indexAxis:'y', plugins:{ legend:{display:false} } } });
}
