import Link from "next/link";
import { LegalDoc, type LegalSection } from "@/components/legal/legal-doc";

export const metadata = {
  title: "Privacy Policy",
  description: "What personal data RegMyTourna collects, why, who sees it, and your rights under the Data Privacy Act.",
};

const CONTACT = "hello@regmytourna.com";
const UPDATED = "November 13, 2026";

const sections: LegalSection[] = [
  {
    id: "scope",
    title: "Who we are and what this covers",
    body: (
      <>
        <p>
          RegMyTourna (&ldquo;we&rdquo;, &ldquo;us&rdquo;) runs an online platform for sports tournaments in the
          Philippines. This policy explains how we handle personal data when you use our website and apps (the
          &ldquo;Service&rdquo;) as a player, organizer, co-organizer, umpire or visitor.
        </p>
        <p>
          We follow the Data Privacy Act of 2012 (Republic Act No. 10173), its Implementing Rules and Regulations, and the
          issuances of the National Privacy Commission (NPC).
        </p>
        <p>
          <strong>Organizers and us.</strong> We decide how the Service itself handles data. Each organizer also uses the
          data of players in their events to run those events, and is responsible for that use, for example for data they
          enter or import themselves, like walk-in entries or player lists.
        </p>
      </>
    ),
  },
  {
    id: "collect",
    title: "What we collect",
    body: (
      <>
        <h3>You give us</h3>
        <ul>
          <li>
            <strong>Account details:</strong> your name, email address, password (stored only in encrypted form by our
            sign-in provider), and optionally your phone number, profile photo and home city.
          </li>
          <li>
            <strong>Registration details:</strong> the events and categories you enter, your partner&apos;s name and email,
            team changes, waitlist status, check-in, and petitions to change category with any proof images you upload.
          </li>
          <li>
            <strong>Organizer details:</strong> event information (venue, dates, fees, cover images), co-organizer
            invitations, umpire names, and payout details (such as GCash, Maya or bank account name and number) for
            withdrawals.
          </li>
          <li>
            <strong>Messages:</strong> what you send us by email or the contact page.
          </li>
        </ul>
        <h3>Organizers give us about you</h3>
        <ul>
          <li>
            Player names, and sometimes emails, entered at the desk (walk-ins), imported from a spreadsheet for bracket-only
            events, or corrected by the organizer.
          </li>
        </ul>
        <h3>Created as you use the Service</h3>
        <ul>
          <li>
            <strong>Payment records:</strong> amount, status, date and payment reference. Payments are processed by
            PayMongo; we don&apos;t receive or store your full card number or e-wallet login.
          </li>
          <li>
            <strong>Match records:</strong> brackets, scores, and an officiating log for each match (timers run, coin toss,
            first server, base players, each rally), with the time and the umpire who recorded it.
          </li>
          <li>
            <strong>Technical data:</strong> sign-in session cookies, IP address and basic device and browser information,
            used for security (for example, limiting wrong PIN attempts) and to keep the Service working.
          </li>
          <li>
            <strong>Data on your device:</strong> the umpire scoreboard saves scores in your browser&apos;s storage so
            scoring works offline, and caches umpire pages so they open without signal. This stays on the device until it
            syncs or you clear it.
          </li>
          <li>
            <strong>Free umpire tool:</strong> if you use the public scoring tool without an account, we store match names
            and live scores on our servers for about seven days so a shared TV link can update. Anyone with that link can
            view the scoreboard.
          </li>
        </ul>
        <p>
          We don&apos;t ask for sensitive personal information (such as government IDs, health, religion or financial
          account passwords). Please don&apos;t upload it in petitions or event descriptions.
        </p>
      </>
    ),
  },
  {
    id: "use",
    title: "How we use it, and why we may",
    body: (
      <>
        <ul>
          <li>
            <strong>To provide the Service</strong> you asked for: your account, entering events, partner and substitute
            invitations, waitlists, payments, brackets, scoring and results. <em>Basis: contract.</em>
          </li>
          <li>
            <strong>To send service emails</strong>: entry confirmations, partner invites, waitlist promotions, team-change
            notices, co-organizer invites and payout updates. <em>Basis: contract.</em>
          </li>
          <li>
            <strong>To pay organizers</strong>: crediting wallets, charging platform fees and reviewing withdrawals.{" "}
            <em>Basis: contract and legal obligation.</em>
          </li>
          <li>
            <strong>To keep the Service safe</strong>: preventing fraud and abuse, securing accounts, and keeping
            officiating records that help settle result disputes. <em>Basis: legitimate interests.</em>
          </li>
          <li>
            <strong>To improve the Service</strong>: fixing bugs and understanding which features are used.{" "}
            <em>Basis: legitimate interests.</em>
          </li>
          <li>
            <strong>To meet legal duties</strong>: tax and accounting records, and lawful requests from authorities.{" "}
            <em>Basis: legal obligation.</em>
          </li>
        </ul>
        <p>
          We don&apos;t sell your personal data, and we don&apos;t use it for third-party advertising. If we ever want to
          send you marketing, we&apos;ll ask for your consent first, and you can withdraw it at any time.
        </p>
      </>
    ),
  },
  {
    id: "public",
    title: "What other people can see",
    body: (
      <>
        <p>Tournaments are public by nature. On public event pages, venue TV displays and brackets:</p>
        <ul>
          <li>
            <strong>Shown publicly:</strong> player and team names, profile photos (or initials), the category you entered,
            waitlist position, brackets, match schedules, live scores and results.
          </li>
          <li>
            <strong>Not shown publicly:</strong> your email, phone number, payment status or amounts, and petition proofs.
          </li>
        </ul>
        <p>
          <strong>Organizers and co-organizers of an event you enter</strong> can see what they need to run it: your name,
          email, phone, partner, payment status, check-in and petitions for that event. <strong>Umpires</strong> see team
          names and the matches they score. <strong>Your partner</strong> sees your name and your team&apos;s entry.
        </p>
        <p>
          If you don&apos;t want your photo shown, remove it from your profile; your initials will be shown instead.
        </p>
      </>
    ),
  },
  {
    id: "sharing",
    title: "Who we share it with",
    body: (
      <>
        <p>We share personal data only as needed to run the Service:</p>
        <ul>
          <li>
            <strong>Event organizers</strong>, for the events you enter (see above).
          </li>
          <li>
            <strong>Service providers</strong> that process data for us under contract: Supabase (database, sign-in and file
            storage), PayMongo (payment processing), Resend (sending email), and our website hosting and infrastructure
            providers.
          </li>
          <li>
            <strong>Authorities</strong>, when required by law, court order or to protect the rights and safety of users or
            the public.
          </li>
          <li>
            <strong>A successor</strong>, if RegMyTourna is merged or sold, under this policy or one at least as
            protective, with notice to you.
          </li>
        </ul>
        <p>
          Some of our providers store data on servers outside the Philippines. When that happens we rely on contracts and
          safeguards that keep your data protected to the standard required by the Data Privacy Act.
        </p>
      </>
    ),
  },
  {
    id: "retention",
    title: "How long we keep it",
    body: (
      <ul>
        <li>
          <strong>Account and profile:</strong> while your account is open. After you ask us to delete it, we remove or
          anonymize it within 30 days, except as below.
        </li>
        <li>
          <strong>Payment, wallet and payout records:</strong> as long as tax and accounting laws require (generally up to
          10 years).
        </li>
        <li>
          <strong>Event results and brackets:</strong> kept as the event&apos;s historical record. If you close your
          account, we can replace your name with initials or &ldquo;Former player&rdquo; on request.
        </li>
        <li>
          <strong>Petition proof images:</strong> kept only until the event is over and no longer needed, and removed with
          your account.
        </li>
        <li>
          <strong>Security logs:</strong> kept for a limited period, typically up to 12 months.
        </li>
      </ul>
    ),
  },
  {
    id: "security",
    title: "How we protect it",
    body: (
      <>
        <p>
          We use encrypted connections (HTTPS), access controls so each person sees only what their role allows, encrypted
          storage for sensitive values such as umpire PINs, private storage for petition proofs, and limits on repeated
          sign-in and PIN attempts. Access by our team is restricted to people who need it.
        </p>
        <p>
          No system is perfectly secure. If a personal data breach is likely to put you at risk, we&apos;ll notify you and
          the NPC as the law requires.
        </p>
      </>
    ),
  },
  {
    id: "rights",
    title: "Your rights",
    body: (
      <>
        <p>Under the Data Privacy Act, you have the right to:</p>
        <ul>
          <li>
            <strong>Be informed</strong> about how your data is processed (this policy).
          </li>
          <li>
            <strong>Access</strong> your personal data and get a copy.
          </li>
          <li>
            <strong>Correct</strong> inaccurate data. You can edit most details in your account settings.
          </li>
          <li>
            <strong>Object</strong> to processing, or <strong>withdraw consent</strong> where we rely on it.
          </li>
          <li>
            <strong>Erasure or blocking</strong> of data that is no longer needed or was processed unlawfully.
          </li>
          <li>
            <strong>Data portability</strong>: receive your data in a commonly used electronic format.
          </li>
          <li>
            <strong>Damages</strong> for harm caused by inaccurate, unlawfully obtained or misused data.
          </li>
          <li>
            <strong>File a complaint</strong> with the National Privacy Commission (
            <a href="https://privacy.gov.ph" target="_blank" rel="noreferrer">
              privacy.gov.ph
            </a>
            ).
          </li>
        </ul>
        <p>
          To use any of these rights, email <a href={`mailto:${CONTACT}`}>{CONTACT}</a> from the address on your account.
          We&apos;ll respond within 15 working days. For data an organizer entered or controls, we&apos;ll help you reach
          that organizer.
        </p>
      </>
    ),
  },
  {
    id: "children",
    title: "Minors",
    body: (
      <p>
        Junior players may take part in events, but accounts are meant for people 18 and over. A parent or guardian should
        register a minor and consents to the processing of the minor&apos;s data described here. If you believe we hold a
        minor&apos;s data without that consent, contact us and we&apos;ll remove it.
      </p>
    ),
  },
  {
    id: "cookies",
    title: "Cookies and device storage",
    body: (
      <p>
        We use cookies that are needed for the Service to work: to keep you signed in, to keep an umpire signed in to an
        event, and to protect forms. We also store small amounts of data in your browser, such as offline umpire scores and
        cached umpire pages, and convenience settings. We don&apos;t use advertising cookies. Blocking cookies may stop you
        from signing in.
      </p>
    ),
  },
  {
    id: "changes",
    title: "Changes to this policy",
    body: (
      <p>
        We&apos;ll update this policy as the Service changes. If a change is significant, we&apos;ll tell you by email or in
        the app before it takes effect. The &ldquo;last updated&rdquo; date above shows the current version.
      </p>
    ),
  },
  {
    id: "contact",
    title: "Contact our Data Protection Officer",
    body: (
      <p>
        For privacy questions or requests, email our Data Protection Officer at{" "}
        <a href={`mailto:${CONTACT}`}>{CONTACT}</a> (subject: &ldquo;Privacy&rdquo;), or use our{" "}
        <Link href="/contact">contact page</Link>. See also our <Link href="/terms">Terms of Service</Link>.
      </p>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <LegalDoc
      title="Privacy Policy"
      updated={UPDATED}
      intro={
        <p>
          What personal data we collect when you use RegMyTourna, why we need it, who can see it, and how to use your rights
          under the Philippine Data Privacy Act.
        </p>
      }
      summary={[
        "We collect what's needed to run tournaments: your account, your entries, payments and match results.",
        "Publicly we show names, photos or initials, brackets and scores. Never your email, phone or payment status.",
        "Organizers see the details of players in their own events so they can run them.",
        "Payments are handled by PayMongo; we never see your full card or e-wallet login.",
        "We don't sell your data. You can access, correct or delete it by emailing us.",
      ]}
      sections={sections}
      other={{ href: "/terms", label: "Read the Terms of Service" }}
    />
  );
}
