
export default function TosPage() {
  return (
    <main className="container mx-auto max-w-4xl p-4 sm:p-8 space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Terms of Service</h1>
      <p className="text-sm text-muted-foreground">Last updated: {new Date().toLocaleDateString()}</p>

      <div className="space-y-4 text-muted-foreground">
        <section className="space-y-2">
          <h2 className="text-2xl font-semibold text-foreground">1. Agreement to Terms</h2>
          <p>
            These Terms of Service ("Terms") constitute a legally binding agreement made between you, whether personally or on behalf of an entity ("you") and Hunger Free and Happy ("we," "us," or "our"), concerning your access to and use of the Hunger Free and Happy mobile application (the "App"). You agree that by accessing the App, you have read, understood, and agree to be bound by all of these Terms.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-2xl font-semibold text-foreground">2. CRITICAL - Health and Medical Disclaimer</h2>
          <div className="p-4 border-l-4 border-red-500 bg-red-900/20">
            <p className="font-bold text-red-400">This App Does Not Provide Medical Advice.</p>
            <p className="mt-2">
              The content and services offered by the App are for informational and educational purposes only. The App is not a medical device, and it is not intended to diagnose, treat, cure, or prevent any health problems, nor is it intended to be a substitute for professional medical advice, diagnosis, or treatment.
            </p>
            <p className="mt-2">
              <strong>Always seek the advice of your physician or other qualified health provider with any questions you may have regarding a medical condition.</strong> Never disregard professional medical advice or delay in seeking it because of something you have read or tracked on this App. Your use of this App and its content is solely at your own risk.
            </p>
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="text-2xl font-semibold text-foreground">3. Subscriptions, Payments, and Tiers</h2>
          <p>We offer several tiers of service:</p>
          <ul className="list-disc list-inside space-y-1 pl-4">
            <li><strong>Free Tier:</strong> This tier is supported by displaying advertisements from Google AdMob.</li>
            <li><strong>Ad-Free Tier:</strong> This tier removes all advertising from the App.</li>
            <li><strong>Basic, Premium, Coaching Tiers:</strong> These tiers provide access to additional features and/or coaching services, as described at the point of purchase.</li>
          </ul>
          <h3 className="text-xl font-semibold pt-2 text-foreground">Payment and Auto-Renewal</h3>
          <p>
            Subscriptions are available on a monthly or yearly basis and will automatically renew at the end of the subscription period unless you cancel.
          </p>
          <ul className="list-disc list-inside space-y-1 pl-4">
            <li><strong>In-App Purchases (Android):</strong> Payments made through the Android App are processed by Google Play Billing and are subject to the Google Play Terms of Service. To cancel a subscription, you must do so through your Google Play account settings.</li>
            <li><strong>Website Purchases:</strong> Payments made on our website are processed by Stripe. You are responsible for managing and canceling these subscriptions through our website's account portal.</li>
          </ul>
          <p className="pt-2">All purchases are final and non-refundable except as required by applicable law.</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-2xl font-semibold text-foreground">4. User-Generated Content</h2>
          <p>
            You are solely responsible for the content you generate within the App, including any messages sent in the chat features ("Content"). You agree not to post any Content that is unlawful, harmful, threatening, abusive, harassing, defamatory, vulgar, obscene, or otherwise objectionable.
          </p>
          <p>
            We are not responsible for the Content posted by users. However, we reserve the right, in our sole discretion, to remove any Content that we believe violates these Terms, without notice.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-2xl font-semibold text-foreground">5. Intellectual Property Rights</h2>
          <p>
            Unless otherwise indicated, the App is our proprietary property. All source code, databases, functionality, software, logos, and graphics (collectively, the "Content") are owned or controlled by us and are protected by copyright and trademark laws. You are granted a limited license to access and use the App for your personal, non-commercial use.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-2xl font-semibold text-foreground">6. Account Termination</h2>
          <p>
            We reserve the right to terminate or suspend your account, without prior notice or liability, for any reason whatsoever, including without limitation if you breach the Terms. Upon termination, your right to use the App will immediately cease.
          </p>
        </section>

         <section className="space-y-2">
          <h2 className="text-2xl font-semibold text-foreground">7. Changes to These Terms</h2>
          <p>
            We may modify these Terms at any time. We will notify you of any changes by posting the new Terms on this page and updating the "Last updated" date. You are advised to review these Terms periodically for any changes. Changes to these Terms are effective when they are posted on this page.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-2xl font-semibold text-foreground">8. Governing Law</h2>
          <p>
            These Terms shall be governed and construed in accordance with the laws of the United States, without regard to its conflict of law provisions.
          </p>
        </section>

         <section className="space-y-2">
          <h2 className="text-2xl font-semibold text-foreground">9. Contact Us</h2>
          <p>
            If you have any questions about these Terms, please contact us at:
          </p>
          <p className="font-semibold">support@hungerfreeandhappy.app</p>
        </section>
      </div>
    </main>
  );
}
