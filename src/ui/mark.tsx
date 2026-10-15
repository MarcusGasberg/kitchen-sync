import styles from "./mark.module.css";

// A client's pseudonym mark: the first four characters of its clientId, enough
// to tell two devices apart at a glance.
export const shortClientId = (clientId: string) =>
  clientId.slice(0, 4).toUpperCase();

export function Mark({ clientId }: { readonly clientId: string }) {
  return (
    <span className={styles.mark} title={`Device ${clientId}`}>
      <span className="visually-hidden">Device </span>
      {shortClientId(clientId)}
    </span>
  );
}
