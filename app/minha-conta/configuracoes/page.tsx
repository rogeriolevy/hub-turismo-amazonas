import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowUpRight,
  CalendarDays,
  CircleUserRound,
  Images,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";
import { Header, Footer } from "@/components/site/navigation";
import { SignOutButton } from "@/components/site/admin-auth";
import { pageActor } from "@/server/platform-session";
import { avatarKeyFromImage, defaultAvatarForUser, profileAvatarUrl } from "@/lib/profile-avatars";
import "./settings.css";

export const metadata: Metadata = {
  title: "Configurações da conta",
  robots: { index: false, follow: false },
  alternates: { canonical: "/minha-conta/configuracoes" },
};

export default async function AccountSettingsPage() {
  const actor = await pageActor("/minha-conta/configuracoes");
  const avatar = avatarKeyFromImage(actor.image) ?? defaultAvatarForUser(actor.id);

  return (
    <>
      <Header />
      <main id="conteudo" tabIndex={-1} className="portal-main account-settings-main">
        <div className="container">
          <Link href="/minha-conta" className="account-settings-back">
            ← Minha conta
          </Link>
          <section className="account-settings-heading" aria-labelledby="settings-title">
            <div>
              <p className="account-settings-kicker">PREFERÊNCIAS</p>
              <h1 id="settings-title">Configurações da conta</h1>
              <p>Gerencie seus dados, sua imagem de perfil e os acessos da sua conta.</p>
            </div>
            <Image
              className="account-settings-avatar"
              src={profileAvatarUrl(avatar)}
              alt=""
              width={76}
              height={76}
            />
          </section>

          <section className="account-settings-grid" aria-label="Opções da conta">
            <Link className="account-settings-card" href="/minha-conta?editar=perfil">
              <span className="account-settings-icon">
                <CircleUserRound size={22} aria-hidden="true" />
              </span>
              <span className="account-settings-card-copy">
                <strong>Dados do perfil</strong>
                <span>Altere seu nome e confira o e-mail de acesso.</span>
              </span>
              <ArrowUpRight size={18} aria-hidden="true" />
            </Link>
            <Link
              className="account-settings-card"
              href="/minha-conta?editar=avatar#account-avatar-options"
            >
              <span className="account-settings-icon">
                <Images size={22} aria-hidden="true" />
              </span>
              <span className="account-settings-card-copy">
                <strong>Avatar</strong>
                <span>Escolha uma das seis ilustrações disponíveis.</span>
              </span>
              <ArrowUpRight size={18} aria-hidden="true" />
            </Link>
            <Link className="account-settings-card" href="/minha-conta/reservas">
              <span className="account-settings-icon">
                <CalendarDays size={22} aria-hidden="true" />
              </span>
              <span className="account-settings-card-copy">
                <strong>Minhas reservas</strong>
                <span>Acompanhe as solicitações enviadas aos estabelecimentos.</span>
              </span>
              <ArrowUpRight size={18} aria-hidden="true" />
            </Link>
            <Link className="account-settings-card" href="/privacidade">
              <span className="account-settings-icon">
                <ShieldCheck size={22} aria-hidden="true" />
              </span>
              <span className="account-settings-card-copy">
                <strong>Privacidade</strong>
                <span>Consulte como os dados da sua conta são tratados.</span>
              </span>
              <ArrowUpRight size={18} aria-hidden="true" />
            </Link>
          </section>

          <section className="account-session-card" aria-labelledby="account-session-title">
            <span className="account-settings-icon account-session-icon">
              <LockKeyhole size={21} aria-hidden="true" />
            </span>
            <div>
              <h2 id="account-session-title">Sessão ativa</h2>
              <p>Conectado como {actor.email}. Encerre a sessão quando terminar de usar o site.</p>
            </div>
            <div className="account-session-signout">
              <SignOutButton showIcon />
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
