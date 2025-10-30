# ArchAtlas

Aplicação web progressiva para exploração de mapas arquitetônicos com suporte a estilos personalizados. Esta versão traz melhorias na experiência de busca, localização e exportação.

## Recursos

- Alternância entre estilos "Mapa Base" e "Cheios e Vazios" usando Map IDs do Google Maps.
- Busca com `gmp-place-autocomplete` exibindo marcador e resumo do local selecionado.
- Botão "Minha localização" com feedback visual para centralizar o mapa na posição do usuário.
- Exportação para PNG via Static Maps API preservando a visão atual.
- Exportação DWG (DXF) com dados vetoriais da Overpass API para a área visível.
- Painel de status com coordenadas do centro do mapa e indicação do local ativo.
- Toasts para informar mudanças de estado e erros.
- PWA com cache offline básico dos principais arquivos.

## Desenvolvimento

1. Instale as dependências:

   ```bash
   npm install
   ```

2. Inicie o servidor local (Express) que já configura os cabeçalhos PWA:

   ```bash
   npm start
   ```

3. Abra `http://localhost:3000` no navegador. Para testar o service worker, sirva o projeto via HTTPS ou utilize `localhost`.

## Estrutura

- `index.html` contém a interface principal e toda a lógica de interação com o mapa.
- `service-worker.js` implementa cache offline incremental.
- `server.js` fornece um servidor Node/Express simples para desenvolvimento e deploy.

## Notas

- Substitua a `API_KEY` do Google Maps por uma credencial própria com as bibliotecas `places` e `marker` habilitadas.
- Configure a variável de ambiente `GOOGLE_MAPS_API_KEY` (ou ajuste a constante em `index.html`) para habilitar as exportações.
- Recursos de geolocalização requerem consentimento do usuário e podem falhar em ambientes inseguros (HTTP).
