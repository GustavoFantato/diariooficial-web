import os
import re
import unicodedata
import zipfile
from datetime import datetime, timedelta
from urllib.parse import quote

import pandas as pd
import pytz
import requests
import pdfplumber
from bs4 import BeautifulSoup


# =========================
# CONFIG
# =========================
CONSULTA_URL = "https://diariooficial.prefeitura.sp.gov.br/md_epubli_controlador.php?acao=edicao_consultar"
DOWNLOAD_URL = "https://diariooficial.prefeitura.sp.gov.br/md_epubli_controlador.php?acao=edicao_download"

TZ = "America/Sao_Paulo"

# Coloque o seu CSV aqui (você disse que está em data/ com nome namesList.csv)
CSV_PATH = "../data/namesList.csv"

DATA_DIR = "../data"
OUT_DIR = "../outputs"
OUT_FOUND = os.path.join(OUT_DIR, "encontrados.csv")

# Campos do POST (conforme DevTools). O site pode ignorar html e devolver PDF.
TIPO_EDICAO = "C"
FORMATO_PEDIDO = "html"  # pode testar: "pdf", "html", "json", "csv", "xml"


# =========================
# NORMALIZAÇÃO
# =========================
def normalize_text(s: str) -> str:
    """Remove acentos, coloca em maiúsculo e colapsa espaços."""
    if s is None:
        return ""
    s = str(s)
    s = unicodedata.normalize("NFKD", s)
    s = "".join(ch for ch in s if not unicodedata.combining(ch))
    s = s.upper()
    s = re.sub(r"\s+", " ", s).strip()
    return s


def only_digits(s) -> str:
    """Extrai somente números (para RF)."""
    if s is None:
        return ""
    return re.sub(r"\D", "", str(s))


# =========================
# I/O helpers
# =========================
def is_zip(b: bytes) -> bool:
    return len(b) >= 4 and b[:4] == b"PK\x03\x04"


def save_bytes(path: str, content: bytes) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as f:
        f.write(content)


# =========================
# Extractors
# =========================
def extract_text_from_html(html_bytes: bytes) -> str:
    # tenta utf-8, fallback para latin-1 (às vezes ajuda)
    try:
        html = html_bytes.decode("utf-8", errors="replace")
    except Exception:
        html = html_bytes.decode("latin-1", errors="replace")

    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "noscript"]):
        tag.decompose()

    text = soup.get_text(" ")
    text = re.sub(r"\s+", " ", text).strip()
    return text


def extract_text_from_pdf(pdf_path: str) -> str:
    parts = []
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            t = page.extract_text() or ""
            if t:
                parts.append(t)
    return "\n".join(parts)


# =========================
# Download logic (robusto)
# =========================
def _read_hidden_inputs(html: str) -> dict:
    soup = BeautifulSoup(html, "html.parser")
    data = {}
    for inp in soup.select("input[type='hidden'][name]"):
        name = (inp.get("name") or "").strip()
        value = (inp.get("value") or "").strip()
        if name:
            data[name] = value
    return data


def download_edicao(date_str: str) -> tuple[str, str]:
    """
    Baixa a edição do dia 'date_str' (DD/MM/AAAA), usando sessão + hidden inputs.
    Retorna (saved_path, kind): 'pdf' | 'html' | 'zip' | 'other'
    """
    os.makedirs(DATA_DIR, exist_ok=True)

    sess = requests.Session()
    sess.headers.update({
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
                      "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    })

    # 1) abre a página de consulta com data (pra cookies e hidden inputs)
    consulta_url = f"{CONSULTA_URL}&dta={quote(date_str)}&formato=O"
    pre = sess.get(consulta_url, timeout=60)
    pre.raise_for_status()

    hidden = _read_hidden_inputs(pre.text)

    # 2) monta payload baseado no que a página fornece
    payload = {
        "hdnDtaEdicao": hidden.get("hdnDtaEdicao", date_str),
        "hdnTipoEdicao": hidden.get("hdnTipoEdicao", TIPO_EDICAO),
        "hdnBolEdicaoGerada": hidden.get("hdnBolEdicaoGerada", "true"),
        "hdnIdEdicao": hidden.get("hdnIdEdicao", ""),
        "hdnInicio": hidden.get("hdnInicio", "0"),
        "hdnFormato": FORMATO_PEDIDO,  # "html" (site pode devolver PDF mesmo)
    }

    headers = {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "Origin": "https://diariooficial.prefeitura.sp.gov.br",
        "Referer": consulta_url,
        "X-Requested-With": "XMLHttpRequest",
    }

    resp = sess.post(DOWNLOAD_URL, headers=headers, data=payload, timeout=120)

    if resp.status_code >= 400:
        stamp = date_str.replace("/", "-")
        err_path = os.path.join(DATA_DIR, f"erro_{stamp}_{resp.status_code}.html")
        with open(err_path, "wb") as f:
            f.write(resp.content)
        raise RuntimeError(
            f"Erro HTTP {resp.status_code} ao baixar edição. "
            f"Salvei a resposta em: {err_path}"
        )

    ct = (resp.headers.get("Content-Type") or "").lower()
    stamp = date_str.replace("/", "-")
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    content = resp.content

    if is_zip(content) or "zip" in ct:
        path = os.path.join(DATA_DIR, f"edicao_{stamp}_{ts}.zip")
        save_bytes(path, content)
        return path, "zip"

    if "application/pdf" in ct:
        path = os.path.join(DATA_DIR, f"edicao_{stamp}_{ts}.pdf")
        save_bytes(path, content)
        return path, "pdf"

    if "text/html" in ct or "html" in ct:
        path = os.path.join(DATA_DIR, f"edicao_{stamp}_{ts}.html")
        save_bytes(path, content)
        return path, "html"

    path = os.path.join(DATA_DIR, f"edicao_{stamp}_{ts}.bin")
    save_bytes(path, content)
    return path, "other"


# =========================
# Date fallback (seg-sex)
# =========================
def fmt_ddmmyyyy(dt: datetime) -> str:
    return dt.strftime("%d/%m/%Y")


def find_latest_available_date(max_back_days: int = 10) -> str:
    """
    Tenta encontrar uma data com edição disponível:
    começa por hoje e volta dia a dia até max_back_days.
    """
    now = datetime.now(pytz.timezone(TZ)).replace(hour=0, minute=0, second=0, microsecond=0)

    last_error = None
    for i in range(0, max_back_days + 1):
        candidate = now - timedelta(days=i)
        date_str = fmt_ddmmyyyy(candidate)

        try:
            # tenta baixar (se funcionar, achou)
            path, kind = download_edicao(date_str)
            print(f"[OK] Edição encontrada em {date_str} ({kind}) -> {path}")
            return date_str
        except Exception as e:
            last_error = e
            continue

    raise RuntimeError(
        f"Não encontrei nenhuma edição nos últimos {max_back_days} dias. Último erro: {last_error}"
    )


# =========================
# CSV loader
# =========================
def load_people_csv(path: str) -> pd.DataFrame:
    df = pd.read_csv(path, dtype=str, keep_default_na=False)
    df.columns = [c.strip().lower() for c in df.columns]
    required = {"nome", "unidade", "rf", "rf/vinculo"}
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"CSV faltando colunas: {sorted(missing)}")
    return df


# =========================
# Main
# =========================
def main():
    os.makedirs(OUT_DIR, exist_ok=True)

    # Encontra a última data disponível (resolve sábado/domingo/feriado)
    date_str = find_latest_available_date(max_back_days=10)

    # Baixa novamente nessa data (simples; depois dá pra otimizar)
    saved_path, kind = download_edicao(date_str)
    print("Baixado:", saved_path, "| tipo:", kind)

    # Extrai texto do arquivo baixado
    if kind == "html":
        with open(saved_path, "rb") as f:
            text = extract_text_from_html(f.read())

    elif kind == "pdf":
        text = extract_text_from_pdf(saved_path)

    elif kind == "zip":
        extract_dir = saved_path + "_extracted"
        os.makedirs(extract_dir, exist_ok=True)
        with zipfile.ZipFile(saved_path, "r") as z:
            z.extractall(extract_dir)

        html_file = None
        pdf_file = None
        for root, _, files in os.walk(extract_dir):
            for fn in files:
                low = fn.lower()
                if low.endswith((".html", ".htm")) and html_file is None:
                    html_file = os.path.join(root, fn)
                if low.endswith(".pdf") and pdf_file is None:
                    pdf_file = os.path.join(root, fn)

        if html_file:
            with open(html_file, "rb") as f:
                text = extract_text_from_html(f.read())
            kind = "html"
            saved_path = html_file
        elif pdf_file:
            text = extract_text_from_pdf(pdf_file)
            kind = "pdf"
            saved_path = pdf_file
        else:
            raise RuntimeError("ZIP baixado, mas não encontrei HTML nem PDF dentro.")

    else:
        raise RuntimeError(f"Formato inesperado ({kind}). Arquivo: {saved_path}")

    # Normaliza o texto do diário
    diario_norm = normalize_text(text)

    # Carrega o CSV
    df = load_people_csv(CSV_PATH)

    encontrados = []
    seen = set()

    for _, row in df.iterrows():
        nome = row["nome"].strip()
        unidade = row["unidade"].strip()
        rf = row["rf"].strip()
        rf_vinc = row["rf/vinculo"].strip()

        # ignora linhas especiais
        if rf == "-1" or rf_vinc == "-1":
            continue

        nome_norm = normalize_text(nome)
        rf_digits = only_digits(rf)

        achou_nome = bool(nome_norm) and (nome_norm in diario_norm)
        achou_rf = bool(rf_digits) and (rf_digits in diario_norm)

        if not (achou_nome or achou_rf):
            continue

        key = (nome_norm, unidade, rf_digits, rf_vinc)
        if key in seen:
            continue
        seen.add(key)

        encontrados.append({
            "nome": nome,
            "unidade": unidade,
            "rf": rf_digits if rf_digits else rf,
            "rf/vinculo": rf_vinc,
            "achou_nome": achou_nome,
            "achou_rf": achou_rf,
            "data_edicao": date_str,
            "arquivo": saved_path,
            "tipo": kind,
        })

    out = pd.DataFrame(encontrados)
    out.to_csv(OUT_FOUND, index=False, encoding="utf-8-sig")

    print("Encontrados:", len(out))
    print("Saída:", OUT_FOUND)


if __name__ == "__main__":
    main()
