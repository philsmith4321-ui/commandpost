export function isStripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}

export async function createStripePaymentLink(amount: number, invoiceNumber: string): Promise<string> {
  if (!isStripeConfigured()) throw new Error('Stripe not configured');
  const stripe = (await import('stripe')).default;
  const client = new stripe(process.env.STRIPE_SECRET_KEY!);

  const session = await client.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [{
      price_data: {
        currency: 'usd',
        product_data: { name: `Invoice ${invoiceNumber}` },
        unit_amount: Math.round(amount * 100),
      },
      quantity: 1,
    }],
    mode: 'payment',
    success_url: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3004'}/finances?payment=success`,
    cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3004'}/finances?payment=cancelled`,
  });

  return session.url!;
}

export async function checkStripePayment(sessionUrl: string): Promise<{ paid: boolean; paymentId?: string }> {
  if (!isStripeConfigured()) throw new Error('Stripe not configured');
  const stripe = (await import('stripe')).default;
  const client = new stripe(process.env.STRIPE_SECRET_KEY!);

  const url = new URL(sessionUrl);
  const sessionId = url.pathname.split('/').pop();
  if (!sessionId) return { paid: false };

  const session = await client.checkout.sessions.retrieve(sessionId);
  return {
    paid: session.payment_status === 'paid',
    paymentId: session.payment_intent as string | undefined,
  };
}
