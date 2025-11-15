# Anual de Namoro

Um álbum digital comemorativo para celebrar cada ano do relacionamento com badges, cartas e memórias especiais. O projeto é uma single page application estática que pode ser publicada facilmente no GitHub Pages, Vercel ou em qualquer serviço de hospedagem de arquivos estáticos.

## Visão geral

- Interface responsiva em português, com tipografia Poppins e tema escuro romântico.
- Cards interativos de badges e cartas organizados por ano, com filtro dinâmico.
- Modal com detalhes de cada item, incluindo momentos marcantes configuráveis.
- Estrutura preparada para funcionar como Progressive Web App (PWA) com cache offline básico.

## Personalização

1. **Atualize o conteúdo dos anos** em `index.html`, na constante `colecaoAnual`. Substitua títulos, descrições, momentos e URLs das imagens pelos seus próprios.
2. **Defina a dedicatória** no novo bloco de dedicatória da página, editando o texto padrão ou adicionando mensagens personalizadas.
3. **Links pessoais** podem ser configurados no rodapé para direcionar para redes sociais ou outras páginas.

## Executando localmente

O site é estático, mas o repositório inclui um pequeno servidor Express para facilitar o desenvolvimento local, lidar com cabeçalhos PWA e manter as alterações compartilhadas em `data/collection.json` através da rota `/api/collection`.

```bash
npm install
npm start
```

Após iniciar, acesse `http://localhost:3000` no navegador. Para testar o service worker é recomendado utilizar `localhost` ou um ambiente HTTPS.

## Estrutura do projeto

- `index.html` — contém a estrutura da página, estilos e scripts responsáveis pelos cards e modal.
- `service-worker.js` — implementa o cache offline simples dos principais recursos.
- `manifest.json` — metadados da PWA (ícones, nome e cores do tema).
- `server.js` — servidor Express opcional para desenvolvimento.

## Deploy

Envie os arquivos estáticos (`index.html`, `manifest.json`, `service-worker.js`, `icon.png`) para qualquer serviço de hospedagem. Caso use GitHub Pages, habilite o GitHub Actions ou configure a publicação da branch `main` nas configurações do repositório.

## Licença

Distribuído sob a licença MIT, conforme arquivo `LICENSE`.
