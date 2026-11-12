import { Suspense } from "react";
import { PatientProfile } from "./PatientProfile";

export default function Page({ params }: PageProps<"/patients/[id]">) {
  return (
    <Suspense fallback={null}>
      {params.then(({ id }) => (
        <PatientProfile id={decodeURIComponent(id)} />
      ))}
    </Suspense>
  );
}
