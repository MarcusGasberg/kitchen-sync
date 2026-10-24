import styles from "./part-tabs.module.css";

export interface Part {
  readonly href: string;
  readonly label: string;
}

interface PartTabsProps {
  readonly parts: ReadonlyArray<Part>;
  // The current page's path.
  readonly current: string;
}

// The series' parts in reading order. Plain links: each part is its own page.
// The list is ordered, so the visible number is decoration for the eye.
export function PartTabs({ parts, current }: PartTabsProps) {
  return (
    <nav aria-label="Parts">
      <ol className={styles.tabs}>
        {parts.map((part, index) => (
          <li key={part.href}>
            <a
              href={part.href}
              className={styles.tab}
              aria-current={part.href === current ? "page" : undefined}
            >
              <span className={styles.number} aria-hidden="true">
                {index + 1}
              </span>
              <span>{part.label}</span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
