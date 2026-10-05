"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { CalendarDays, Images, PencilLine, Settings2, UserRound } from "lucide-react";
import { SignOutButton } from "@/components/site/admin-auth";
import { profileAvatarUrl, type ProfileAvatarKey } from "@/lib/profile-avatars";
import { useLanguage } from "@/components/site/language-provider";

export function AccountMenu({
  name,
  email,
  avatar,
}: {
  name: string;
  email: string;
  avatar: ProfileAvatarKey;
}) {
  const menuRef = useRef<HTMLDetailsElement>(null);
  const { t } = useLanguage();

  useEffect(() => {
    function closeOnOutside(event: PointerEvent) {
      const menu = menuRef.current;
      if (menu && !menu.contains(event.target as Node)) menu.open = false;
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape" || !menuRef.current?.open) return;
      menuRef.current.open = false;
      menuRef.current.querySelector("summary")?.focus();
    }
    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  function closeMenu() {
    if (menuRef.current) menuRef.current.open = false;
  }

  return (
    <details className="header-account-menu" ref={menuRef}>
      <summary
        className="header-account-trigger"
        aria-label={t("account.openMenu", { name })}
        title={t("account.menuTitle")}
      >
        <Image src={profileAvatarUrl(avatar)} alt="" width={42} height={42} priority />
      </summary>
      <div className="header-account-dropdown">
        <div className="header-menu-profile">
          <strong>{name}</strong>
          <span>{email}</span>
        </div>
        <Link href="/minha-conta" onClick={closeMenu}>
          <UserRound size={17} aria-hidden="true" />
          <span>{t("module.account")}</span>
        </Link>
        <Link href="/minha-conta?editar=perfil" onClick={closeMenu}>
          <PencilLine size={17} aria-hidden="true" />
          <span>{t("profile.edit")}</span>
        </Link>
        <Link href="/minha-conta?editar=avatar#account-avatar-options" onClick={closeMenu}>
          <Images size={17} aria-hidden="true" />
          <span>{t("account.changeAvatar")}</span>
        </Link>
        <Link href="/minha-conta/configuracoes" onClick={closeMenu}>
          <Settings2 size={17} aria-hidden="true" />
          <span>{t("account.settings")}</span>
        </Link>
        <Link href="/minha-conta/reservas" onClick={closeMenu}>
          <CalendarDays size={17} aria-hidden="true" />
          <span>{t("account.bookings")}</span>
        </Link>
        <div className="header-menu-signout">
          <SignOutButton showIcon />
        </div>
      </div>
    </details>
  );
}
