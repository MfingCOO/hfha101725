export const metadata = {
  title: "Privacy Policy | Hunger Free and Happy",
  description: "Privacy Policy for the Hunger Free and Happy app.",
};

export default function PrivacyPage() {
  return (
    <main className="container mx-auto max-w-4xl p-4 sm:p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Last updated: {new Date().toLocaleDateString()}
        </p>
      </div>

      <div className="space-y-8 text-muted-foreground">
        {/* 1. Introduction */}
        <section className="space-y-3">
          <h2 className="text-2xl font-semibold text-foreground">1. Introduction</h2>
          <p>
            Welcome to Hunger Free and Happy. We are committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our mobile application (the "App"). Please read this policy carefully. If you do not agree with the terms of this privacy policy, please do not access the application.
          </p>
        </section>

        {/* 2. Data We Collect */}
        <section className="space-y-3">
          <h2 className="text-2xl font-semibold text-foreground">2. Data We Collect</h2>
          <p>We may collect information about you in a variety of ways. The information we may collect via the App includes:</p>

          <div className="space-y-4">
            <div>
              <h3 className="text-xl font-semibold text-foreground">Personal Data You Provide</h3>
              <p>
                Personally identifiable information, such as your name and email address, that you voluntarily give to us when you register with the App.
              </p>
            </div>

            <div>
              <h3 className="text-xl font-semibold text-foreground">Health &amp; Activity Data (Sensitive Information)</h3>
              <p>
                To provide the core functionality of the App, we collect sensitive health and activity data that you voluntarily enter. This includes, but is not limited to:
              </p>
              <ul className="list-disc list-inside space-y-1 pl-4 mt-2">
                <li>Logged meals and nutritional information</li>
                <li>Water/hydration intake</li>
                <li>Body weight and body measurements</li>
                <li>Sleep duration and quality</li>
                <li>Logged stress levels</li>
                <li>Information about cravings or binge events</li>
                <li>Completed workouts and exercise logs</li>
              </ul>
            </div>

            <div>
              <h3 className="text-xl font-semibold text-foreground">User-Generated Content</h3>
              <p>
                We collect the messages and any media you send in the chat between you and your coach.
              </p>
            </div>

            <div>
              <h3 className="text-xl font-semibold text-foreground">Automatically Collected Data</h3>
              <p>
                When you use our App, we automatically collect certain information about your device and usage:
              </p>
              <ul className="list-disc list-inside space-y-1 pl-4 mt-2">
                <li><strong>Device &amp; Ad Identifiers:</strong> We collect your device's advertising identifier (e.g., Google Advertising ID) to serve ads in the free version of our App.</li>
                <li><strong>Usage Data:</strong> We collect information about your interactions with the App, such as the features you use, the buttons you click, and the duration of your sessions.</li>
                <li><strong>Crash and Performance Data:</strong> We automatically collect crash logs and performance metrics to identify and fix bugs.</li>
              </ul>
            </div>
          </div>
        </section>

        {/* 3. How We Use Your Data */}
        <section className="space-y-3">
          <h2 className="text-2xl font-semibold text-foreground">3. How We Use Your Data</h2>
          <p>Having accurate information permits us to provide you with a smooth, efficient, and customized experience. Specifically, we use information collected about you via the App to:</p>
          <ul className="list-disc list-inside space-y-1 pl-4">
            <li><strong>Provide the Service:</strong> Create and manage your account, and use your health and activity data to power the dashboard, generate insights, and enable coaching features.</li>
            <li><strong>Communication:</strong> Send you important account notifications, reminders, and respond to your support requests.</li>
            <li><strong>Advertising:</strong> For users of the free tier, we use your device's Advertising ID to show personalized or non-personalized ads.</li>
            <li><strong>Analytics &amp; Improvement:</strong> Analyze usage and trends to improve the App's functionality, content, and stability.</li>
            <li><strong>Process Payments:</strong> Process payments and subscriptions.</li>
          </ul>
        </section>

        {/* 4. Data Sharing with Third Parties */}
        <section className="space-y-3">
          <h2 className="text-2xl font-semibold text-foreground">4. Data Sharing with Third Parties</h2>
          <p>We do not sell your personal data. We may share information we have collected about you in certain situations with the following third-party services:</p>
          <ul className="list-disc list-inside space-y-1 pl-4">
            <li>
              <strong>Google:</strong> We share data with Google for several essential services.
              <ul className="list-[circle] list-inside pl-6 mt-2 space-y-1">
                <li><strong>Google AdMob:</strong> To serve advertisements in our app.</li>
                <li><strong>Google Analytics for Firebase:</strong> For app usage analytics and reporting.</li>
                <li><strong>Firebase Authentication, Firestore, Cloud Functions:</strong> To provide core backend infrastructure.</li>
              </ul>
              <p className="pt-2">
                By using our App, you agree to be bound by Google's Privacy Policy:{" "}
                <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  https://policies.google.com/privacy
                </a>
              </p>
            </li>
            <li>
              <strong>RevenueCat:</strong> We utilize RevenueCat to manage and process all subscriptions and payments. RevenueCat acts as an intermediary using Google Play Billing (Android) and Stripe (web). You can review their Privacy Policy here:{" "}
              <a href="https://www.revenuecat.com/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                https://www.revenuecat.com/privacy
              </a>
            </li>
          </ul>
        </section>

        {/* 5. User Consent and Choice for Advertising */}
        <section className="space-y-3">
          <h2 className="text-2xl font-semibold text-foreground">5. User Consent and Choice for Advertising</h2>
          <p>
            For users in the European Economic Area (EEA) and the UK, we obtain your consent for personalized advertising via Google's User Messaging Platform when you first open the App.
          </p>
          <ul className="list-disc list-inside space-y-1 pl-4">
            <li>If you choose <strong>"Consent"</strong>, Google AdMob may show more relevant ads.</li>
            <li>If you choose <strong>"Do Not Consent"</strong>, you will still see ads, but they will be generic.</li>
            <li>You can change your consent choice at any time from within the app's settings.</li>
          </ul>
        </section>

        {/* 6. Data Security and Retention */}
        <section className="space-y-3">
          <h2 className="text-2xl font-semibold text-foreground">6. Data Security and Retention</h2>
          <p>
            We use administrative, technical, and physical security measures to help protect your personal information. No security measures are perfect or impenetrable.
          </p>
          <p>
            We will retain your personal information for as long as you maintain an account with us. If you delete your account, we will take steps to delete your personal information within a reasonable timeframe.
          </p>
        </section>

        {/* 7. Children's Privacy */}
        <section className="space-y-3">
          <h2 className="text-2xl font-semibold text-foreground">7. Children's Privacy</h2>
          <p>
            Our services are not directed to children under the age of 13 (or 16 in Europe). We do not knowingly collect personal information from children.
          </p>
        </section>

        {/* 8. User Rights (GDPR/CCPA) */}
        <section className="space-y-3">
          <h2 className="text-2xl font-semibold text-foreground">8. User Rights (GDPR/CCPA)</h2>
          <p>
            You have the right to access, correct, or delete your personal data. Many of these actions can be performed directly in the app. For other requests, please contact us at the email below.
          </p>
        </section>

        {/* 9. Contact Information */}
        <section className="space-y-3">
          <h2 className="text-2xl font-semibold text-foreground">9. Contact Information</h2>
          <p>If you have any questions or comments about this Privacy Policy, please contact us at:</p>
          <p className="font-semibold">support@hungerfreeandhappy.app</p>
        </section>
      </div>
    </main>
  );
}