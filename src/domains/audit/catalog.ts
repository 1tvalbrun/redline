// The audit lane's control catalog: CIS Critical Security Controls v8.1.2,
// restated. Safeguard numbers and titles are the factual skeleton of the
// framework; every restatement, evidence list, and probe is our own text,
// authored against docs/reference/cis-catalog-verified.json (Excel + PDF
// cross-validated) and pending SME review. Never quote CIS descriptions
// verbatim: the Controls are CC BY-NC-ND, and commercial use of their text
// requires CIS approval. Session areas are deliberately small — a real
// audit session covers a handful of safeguards, not a framework.

export type Safeguard = {
  // CIS v8.1.2 safeguard number (factual reference).
  id: string
  // Official short title (factual skeleton).
  title: string
  ig: "IG1" | "IG2" | "IG3"
  // What the safeguard requires, in our words.
  restatement: string
  // What an assessor asks to see.
  evidence: string[]
  // The question an assessor actually opens with.
  probe: string
}

export type ControlArea = {
  key: string
  // Chip label in the intake; also the stored scope value.
  label: string
  control: number
  // Official CIS Control title (factual skeleton).
  controlTitle: string
  safeguards: Safeguard[]
}

export const CONTROL_AREAS: ControlArea[] = [
  {
    key: "data-recovery",
    label: "Data recovery · 11",
    control: 11,
    controlTitle: "Data Recovery",
    safeguards: [
      {
        id: "11.1",
        title: "Establish and Maintain a Data Recovery Process",
        ig: "IG1",
        restatement:
          "A written data recovery process exists: what gets backed up, what gets restored first, and how backup data is secured. It's reviewed at least annually, or when the environment changes materially.",
        evidence: [
          "The current recovery process document with its last review date",
          "Backup procedures covering scope and restore priority",
          "The change history showing the annual review actually happens",
        ],
        probe:
          "Walk me through your recovery document. When was it last reviewed, and what changed in that review?",
      },
      {
        id: "11.2",
        title: "Perform Automated Backups",
        ig: "IG1",
        restatement:
          "Backups of in-scope assets run automatically, at least weekly, and more often where the data's sensitivity warrants it.",
        evidence: [
          "The backup tool's schedule configuration",
          "The last week of backup job logs showing completion",
          "The list of in-scope assets the schedule covers",
        ],
        probe: "Show me the schedule, and the last seven days of backup job results.",
      },
      {
        id: "11.3",
        title: "Protect Recovery Data",
        ig: "IG1",
        restatement:
          "Backup data is protected as strongly as the originals, through encryption or separation as the data requires.",
        evidence: [
          "Encryption settings on the backup storage",
          "The access controls limiting who can read backups",
        ],
        probe: "Who can read your backups today, and how would you know if someone did?",
      },
      {
        id: "11.4",
        title: "Establish and Maintain an Isolated Instance of Recovery Data",
        ig: "IG1",
        restatement:
          "At least one copy of recovery data is isolated from the environment it protects (offline, off-site, or in separately controlled cloud storage) so an incident in production can't reach it.",
        evidence: [
          "Where the isolated copy lives and what separates it",
          "Versioning and retention settings on the backup destination",
        ],
        probe:
          "If ransomware took your production environment tonight, explain to me why it can't touch this copy.",
      },
      {
        id: "11.5",
        title: "Test Data Recovery",
        ig: "IG2",
        restatement:
          "Recovery is tested at least quarterly against a sample of in-scope assets: restores are proven, not assumed.",
        evidence: [
          "The most recent recovery test report, with date and outcome",
          "Recovery time and recovery point results against your targets",
          "Follow-up actions from restores that failed or ran slow",
        ],
        probe:
          "Tell me about your last recovery test: what did you restore, how long did it take, and what broke?",
      },
    ],
  },
  {
    key: "account-management",
    label: "Account management · 5",
    control: 5,
    controlTitle: "Account Management",
    safeguards: [
      {
        id: "5.1",
        title: "Establish and Maintain an Inventory of Accounts",
        ig: "IG1",
        restatement:
          "A maintained inventory covers user, administrator, and service accounts (name, username, start and stop dates, department), and active accounts are revalidated as authorized at least quarterly.",
        evidence: [
          "The account inventory itself",
          "The most recent quarterly validation record",
          "How service accounts are tracked and owned",
        ],
        probe:
          "Open the inventory. When did you last confirm that every active account should still be active?",
      },
      {
        id: "5.2",
        title: "Use Unique Passwords",
        ig: "IG1",
        restatement:
          "Unique passwords everywhere, with a floor of 8 characters on MFA-protected accounts and 14 characters where there's no MFA.",
        evidence: [
          "The password policy configuration",
          "Where the policy is enforced: directory, SSO, or per system",
        ],
        probe: "Where is that enforced, and what happens when someone tries something shorter?",
      },
      {
        id: "5.3",
        title: "Disable Dormant Accounts",
        ig: "IG1",
        restatement:
          "Accounts idle for 45 days are disabled or deleted, wherever the platform supports it.",
        evidence: [
          "The dormancy report or query that finds them",
          "The last batch of accounts this process actually caught",
        ],
        probe: "Show me the last account this process disabled, and when.",
      },
      {
        id: "5.4",
        title: "Restrict Administrator Privileges to Dedicated Administrator Accounts",
        ig: "IG1",
        restatement:
          "Administrative privileges live on dedicated admin accounts; everyday computing (email, browsing, documents) happens on a separate, non-privileged account.",
        evidence: [
          "The admin account list next to primary accounts",
          "The policy or configuration keeping the two apart",
        ],
        probe: "You personally: how many accounts do you have, and which one reads your email?",
      },
    ],
  },
  {
    key: "access-control",
    label: "Access control · 6",
    control: 6,
    controlTitle: "Access Control Management",
    safeguards: [
      {
        id: "6.1",
        title: "Establish an Access Granting Process",
        ig: "IG1",
        restatement:
          "A documented process, ideally automated, governs granting access on hire or role change, and it's actually followed.",
        evidence: [
          "The documented granting process",
          "A recent hire's access trail matching that process",
        ],
        probe: "Take your newest hire. Walk me through exactly how their access came to exist.",
      },
      {
        id: "6.2",
        title: "Establish an Access Revoking Process",
        ig: "IG1",
        restatement:
          "Access is revoked immediately on termination, rights revocation, or role change, disabling rather than deleting where audit trails must survive.",
        evidence: [
          "The documented revocation process",
          "A recent leaver's disable timestamp next to their departure date",
        ],
        probe: "Your last departure: how long passed between them leaving and their access dying?",
      },
      {
        id: "6.3",
        title: "Require MFA for Externally-Exposed Applications",
        ig: "IG1",
        restatement:
          "Every externally reachable application enforces MFA where it's supported. Enforcement through your directory or SSO counts.",
        evidence: [
          "The list of externally exposed applications",
          "MFA enforcement configuration, per app or at the SSO layer",
        ],
        probe: "Pick any externally facing app you run and show me where its MFA is enforced.",
      },
      {
        id: "6.4",
        title: "Require MFA for Remote Network Access",
        ig: "IG1",
        restatement: "Remote network access requires MFA. No carve-outs.",
        evidence: ["The VPN or remote-access MFA configuration"],
        probe: "What happens, exactly, when someone connects remotely with only a password?",
      },
      {
        id: "6.5",
        title: "Require MFA for Administrative Access",
        ig: "IG1",
        restatement:
          "All administrative access takes MFA wherever the asset supports it, on-site or through a service provider.",
        evidence: [
          "Admin MFA enforcement across your systems",
          "The exceptions list, with the reason for each",
        ],
        probe: "Which administrative surface doesn't have MFA yet, and why?",
      },
    ],
  },
  {
    key: "incident-response",
    label: "Incident response · 17",
    control: 17,
    controlTitle: "Incident Response Management",
    safeguards: [
      {
        id: "17.1",
        title: "Designate Personnel to Manage Incident Handling",
        ig: "IG1",
        restatement:
          "One named person owns incident handling, with at least one named backup; if a provider is involved, someone internal still oversees them. Reviewed annually.",
        evidence: [
          "The designation in writing, with the backup named",
          "The provider arrangement and its internal overseer, if any",
          "The last annual review of the designation",
        ],
        probe: "Who runs the room when an incident starts, and who runs it if they're on a plane?",
      },
      {
        id: "17.2",
        title: "Establish and Maintain Contact Information for Reporting Security Incidents",
        ig: "IG1",
        restatement:
          "A maintained contact list covers everyone an incident might require (staff, providers, law enforcement, insurers, agencies), and it's verified at least annually.",
        evidence: ["The contact list, with its last verification date"],
        probe:
          "It's two in the morning and you need your cyber insurer. Where's the number, and when was it last checked?",
      },
      {
        id: "17.3",
        title: "Establish and Maintain an Enterprise Process for Reporting Incidents",
        ig: "IG1",
        restatement:
          "A documented process tells the whole workforce how to report an incident (how fast, to whom, through what channel, with what minimum details), and everyone can actually find it.",
        evidence: [
          "The published reporting process",
          "Where the workforce sees it",
          "Its last review date",
        ],
        probe:
          "If your newest employee saw something wrong right now, what exactly would they do?",
      },
    ],
  },
]

export const areaByLabel = (label: string): ControlArea | undefined =>
  CONTROL_AREAS.find((area) => area.label === label)

// Fallback for prompts when the scope's area is missing or unrecognized:
// Data Recovery, the worked example this lane was built from.
export const DEFAULT_AREA = CONTROL_AREAS[0]
