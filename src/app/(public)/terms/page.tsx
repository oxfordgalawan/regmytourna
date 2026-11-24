import Link from "next/link";
import { LegalDoc, type LegalSection } from "@/components/legal/legal-doc";

export const metadata = {
  title: "Terms of Service",
  description: "The rules for using RegMyTourna as a player, organizer, co-organizer or umpire.",
};

const CONTACT = "hello@regmytourna.com";
const UPDATED = "November 13, 2026";

const sections: LegalSection[] = [
  {
    id: "about",
    title: "About these terms",
    body: (
      <>
        <p>
          RegMyTourna (&ldquo;RegMyTourna&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;) is an online platform for running
          sports tournaments in the Philippines, starting with pickleball. Organizers use it to publish events, take
          entries and payments, build brackets and score matches. Players use it to find events, register with a partner
          and follow live results.
        </p>
        <p>
          These Terms of Service (&ldquo;Terms&rdquo;) are an agreement between you and RegMyTourna. By creating an
          account, registering for an event, publishing an event, or otherwise using the website or apps
          (the &ldquo;Service&rdquo;), you agree to these Terms and to our <Link href="/privacy">Privacy Policy</Link>. If
          you don&apos;t agree, please don&apos;t use the Service.
        </p>
        <p>
          <strong>RegMyTourna is a platform, not the organizer of events listed on it.</strong> Each tournament is run by
          its organizer, who sets its rules, categories, fees, schedule and refund policy and is responsible for the event
          itself.
        </p>
      </>
    ),
  },
  {
    id: "accounts",
    title: "Your account",
    body: (
      <>
        <ul>
          <li>You must give accurate information, including your real name, and keep it up to date.</li>
          <li>
            You must be at least 18 to create an account on your own. Players under 18 may take part only with the consent
            and supervision of a parent or guardian, who accepts these Terms on their behalf.
          </li>
          <li>
            Keep your password private. You&apos;re responsible for what happens under your account; tell us right away
            at <a href={`mailto:${CONTACT}`}>{CONTACT}</a> if you think someone else has used it.
          </li>
          <li>One person, one account. Don&apos;t create accounts for other people without their permission.</li>
          <li>
            An account can act as a player, an organizer, or both. Organizer features may require extra details, such as
            payout information, before you can receive money.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "players",
    title: "Registering for events",
    body: (
      <>
        <p>When you register for a tournament:</p>
        <ul>
          <li>
            You&apos;re entering an event run by its organizer. Eligibility, skill-level placement, categories, schedules and
            on-site rules are decided by the organizer.
          </li>
          <li>
            If you register as a team, you confirm your partner has agreed to play with you and to their details being
            shared with the organizer. Your partner may be asked to accept an invitation and create an account.
          </li>
          <li>
            Your entry is confirmed only when the event shows it as confirmed (for example, after payment, or after the
            organizer accepts a pay-at-venue entry).
          </li>
          <li>
            <strong>Waitlists:</strong> if a category is full you may join its waitlist without paying. If a slot opens,
            you&apos;ll be notified and asked to pay online or at the venue. A waitlist place is not a guaranteed entry.
          </li>
          <li>
            <strong>Team changes:</strong> where the organizer allows it, you may cancel, replace your partner, or send a
            substitute invitation (which the substitute must accept) until the draw starts. After the draw starts, changes
            go through the organizer.
          </li>
          <li>
            <strong>Petitions:</strong> requests to play in a different category, and any proof you upload, are reviewed by
            the organizer, whose decision is final.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "payments",
    title: "Payments, fees and refunds",
    body: (
      <>
        <h3>Paying entry fees</h3>
        <p>
          Online payments are processed by our payment partner, PayMongo, on its secure checkout. RegMyTourna does not see
          or store your full card or e-wallet credentials. Prices are in Philippine pesos (PHP) and include any amount
          shown at checkout. Some events also let you pay at the venue; that payment is made directly to the organizer.
        </p>
        <h3>Refunds</h3>
        <p>
          <strong>Entry fees paid through RegMyTourna are non-refundable through the platform</strong>, as shown before
          you pay. Any refund, credit or transfer for a cancelled entry, a postponed event or a no-show is at the
          organizer&apos;s discretion and is arranged between you and the organizer. If an organizer cancels an event,
          they&apos;re responsible for informing players and handling refunds. We&apos;ll reasonably help connect you with
          the organizer and may, at our discretion, assist where funds are still held in the organizer&apos;s wallet.
        </p>
        <h3>Failed or duplicate payments</h3>
        <p>
          If you were charged but your entry didn&apos;t confirm, or you were charged twice, contact us at{" "}
          <a href={`mailto:${CONTACT}`}>{CONTACT}</a> with your payment reference and we&apos;ll investigate with our
          payment partner.
        </p>
      </>
    ),
  },
  {
    id: "organizers",
    title: "Organizers and co-organizers",
    body: (
      <>
        <p>If you publish an event, you agree that:</p>
        <ul>
          <li>
            You&apos;re responsible for the event: its accuracy (dates, venue, categories, fees), safety, permits, venue
            arrangements, prizes, conduct of play and any communication with players.
          </li>
          <li>
            You&apos;ll publish clear rules, including your refund and cancellation policy, and honor what you publish.
          </li>
          <li>
            You have the right to share any player information you enter or import (for example, names in a bracket-only
            event or walk-in entries), and you&apos;ll use player data only to run your event, in line with the{" "}
            <Link href="/privacy">Privacy Policy</Link> and the Data Privacy Act of 2012.
          </li>
          <li>
            You may invite co-organizers to help run an event. Co-organizers act on your behalf and you remain responsible
            for what they do. Co-organizers can run the event but cannot access the wallet or payouts.
          </li>
          <li>
            You&apos;re responsible for the umpires you add and for keeping umpire PINs private. Scores entered by your
            umpires are treated as official results of your event.
          </li>
          <li>You&apos;re responsible for any taxes, permits and official receipts that apply to your event income.</li>
        </ul>
        <p>
          We may review, hide or remove events that are misleading, unsafe, fraudulent or that break these Terms, and we
          may hold payouts while we investigate.
        </p>
      </>
    ),
  },
  {
    id: "wallet",
    title: "Organizer wallet and payouts",
    body: (
      <>
        <ul>
          <li>
            Entry fees paid online for your event are credited to your organizer wallet, less the RegMyTourna platform fee
            and any payment processing charges. The current fee is shown in your organizer dashboard before you publish,
            and we&apos;ll give notice before it changes.
          </li>
          <li>
            For entries you collect yourself (cash or other payments at the desk) and record in the Service, a platform fee
            may be charged to your wallet.
          </li>
          <li>
            You can request a withdrawal to a payout method you&apos;ve added (such as GCash, Maya or a bank account). Each
            request is reviewed before it is paid, and transfers can take a few business days.
          </li>
          <li>
            Make sure your payout details are correct. We&apos;re not responsible for transfers sent to details you
            provided. We may ask you to verify your identity or account ownership before releasing funds.
          </li>
          <li>
            We may hold, reverse or offset wallet amounts in case of chargebacks, refunds, suspected fraud, errors or a
            breach of these Terms.
          </li>
          <li>
            The wallet is a record of amounts owed to you for your events. It is not a bank account or e-money account and
            does not earn interest.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "results",
    title: "Brackets, scoring and results",
    body: (
      <>
        <ul>
          <li>
            Brackets, schedules, court queues, live scores and results are created by organizers and their umpires.
            They&apos;re shown on public event pages and venue displays.
          </li>
          <li>
            Umpires may score on their phone even without signal; scores sync once the phone is back online. Until then, the
            public scoreboard may lag behind what&apos;s happening on court.
          </li>
          <li>
            The free <strong>Umpire tool</strong> (no account) lets anyone score a casual match and share a browser link for a
            TV. Those sessions expire automatically after about seven days. Anyone with the link can view the live score.
          </li>
          <li>
            The Service keeps an officiating record for each match (such as timers run, coin toss, first server and each
            point) to help resolve disputes. Disputes about results are decided by the organizer.
          </li>
          <li>
            We aim for accuracy but don&apos;t guarantee that schedules, scores or results shown in the Service are complete
            or error-free.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "conduct",
    title: "Acceptable use",
    body: (
      <>
        <p>You agree not to:</p>
        <ul>
          <li>Impersonate anyone, register someone without their consent, or give false information.</li>
          <li>Publish fake or misleading events, or collect entry fees for an event you don&apos;t intend to hold.</li>
          <li>Harass, threaten or discriminate against other users, players, umpires or organizers.</li>
          <li>Upload content that is unlawful, obscene, defamatory or that infringes someone else&apos;s rights.</li>
          <li>
            Interfere with the Service: probe or break its security, guess PINs or passwords, scrape it at scale, or
            overload it.
          </li>
          <li>Use the Service for money laundering, fraud or any other unlawful purpose.</li>
        </ul>
      </>
    ),
  },
  {
    id: "content",
    title: "Your content",
    body: (
      <>
        <p>
          You keep ownership of what you add to the Service, such as event details, cover images, profile photos and
          petition proofs. You give RegMyTourna a non-exclusive, royalty-free licence to host, display and share that
          content as needed to run the Service, including showing events, rosters, brackets and results publicly. This
          licence ends when the content is deleted, except for copies kept for legitimate records (for example, completed
          event results) or backups.
        </p>
        <p>
          The RegMyTourna name, logo, design and software belong to us. You may not copy or reuse them without permission.
        </p>
      </>
    ),
  },
  {
    id: "suspension",
    title: "Suspension and closing your account",
    body: (
      <>
        <p>
          You may stop using the Service at any time and ask us to close your account at{" "}
          <a href={`mailto:${CONTACT}`}>{CONTACT}</a>. Organizers should settle their events and wallet balance first.
        </p>
        <p>
          We may suspend or close an account, or remove content, if it breaks these Terms, puts other users at risk, or is
          required by law. Where reasonable, we&apos;ll tell you why and give you a chance to respond.
        </p>
      </>
    ),
  },
  {
    id: "disclaimers",
    title: "Disclaimers and limits of liability",
    body: (
      <>
        <p>
          <strong>Sport involves risk.</strong> You take part in events at your own risk and should follow the
          organizer&apos;s and venue&apos;s safety rules. RegMyTourna does not run events and is not responsible for
          injuries, losses, property damage, or the conduct of organizers, players or venues.
        </p>
        <p>
          The Service is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo;. We work to keep it reliable and secure,
          but we don&apos;t promise it will always be available, uninterrupted or error-free.
        </p>
        <p>
          To the extent the law allows, RegMyTourna is not liable for indirect, incidental or consequential losses, and our
          total liability for any claim related to the Service is limited to the platform fees we received in connection
          with that claim in the 12 months before it arose. Nothing in these Terms limits liability that cannot be limited
          under Philippine law, including your rights as a consumer.
        </p>
        <p>
          You agree to cover RegMyTourna&apos;s reasonable losses arising from your breach of these Terms or, if
          you&apos;re an organizer, from the events you run.
        </p>
      </>
    ),
  },
  {
    id: "changes",
    title: "Changes to the Service and these Terms",
    body: (
      <p>
        We may update the Service and these Terms from time to time. If a change is significant, we&apos;ll tell you by email
        or in the app before it takes effect. The &ldquo;last updated&rdquo; date above shows the current version.
        Continuing to use the Service after a change means you accept the updated Terms.
      </p>
    ),
  },
  {
    id: "law",
    title: "Governing law and disputes",
    body: (
      <p>
        These Terms are governed by the laws of the Republic of the Philippines. If you have a concern, please contact us
        first. Most issues can be solved quickly. If a dispute can&apos;t be settled informally, it will be brought before
        the proper courts of the Philippines, without affecting any right you have to go to a government agency, such as
        the Department of Trade and Industry or the National Privacy Commission.
      </p>
    ),
  },
  {
    id: "contact",
    title: "Contact us",
    body: (
      <p>
        Questions about these Terms? Email <a href={`mailto:${CONTACT}`}>{CONTACT}</a> or use our{" "}
        <Link href="/contact">contact page</Link>.
      </p>
    ),
  },
];

export default function TermsPage() {
  return (
    <LegalDoc
      title="Terms of Service"
      updated={UPDATED}
      intro={
        <p>
          The rules for using RegMyTourna, whether you&apos;re joining a tournament, running one, helping as a
          co-organizer or scoring as an umpire.
        </p>
      }
      summary={[
        "RegMyTourna is the platform; each tournament is run by its organizer, who sets the rules, fees and refund policy.",
        "Entry fees paid through RegMyTourna are non-refundable through the platform. Refunds are up to the organizer.",
        "Waitlisted players don't pay until a slot opens.",
        "Organizers are responsible for their events, umpires and co-organizers, and receive online payments in their wallet, less the platform fee.",
        "Be honest, be respectful, and don't misuse the Service.",
      ]}
      sections={sections}
      other={{ href: "/privacy", label: "Read the Privacy Policy" }}
    />
  );
}
