# Busca de proximidades

A seção **O que tem por perto?** geocodifica o endereço público da hospedagem pelo Nominatim, consulta restaurantes, lanchonetes e cafés, bares e academias no Overpass e apresenta os estabelecimentos nomeados encontrados em um raio aproximado de 2 km. A distância exibida é em linha reta; cada item também pode ser aberto no Google Maps. Quando não há coordenadas verificáveis, os atalhos de busca no Maps continuam disponíveis com nome, endereço e município.

`GET /api/proximidades?id=<uuid>&origem=company|cadastur` aceita somente hospedagens publicadas. `data.provider` identifica OpenStreetMap como fonte dos lugares; `data.mapsProvider` identifica Google Maps como destino dos links. A resposta inclui o estado da consulta, os lugares próximos, a distância e a data do último resultado. Resultados e localização são armazenados em `nearby_place_cache`; o serviço coordena as chamadas pelo banco e reutiliza o cache para reduzir consultas repetidas.

O fluxo é iniciado pela visualização de uma hospedagem, sem geocodificação em lote. O Nominatim público é compartilhado: a aplicação limita as chamadas a uma por 1,1 segundo em todas as instâncias e mantém os endereços em cache. O Overpass também é compartilhado; a aplicação limita chamadas a uma por 1,1 segundo e a 90 por dia. Se o volume crescer ou um provedor pedir a troca, configure `OSM_NOMINATIM_URL` e `OSM_OVERPASS_URL` no ambiente; a configuração é repassada pelo Compose sem rebuild. Para tráfego elevado, use um provedor próprio ou contratado.

Os pedidos enviam ao provedor o nome, o endereço público e o município da hospedagem. Não envie dados pessoais ou confidenciais. A interface atribui os dados ao OpenStreetMap e informa a [política de uso do Nominatim](https://operations.osmfoundation.org/policies/nominatim/). A aplicação deve manter essa atribuição e respeitar os limites do serviço.

O modelo de ranqueamento do Nominatim usa exemplos sintéticos e só escolhe resultados que também correspondam ao município/estado e tenham forte similaridade de nome ou endereço. Isso reduz resultados incorretos, mas não comprova a precisão geográfica. Distâncias são aproximadas e a cobertura dos dados varia por cidade.

## Gemini

A integração Gemini está desativada enquanto a conta permanece sem quota para geração. Não há botão, endpoint de IA, ferramenta de diagnóstico ou chave Gemini na configuração local do projeto.
