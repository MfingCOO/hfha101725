'use server';

import { Stripe } from 'stripe';
import { redirect } from 'next/navigation';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-04-10',
});

/**
 * Creates a Stripe Checkout Session and redirects the user to the payment page.
 * @param priceId The ID of the Stripe Price object.
 * @param email The user's email address.
 * @param fullName The user's full name.
 */
export async function createCheckoutSession(data: { priceId: string; email: string; fullName: string; }) {
  const { priceId, email, fullName } = data;

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      customer_email: email, // Pre-fills the email on the checkout page
      metadata: {
          // You can add any other custom data here
          userName: fullName,
      },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/`,
    });

    if (session.url) {
      redirect(session.url);
    } else {
      // This case should ideally not happen if the session is created successfully
      return {
        success: false,
        error: 'Could not create a checkout session. Please try again.',
      };
    }
  } catch (error) {
    console.error("Error creating Stripe checkout session:", error);
    return {
      success: false,
      error: 'An unexpected error occurred. Please contact support if the problem persists.',
    };
  }
}
