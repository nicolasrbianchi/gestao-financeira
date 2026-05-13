# Finanças Mobile PWA

App mobile-first para usar o Google Sheets como banco de dados.

## Arquivos

- `index.html`: tela principal.
- `styles.css`: visual mobile.
- `app.js`: lógica do app.
- `manifest.webmanifest`: instalação como PWA.
- `sw.js`: cache básico.
- `Codigo.gs`: código para colar no Google Apps Script.

## Como configurar

### 1. Subir a planilha para o Google Sheets

Abra sua planilha no Google Sheets.

### 2. Criar Apps Script

No Google Sheets:

1. Vá em `Extensões > Apps Script`.
2. Apague o conteúdo padrão.
3. Cole o conteúdo de `Codigo.gs`.
4. No topo do arquivo, preencha:

```js
const SPREADSHEET_ID = "ID_DA_SUA_PLANILHA";
const SECRET_TOKEN = "uma-chave-secreta-sua";
```

O ID é o trecho da URL entre `/d/` e `/edit`.

Exemplo:

```txt
https://docs.google.com/spreadsheets/d/1ABCDEF123456/edit
```

ID:

```txt
1ABCDEF123456
```

### 3. Implantar como Web App

No Apps Script:

1. Clique em `Implantar > Nova implantação`.
2. Escolha o tipo `App da Web`.
3. Executar como: `Eu`.
4. Quem pode acessar: `Qualquer pessoa com o link`.
5. Clique em implantar.
6. Copie a URL que termina com `/exec`.

### 4. Rodar a interface

Para testar rápido:

1. Abra `index.html` no navegador.
2. Clique na engrenagem.
3. Cole a URL do Apps Script.
4. Cole o mesmo token secreto.
5. Salve.

Para usar no celular, hospede estes arquivos em qualquer hospedagem estática, como:

- GitHub Pages
- Netlify
- Vercel
- Firebase Hosting

Depois abra o link no celular e use "Adicionar à tela inicial".

## Observação de segurança

Este MVP usa token simples. Para uso pessoal, resolve bem. Para publicar ou compartilhar com outras pessoas, o ideal é evoluir para login Google.
