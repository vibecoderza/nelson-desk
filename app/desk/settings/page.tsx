import { DeskSettingsScreen } from "@/desk/back-office-screens.tsx";
import { DeskFrame } from "@/desk/frame.tsx";
import { deskSettings } from "@/desk/settings.ts";

export default async function SettingsPage() {
  return <DeskFrame current="settings"><DeskSettingsScreen view={deskSettings()} /></DeskFrame>;
}
