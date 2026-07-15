import os
import requests
import subprocess
from bs4 import BeautifulSoup

# Configurações
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
OUTPUT_TEXT = os.path.join(DATA_DIR, "diario.txt")
PDF_TEMP = os.path.join(DATA_DIR, "temp_diario.pdf")

def baixar_e_extrair():
    os.makedirs(DATA_DIR, exist_ok=True)
    
    # URL do portal do Diário Oficial
    url_base = "https://diariooficial.prefeitura.sp.gov.br/md_epubli_controlador.php?acao=diario_aberto&formato=A"
    
    sess = requests.Session()
    sess.headers.update({"User-Agent": "Mozilla/5.0"})
    
    print("Acessando o portal...")
    try:
        resp = sess.get(url_base)
        soup = BeautifulSoup(resp.text, 'html.parser')
        
        # Encontra o link do PDF (baseado no texto 'PDF' que apareceu no seu debug)
        link_tag = soup.find("a", string="PDF")
        
        if not link_tag or not link_tag.get('href'):
            print("Erro: Link do PDF não encontrado.")
            return

        url_pdf = link_tag['href']
        print(f"Baixando PDF de: {url_pdf}")
        
        # Faz o download do arquivo
        resp_pdf = sess.get(url_pdf, stream=True)
        with open(PDF_TEMP, 'wb') as f:
            for chunk in resp_pdf.iter_content(chunk_size=8192):
                f.write(chunk)
        
        print("Extraindo texto com pdftotext (instantâneo)...")
        # O pdftotext é muito mais rápido e eficiente que o pdfplumber
        # -layout preserva o posicionamento das colunas (essencial para o Diário Oficial)
        resultado = subprocess.run(
            ["pdftotext", "-layout", PDF_TEMP, OUTPUT_TEXT],
            capture_output=True, text=True
        )
        
        if resultado.returncode == 0:
            print(f"Sucesso! Texto salvo em: {OUTPUT_TEXT}")
        else:
            print(f"Erro na extração: {resultado.stderr}")
            
    except Exception as e:
        print(f"Erro inesperado: {e}")
    
    finally:
        # Limpeza do arquivo temporário
        if os.path.exists(PDF_TEMP):
            os.remove(PDF_TEMP)

if __name__ == "__main__":
    baixar_e_extrair()