import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="page">
      <nav className="nav reveal">
        <div className="logo">
          <img className="logo-badge" src="/fundory-logo.svg" alt="Fundory logo" />
          Fundory
        </div>
        <div className="nav-links">
          <a href="#how">How it works</a>
          <a href="#features">Vault features</a>
          <a href="#security">Security</a>
          <a href="#pricing">Pricing</a>
        </div>
        <Link className="nav-cta" href="/app">
          Launch app
        </Link>
      </nav>

      <section className="hero">
        <div className="hero-copy reveal delay-1">
          <span className="eyebrow">Goal-based savings vaults</span>
          <h1>Save for real life, earn quietly, deposit on-chain.</h1>
          <p>
            Fundory turns stablecoins into purposeful savings goals. Set a target, deposit in seconds,
            and watch your progress grow with transparent yield and a clean on-chain flow that feels like a modern bank.
          </p>
          <div className="hero-actions">
            <Link className="btn btn-primary" href="/app">
              Start a goal
            </Link>
            <a className="btn btn-secondary" href="#how">
              See the flow
            </a>
          </div>
        </div>
        <div className="hero-card reveal delay-2">
          <h3>Wedding Fund</h3>
          <div className="progress">
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 600 }}>
              <span>$3,420 saved</span>
              <span>$5,000 target</span>
            </div>
            <div className="progress-bar">
              <span />
            </div>
            <small style={{ color: "var(--muted)" }}>
              68% complete - Next auto-save in 4 days
            </small>
          </div>
          <div className="hero-grid">
            <div className="pill">6.2% est. APY</div>
            <div className="pill">Gasless deposits</div>
            <div className="pill">Goal lock: 90 days</div>
          </div>
        </div>
      </section>

      <section id="features" className="section reveal delay-1">
        <h2>Built for everyday habits, not crypto hype.</h2>
        <p>
          Set a real-world goal, deposit weekly or monthly, and track progress with a calm, clean interface.
          Your funds stay in a vault with transparent yield logic and fast withdrawals when you need them.
        </p>
        <div className="feature-grid">
          <div className="feature-card">
            <h4>Goal-first design</h4>
            <p>Each goal has a dedicated vault, progress bar, and timeline so saving feels tangible.</p>
          </div>
          <div className="feature-card">
            <h4>On-chain deposits</h4>
            <p>Approve once, then deposit directly from your wallet with clear confirmations.</p>
          </div>
          <div className="feature-card">
            <h4>Yield with guardrails</h4>
            <p>Start with mock APR strategies now, upgrade to real lending protocols later.</p>
          </div>
        </div>
      </section>

      <section id="how" className="section reveal delay-2">
        <h2>How it works</h2>
        <div className="steps">
          <div className="step">
            <strong>1. Create a goal</strong>
            Pick a name, target amount, and optional lock date.
          </div>
          <div className="step">
            <strong>2. Approve once</strong>
            One standard approval lets the vault pull stablecoins for future deposits.
          </div>
          <div className="step">
            <strong>3. Deposit on-chain</strong>
            Confirm in your wallet and your vault updates immediately.
          </div>
        </div>
      </section>

      <section id="security" className="section reveal delay-3">
        <h2>Vault safety and transparency</h2>
        <p>Every deposit is tracked on-chain with clear balances and transparent yield math.</p>
        <div className="highlight-grid">
          <div className="highlight-card">
            <h4>Non-custodial core</h4>
            <p>You own the vault. Withdraw anytime with clear share math and on-chain proof.</p>
          </div>
          <div className="highlight-card">
            <h4>Transparent vault operations</h4>
            <p>Deposits, approvals, and strategy accruals are visible on-chain.</p>
          </div>
          <div className="highlight-card">
            <h4>Yield in full view</h4>
            <p>APR strategies are published on-chain and easy to audit.</p>
          </div>
        </div>
      </section>

      <section id="pricing" className="section reveal delay-4">
        <h2>Simple economics</h2>
        <p>Users never pay for deposits. Revenue comes from a small, transparent yield spread.</p>
        <div className="stats">
          <div className="stat">
            <h3>0%</h3>
            <p>Deposit fees</p>
          </div>
          <div className="stat">
            <h3>1%</h3>
            <p>Target yield spread</p>
          </div>
          <div className="stat">
            <h3>On-chain</h3>
            <p>Direct wallet approvals</p>
          </div>
          <div className="stat">
            <h3>Weekly</h3>
            <p>Auto-save cadence</p>
          </div>
        </div>
      </section>

      <section className="cta reveal">
        <div>
          <h2>Ready to launch a goal?</h2>
        <p>Spin up a vault, deposit on-chain, and demo a RealFi savings product in minutes.</p>
        </div>
        <div className="hero-actions">
          <Link className="btn btn-primary" href="/app">
            Open the app
          </Link>
          <a className="btn btn-secondary" href="#features">
            Explore vaults
          </a>
        </div>
      </section>

      <footer className="footer">
        <span>Fundory - Built for RealFi</span>
        <span>Docs - Security - Support</span>
      </footer>
    </div>
  );
}
