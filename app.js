// MEI Facil IA - v2 - Modelo: gemini-3.7-flash - 16/08/2026
// =====================================================
// MEI Fácil IA - Protótipo com suporte a Gemini real
// A chave da API fica somente no localStorage do usuário
// =====================================================

let lancamentos = JSON.parse(localStorage.getItem('mei_lancamentos') || '[]');
let currentFile = null;
let currentBase64 = null;

// ---------- Helpers ----------
function formatMoney(value) {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short'
  });
}

function getApiKey() {
  return localStorage.getItem('mei_gemini_key') || '';
}

function saveApiKey() {
  const key = document.getElementById('input-api-key').value.trim();
  if (!key) {
    alert('Cole a chave da API antes de salvar.');
    return;
  }
  localStorage.setItem('mei_gemini_key', key);
  document.getElementById('api-key-status').textContent = 'Chave salva neste dispositivo ✓';
  document.getElementById('api-key-status').className = 'text-xs text-green-600 mt-2';
  alert('Chave salva com sucesso! Ela fica apenas neste navegador.');
}

function clearApiKey() {
  if (confirm('Remover a chave salva neste dispositivo?')) {
    localStorage.removeItem('mei_gemini_key');
    document.getElementById('input-api-key').value = '';
    document.getElementById('api-key-status').textContent = 'Nenhuma chave salva';
    document.getElementById('api-key-status').className = 'text-xs text-slate-400 mt-2';
  }
}

// ---------- Navegação ----------
function showScreen(name) {
  const screens = ['dashboard', 'upload', 'relatorios', 'categorias', 'profile'];
  screens.forEach(s => {
    const el = document.getElementById('screen-' + s);
    if (el) el.classList.add('hidden');
  });

  const target = document.getElementById('screen-' + name);
  if (target) {
    target.classList.remove('hidden');
    target.classList.add('fade-in');
  }

  // Atualizar nav
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.classList.remove('active', 'text-blue-600');
    btn.classList.add('text-slate-400');
  });

  if (name === 'dashboard') {
    document.querySelectorAll('.nav-item')[0]?.classList.add('active', 'text-blue-600');
    document.querySelectorAll('.nav-item')[0]?.classList.remove('text-slate-400');
    atualizarDashboard();
  } else if (name === 'upload') {
    document.querySelectorAll('.nav-item')[1]?.classList.add('active', 'text-blue-600');
    document.querySelectorAll('.nav-item')[1]?.classList.remove('text-slate-400');
    resetUpload();
  } else if (name === 'relatorios') {
    document.querySelectorAll('.nav-item')[2]?.classList.add('active', 'text-blue-600');
    document.querySelectorAll('.nav-item')[2]?.classList.remove('text-slate-400');
    atualizarRelatorios();
  } else if (name === 'profile') {
    document.querySelectorAll('.nav-item')[3]?.classList.add('active', 'text-blue-600');
    document.querySelectorAll('.nav-item')[3]?.classList.remove('text-slate-400');
    // Carregar status da chave
    const key = getApiKey();
    const input = document.getElementById('input-api-key');
    const status = document.getElementById('api-key-status');
    if (input) input.value = key ? '••••••••••••••••••••' : '';
    if (status) {
      if (key) {
        status.textContent = 'Chave salva neste dispositivo ✓';
        status.className = 'text-xs text-green-600 mt-2';
      } else {
        status.textContent = 'Nenhuma chave salva';
        status.className = 'text-xs text-slate-400 mt-2';
      }
    }
  }
}

// ---------- Dashboard ----------
function atualizarDashboard() {
  const agora = new Date();
  const mesAtual = agora.getMonth();
  const anoAtual = agora.getFullYear();

  const doMes = lancamentos.filter(l => {
    const d = new Date(l.data);
    return d.getMonth() === mesAtual && d.getFullYear() === anoAtual;
  });

  let receitas = 0;
  let despesas = 0;

  doMes.forEach(l => {
    if (l.tipo === 'receita') receitas += l.valor;
    else despesas += l.valor;
  });

  const lucro = receitas - despesas;
  let das = 0;
  if (receitas > 0) {
    das = Math.max(71.60, receitas * 0.05);
  }

  document.getElementById('total-receitas').textContent = formatMoney(receitas);
  document.getElementById('total-despesas').textContent = formatMoney(despesas);
  document.getElementById('lucro').textContent = formatMoney(lucro);
  document.getElementById('das').textContent = formatMoney(das);

  const percentual = Math.min(100, (receitas / 81000) * 100);
  document.getElementById('progress-bar').style.width = percentual + '%';
  document.getElementById('progress-text').textContent = percentual.toFixed(1) + '% de R$ 81.000';

  const lista = document.getElementById('lista-lancamentos');
  const empty = document.getElementById('empty-state');

  if (lancamentos.length === 0) {
    lista.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }

  empty.classList.add('hidden');

  const ordenados = [...lancamentos].sort((a, b) => new Date(b.data) - new Date(a.data));

  lista.innerHTML = ordenados.slice(0, 20).map(l => {
    const isReceita = l.tipo === 'receita';
    const cor = isReceita ? 'text-green-600' : 'text-red-500';
    const bg = isReceita ? 'bg-green-50' : 'bg-red-50';
    const sinal = isReceita ? '+' : '−';
    const icone = isReceita ? 'fa-arrow-down' : 'fa-arrow-up';

    return `
      <div class="card p-3.5 flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl ${bg} flex items-center justify-center flex-shrink-0">
          <i class="fas ${icone} ${cor} text-sm"></i>
        </div>
        <div class="flex-1 min-w-0">
          <p class="font-medium text-slate-800 text-sm truncate">${l.descricao}</p>
          <p class="text-[11px] text-slate-400 mt-0.5">${l.categoria} • ${formatDate(l.data)}</p>
        </div>
        <p class="font-semibold ${cor} text-sm whitespace-nowrap">${sinal} ${formatMoney(l.valor)}</p>
      </div>
    `;
  }).join('');
}

// ---------- Relatórios ----------
function atualizarRelatorios() {
  const agora = new Date();
  const mesAtual = agora.getMonth();
  const anoAtual = agora.getFullYear();

  const doMes = lancamentos.filter(l => {
    const d = new Date(l.data);
    return d.getMonth() === mesAtual && d.getFullYear() === anoAtual;
  });

  const despesas = doMes.filter(l => l.tipo === 'despesa');
  const porCategoria = {};

  despesas.forEach(l => {
    porCategoria[l.categoria] = (porCategoria[l.categoria] || 0) + l.valor;
  });

  const container = document.getElementById('relatorio-categorias');
  const vazio = document.getElementById('relatorio-vazio');
  const entries = Object.entries(porCategoria).sort((a, b) => b[1] - a[1]);

  if (entries.length === 0) {
    container.innerHTML = '';
    vazio.classList.remove('hidden');
  } else {
    vazio.classList.add('hidden');
    const totalDespesas = despesas.reduce((s, l) => s + l.valor, 0);

    container.innerHTML = entries.map(([cat, valor]) => {
      const pct = totalDespesas > 0 ? (valor / totalDespesas * 100) : 0;
      return `
        <div>
          <div class="flex justify-between text-sm mb-1">
            <span class="text-slate-600 truncate pr-2">${cat}</span>
            <span class="font-medium text-slate-800 whitespace-nowrap">${formatMoney(valor)}</span>
          </div>
          <div class="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div class="h-full bg-violet-500 rounded-full" style="width: ${pct}%"></div>
          </div>
        </div>
      `;
    }).join('');
  }

  document.getElementById('rel-total-lanc').textContent = doMes.length;
  const dedutiveis = despesas.filter(l => l.dedutivel).reduce((s, l) => s + l.valor, 0);
  document.getElementById('rel-dedutiveis').textContent = formatMoney(dedutiveis);
  const ticket = despesas.length > 0 ? (despesas.reduce((s, l) => s + l.valor, 0) / despesas.length) : 0;
  document.getElementById('rel-ticket').textContent = formatMoney(ticket);
}

// ---------- Upload ----------
function resetUpload() {
  document.getElementById('preview-area').classList.add('hidden');
  document.getElementById('resultado-ia').classList.add('hidden');
  document.getElementById('loading-ia').classList.add('hidden');
  document.getElementById('upload-area').classList.remove('hidden');
  const cam = document.getElementById('file-input-camera');
  const gal = document.getElementById('file-input-gallery');
  if (cam) cam.value = '';
  if (gal) gal.value = '';
  currentFile = null;
  currentBase64 = null;
}

function abrirCamera() {
  const input = document.getElementById('file-input-camera');
  if (input) input.click();
}

function abrirGaleria() {
  const input = document.getElementById('file-input-gallery');
  if (input) input.click();
}

function handleFile(event) {
  const file = event.target.files[0];
  if (!file) return;

  if (file.size > 10 * 1024 * 1024) {
    alert('Arquivo muito grande. Máximo 10 MB.');
    return;
  }

  currentFile = file;
  const reader = new FileReader();
  reader.onload = function(e) {
    currentBase64 = e.target.result;
    document.getElementById('preview-img').src = currentBase64;
    document.getElementById('upload-area').classList.add('hidden');
    document.getElementById('preview-area').classList.remove('hidden');
    document.getElementById('resultado-ia').classList.add('hidden');
  };
  reader.readAsDataURL(file);
}

// ---------- IA (real se tiver chave, senão simulação) ----------
async function processarComIA() {
  if (!currentFile || !currentBase64) return;

  const apiKey = getApiKey();

  document.getElementById('preview-area').classList.add('hidden');
  document.getElementById('loading-ia').classList.remove('hidden');

  // Se não tem chave → usa simulação
  if (!apiKey) {
    setTimeout(() => {
      document.getElementById('loading-ia').classList.add('hidden');
      document.getElementById('resultado-ia').classList.remove('hidden');
      preencherComExemplo();
    }, 2000);
    return;
  }

  // --- Chamada real ao Gemini ---
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
                text: `Você é um especialista em notas fiscais e recibos brasileiros para MEI e freelancers.

Analise a imagem com atenção e responda SOMENTE com um JSON válido, sem nenhum texto antes ou depois.

REGRAS PARA CLASSIFICAR TIPO (muito importante):
- RECEITA = dinheiro que ENTROU (cliente pagou você, serviço prestado, venda, "recebido de", "pagamento do cliente", "honorários", "NF de serviço prestado")
- DESPESA = dinheiro que SAIU (você comprou ou pagou algo, "pago a", "compra", "fatura", "boleto", "NF de compra")
Se tiver dúvida, use "despesa".

Campos do JSON:
{
  "descricao": "descrição clara e curta",
  "valor": 0.00,
  "tipo": "receita" ou "despesa",
  "categoria": "Materiais e Insumos | Transporte e Combustível | Alimentação | Serviços de Terceiros | Equipamentos e Ferramentas | Marketing e Publicidade | Internet e Telefone | Aluguel / Coworking | Software e Assinaturas | Impostos e Taxas | Cliente / Serviço Prestado | Outros",
  "pagamento": "Pix | Cartão de crédito | Cartão de débito | Dinheiro | Boleto | Transferência | Não identificado",
  "numero_nota": "número da nota se aparecer, senão vazio",
  "cnpj_cpf": "CNPJ ou CPF se aparecer, senão vazio",
  "data_nota": "data no formato DD/MM/AAAA se aparecer, senão vazio",
  "dedutivel": true,
  "observacao": "informação extra útil"
}`
              },
              {
                inline_data: {
                  mime_type: currentFile.type || "image/jpeg",
                  data: base64Data
                }
              }
            ]
          }]
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || 'Erro na API do Gemini');
    }

    const texto = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const jsonMatch = texto.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      throw new Error('A IA não retornou um JSON válido');
    }

    const resultado = JSON.parse(jsonMatch[0]);

    document.getElementById('ia-descricao').value = resultado.descricao || '';
    document.getElementById('ia-valor').value = Number(resultado.valor || 0).toFixed(2);
    document.getElementById('ia-tipo').value = (resultado.tipo || '').toLowerCase().includes('receita') ? 'receita' : 'despesa';
    document.getElementById('ia-categoria').value = resultado.categoria || 'Outros';
    document.getElementById('ia-pagamento').value = resultado.pagamento || 'Pix';
    document.getElementById('ia-numero').value = resultado.numero_nota || '';
    document.getElementById('ia-cnpj').value = resultado.cnpj_cpf || '';
    document.getElementById('ia-data-nota').value = resultado.data_nota || '';
    document.getElementById('ia-dedutivel').checked = resultado.dedutivel !== false;
    document.getElementById('ia-obs').value = resultado.observacao || '';

    document.getElementById('loading-ia').classList.add('hidden');
    document.getElementById('resultado-ia').classList.remove('hidden');

  } catch (erro) {
    console.error(erro);
    document.getElementById('loading-ia').classList.add('hidden');
    document.getElementById('preview-area').classList.remove('hidden');
    alert('Erro ao processar com a IA:\n' + (erro.message || 'Tente novamente ou verifique a chave.'));
  }
}

function preencherComExemplo() {
  const exemplos = [
    { desc: 'Compra de material de escritório - Papelaria Central', valor: 87.40, tipo: 'despesa', cat: 'Materiais e Insumos', pag: 'Pix' },
    { desc: 'Uber para reunião com cliente', valor: 32.90, tipo: 'despesa', cat: 'Transporte e Combustível', pag: 'Cartão de crédito' },
    { desc: 'Pagamento de serviço prestado - João Silva', valor: 950.00, tipo: 'receita', cat: 'Cliente / Serviço Prestado', pag: 'Pix' },
    { desc: 'Almoço de negócios', valor: 78.50, tipo: 'despesa', cat: 'Alimentação', pag: 'Cartão de débito' },
    { desc: 'Assinatura Canva Pro', valor: 54.90, tipo: 'despesa', cat: 'Software e Assinaturas', pag: 'Cartão de crédito' },
    { desc: 'Recebimento projeto site - Maria Costa', valor: 1800.00, tipo: 'receita', cat: 'Cliente / Serviço Prestado', pag: 'Transferência' },
  ];
  const s = exemplos[Math.floor(Math.random() * exemplos.length)];
  document.getElementById('ia-descricao').value = s.desc;
  document.getElementById('ia-valor').value = s.valor.toFixed(2);
  document.getElementById('ia-tipo').value = s.tipo;
  document.getElementById('ia-categoria').value = s.cat;
  document.getElementById('ia-pagamento').value = s.pag;
  document.getElementById('ia-dedutivel').checked = s.tipo === 'despesa';
  document.getElementById('ia-obs').value = '';
}

// ---------- Salvar lançamento ----------
function salvarLancamento() {
  const descricao = document.getElementById('ia-descricao').value.trim();
  const valor = parseFloat(document.getElementById('ia-valor').value);
  const tipo = document.getElementById('ia-tipo').value;
  const categoria = document.getElementById('ia-categoria').value;
  const pagamento = document.getElementById('ia-pagamento').value;
  const numero = document.getElementById('ia-numero').value.trim();
  const cnpj = document.getElementById('ia-cnpj').value.trim();
  const dataNota = document.getElementById('ia-data-nota').value.trim();
  const obs = document.getElementById('ia-obs').value.trim();
  const dedutivel = document.getElementById('ia-dedutivel').checked;

  if (!descricao || isNaN(valor) || valor <= 0) {
    alert('Preencha a descrição e um valor válido.');
    return;
  }

  const novo = {
    id: Date.now(),
    descricao,
    valor,
    tipo,
    categoria,
    pagamento,
    numero_nota: numero,
    cnpj_cpf: cnpj,
    data_nota: dataNota,
    obs,
    dedutivel,
    data: new Date().toISOString()
  };

  lancamentos.push(novo);
  localStorage.setItem('mei_lancamentos', JSON.stringify(lancamentos));
  showScreen('dashboard');
}

function clearData() {
  if (confirm('Apagar todos os lançamentos deste dispositivo?')) {
    lancamentos = [];
    localStorage.removeItem('mei_lancamentos');
    atualizarDashboard();
  }
}

function exportarDados() {
  if (lancamentos.length === 0) {
    alert('Não há lançamentos para exportar.');
    return;
  }

  const header = 'Data;Descrição;Tipo;Categoria;Valor;Pagamento;Nº Nota;CNPJ/CPF;Data Nota;Dedutível;Observações\n';
  const rows = lancamentos.map(l => {
    return [
      new Date(l.data).toLocaleDateString('pt-BR'),
      `"${l.descricao.replace(/"/g, '""')}"`,
      l.tipo,
      `"${l.categoria}"`,
      l.valor.toFixed(2).replace('.', ','),
      l.pagamento || '',
      l.numero_nota || '',
      l.cnpj_cpf || '',
      l.data_nota || '',
      l.dedutivel ? 'Sim' : 'Não',
      `"${(l.obs || '').replace(/"/g, '""')}"`
    ].join(';');
  }).join('\n');

  const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `mei-facil-ia-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ---------- Inicialização ----------
document.addEventListener('DOMContentLoaded', () => {
  atualizarDashboard();

  const area = document.getElementById('upload-area');
  if (area) {
    ['dragenter', 'dragover'].forEach(evt => {
      area.addEventListener(evt, e => {
        e.preventDefault();
        area.classList.add('dragover');
      });
    });
    area.addEventListener('dragleave', () => area.classList.remove('dragover'));
    area.addEventListener('drop', e => {
      e.preventDefault();
      area.classList.remove('dragover');
      if (e.dataTransfer.files.length) {
        const gal = document.getElementById('file-input-gallery');
        if (gal) {
          gal.files = e.dataTransfer.files;
          handleFile({ target: { files: e.dataTransfer.files } });
        }
      }
    });
  }
});
