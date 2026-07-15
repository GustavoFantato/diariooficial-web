const BASE_URL = 'https://raw.githubusercontent.com/GustavoFantato/diariooficial-web/main';
const PLANILHA_URL = 'https://docs.google.com/spreadsheets/d/1k3i1Wm5nypzaA4aBTckffsNxw0kJW70rSmqViNVRkDM/gviz/tq?tqx=out:csv&sheet=Página1';
const COL_CONFIG_PEOPLE = "2fr 1fr 1fr";
const COL_CONFIG_RUNS = "1fr 1fr 2fr";

let listaOriginal = [];

// --- 1. CARREGAR PESSOAS ---
async function carregarDadosCSV() {
    const tablePeople = document.getElementById('tablePeople');
    try {
        const response = await fetch(PLANILHA_URL);
        if (!response.ok) throw new Error("Erro ao carregar Planilha");
        
        const text = await response.text();
        const linhas = text.replace(/"/g, '').split(/\r?\n/).filter(l => l.trim() !== "").slice(1);

        listaOriginal = linhas.map(linha => {
            const colunas = linha.split(',');
            return { 
                nome: colunas[0]?.trim() || '', 
                unidade: colunas[1]?.trim() || '', 
                rf: colunas[2]?.trim() || '', 
                rf_vinculo: colunas[3]?.trim() || '',
                nome_sem_acento: colunas[4]?.trim().toLowerCase() || '',
                rf_com_pontos: colunas[5]?.trim() || ''
            };
        });
        renderTabelaPessoas(listaOriginal);
    } catch (e) { console.error(e); }
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
                <div class="mono">${p.rf_vinculo}</div>
            </div>
        `).join('') : '<div style="padding:10px;">Nenhum resultado encontrado</div>'}
    `;
}

// --- 2. CARREGAR ENCONTRADOS ---
async function carregarEncontrados() {
    const containerCEI = document.getElementById('tableMatchesCEI');
    const containerEMEI = document.getElementById('tableMatchesEMEI');
    
    try {
        const response = await fetch(`${BASE_URL}/outputs/encontrados.json?t=${Date.now()}`);
        if (!response.ok) throw new Error("Erro ao carregar encontrados");
        
        const data = await response.json();
        const cei = data.filter(item => String(item.TIPO).toUpperCase().includes('CEI'));
        const emei = data.filter(item => String(item.TIPO).toUpperCase().includes('EMEI'));

        // Agora são 5 colunas: Nome, RF, RF Vínc., Nome Simples, RF Pontos
        const gridConfig = "2.5fr 0.8fr 1fr 1.2fr 0.8fr";

        const gerarHTML = (lista) => lista.length > 0 ? `
            <div class="row head" style="grid-template-columns: ${gridConfig};">
                <div>Nome</div><div>RF</div><div>RF Vínc.</div><div>Nome Simples</div><div>RF Pontos</div>
            </div>
            ${lista.map(item => `
                <div class="row" style="grid-template-columns: ${gridConfig};">
                    <div class="value">${item.NOME || '-'}</div>
                    <div class="mono">${item.RF || '-'}</div>
                    <div class="mono">${item.RF_VINCULO || '-'}</div>
                    <div class="mono">${item.NOME_SEM_ACENTO || '-'}</div>
                    <div class="mono">${item.RF_COM_PONTOS || '-'}</div>
                </div>
            `).join('')}
        ` : `<div style="padding:10px;">Nenhum registro encontrado nesta categoria.</div>`;

        containerCEI.innerHTML = gerarHTML(cei);
        containerEMEI.innerHTML = gerarHTML(emei);
    } catch (e) { 
        console.error("Erro ao carregar encontrados:", e);
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
            ${(data.workflow_runs || []).slice(0, 10).map(run => `
                <div class="row" style="grid-template-columns: ${COL_CONFIG_RUNS};">
                    <div>${run.status}</div><div class="mono">${run.conclusion || 'N/A'}</div><div class="mono">${new Date(run.created_at).toLocaleString()}</div>
                </div>
            `).join('')}
        `;
    } catch (e) { console.error("Erro ao carregar execuções:", e); }
}

// --- 4. FILTRAGEM (SEARCH BAR) ---
function aplicarFiltros() {
    const termo = document.getElementById('peopleFilter').value.toLowerCase();
    const listaFiltrada = listaOriginal.filter(p => {
        return p.nome.toLowerCase().includes(termo) || 
               p.unidade.toLowerCase().includes(termo) || 
               p.rf.includes(termo) || 
               p.rf_vinculo.toLowerCase().includes(termo) ||
               p.nome_sem_acento.includes(termo) ||
               p.rf_com_pontos.includes(termo);
    });
    renderTabelaPessoas(listaFiltrada);
}

// --- 5. EVENT LISTENERS E INICIALIZAÇÃO ---
document.querySelectorAll('.tab').forEach(button => {
    button.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tabPane').forEach(p => p.classList.add('hidden'));
        button.classList.add('active');
        document.getElementById(`tab-${button.dataset.tab}`).classList.remove('hidden');
    });
});

document.getElementById('peopleFilter').addEventListener('input', aplicarFiltros);

carregarDadosCSV();
carregarEncontrados();
carregarExecucoes();