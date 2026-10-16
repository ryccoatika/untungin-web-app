export type FormState =
  | {
      ok?: boolean;
      message?: string;
      fieldErrors?: Record<string, string[] | undefined>;
      /** Raw submitted strings, echoed on errors so forms can refill inputs. */
      values?: Record<string, string>;
    }
  | undefined;
