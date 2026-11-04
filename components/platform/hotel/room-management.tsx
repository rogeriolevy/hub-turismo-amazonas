import { PaginationNavigation } from "../pagination-navigation";
import { PageIntro } from "../shared";
import { RoomEditor } from "../panel-forms";
import { RoomStatusBoard } from "../room-status-board";
import { money } from "@/lib/platform-schema/format";
import type { InventoryPage } from "@/server/inventory-read-service";
import type { OperationalRoom } from "@/server/platform-models";

export function RoomManagement({
  companyId,
  companyName,
  roomsPage,
  canManageInventory,
}: {
  companyId: string;
  companyName: string;
  roomsPage: InventoryPage<OperationalRoom>;
  canManageInventory: boolean;
}) {
  const rooms = roomsPage.items;

  return (
    <>
      <PageIntro
        eyebrow={companyName}
        title="Quartos"
        description="Cada registro representa um quarto físico. A aprovação de reservas respeita os períodos já confirmados."
      />
      <RoomStatusBoard
        companyId={companyId}
        rooms={rooms}
        canManageInventory={canManageInventory}
      />
      {canManageInventory && (
        <details className="editor-card">
          <summary>Cadastrar quarto</summary>
          <RoomEditor companyId={companyId} />
        </details>
      )}
      <div className="editor-list">
        {rooms.map((room) => (
          <details className="editor-card" key={room.id}>
            <summary>
              <span>
                {room.code} · {room.name}
                <small>
                  Até {room.capacity} pessoas · {money(room.price_cents)} / noite
                </small>
              </span>
              <span className="status-pill">{room.active ? "Ativo" : "Indisponível"}</span>
            </summary>
            {canManageInventory ? (
              <RoomEditor companyId={companyId} room={room} />
            ) : (
              <p className="field-help">
                O cadastro deste quarto é gerenciado pelo gestor do hotel.
              </p>
            )}
          </details>
        ))}
      </div>
      <PaginationNavigation
        page={roomsPage.page}
        totalPages={roomsPage.totalPages}
        hrefForPage={(page) =>
          `/painel/hotel/quartos?${new URLSearchParams({ empresa: companyId, roomPage: String(page) }).toString()}`
        }
      />
    </>
  );
}
