import { LegalShell } from "@/components/shared/LegalShell"
import { LEGAL_ENTITY } from "@/lib/legal"

export const metadata = { title: "Privacy Policy · Prestage AI" }

const PrivacyPage = () => (
  <LegalShell title="Privacy Policy">
    <section>
      <h2>Who we are</h2>
      <p>
        Prestage AI is operated by {LEGAL_ENTITY}, the data controller for the personal data
        described here. Contact:{" "}
        <a className="underline" href="mailto:development@mediabymayday.com">
          development@mediabymayday.com
        </a>
        .
      </p>
    </section>
    <section>
      <h2>What we collect</h2>
      <ul>
        <li>Account details from your sign-in provider: name and email address.</li>
        <li>
          Content you create to use the service: your briefs, uploaded documents, the text
          transcripts of your practice sessions (including what you say aloud, transcribed),
          and the feedback and reports generated from them.
        </li>
        <li>
          Session media: your audio during a live session is streamed to run the conversation,
          and our avatar provider may create a recording of the session on its systems.
        </li>
      </ul>
      <p>We do not sell your data or use it for advertising.</p>
    </section>
    <section>
      <h2>How it&apos;s used</h2>
      <p>
        Solely to run the service: reading your materials, running your sessions, generating
        your feedback, and showing you your own history and progress. Your data is scoped to
        your account; other users cannot see it.
      </p>
    </section>
    <section>
      <h2>Who processes it</h2>
      <p>Running a session involves these processors, each receiving only what its role needs:</p>
      <ul>
        <li>Clerk: sign-in and account management</li>
        <li>Convex: database and file storage</li>
        <li>OpenAI: analysis of your briefs, materials, and session transcripts</li>
        <li>Runway: the live avatar conversation (your session audio and session recordings)</li>
        <li>AssemblyAI: speech-to-text for what you say in a session</li>
      </ul>
      <p>
        All connections are encrypted in transit. Each processor retains data for a limited
        period under its own policy. For example, AI providers may hold API data temporarily
        for abuse monitoring, and Runway holds session recordings on its systems.
      </p>
    </section>
    <section>
      <h2>Cookies</h2>
      <p>
        The service uses only essential cookies, set by our sign-in provider to keep you
        signed in. There are no advertising or cross-site tracking cookies.
      </p>
    </section>
    <section>
      <h2>Retention and deletion</h2>
      <p>
        Your content is kept so your history and progress work, until you delete it. Deleting
        your account (Settings → Delete account) permanently removes your ideas, uploads,
        transcripts, reports, and profile from our database and file storage. Copies held by
        the processors above expire under their own retention policies; we do not control
        those systems beyond our agreements with them. Your sign-in record at Clerk survives
        so you can sign in again; starting over begins at onboarding.
      </p>
    </section>
    <section>
      <h2>Security and breaches</h2>
      <p>
        Access to your data is scoped to your account at the database layer, secrets are kept
        server-side, and connections are encrypted. If a breach affects your personal data, we
        will notify you without undue delay.
      </p>
    </section>
    <section>
      <h2>Children</h2>
      <p>The service is not directed at, and may not be used by, anyone under 18.</p>
    </section>
    <section>
      <h2>Changes</h2>
      <p>
        If this policy changes materially, the version date above changes and you may be asked
        to review it again.
      </p>
    </section>
    <section>
      <h2>Contact</h2>
      <p>
        Privacy questions or requests:{" "}
        <a className="underline" href="mailto:development@mediabymayday.com">
          development@mediabymayday.com
        </a>
      </p>
    </section>
  </LegalShell>
)

export default PrivacyPage
