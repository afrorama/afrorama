/**
 * Afrorama — stripe-webhook Edge Function
 *
 * Listens for Stripe events and updates the Supabase database accordingly.
 *
 * Deploy:
 *   supabase functions deploy stripe-webhook
 *
 * Required secrets:
 *   STRIPE_SECRET_KEY       — sk_live_...
 *   STRIPE_WEBHOOK_SECRET   — whsec_... (from Stripe Dashboard → Webhooks)
 *
 * In Stripe Dashboard → Developers → Webhooks → Add endpoint:
 *   URL:    https://vqchwioyhyiuunpyildz.supabase.co/functions/v1/stripe-webhook
 *   Events: checkout.session.completed
 *           customer.subscription.deleted
 *           customer.subscription.updated
 *           invoice.payment_failed
 */

import Stripe from 'npm:stripe@14';
import { createClient } from 'npm:@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2023-10-16',
});

// Service-role client bypasses RLS — only use server-side
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

Deno.serve(async (req: Request) => {
  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    return new Response('Missing stripe-signature header', { status: 400 });
  }

  let event: Stripe.Event;
  try {
    const body = await req.text();
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      Deno.env.get('STRIPE_WEBHOOK_SECRET')!,
    );
  } catch (err) {
    console.error('[webhook] Signature verification failed:', err);
    return new Response(`Webhook error: ${(err as Error).message}`, { status: 400 });
  }

  console.log(`[webhook] Event: ${event.type}`);

  try {
    switch (event.type) {

      /* ── Payment / Checkout completed ── */
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId  = session.client_reference_id || session.metadata?.userId;
        const type    = session.metadata?.type;

        if (!userId) {
          console.warn('[webhook] checkout.session.completed: no userId in metadata');
          break;
        }

        if (type === 'membership') {
          const { error } = await supabase.from('profiles').update({
            is_member:    true,
            member_since: new Date().toISOString(),
            // Store Stripe customer/subscription IDs for portal access
            stripe_customer_id:     session.customer as string ?? null,
            stripe_subscription_id: session.subscription as string ?? null,
          }).eq('id', userId);
          if (error) console.error('[webhook] Failed to set member:', error);
          else        console.log(`[webhook] User ${userId} → member`);
        }

        if (type === 'cv_boost') {
          // Grant one extra CV analysis
          const { error } = await supabase.rpc('increment_cv_boosts', { profile_id: userId });
          if (error) console.error('[webhook] cv_boost update failed:', error);
          else        console.log(`[webhook] User ${userId} → cv_extra_boosts +1`);
        }

        if (type === 'office_hours') {
          // Log the purchase — frontend shows Calendly link on success page
          console.log(`[webhook] User ${userId} purchased Office Hours`);
        }

        if (type === 'job_listing') {
          // userId is repurposed to carry the listings.id (post.html is unauthenticated)
          const { error } = await supabase
            .from('listings')
            .update({ payment_confirmed: true })
            .eq('id', userId);
          if (error) console.error('[webhook] job_listing confirm failed:', error);
          else        console.log(`[webhook] Listing ${userId} payment confirmed`);
        }
        break;
      }

      /* ── Subscription cancelled ── */
      case 'customer.subscription.deleted': {
        const sub    = event.data.object as Stripe.Subscription;
        const userId = (sub.metadata as Record<string, string>).userId;
        if (userId) {
          const { error } = await supabase.from('profiles').update({
            is_member:              false,
            stripe_subscription_id: null,
          }).eq('id', userId);
          if (error) console.error('[webhook] Failed to revoke membership:', error);
          else        console.log(`[webhook] User ${userId} → membership cancelled`);
        }
        break;
      }

      /* ── Subscription updated (e.g. plan change) ── */
      case 'customer.subscription.updated': {
        const sub    = event.data.object as Stripe.Subscription;
        const userId = (sub.metadata as Record<string, string>).userId;
        if (userId) {
          const isActive = sub.status === 'active' || sub.status === 'trialing';
          await supabase.from('profiles').update({ is_member: isActive }).eq('id', userId);
        }
        break;
      }

      /* ── Payment failed (send alert or downgrade) ── */
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        console.warn(`[webhook] Payment failed for customer ${invoice.customer}`);
        // Optionally: send email notification via Supabase or a transactional email service
        break;
      }

      default:
        console.log(`[webhook] Unhandled event type: ${event.type}`);
    }
  } catch (err) {
    console.error('[webhook] Handler error:', err);
    // Return 200 so Stripe doesn't keep retrying for our own errors
    return new Response('Handler error (logged)', { status: 200 });
  }

  return new Response('ok', { status: 200 });
});
