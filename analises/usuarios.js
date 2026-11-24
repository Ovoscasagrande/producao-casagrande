// ---------- Aba Usuários (somente gerência master) ----------
// Perfis dinâmicos: tabela painel_perfis (perfil -> abas). Usuário tem painel_perfil
// + painel_perfis_extra (abas somadas). SEPARADO do perfil do app CASAGRANDE (coluna 'perfil')
// — o app do CASA usa o menu por 'perfil' e ignora estas colunas.
const ABAS_DISPONIVEIS = [
  ['hoje','Hoje'],['receber','Receber'],['pagar','Pagar'],['producao','Produção'],
  ['compras','Compras'],['clientes','Clientes'],['janela','Janela ERP'],
  ['vendedores','Vendedores'],['usuarios','Usuários'],['cobranca','Cobrança'],['transportadora','Transportadora'],['motoristas','Motoristas']
];

async function abaUsuarios(){
  const [us, perfis] = await Promise.all([
    carregar('usuarios','id,email,nome,perfil,painel_perfil,painel_perfis_extra,ativo,is_master,criado_em'),
    carregar('painel_perfis','perfil,descricao,abas,sistema')
  ]);
  const souMaster = ME.is_master || ME.perfil==='gerencia_master';
  el('conteudo').innerHTML = `
  <div class="section-head">
    <h2>Usuários &amp; Acessos</h2>
    <span class="meta">${souMaster?'você gerencia quem vê o quê':'somente leitura'}</span>
  </div>
  <div class="kpis">
    <div class="kpi k-gold"><div class="l">Usuários</div><div class="v">${us.length}</div><div class="s">${us.filter(u=>u.ativo).length} ativos</div></div>
    <div class="kpi k-bad"><div class="l">Pendentes de aprovação</div><div class="v" style="color:var(--bad)">${us.filter(u=>u.perfil==='pendente' && !u.painel_perfil).length}</div><div class="s">cadastros aguardando você</div></div>
    <div class="kpi k-slate"><div class="l">Perfis</div><div class="v">${perfis.length}</div><div class="s">dinâmicos — edite as abas de cada um</div></div>
  </div>

  <div class="cardbox">
    <div class="cardbox-head"><h3>Perfis e abas de cada perfil</h3><span class="hint">o usuário vê as abas do perfil principal + perfis extra</span></div>
    <div id="perfisBox"></div>
    ${souMaster?`<div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;align-items:center">
      <input id="npNome" class="inp" placeholder="novo perfil (ex.: estoque)" style="width:200px">
      <button class="btn-pri" onclick="criarPerfil()">criar perfil</button>
    </div>`:''}
  </div>

  <div class="cardbox">
    <div class="cardbox-head"><h3>Usuários cadastrados</h3><span class="hint">clique no usuário para editar perfil, extras e status</span></div>
    <div class="table-wrap"><table class="tabela-cartao"><thead><tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Abas extras</th><th>Status</th></tr></thead><tbody id="usBody"></tbody></table></div>
  </div>`;

  renderPerfis(perfis, souMaster);
  renderUsuarios(us, perfis, souMaster);
}

function renderPerfis(perfis, souMaster){
  el('perfisBox').innerHTML = `<div class="table-wrap"><table class="tabela-cartao"><thead><tr><th>Perfil</th><th>Descrição</th><th>Abas liberadas</th></tr></thead><tbody>
  ${perfis.map(p=>`<tr><td data-l="Perfil"><b>${p.perfil}</b>${p.sistema?' <span style="color:var(--mut);font-size:10px">(sistema)</span>':''}</td>
    <td data-l="Descrição">${p.descricao||'—'}</td>
    <td data-l="Abas">${souMaster
      ? `<div style="display:flex;gap:4px;flex-wrap:wrap">${ABAS_DISPONIVEIS.map(([id,l])=>
          `<label style="font-size:11px;display:inline-flex;align-items:center;gap:3px;border:1px solid var(--line);border-radius:12px;padding:2px 8px;cursor:pointer;background:${(p.abas||[]).includes(id)?'var(--acc-soft)':'#fff'}">
            <input type="checkbox" data-perfil="${p.perfil}" data-aba="${id}" ${(p.abas||[]).includes(id)?'checked':''} style="margin:0"> ${l}</label>`).join('')}</div>`
      : (p.abas||[]).map(id=>{ const a=ABAS_DISPONIVEIS.find(x=>x[0]===id); return `<span class="badge y">${a?a[1]:id}</span>`; }).join(' ')||'—'}</td></tr>`).join('')}
  </tbody></table></div>`;
  if(souMaster){
    el('perfisBox').querySelectorAll('input[type=checkbox]').forEach(ch=>{
      ch.onchange = ()=> salvaPerfilAba(ch.getAttribute('data-perfil'), ch.getAttribute('data-aba'), ch.checked);
    });
  }
}

async function salvaPerfilAba(perfil, aba, ligar){
  const perfis = await carregar('painel_perfis','perfil,descricao,abas,sistema');
  const p = perfis.find(x=>x.perfil===perfil);
  if(!p) return;
  let abas = p.abas||[];
  abas = ligar ? [...new Set([...abas, aba])] : abas.filter(a=>a!==aba);
  status('Salvando…');
  const { error } = await sb.from('painel_perfis').update({ abas }).eq('perfil', perfil);
  status(null);
  if(error){ status('Erro: '+error.message); return; }
  limparCache();
  status('Perfil "'+perfil+'" atualizado ✓ — recarregue para valer nos acessos'); setTimeout(status,3000,null);
}

async function criarPerfil(){
  const nome = el('npNome').value.trim().toLowerCase().replace(/\s+/g,'_');
  if(!nome){ status('Dê um nome ao perfil'); return; }
  status('Criando…');
  const { error } = await sb.from('painel_perfis').insert({ perfil:nome, descricao:'perfil criado por '+ME.nome, abas:[] });
  status(null);
  if(error){ status('Erro: '+error.message); return; }
  limparCache(); irAba('usuarios');
}

function renderUsuarios(us, perfis, souMaster){
  const pendentes = us.filter(u=>u.perfil==='pendente' && !u.painel_perfil);
  const semPainel = us.filter(u=>u.perfil!=='pendente' && !u.painel_perfil);
  const normais = us.filter(u=>u.painel_perfil);
  el('usBody').innerHTML =
    pendentes.map(u=>`<tr style="background:var(--bad-bg)"><td data-l="Nome"><b>${u.nome||'—'}</b> <span class="badge r">PENDENTE</span></td>
      <td data-l="E-mail">${u.email||'—'}</td><td data-l="Perfil">aguardando aprovação</td><td data-l="Extras">—</td>
      <td data-l="Status">${souMaster?`<button class="btn-sm acc" onclick="aprovarUsuario('${u.id}')">aprovar e definir perfil</button>`:'—'}</td></tr>`).join('')
    + normais.map(u=>{
      const extras = (u.painel_perfis_extra||[]).join(', ')||'—';
      return `<tr data-u="${u.id}" style="cursor:pointer"><td data-l="Nome"><b>${u.nome||'—'}</b>${u.painel_perfil==='gerencia_master'?' <span class="badge y">MASTER</span>':''}</td>
      <td data-l="E-mail">${u.email||'—'}</td><td data-l="Perfil">${u.painel_perfil}</td><td data-l="Extras">${extras}</td>
      <td data-l="Status"><span class="badge ${u.ativo?'g':'r'}">${u.ativo?'ATIVO':'BLOQUEADO'}</span></td></tr>`;
    }).join('')
    + semPainel.map(u=>`<tr style="opacity:.6"><td data-l="Nome">${u.nome||'—'}</td><td data-l="E-mail">${u.email||'—'}</td>
      <td data-l="Perfil">${u.perfil} (app CASAGRANDE)</td><td data-l="Extras">—</td>
      <td data-l="Status">${souMaster?`<button class="btn-sm acc" onclick="liberarPainel('${u.id}')">liberar no painel</button>`:'—'}</td></tr>`).join('');
  if(souMaster){
    [...el('usBody').querySelectorAll('tr[data-u]')].forEach(tr=>{
      tr.onclick = ()=> gavetaUsuario(tr.getAttribute('data-u'), us, perfis);
    });
  }
}

async function liberarPainel(id){
  const perfis = await carregar('painel_perfis','perfil,descricao,abas');
  abrirOrigem({
    titulo:'Liberar acesso ao painel',
    subtitulo:'conta do app CASAGRANDE — escolha o perfil de painel dela (o app do CASA não muda)',
    resumoTop:false, colunas:['Perfil','Abas'],
    linhas: perfis.map(p=>[p.perfil, (p.abas||[]).join(', ')||'—'])
  });
  setTimeout(()=>{
    const body = document.querySelector('.dw-body'); if(!body) return;
    const box = document.createElement('div');
    box.style.cssText = 'padding:12px 0;border-top:2px solid var(--line);margin-top:10px;display:flex;gap:6px;flex-wrap:wrap';
    perfis.forEach(p=>{
      const b = document.createElement('button'); b.className='btn-sm acc';
      b.textContent = '→ '+p.perfil;
      b.onclick = async ()=>{
        status('Liberando…');
        const { error } = await sb.from('usuarios').update({ painel_perfil:p.perfil }).eq('id', id);
        status(null);
        if(error){ status('Erro: '+error.message); return; }
        status('Acesso liberado como '+p.perfil+' ✓'); setTimeout(status,2500,null);
        fecharOrigem(); limparCache(); irAba('usuarios');
      };
      box.appendChild(b);
    });
    body.appendChild(box);
  }, 50);
}

async function aprovarUsuario(id){
  const perfis = await carregar('painel_perfis','perfil,descricao,abas');
  abrirOrigem({
    titulo:'Aprovar cadastro',
    subtitulo:'escolha o perfil do usuário — ele ganha as abas do perfil (+ extras depois)',
    resumoTop:false,
    colunas:['Perfil','Abas'],
    linhas: perfis.map(p=>[p.perfil, (p.abas||[]).join(', ')||'—'])
  });
  setTimeout(()=>{
    const body = document.querySelector('.dw-body'); if(!body) return;
    const box = document.createElement('div');
    box.style.cssText = 'padding:12px 0;border-top:2px solid var(--line);margin-top:10px;display:flex;gap:6px;flex-wrap:wrap';
    perfis.forEach(p=>{
      const b = document.createElement('button'); b.className='btn-sm acc';
      b.textContent = '→ '+p.perfil;
      b.onclick = async ()=>{
        status('Aprovando…');
        const { error } = await sb.from('usuarios').update({ painel_perfil:p.perfil, ativo:true }).eq('id', id);
        status(null);
        if(error){ status('Erro: '+error.message); return; }
        status('Usuário aprovado como '+p.perfil+' ✓'); setTimeout(status,2500,null);
        fecharOrigem(); limparCache(); irAba('usuarios');
      };
      box.appendChild(b);
    });
    body.appendChild(box);
  }, 50);
}

function gavetaUsuario(uid, us, perfis){
  const u = us.find(x=>x.id===uid); if(!u) return;
  abrirOrigem({
    titulo:'Usuário · '+(u.nome||u.email),
    subtitulo:'perfil principal + abas extras (somadas) — mude e salve',
    resumoTop:false,
    colunas:['Campo','Valor'],
    linhas:[['Nome', u.nome||'—'],['E-mail', u.email||'—'],['Perfil do painel', u.painel_perfil||'—'],['Perfil no app CASA', u.perfil],['Abas extras', (u.painel_perfis_extra||[]).join(', ')||'—'],['Status', u.ativo?'ATIVO':'BLOQUEADO']]
  });
  setTimeout(()=>{
    const body = document.querySelector('.dw-body'); if(!body) return;
    const box = document.createElement('div');
    box.style.cssText = 'padding:14px 0;border-top:2px solid var(--line);margin-top:10px;display:grid;gap:10px';
    box.innerHTML = `
      <div><div style="font-size:11px;font-weight:700;text-transform:uppercase;color:var(--mut);margin-bottom:5px">Perfil principal</div>
      <select id="edPerfil" class="inp" style="width:100%">
        ${perfis.map(p=>`<option value="${p.perfil}" ${p.perfil===u.painel_perfil?'selected':''}>${p.perfil} — ${(p.abas||[]).length} abas</option>`).join('')}
      </select></div>
      <div><div style="font-size:11px;font-weight:700;text-transform:uppercase;color:var(--mut);margin-bottom:5px">Abas extras (somadas ao perfil)</div>
      <div style="display:flex;gap:4px;flex-wrap:wrap" id="edExtras">
        ${ABAS_DISPONIVEIS.map(([id,l])=>`<label style="font-size:11px;display:inline-flex;align-items:center;gap:3px;border:1px solid var(--line);border-radius:12px;padding:3px 8px;cursor:pointer;background:${(u.painel_perfis_extra||[]).includes(id)?'var(--acc-soft)':'#fff'}">
          <input type="checkbox" value="${id}" ${(u.painel_perfis_extra||[]).includes(id)?'checked':''} style="margin:0"> ${l}</label>`).join('')}
      </div></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn-pri" id="edSalvar" style="flex:1">salvar alterações</button>
        <button class="btn-sm" id="edToggle">${u.ativo?'bloquear acesso':'reativar acesso'}</button>
      </div>
      <div style="font-size:11px;color:var(--mut)">Login/senha: o usuário cria a conta na tela de login ("criar conta") — a senha é dele. Aqui você define o que ele vê.</div>`;
    body.appendChild(box);
    el('edSalvar').onclick = async ()=>{
      const perfil = el('edPerfil').value;
      const extras = [...el('edExtras').querySelectorAll('input:checked')].map(x=>x.value);
      status('Salvando…');
      const { error } = await sb.from('usuarios').update({ painel_perfil:perfil, painel_perfis_extra:extras }).eq('id', uid);
      status(null);
      if(error){ status('Erro: '+error.message); return; }
      status('Usuário atualizado ✓'); setTimeout(status,2000,null);
      fecharOrigem(); limparCache(); irAba('usuarios');
    };
    el('edToggle').onclick = async ()=>{
      status('Atualizando…');
      const { error } = await sb.from('usuarios').update({ ativo:!u.ativo }).eq('id', uid);
      status(null);
      if(error){ status('Erro: '+error.message); return; }
      limparCache(); fecharOrigem(); irAba('usuarios');
    };
  }, 50);
}
