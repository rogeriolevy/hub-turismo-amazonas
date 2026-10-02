import Link from "next/link";
import {
  BedDouble,
  CalendarClock,
  ClipboardCheck,
  LogIn,
  LogOut,
  Sparkles,
  UserRound,
} from "lucide-react";
import { displayDate, roomOperationalStatusLabels } from "@/lib/platform-schema";
import type { OperationalRoom } from "@/server/platform-models";
import { ActionForm } from "./action-form";
import "./room-status-board.css";

const occupiedLabel = "Ocupado";

export function HotelOperationSummary({
  arrivals,
  departures,
  pendingBookings,
  roomsToPrepare,
}: {
  arrivals: number;
  departures: number;
  pendingBookings: number;
  roomsToPrepare: number;
}) {
  const actions = [
    pendingBookings > 0 &&
      `${pendingBookings} ${pendingBookings === 1 ? "solicitação aguarda" : "solicitações aguardam"} análise.`,
    arrivals > 0 &&
      `${arrivals} ${arrivals === 1 ? "chegada prevista" : "chegadas previstas"} para hoje.`,
    departures > 0 &&
      `${departures} ${departures === 1 ? "saída prevista" : "saídas previstas"} para hoje.`,
    roomsToPrepare > 0 &&
      `${roomsToPrepare} ${roomsToPrepare === 1 ? "quarto precisa" : "quartos precisam"} de atenção da equipe.`,
  ].filter(Boolean);
  const items = [
    { label: "Chegadas", value: arrivals, icon: LogIn },
    { label: "Saídas", value: departures, icon: LogOut },
    { label: "Solicitações", value: pendingBookings, icon: ClipboardCheck },
    { label: "Quartos a preparar", value: roomsToPrepare, icon: BedDouble },
  ];

  return (
    <section className="hotel-operations-summary" aria-labelledby="hotel-summary-title">
      <div className="hotel-operations-summary-copy">
        <span className="hotel-operations-summary-icon">
          <Sparkles size={19} aria-hidden="true" />
        </span>
        <div>
          <p>RESUMO LOCAL DA OPERAÇÃO</p>
          <h2 id="hotel-summary-title">Hoje na hospedagem</h2>
          <span>
            {actions.length
              ? actions.join(" ")
              : "Sem pendências imediatas. Acompanhe as reservas e a situação dos quartos ao longo do dia."}
          </span>
        </div>
      </div>
      <div className="hotel-operations-summary-stats">
        {items.map(({ label, value, icon: Icon }) => (
          <div className="hotel-operations-summary-stat" key={label}>
            <span>
              <Icon size={14} aria-hidden="true" /> {label}
            </span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <p className="hotel-operations-summary-note">
        Gerado localmente a partir das reservas e situações dos quartos; nenhum dado de hóspede é
        enviado a um serviço de IA.
      </p>
    </section>
  );
}

export function RoomStatusBoard({
  companyId,
  rooms,
}: {
  companyId: string;
  rooms: OperationalRoom[];
}) {
  return (
    <section className="room-status-section" aria-labelledby="room-status-title">
      <div className="room-status-heading">
        <div>
          <p className="eyebrow">ACOMODAÇÕES</p>
          <h2 id="room-status-title">Situação dos quartos</h2>
        </div>
        <p>Ocupação vem do check-in. Depois do check-out, o quarto passa para limpeza.</p>
      </div>

      {rooms.length ? (
        <div className="room-status-grid">
          {rooms.map((room) => {
            const occupied = Boolean(room.current_guest);
            const status = occupied ? "occupied" : room.operational_status;
            const statusLabel = occupied
              ? occupiedLabel
              : roomOperationalStatusLabels[room.operational_status];

            return (
              <article className="room-status-card" key={room.id}>
                <header>
                  <span className="room-status-bed-icon">
                    <BedDouble size={19} aria-hidden="true" />
                  </span>
                  <span className="room-status-name">
                    <span>Quarto {room.code}</span>
                    <strong>{room.name}</strong>
                  </span>
                  <span className={`room-status-badge room-status-badge--${status}`}>
                    {statusLabel}
                  </span>
                </header>

                <div className="room-status-details">
                  <span>
                    <UserRound size={14} aria-hidden="true" /> Até {room.capacity} hóspedes
                  </span>
                  {occupied && room.current_guest ? (
                    <p>
                      Hospedagem em curso: <strong>{room.current_guest}</strong>
                      {room.current_departure && (
                        <span className="room-status-date">
                          <CalendarClock size={14} aria-hidden="true" /> Saída prevista para{" "}
                          {displayDate(room.current_departure)}
                        </span>
                      )}
                    </p>
                  ) : (
                    <p>
                      {room.active
                        ? "Situação operacional do quarto."
                        : "Fora de disponibilidade para novas solicitações."}
                    </p>
                  )}
                </div>

                {occupied ? (
                  <p className="room-status-hint">
                    Registre o check-out na reserva para liberar a atualização da situação.
                  </p>
                ) : (
                  <ActionForm
                    action="quarto-status"
                    fixed={{ company_id: companyId, room_id: room.id }}
                    initial={{ operational_status: room.operational_status }}
                    fields={[
                      {
                        name: "operational_status",
                        label: "Situação",
                        type: "select",
                        options: Object.entries(roomOperationalStatusLabels).map(
                          ([value, label]) => ({
                            value,
                            label,
                          }),
                        ),
                      },
                    ]}
                    label="Atualizar"
                  />
                )}
              </article>
            );
          })}
        </div>
      ) : (
        <div className="room-status-empty">
          <p>Cadastre os quartos físicos da hospedagem para acompanhar sua situação aqui.</p>
          <Link
            className="button button-dark"
            href={`/painel/hotel/quartos?empresa=${encodeURIComponent(companyId)}`}
          >
            Cadastrar quartos
          </Link>
        </div>
      )}
    </section>
  );
}
