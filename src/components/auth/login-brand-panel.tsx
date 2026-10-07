import { Box, FileText, UsersRound } from "lucide-react";
import { BrandLogo } from "./brand-logo";
import styles from "./auth-form.module.css";

const features = [
  {
    icon: Box,
    title: "Manage Inventory",
    description: "Real-time stock tracking",
  },
  {
    icon: FileText,
    title: "Streamline Orders",
    description: "Faster and more accurate processing",
  },
  {
    icon: UsersRound,
    title: "Work Together",
    description: "Keep your team in sync",
  },
];

export function LoginBrandPanel() {
  return (
    <aside className={styles.brandPanel} aria-label="B1G Fuel workspace">
      <svg
        className={styles.brandArtwork}
        viewBox="0 0 900 900"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="login-navy" x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="#02066F" />
            <stop offset="1" stopColor="#071992" />
          </linearGradient>
          <linearGradient id="login-blue" x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="#1025B1" />
            <stop offset="1" stopColor="#1754D1" />
          </linearGradient>
        </defs>
        <path fill="#DCE7FF" d="M0 0H873C812 326 1000 590 686 900H0Z" />
        <path
          fill="url(#login-blue)"
          d="M0 0H895C895 301 737 497 832 671 854 760 721 858 573 900H0Z"
        />
        <path
          fill="url(#login-navy)"
          d="M0 0H895C898 375 631 674 349 870 194 821 76 761 0 695Z"
        />
        <path
          fill="#122CAB"
          opacity=".3"
          d="M620 0H742L846 249 795 371C705 229 652 122 620 0Z"
        />
        <path
          fill="#1033BF"
          opacity=".45"
          d="M313 900 541 649C630 590 778 657 740 789L573 900Z"
        />
      </svg>
      <div className={styles.brandContent}>
        <BrandLogo inverted />
        <h2 className={styles.brandHeading}>
          Fueling
          <br />
          Your Business
          <br />
          <span>Forward</span>
        </h2>
        <p className={styles.brandDescription}>
          A smarter and more connected workspace for inventory, orders, and team
          management.
        </p>
        <ul className={styles.features}>
          {features.map(({ icon: Icon, title, description }) => (
            <li key={title} className={styles.feature}>
              <span className={styles.featureIcon}>
                <Icon className="size-7" strokeWidth={1.6} aria-hidden="true" />
              </span>
              <div>
                <h3>{title}</h3>
                <p>{description}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
