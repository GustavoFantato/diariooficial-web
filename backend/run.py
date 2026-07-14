import os
import pdfplumber
import requests
import logging
from bs4 import BeautifulSoup

# Silencia os avisos do pdfminer que poluem o terminal
logging.getLogger('pdfminer').setLevel(logging.ERROR)

# Configurações
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
OUTPUT_TEXT = os.path.join(DATA_DIR, "diario.txt")

def baixar_e_extrair():
    os.makedirs(DATA_DIR, exist_ok=True)
    
    # URL da página que contém o link do PDF
    url_base = "https://diariooficial.prefeitura.sp.gov.br/md_epubli_controlador.php?acao=diario_aberto&formato=A"
    
    # Usamos uma sessão para manter os cookies necessários
    sess = requests.Session()
    sess.headers.update({"User-Agent": "Mozilla/5.0"})
    
    print("Acessando o portal para capturar o link do PDF...")
    resp = sess.get(url_base)
    
    # Localiza o link do PDF no HTML
    soup = BeautifulSoup(resp.text, 'html.parser')
    botao_pdf = soup.find("a", {"data-format": "pdf"})
    
    if not botao_pdf or not botao_pdf.get('href'):
        print("Erro: Não foi possível encontrar o botão de PDF. O site pode ter mudado.")
        return

    url_pdf = botao_pdf['href']
    print(f"Link encontrado: {url_pdf}")
    
    # Baixa o PDF
    print("Baixando o arquivo PDF...")
    resp_pdf = sess.get(url_pdf, stream=True)
    pdf_path = os.path.join(DATA_DIR, "temp_diario.pdf")
    
    with open(pdf_path, 'wb') as f:
        for chunk in resp_pdf.iter_content(chunk_size=8192):
            f.write(chunk)
    
    print("Extraindo texto do PDF (isso pode levar um tempo)...")
    texto_completo = []
    
    # O uso de laparams ajuda a ignorar elementos gráficos problemáticos
    with pdfplumber.open(pdf_path, laparams={"all_texts": True}) as pdf:
        for i, page in enumerate(pdf.pages):
            print(f"Processando página {i + 1} de {len(pdf.pages)}...")
            t = page.extract_text(layout=True) or ""
            texto_completo.append(t)
            
    with open(OUTPUT_TEXT, "w", encoding="utf-8") as f:
        f.write("\n".join(texto_completo))
        
    print(f"Texto salvo com sucesso em: {OUTPUT_TEXT}")
    
    # Deleta o PDF após extrair
    if os.path.exists(pdf_path):
        os.remove(pdf_path) 

if __name__ == "__main__":
    baixar_e_extrair()