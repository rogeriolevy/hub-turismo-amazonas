"use client";

import {
  BedDouble,
  BriefcaseBusiness,
  Compass,
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
  links,
}: {
  ariaLabel: string;
  links: PlatformLink[];
}) {
  const pathname = usePathname();

  return (
    <nav className="header-primary-nav" aria-label={ariaLabel}>
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
