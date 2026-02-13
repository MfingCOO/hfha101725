
export default function PrivacyPage() {
  return (
    <main className="container mx-auto max-w-4xl p-4 sm:p-8 space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Privacy Policy</h1>
      <p className="text-sm text-muted-foreground">Last updated: {new Date().toLocaleDateString()}</p>

      <div className="space-y-4">
        <section className="space-y-2">
          <h2 className="text-2xl font-semibold">1. Introduction</h2>
          <p className="text-muted-foreground">
            Your privacy is important to us. This Privacy Policy explains how Hunger Free and Happy ("we," "us," or "our") collects, uses, and discloses information about you when you use our application.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-2xl font-semibold">2. Information We Collect</h2>
          <h3 className="text-xl font-semibold pt-2">Information You Provide</h3>
          <p className="text-muted-foreground">
            We collect information you provide directly to us, such as when you create an account, log your activities, and communicate with us. This includes:
          </p>
          <ul className="list-disc list-inside text-muted-foreground space-y-1">
            <li><strong>Account Information:</strong> Your name, email address, and password.</li>
            <li><strong>Health and Activity Data:</strong> Your logged meals, activities, sleep patterns, measurements, and other related data you choose to provide.</li>
            <li><strong>Payment Information:</strong> We use a third-party payment processor (Stripe) to handle payments. We do not store your full credit card information.</li>
          </ul>
          <h3 className="text-xl font-semibold pt-2">Information We Collect Automatically</h3>
          <p className="text-muted-foreground">
            When you use our application, we automatically collect certain information, including:
          </p>
          <ul className="list-disc list-inside text-muted-foreground space-y-1">
            <li><strong>Push Notification Tokens:</strong> We collect your Firebase Cloud Messaging (FCM) token to send you push notifications for reminders and other app-related events.</li>
            <li><strong>Usage and Log Information:</strong> We log information about your use of the app, including your device type, operating system, IP address, and crash data.</li>
            <li><strong>Advertising Identifiers:</strong> For users on our free tier, we collect your device's advertising identifier to serve personalized ads through Google AdMob.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-2xl font-semibold">3. How We Use Your Information</h2>
          <p className="text-muted-foreground">
            We use the information we collect to:
          </p>
          <ul className="list-disc list-inside text-muted-foreground space-y-1">
            <li>Provide, maintain, and improve our services.</li>
            <li>Personalize your experience and provide insights.</li>
            <li>Process transactions and send you related information.</li>
            <li>Send you push notifications and other communications.</li>
            <li>Display relevant advertising to users on our free tier.</li>
            <li>Monitor and analyze trends, usage, and activities to ensure app stability and improve our services.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-2xl font-semibold">4. How We Share Your Information</h2>
          <p className="text-muted-foreground">
            We do not share your personal information except in the limited circumstances described below:
          </p>
          <ul className="list-disc list-inside text-muted-foreground space-y-1">
             <li>
                <strong>With Third-Party Service Providers:</strong> We share information with vendors and service providers who need access to such information to carry out work on our behalf. These include:
                <ul className="list-['◦'] list-inside pl-4 space-y-1">
                    <li><strong>Google (Firebase and AdMob):</strong> We use Google services for analytics, crash reporting, push notifications, and to serve advertisements.</li>
                    <li><strong>Stripe:</strong> We use Stripe for payment processing.</li>
                </ul>
            </li>
            <li>
                <strong>As Required by Law:</strong> We may disclose your information if required to do so by law or in the good faith belief that such action is necessary to comply with a legal obligation.
            </li>
          </ul>
        </section>
        
        <section className="space-y-2">
          <h2 className="text-2xl font-semibold">5. Data Security</h2>
          <p className="text-muted-foreground">
            We take reasonable measures to help protect information about you from loss, theft, misuse, and unauthorized access, disclosure, alteration, and destruction.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-2xl font-semibold">6. Your Choices</h2>
           <ul className="list-disc list-inside text-muted-foreground space-y-1">
            <li><strong>Account Information:</strong> You may update, correct, or delete information about you at any time by logging into your account or emailing us.</li>
            <li><strong>Push Notifications:</strong> You can disable push notifications at any time through your device's settings menu. Please note that for free-tier users, push notifications are required for app functionality.</li>
            <li><strong>Personalized Advertising:</strong> You can opt-out of personalized advertising by adjusting the settings on your mobile device. For Android, this is typically found under Settings &gt; Google &gt; Ads.</li>
          </ul>
        </section>
      </div>
    </main>
  );
}
