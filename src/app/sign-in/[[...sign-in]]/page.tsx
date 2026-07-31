import { SignIn } from "@clerk/nextjs"

// Concrete values mirroring the Redline primitives in globals.css — Clerk
// derives hover/focus shades from these, so it needs real colors, not var()
// references. --red-deep (not --red) for interactive text: AA on paper.
const appearance = {
  variables: {
    colorPrimary: "#9e1b14",
    colorBackground: "#e4e2dc",
    colorText: "#18160f",
    colorTextSecondary: "#544f45",
    colorInputBackground: "#eae8e2",
    colorInputText: "#18160f",
    colorDanger: "#ce2b22",
    borderRadius: "0px",
    fontFamily: "var(--font-plex-sans), sans-serif",
  },
}

const SignInPage = () => (
  <main className="flex min-h-screen flex-col items-center justify-center gap-7 bg-surface p-6">
    <div className="text-center">
      <p className="font-display text-[34px] font-bold tracking-[-.02em] text-on-surface">
        Redline
      </p>
      <p className="mt-2 font-mono text-[10.5px] uppercase tracking-[.2em] text-red-fg">
        Invited testing · sign in to enter
      </p>
    </div>
    <SignIn appearance={appearance} />
  </main>
)

export default SignInPage
