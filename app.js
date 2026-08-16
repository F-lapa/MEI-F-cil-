// MEI Fácil IA - v5 Completo
let currentUser = null;
let currentProfile = null;
let lancamentos = [];
let clientes = [];
let currentFile = null;
let currentBase64 = null;
let mesSelecionado = new Date().getMonth();
let anoSelecionado = new Date().getFullYear();

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const LIMITE_MEI = 81000;

function formatMoney(v) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('pt-BR');
}

// ---------- Auth ----------
async function fazerLogin() {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errEl = document.getElementById('login-error');
  const btn = document.getElementById('btn-login');
  if (!email || !password) {
    errEl.textContent = 'Preencha email e senha';
    errEl.classList.remove('hidden');
    return;
  }
  btn.textContent = 'Entrando...';
  btn.disabled = true;
  errEl.classList.add('hidden');
  try {
    const { user } = await signIn(email, password);
    currentUser = user;
    currentProfile = await getProfile(user.id);
    if (currentProfile?.status === 'pausado') {
      await signOut();
      errEl.textContent = 'Sua assinatura está pausada. Entre em contato com o suporte.';
      errEl.classList.remove('hidden');
      return;
    }
    await iniciarApp();
  } catch (e) {
    errEl.textContent = e.message || 'Erro ao fazer login';
    errEl.classList.remove('hidden');
  } finally {
    btn.textContent = 'Entrar';
    btn.disabled = false;
  }
}

async function fazerLogout() {
  await signOut();
  currentUser = null;
  currentProfile = null;
  document.getElementById('screen-app').classList.add('hidden');
  document.getElementById('screen-login').classList.remove('hidden');
}

async function iniciarApp() {
  document.getElementById('screen-login').classList.add('hidden');
  document.getElementById('screen-app').classList.remove('hidden');
  document.getElementById('header-user').textContent = currentUser.email;
  document.getElementById('profile-email').textContent = currentUser.email;
  document.getElementById('profile-role').textContent = currentProfile?.role === 'admin' ? 'Administrador' : 'Usuário';

  const isAdm = currentProfile?.role === 'admin';
  document.getElementById('admin-panel')?.classList.toggle('hidden', !isAdm);
  document.getElementById('nav-clientes')?.classList.toggle('hidden', !isAdm);

  if (isAdm) {
    const key = await getGeminiKey();
    document.getElementById('gemini-status').textContent = key ? 'Chave configurada ✓' : 'Nenhuma chave salva';
    await carregarClientes();
  }

  await carregarLancamentos();
  showScreen('dashboard');
}

function showScreen(name) {
  ['dashboard', 'upload', 'profile', 'clientes', 'relatorio'].forEach(s => {
    document.getElementById('screen-' + s)?.classList.add('hidden');
  });
  document.getElementById('screen-' + name)?.classList.remove('hidden');
  if (name === 'clientes') carregarClientes();
  if (name === 'relatorio') atualizarRelatorio();
  if (name === 'dashboard') atualizarDashboard();
}

// ---------- Mês ----------
function mudarMes(delta) {
  mesSelecionado += delta;
  if (mesSelecionado > 11) { mesSelecionado = 0; anoSelecionado++; }
  if (mesSelecionado < 0) { mesSelecionado = 11; anoSelecionado--; }
  atualizarDashboard();
}

function lancamentosDoMes() {
  return lancamentos.filter(l => {
    const d = new Date(l.data);
    return d.getMonth() === mesSelecionado && d.getFullYear() === anoSelecionado;
  });
}

function receitasAno() {
  return lancamentos
    .filter(l => l.tipo === 'receita' && new Date(l.data).getFullYear() === anoSelecionado)
    .reduce((s, l) => s + Number(l.valor), 0);
}

// ---------- Dashboard ----------
function atualizarDashboard() {
  document.getElementById('mes-atual-label').textContent = MESES[mesSelecionado] + ' ' + anoSelecionado;

  const doMes = lancamentosDoMes();
  let receitas = 0, despesas = 0;
  doMes.forEach(l => {
    if (l.tipo === 'receita') receitas += Number(l.valor);
    else despesas += Number(l.valor);
  });

  document.getElementById('total-receitas').textContent = formatMoney(receitas);
  document.getElementById('total-despesas').textContent = formatMoney(despesas);
  document.getElementById('lucro').textContent = formatMoney(receitas - despesas);
  document.getElementById('das').textContent = formatMoney(receitas > 0 ? Math.max(71.60, receitas * 0.05) : 0);

  // Limite MEI
  const totalAno = receitasAno();
  const pct = Math.min(100, (totalAno / LIMITE_MEI) * 100);
  document.getElementById('progress-bar').style.width = pct + '%';
  document.getElementById('progress-text').textContent = pct.toFixed(1) + '% de R$ 81.000';
  document.getElementById('progress-bar').className = 'h-full rounded-full transition-all ' +
    (pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-blue-500');

  const alerta = document.getElementById('alerta-mei');
  const alertaTxt = document.getElementById('alerta-mei-texto');
  if (pct >= 100) {
    alerta.classList.remove('hidden');
    alerta.className = 'card p-3 mb-3 border border-red-200 bg-red-50';
    alertaTxt.className = 'text-xs text-red-800 font-medium';
    alertaTxt.textContent = '⚠️ Você ultrapassou o limite anual do MEI (R$ 81.000)!';
  } else if (pct >= 80) {
    alerta.classList.remove('hidden');
    alerta.className = 'card p-3 mb-3 border border-amber-200 bg-amber-50';
    alertaTxt.className = 'text-xs text-amber-800 font-medium';
    alertaTxt.textContent = '⚠️ Atenção: você já usou ' + pct.toFixed(0) + '% do limite do MEI neste ano.';
  } else {
    alerta.classList.add('hidden');
  }

  const lista = document.getElementById('lista-lancamentos');
  const empty = document.getElementById('empty-state');
  if (doMes.length === 0) {
    lista.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');
  const ordenados = [...doMes].sort((a, b) => new Date(b.data) - new Date(a.data));
  lista.innerHTML = ordenados.map(l => {
    const isR = l.tipo === 'receita';
    return `<div class="card p-3.5 flex items-center gap-3">
      <div class="w-10 h-10 rounded-xl ${isR ? 'bg-green-50' : 'bg-red-50'} flex items-center justify-center">
        <i class="fas ${isR ? 'fa-arrow-down text-green-600' : 'fa-arrow-up text-red-500'} text-sm"></i>
      </div>
      <div class="flex-1 min-w-0">
        <p class="font-medium text-slate-800 text-sm truncate">${l.descricao}</p>
        <p class="text-[11px] text-slate-400">${l.categoria || ''} • ${new Date(l.data).toLocaleDateString('pt-BR')}</p>
      </div>
      <p class="font-semibold ${isR ? 'text-green-600' : 'text-red-500'} text-sm">${isR ? '+' : '−'} ${formatMoney(l.valor)}</p>
    </div>`;
  }).join('');
}

// ---------- Relatório ----------
function atualizarRelatorio() {
  document.getElementById('relatorio-mes-label').textContent = MESES[mesSelecionado] + ' de ' + anoSelecionado;
  const doMes = lancamentosDoMes();
  let receitas = 0, despesas = 0;
  const porCat = {};
  doMes.forEach(l => {
    if (l.tipo === 'receita') receitas += Number(l.valor);
    else {
      despesas += Number(l.valor);
      porCat[l.categoria || 'Outros'] = (porCat[l.categoria || 'Outros'] || 0) + Number(l.valor);
    }
  });
  document.getElementById('rel-receitas').textContent = formatMoney(receitas);
  document.getElementById('rel-despesas').textContent = formatMoney(despesas);
  document.getElementById('rel-lucro').textContent = formatMoney(receitas - despesas);
  document.getElementById('rel-das').textContent = formatMoney(receitas > 0 ? Math.max(71.60, receitas * 0.05) : 0);
  document.getElementById('rel-qtd').textContent = doMes.length;

  const catEl = document.getElementById('rel-categorias');
  const entries = Object.entries(porCat).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) {
    catEl.innerHTML = '<p class="text-slate-400 text-xs">Nenhuma despesa neste mês</p>';
  } else {
    catEl.innerHTML = entries.map(([c, v]) =>
      `<div class="flex justify-between"><span class="text-slate-600 truncate pr-2">${c}</span><span class="font-medium">${formatMoney(v)}</span></div>`
    ).join('');
  }
}



function gerarPDF() {
  try {
    const doMes = lancamentosDoMes();
    if (doMes.length === 0) {
      alert('Não há lançamentos neste mês.');
      return;
    }

    // Compatibilidade com diferentes formas de carregar o jsPDF
    let JsPDF = null;
    if (window.jspdf && window.jspdf.jsPDF) JsPDF = window.jspdf.jsPDF;
    else if (window.jsPDF) JsPDF = window.jsPDF;
    else if (typeof jspdf !== 'undefined' && jspdf.jsPDF) JsPDF = jspdf.jsPDF;

    if (!JsPDF) {
      alert('Biblioteca de PDF não carregou. Atualize a página e tente de novo.');
      return;
    }

    const doc = new JsPDF({ unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    let y = 18;

    let receitas = 0, despesas = 0;
    const porCat = {};
    doMes.forEach(l => {
      if (l.tipo === 'receita') receitas += Number(l.valor);
      else {
        despesas += Number(l.valor);
        porCat[l.categoria || 'Outros'] = (porCat[l.categoria || 'Outros'] || 0) + Number(l.valor);
      }
    });
    const lucro = receitas - despesas;
    const das = receitas > 0 ? Math.max(71.60, receitas * 0.05) : 0;
    const mesNome = MESES[mesSelecionado] + ' de ' + anoSelecionado;
    const fmt = (v) => Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    // Header
    doc.setFillColor(37, 99, 235);
    doc.rect(0, 0, pageW, 28, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('MEI Facil IA', 14, 12);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text('Relatorio financeiro para contador', 14, 20);

    y = 38;
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('Periodo: ' + mesNome, 14, y);
    y += 6;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('Gerado em ' + new Date().toLocaleDateString('pt-BR'), 14, y);
    if (currentUser && currentUser.email) {
      y += 5;
      doc.text('Conta: ' + currentUser.email, 14, y);
    }

    // Summary
    y += 12;
    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, y, 85, 28, 3, 3, 'FD');
    doc.roundedRect(105, y, 85, 28, 3, 3, 'FD');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text('Receitas', 20, y + 8);
    doc.text('Despesas', 111, y + 8);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(22, 163, 74);
    doc.text('R$ ' + fmt(receitas), 20, y + 18);
    doc.setTextColor(239, 68, 68);
    doc.text('R$ ' + fmt(despesas), 111, y + 18);

    y += 36;
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, y, 85, 28, 3, 3, 'FD');
    doc.roundedRect(105, y, 85, 28, 3, 3, 'FD');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('Lucro', 20, y + 8);
    doc.text('DAS estimado', 111, y + 8);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text('R$ ' + fmt(lucro), 20, y + 18);
    doc.setTextColor(37, 99, 235);
    doc.text('R$ ' + fmt(das), 111, y + 18);

    // Categories
    y += 40;
    const cats = Object.entries(porCat).sort((a, b) => b[1] - a[1]);
    if (cats.length) {
      doc.setTextColor(30, 41, 59);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Despesas por categoria', 14, y);
      y += 8;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      cats.forEach(function(item) {
        if (y > 270) { doc.addPage(); y = 20; }
        doc.setTextColor(71, 85, 105);
        doc.text(String(item[0]).substring(0, 40), 14, y);
        doc.setTextColor(30, 41, 59);
        doc.text('R$ ' + fmt(item[1]), pageW - 14, y, { align: 'right' });
        y += 6;
      });
    }

    // Details
    y += 10;
    if (y > 250) { doc.addPage(); y = 20; }
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Detalhamento dos lancamentos', 14, y);
    y += 8;

    doc.setFillColor(37, 99, 235);
    doc.rect(14, y - 4, pageW - 28, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('Data', 16, y);
    doc.text('Descricao', 36, y);
    doc.text('Tipo', 120, y);
    doc.text('Valor', pageW - 16, y, { align: 'right' });
    y += 8;

    doc.setFont('helvetica', 'normal');
    const ordenados = doMes.slice().sort(function(a, b) { return new Date(a.data) - new Date(b.data); });
    ordenados.forEach(function(l, i) {
      if (y > 280) { doc.addPage(); y = 20; }
      if (i % 2 === 0) {
        doc.setFillColor(248, 250, 252);
        doc.rect(14, y - 4, pageW - 28, 7, 'F');
      }
      var data = new Date(l.data).toLocaleDateString('pt-BR');
      var desc = String(l.descricao || '').substring(0, 42);
      var tipo = l.tipo === 'receita' ? 'Receita' : 'Despesa';
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      doc.text(data, 16, y);
      doc.text(desc, 36, y);
      doc.text(tipo, 120, y);
      if (l.tipo === 'receita') doc.setTextColor(22, 163, 74);
      else doc.setTextColor(239, 68, 68);
      doc.text((l.tipo === 'receita' ? '+ ' : '- ') + 'R$ ' + fmt(l.valor), pageW - 16, y, { align: 'right' });
      y += 7;
    });

    y += 10;
    if (y > 275) { doc.addPage(); y = 20; }
    doc.setDrawColor(226, 232, 240);
    doc.line(14, y, pageW - 14, y);
    y += 6;
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text('Documento gerado pelo MEI Facil IA', 14, y);
    doc.text('Total: ' + doMes.length + ' lancamentos', pageW - 14, y, { align: 'right' });

    var nomeArquivo = 'relatorio-mei-' + anoSelecionado + '-' + String(mesSelecionado + 1).padStart(2, '0') + '.pdf';

    // Sempre baixa o PDF (mais confiavel no celular)
    doc.save(nomeArquivo);
    alert('PDF gerado e baixado! Agora abra o arquivo e compartilhe no WhatsApp ou e-mail.');
  } catch (e) {
    console.error(e);
    alert('Erro ao gerar PDF: ' + (e.message || e));
  }
}


async function carregarClientes() {
  try {
    const { data, error } = await supabaseClient
      .from('profiles')
      .select('*')
      .neq('status', 'apagado')
      .order('created_at', { ascending: false });
    if (error) throw error;
    clientes = data || [];
    renderClientes();
  } catch (e) {
    console.error(e);
    clientes = [];
  }
}

function renderClientes() {
  const lista = document.getElementById('lista-clientes');
  if (!lista) return;
  if (clientes.length === 0) {
    lista.innerHTML = '<p class="text-sm text-slate-400 text-center py-6">Nenhum cliente cadastrado</p>';
    return;
  }
  lista.innerHTML = clientes.map(c => {
    const isAdmin = c.role === 'admin';
    const isPausado = c.status === 'pausado';
    const statusClass = isAdmin ? 'bg-blue-100 text-blue-700' : (isPausado ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700');
    return `
      <div class="card p-4 mb-2">
        <div class="flex justify-between items-start">
          <div>
            <p class="font-semibold text-slate-800 text-sm">${c.nome || 'Sem nome'}</p>
            <p class="text-xs text-slate-500">${c.id.substring(0, 8)}...</p>
          </div>
          <span class="text-[10px] px-2 py-0.5 rounded-full ${statusClass}">${isAdmin ? 'Admin' : (c.status || 'ativo')}</span>
        </div>
        <div class="grid grid-cols-2 gap-2 mt-3 text-xs text-slate-500">
          <div>
            <p class="text-slate-400">Ingressou</p>
            <p class="font-medium text-slate-700">${formatDate(c.data_inicio || c.created_at)}</p>
          </div>
          <div>
            <p class="text-slate-400">Próx. mensalidade</p>
            <p class="font-medium text-slate-700">${formatDate(c.proxima_mensalidade)}</p>
          </div>
        </div>
        ${!isAdmin ? `
        <div class="flex gap-2 mt-3">
          ${isPausado
            ? `<button onclick="gerenciarCliente('activate','${c.id}')" class="flex-1 py-2 rounded-lg text-xs font-semibold bg-green-50 text-green-700">Ativar</button>`
            : `<button onclick="gerenciarCliente('pause','${c.id}')" class="flex-1 py-2 rounded-lg text-xs font-semibold bg-amber-50 text-amber-700">Pausar</button>`}
          <button onclick="editarMensalidade('${c.id}','${c.proxima_mensalidade || ''}')" class="flex-1 py-2 rounded-lg text-xs font-semibold bg-slate-50 text-slate-600">Mensalidade</button>
          <button onclick="gerenciarCliente('delete','${c.id}')" class="flex-1 py-2 rounded-lg text-xs font-semibold bg-red-50 text-red-600">Apagar</button>
        </div>` : ''}
      </div>`;
  }).join('');
}

async function editarMensalidade(userId, atual) {
  const nova = prompt('Nova data da próxima mensalidade (AAAA-MM-DD):', atual || '');
  if (!nova) return;
  try {
    const { data, error } = await supabaseClient.from('profiles').update({ proxima_mensalidade: nova }).eq('id', userId).select();
    if (error) throw error;
    if (!data?.length) { alert('Sem permissão para editar'); return; }
    await carregarClientes();
    alert('Data atualizada');
  } catch (e) {
    alert('Erro: ' + (e.message || e));
  }
}

async function gerenciarCliente(action, userId) {
  if (action === 'delete' && !confirm('Apagar este cliente permanentemente?')) return;
  if (action === 'pause' && !confirm('Pausar a assinatura deste cliente?')) return;
  try {
    if (action === 'delete') {
      const { data, error } = await supabaseClient.from('profiles').delete().eq('id', userId).select();
      if (error) { alert('Erro ao apagar: ' + (error.message || error.code)); return; }
      if (!data?.length) { alert('Sem permissão para apagar. Rode o SQL de permissão.'); return; }
      alert('Cliente apagado');
    } else {
      const novoStatus = action === 'pause' ? 'pausado' : 'ativo';
      const { data, error } = await supabaseClient.from('profiles').update({ status: novoStatus }).eq('id', userId).select();
      if (error) { alert('Erro: ' + (error.message || error.code)); return; }
      if (!data?.length) { alert('Sem permissão. Rode o SQL de permissão.'); return; }
      alert(action === 'pause' ? 'Assinatura pausada' : 'Assinatura ativada');
    }
    await carregarClientes();
  } catch (e) {
    alert('Erro: ' + (e.message || e));
  }
}

async function cadastrarCliente() {
  const email = document.getElementById('novo-email').value.trim();
  const senha = document.getElementById('novo-senha').value;
  const nome = document.getElementById('novo-nome').value.trim() || email;
  const dias = parseInt(document.getElementById('novo-dias').value) || 30;
  const msg = document.getElementById('cadastro-msg');
  if (!email || !senha) { msg.textContent = 'Preencha email e senha'; msg.className = 'text-xs text-red-500 mt-2'; return; }
  if (senha.length < 6) { msg.textContent = 'Senha mínima 6 caracteres'; msg.className = 'text-xs text-red-500 mt-2'; return; }
  msg.textContent = 'Criando cliente...'; msg.className = 'text-xs text-slate-500 mt-2';
  const adminSession = await getSession();
  try {
    const { data, error } = await supabaseClient.auth.signUp({ email, password: senha, options: { data: { nome } } });
    if (error) throw error;
    if (data.user) {
      const proxima = new Date();
      proxima.setDate(proxima.getDate() + dias);
      await new Promise(r => setTimeout(r, 1000));
      await supabaseClient.from('profiles').update({
        nome, role: 'user', status: 'ativo',
        data_inicio: new Date().toISOString().slice(0, 10),
        proxima_mensalidade: proxima.toISOString().slice(0, 10)
      }).eq('id', data.user.id);
    }
    if (adminSession?.access_token) {
      await supabaseClient.auth.setSession({ access_token: adminSession.access_token, refresh_token: adminSession.refresh_token });
      currentUser = adminSession.user;
      currentProfile = await getProfile(adminSession.user.id);
    }
    msg.textContent = 'Cliente criado! Envie o email e a senha para ele.';
    msg.className = 'text-xs text-green-600 mt-2';
    document.getElementById('novo-email').value = '';
    document.getElementById('novo-senha').value = '';
    document.getElementById('novo-nome').value = '';
    await carregarClientes();
  } catch (e) {
    msg.textContent = e.message || 'Erro ao criar cliente';
    msg.className = 'text-xs text-red-500 mt-2';
    if (adminSession?.access_token) {
      try { await supabaseClient.auth.setSession({ access_token: adminSession.access_token, refresh_token: adminSession.refresh_token }); } catch (_) {}
    }
  }
}

// ---------- Lançamentos ----------
async function carregarLancamentos() {
  if (!currentUser) return;
  try {
    lancamentos = await getLancamentos(currentUser.id);
    atualizarDashboard();
  } catch (e) {
    console.error(e);
    lancamentos = [];
  }
}

async function limparLancamentos() {
  if (!confirm('Apagar todos os seus lançamentos?')) return;
  await deleteAllLancamentos(currentUser.id);
  lancamentos = [];
  atualizarDashboard();
}

// ---------- Upload + IA ----------
function resetUpload() {
  document.getElementById('preview-area').classList.add('hidden');
  document.getElementById('resultado-ia').classList.add('hidden');
  document.getElementById('loading-ia').classList.add('hidden');
  document.getElementById('upload-area').classList.remove('hidden');
  currentFile = null;
  currentBase64 = null;
}

function handleFile(e) {
  const file = e.target.files[0];
  if (!file) return;
  currentFile = file;
  const reader = new FileReader();
  reader.onload = ev => {
    currentBase64 = ev.target.result;
    document.getElementById('preview-img').src = currentBase64;
    document.getElementById('upload-area').classList.add('hidden');
    document.getElementById('preview-area').classList.remove('hidden');
  };
  reader.readAsDataURL(file);
}

async function processarComIA() {
  if (!currentBase64) return;
  document.getElementById('preview-area').classList.add('hidden');
  document.getElementById('loading-ia').classList.remove('hidden');
  const apiKey = await getGeminiKey();
  if (!apiKey) {
    document.getElementById('loading-ia').classList.add('hidden');
    document.getElementById('preview-area').classList.remove('hidden');
    alert('Nenhuma chave de IA configurada. Peça ao administrador.');
    return;
  }
  try {
    const base64Data = currentBase64.split(',')[1];
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.7-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: `Você é especialista em notas fiscais brasileiras para MEI.
Responda SOMENTE com JSON válido:
{"descricao":"descrição curta","valor":0.00,"tipo":"receita ou despesa","categoria":"Materiais e Insumos | Transporte e Combustível | Alimentação | Serviços de Terceiros | Equipamentos e Ferramentas | Marketing e Publicidade | Internet e Telefone | Aluguel / Coworking | Software e Assinaturas | Impostos e Taxas | Cliente / Serviço Prestado | Outros"}
RECEITA = dinheiro que entrou. DESPESA = dinheiro que saiu.` },
              { inline_data: { mime_type: currentFile.type || 'image/jpeg', data: base64Data } }
            ]
          }]
        })
      }
    );
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'Erro na API');
    const texto = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const match = texto.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('Resposta inválida da IA');
    const r = JSON.parse(match[0]);
    document.getElementById('ia-descricao').value = r.descricao || '';
    document.getElementById('ia-valor').value = Number(r.valor || 0).toFixed(2);
    document.getElementById('ia-tipo').value = (r.tipo || '').toLowerCase().includes('receita') ? 'receita' : 'despesa';
    document.getElementById('ia-categoria').value = r.categoria || 'Outros';
    document.getElementById('loading-ia').classList.add('hidden');
    document.getElementById('resultado-ia').classList.remove('hidden');
  } catch (e) {
    document.getElementById('loading-ia').classList.add('hidden');
    document.getElementById('preview-area').classList.remove('hidden');
    alert('Erro ao processar: ' + (e.message || 'Tente novamente'));
  }
}

async function salvarLancamento() {
  const descricao = document.getElementById('ia-descricao').value.trim();
  const valor = parseFloat(document.getElementById('ia-valor').value);
  const tipo = document.getElementById('ia-tipo').value;
  const categoria = document.getElementById('ia-categoria').value;
  if (!descricao || isNaN(valor) || valor <= 0) { alert('Preencha descrição e valor'); return; }
  try {
    await addLancamento(currentUser.id, { descricao, valor, tipo, categoria, data: new Date().toISOString() });
    await carregarLancamentos();
    showScreen('dashboard');
  } catch (e) {
    alert('Erro ao salvar: ' + e.message);
  }
}

async function salvarChaveGemini() {
  const key = document.getElementById('input-gemini-key').value.trim();
  if (!key) { alert('Cole a chave'); return; }
  try {
    await setGeminiKey(key);
    document.getElementById('gemini-status').textContent = 'Chave salva com sucesso ✓';
    document.getElementById('input-gemini-key').value = '';
    alert('Chave da IA salva!');
  } catch (e) {
    alert('Erro: ' + e.message);
  }
}

async function trocarSenha() {
  const nova = document.getElementById('nova-senha').value;
  const conf = document.getElementById('conf-senha').value;
  const msg = document.getElementById('senha-msg');
  if (!nova || nova.length < 6) { msg.textContent = 'Mínimo 6 caracteres'; msg.className = 'text-xs text-red-500 mt-2'; return; }
  if (nova !== conf) { msg.textContent = 'As senhas não coincidem'; msg.className = 'text-xs text-red-500 mt-2'; return; }
  try {
    const { error } = await supabaseClient.auth.updateUser({ password: nova });
    if (error) throw error;
    msg.textContent = 'Senha alterada com sucesso!';
    msg.className = 'text-xs text-green-600 mt-2';
    document.getElementById('nova-senha').value = '';
    document.getElementById('conf-senha').value = '';
  } catch (e) {
    msg.textContent = e.message || 'Erro ao trocar senha';
    msg.className = 'text-xs text-red-500 mt-2';
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const session = await getSession();
  if (session?.user) {
    currentUser = session.user;
    currentProfile = await getProfile(session.user.id);
    if (currentProfile?.status === 'pausado') {
      await signOut();
      return;
    }
    await iniciarApp();
  }
});
