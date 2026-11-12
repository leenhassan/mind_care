import { Suspense } from "react";
import { NoteView } from "./NoteView";

export default function Page({ params }: PageProps<"/notes/[id]">) {
  return (
    <Suspense fallback={null}>
      {params.then(({ id }) => (
        <NoteView id={decodeURIComponent(id)} />
      ))}
    </Suspense>
  );
}
