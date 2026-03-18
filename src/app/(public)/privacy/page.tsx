
export default function PrivacyPage() {
  return (
    <main className="container mx-auto max-w-4xl p-4 sm:p-8 space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Privacy Policy</h1>
      <p className="text-sm text-muted-foreground">Last updated: {new Date().toLocaleDateString()}</p>

      <div className="space-y-4 text-muted-foreground">
        <section className="space-y-2">
          <h2 className="text-2xl font-semibold text-foreground">1. Introduction</h2>
          <p>
            Welcome to Hunger Free and Happy. We are committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our mobile application (the "App"). Please read this policy carefully. If you do not agree with the terms of this privacy policy, please do not access the application.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-2xl font-semibold text-foreground">2. Data We Collect</h2>
          <p>We may collect information about you in a variety of ways. The information we may collect via the App includes:</p>
          <h3 className="text-xl font-semibold pt-2 text-foreground">Personal Data You Provide</h3>
          <p>
            Personally identifiable information, such as your name and email address, that you voluntarily give to us when you register with the App.
          </p>
          <h3 className="text-xl font-semibold pt-2 text-foreground">Health & Activity Data (Sensitive Information)</h3>
          <p>
            To provide the core functionality of the App, we collect sensitive health and activity data that you voluntarily enter. This includes, but is not limited to:
          </p>
          <ul className="list-disc list-inside space-y-1 pl-4">
            <li>Logged meals and nutritional information</li>
            <li>Water/hydration intake</li>
            <li>Body weight and body measurements</li>
            <li>Sleep duration and quality</li>
            <li>Logged stress levels</li>
            <li>Information about cravings or binge events</li>
            <li>Completed workouts and exercise logs</li>
          </ul>
          <h3 className="text-xl font-semibold pt-2 text-foreground">User-Generated Content</h3>
          <p>
            We collect the messages and any media you send in the chat between you and your coach.
          </p>
          <h3 className="text-xl font-semibold pt-2 text-foreground">Automatically Collected Data</h3>
          <p>
            When you use our App, we automatically collect certain information about your device and usage:
          </p>
          <ul className="list-disc list-inside space-y-1 pl-4">
            <li><strong>Device & Ad Identifiers:</strong> We collect your device's advertising identifier (e.g., Google Advertising ID) to serve ads in the free version of our App.</li>
            <li><strong>Usage Data:</strong> We collect information about your interactions with the App, such as the features you use, the buttons you click, and the duration of your sessions, to help us improve the user experience.</li>
            <li><strong>Crash and Performance Data:</strong> We automatically collect crash logs and performance metrics to identify and fix bugs.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-2xl font-semibold text-foreground">3. How We Use Your Data</h2>
          <p>Having accurate information permits us to provide you with a smooth, efficient, and customized experience. Specifically, we use information collected about you via the App to:</p>
          <ul className="list-disc list-inside space-y-1 pl-4">
            <li><strong>Provide the Service:</strong> Create and manage your account, and use your health and activity data to power the dashboard, generate insights, and enable coaching features.</li>
            <li><strong>Communication:</strong> Send you important account notifications, reminders, and respond to your support requests.</li>
            <li><strong>Advertising:</strong> For users of the free tier, we use your device's Advertising ID to show personalized or non-personalized ads, as described in the User Consent section below.</li>
            <li><strong>Analytics & Improvement:</strong> Analyze usage and trends to improve the App's functionality, content, and stability. This data is aggregated and anonymized wherever possible and is used to understand which features are most popular and to guide our development efforts.</li>
            <li><strong>Process Payments:</strong> Process payments and subscriptions.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-2xl font-semibold text-foreground">4. Data Sharing with Third Parties</h2>
          <p>We do not sell your personal data. We may share information we have collected about you in certain situations with the following third-party services:</p>
          <ul className="list-disc list-inside space-y-1 pl-4">
            <li>
              <strong>Google:</strong> We share data with Google for several essential services.
              <ul className="list-['◦'] list-inside pl-6 space-y-1">
                <li><strong>Google AdMob:</strong> To serve advertisements in our app.</li>
                <li><strong>Google Analytics for Firebase:</strong> For app usage analytics and reporting.</li>
                <li><strong>Firebase Authentication, Firestore, Cloud Functions:</strong> To provide core backend infrastructure, including database, authentication, and serverless functions.</li>
              </ul>
              <p className="pt-2">By using our App, you agree to be bound by Google's Privacy Policy, which can be found here: <a href="https://policies.google.com/privacy" className="text-blue-500 hover:underline">https://policies.google.com/privacy</a></p>
            </li>
            <li>
              <strong>RevenueCat:</strong> We utilize RevenueCat to manage and process all subscriptions and payments, both in-app and on our website. RevenueCat acts as an intermediary, using Google Play Billing for Android in-app purchases and Stripe for web-based purchases. We do not directly store your full payment card details on our servers. You can review RevenueCat's Privacy Policy here: <a href="https://www.revenuecat.com/privacy" className="text-blue-500 hover:underline">https://www.revenuecat.com/privacy</a>
            </li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-2xl font-semibold text-foreground">5. User Consent and Choice for Advertising</h2>
          <p>
            For users in the European Economic Area (EEA) and the UK, we are required to obtain your consent for personalized advertising. When you first use the App, we will show you a consent dialog managed by Google's User Messaging Platform.
          </p>
          <ul className="list-disc list-inside space-y-1 pl-4">
            <li>If you choose <strong>"Consent,"</strong> Google AdMob will use your data to show you ads that are more relevant to your interests.</li>
            <li>If you choose <strong>"Do Not Consent,"</strong> you will still see ads, but they will be generic and not based on your personal data.</li>
            <li>You can change your consent choice at any time from within the app's settings menu.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-2xl font-semibold text-foreground">6. Data Security and Retention</h2>
          <p>
            We use administrative, technical, and physical security measures to help protect your personal information. While we have taken reasonable steps to secure the personal information you provide to us, please be aware that despite our efforts, no security measures are perfect or impenetrable.
          </p>
          <p>
            We will retain your personal information for as long as you maintain an account with us. If you delete your account, we will take steps to delete your personal information within a reasonable timeframe.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-2xl font-semibold text-foreground">7. Children's Privacy</h2>
          <p>
            Our services are not directed to children under the age of 13 (or 16 in Europe), and we do not knowingly collect personal information from children. If we become aware that we have collected personal information from a child without verification of parental consent, we will take steps to remove that information from our servers.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-2xl font-semibold text-foreground">8. User Rights (GDPR/CCPA)</h2>
          <p>
            You have certain rights regarding your personal data. You have the right to access, correct, or delete your personal data. You can perform many of these actions directly through the app.
          </p>
          <p>
            For any requests to exercise your data protection rights that you cannot perform yourself, please contact us at the email address below. We will respond to your request in a reasonable timeframe.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-2xl font-semibold text-foreground">9. Contact Information</h2>
          <p>
            If you have questions or comments about this Privacy Policy, please contact us at:
          </p>
          <p className="font-semibold">support@hungerfreeandhappy.app</p>
        </section>
      </div>
    </main>
  );
}
