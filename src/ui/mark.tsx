import styles from "./mark.module.css";

// A client's pseudonym mark: the first four characters of its clientId, enough
// to tell two devices apart at a glance.
export const shortClientId = (clientId: string) =>
  clientId.slice(0, 4).toUpperCase();

interface MarkProps {
  readonly clientId: string;
  readonly tone?: "on-plate" | "on-cobalt";
}

export function Mark({ clientId, tone = "on-plate" }: MarkProps) {
  return (
    <span className={styles.mark} data-tone={tone} title={`Device ${clientId}`}>
      <span className="visually-hidden">Device </span>
      {shortClientId(clientId)}
    </span>
  );
}
