import React from 'react';
import ToolHeader from '../components/ToolHeader';
import { ShieldCheck } from 'lucide-react';
import usePageTitle from '../hooks/usePageTitle';

const Privacy = () => {
  usePageTitle('Privacy Policy');
  return (
    <div className="container animate-fade-in" style={{ paddingTop: '2rem', maxWidth: '800px' }}>
      <ToolHeader 
        title="Privacy Policy" 
        description="Last updated: October 2023"
        icon={ShieldCheck}
        color="var(--success)"
      />

      <div className="glass-card p-8" style={{ padding: '2rem' }}>
        <div className="prose">
          <h2 className="text-xl mb-4 text-primary">1. Information We Collect</h2>
          <p className="mb-6">
            DevTools is a client-side execution environment. We do not store, log, or transmit your code snippets, generated QR codes, or barcodes to our servers. All operations happen directly in your browser.
          </p>

          <h2 className="text-xl mb-4 text-primary">2. Bot Protection & Cloudflare</h2>
          <p className="mb-6">
            To prevent abuse and distributed denial-of-service (DDoS) attacks, we utilize Cloudflare and Cloudflare Turnstile. Cloudflare may process basic telemetry data (such as IP addresses and request headers) strictly for security purposes and bot mitigation. This data is not used for profiling or marketing.
          </p>

          <h2 className="text-xl mb-4 text-primary">3. Analytics and Tracking</h2>
          <p className="mb-6">
            We use minimal, privacy-first analytics to understand generic page views. No personally identifiable information (PII) is captured. No third-party marketing trackers are present on DEVTools.
          </p>

          <h2 className="text-xl mb-4 text-primary">4. Open Source Transparency</h2>
          <p className="mb-6">
            Because our application is open source and freely verifiable, you can audit the source code directly on GitHub to verify our data handling practices. If you have concerns, feel free to submit an issue or run the application entirely locally!
          </p>
        </div>
      </div>
    </div>
  );
};

export default Privacy;
