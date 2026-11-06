"use client";

import { ArrowRight, Info, MessageCircle, Phone, Ship } from "lucide-react";
import {
  navigationOperators,
  parintinsVesselSchedules,
  weekDays,
  type ParintinsDirection,
  type ScheduleDirection,
} from "@/lib/navigation-data";
import { filterVesselSchedules, navigationPhone } from "@/lib/navigation";
import { LocalizedClientTree } from "@/components/site/localized-client-tree";
import { SourceLink } from "./attribution";

type Props = {
  direction: ScheduleDirection;
  day: string;
  onDirectionChange: (direction: ScheduleDirection) => void;
  onDayChange: (day: string) => void;
};

const parintinsDirections: { id: ParintinsDirection; label: string }[] = [
  { id: "maues-parintins", label: "Maués → Parintins" },
  { id: "parintins-maues", label: "Parintins → Maués" },
];

export function NavigationVesselSchedule({
  direction,
  day,
  onDirectionChange,
  onDayChange,
}: Props) {
  const schedules = filterVesselSchedules(direction, day);

  return (
    <LocalizedClientTree>
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
              onClick={() => onDirectionChange("maues-manaus")}
            >
              Maués <ArrowRight size={16} aria-hidden="true" /> Manaus
            </button>
            <button
              type="button"
              aria-pressed={direction === "manaus-maues"}
              onClick={() => onDirectionChange("manaus-maues")}
            >
              Manaus <ArrowRight size={16} aria-hidden="true" /> Maués
            </button>
          </div>
          <label htmlFor="nav-weekday">
            Dia da semana
            <select
              id="nav-weekday"
              value={day}
              onChange={(event) => onDayChange(event.target.value)}
            >
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
      <section
        className="nav-section nav-timetable nav-parintins-timetable"
        id="horarios-parintins"
        aria-labelledby="horarios-parintins-title"
      >
        <div className="nav-section-heading">
          <div>
            <p className="eyebrow">ROTEIRO FLUVIAL</p>
            <h2 id="horarios-parintins-title">Maués ↔ Parintins</h2>
          </div>
          <Ship size={36} strokeWidth={1.4} aria-hidden="true" />
        </div>
        <p>
          Horários conforme a imagem enviada. Ela não informa a validade do quadro nem os contatos.
          Nos dias sem dados, “Não informado” significa que a imagem não preenche esse campo;
          confirme a programação com a embarcação antes de viajar.
        </p>
        {parintinsDirections.map(({ id, label }) => (
          <div className="nav-parintins-direction" key={id}>
            <h3>{label}</h3>
            <div
              className="nav-table-scroll"
              role="region"
              aria-label={`Horários de ${label}; deslize para ver todas as colunas`}
              tabIndex={0}
            >
              <table>
                <caption>{label} · horários de referência</caption>
                <thead>
                  <tr>
                    <th scope="col">Dia da semana</th>
                    <th scope="col">Embarcação</th>
                    <th scope="col">Horário</th>
                    <th scope="col">Contato</th>
                  </tr>
                </thead>
                <tbody>
                  {parintinsVesselSchedules
                    .filter((row) => row.direction === id)
                    .map((row) => (
                      <tr key={`${row.direction}-${row.day}`}>
                        <th scope="row">{weekDays[row.day]}</th>
                        <td>{row.vessel ?? "Não informado"}</td>
                        <td>
                          {row.time ? (
                            <strong className="nav-time">{row.time}</strong>
                          ) : (
                            "Não informado"
                          )}
                        </td>
                        <td>{row.contact ?? "Não informado"}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
        <div className="nav-poster-links">
          <span>Fonte:</span>
          <SourceLink id="parintinsPoster" />
        </div>
      </section>
    </LocalizedClientTree>
  );
}
