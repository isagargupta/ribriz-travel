import { redirect } from "next/navigation";

/** The account page became the traveller dashboard. Old links still work. */
export default function AccountPage() {
  redirect("/me");
}
