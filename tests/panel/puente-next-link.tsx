import type { ReactNode } from "react";

export default function Link({
  href,
  children,
  ...resto
}: {
  href: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <a href={href} {...resto}>
      {children}
    </a>
  );
}
