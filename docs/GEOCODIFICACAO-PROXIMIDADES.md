# Geocodificação das sugestões próximas

O treinamento local do ranqueador de candidatos é iniciado com:

```powershell
npm run nearby:train
```

O script lê, em modo somente leitura, os registros de hospedagem do Cadastur que estão publicados, revisados e têm endereço. Ele usa nome, município e endereço; contatos não entram no treinamento. O resultado é salvo em `server/nearby-geocoder-model.json`, que é carregado pela busca no servidor.

O modelo é uma regressão logística pequena para ranquear candidatos de endereço. Como os registros Cadastur não trazem coordenadas verificadas, os exemplos de treino são pares sintéticos derivados dos próprios cadastros. A validação exibida pelo script mede apenas esses exemplos sintéticos; ela não comprova a precisão geográfica real. O modelo não consulta serviços externos durante o treinamento.

Na consulta da hospedagem, a busca tenta nome e endereço juntos, endereço e município e, por fim, nome e município. Os resultados só são usados depois da conferência de município/estado e da pontuação textual. O resultado aprovado e a lista de lugares próximos continuam sujeitos ao cache do servidor.

O fluxo não faz geocodificação em lote. Ele consulta o Nominatim quando uma hospedagem é acessada e mantém a limitação de frequência e identificação da aplicação já implementadas. Antes de mudar o provedor, revise a [política de uso do Nominatim](https://operations.osmfoundation.org/policies/nominatim/).

Para medir precisão real e ajustar o ranqueador com dados supervisionados, será necessário revisar amostras de candidatos e registrar coordenadas confirmadas por uma fonte confiável. Não trate os pares sintéticos como coordenadas verdadeiras.
