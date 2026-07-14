const state = {
  status: null,
  runs: [],
  matches: [],
  people: [],
  logs: null,
  selectedRunId: null,
};

function isoNow() {
  return new Date().toISOString();
}

function fmt(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pt-BR");
  } catch {
    return iso;
  }
}

function pillClass(status) {
  switch (status) {
    case "SUCCESS": return "pill ok";
    case "FAILED": return "pill err";
    case "RUNNING": return "pill run";
    default: return "pill idle";
  }
}

function statusLabel(status) {
  switch (status) {
    case "SUCCESS": return "OK";
    case "FAILED": return "Falhou";
    case "RUNNING": return "Rodando";
    default: return "Sem execuções";
  }
}

function toast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.remove("hidden");
  setTimeout(() => el.classList.add("hidden"), 1800);
}

// MOCK DATA
function loadMock() {
  const now = new Date();
  const next = new Date(now);
  next.setHours(8, 0, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);

  state.status = {
    now: now.toISOString(),
    timezone: "America/Sao_Paulo",
    nextScheduledAt: next.toISOString(),
    lastRun: {
      id: "run_mock_001",
      status: "SUCCESS",
      startedAt: new Date(now.getTime() - 1000 * 60 * 8).toISOString(),
      finishedAt: new Date(now.getTime() - 1000 * 60 * 6).toISOString(),
      sourceUrl: "https://exemplo.prefeitura.sp.gov.br/diario-oficial",
      checkedCount: 128,
      matchCount: 2,
    },
  };

  const base = Date.now();
  state.runs = [
    {
      id: "run_mock_003",
      status: "FAILED",
      startedAt: new Date(base - 1000 * 60 * 60 * 24).toISOString(),
      finishedAt: new Date(base - 1000 * 60 * 60 * 24 + 1000 * 40).toISOString(),
      checkedCount: 130,
      matchCount: 0,
      errorMessage: "Timeout ao carregar página do diário.",
    },
    {
      id: "run_mock_002",
      status: "SUCCESS",
      startedAt: new Date(base - 1000 * 60 * 60 * 48).toISOString(),
      finishedAt: new Date(base - 1000 * 60 * 60 * 48 + 1000 * 80).toISOString(),
      checkedCount: 127,
      matchCount: 1,
    },
    state.status.lastRun,
  ];

  state.matches = [
    {
      id: "m1",
      runId: "run_mock_001",
      personName: "Maria Aparecida Souza",
      rf: "1234567",
      matchType: "RF",
      matchedValue: "1234567",
      contextSnippet: "… Fica designada a servidora MARIA APARECIDA SOUZA, RF 1234567, para …",
      createdAt: new Date(base - 1000 * 60 * 7).toISOString(),
    },
    {
      id: "m2",
      runId: "run_mock_001",
      personName: "João Carlos Pereira",
      matchType: "NAME",
      matchedValue: "JOAO CARLOS PEREIRA",
      contextSnippet: "… Considerando a solicitação, JOAO CARLOS PEREIRA passa a integrar …",
      createdAt: new Date(base - 1000 * 60 * 7).toISOString(),
    },
  ];

  state.people = [
    { id: "p1", name: "Maria Aparecida Souza", rf: "1234567", active: true },
    { id: "p2", name: "João Carlos Pereira", rf: "", active: true },
    { id: "p3", name: "Ana Luiza Martins", rf: "7777777", active: false },
  ];

  state.selectedRunId = state.status.lastRun.id;
  state.logs = makeMockLogs(state.selectedRunId);

  renderAll();
}

function makeMockLogs(runId) {
  const base = Date.now();
  return {
    runId,
    lines: [
      { ts: new Date(base - 1000 * 80).toISOString(), level: "INFO", message: "Iniciando execução." },
      { ts: new Date(base - 1000 * 70).toISOString(), level: "INFO", message: "Baixando HTML do diário oficial." },
      { ts: new Date(base - 1000 * 55).toISOString(), level: "INFO", message: "Normalizando conteúdo e extraindo texto." },
      { ts: new Date(base - 1000 * 35).toISOString(), level: "INFO", message: "Comparando com base de nomes/RFs (128 registros ativos)." },
      { ts: new Date(base - 1000 * 20).toISOString(), level: "INFO", message: "2 ocorrências encontradas." },
      { ts: new Date(base - 1000 * 10).toISOString(), level: "INFO", message: "Finalizando execução com sucesso." },
    ],
  };
}

// RENDER
function renderAll() {
  renderHeaderCards();
  renderOverview();
  renderRunsTable();
  renderMatchesTable();
  renderPeopleTable();
  renderLogs();
}

function renderHeaderCards() {
  const s = state.status;
  const last = s?.lastRun;

  document.getElementById("tz").textContent = s?.timezone ?? "America/Sao_Paulo";
  document.getElementById("now").textContent = fmt(s?.now ?? isoNow());
  document.getElementById("nextRun").textContent = fmt(s?.nextScheduledAt);

  const pill = document.getElementById("pillLastRun");
  if (!last) {
    pill.className = "pill idle";
    pill.textContent = "Sem execuções";
  } else {
    pill.className = pillClass(last.status);
    pill.textContent = statusLabel(last.status);
  }

  document.getElementById("lastRunId").textContent = last?.id ?? "—";
  document.getElementById("lastRunStart").textContent = fmt(last?.startedAt);
  document.getElementById("lastRunEnd").textContent = fmt(last?.finishedAt);
  document.getElementById("lastRunChecked").textContent = last?.checkedCount ?? "—";
  document.getElementById("lastRunMatches").textContent = last?.matchCount ?? "—";
  document.getElementById("lastRunSource").textContent = last?.sourceUrl ?? "—";

  const errBox = document.getElementById("lastRunError");
  if (last?.status === "FAILED") {
    errBox.classList.remove("hidden");
    document.getElementById("lastRunErrorMsg").textContent = last.errorMessage ?? "Erro não informado.";
  } else {
    errBox.classList.add("hidden");
  }

  const opPill = document.getElementById("pillOp");
  opPill.className = "pill idle";
  opPill.textContent = "Pronto";
}

function renderOverview() {
  const selected = state.runs.find(r => r.id === state.selectedRunId) || state.status?.lastRun;
  document.getElementById("kpiStatus").textContent = selected ? statusLabel(selected.status) : "—";
  document.getElementById("kpiRun").textContent = selected?.id ?? "—";
  document.getElementById("kpiFound").textContent = selected?.matchCount ?? "—";

  // mini matches
  const miniMatches = document.getElementById("miniMatches");
  miniMatches.innerHTML = "";
  state.matches.slice(0, 5).forEach(m => {
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `
      <div>
        <div class="name">${escapeHtml(m.personName)}</div>
        <div class="sub">
          <span class="pill">${m.matchType}</span>
          <span class="mono">${escapeHtml(m.matchedValue)}</span>
          <span style="opacity:.6">·</span>
          <span>${fmt(m.createdAt)}</span>
        </div>
      </div>
    `;
    miniMatches.appendChild(div);
  });

  // mini runs
  const miniRuns = document.getElementById("miniRuns");
  miniRuns.innerHTML = "";
  state.runs.slice(0, 5).forEach(r => {
    const div = document.createElement("div");
    div.className = "item";
    div.style.cursor = "pointer";
    div.innerHTML = `
      <div>
        <div class="mono">${escapeHtml(r.id)}</div>
        <div class="sub">${fmt(r.startedAt)}</div>
      </div>
      <span class="${pillClass(r.status)}">${statusLabel(r.status)}</span>
    `;
    div.addEventListener("click", () => {
      state.selectedRunId = r.id;
      state.logs = makeMockLogs(r.id);
      renderOverview();
      renderLogs();
      toast(`Selecionado: ${r.id}`);
    });
    miniRuns.appendChild(div);
  });
}

function renderRunsTable() {
  const el = document.getElementById("tableRuns");
  el.innerHTML = "";

  const head = document.createElement("div");
  head.className = "row head";
  head.style.gridTemplateColumns = "1.4fr 0.8fr 1.2fr 1.2fr 0.8fr 0.8fr";
  head.innerHTML = `
    <div>Run</div><div>Status</div><div>Início</div><div>Fim</div><div>Verificados</div><div>Encontrados</div>
  `;
  el.appendChild(head);

  state.runs.forEach(r => {
    const row = document.createElement("div");
    row.className = "row clickable";
    row.style.gridTemplateColumns = "1.4fr 0.8fr 1.2fr 1.2fr 0.8fr 0.8fr";
    row.innerHTML = `
      <div class="mono">${escapeHtml(r.id)}</div>
      <div><span class="${pillClass(r.status)}">${statusLabel(r.status)}</span></div>
      <div>${fmt(r.startedAt)}</div>
      <div>${fmt(r.finishedAt)}</div>
      <div>${r.checkedCount ?? "—"}</div>
      <div>${r.matchCount ?? "—"}</div>
    `;
    row.addEventListener("click", () => {
      state.selectedRunId = r.id;
      state.logs = makeMockLogs(r.id);
      switchTab("logs");
      renderOverview();
      renderLogs();
      toast("Abrindo logs…");
    });
    el.appendChild(row);
  });
}

function renderMatchesTable() {
  const el = document.getElementById("tableMatches");
  el.innerHTML = "";

  const head = document.createElement("div");
  head.className = "row head";
  head.style.gridTemplateColumns = "1.2fr 0.55fr 0.9fr 0.9fr 0.9fr 2fr";
  head.innerHTML = `
    <div>Pessoa</div><div>Tipo</div><div>Valor</div><div>Run</div><div>Quando</div><div>Contexto</div>
  `;
  el.appendChild(head);

  state.matches.forEach(m => {
    const row = document.createElement("div");
    row.className = "row";
    row.style.gridTemplateColumns = "1.2fr 0.55fr 0.9fr 0.9fr 0.9fr 2fr";
    row.innerHTML = `
      <div>${escapeHtml(m.personName)}</div>
      <div><span class="pill">${m.matchType}</span></div>
      <div class="mono">${escapeHtml(m.matchedValue)}</div>
      <div class="mono">${escapeHtml(m.runId)}</div>
      <div>${fmt(m.createdAt)}</div>
      <div style="opacity:.9; line-height:1.35">${escapeHtml(m.contextSnippet)}</div>
    `;
    el.appendChild(row);
  });
}

function renderPeopleTable() {
  const q = (document.getElementById("peopleFilter").value || "").trim().toLowerCase();
  const filtered = !q
    ? state.people
    : state.people.filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.rf || "").toLowerCase().includes(q) ||
        (p.active ? "ativo" : "inativo").includes(q)
      );

  const el = document.getElementById("tablePeople");
  el.innerHTML = "";

  const head = document.createElement("div");
  head.className = "row head";
  head.style.gridTemplateColumns = "1.4fr 0.8fr 0.6fr";
  head.innerHTML = `<div>Nome</div><div>RF</div><div>Status</div>`;
  el.appendChild(head);

  filtered.forEach(p => {
    const row = document.createElement("div");
    row.className = "row";
    row.style.gridTemplateColumns = "1.4fr 0.8fr 0.6fr";
    row.innerHTML = `
      <div>${escapeHtml(p.name)}</div>
      <div class="mono">${escapeHtml(p.rf || "—")}</div>
      <div><span class="${p.active ? "pill ok" : "pill idle"}">${p.active ? "Ativo" : "Inativo"}</span></div>
    `;
    el.appendChild(row);
  });
}

function renderLogs() {
  document.getElementById("logsRunId").textContent = state.selectedRunId || "—";

  const box = document.getElementById("logBox");
  box.innerHTML = "";

  const lines = state.logs?.lines || [];
  if (!lines.length) {
    box.innerHTML = `<div style="opacity:.75; padding: 10px 2px;">Sem linhas de log.</div>`;
    return;
  }

  lines.forEach(l => {
    const div = document.createElement("div");
    div.className = `logLine ${l.level}`;
    div.innerHTML = `
      <span class="mono" style="opacity:.75;">${fmt(l.ts)}</span>
      <span class="mono" style="opacity:.85; font-weight:650;">${l.level}</span>
      <span style="opacity:.95;">${escapeHtml(l.message)}</span>
    `;
    box.appendChild(div);
  });
}

// TABS
function switchTab(tabKey) {
  document.querySelectorAll(".tab").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.tab === tabKey);
  });

  document.querySelectorAll(".tabPane").forEach(p => p.classList.add("hidden"));
  document.getElementById(`tab-${tabKey}`).classList.remove("hidden");
}

// EVENTS
function bindEvents() {
  document.querySelectorAll(".tab").forEach(btn => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });

  document.getElementById("btnRefresh").addEventListener("click", () => {
    state.status.now = isoNow();
    toast("Atualizado (mock).");
    renderHeaderCards();
    renderOverview();
  });

  document.getElementById("btnTrigger").addEventListener("click", () => {
    // simula uma execução "rodando"
    const runId = `run_manual_${Date.now()}`;
    const startedAt = isoNow();

    state.status.lastRun = {
      id: runId,
      status: "RUNNING",
      startedAt,
      checkedCount: 0,
      matchCount: 0,
      sourceUrl: "https://exemplo.prefeitura.sp.gov.br/diario-oficial",
    };

    state.runs.unshift(state.status.lastRun);
    state.selectedRunId = runId;
    state.logs = {
      runId,
      lines: [{ ts: isoNow(), level: "INFO", message: "Execução manual solicitada (mock)." }],
    };

    // update UI
    const opPill = document.getElementById("pillOp");
    opPill.className = "pill run";
    opPill.textContent = "Rodando";

    renderAll();
    toast("Fluxo iniciado (mock).");

    // finaliza após 1.2s
    setTimeout(() => {
      const finishedAt = isoNow();
      state.status.lastRun.status = "SUCCESS";
      state.status.lastRun.finishedAt = finishedAt;
      state.status.lastRun.checkedCount = 128;
      state.status.lastRun.matchCount = 1;

      // adiciona um match fake
      state.matches.unshift({
        id: `m_${Date.now()}`,
        runId,
        personName: "Exemplo Pessoa",
        rf: "9999999",
        matchType: "RF",
        matchedValue: "9999999",
        contextSnippet: "… EXEMPLO PESSOA, RF 9999999, foi citada em …",
        createdAt: finishedAt,
      });

      state.logs.lines.push({ ts: isoNow(), level: "INFO", message: "Finalizando execução com sucesso (mock)." });

      renderAll();
      toast("Fluxo finalizado (mock).");
    }, 1200);
  });

  document.getElementById("peopleFilter").addEventListener("input", renderPeopleTable);
  document.getElementById("btnClearPeopleFilter").addEventListener("click", () => {
    document.getElementById("peopleFilter").value = "";
    renderPeopleTable();
  });

  document.getElementById("btnReloadLogs").addEventListener("click", () => {
    state.logs = makeMockLogs(state.selectedRunId);
    renderLogs();
    toast("Logs recarregados (mock).");
  });
}

// HELPERS
function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// INIT
bindEvents();
loadMock();
