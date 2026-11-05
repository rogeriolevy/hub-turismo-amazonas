"use client";

import {
  BedDouble,
  BriefcaseBusiness,
  Compass,
  House,
  Ship,
  Sparkles,
  UtensilsCrossed,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navigationIcons = {
  accommodations: BedDouble,
  navigation: Ship,
  food: UtensilsCrossed,
  experiences: Compass,
  agencies: BriefcaseBusiness,
  services: Sparkles,
} as const;

type PlatformLink = {
  href: string;
  label: string;
  icon: keyof typeof navigationIcons;
};

export function PlatformNavigation({
  ariaLabel,
  homeLabel,
  links,
}: {
  ariaLabel: string;
  homeLabel: string;
  links: PlatformLink[];
}) {
  const pathname = usePathname();

  return (
    <nav className="header-primary-nav header-primary-nav--platform" aria-label={ariaLabel}>
      {pathname !== "/plataforma" ? (
        <Link className="header-primary-link" href="/plataforma">
          <House size={17} strokeWidth={1.8} aria-hidden="true" />
          <span>{homeLabel}</span>
        </Link>
      ) : null}
      {links.map(({ href, label, icon }) => {
        const Icon = navigationIcons[icon];
        const isCurrent = pathname === href || pathname.startsWith(`${href}/`);

        return (
          <Link
            className="header-primary-link"
            href={href}
            key={href}
            aria-current={isCurrent ? "page" : undefined}
          >
            <Icon size={17} strokeWidth={1.8} aria-hidden="true" />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
