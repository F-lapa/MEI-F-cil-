// MEI Fácil IA - v3 com Login + Supabase
// Admin: fernandolapa1987@gmail.com

let currentUser = null;
let currentProfile = null;
let lancamentos = [];
let currentFile = null;
let currentBase64 = null;

function formatMoney(v) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
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

  if (currentProfile?.role === 'admin') {
    document.getElementById('admin-panel').classList.remove('hidden');
    const key = await getGeminiKey();
    document.getElementById('gemini-status').textContent = key ? 'Chave configurada ✓' : 'Nenhuma chave salva';
  }

  await carregarLancamentos();
  showScreen('dashboard');
}

// ---------- Navegação ----------
function showScreen(name) {
  ['dashboard', 'upload', 'profile'].forEach(s => {
    const el = document.getElementById('screen-' + s);
    if (el) el.classList.add('hidden');
  });
  const target = document.getElementById('screen-' + name);
  if (target) target.classList.remove('hidden');

  document.querySelectorAll('.nav-item').forEach(b => {
    b.classList.remove('active', 'text-blue-600');
    b.classList.add('text-slate-400');
  });
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

function atualizarDashboard() {
  const agora = new Date();
  const doMes = lancamentos.filter(l => {
    const d = new Date(l.data);
    return d.getMonth() === agora.getMonth() && d.getFullYear() === agora.getFullYear();
  });

  let receitas = 0, despesas = 0;
  doMes.forEach(l => {
    if (l.tipo === 'receita') receitas += Number(l.valor);
    else despesas += Number(l.valor);
  });

  document.getElementById('total-receitas').textContent = formatMoney(receitas);
  document.getElementById('total-despesas').textContent = formatMoney(despesas);
  document.getElementById('lucro').textContent = formatMoney(receitas - despesas);
  document.getElementById('das').textContent = formatMoney(receitas > 0 ? Math.max(71.60, receitas * 0.05) : 0);

  const lista = document.getElementById('lista-lancamentos');
  const empty = document.getElementById('empty-state');

  if (lancamentos.length === 0) {
    lista.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  lista.innerHTML = lancamentos.slice(0, 20).map(l => {
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

  let apiKey = await getGeminiKey();
  if (!apiKey) {
    document.getElementById('loading-ia').classList.add('hidden');
    document.getElementById('preview-area').classList.remove('hidden');
    alert('Nenhuma chave de IA configurada. Peça ao administrador para configurar.');
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
              {
                text: `Você é especialista em notas fiscais brasileiras para MEI.
Responda SOMENTE com JSON válido:
{
  "descricao": "descrição curta",
  "valor": 0.00,
  "tipo": "receita ou despesa",
  "categoria": "Materiais e Insumos | Transporte e Combustível | Alimentação | Serviços de Terceiros | Equipamentos e Ferramentas | Marketing e Publicidade | Internet e Telefone | Aluguel / Coworking | Software e Assinaturas | Impostos e Taxas | Cliente / Serviço Prestado | Outros"
}
RECEITA = dinheiro que entrou. DESPESA = dinheiro que saiu.`
              },
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
    console.error(e);
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

  if (!descricao || isNaN(valor) || valor <= 0) {
    alert('Preencha descrição e valor');
    return;
  }

  try {
    await addLancamento(currentUser.id, {
      descricao, valor, tipo, categoria,
      data: new Date().toISOString()
    });
    await carregarLancamentos();
    showScreen('dashboard');
  } catch (e) {
    alert('Erro ao salvar: ' + e.message);
  }
}

async function salvarChaveGemini() {
  const key = document.getElementById('input-gemini-key').value.trim();
  if (!key) {
    alert('Cole a chave');
    return;
  }
  try {
    await setGeminiKey(key);
    document.getElementById('gemini-status').textContent = 'Chave salva com sucesso ✓';
    document.getElementById('input-gemini-key').value = '';
    alert('Chave da IA salva! Agora todos os usuários poderão usar.');
  } catch (e) {
    alert('Erro: ' + e.message);
  }
}

// ---------- Init ----------
document.addEventListener('DOMContentLoaded', async () => {
  const session = await getSession();
  if (session?.user) {
    currentUser = session.user;
    currentProfile = await getProfile(session.user.id);
    await iniciarApp();
  }
});
