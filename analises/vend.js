// ---------- Vendedores: admin (gerência) ----------
async function abaVendedoresAdmin(){
  const vend = await carregar('ovos_vendedores');
  const vendas = await carregar('ovos_vendas','vendedor_id,valor_venda,valor_recebido,data_venda');
  const comis = await carregar('ovos_comissoes','vendedor_id,competencia,valor_comissao,status');
  const hist = await carregar('ovos_recebidos_historico','vendedor,data_pagamento,valor_pago,cliente','data_pagamento.gte.'+new Date().getFullYear()+'-01-01');
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
  <div class="section-head">
    <h2>Equipe Comercial &amp; Comissões</h2>
    <span class="meta">Gestão de acessos e percentuais</span>
  </div>
  <div class="cardbox">
    <h3>Novo vendedor</h3>
    <div style="display:grid;gap:10px;max-width:460px">
      <input id="vdNome" class="inp" placeholder="Nome do vendedor (como está no ERP)">
      <input id="vdPct" class="inp" type="number" step="0.01" min="0" max="100" placeholder="Comissão %" value="1.0">
      <select id="vdTipo" class="inp">
        <option value="GENERICO">Genérico (sem login — vendas não vinculadas)</option>
        <option value="LOGIN">Com login (acesso pelo celular)</option>
      </select>
      <div id="vdLoginBox" style="display:none">
        <input id="vdEmail" class="inp" placeholder="E-mail de acesso" style="width:100%;margin-bottom:8px">
        <input id="vdSenha" class="inp" type="password" placeholder="Senha inicial" style="width:100%">
      </div>
      <button onclick="criarVendedor()" class="btn-pri">Cadastrar vendedor</button>
      <div id="vdMsg" style="font-size:12px;color:var(--mut);min-height:14px"></div>
    </div>
  </div>
  <div class="cardbox">
    <h3>Vendedores cadastrados — recebido em ${y} (base: recebimentos do ERP)</h3>
    <div class="table-wrap"><table class="tabela-cartao">
      <thead><tr><th>Nome</th><th>Tipo</th><th class="num">Comissão</th><th class="num">Recebido ${y}</th><th class="num">Recebido ${fmtMes(mesAtu)}</th><th class="num">Comissão ${y} (est. ${fmtMes(mesAtu)})</th><th>Status</th><th>Ações</th></tr></thead>
      <tbody>
      ${vend.map(v=>{
        const r=resumo[v.nome]||{hist:0,histMes:0};
        const com = r.hist*(v.comissao_pct/100), comMes = r.histMes*(v.comissao_pct/100);
        const vi = vend.indexOf(v);
        return `<tr data-vend="${vi}" style="cursor:pointer" title="Clique para ver os recebimentos do vendedor"><td data-l="Nome"><b>${v.nome}</b></td><td data-l="Tipo">${v.tipo==='LOGIN'?'Com login':'Genérico'}</td>
        <td class="num"><input id="pct-${v.id}" class="inp" type="number" step="0.01" min="0" max="100" value="${v.comissao_pct}" style="width:74px;padding:5px 7px;text-align:right"> %</td>
        <td class="num" data-l="Recebido ${y}">${BRL(r.hist)}</td><td class="num" data-l="Recebido ${fmtMes(mesAtu)}">${BRL(r.histMes)}</td>
        <td class="num"><b>${BRL(com)}</b> <span style="color:var(--mut)">(${BRL(comMes)})</span></td>
        <td data-l="Status"><span class="badge ${v.ativo?'g':'r'}">${v.ativo?'ATIVO':'BLOQUEADO'}</span></td>
        <td style="white-space:nowrap;display:flex;gap:4px">
          <button onclick="salvaPct(${v.id})" class="btn-sm acc">salvar %</button>
          <button onclick="abaPainelVendedor(${v.id})" class="btn-sm">painel</button>
          <button onclick="toggleVend(${v.id},${v.ativo})" class="btn-sm">${v.ativo?'bloquear':'ativar'}</button>
        </td></tr>`;
      }).join('')}
      </tbody>
    </table></div>
    <div class="callout-info" style="margin-top:10px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:10px 12px;font-size:12px;color:#1e40af">
      <b>Por que a coluna Vendas aparece vazia:</b> a planilha de VENDAS do ERP ainda não foi carregada (pendência combinada). A comissão mostrada é <b>estimada</b> sobre os recebimentos reais do ERP. Quando a planilha chegar, as vendas e a comissão exata por venda entram automaticamente.
    </div>
  </div>`;
  const sel = el('vdTipo');
  if(sel) sel.onchange = ()=> el('vdLoginBox').style.display = sel.value==='LOGIN' ? 'block' : 'none';
  // clique na linha do vendedor: gaveta com os recebimentos dele no ano (dados já em memória)
  vend.forEach((v,vi)=>{
    const tr = document.querySelector(`tr[data-vend="${vi}"]`);
    if(!tr) return;
    tr.onclick = (e)=>{
      if(e.target.closest('button') || e.target.closest('input')) return; // não interceptar ações da linha
      const doVend = hist.filter(h=>h.vendedor===v.nome && h.data_pagamento && h.data_pagamento.startsWith(String(y)))
        .sort((a,b)=>(+b.valor_pago||0)-(+a.valor_pago||0));
      const tot = doVend.reduce((s,h)=>s+(+h.valor_pago||0),0);
      const porCli = {};
      doVend.forEach(h=>{ const c=h.cliente||'—'; porCli[c]=(porCli[c]||0)+(+h.valor_pago||0); });
      const topC = Object.entries(porCli).sort((a,b)=>b[1]-a[1]).slice(0,3);
      abrirOrigem({
        titulo:'Recebimentos de '+v.nome+' ('+y+')',
        subtitulo: doVend.length+' títulos · '+BRL(tot)+' · comissão '+(v.comissao_pct||0)+'% = '+BRL(tot*(v.comissao_pct||0)/100)+' · top: '+topC.map(([c,val])=>c+' '+BRL(val)).join(', '),
        resumoTop:true,
        colunas:['Data Pagamento','Cliente','R$ Valor Pago'],
        linhas: doVend.map(h=>[fmtData(h.data_pagamento), h.cliente||'—', +h.valor_pago||0]),
        nomeCsv:'recebimentos-'+v.nome.toLowerCase().replace(/[^a-z0-9]+/g,'-')+'-'+y+'.csv'
      });
    };
  });
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