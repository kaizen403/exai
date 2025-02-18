import { Suspense } from "react";
import ChatsPage from "./ChatsPage";

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
          Loading chat...
        </div>
      }
    >
      <ChatsPage />
    </Suspense>
  );
}
