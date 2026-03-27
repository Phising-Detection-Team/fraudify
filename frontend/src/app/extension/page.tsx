import { ExtensionPopup } from "@/components/ExtensionPopup";

export default function ExtensionPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="relative">
        <div className="absolute -inset-10 bg-gradient-to-r from-accent-cyan/20 to-accent-purple/20 blur-3xl rounded-full" />
        <ExtensionPopup />
      </div>
    </div>
  );
}
