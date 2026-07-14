// --- CONFIGURAÇÕES ---
const BASE_URL = 'https://raw.githubusercontent.com/GustavoFantato/diariooficial-web/main';
const COL_CONFIG_PEOPLE = "2fr 1fr 1fr";
const COL_CONFIG_MATCHES = "2fr 1fr 1fr";
const COL_CONFIG_RUNS = "1fr 1fr 2fr";

let listaOriginal = [];

// --- 1. CARREGAR PESSOAS (CSV) ---
async function carregarDadosCSV() {
    const tablePeople = document.getElementById('tablePeople');
    try {
        const response = await fetch(`${BASE_URL}/data/namesList.csv`);
        if (!response.ok) throw new Error("Erro ao carregar CSV");
        
        const text = await response.text();
        const separador = text.includes(';') ? ';' : ',';
        const linhas = text.split('\n').filter(l => l.trim() !== "").slice(1);

        listaOriginal = linhas.map(linha => {
            const colunas = linha.split(separador);
            return { nome: colunas[0]?.trim() || '', rf: colunas[1]?.trim() || '', vinculo: colunas[2]?.trim() || '' };
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
            <div>Nome</div><div>RF</div><div>RF/Vínculo</div>
        </div>
        ${lista.map(p => `
            <div class="row" style="grid-template-columns: ${COL_CONFIG_PEOPLE};">
                <div class="value">${p.nome}</div><div class="mono">${p.rf}</div><div class="mono">${p.vinculo}</div>
            </div>
        `).join('')}
    `;
}

// --- 2. CARREGAR ENCONTRADOS (JSON) ---
async function carregarEncontrados() {
    try {
        const response = await fetch(`${BASE_URL}/outputs/encontrados.json?t=${Date.now()}`);
        const data = await response.json();
        const container = document.getElementById('tableMatches');
        container.innerHTML = `
            <div class="row head" style="grid-template-columns: ${COL_CONFIG_MATCHES};">
                <div>Nome</div><div>RF</div><div>Vínculo</div>
            </div>
            ${data.map(item => `
                <div class="row" style="grid-template-columns: ${COL_CONFIG_MATCHES};">
                    <div>${item.NOME}</div><div class="mono">${item.RF}</div><div class="mono">${item.RF_VINCULO}</div>
                </div>
            `).join('')}
        `;
    } catch (e) { console.error("Erro ao carregar encontrados:", e); }
}

// --- 3. HISTÓRICO DE EXECUÇÕES (GITHUB API) ---
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

// --- 4. DISPARAR FLUXO ---
document.getElementById('btnTrigger').addEventListener('click', async () => {
    const btn = document.getElementById('btnTrigger');
    btn.disabled = true;
    btn.innerText = "Disparando...";
    
    const GITHUB_TOKEN = ''; 

    try {
        const response = await fetch(`https://api.github.com/repos/GustavoFantato/diariooficial-web/actions/workflows/diario_automatico.yml/dispatches`, {
            method: 'POST',
            headers: { 
                'Authorization': `token ${GITHUB_TOKEN}`, 
                'Accept': 'application/vnd.github.v3+json' 
            },
            body: JSON.stringify({ ref: 'main' })
        });

        if (response.status === 204) {
            alert("Sucesso! O fluxo foi disparado. Aguarde alguns segundos.");
        } else {
            const err = await response.json();
            alert("Erro ao disparar: " + (err.message || "Verifique o console"));
            console.error(err);
        }
    } catch (e) { 
        alert("Erro de conexão ao disparar fluxo."); 
        console.error(e);
    }
    
    btn.disabled = false;
    btn.innerText = "Forçar Fluxo de Verificação";
});

// --- LÓGICA DE ABAS E BUSCA ---
document.querySelectorAll('.tab').forEach(button => {
    button.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tabPane').forEach(p => p.classList.add('hidden'));
        button.classList.add('active');
        document.getElementById(`tab-${button.dataset.tab}`).classList.remove('hidden');
    });
});

document.getElementById('peopleFilter').addEventListener('input', (e) => {
    const termo = e.target.value.toLowerCase();
    renderTabelaPessoas(listaOriginal.filter(p => p.nome.toLowerCase().includes(termo) || p.rf.includes(termo)));
});

// Inicialização
carregarDadosCSV();
carregarEncontrados();
carregarExecucoes();