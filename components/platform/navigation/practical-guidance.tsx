"use client";

import { LocalizedClientTree } from "@/components/site/localized-client-tree";
import { navigationSources, type SourceId } from "@/lib/navigation-data";
import { SourceLink } from "./attribution";

export function NavigationPracticalGuidance() {
  return (
    <LocalizedClientTree>
      <section className="nav-section nav-practical" aria-labelledby="antes-title">
        <div>
          <p className="eyebrow">ANTES DE EMBARCAR</p>
          <h2 id="antes-title">Planeje com informação.</h2>
        </div>
        <div className="nav-faq">
          <details>
            <summary>O valor mostrado vale para qualquer data?</summary>
            <p>
              Não. Cada tarifa está vinculada à consulta e, quando informada, à data da viagem.
              Preços de ida não incluem a volta. Referências com viagem passada ou consultadas há
              mais de 30 dias recebem a indicação “Referência histórica”.
            </p>
          </details>
          <details>
            <summary>Há voo direto de Maués para Parintins ou Boa Vista do Ramos?</summary>
            <p>
              Não confirmamos oferta aérea direta nesses trechos. A referência aérea com preço
              encontrada é Manaus → Parintins. Verifique com a companhia se há itinerário e conexão
              que atendam à sua viagem. Boa Vista do Ramos fica no Amazonas; não confunda com Boa
              Vista, em Roraima.
            </p>
          </details>
          <details>
            <summary>Como confirmar a viagem de barco?</summary>
            <p>
              Use o telefone da embarcação ou o canal de venda para verificar o dia, o porto, a
              antecedência de embarque, a acomodação, a bagagem, a alimentação e o preço final. Os
              cartazes orientam o planejamento, mas não garantem uma saída ou vaga.
            </p>
          </details>
          <details>
            <summary>De onde vêm as informações?</summary>
            <p>
              Os horários semanais vêm dos dois cartazes enviados. As tarifas e o pacote foram
              consultados nos sites dos fornecedores; não há atualização automática.
            </p>
            <ul>
              {Object.entries(navigationSources).map(([id, source]) => (
                <li key={id}>
                  <SourceLink id={id as SourceId} />
                  <p>{source.note}</p>
                </li>
              ))}
            </ul>
          </details>
        </div>
      </section>
    </LocalizedClientTree>
  );
}
