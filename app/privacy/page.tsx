export const metadata = {
  title: 'Privacy Policy - 찬양팀 악보',
  description: 'Privacy Policy for 찬양팀 악보 (Worship Song Finder)',
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-background p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Privacy Policy</h1>
      <p className="text-muted-foreground mb-4">Last updated: January 12, 2026</p>

      <section className="mb-6">
        <h2 className="text-xl font-semibold mb-3">Overview</h2>
        <p className="text-muted-foreground">
          찬양팀 악보 (Worship Song Finder) is committed to protecting your privacy.
          This Privacy Policy explains how we collect, use, and safeguard your information
          when you use our mobile application.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="text-xl font-semibold mb-3">Information We Collect</h2>
        <ul className="list-disc list-inside text-muted-foreground space-y-2">
          <li><strong>Search Queries:</strong> We collect search terms to improve our search functionality and provide better results.</li>
          <li><strong>Usage Analytics:</strong> We collect anonymous usage data to improve the app experience.</li>
          <li><strong>Device Information:</strong> Basic device information for app optimization.</li>
        </ul>
      </section>

      <section className="mb-6">
        <h2 className="text-xl font-semibold mb-3">How We Use Your Information</h2>
        <ul className="list-disc list-inside text-muted-foreground space-y-2">
          <li>To provide and improve our chord sheet search service</li>
          <li>To analyze usage patterns and improve user experience</li>
          <li>To fix bugs and technical issues</li>
        </ul>
      </section>

      <section className="mb-6">
        <h2 className="text-xl font-semibold mb-3">Data Storage</h2>
        <p className="text-muted-foreground">
          Your data is stored securely using industry-standard encryption.
          Search history may be cached locally on your device for offline access.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="text-xl font-semibold mb-3">Third-Party Services</h2>
        <p className="text-muted-foreground">
          We use the following third-party services:
        </p>
        <ul className="list-disc list-inside text-muted-foreground space-y-2 mt-2">
          <li>Vercel Analytics - for anonymous usage analytics</li>
          <li>Sentry - for error tracking and app stability</li>
          <li>Supabase - for data storage</li>
        </ul>
      </section>

      <section className="mb-6">
        <h2 className="text-xl font-semibold mb-3">Your Rights</h2>
        <p className="text-muted-foreground">
          You have the right to:
        </p>
        <ul className="list-disc list-inside text-muted-foreground space-y-2 mt-2">
          <li>Access your personal data</li>
          <li>Request deletion of your data</li>
          <li>Opt out of analytics collection</li>
        </ul>
      </section>

      <section className="mb-6">
        <h2 className="text-xl font-semibold mb-3">Contact Us</h2>
        <p className="text-muted-foreground">
          If you have any questions about this Privacy Policy, please contact us at:
          <br />
          <a href="mailto:support@findmyworship.com" className="text-orange-500 hover:underline">
            support@findmyworship.com
          </a>
        </p>
      </section>

      <section className="mb-6">
        <h2 className="text-xl font-semibold mb-3">Changes to This Policy</h2>
        <p className="text-muted-foreground">
          We may update this Privacy Policy from time to time. We will notify you of any
          changes by posting the new Privacy Policy on this page and updating the
          &ldquo;Last updated&rdquo; date.
        </p>
      </section>
    </div>
  );
}
