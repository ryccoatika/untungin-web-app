import { Fragment } from "react";
import { splitAfterSeparators } from "@/lib/format";

/** Renders a formatted number that may only wrap between its digit groups. */
export function GroupedNumber({ text }: { text: string }) {
  const segments = splitAfterSeparators(text);
  return (
    <>
      {segments.map((segment, index) => (
        <Fragment key={index}>
          {index > 0 && <wbr />}
          {segment}
        </Fragment>
      ))}
    </>
  );
}
