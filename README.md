# Diário Oficial · Monitoramento

Sistema automatizado para monitorar menções de nomes e Registros Funcionais (RFs) no Diário Oficial da Prefeitura de São Paulo, integrado com um painel web moderno hospedado no GitHub Pages.

---

## 🚀 Funcionalidades

* **Busca Automatizada:** Executa via GitHub Actions nos dias úteis para baixar, processar e extrair o conteúdo do Diário Oficial (com suporte a fallback automático entre PDF e HTML).
* **Múltiplos Critérios de Match:** Identifica menções através de Nome, RF simples, Vínculos, RF com pontos, RF com pontos e vínculo, e RF com hífen e vínculo.
* **Destaque Visual:** Destaca de forma clara na tabela exatamente qual dado da pessoa gerou o *match* no Diário Oficial.
* **Interface Responsiva:** Painel web limpo e adaptado para visualização em computadores e celulares.
* **Histórico de Execuções:** Permite acompanhar o status e o registro das últimas execuções automáticas do robô.

---

## 🛠️ Tecnologias Utilizadas

* **Python:** Automação de requisições web, processamento de texto, tratamento de PDFs (`poppler-utils` / `pdftotext`) e cruzamento de dados.
* **Pandas:** Manipulação de planilhas e dados estruturados.
* **JavaScript & HTML/CSS:** Interface web interativa baseada em componentes web modernos e estilização customizada via Grid/Flexbox.
* **GitHub Actions:** Orquestração e execução automática das rotinas diárias.
* **GitHub Pages & GitHub Raw:** Hospedagem do frontend e armazenamento leve dos arquivos JSON gerados.

---

## 📂 Estrutura do Projeto

```text
├── backend/
│   ├── data/             # Arquivos temporários de texto/PDF do diário
│   ├── run.py            # Script de download e extração do Diário Oficial
│   └── buscar.py         # Script de cruzamento de dados com a planilha e geração do JSON
├── frontend/
│   └── app/              # Código fonte do site (HTML, CSS, JavaScript)
├── outputs/
│   └── encontrados.json  # Base de resultados gerada pelo robô para o site
└── .github/
    └── workflows/
        └── diario_automatico.yml  # Configuração do GitHub Actions (Rotina automática)