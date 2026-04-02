import React from 'react';
import ToolHeader from '../components/ToolHeader';
import { FileText } from 'lucide-react';
import usePageTitle from '../hooks/usePageTitle';

const Terms = () => {
  usePageTitle('Terms of Service');
  return (
    <div className="container animate-fade-in" style={{ paddingTop: '2rem', maxWidth: '800px' }}>
      <ToolHeader 
        title="Terms of Service" 
        description="The rules and guidelines for using DevTools."
        icon={FileText}
        color="var(--info)"
      />

      <div className="glass-card p-8" style={{ padding: '2rem' }}>
        <div className="prose">
          <h2 className="text-xl mb-4 text-primary">1. Acceptance of Terms</h2>
          <p className="mb-6">
            By accessing and using DevTools, you accept and agree to be bound by the terms and provision of this agreement.
          </p>

          <h2 className="text-xl mb-4 text-primary">2. Description of Service</h2>
          <p className="mb-6">
            DevTools provides open-source, client-side web tools including code formatters, minifiers, compilers, and code generators. We provide these services freely without warranties.
          </p>

          <h2 className="text-xl mb-4 text-primary">3. User Conduct</h2>
          <p className="mb-6">
            You agree not to use the service for any illegal purposes or to conduct activities that compromise the integrity or security of the applications underlying platform (e.g., executing malicious scripts intended to bypass Cloudflare protection).
          </p>

          <h2 className="text-xl mb-4 text-primary">4. Cloudflare BOT Protection</h2>
          <p className="mb-6">
            Access to our services may be monitored and gated by Cloudflare Turnstile to prevent automated abuse. By using this service, you consent to Cloudflare's standard security checks.
          </p>

          <h2 className="text-xl mb-4 text-primary">5. Disclaimer of Warranties</h2>
          <p className="mb-6">
            DevTools is provided "as is" without warranty of any kind, whether express or implied. The developers shall not be liable for any damages arising out of your use of these tools. Use the generated codes and reviewed logic at your independent discretion.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Terms;
