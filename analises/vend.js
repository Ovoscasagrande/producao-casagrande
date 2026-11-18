// ---------- Vendedores: admin (gerência) ----------
async function abaVendedoresAdmin(){
  const vend = await carregar('ovos_vendedores');
  const vendas = await carregar('ovos_vendas','vendedor_id,valor_venda,valor_recebido,data_venda');
  const comis = await carregar('ovos_comissoes','vendedor_id,competencia,valor_comissao,status');
  const hist = await carregar('ovos_recebidos_historico','vendedor,data_pagamento,valor_pago');
  const agora = new Date();
  const y = agora.getFullYear();
  const mesAtu = `${y}-${String(agora.getMonth()+1).padStart(2,'0')}`;
  const resumo = {};
  vend.forEach(v=> resumo[v.nome] = {venda:0, rec:0, comis:0, prev:0, hist:0, histMes:0});
  vendas.forEach(x=>{ const v = vend.find(z=>z.id===x.vendedor_id); if(!v) return; const r=resumo[v.nome]; r.venda+=+x.valor_venda||0; r.rec+=+x.valor_recebido||0; });
  comis.forEach(c=>{ const v = vend.find(z=>z.id===c.vendedor_id); if(!v) return; const r=resumo[v.nome];
    if(c.status==='GERADA' && c.competencia===mesAtu) r.comis+=+c.valor_comissao||0;
    if(c.status==='PREVISTA') r.prev+=+c.valor_comissao||0; });
  hist.forEach(h=>{ const r=resumo[h.vendedor]; if(!r) return;
    if(h.data_pagamento && h.data_pagamento.startsWith(String(y))){ r.hist+=+h.valor_pago||0; if(h.data_pagamento.startsWith(mesAtu)) r.histMes+=+h.valor_pago||0; } });
  el('conteudo').innerHTML = `
  <div class="cardbox">
    <h3>Novo vendedor</h3>
    <div style="display:grid;gap:8px;max-width:420px">
      <input id="vdNome" placeholder="Nome do vendedor (como está no ERP)" style="background:#000;color:var(--txt);border:1px solid var(--line);border-radius:8px;padding:9px 12px">
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
    <h3>Vendedores cadastrados — recebido em ${y} (base: recebimentos do ERP)</h3>
    <table>
      <tr><th>Nome</th><th>Tipo</th><th class="num">Comissão</th><th class="num">Recebido ${y}</th><th class="num">Recebido ${fmtMes(mesAtu)}</th><th class="num">Comissão ${y} (est. ${fmtMes(mesAtu)})</th><th>Status</th><th></th></tr>
      ${vend.map(v=>{
        const r=resumo[v.nome]||{hist:0,histMes:0};
        const com = r.hist*(v.comissao_pct/100), comMes = r.histMes*(v.comissao_pct/100);
        return `<tr><td>${v.nome}</td><td>${v.tipo==='LOGIN'?'Com login':'Genérico'}</td>
        <td class="num"><input id="pct-${v.id}" type="number" step="0.01" min="0" max="100" value="${v.comissao_pct}" style="width:70px;background:#000;color:var(--txt);border:1px solid var(--line);border-radius:6px;padding:4px 6px;text-align:right"> %</td>
        <td class="num">${BRL(r.hist)}</td><td class="num">${BRL(r.histMes)}</td>
        <td class="num">${BRL(com)} <span style="color:var(--mut)">(${BRL(comMes)})</span></td>
        <td><span class="badge ${v.ativo?'g':'r'}">${v.ativo?'ATIVO':'BLOQUEADO'}</span></td>
        <td style="white-space:nowrap">
          <button onclick="salvaPct(${v.id})" style="background:none;border:1px solid var(--line);color:var(--acc);border-radius:6px;padding:4px 8px;cursor:pointer;font-size:11px">salvar %</button>
          <button onclick="abaPainelVendedor(${v.id})" style="background:none;border:1px solid var(--line);color:var(--txt);border-radius:6px;padding:4px 8px;cursor:pointer;font-size:11px">painel</button>
          <button onclick="toggleVend(${v.id},${v.ativo})" style="background:none;border:1px solid var(--line);color:var(--mut);border-radius:6px;padding:4px 8px;cursor:pointer;font-size:11px">${v.ativo?'bloquear':'ativar'}</button>
        </td></tr>`;
      }).join('')}
    </table>
    <div style="font-size:11px;color:var(--mut);margin-top:8px">Comissão em estimativa sobre recebimentos do ERP enquanto a planilha de vendas não é carregada. Quando carregar, passa a valer a comissão exata por venda.</div>
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
