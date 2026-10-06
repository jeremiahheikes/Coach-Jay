import { redirect } from "next/navigation";
// proxy.ts routes signed-in users to /coach or /student; anyone who lands here is signed out.
export default function Home() { redirect("/login"); }
