"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  ArrowLeftRight,
  Ship,
  Plane,
  Clock,
  Info,
  Phone,
  CalendarDays,
  MapPin,
  Compass,
  MessageCircle,
} from "lucide-react";
import {
  navigationCities,
  navigationRoutes,
  navigationSources,
  navigationOperators,
  navigationPackages,
  weekDays,
  type ReferencePrice,
  type ScheduleDirection,
  type SourceId,
  type TransportMode,
} from "@/lib/navigation-data";
import {
  filterNavigationRoutes,
  filterVesselSchedules,
  isHistoricalPrice,
  navigationDate,
  navigationMoney,
  navigationPhone,
} from "@/lib/navigation";

function SourceLink({ id }: { id: SourceId }) {
  const source = navigationSources[id];
  return (
    <a href={source.url} target="_blank" rel="noopener noreferrer">
      {source.name} <ArrowUpRight size={13} aria-hidden="true" />
    </a>
  );
}

function Price({ price, today }: { price: ReferencePrice | null; today: string }) {
  if (!price)
    return (
      <div className="nav-price">
        <span>Tarifa não confirmada</span>
        <strong>Sob consulta</strong>
      </div>
    );
  const historical = isHistoricalPrice(price, today);
  return (
    <div className="nav-price">
      <span>
        {historical ? "Referência histórica" : "Valor encontrado"}
        {price.from ? " · a partir de" : ""}
      </span>
      <div>
        <strong>{navigationMoney(price.amountCents)}</strong>
        <span> / {price.unit}</span>
      </div>
      {price.travelDate && <small>Para {navigationDate(price.travelDate)}</small>}
      <small>Consultado em {navigationDate(price.observedAt)} · sujeito a alteração</small>
    </div>
  );
}

export function NavigationExplorer({ today }: { today: string }) {
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [mode, setMode] = useState<TransportMode | "todos">("todos");
  const [direction, setDirection] = useState<ScheduleDirection>("maues-manaus");
  const [day, setDay] = useState("");
  const routes = filterNavigationRoutes(navigationRoutes, { origin, destination, mode });
  const schedules = filterVesselSchedules(direction, day);
  const filtered = Boolean(origin || destination || mode !== "todos");
  function clearFilters() {
    setOrigin("");
    setDestination("");
    setMode("todos");
  }

  return (
    <>
      <section className="nav-section" id="passagens" aria-labelledby="passagens-title">
        <div className="nav-section-heading">
          <div>
            <p className="eyebrow">PLANEJE SEU TRAJETO</p>
            <h2 id="passagens-title">Por onde vamos?</h2>
          </div>
          <p>Passagens, trechos pesquisados e canais para consultar.</p>
        </div>
        <div className="nav-filters">
          <fieldset className="nav-mode-picker">
            <legend>Tipo de transporte</legend>
            {(
              [
                { value: "todos", label: "Todos", Icon: Compass },
                { value: "fluvial", label: "Fluvial", Icon: Ship },
                { value: "aereo", label: "Aéreo", Icon: Plane },
              ] as const
            ).map(({ value, label, Icon }) => (
              <button
                key={value}
                type="button"
                aria-pressed={mode === value}
                onClick={() => setMode(value)}
              >
                <Icon size={17} aria-hidden="true" />
                {label}
              </button>
            ))}
          </fieldset>
          <div className="nav-city-filters">
            <label htmlFor="nav-origin">
              Saindo de
              <select
                id="nav-origin"
                value={origin}
                onChange={(event) => setOrigin(event.target.value)}
              >
                <option value="">Todas as origens</option>
                {navigationCities.map((city) => (
                  <option key={city}>{city}</option>
                ))}
              </select>
            </label>
            <button
              className="nav-swap"
              type="button"
              aria-label="Inverter origem e destino"
              onClick={() => {
                setOrigin(destination);
                setDestination(origin);
              }}
            >
              <ArrowLeftRight size={19} aria-hidden="true" />
            </button>
            <label htmlFor="nav-destination">
              Indo para
              <select
                id="nav-destination"
                value={destination}
                onChange={(event) => setDestination(event.target.value)}
              >
                <option value="">Todos os destinos</option>
                {navigationCities.map((city) => (
                  <option key={city}>{city}</option>
                ))}
              </select>
            </label>
          </div>
        </div>
        <div className="nav-result-bar">
          <p role="status">
            {routes.length} {routes.length === 1 ? "trecho encontrado" : "trechos encontrados"}
          </p>
          {filtered && (
            <button type="button" onClick={clearFilters}>
              Limpar filtros
            </button>
          )}
          <span>Destinos no Amazonas</span>
        </div>
        <div className="nav-route-grid">
          {routes.map((route) => {
            const Icon = route.mode === "fluvial" ? Ship : Plane;
            const external = route.action.href.startsWith("https://");
            return (
              <article
                className="nav-route-card"
                key={route.id}
                aria-labelledby={route.id + "-title"}
              >
                <div className="nav-card-top">
                  <span className={`nav-mode-badge ${route.mode}`}>
                    <Icon size={16} aria-hidden="true" />
                    {route.mode === "fluvial" ? "Fluvial" : "Aéreo"}
                  </span>
                  <span className="nav-reference-label">
                    {route.price ? "Tarifa de referência" : "A confirmar"}
                  </span>
                </div>
                <h3 id={route.id + "-title"}>
                  {route.origin} <ArrowRight size={20} aria-label="para" /> {route.destination}
                </h3>
                <p className="nav-operator">{route.operator}</p>
                <p className="nav-route-description">{route.summary}</p>
                <p className="nav-schedule-summary">
                  <Clock size={15} aria-hidden="true" />
                  {route.schedule}
                </p>
                <div className="nav-card-bottom">
                  <Price price={route.price} today={today} />
                  <a
                    className="nav-action"
                    href={route.action.href}
                    target={external ? "_blank" : undefined}
                    rel={external ? "noopener noreferrer" : undefined}
                  >
                    {route.action.label}
                    <ArrowUpRight size={16} aria-hidden="true" />
                  </a>
                </div>
                <details className="nav-card-sources">
                  <summary>Fonte e condições</summary>
                  {route.price && <p>{route.price.note}</p>}
                  {route.sourceIds.map((id) => (
                    <div key={id}>
                      <SourceLink id={id} />
                      <p>{navigationSources[id].note}</p>
                    </div>
                  ))}
                </details>
              </article>
            );
          })}
        </div>
        {!routes.length && (
          <div className="nav-empty">
            <Compass size={32} aria-hidden="true" />
            <h3>Nenhum trecho com esses filtros.</h3>
            <p>
              A pesquisa ainda não tem informações para essa combinação. Experimente outro destino
              ou tipo de transporte.
            </p>
            <button className="button button-dark" type="button" onClick={clearFilters}>
              Ver todos os trechos
            </button>
          </div>
        )}
        <p className="nav-inline-note">
          <Info size={17} aria-hidden="true" />
          Valores de referência, sem consulta automática de vagas. Confirme tarifa, datas e
          condições no canal do fornecedor.
        </p>
      </section>

      <section className="nav-section nav-timetable" id="horarios" aria-labelledby="horarios-title">
        <div className="nav-section-heading">
          <div>
            <p className="eyebrow">ROTEIROS DE EMBARCAÇÕES</p>
            <h2 id="horarios-title">Maués ↔ Manaus, dia a dia.</h2>
          </div>
          <Ship size={36} strokeWidth={1.4} aria-hidden="true" />
        </div>
        <p>
          Horários locais de referência dos cartazes enviados. As publicações não informam validade;
          confirme a saída, o porto e o preço com a embarcação.
        </p>
        <div className="nav-table-controls">
          <div className="nav-directions" role="group" aria-label="Sentido do roteiro">
            <button
              type="button"
              aria-pressed={direction === "maues-manaus"}
              onClick={() => setDirection("maues-manaus")}
            >
              Maués <ArrowRight size={16} aria-hidden="true" /> Manaus
            </button>
            <button
              type="button"
              aria-pressed={direction === "manaus-maues"}
              onClick={() => setDirection("manaus-maues")}
            >
              Manaus <ArrowRight size={16} aria-hidden="true" /> Maués
            </button>
          </div>
          <label htmlFor="nav-weekday">
            Dia da semana
            <select id="nav-weekday" value={day} onChange={(event) => setDay(event.target.value)}>
              <option value="">Todos os dias</option>
              {weekDays.map((name, index) => (
                <option key={name} value={String(index)}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div
          className="nav-table-scroll"
          role="region"
          aria-label="Tabela de horários e contatos; deslize para ver todas as colunas"
          tabIndex={0}
        >
          <table>
            <caption>
              {direction === "maues-manaus" ? "Maués → Manaus" : "Manaus → Maués"} · horários a
              confirmar
            </caption>
            <thead>
              <tr>
                <th scope="col">Dia da semana</th>
                <th scope="col">Embarcação</th>
                <th scope="col">Saída</th>
                <th scope="col">Contato da embarcação</th>
              </tr>
            </thead>
            <tbody>
              {schedules.map((row) => (
                <tr key={row.direction + row.day}>
                  <th scope="row">{weekDays[row.day]}</th>
                  <td>{row.vessel}</td>
                  <td>
                    <strong
                      className={
                        row.direction === "manaus-maues" && (row.day === 4 || row.day === 5)
                          ? "nav-time-highlight"
                          : "nav-time"
                      }
                    >
                      {row.time.replace(":", "h")}
                    </strong>
                  </td>
                  <td>
                    <div className="nav-phones">
                      {navigationOperators[row.operator].phones.map((phone) => (
                        <a
                          key={phone}
                          href={`tel:+55${phone}`}
                          aria-label={`Ligar para ${row.vessel}: ${navigationPhone(phone)}`}
                        >
                          <Phone size={13} aria-hidden="true" />
                          {navigationPhone(phone)}
                        </a>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="nav-table-foot">
          <p>
            <Info size={16} aria-hidden="true" />
            Na saída de Manaus, atenção à sexta às 18h e ao sábado às 12h.
          </p>
          <a
            href={`https://wa.me/55${navigationOperators.pp.whatsapp}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <MessageCircle size={17} aria-hidden="true" />
            Consultar Navegação PP
          </a>
        </div>
        <div className="nav-poster-links">
          <span>Ver os roteiros originais:</span>
          <SourceLink id="folha" />
          <SourceLink id="pp" />
        </div>
      </section>

      <section className="nav-section" id="pacotes" aria-labelledby="pacotes-title">
        <div className="nav-section-heading">
          <div>
            <p className="eyebrow">VÁ ALÉM DA CHEGADA</p>
            <h2 id="pacotes-title">Pacotes e experiências.</h2>
          </div>
          <p>Ofertas pesquisadas junto aos fornecedores.</p>
        </div>
        <div className="nav-packages-layout">
          {navigationPackages.map((item) => (
            <article className="nav-package-card" key={item.id}>
              <div className="nav-package-icon">
                <Compass size={30} strokeWidth={1.4} aria-hidden="true" />
              </div>
              <div className="nav-package-copy">
                <p className="nav-package-duration">
                  <MapPin size={14} aria-hidden="true" /> Maués, AM <span>·</span>
                  <CalendarDays size={14} aria-hidden="true" />
                  {item.duration}
                </p>
                <h3>{item.title}</h3>
                <p>
                  {item.subtitle} · {item.provider}
                </p>
                <Price price={item.price} today={today} />
                <p className="nav-package-couple">Também anunciado: R$ 7.800 por casal.</p>
                <p>
                  <strong>Inclui:</strong> {item.includes}
                </p>
                <p>
                  <strong>Confirme antes de reservar:</strong> {item.excludes}
                </p>
                <p className="nav-package-conditions">{item.price.note}</p>
                <a
                  className="button button-dark"
                  href={navigationSources[item.sourceId].url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Ver pacote na agência <ArrowUpRight size={17} aria-hidden="true" />
                </a>
              </div>
            </article>
          ))}
          <aside className="nav-complete-trip">
            <p className="eyebrow">DO EMBARQUE À ESTADIA</p>
            <h3>Faça a viagem do seu jeito.</h3>
            <p>Combine seu transporte com hospedagens e passeios cadastrados na Hub.</p>
            <Link href="/hospedagens">
              Encontrar hospedagem <ArrowUpRight size={18} aria-hidden="true" />
            </Link>
            <Link href="/passeios">
              Explorar passeios e guias <ArrowUpRight size={18} aria-hidden="true" />
            </Link>
            <small>Cada serviço tem sua própria disponibilidade e contratação.</small>
          </aside>
        </div>
      </section>

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
    </>
  );
}
