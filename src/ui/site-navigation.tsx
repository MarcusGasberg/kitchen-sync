import { Link } from "@tanstack/react-router";
import styles from "./site-navigation.module.css";

const pages = [
  { to: "/", label: "Grocery app", development: false },
  {
    to: "/present/prologue",
    label: "Prologue presentation",
    development: false,
  },
  { to: "/lab", label: "Lab", development: true },
  { to: "/specimen", label: "Specimen", development: true },
] as const;

export function SiteNavigation() {
  return (
    <nav aria-label="Site" className={styles.navigation}>
      <ul className={styles.links}>
        {pages
          .filter((page) => !page.development || import.meta.env.DEV)
          .map((page) => (
            <li key={page.to}>
              <Link
                to={page.to}
                activeOptions={{ exact: true }}
                activeProps={{ "aria-current": "page" }}
                className={styles.link}
              >
                {page.label}
              </Link>
            </li>
          ))}
      </ul>
    </nav>
  );
}
