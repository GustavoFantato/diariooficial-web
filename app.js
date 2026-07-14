const BASE_URL = 'https://raw.githubusercontent.com/GustavoFantato/diariooficial-web/main';
const COL_CONFIG_PEOPLE = "2fr 1fr 1fr";
const COL_CONFIG_MATCHES = "2fr 1fr 1fr";
const COL_CONFIG_RUNS = "1fr 1fr 2fr";

let listaOriginal = [];

// --- 1. CARREGAR PESSOAS (CSV) ---
async function carregarDadosCSV() {
    const tablePeople = document.getElementById('tablePeople');
    try {
        const response = await fetch(`${BASE_URL}/data/namesList.csv?t=${Date.now()}`);
        if (!response.ok) throw new Error("Erro ao carregar CSV");
        
        const text = await response.text();
        const linhas = text.split(/\r?\n/).filter(l => l.trim() !== "").slice(1);

        listaOriginal = linhas.map(linha => {
            const colunas = linha.split(',');
            return { 
                nome: colunas[0]?.trim() || '', 
                unidade: colunas[1]?.trim() || '', 
                rf_vinculo_formatado: colunas[3]?.trim() || '' 
            };
        });

        renderTabelaPessoas(listaOriginal);
    } catch (e) {
        tablePeople.innerHTML = `<div style="padding:15px; color: #ff5a5a;">${e.message}</div>`;
    }
}

function renderTabelaPessoas(lista) {
    const container = document.getElementById('tablePeople');
    container.innerHTML = `
        <div class="row head" style="grid-template-columns: ${COL_CONFIG_PEOPLE};">
            <div>Nome</div><div>Unidade</div><div>RF/Vínculo</div>
        </div>
        ${lista.length > 0 ? lista.map(p => `
            <div class="row" style="grid-template-columns: ${COL_CONFIG_PEOPLE};">
                <div class="value">${p.nome}</div>
                <div class="mono">${p.unidade}</div>
                <div class="mono">${p.rf_vinculo_formatado}</div>
            </div>
        `).join('') : '<div style="padding:10px;">Nenhum resultado encontrado</div>'}
    `;
}

// --- 2. CARREGAR ENCONTRADOS (JSON) ---
async function carregarEncontrados() {
    const containerCEI = document.getElementById('tableMatchesCEI');
    const containerEMEI = document.getElementById('tableMatchesEMEI');
    
    try {
        const response = await fetch(`${BASE_URL}/outputs/encontrados.json?t=${Date.now()}`);
        if (!response.ok) throw new Error("Arquivo não encontrado");
        
        const data = await response.json();
        const cei = data.filter(item => item.TIPO === 'CEI');
        const emei = data.filter(item => item.TIPO === 'EMEI');

        const gerarHTML = (lista) => lista.length > 0 ? `
            <div class="row head" style="grid-template-columns: 2fr 1fr;">
                <div>Nome</div><div>RF</div>
            </div>
            ${lista.map(item => `
                <div class="row" style="grid-template-columns: 2fr 1fr;">
                    <div>${item.NOME}</div><div class="mono">${item.RF}</div>
                </div>
            `).join('')}
        ` : `<div style="padding:10px;">Nenhum encontrado</div>`;

        containerCEI.innerHTML = gerarHTML(cei);
        containerEMEI.innerHTML = gerarHTML(emei);
    } catch (e) { 
        console.error("Erro ao carregar encontrados:", e);
        containerCEI.innerHTML = "Erro ao carregar dados.";
    }
}

// --- 3. HISTÓRICO DE EXECUÇÕES ---
async function carregarExecucoes() {
    try {
        const response = await fetch('https://api.github.com/repos/GustavoFantato/diariooficial-web/actions/workflows/diario_automatico.yml/runs');
        const data = await response.json();
        const container = document.getElementById('tableRuns');
        container.innerHTML = `
            <div class="row head" style="grid-template-columns: ${COL_CONFIG_RUNS};">
                <div>Status</div><div>Conclusão</div><div>Data</div>
            </div>
            ${data.workflow_runs.slice(0, 10).map(run => `
                <div class="row" style="grid-template-columns: ${COL_CONFIG_RUNS};">
                    <div>${run.status}</div><div class="mono">${run.conclusion || 'N/A'}</div><div class="mono">${new Date(run.created_at).toLocaleString()}</div>
                </div>
            `).join('')}
        `;
    } catch (e) { console.error("Erro ao carregar execuções:", e); }
}

// --- FILTRAGEM ---
function aplicarFiltros() {
    const termo = document.getElementById('peopleFilter').value.toLowerCase();
    const unidadeSelecionada = document.getElementById('unitFilter').value;

    const listaFiltrada = listaOriginal.filter(p => {
        // Garantir que tudo seja convertido para string antes de comparar
        const nome = (p.nome || '').toLowerCase();
        const unidade = (p.unidade || '').toLowerCase();
        const rf = (p.rf_vinculo_formatado || '').toLowerCase();
        
        const matchTexto = nome.includes(termo) || 
                           unidade.includes(termo) || 
                           rf.includes(termo);
        
        // Ajuste no matchUnidade para ser mais preciso
        const matchUnidade = unidadeSelecionada === "TODOS" || 
                             unidade.toUpperCase().includes(unidadeSelecionada.toUpperCase());

        return matchTexto && matchUnidade;
    });

    renderTabelaPessoas(listaFiltrada);
}

// --- EVENT LISTENERS ---
document.querySelectorAll('.tab').forEach(button => {
    button.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tabPane').forEach(p => p.classList.add('hidden'));
        button.classList.add('active');
        document.getElementById(`tab-${button.dataset.tab}`).classList.remove('hidden');
    });
});

document.getElementById('peopleFilter').addEventListener('input', aplicarFiltros);
document.getElementById('unitFilter').addEventListener('change', aplicarFiltros);

// Inicialização
carregarDadosCSV();
carregarEncontrados();
carregarExecucoes();