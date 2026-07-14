import pandas as pd
import unicodedata
import re
import os
import json

# Define a pasta raiz do projeto
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CSV_PATH = os.path.join(BASE_DIR, 'data', 'namesList.csv')
DIARIO_PATH = os.path.join(BASE_DIR, 'backend', 'data', 'diario.txt')
OUTPUT_JSON = os.path.join(BASE_DIR, 'outputs', 'encontrados.json')

def normalize_text(s: str) -> str:
    """Padroniza o texto para busca."""
    s = unicodedata.normalize("NFKD", str(s))
    s = "".join(ch for ch in s if not unicodedata.combining(ch))
    return s.upper().strip()

# 1. Carrega os dados
try:
    # O header=0 garante que a primeira linha seja lida como nome das colunas
    lista_pessoas = pd.read_csv(CSV_PATH)
    # Garante que os nomes das colunas fiquem minúsculos e sem espaços
    lista_pessoas.columns = lista_pessoas.columns.str.strip().str.lower()
    
    with open(DIARIO_PATH, 'r', encoding='utf-8') as f:
        diario = normalize_text(f.read())
        
except Exception as e:
    print(f"Erro ao carregar arquivos: {e}")
    exit()

encontrados = []

print("Buscando no diário...")

# 2. Busca iterando pelas linhas do CSV
for index, row in lista_pessoas.iterrows():
    nome = str(row['nome'])
    unidade = str(row['unidade']) # Nova coluna
    rf = str(row['rf'])
    rf_vinc = str(row['rf/vinculo'])
    
    # Define a categoria (TIPO) baseada na unidade para o frontend filtrar
    categoria = "CEI" if "CEI" in unidade.upper() else ("EMEI" if "EMEI" in unidade.upper() else "OUTROS")
    
    nome_norm = normalize_text(nome)
    
    # Verifica cada critério
    encontrou_nome = re.search(r'\b' + re.escape(nome_norm) + r'\b', diario)
    encontrou_rf = (rf in diario) if rf != "-1" else False
    encontrou_rf_vinc = (rf_vinc in diario) if rf_vinc != "-1" else False
    
    if encontrou_nome or encontrou_rf or encontrou_rf_vinc:
        encontrados.append({
            'NOME': nome, 
            'RF': rf,
            'RF_VINCULO': rf_vinc,
            'TIPO': categoria  # Campo essencial para o app.js separar nas tabelas
        })
        print(f"Encontrado: {nome} (Tipo: {categoria})")

# 3. Salva os resultados em JSON
os.makedirs(os.path.dirname(OUTPUT_JSON), exist_ok=True)
with open(OUTPUT_JSON, 'w', encoding='utf-8') as f:
    json.dump(encontrados, f, ensure_ascii=False, indent=4)
print(f"Finalizado. {len(encontrados)} registros encontrados.")