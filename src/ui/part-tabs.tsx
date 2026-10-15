import styles from "./part-tabs.module.css";
import { Glyph, type SymbolName } from "./symbols";

export interface Part {
  readonly href: string;
  readonly label: string;
  readonly symbol: SymbolName;
}

interface PartTabsProps {
  readonly parts: ReadonlyArray<Part>;
  // The current page's path.
  readonly current: string;
}

// The series' parts as symbol tabs on the cobalt masthead. Plain links: each
// part is its own page.
export function PartTabs({ parts, current }: PartTabsProps) {
  return (
    <nav aria-label="Parts">
      <ul className={styles.tabs}>
        {parts.map((part) => (
          <li key={part.href}>
            <a
              href={part.href}
              className={styles.tab}
              aria-current={part.href === current ? "page" : undefined}
            >
              <Glyph symbol={part.symbol} className={styles.glyph} />
              <span>{part.label}</span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
