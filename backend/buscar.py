import pandas as pd

lista_nomes = pd.read_excel('lista_nomes.xlsx')

with open('diario.txt', 'r', encoding='utf-8') as f:
    diario = f.read()

encontrados = []
for nome in lista_nomes['NOMES']:
    if nome in diario:
        encontrados.append(nome)

df_encontrados = pd.DataFrame({'NOMES': encontrados})
df_encontrados.to_excel('encontrados.xlsx', index=False)